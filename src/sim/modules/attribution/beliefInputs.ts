import type { EntityRef, TavernState } from '../../state/TavernState'

import { getAttributionModuleState } from './attributionQueries'
import type { AttributionAccuracy, AttributionState, AttributionType } from './attributionTypes'

// Expansion Phase 8 §8.5 — the one way a domain reads what somebody believes.
//
// The plan is precise about the shape this has to take:
//
//   "Attribution does not directly mutate unrelated domains. It supplies a
//    bounded input to their decision rules."
//
// So this file has no `ctx`, writes nothing, and returns a number between 0
// and 1 with a sentence attached. Every caller is a domain rule that already
// owns the decision it is making — the supplier's own price, the group's own
// forecast, the regular's own visit assessment — and each one decides for
// itself what a belief of weight 1 is worth inside it, declaring its own cap
// as a named constant. That is what stops the belief layer becoming a second
// set of levers on everything.
//
// WHY MAX RATHER THAN SUM. A holder can carry several grievances against the
// house at once, and adding them up would make "how many separate things
// went wrong" the driver instead of "how badly do they feel about it" — with
// no natural ceiling, which is exactly the accumulation Wave 7 had to unwind
// in the pressure layer. The strongest single belief is what someone acts
// on, and it is bounded by construction.

/**
 * Below this a belief is real but not yet motivating: it colours what people
 * say and shows in reports, and changes no decision. Above it, domains act.
 *
 * 0.35 is `strength 60 × confidence 60` — a settled opinion rather than a
 * passing impression, which is the line §8.5's "strong beliefs" draws.
 */
export const BELIEF_ACTING_THRESHOLD = 0.35

/** Types that count as held AGAINST their target. */
const NEGATIVE_TYPES: ReadonlySet<AttributionType> = new Set([
  'blame',
  'resentment',
  'suspicion',
  'distrust',
])

/** Types that count as held IN FAVOUR of their target. */
const POSITIVE_TYPES: ReadonlySet<AttributionType> = new Set([
  'credit',
  'gratitude',
  'trust',
])

export type BeliefDirection = 'against' | 'toward'

export type BeliefPressure = {
  holder: EntityRef
  subject: EntityRef
  direction: BeliefDirection
  /** 0…1. Already bounded; callers scale it by their own cap. */
  weight: number
  /** The single belief behind the weight — what a report or a driver says. */
  readable: string
  attributionId: string
  attributionType: AttributionType
  /** 0–100. How far outside the holder's own head this belief has got. */
  publicness: number
  /**
   * Whether the belief is TRUE. Domains that offer the player a way to answer
   * a belief need this: talking somebody out of something they are right
   * about is not the same move as correcting a false one.
   */
  accuracy: AttributionAccuracy
}

/** The tavern itself, as beliefs refer to it. */
export function houseRef(state: TavernState): EntityRef {
  return { kind: 'tavern_identity', id: state.meta.tavernId }
}

function refEquals(a: EntityRef, b: EntityRef): boolean {
  return a.kind === b.kind && a.id === b.id
}

/**
 * How heavily one belief weighs on the person holding it.
 *
 * Strength is how much it matters to them; confidence is how sure they are.
 * A thing somebody is certain about but does not much care about moves no
 * decisions, and neither does a thing they would care about enormously if
 * only they believed it.
 */
function weigh(attribution: AttributionState): number {
  const raw = (attribution.strength / 100) * (attribution.confidence / 100)
  return Math.max(0, Math.min(1, Math.round(raw * 1000) / 1000))
}

function strongest(
  state: TavernState,
  holder: EntityRef,
  subject: EntityRef,
  types: ReadonlySet<AttributionType>,
  direction: BeliefDirection,
): BeliefPressure | undefined {
  const slice = getAttributionModuleState(state)
  if (!slice) return undefined
  let best: AttributionState | undefined
  let bestWeight = 0
  for (const attribution of slice.attributions) {
    if (!types.has(attribution.attributionType)) continue
    if (!refEquals(attribution.perceivedBy, holder)) continue
    if (!refEquals(attribution.target, subject)) continue
    const weight = weigh(attribution)
    // Ties break on id so the same state always names the same belief —
    // otherwise a reload that rebuilt the array in another order would
    // produce a different driver string for an identical world.
    if (
      weight > bestWeight ||
      (weight === bestWeight && best !== undefined && attribution.id < best.id)
    ) {
      best = attribution
      bestWeight = weight
    }
  }
  if (!best || bestWeight <= 0) return undefined
  return {
    holder,
    subject,
    direction,
    weight: bestWeight,
    readable: best.readable,
    attributionId: best.id,
    attributionType: best.attributionType,
    publicness: best.publicness,
    accuracy: best.accuracy,
  }
}

/** The strongest thing one entity holds against another, if anything. */
export function beliefBetween(
  state: TavernState,
  holder: EntityRef,
  subject: EntityRef,
): BeliefPressure | undefined {
  return strongest(state, holder, subject, NEGATIVE_TYPES, 'against')
}

/** The strongest thing somebody holds against the house. */
export function beliefAgainstHouse(
  state: TavernState,
  holder: EntityRef,
): BeliefPressure | undefined {
  return strongest(state, holder, houseRef(state), NEGATIVE_TYPES, 'against')
}

/** …and the strongest thing they credit it with. */
export function goodwillTowardHouse(
  state: TavernState,
  holder: EntityRef,
): BeliefPressure | undefined {
  return strongest(state, holder, houseRef(state), POSITIVE_TYPES, 'toward')
}

/**
 * The net feeling somebody has about the house, −1…+1.
 *
 * For the domains whose rule already has a single "how do they feel" term
 * (the forecast, the visit assessment) rather than separate penalty and
 * bonus paths. Goodwill does not cancel a grievance point for point: being
 * pleased about one thing is weaker than being aggrieved about another,
 * which is why the positive side is halved.
 */
export function netFeelingTowardHouse(
  state: TavernState,
  holder: EntityRef,
): number {
  const against = beliefAgainstHouse(state, holder)?.weight ?? 0
  const toward = goodwillTowardHouse(state, holder)?.weight ?? 0
  return Math.max(-1, Math.min(1, toward * 0.5 - against))
}

/**
 * Above this, a belief is not just held — it is being said out loud, and
 * somebody with no dealings of their own can have heard it.
 */
export const PUBLIC_BELIEF_THRESHOLD = 60

/**
 * The loudest thing being said against the house by anybody.
 *
 * For the domains that have no dealings with the tavern of their own to read
 * — the landlord asked for terms, the watch reading a borderline sheet —
 * where what is LEGITIMATELY available to them is the town's opinion rather
 * than a private grudge. Private beliefs (publicness below the threshold) are
 * deliberately invisible here: overhearing somebody's unspoken resentment
 * would be the belief layer leaking, which is the thing §8.5 forbids.
 */
export function publicBeliefAgainstHouse(
  state: TavernState,
): BeliefPressure | undefined {
  const slice = getAttributionModuleState(state)
  if (!slice) return undefined
  const house = houseRef(state)
  let best: AttributionState | undefined
  let bestWeight = 0
  for (const attribution of slice.attributions) {
    if (!NEGATIVE_TYPES.has(attribution.attributionType)) continue
    if (!refEquals(attribution.target, house)) continue
    if (attribution.publicness < PUBLIC_BELIEF_THRESHOLD) continue
    const weight = weigh(attribution)
    if (
      weight > bestWeight ||
      (weight === bestWeight && best !== undefined && attribution.id < best.id)
    ) {
      best = attribution
      bestWeight = weight
    }
  }
  if (!best || bestWeight <= 0) return undefined
  return {
    holder: { ...best.perceivedBy },
    subject: house,
    direction: 'against',
    weight: bestWeight,
    readable: best.readable,
    attributionId: best.id,
    attributionType: best.attributionType,
    publicness: best.publicness,
    accuracy: best.accuracy,
  }
}

/** Is this belief strong enough to be changing decisions? */
export function isActing(pressure: BeliefPressure | undefined): boolean {
  return (pressure?.weight ?? 0) >= BELIEF_ACTING_THRESHOLD
}

/**
 * Scale a belief by a domain's own cap.
 *
 * Callers pass the most their rule will ever let a belief be worth; a belief
 * at the acting threshold is worth nothing yet and one at full weight is
 * worth the cap, so a domain's cap is a real ceiling rather than a number
 * the strongest belief overshoots.
 */
export function beliefEffect(
  pressure: BeliefPressure | undefined,
  cap: number,
): number {
  if (!isActing(pressure)) return 0
  const above = (pressure!.weight - BELIEF_ACTING_THRESHOLD) / (1 - BELIEF_ACTING_THRESHOLD)
  return Math.max(0, Math.min(cap, cap * above))
}
