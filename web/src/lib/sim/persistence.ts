// Phase 96 — Session persistence.
//
// `gameStore` is the SOLE caller of `simulateDay`. `persistence` is the
// SOLE owner of `localStorage` I/O for the game session. App boot drives
// the load/save loop; the store provides serialize/hydrate methods over
// its own reactive state.
//
// Save shape is a single versioned envelope keyed by `SAVE_STORAGE_KEY`.
// Reads run through the existing sim-side `ensure*` migrations from
// `src/sim/state/migrations.ts` plus `safeValidateState`, so a save
// created before a schema-additive sim change can still load.
//
// What's persisted:
//   - sim state (the source of truth)
//   - previousCalendar snapshot (the Daily Report needs the
//     pre-runDay calendar to label the just-closed day)
//   - latestResult MINUS its state (deduped — we already have state)
//   - the cross-screen action queue (`picks`) and sticky
//     `staffPriorities`
//   - the day-session view state (current beat + the two complete
//     flags) and the day's pending intents
//   - the last route, so the player returns to the same tab
//
// What's NOT persisted:
//   - `transitioning` (UI-only pacing animation, always restored false)
//   - any in-flight bottom sheet state (drawers / pickers)
//   - debug-only fields
//
// Failure modes return a typed `LoadOutcome`. Callers should treat
// `'invalid'` and `'incompatible'` as "show start screen with a clear
// path to start over".

import {
  ensureWorldBranch,
  ensureAreaIdentityFields,
  ensureStaffIdentityFields,
  ensureWeeklyHistoryField,
  ensureMonthlyHistoryField,
  ensureRecipesSlice,
  ensureExpeditionsSlice,
  ensureModuleSlices,
} from '../../../../src/sim/state/migrations'
import { safeValidateState } from '../../../../src/sim/state/validation'
import { FULL_PIPELINE } from '../../../../src/sim/canonicalPipeline'
import type { TavernState } from '../../../../src/sim/state/TavernState'
import type { CalendarState } from '../../../../src/sim/modules/calendar/types'
import type { SimResult } from '../../../../src/sim/core/result'
import { sanitizePicks, type PickedAction } from './actionBuilder'
import type {
  Beat,
  DaySessionSnapshot,
  PendingChoice,
} from './daySession'

export const SAVE_STORAGE_KEY = 'goblin-tavern:save:v1'
export const SAVE_VERSION = 1 as const

// SimResult minus its TavernState — state is already at the envelope
// root, so duplicating it would roughly double the save size.
export type LatestResultLite = Omit<SimResult, 'state'>

export type Route = 'day' | 'reports' | 'tavern' | 'world' | 'more'

export type PersistedSession = {
  saveVersion: typeof SAVE_VERSION
  savedAt: string
  simSeed: string
  state: TavernState
  previousCalendar?: CalendarState
  latestResultLite?: LatestResultLite
  picks: PickedAction[]
  staffPriorities: Record<string, string>
  pendingBySeedId: Record<string, PendingChoice>
  daySession: DaySessionSnapshot
  route: Route
  /**
   * Phase 97 — Per-day dismissed missed-opportunity ids. Pruned at day
   * rollover to a 7-day window. Optional in storage so old saves
   * (created before Phase 97 landed) hydrate to an empty set without
   * an `incompatible` bounce.
   */
  dismissedMissedOpportunityIds?: string[]
}

export type LoadOutcome =
  | { kind: 'fresh' }
  | { kind: 'loaded'; save: PersistedSession }
  | { kind: 'invalid'; reason: string }
  | { kind: 'incompatible'; saveVersion: number }

/**
 * Validation outcome for an already-parsed `PersistedSession`-shaped
 * object. Shared by `loadSession`, snapshot load, and import paths so
 * all three go through the same migration + zod validation pipeline.
 */
export type ValidationOutcome =
  | { kind: 'loaded'; save: PersistedSession }
  | { kind: 'invalid'; reason: string }
  | { kind: 'incompatible'; saveVersion: number }

const VALID_BEATS: ReadonlySet<Beat> = new Set<Beat>([
  'morning',
  'plan',
  'service',
  'closing',
  'report',
])
const VALID_ROUTES: ReadonlySet<Route> = new Set<Route>([
  'day',
  'reports',
  'tavern',
  'world',
  'more',
])

// ──────────────────────────────────────────────────────────────────
// Storage adapter — abstracted so tests can supply an in-memory
// store without touching `window`. Defaults to `localStorage` when
// available; falls back to an in-memory map (test runners,
// SSR-style preview).

export type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

let memoryFallback: Map<string, string> | undefined
let activeStorage: StorageLike | undefined

function defaultStorage(): StorageLike {
  if (typeof globalThis !== 'undefined') {
    const candidate = (globalThis as { localStorage?: StorageLike }).localStorage
    if (candidate) return candidate
  }
  if (!memoryFallback) memoryFallback = new Map<string, string>()
  const fallback = memoryFallback
  return {
    getItem: (k) => (fallback.has(k) ? fallback.get(k)! : null),
    setItem: (k, v) => fallback.set(k, v),
    removeItem: (k) => fallback.delete(k),
  }
}

/** Test seam — pass a fresh storage adapter between cases. */
export function setStorageForTesting(s: StorageLike | undefined): void {
  activeStorage = s
}

function getStorage(): StorageLike {
  return activeStorage ?? defaultStorage()
}

// ──────────────────────────────────────────────────────────────────
// Save

// Phase 89 / ISSUE-049 — `saveSession()` previously returned `void` and
// silently swallowed storage failures, so the UI's `lastSavedAt`
// timestamp updated unconditionally even on a failed write. The typed
// result lets the App layer keep the timestamp pinned to the last
// successful write and surface a recoverable banner.
export type SaveResult =
  | { ok: true; savedAt: string }
  | { ok: false; reason: SaveFailureReason; message: string }

export type SaveFailureReason = 'quota' | 'unavailable' | 'unknown'

let quotaWarned = false

function classifyStorageError(err: unknown): SaveFailureReason {
  if (err && typeof err === 'object') {
    const e = err as { name?: unknown; code?: unknown }
    if (
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 ||
      e.code === 1014
    ) {
      return 'quota'
    }
  }
  return 'unknown'
}

export function saveSession(session: PersistedSession): SaveResult {
  let storage: StorageLike
  try {
    storage = getStorage()
  } catch (err) {
    return {
      ok: false,
      reason: 'unavailable',
      message: describeErr(err),
    }
  }
  try {
    const payload = JSON.stringify(session)
    storage.setItem(SAVE_STORAGE_KEY, payload)
    return { ok: true, savedAt: session.savedAt }
  } catch (err) {
    const reason = classifyStorageError(err)
    if (!quotaWarned) {
      quotaWarned = true
      // Quota errors are noisy but non-fatal. Drop a single warning so
      // a developer can spot the problem in the console, but don't
      // break the play session.
      // eslint-disable-next-line no-console
      console.warn(
        'goblin-tavern: failed to write save to localStorage',
        err,
      )
    }
    return { ok: false, reason, message: describeErr(err) }
  }
}

export function clearSession(): void {
  try {
    getStorage().removeItem(SAVE_STORAGE_KEY)
  } catch {
    // Ignore — storage may be unavailable.
  }
}

// ──────────────────────────────────────────────────────────────────
// Load

export function loadSession(): LoadOutcome {
  let raw: string | null
  try {
    raw = getStorage().getItem(SAVE_STORAGE_KEY)
  } catch (err) {
    return { kind: 'invalid', reason: `storage read failed: ${describeErr(err)}` }
  }
  if (raw === null || raw === '') return { kind: 'fresh' }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    return { kind: 'invalid', reason: `malformed JSON: ${describeErr(err)}` }
  }

  return validatePersistedSession(parsed)
}

/**
 * Validate a parsed payload against the `PersistedSession` shape. Runs
 * the same migration + zod pipeline as `loadSession`. Used by snapshot
 * load (`snapshots.loadSnapshot`) and JSON import (`exportImport.parseImportedSession`).
 *
 * Accepts the unknown JSON, returns a typed outcome with either the
 * fully migrated + sanitized session, an `invalid` reason, or
 * `incompatible` with the discovered saveVersion.
 */
export function validatePersistedSession(parsed: unknown): ValidationOutcome {
  if (!isObject(parsed)) {
    return { kind: 'invalid', reason: 'save root is not an object' }
  }

  const version = (parsed as { saveVersion?: unknown }).saveVersion
  if (typeof version !== 'number') {
    return { kind: 'invalid', reason: 'saveVersion missing' }
  }
  if (version !== SAVE_VERSION) {
    return { kind: 'incompatible', saveVersion: version }
  }

  const rawState = (parsed as { state?: unknown }).state
  if (!isObject(rawState)) {
    return { kind: 'invalid', reason: 'state missing' }
  }

  let migratedState: TavernState
  try {
    // Phase 89 / ISSUE-049 — additive migration chain. Each helper is
    // idempotent and a no-op when the slice already matches the current
    // shape. Order matters only where one helper depends on another's
    // output; today that's just `ensureModuleSlices` running last after
    // module-state-bearing slices are guaranteed.
    const s0 = rawState as Partial<TavernState>
    const s1 = ensureWorldBranch(s0)
    const s2 = ensureAreaIdentityFields(s1)
    const s3 = ensureStaffIdentityFields(s2)
    const s4 = ensureRecipesSlice(s3)
    const s5 = ensureExpeditionsSlice(s4)
    const s6 = ensureWeeklyHistoryField(s5)
    const s7 = ensureMonthlyHistoryField(s6)
    const s8 = ensureModuleSlices(s7)
    const validation = safeValidateState(s8, { modules: FULL_PIPELINE })
    if (!validation.success) {
      const first = validation.errors[0]
      return {
        kind: 'invalid',
        reason: `state failed validation: ${first?.path ?? ''} ${first?.message ?? ''}`.trim(),
      }
    }
    migratedState = validation.state
  } catch (err) {
    return { kind: 'invalid', reason: `migration threw: ${describeErr(err)}` }
  }

  const simSeed = readString(parsed, 'simSeed') ?? 'crooked-keg'
  const savedAt = readString(parsed, 'savedAt') ?? new Date(0).toISOString()
  const route = readRoute(parsed, 'route') ?? 'day'

  // Phase 89 / ISSUE-049 — Saved owner-action picks now run through a
  // sanitiser before reaching the cross-screen queue. Drops shape
  // errors, unknown actions, target-type drift, and dangling target
  // ids. A console.warn surfaces the dropped count once per load.
  const picksRaw = (parsed as { picks?: unknown }).picks
  const { picks, droppedCount: droppedPicks } = sanitizePicks(
    picksRaw,
    migratedState,
  )
  if (droppedPicks > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `goblin-tavern: dropped ${droppedPicks} invalid owner-action pick(s) during load`,
    )
  }

  const staffPrioritiesRaw = (parsed as { staffPriorities?: unknown }).staffPriorities
  const staffPriorities: Record<string, string> =
    isObject(staffPrioritiesRaw)
      ? Object.fromEntries(
          Object.entries(staffPrioritiesRaw).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        )
      : {}

  const pendingRaw = (parsed as { pendingBySeedId?: unknown }).pendingBySeedId
  const pendingBySeedId: Record<string, PendingChoice> = isObject(pendingRaw)
    ? sanitizePending(pendingRaw as Record<string, unknown>)
    : {}

  const daySessionRaw = (parsed as { daySession?: unknown }).daySession
  const daySession: DaySessionSnapshot = sanitizeDaySession(daySessionRaw)

  const previousCalendarRaw = (parsed as { previousCalendar?: unknown }).previousCalendar
  const previousCalendar = isObject(previousCalendarRaw)
    ? (previousCalendarRaw as CalendarState)
    : undefined

  const latestResultLiteRaw = (parsed as { latestResultLite?: unknown }).latestResultLite
  const latestResultLite = isObject(latestResultLiteRaw)
    ? (latestResultLiteRaw as LatestResultLite)
    : undefined

  const dismissedRaw = (parsed as { dismissedMissedOpportunityIds?: unknown })
    .dismissedMissedOpportunityIds
  const dismissedMissedOpportunityIds: string[] = Array.isArray(dismissedRaw)
    ? dismissedRaw.filter((v): v is string => typeof v === 'string')
    : []

  const save: PersistedSession = {
    saveVersion: SAVE_VERSION,
    savedAt,
    simSeed,
    state: migratedState,
    picks,
    staffPriorities,
    pendingBySeedId,
    daySession,
    route,
    dismissedMissedOpportunityIds,
    ...(previousCalendar ? { previousCalendar } : {}),
    ...(latestResultLite ? { latestResultLite } : {}),
  }

  return { kind: 'loaded', save }
}

// ──────────────────────────────────────────────────────────────────
// Welcome-back pill helper

export type RelativeTime = {
  hours: number
  days: number
  phrase: string
}

/**
 * Returns a human-friendly phrase for the gap between `savedAtIso` and
 * `now`. Returns `undefined` for gaps under 4 hours (no pill shown).
 *
 * Thresholds:
 *   < 4h    → undefined (player hasn't really "been away")
 *   < 24h   → "~Nh"
 *   < 14d   → "Nd"  (rounded down; "1d" at 24-48h, etc.)
 *   ≥ 14d   → "2+ weeks"
 */
export function relativeTime(
  savedAtIso: string,
  now: Date,
): RelativeTime | undefined {
  const savedAt = Date.parse(savedAtIso)
  if (!Number.isFinite(savedAt)) return undefined
  const deltaMs = now.getTime() - savedAt
  if (deltaMs < 0) return undefined
  const hours = Math.floor(deltaMs / (60 * 60 * 1000))
  const days = Math.floor(hours / 24)
  if (hours < 4) return undefined
  if (hours < 24) return { hours, days, phrase: `~${hours}h` }
  if (days < 14) return { hours, days, phrase: `${days}d` }
  return { hours, days, phrase: '2+ weeks' }
}

// ──────────────────────────────────────────────────────────────────
// Helpers

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function readString(obj: unknown, key: string): string | undefined {
  if (!isObject(obj)) return undefined
  const v = obj[key]
  return typeof v === 'string' ? v : undefined
}

function readRoute(obj: unknown, key: string): Route | undefined {
  const v = readString(obj, key)
  return v && VALID_ROUTES.has(v as Route) ? (v as Route) : undefined
}

function sanitizeDaySession(raw: unknown): DaySessionSnapshot {
  if (!isObject(raw)) {
    return { beat: 'morning', serviceComplete: false, closingComplete: false }
  }
  const beatRaw = raw['beat']
  const beat: Beat =
    typeof beatRaw === 'string' && VALID_BEATS.has(beatRaw as Beat)
      ? (beatRaw as Beat)
      : 'morning'
  return {
    beat,
    serviceComplete: raw['serviceComplete'] === true,
    closingComplete: raw['closingComplete'] === true,
  }
}

function sanitizePending(
  raw: Record<string, unknown>,
): Record<string, PendingChoice> {
  const out: Record<string, PendingChoice> = {}
  for (const [seedId, entry] of Object.entries(raw)) {
    if (!isObject(entry)) continue
    const kind = entry['kind']
    if (kind === 'ignore') {
      out[seedId] = { kind: 'ignore' }
      continue
    }
    if (kind !== 'choice') continue
    const slotId = entry['slotId']
    const verb = entry['verb']
    const choice = entry['choice']
    if (typeof slotId !== 'string') continue
    if (typeof verb !== 'string') continue
    if (!isObject(choice)) continue
    const validChoice = sanitizeChoice(choice)
    if (!validChoice) continue
    out[seedId] = { kind: 'choice', slotId, verb, choice: validChoice }
  }
  return out
}

function sanitizeChoice(raw: Record<string, unknown>): import('../cards/types').CardChoice | undefined {
  const slotId = raw['slotId']
  const label = raw['label']
  const verb = raw['verb']
  const shape = raw['shape']
  const previewEffectsRaw = raw['previewEffects']
  if (
    typeof slotId !== 'string' ||
    typeof label !== 'string' ||
    typeof verb !== 'string' ||
    typeof shape !== 'string' ||
    !Array.isArray(previewEffectsRaw)
  ) {
    return undefined
  }
  const previewEffects = previewEffectsRaw.filter(
    (s): s is string => typeof s === 'string',
  )
  const targetId = typeof raw['targetId'] === 'string' ? (raw['targetId'] as string) : undefined
  const disabledReason =
    typeof raw['disabledReason'] === 'string' ? (raw['disabledReason'] as string) : undefined
  return {
    slotId,
    label,
    verb: verb as import('../cards/types').CardChoice['verb'],
    shape: shape as import('../cards/types').CardChoice['shape'],
    previewEffects,
    ...(targetId !== undefined ? { targetId } : {}),
    ...(disabledReason !== undefined ? { disabledReason } : {}),
  }
}

function describeErr(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'unknown error'
}
