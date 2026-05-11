import type { HistoryEntry, TavernState } from '../../state/TavernState'

// Phase 16 §16.8 — History log helpers.
//
// History entries live at `state.history` (root-level, append-only).
// These pure helpers are the read side of the history log; the engine
// owns the write side via `ctx.addHistory`. Callers (reports, tests,
// future causes/issue-seeds) reach for these to scan recent entries
// without poking at the array directly.

function asHistoryList(
  input: TavernState | ReadonlyArray<HistoryEntry>,
): ReadonlyArray<HistoryEntry> {
  if (Array.isArray(input)) return input
  return (input as TavernState).history
}

export function getRecentHistory(
  state: TavernState,
  days: number,
): HistoryEntry[] {
  if (days <= 0) return []
  const cutoff = state.calendar.totalDaysElapsed - days
  const out: HistoryEntry[] = []
  for (const entry of state.history) {
    if (entry.timestamp.absoluteDay >= cutoff) out.push(entry)
  }
  return out
}

export function getHistoryByTag(
  state: TavernState | ReadonlyArray<HistoryEntry>,
  tag: string,
): HistoryEntry[] {
  const out: HistoryEntry[] = []
  for (const entry of asHistoryList(state)) {
    if (entry.tags.includes(tag)) out.push(entry)
  }
  return out
}

export function getHistoryByCategory(
  state: TavernState | ReadonlyArray<HistoryEntry>,
  category: HistoryEntry['category'],
): HistoryEntry[] {
  const out: HistoryEntry[] = []
  for (const entry of asHistoryList(state)) {
    if (entry.category === category) out.push(entry)
  }
  return out
}

// Phase 16 §"Do Not Do" — keep summaries terse. This guard catches
// accidental novel-length summaries during development and is exported
// so unit tests can pin the limit.
export const HISTORY_SUMMARY_MAX_LENGTH = 240
