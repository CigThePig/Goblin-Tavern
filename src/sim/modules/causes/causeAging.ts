import type { CauseEntry } from '../../state/TavernState'

// Phase 17 §17.6 — Cause aging and expiration.
//
// At end of day every cause has its `ageDays` incremented by 1 (or
// `daysElapsed` if a multi-day step is fed in). Causes expire when
// their `ageDays` meets or exceeds `expiresAfterDays`. Causes without
// an `expiresAfterDays` value use the engine default (configured at
// the cause module level).
//
// The result mirrors `ageMemories` from Phase 16: `next` keeps the
// live entries, `expired` carries the entries that were pruned.

export const DEFAULT_CAUSE_EXPIRY_DAYS = 5

export type CauseAgeResult = {
  next: CauseEntry[]
  expired: CauseEntry[]
}

export function ageCauses(
  causes: ReadonlyArray<CauseEntry>,
  daysElapsed: number = 1,
  defaultExpiry: number = DEFAULT_CAUSE_EXPIRY_DAYS,
): CauseAgeResult {
  if (daysElapsed <= 0) {
    return { next: [...causes], expired: [] }
  }
  const next: CauseEntry[] = []
  const expired: CauseEntry[] = []
  for (const cause of causes) {
    const aged: CauseEntry = {
      ...cause,
      ageDays: cause.ageDays + daysElapsed,
    }
    const lifespan = cause.expiresAfterDays ?? defaultExpiry
    if (aged.ageDays >= lifespan) {
      expired.push(aged)
    } else {
      next.push(aged)
    }
  }
  return { next, expired }
}
