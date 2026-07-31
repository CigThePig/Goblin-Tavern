import type { SimContext } from '../../../core/context'
import type {
  CustomerGroupState,
  RegularWorldState,
} from '../../../state/TavernState'

import {
  MAX_PARTIES_PER_DAY,
  MAX_PARTY_SIZE,
  SERVICE_WAVES,
  type ServiceParty,
} from './types'

// Expansion Phase 4 §4.1 "arrivals by customer group and party/cohort" — how a
// night's demand becomes a bounded set of parties.
//
// THE SCALING RULE (§4.2). "Preserve customer groups as scalable persistent
// populations. Service can instantiate bounded parties or cohorts without
// turning every patron into a permanent entity." So: the GROUP is the
// population and persists; the PARTY is how a slice of it turns up tonight and
// is gone by morning. The only named participants are regulars, who persist
// anyway.
//
// THE BOUND IS A CEILING ON PARTIES, NOT ON PATRONS (§"bounded party/event
// counts under extreme traffic"). Once `MAX_PARTIES_PER_DAY` parties exist, the
// remaining demand is spread across them — a payday flood arrives as fewer,
// larger parties, which is heavier to SERVE without being more expensive to
// SIMULATE. Headcount is conserved exactly, so the flow's own arithmetic still
// reconciles against the demand it was given.

const RNG_STREAM = 'service_flow' as const

/** Typical party size by the group's declared traffic pattern. */
const PATTERN_PARTY_SIZE: Record<string, { min: number; max: number }> = {
  evening_locals: { min: 2, max: 4 },
  payday_burst: { min: 2, max: 5 },
  market_day: { min: 1, max: 3 },
  brawl_night: { min: 3, max: 6 },
  large_party: { min: 4, max: 8 },
  sporadic: { min: 1, max: 3 },
  irregular: { min: 1, max: 4 },
  rare: { min: 1, max: 3 },
  very_rare: { min: 1, max: 2 },
}

const DEFAULT_PARTY_SIZE = { min: 2, max: 4 }

/**
 * When the group tends to arrive, as a weight per wave.
 *
 * Six weights, one per wave. They are shapes rather than probabilities — the
 * builder normalises them — and they are the reason a `payday_burst` crowd can
 * overwhelm a kitchen that would have coped with the same headcount spread
 * across the evening. That is a real bottleneck produced by real timing, which
 * is what §4.1 asks for.
 */
const PATTERN_ARRIVAL_CURVE: Record<string, ReadonlyArray<number>> = {
  evening_locals: [1, 2, 3, 3, 2, 1],
  payday_burst: [3, 4, 3, 1, 1, 1],
  market_day: [3, 3, 2, 2, 1, 1],
  brawl_night: [1, 1, 2, 3, 4, 3],
  large_party: [1, 2, 3, 3, 2, 1],
  sporadic: [1, 1, 1, 1, 1, 1],
  irregular: [2, 1, 2, 1, 2, 1],
  rare: [1, 1, 2, 2, 1, 1],
  very_rare: [1, 1, 1, 1, 1, 1],
}

const DEFAULT_ARRIVAL_CURVE: ReadonlyArray<number> = [1, 2, 3, 3, 2, 1]

function sizeRangeFor(group: CustomerGroupState): { min: number; max: number } {
  return PATTERN_PARTY_SIZE[group.trafficPattern] ?? DEFAULT_PARTY_SIZE
}

function arrivalCurveFor(group: CustomerGroupState): ReadonlyArray<number> {
  const curve = PATTERN_ARRIVAL_CURVE[group.trafficPattern] ?? DEFAULT_ARRIVAL_CURVE
  return curve.length === SERVICE_WAVES ? curve : DEFAULT_ARRIVAL_CURVE
}

/**
 * How many waves a party will wait before walking out.
 *
 * Loyal, satisfied cohorts give the house the benefit of the doubt; an
 * irritated crowd does not. This is the meter that makes §4.1's "abandonment,
 * reduced spend, or dissatisfaction from delay" a consequence of the player's
 * standing rather than a fixed timer.
 */
export function patienceFor(
  group: CustomerGroupState,
  regular: RegularWorldState | undefined,
): number {
  let patience = 1 + group.loyalty / 40 + (group.satisfaction - 50) / 50
  if (regular) {
    // A regular waits longer for a house they like, and less for one that has
    // been annoying them.
    patience += regular.loyalty / 60 - regular.irritation / 50
  }
  return Math.max(1, Math.min(5, Math.round(patience)))
}

/** Pick an arrival wave from the group's curve. */
function pickArrivalWave(
  curve: ReadonlyArray<number>,
  roll: number,
): number {
  const total = curve.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) return 0
  let cursor = roll * total
  for (let wave = 0; wave < curve.length; wave++) {
    cursor -= curve[wave]!
    if (cursor <= 0) return wave
  }
  return curve.length - 1
}

export type PartyBuildInput = {
  /** Per-group demand: how many patrons wanted to come tonight. */
  demandByGroup: Record<string, number>
  /** Regulars who decided to come in, by regular id. */
  regularVisitIds: ReadonlyArray<string>
}

/**
 * Turn the evening's demand into parties.
 *
 * The only randomness is party composition and arrival timing, drawn from the
 * dedicated `service_flow` stream so an extra service roll cannot shift a
 * generated name (architecture rule 7) and a change to seating logic cannot
 * shift who arrives.
 */
export function buildParties(
  ctx: SimContext,
  input: PartyBuildInput,
): ServiceParty[] {
  const rng = ctx.getRngStream(RNG_STREAM)
  const parties: ServiceParty[] = []
  let counter = 0

  const nextParty = (
    group: CustomerGroupState,
    size: number,
    regular: RegularWorldState | undefined,
  ): ServiceParty => {
    const curve = arrivalCurveFor(group)
    const arrivalWave = pickArrivalWave(curve, rng.float())
    counter += 1
    // Every key is declared here, in `ServicePartySchema`'s order, including
    // the ones nothing has filled in yet. See the key-order note on that
    // schema: the flow must only ever assign in place, because a key appended
    // mid-evening would make a reloaded day serialise differently from an
    // uninterrupted one. `undefined` values are dropped by JSON, so nothing is
    // stored for a party that never sat down.
    const party: ServiceParty = {
      // Zero-padded so the lexical sort below is also the arrival order.
      id: `party_${String(counter).padStart(3, '0')}`,
      groupId: group.id,
      size,
      regularId: regular?.id,
      arrivalWave,
      patience: patienceFor(group, regular),
      wavesWaited: 0,
      seatedWave: undefined,
      areaId: undefined,
      servedWave: undefined,
      leftWave: undefined,
      outcome: 'unserved_at_close',
      order: [],
      paid: 0,
      tab: 0,
      blockedBy: undefined,
      notes: [],
    }
    return party
  }

  // Regulars first, so a named participant always gets a party even on a night
  // the group's own demand rounded to nothing. §4.3 "visit as identifiable
  // participants" fails if a regular's visit can be squeezed out by arithmetic.
  const remaining: Record<string, number> = { ...input.demandByGroup }
  const regularIds = [...input.regularVisitIds].sort((a, b) => a.localeCompare(b))
  for (const regularId of regularIds) {
    if (parties.length >= MAX_PARTIES_PER_DAY) break
    const regular = ctx.state.world.regulars[regularId]
    if (!regular) continue
    const group = ctx.state.customerGroups[regular.customerGroupId]
    if (!group) continue
    // A regular arrives alone or with a companion or two.
    const companions = rng.int(0, 2)
    const size = 1 + companions
    parties.push(nextParty(group, size, regular))
    remaining[group.id] = Math.max(0, (remaining[group.id] ?? 0) - size)
  }

  // Then the anonymous cohorts, group by group in a stable order.
  const groupIds = Object.keys(input.demandByGroup).sort((a, b) => a.localeCompare(b))
  for (const groupId of groupIds) {
    const group = ctx.state.customerGroups[groupId]
    if (!group) continue
    const range = sizeRangeFor(group)
    let left = Math.max(0, Math.round(remaining[groupId] ?? 0))
    while (left > 0 && parties.length < MAX_PARTIES_PER_DAY) {
      const size = Math.min(left, rng.int(range.min, Math.min(range.max, MAX_PARTY_SIZE)))
      if (size <= 0) break
      parties.push(nextParty(group, size, undefined))
      left -= size
    }
    // Cap reached with patrons still outside: they join the parties that group
    // already has rather than vanishing.
    if (left > 0) {
      const groupParties = parties.filter((party) => party.groupId === groupId)
      if (groupParties.length === 0) continue
      let index = 0
      while (left > 0) {
        const party = groupParties[index % groupParties.length]!
        party.size += 1
        left -= 1
        index += 1
      }
    }
  }

  // Stable order: arrival wave first, then party id. The wave loop walks this
  // order, so seating is first-come-first-served and a reload cannot reshuffle
  // the queue.
  parties.sort((a, b) =>
    a.arrivalWave === b.arrivalWave
      ? a.id.localeCompare(b.id)
      : a.arrivalWave - b.arrivalWave,
  )
  return parties
}
