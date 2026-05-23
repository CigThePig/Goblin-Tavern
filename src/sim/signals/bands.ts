// Phase 127 / ISSUE-096 — Voiced Surface arc, Phase 1.
//
// Band threshold tables. Three bands per signal (`low` / `mid` / `high`)
// with two cut-points. Values are inclusive of the lower bound and
// exclusive of the upper bound, so a value sitting exactly on a cut-
// point lands in the higher band — this matches how the existing seed
// generators compare against thresholds (e.g. `reliability < 30 ⇒ low`).
//
// Why hard data tables and not derived constants: the gates' diversity
// sampler needs to enumerate the reachable band space per signal, and
// snippets author against named bands rather than raw numbers. Both
// require the boundaries to be data the surface exports.

import type { BandId, SignalId } from './types'

/** Two cut-points per signal: `[lowMax, midMax]`. Values `< lowMax` are
 *  `low`; values in `[lowMax, midMax)` are `mid`; values `>= midMax` are
 *  `high`. Defaults to thirds for 0–100 scalars; per-signal overrides
 *  live below if a stat reads more naturally with a different break. */
export const BAND_THRESHOLDS: Record<SignalId, [number, number]> = {
  'supplier.reliability': [40, 70],
  'supplier.relationship': [40, 70],
  'staff.stress': [40, 70],
  'staff.fatigue': [40, 70],
  'faction.relationship': [40, 70],
  'faction.influence': [40, 70],
  'area.condition': [40, 70],
  'area.cleanliness': [40, 70],
  // Phase 134 / ISSUE-103 — Voiced Surface Phase 8. Default-thirds
  // matches the seed generators' threshold semantics: a regular_customer
  // complaint fires at `irritation > 60` (lands in `mid` until 70, then
  // `high`), and a customer_complaint fires at `satisfaction <= 60`
  // (`mid` band). Snippets gate on `low`/`high` for the dramatic
  // extremes and fall back through `mid` for the neutral cases.
  'regular.irritation': [40, 70],
  'regular.loyalty': [40, 70],
  'customer_group.satisfaction': [40, 70],
  'customer_group.loyalty': [40, 70],
  // Phase 136 / ISSUE-105 — Voiced Surface Phase 10 (Factions & Culture).
  // Default-thirds matches the culture_conflict seed threshold: the seed
  // fires at `cultural_tension >= 25`, but the culture's own `tension`
  // meter is what the establishing line states; default-thirds keeps the
  // dramatic extremes addressable (low: settled, high: on-edge).
  'culture.tension': [40, 70],
  'culture.comfort': [40, 70],
  'culture.familiarity': [40, 70],
  // Phase 137 / ISSUE-106 — Voiced Surface Phase 11 (Premises & Atmosphere).
  // Default-thirds matches the maintenance seed generator's threshold
  // (`damage + (60 - condition) >= 60` to fire). Snippets gate the
  // dramatic extremes (low: barely touched, high: visibly failing) on
  // the band; the mid band is the unanchored fallback.
  'area.damage': [40, 70],
}

/** Pure bander. Returns `low` for `value < thresholds[0]`, `high` for
 *  `value >= thresholds[1]`, otherwise `mid`. */
export function bandOf(
  value: number,
  thresholds: [number, number],
): BandId {
  if (value < thresholds[0]) return 'low'
  if (value >= thresholds[1]) return 'high'
  return 'mid'
}
