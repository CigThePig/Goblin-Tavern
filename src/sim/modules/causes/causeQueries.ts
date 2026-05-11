import type { CauseEntry, TavernState } from '../../state/TavernState'

// Phase 17 §17.7 — Explanation queries.
//
// These helpers let modules and reports answer "why did this change?"
// without re-walking `state.causes` each time. They are pure functions
// over the causes array (or a full `TavernState`) and never mutate the
// engine — the engine owns the only `addCause` write path.

function asCauseList(
  input: TavernState | ReadonlyArray<CauseEntry>,
): ReadonlyArray<CauseEntry> {
  if (Array.isArray(input)) return input
  return (input as TavernState).causes
}

export function getCausesForTarget(
  state: TavernState | ReadonlyArray<CauseEntry>,
  target: string,
): CauseEntry[] {
  const out: CauseEntry[] = []
  for (const cause of asCauseList(state)) {
    if (cause.target === target) out.push(cause)
  }
  return out
}

export function getCausesByTag(
  state: TavernState | ReadonlyArray<CauseEntry>,
  tag: string,
): CauseEntry[] {
  const out: CauseEntry[] = []
  for (const cause of asCauseList(state)) {
    if (cause.tags.includes(tag)) out.push(cause)
  }
  return out
}

export function getCausesBySource(
  state: TavernState | ReadonlyArray<CauseEntry>,
  source: string,
): CauseEntry[] {
  const out: CauseEntry[] = []
  for (const cause of asCauseList(state)) {
    if (cause.source === source) out.push(cause)
  }
  return out
}

export function getTopCausesForTarget(
  state: TavernState | ReadonlyArray<CauseEntry>,
  target: string,
  limit: number,
): CauseEntry[] {
  const matching = getCausesForTarget(state, target)
  matching.sort((a, b) => b.weight - a.weight)
  if (limit <= 0) return []
  return matching.slice(0, limit)
}

export function getRecentCauses(
  state: TavernState,
  days: number,
): CauseEntry[] {
  if (days <= 0) return []
  const cutoff = state.calendar.totalDaysElapsed - days
  return state.causes.filter((c) => c.timestamp.absoluteDay >= cutoff)
}

// Phase 17 §17.7 — Convenience explanation queries. Each one names a
// canonical target so callers can ask "why did X change?" without
// constructing the target string by hand.

export function explainTargetChange(
  state: TavernState,
  target: string,
): CauseEntry[] {
  return getCausesForTarget(state, target)
}

export function explainCustomerSatisfaction(
  state: TavernState,
  groupId: string,
): CauseEntry[] {
  return getCausesForTarget(state, `customer:${groupId}.satisfaction`)
}

export function explainPressure(
  state: TavernState,
  pressureId: string,
): CauseEntry[] {
  return getCausesForTarget(state, `pressure:${pressureId}`)
}

export function explainReputation(
  state: TavernState,
  axisId: string,
): CauseEntry[] {
  return getCausesForTarget(state, `reputation:${axisId}`)
}

export function explainCoinChange(state: TavernState): CauseEntry[] {
  return getCausesForTarget(state, 'coin')
}
