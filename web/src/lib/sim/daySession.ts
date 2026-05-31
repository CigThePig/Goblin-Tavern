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

/**
 * Phase 186 / Day-Clock Cluster 5 — which day segment has most recently
 * run for the in-progress (or just-closed) day. The day now advances as
 * three real engine segments (contract §2) instead of one end-of-day
 * `simulateDay`:
 *
 *   'A' — setup ran (`startDay … forecastTraffic`); the morning surface
 *         is populated and the player is at Pause 1 (morning/plan beats).
 *   'B' — proactive moves ran (`beforeOwnerActions … closing`); service
 *         resolved and emergent cards exist. Player is at Pause 2
 *         (service/closing beats).
 *   'C' — wrap-up ran (`applyResponses … advanceCalendar`); the day is
 *         closed and the report is built (report beat). This is ALSO the
 *         "ready to begin the next day" state — `beginDay()` only opens a
 *         new day from 'C'.
 *
 * The field is persisted so a mid-day refresh resumes against the right
 * segment without re-running one (state IS the checkpoint; contract
 * §1.2). It is kept in lock-step with `beat`: the (beat, segment) pair is
 * always written together, so they never disagree on resume.
 */
export type DaySegment = 'A' | 'B' | 'C'

export type DaySessionSnapshot = {
  beat: Beat
  serviceComplete: boolean
  closingComplete: boolean
  // Optional so saves written before Cluster 5 (no segment field) still
  // load — the sanitiser derives a value from `beat` when it is absent.
  segment?: DaySegment
}

export const INITIAL_DAY_SESSION: Required<DaySessionSnapshot> = {
  beat: 'morning',
  serviceComplete: false,
  closingComplete: false,
  // 'C' is the "ready to begin a new day" state; the first `beginDay()`
  // opens day one from here. See DaySegment doc above.
  segment: 'C',
}

/**
 * Phase 97 — How long (in days) a per-line missed-opportunity dismissal
 * survives in the save before being pruned. Seven days keeps a window
 * wide enough for a player who flips back to a recent day's report to
 * see their dismissals respected, narrow enough that the set stays
 * tiny.
 */
export const MISSED_OPPORTUNITY_DISMISSAL_WINDOW_DAYS = 7
