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
