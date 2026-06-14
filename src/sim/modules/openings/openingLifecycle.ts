import type { TavernState } from '../../state/TavernState'

// Phase 2 (teleology) — pure decay/return helpers.
//
// Kept free of RNG and ctx so they can be unit-tested directly: the module
// hook supplies state and these decide *what* the world is saying, while
// the hook decides *when* to roll (on the named 'opening' RNG stream).

// How long an offered opening stays active before it is parked.
export const OPENING_ACTIVE_WINDOW_DAYS = 5
// How long a parked opening waits for a qualifying delta before it dies.
export const OPENING_RETURN_WINDOW_DAYS = 14
// A meter delta smaller than this (absolute) is noise, not a reason to
// re-offer an opening.
export const OPENING_RETURN_DELTA_THRESHOLD = 6

/** The standing meters that decide whether a liquor-licence-style opening
 *  is worth re-proposing. Returned as a flat record so a snapshot can be
 *  diffed field-by-field against a later reading. Cold-bootstrap can read
 *  these on day 1: identity counts are non-empty and the relationship
 *  meters have starter values. */
export function readOpeningMeters(state: TavernState): Record<string, number> {
  const rep = state.reputation
  const factions = Object.values(state.world.factions)
  const avgFaction =
    factions.length > 0
      ? factions.reduce((sum, f) => sum + f.relationship, 0) / factions.length
      : 0
  const groups = Object.values(state.customerGroups)
  const avgPatronage =
    groups.length > 0
      ? groups.reduce((sum, g) => sum + g.patronage, 0) / groups.length
      : 0
  return {
    respectable: rep.respectable,
    reliable: rep.reliable,
    factionRelationship: Math.round(avgFaction),
    patronage: Math.round(avgPatronage),
  }
}

export type ReturnDelta = {
  /** True when the net meter movement clears the noise threshold. */
  qualifies: boolean
  /** Sign of the net movement. */
  valence: 'positive' | 'negative'
  /** Net signed movement across the keyed meters. */
  netDelta: number
  /** Per-meter signed deltas, largest absolute first. */
  drivers: Array<{ meter: string; delta: number }>
}

/** Compare a parked opening's snapshot against current meters. The branch
 *  (re-offer positive vs negative, or no qualifying movement → eventual
 *  death) is decided *causally* from the sign and magnitude of the net
 *  delta — never randomly. */
export function classifyReturnDelta(
  snapshot: Record<string, number>,
  current: Record<string, number>,
): ReturnDelta {
  const drivers: Array<{ meter: string; delta: number }> = []
  let netDelta = 0
  for (const meter of Object.keys(snapshot)) {
    const before = snapshot[meter] ?? 0
    const after = current[meter] ?? before
    const delta = after - before
    if (delta !== 0) drivers.push({ meter, delta })
    netDelta += delta
  }
  drivers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  const qualifies = Math.abs(netDelta) >= OPENING_RETURN_DELTA_THRESHOLD
  return {
    qualifies,
    valence: netDelta >= 0 ? 'positive' : 'negative',
    netDelta,
    drivers,
  }
}

/** Format a short, readable cause string citing the meter movement that
 *  brought an opening back (or kept it from dying). */
export function describeReturnDelta(delta: ReturnDelta): string {
  const top = delta.drivers[0]
  if (!top) return 'standing conditions held steady'
  const sign = top.delta > 0 ? 'rose' : 'fell'
  return `${humanizeMeter(top.meter)} ${sign} ${Math.abs(top.delta)}`
}

function humanizeMeter(meter: string): string {
  switch (meter) {
    case 'respectable':
      return 'respectability'
    case 'reliable':
      return 'reliability'
    case 'factionRelationship':
      return 'faction standing'
    case 'patronage':
      return 'patronage'
    default:
      return meter
  }
}
