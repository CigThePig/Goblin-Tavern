// Phase 127 / ISSUE-096 — Voiced Surface arc, Phase 1.
//
// Backing the `repeatCount` snippet condition. Counts how many memories
// carrying a given tag landed inside a rolling window. The window is a
// named constant so tests can pin the boundary; the default 28 days
// covers ~four in-game weeks, which matches the "third week running"
// gradient `card-composition-framework.md §2.3` gives as the canonical
// example.

import type { TavernState } from '../state/TavernState'

export const DEFAULT_REPEAT_WINDOW_DAYS = 28

/** Count memories whose `tags` array includes `subjectTag` and whose
 *  `createdAt.absoluteDay` is within the last `windowDays` days
 *  (inclusive of the current day). Pure; no allocations beyond the
 *  filter. */
export function repeatCountByTag(
  state: TavernState,
  subjectTag: string,
  windowDays: number = DEFAULT_REPEAT_WINDOW_DAYS,
): number {
  const today = state.calendar.totalDaysElapsed
  const oldest = today - windowDays
  let count = 0
  for (const memory of state.memories) {
    if (!memory.tags.includes(subjectTag)) continue
    if (memory.createdAt.absoluteDay < oldest) continue
    count++
  }
  return count
}
