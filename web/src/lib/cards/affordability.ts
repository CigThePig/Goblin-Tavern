// Phase 200 / audit Wave 1 (`P7-EXP-001`), DC-07 — the selection half of
// the response-affordability policy.
//
// The sim refuses an unaffordable response when the day resolves, which is
// what keeps `coin >= 0`. That alone would leave the player picking a
// choice, being told nothing, and finding at End Day that it never
// happened. So the card disables a choice it cannot pay for, at the
// moment the player is looking at it, and says why.
//
// "Cannot pay for" accounts for what is already committed today: the
// audit's route selected several individually affordable responses whose
// total was 183 coin against a till holding 98. Committed choices are
// priced with the SAME function the sim applies at resolution
// (`coinCostOfSlot`), so the number shown and the number enforced cannot
// drift.

import { coinCostOfSlot } from '../../../../src/sim/modules/responses/responseCost'
import type { IssueSeed } from '../../../../src/sim/modules/issues/issueSeedTypes'
import type { PendingChoice } from '../sim/daySession'
import type { CardChoice, CardView } from './types'

/**
 * Coin already spoken for by today's committed choices, excluding
 * `exceptSeedId` — a card is priced against the others, not against its
 * own pending choice, so re-opening a decision doesn't disable the option
 * the player already picked.
 */
export function committedCoinCost(
  seeds: ReadonlyArray<IssueSeed>,
  pendingBySeedId: Record<string, PendingChoice>,
  exceptSeedId?: string,
): number {
  let total = 0
  for (const seed of seeds) {
    if (seed.id === exceptSeedId) continue
    const pending = pendingBySeedId[seed.id]
    if (!pending || pending.kind !== 'choice') continue
    total += coinCostOfSlot(seed, pending.slotId)
  }
  return total
}

/**
 * Return `view` with any choice the player cannot afford disabled and
 * given a readable reason. Choices that already carry a `disabledReason`
 * keep theirs — an existing reason is more specific than this one.
 */
export function gateChoicesByCoin(
  view: CardView,
  seed: IssueSeed,
  options: { coin: number; committed: number },
): CardView {
  const available = options.coin - options.committed
  let changed = false
  const choices: CardChoice[] = view.choices.map((choice) => {
    if (choice.disabledReason !== undefined) return choice
    const cost = coinCostOfSlot(seed, choice.slotId)
    if (cost <= 0 || cost <= available) return choice
    changed = true
    return {
      ...choice,
      disabledReason:
        options.committed > 0
          ? `Needs ${cost} coin; ${available} left after today's other choices.`
          : `Needs ${cost} coin; you have ${options.coin}.`,
    }
  })
  return changed ? { ...view, choices } : view
}
