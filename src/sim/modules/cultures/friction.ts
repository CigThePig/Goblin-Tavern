import type { TavernState } from '../../state/TavernState'
import { getPolicyEffectStrength } from '../economy/policies'

// Expansion Phase 8 §8.2 — the seat-separation policy, and what it costs.
//
// `seat_groups_apart` is the policy that gives §8.2's "relationships with
// policies" something real on the seating side. It has to be a TRADE rather
// than a free improvement, or enabling it would be strictly correct and
// therefore not a decision:
//
//   * benefit — frictional cultures are kept in different rooms, so the
//     seating-friction evidence pass records nothing for them;
//   * cost — keeping groups apart wastes seats. You cannot fill the last
//     table in a room if the only party waiting is one you are keeping away
//     from the party already in it, so usable seating falls.
//
// Both halves read THIS function, so the benefit and the cost can never
// disagree about whether the policy is on.

/** How hard the house is separating groups, 0..1. */
export function seatSeparationStrength(state: TavernState): number {
  return getPolicyEffectStrength(state, 'seat_groups_apart')
}

/** Usable seats lost to keeping groups apart. A multiplier on seating. */
export function getSeatSeparationFactor(state: TavernState): number {
  const strength = seatSeparationStrength(state)
  if (strength <= 0) return 1
  // Up to 12% of the room goes unused at full enforcement — enough to be
  // felt on a busy night, never enough to close the tavern.
  return Math.max(0.88, 1 - strength * 0.12)
}

/** Are frictional cultures being deliberately kept apart tonight? */
export function separatingGroups(state: TavernState): boolean {
  return seatSeparationStrength(state) > 0
}
