// Phase 197 / ISSUE-164 — Cluster 2.
//
// Single canonical mapping from a state-diff path to the colon-style cause
// target the engine emits and both consumers (causeReport + causeLookup)
// expect. Centralising the map here means any future path addition only
// touches this file.
//
// Returns `undefined` for paths that have no canonical target (e.g.
// `modules.*` bookkeeping), which is the correct signal for "leave as
// unexplained".

export function canonicalCauseTarget(path: string): string | undefined {
  if (path === 'coin') return 'coin'

  if (path.startsWith('areas.')) {
    const id = path.split('.')[1]
    return id ? `area:${id}` : undefined
  }
  if (path.startsWith('stock.')) {
    const id = path.split('.')[1]
    return id ? `stock:${id}` : undefined
  }
  if (path.startsWith('staff.')) {
    const id = path.split('.')[1]
    return id ? `staff:${id}` : undefined
  }
  if (path.startsWith('customers.')) {
    const id = path.split('.')[1]
    return id ? `customer:${id}` : undefined
  }
  if (path.startsWith('recipes.')) {
    const id = path.split('.')[1]
    return id ? `recipe:${id}` : undefined
  }
  if (path.startsWith('reputation.')) {
    const axis = path.split('.')[1]
    return axis ? `reputation:${axis}` : undefined
  }
  if (path.startsWith('pressures.')) {
    const id = path.split('.')[1]
    return id ? `pressure:${id}` : undefined
  }
  if (path.startsWith('cultures.')) {
    const id = path.split('.')[1]
    return id ? `culture:${id}` : undefined
  }
  if (path.startsWith('factions.')) {
    const id = path.split('.')[1]
    return id ? `faction:${id}` : undefined
  }
  if (path.startsWith('suppliers.')) {
    const id = path.split('.')[1]
    return id ? `supplier:${id}` : undefined
  }
  if (path.startsWith('regulars.')) {
    const id = path.split('.')[1]
    return id ? `regular:${id}` : undefined
  }
  if (path.startsWith('notableNpcs.')) {
    const id = path.split('.')[1]
    return id ? `notable_npc:${id}` : undefined
  }
  if (path.startsWith('localEvents.')) {
    const id = path.split('.')[1]
    return id ? `local_event:${id}` : undefined
  }
  if (path.startsWith('socialRumours.')) {
    const id = path.split('.')[1]
    return id ? `rumour:${id}` : undefined
  }
  if (path === 'tavernIdentity' || path.startsWith('tavernIdentity.')) {
    return 'tavernIdentity'
  }

  // `modules.*` is intentionally left unmapped. Module-internal state
  // mutations have no canonical cause-target convention; surfacing them as
  // "unexplained" is the right audit signal until module owners attribute
  // their own writes.
  return undefined
}

/**
 * Whether a stored cause target satisfies a drilldown lookup target.
 *
 * An id-level lookup (`stock:ale`) must match field-level stored causes
 * (`stock:ale.quantity`), and vice versa — both directions are needed so
 * modules that emit id-level causes are found by field-level lookups too.
 *
 * Shared by causeReport (audit) and causeLookup (UI drilldown) so both
 * consumers apply identical semantics.
 */
export function targetMatches(storedTarget: string, lookupTarget: string): boolean {
  if (storedTarget === lookupTarget) return true
  // Field-level stored target matches id-level lookup: `stock:ale.quantity` ∋ `stock:ale`
  if (storedTarget.startsWith(`${lookupTarget}.`)) return true
  // Id-level stored target matches field-level lookup: `pressure:food_safety` ∋ `pressure:food_safety.value`
  if (lookupTarget.startsWith(`${storedTarget}.`)) return true
  // Phase 197 / ISSUE-164 — transitional dot-tolerance: pre-upgrade causes
  // stored with the old engine dot-path convention (e.g. `stock.ale.quantity`)
  // canonicalize to the same colon target (`stock:ale`) so they still match
  // while they age out (≤5 days). Remove after one release cycle.
  if (canonicalCauseTarget(storedTarget) === lookupTarget) return true
  return false
}
