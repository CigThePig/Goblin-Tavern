import type { CustomerGroupState, TavernState } from '../../state/TavernState'

import {
  beliefAgainstHouse,
  beliefEffect,
  goodwillTowardHouse,
} from '../attribution/beliefInputs'

// Expansion Phase 8 §8.5 — what a customer group's opinion of the house is
// worth to its own turnout.
//
// The rule lives here, in the customers module, rather than in the belief
// layer: §8.5 is explicit that attribution "supplies a bounded input to their
// decision rules" rather than reaching into other domains. The belief layer
// says how heavily a group feels; this file decides what that is worth in
// bodies through the door, and caps it.
//
// FOUR, not more. This term stacks on Phase 5's demand factor, 8.1's faction
// stance and 8.2's culture layer, all of which can pull the same group the
// same way on the same night. A group that has come to blame the house is a
// real reason for a thinner room; it must not be the reason.

export const MAX_BELIEF_FORECAST_SWING = 4

export type BeliefForecastModifier = {
  modifier: number
  notes: string[]
}

export function getBeliefForecastModifier(
  state: TavernState,
  group: CustomerGroupState,
): BeliefForecastModifier {
  const holder = { kind: 'customer_group' as const, id: group.id }
  const notes: string[] = []

  const against = beliefAgainstHouse(state, holder)
  const toward = goodwillTowardHouse(state, holder)

  const hit = beliefEffect(against, MAX_BELIEF_FORECAST_SWING)
  // Goodwill is worth half: being pleased with a place is a weaker reason to
  // go than being aggrieved is a reason to stay away.
  const pull = beliefEffect(toward, MAX_BELIEF_FORECAST_SWING / 2)

  if (hit > 0) {
    notes.push(`${group.label} hold something against the house (-${Math.round(hit)}).`)
  }
  if (pull > 0) {
    notes.push(`${group.label} think well of the house (+${Math.round(pull)}).`)
  }

  const modifier = Math.round(pull - hit)
  return { modifier, notes }
}
