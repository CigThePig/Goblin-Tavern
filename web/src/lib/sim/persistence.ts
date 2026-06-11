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
  ensureCastAttributes,
  ensureWeeklyHistoryField,
  ensureMonthlyHistoryField,
  ensureOwnerTimeFields,
  ensureRecipesSlice,
  ensureExpeditionsSlice,
  ensureModuleSlices,
  flipUpkeepRecipesOffMenu,
} from '../../../../src/sim/state/migrations'
import { safeValidateState } from '../../../../src/sim/state/validation'
import { FULL_PIPELINE } from '../../../../src/sim/canonicalPipeline'
import type { TavernState } from '../../../../src/sim/state/TavernState'
import type { CalendarState } from '../../../../src/sim/modules/calendar/types'
import type { SimResult } from '../../../../src/sim/core/result'
import type { TaggedStateDiff } from '../../../../src/sim/core/diff'
import type { IssueSeed } from '../../../../src/sim/modules/issues/issueSeedTypes'
import { sanitizePicks, type PickedAction } from './actionBuilder'
import type {
  Beat,
  DaySessionSnapshot,
  PendingChoice,
} from './daySession'

export const SAVE_STORAGE_KEY = 'goblin-tavern:save:v1'
export const SAVE_VERSION = 1 as const

// SimResult minus its TavernState. State is deduped at the envelope root.
// Diffs are persisted but with module-container values already excluded by
// the 10 k-char threshold in diffModules, so a day's changes array is
// typically a few KB — well within quota. After reload latestResult.diffs
// defaults to [] when absent (pre-fix saves).
export type LatestResultLite = Omit<SimResult, 'state' | 'diffs'> & {
  diffs?: TaggedStateDiff[]
}

export type Route = 'day' | 'reports' | 'tavern' | 'world' | 'more'

// Phase 93 / ISSUE-053 — Sub-tab persistence. Previously these were
// local `$state` in each screen and reset to defaults on reload. The
// envelope now carries the last visited subview per screen so Continue
// lands the player where they were.
export type ReportsSubview =
  | 'today'
  | 'pressures'
  | 'weekly'
  | 'monthly'
  | 'log'
export type TavernSubview =
  | 'areas'
  | 'stock'
  | 'recipes'
  | 'staff'
  | 'projects'
export type WorldSubview =
  | 'regulars'
  | 'suppliers'
  | 'factions'
  | 'cultures'
  | 'npcs'
  | 'rumours'

export type SubroutesState = {
  reports?: ReportsSubview
  tavern?: TavernSubview
  world?: WorldSubview
}

export type PersistedSession = {
  saveVersion: typeof SAVE_VERSION
  savedAt: string
  simSeed: string
  state: TavernState
  /**
   * Phase 186 / Day-Clock Cluster 5 — no longer written (removed to fix
   * mid-day save quota overflow; see 2026-06-11 audit §1). Kept in the
   * type so old saves that carry it still parse; hydration falls back to
   * the current state as the baseline when this field is absent.
   */
  dayBaseline?: TavernState
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
  /**
   * Phase 93 / ISSUE-053 — Last visited subview per top-level screen.
   * Optional so older saves (pre-Phase-93) keep loading; absent
   * subroutes fall back to the each screen's default at hydrate time.
   */
  subroutes?: SubroutesState
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
const VALID_REPORTS_SUBVIEWS: ReadonlySet<ReportsSubview> = new Set([
  'today',
  'pressures',
  'weekly',
  'monthly',
  'log',
])
const VALID_TAVERN_SUBVIEWS: ReadonlySet<TavernSubview> = new Set([
  'areas',
  'stock',
  'recipes',
  'staff',
  'projects',
])
const VALID_WORLD_SUBVIEWS: ReadonlySet<WorldSubview> = new Set([
  'regulars',
  'suppliers',
  'factions',
  'cultures',
  'npcs',
  'rumours',
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

  const stateOutcome = migrateAndValidateState(rawState)
  if (!stateOutcome.ok) {
    return { kind: 'invalid', reason: stateOutcome.reason }
  }
  const migratedState = stateOutcome.state

  // Phase 186 / Day-Clock Cluster 5 — the start-of-day baseline (present
  // only mid-day) runs through the same pipeline. If it's missing or
  // fails, drop it: the store's segment methods fall back to the current
  // state, which only loses the full-day-diff bracket for the single
  // resumed day. (Cluster 7 also drops it when an in-flight pre-Cluster-5
  // day is reset to a clean morning — see `restoreDaySession`.)
  const dayBaselineRaw = (parsed as { dayBaseline?: unknown }).dayBaseline
  let dayBaseline: TavernState | undefined
  if (isObject(dayBaselineRaw)) {
    const baselineOutcome = migrateAndValidateState(dayBaselineRaw)
    if (baselineOutcome.ok) {
      dayBaseline = baselineOutcome.state
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        `goblin-tavern: dropped invalid dayBaseline during load (${baselineOutcome.reason})`,
      )
    }
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
  let pendingBySeedId: Record<string, PendingChoice> = isObject(pendingRaw)
    ? sanitizePending(pendingRaw as Record<string, unknown>, migratedState)
    : {}

  const daySessionRaw = (parsed as { daySession?: unknown }).daySession
  const { daySession, resetInFlightDay } = restoreDaySession(daySessionRaw)

  // Phase 186 Cluster 7 — when a pre-Cluster-5 in-flight day is reset to a
  // clean morning (see `restoreDaySession`), drop the day's pending response
  // intents and start-of-day baseline: the intents point at pre-baked seed
  // ids that Segment A's regeneration clears, and the baseline belongs to a
  // day that never properly ran. `beginDay` mints a fresh baseline when it
  // re-opens the day. Queued owner-action `picks` are intentionally kept.
  if (resetInFlightDay) {
    pendingBySeedId = {}
    dayBaseline = undefined
    // eslint-disable-next-line no-console
    console.warn(
      'goblin-tavern: reset a pre-Cluster-5 in-flight day to a clean morning during load (Phase 186 Cluster 7 migration)',
    )
  }

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

  // Phase 93 / ISSUE-053 — Sanitise subroutes. Unknown enum values
  // drop the field so the screen falls back to its default subview.
  const subroutesRaw = (parsed as { subroutes?: unknown }).subroutes
  const subroutes: SubroutesState = isObject(subroutesRaw)
    ? sanitizeSubroutes(subroutesRaw)
    : {}

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
    ...(Object.keys(subroutes).length > 0 ? { subroutes } : {}),
    ...(dayBaseline ? { dayBaseline } : {}),
    ...(previousCalendar ? { previousCalendar } : {}),
    ...(latestResultLite ? { latestResultLite } : {}),
  }

  return { kind: 'loaded', save }
}

type StateMigrationOutcome =
  | { ok: true; state: TavernState }
  | { ok: false; reason: string }

/**
 * Phase 89 / ISSUE-049 — additive migration chain + validation, shared by
 * `state` and (Cluster 5) `dayBaseline`. Each `ensure*` helper is
 * idempotent and a no-op when the slice already matches the current
 * shape. Order matters only where one helper depends on another's output;
 * today that's just `ensureModuleSlices` running last after
 * module-state-bearing slices are guaranteed.
 */
function migrateAndValidateState(rawState: Record<string, unknown>): StateMigrationOutcome {
  try {
    const s0 = rawState as Partial<TavernState>
    const s1 = ensureWorldBranch(s0)
    const s2 = ensureAreaIdentityFields(s1)
    const s3 = ensureStaffIdentityFields(s2)
    const s4 = ensureRecipesSlice(s3)
    const s4b = flipUpkeepRecipesOffMenu(s4)
    const s5 = ensureExpeditionsSlice(s4b)
    const s6 = ensureWeeklyHistoryField(s5)
    const s7a = ensureMonthlyHistoryField(s6)
    // Phase 186 Cluster 7 — rename the owner-time fields
    // (`actionPoint* → time*`) so a pre-Cluster-7 save validates against
    // the renamed schema. No-op once the new keys are present.
    const s7 = ensureOwnerTimeFields(s7a)
    // Phase 121 / ISSUE-090 — Living Cast Phase A. Attaches cast
    // attributes to pre-Phase-A staff + regulars; no-op when already
    // present. Runs after the other ensure* helpers so that any
    // identity/world slice it depends on is already populated, and before
    // `ensureModuleSlices` for ordering symmetry with the rest of the chain.
    const s8 = ensureCastAttributes(s7)
    const s9 = ensureModuleSlices(s8)
    const validation = safeValidateState(s9, { modules: FULL_PIPELINE })
    if (!validation.success) {
      const first = validation.errors[0]
      return {
        ok: false,
        reason: `state failed validation: ${first?.path ?? ''} ${first?.message ?? ''}`.trim(),
      }
    }
    return { ok: true, state: validation.state }
  } catch (err) {
    return { ok: false, reason: `migration threw: ${describeErr(err)}` }
  }
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

function sanitizeSubroutes(raw: Record<string, unknown>): SubroutesState {
  const out: SubroutesState = {}
  const reportsRaw = raw['reports']
  if (
    typeof reportsRaw === 'string' &&
    VALID_REPORTS_SUBVIEWS.has(reportsRaw as ReportsSubview)
  ) {
    out.reports = reportsRaw as ReportsSubview
  }
  const tavernRaw = raw['tavern']
  if (
    typeof tavernRaw === 'string' &&
    VALID_TAVERN_SUBVIEWS.has(tavernRaw as TavernSubview)
  ) {
    out.tavern = tavernRaw as TavernSubview
  }
  const worldRaw = raw['world']
  if (
    typeof worldRaw === 'string' &&
    VALID_WORLD_SUBVIEWS.has(worldRaw as WorldSubview)
  ) {
    out.world = worldRaw as WorldSubview
  }
  return out
}

type DaySessionRestore = {
  daySession: DaySessionSnapshot
  /**
   * Phase 186 Cluster 7 — true when a pre-Cluster-5 in-flight day was reset
   * to a clean morning (contract §4.7). Callers drop the day's stale
   * pending response intents and start-of-day baseline when this is set.
   */
  resetInFlightDay: boolean
}

const FRESH_MORNING: DaySessionSnapshot = {
  beat: 'morning',
  serviceComplete: false,
  closingComplete: false,
  segment: 'C',
}

// Phase 186 Cluster 7 — in-flight save migration (contract §4.7).
//
// A save written before Cluster 5 carries no `segment` field. The day was
// a single end-of-day `simulateDay` then, so a save caught past the morning
// (plan/service/closing) sits on a state whose Segment A never ran and whose
// `seedsToday` was pre-baked by the old end-of-day model. Cluster 5's
// `sanitizeSegment` derives those beats to segment 'A'/'B' — which tells the
// store Segment A already ran, so `beginDay` is skipped and the day plays on
// against the stale pre-baked surface (skipped world advance, orphaned
// response intents).
//
// The ruling: reset those beats cleanly to the next morning. The reset
// lands at {beat:'morning', segment:'C'} — the "ready to begin" state — so
// `beginDay` (Segment A) re-opens the day from the top on the (start-of-day)
// state and regenerates today's surface honestly. Queued owner-action
// `picks` are kept (Segment B consumes them); the day's pending response
// intents are dropped by the caller (they reference pre-baked seed ids the
// regeneration clears).
//
// `morning` and `report` are NOT reset: both already derive to segment 'C'
// (the clean day boundary), where `beginDay` runs Segment A fresh anyway, so
// no Segment A is skipped and any pending survives the round-trip. A
// Cluster-5+ save carries an explicit `segment` and is trusted as-is.
const IN_FLIGHT_BEATS: ReadonlySet<Beat> = new Set<Beat>([
  'plan',
  'service',
  'closing',
])

function restoreDaySession(raw: unknown): DaySessionRestore {
  if (!isObject(raw)) {
    return { daySession: { ...FRESH_MORNING }, resetInFlightDay: false }
  }
  const beatRaw = raw['beat']
  const beat: Beat =
    typeof beatRaw === 'string' && VALID_BEATS.has(beatRaw as Beat)
      ? (beatRaw as Beat)
      : 'morning'

  const segmentRaw = raw['segment']
  const hasSegment = segmentRaw === 'A' || segmentRaw === 'B' || segmentRaw === 'C'

  // Cluster-5+ save: an explicit segment is the real checkpoint — trust it.
  if (hasSegment) {
    return {
      daySession: {
        beat,
        serviceComplete: raw['serviceComplete'] === true,
        closingComplete: raw['closingComplete'] === true,
        segment: segmentRaw,
      },
      resetInFlightDay: false,
    }
  }

  // Pre-Cluster-5 save (no segment). plan/service/closing were genuinely
  // mid-day under the old single end-of-day model → reset to a clean morning.
  if (IN_FLIGHT_BEATS.has(beat)) {
    return { daySession: { ...FRESH_MORNING }, resetInFlightDay: true }
  }

  // morning/report are clean day boundaries. Keep the beat but sit at
  // segment 'C' (NOT the Cluster-5 morning→'A' derivation): 'C' is the
  // "ready to begin" state, so the begin-day effect re-runs Segment A for
  // this resumed day instead of trusting the stale pre-baked surface. This
  // is not a reset — pending survives the round-trip.
  return {
    daySession: {
      beat,
      serviceComplete: raw['serviceComplete'] === true,
      closingComplete: raw['closingComplete'] === true,
      segment: 'C',
    },
    resetInFlightDay: false,
  }
}


function sanitizePending(
  raw: Record<string, unknown>,
  state: TavernState,
): Record<string, PendingChoice> {
  const seedsById = currentIssueSeedsById(state)
  const out: Record<string, PendingChoice> = {}
  for (const [seedId, entry] of Object.entries(raw)) {
    const seed = seedsById.get(seedId)
    if (!seed) continue
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
    if (!pendingChoiceMatchesCurrentSeed(seed, slotId, verb, validChoice)) continue
    out[seedId] = { kind: 'choice', slotId, verb, choice: validChoice }
  }
  return out
}


function currentIssueSeedsById(state: TavernState): Map<string, IssueSeed> {
  const issueSeedsState = state.modules['issueSeeds'] as
    | { seedsToday?: unknown }
    | undefined
  const seeds = Array.isArray(issueSeedsState?.seedsToday)
    ? issueSeedsState.seedsToday
    : []
  const out = new Map<string, IssueSeed>()
  for (const seed of seeds) {
    if (isObject(seed) && typeof seed['id'] === 'string') {
      out.set(seed['id'], seed as IssueSeed)
    }
  }
  return out
}

function pendingChoiceMatchesCurrentSeed(
  seed: IssueSeed,
  slotId: string,
  verb: string,
  choice: import('../cards/types').CardChoice,
): boolean {
  if (choice.slotId !== slotId || choice.verb !== verb) return false
  const slot = seed.responseSlots.find((candidate) => candidate.id === slotId)
  if (!slot) return false
  if (!slot.allowedVerbs.includes(choice.verb)) return false
  if (slot.shape !== choice.shape) return false

  const targetId = choice.targetId
  if (targetId === undefined) return true
  return slot.targetOptions.some((target) => target.id === targetId)
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
  const mechanicalEffectsRaw = raw['mechanicalEffects']
  const mechanicalEffects = Array.isArray(mechanicalEffectsRaw)
    ? mechanicalEffectsRaw.filter((s): s is string => typeof s === 'string')
    : undefined
  const targetId = typeof raw['targetId'] === 'string' ? (raw['targetId'] as string) : undefined
  const disabledReason =
    typeof raw['disabledReason'] === 'string' ? (raw['disabledReason'] as string) : undefined
  return {
    slotId,
    label,
    verb: verb as import('../cards/types').CardChoice['verb'],
    shape: shape as import('../cards/types').CardChoice['shape'],
    previewEffects,
    ...(mechanicalEffects !== undefined ? { mechanicalEffects } : {}),
    ...(targetId !== undefined ? { targetId } : {}),
    ...(disabledReason !== undefined ? { disabledReason } : {}),
  }
}

function describeErr(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'unknown error'
}
