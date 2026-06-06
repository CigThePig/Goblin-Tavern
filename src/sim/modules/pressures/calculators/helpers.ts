import type { PressureCauseRef } from '../pressureTypes'

// Shared helpers used by every pressure calculator. Kept tiny on purpose
// — the calculators themselves should remain readable as plain prose.

export function pushCause(
  causes: PressureCauseRef[],
  draft: {
    id: string
    readable: string
    amount: number
    tags?: string[]
    weight?: number
    relatedActors?: PressureCauseRef['relatedActors']
    relatedLocations?: PressureCauseRef['relatedLocations']
    relatedSystems?: string[]
    origin?: PressureCauseRef['origin']
  },
): void {
  const amount = draft.amount
  const direction: PressureCauseRef['direction'] =
    amount > 0 ? 'increase' : amount < 0 ? 'decrease' : 'neutral'
  const weight = draft.weight ?? Math.abs(amount)
  const ref: PressureCauseRef = {
    id: draft.id,
    readable: draft.readable,
    amount,
    weight,
    direction,
    tags: draft.tags ? [...draft.tags] : [],
  }
  if (draft.relatedActors && draft.relatedActors.length > 0) {
    ref.relatedActors = draft.relatedActors.map((a) => ({ ...a }))
  }
  if (draft.relatedLocations && draft.relatedLocations.length > 0) {
    ref.relatedLocations = draft.relatedLocations.map((l) => ({ ...l }))
  }
  if (draft.relatedSystems && draft.relatedSystems.length > 0) {
    ref.relatedSystems = [...draft.relatedSystems]
  }
  if (draft.origin !== undefined) ref.origin = draft.origin
  causes.push(ref)
}

export function combineToValue(baseline: number, causes: PressureCauseRef[]): number {
  let total = baseline
  for (const c of causes) total += c.amount
  if (total < 0) return 0
  if (total > 100) return 100
  return total
}

export function dominantWeightTotal(causes: PressureCauseRef[]): number {
  let sum = 0
  for (const c of causes) sum += c.weight
  return sum
}

export function severityFromValue(value: number): number {
  // Severity tracks the value at a 1:1 ratio for the base case. Calculators
  // may override this when they want to flag a low-value-but-serious case.
  if (value <= 0) return 0
  if (value >= 100) return 100
  return Math.round(value)
}

export function urgencyFromSeverity(
  severity: number,
  imminence: number = 0,
): number {
  // `imminence` boosts urgency for time-sensitive pressures (e.g. stock
  // shortage before a high-traffic day, rent due tomorrow).
  const raw = severity + imminence
  if (raw < 0) return 0
  if (raw > 100) return 100
  return Math.round(raw)
}
