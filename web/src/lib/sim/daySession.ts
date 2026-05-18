// Phase 96 — Shared day-session types.
//
// Extracted from DayScreen so the persistence layer (persistence.ts)
// and the game store (gameStore.svelte.ts) can reference these types
// without a circular import through DayScreen.svelte. Pure types only;
// no runtime code.

import type { CardChoice } from '../cards/types'

export type Beat = 'morning' | 'plan' | 'service' | 'closing' | 'report'

export type PendingChoice =
  | { kind: 'choice'; slotId: string; verb: string; choice: CardChoice }
  | { kind: 'ignore' }

export type DaySessionSnapshot = {
  beat: Beat
  serviceComplete: boolean
  closingComplete: boolean
}

export const INITIAL_DAY_SESSION: DaySessionSnapshot = {
  beat: 'morning',
  serviceComplete: false,
  closingComplete: false,
}

/**
 * Phase 97 — How long (in days) a per-line missed-opportunity dismissal
 * survives in the save before being pruned. Seven days keeps a window
 * wide enough for a player who flips back to a recent day's report to
 * see their dismissals respected, narrow enough that the set stays
 * tiny.
 */
export const MISSED_OPPORTUNITY_DISMISSAL_WINDOW_DAYS = 7
