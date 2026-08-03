// Phase 200 / audit Wave 1 (`P7-EXP-001`) — what a response costs.
//
// One function, used in three places that must not disagree:
//
//   - the card layer, to disable a choice the player cannot afford;
//   - `applyResponsesHook`, to refuse an intent atomically rather than
//     spend halfway into a negative till;
//   - the tests that hold the boundary.
//
// The audit's failure was precisely a disagreement of this kind: the
// choice's own preview said `Coin -120`, nothing checked it against the
// 98 coin on hand, and the day resolved 183 coin of selected responses
// into a till that had 98 in it.
//
// Only *immediate* coin cost counts. A delayed effect is paid on the day
// it fires, and is affordability-checked then, by the same drain path.

import type { ConsequenceProfile, IssueSeed } from '../issues/issueSeedTypes'
import { RENT_PAYMENT_EFFECT_TARGET } from '../monthly/types'
import { LOAN_BORROW_EFFECT_TARGET } from '../finance/types'

/** Effect targets that take coin out of the till when applied. */
const COIN_TARGETS: ReadonlySet<string> = new Set([
  'coin',
  RENT_PAYMENT_EFFECT_TARGET,
  // Expansion Phase 7 §7.1 — a loan disbursement moves coin the other way,
  // and a profile that borrows and spends in the same breath must net off
  // rather than be judged unaffordable against the till it is about to fill.
  LOAN_BORROW_EFFECT_TARGET,
])

/**
 * Coin this profile spends the moment it is applied, as a positive
 * number. Effects that *add* coin net off against it, so a profile that
 * spends 40 and returns 10 costs 30.
 */
export function immediateCoinCost(profile: ConsequenceProfile): number {
  let net = 0
  for (const effect of profile.immediateEffects) {
    if (effect.kind !== 'state_change') continue
    if (!COIN_TARGETS.has(effect.target)) continue
    net += effect.amount ?? 0
  }
  return net < 0 ? -net : 0
}

/**
 * Coin cost of taking `slotId` on `seed`, or 0 when the slot has no
 * profile or spends nothing.
 */
export function coinCostOfSlot(seed: IssueSeed, slotId: string): number {
  // Tolerate a seed with no profiles: the card layer renders partial and
  // stub seeds too, and a slot with nothing modelled behind it costs
  // nothing.
  const profile = seed.consequenceProfiles?.find(
    (candidate) => candidate.responseSlotId === slotId,
  )
  return profile ? immediateCoinCost(profile) : 0
}

// Phase 203 / audit Wave 4 (`P6-COMP-005`) — the same three-place contract
// for the OTHER resource a response can spend.
//
// The audit's failure was subtler than the coin one: `Spend owner time on
// the licence` declared `costTypes: ['owner_time']`, showed no amount,
// took none, and advanced the venture anyway. Four other profiles carried
// a `global.owner_time` effect that the applier silently discarded. There
// was no number to show, gate or spend — so there is one now, and it comes
// from the profile, like coin does.

/** The effect target that takes minutes off the owner's working day. */
export const OWNER_TIME_EFFECT_TARGET = 'global.owner_time'

/**
 * Minutes of the owner's day this profile consumes the moment it is
 * applied, as a positive number. Effects that give time back net off.
 */
export function immediateOwnerTimeCost(profile: ConsequenceProfile): number {
  let net = 0
  for (const effect of profile.immediateEffects) {
    if (effect.kind !== 'state_change') continue
    if (effect.target !== OWNER_TIME_EFFECT_TARGET) continue
    net += effect.amount ?? 0
  }
  return net < 0 ? -net : 0
}

/**
 * Owner-time cost in minutes of taking `slotId` on `seed`, or 0 when the
 * slot has no profile or claims no time.
 */
export function ownerTimeCostOfSlot(seed: IssueSeed, slotId: string): number {
  const profile = seed.consequenceProfiles?.find(
    (candidate) => candidate.responseSlotId === slotId,
  )
  return profile ? immediateOwnerTimeCost(profile) : 0
}
