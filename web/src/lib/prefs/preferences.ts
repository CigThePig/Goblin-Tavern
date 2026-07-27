// Phase 98 — Player preferences slice.
//
// `prefsStore` is the SOLE caller of these helpers; `preferences` is the
// SOLE owner of `localStorage` I/O for player preferences. Preferences
// are stored separately from save state (`PersistedSession`) so they
// survive Start Over and so a malformed save can't corrupt them.
//
// What's persisted:
//   - fontScale, reducedMotion (display preferences)
//   - showSeedTags, confirmEndDay (per-card / per-day prompts)
//   - showFirstEncounterHints + seenTerms (the tutorial slice)
//   - lastDifficulty (sticky StartScreen default)
//
// Failure modes: malformed JSON or version mismatch silently fall back
// to defaults. There is no "preferences-incompatible" banner — losing
// a slider position should never bounce the player to the StartScreen.

import type { DifficultyId } from '../../../../src/sim/state/difficulty'

export const PREFS_STORAGE_KEY = 'goblin-tavern:prefs:v1'
export const PREFS_VERSION = 1 as const

export type FontScale = 'sm' | 'md' | 'lg'
export type ReducedMotionMode = 'auto' | 'on' | 'off'
/**
 * Colour theme. 'dark' is the game's identity ("tavern at night") and
 * the default; 'light' is the parchment palette (authored in global.css
 * since the beginning but previously unreachable — index.html pinned
 * `data-theme="dark"`); 'auto' follows the OS prefers-color-scheme.
 */
export type ThemeMode = 'dark' | 'light' | 'auto'

export type Preferences = {
  version: typeof PREFS_VERSION
  fontScale: FontScale
  reducedMotion: ReducedMotionMode
  theme: ThemeMode
  showSeedTags: boolean
  /**
   * Phase 204 / audit Wave 5 (`P6-COMP-007`) — show raw simulation
   * identifiers instead of their player labels. Off by default: the audit
   * found `staff_arc`, `fumigate_cellar` and `cleanliness_negative` on
   * default surfaces, and its correction direction is to keep raw ids
   * available only behind an explicit debug preference.
   */
  showDiagnostics: boolean
  confirmEndDay: boolean
  showFirstEncounterHints: boolean
  seenTerms: string[]
  lastDifficulty: DifficultyId
}

export type PrefsLoadOutcome =
  | { kind: 'fresh'; prefs: Preferences }
  | { kind: 'loaded'; prefs: Preferences }

const VALID_FONT_SCALES: ReadonlySet<FontScale> = new Set<FontScale>(['sm', 'md', 'lg'])
const VALID_REDUCED_MOTION: ReadonlySet<ReducedMotionMode> = new Set<ReducedMotionMode>([
  'auto',
  'on',
  'off',
])
const VALID_THEMES: ReadonlySet<ThemeMode> = new Set<ThemeMode>(['dark', 'light', 'auto'])
const VALID_DIFFICULTIES: ReadonlySet<DifficultyId> = new Set<DifficultyId>([
  'easy',
  'standard',
  'hard',
])

// ──────────────────────────────────────────────────────────────────
// Defaults

/**
 * Build the default `Preferences` record. Auto-detects OS hints from
 * `window.matchMedia` when available (reduced-motion respects the OS
 * preference at boot), falling back to deterministic values during
 * test / SSR runs where `matchMedia` is undefined.
 */
export function getDefaultPreferences(): Preferences {
  return {
    version: PREFS_VERSION,
    fontScale: 'md',
    reducedMotion: 'auto',
    theme: 'dark',
    showSeedTags: true,
    showDiagnostics: false,
    confirmEndDay: false,
    showFirstEncounterHints: true,
    seenTerms: [],
    lastDifficulty: 'standard',
  }
}

// ──────────────────────────────────────────────────────────────────
// Storage adapter — mirrors persistence.ts, but does NOT share its
// `activeStorage` slot. Tests must be able to flush prefs storage
// independently of save storage.

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
// Save / Load

export function savePreferences(prefs: Preferences): void {
  try {
    getStorage().setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Storage may be unavailable (private mode, quota). Preferences
    // failures are silent — there's no UX path that depends on them.
  }
}

export function clearPreferences(): void {
  try {
    getStorage().removeItem(PREFS_STORAGE_KEY)
  } catch {
    // Ignore.
  }
}

export function loadPreferences(): PrefsLoadOutcome {
  let raw: string | null
  try {
    raw = getStorage().getItem(PREFS_STORAGE_KEY)
  } catch {
    return { kind: 'fresh', prefs: getDefaultPreferences() }
  }
  if (raw === null || raw === '') {
    return { kind: 'fresh', prefs: getDefaultPreferences() }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { kind: 'fresh', prefs: getDefaultPreferences() }
  }

  if (!isObject(parsed)) {
    return { kind: 'fresh', prefs: getDefaultPreferences() }
  }

  const version = (parsed as { version?: unknown }).version
  if (version !== PREFS_VERSION) {
    return { kind: 'fresh', prefs: getDefaultPreferences() }
  }

  return { kind: 'loaded', prefs: sanitize(parsed) }
}

// ──────────────────────────────────────────────────────────────────
// Helpers

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function sanitize(raw: Record<string, unknown>): Preferences {
  const defaults = getDefaultPreferences()
  const fontScale = raw['fontScale']
  const reducedMotion = raw['reducedMotion']
  const theme = raw['theme']
  const lastDifficulty = raw['lastDifficulty']
  const seenTermsRaw = raw['seenTerms']

  return {
    version: PREFS_VERSION,
    fontScale:
      typeof fontScale === 'string' && VALID_FONT_SCALES.has(fontScale as FontScale)
        ? (fontScale as FontScale)
        : defaults.fontScale,
    reducedMotion:
      typeof reducedMotion === 'string' &&
      VALID_REDUCED_MOTION.has(reducedMotion as ReducedMotionMode)
        ? (reducedMotion as ReducedMotionMode)
        : defaults.reducedMotion,
    theme:
      typeof theme === 'string' && VALID_THEMES.has(theme as ThemeMode)
        ? (theme as ThemeMode)
        : defaults.theme,
    showSeedTags: typeof raw['showSeedTags'] === 'boolean' ? raw['showSeedTags'] : defaults.showSeedTags,
    showDiagnostics:
      typeof raw['showDiagnostics'] === 'boolean'
        ? raw['showDiagnostics']
        : defaults.showDiagnostics,
    confirmEndDay: typeof raw['confirmEndDay'] === 'boolean' ? raw['confirmEndDay'] : defaults.confirmEndDay,
    showFirstEncounterHints:
      typeof raw['showFirstEncounterHints'] === 'boolean'
        ? raw['showFirstEncounterHints']
        : defaults.showFirstEncounterHints,
    seenTerms: Array.isArray(seenTermsRaw)
      ? seenTermsRaw.filter((v): v is string => typeof v === 'string')
      : defaults.seenTerms,
    lastDifficulty:
      typeof lastDifficulty === 'string' && VALID_DIFFICULTIES.has(lastDifficulty as DifficultyId)
        ? (lastDifficulty as DifficultyId)
        : defaults.lastDifficulty,
  }
}
