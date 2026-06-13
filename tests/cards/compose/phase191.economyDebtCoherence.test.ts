// Card-choice coherence repair — Phase 10 economy/debt vertical slice.
// These tests exercise real generated seeds through the registered card
// renderer so debt, rent, and monthly-review choices prove their exact visible
// money values, deferral risks, and slot-level choice contracts.

import { describe, expect, it } from 'vitest'

import { cardRegistry, ensureRequiredCardsRegistered } from '../../../src/cards/registry'
import { pickCardForSeed } from '../../../src/cards/selection'
import { fallbackCard } from '../../../src/cards/templates/fallback'
import type { CardChoice } from '../../../src/cards/types'
import { getIssueSeeds } from '../../../src/sim/modules/issues/issueSeedQueries'
import type { IssueSeed, IssueSeedFamilyId } from '../../../src/sim/modules/issues/issueSeedTypes'
import { runOneDay } from '../../../src/sim/testing/simRunner'
import type { TavernState } from '../../../src/sim/state/TavernState'
import {
  buildDebtRentTriggeringState,
  buildMonthlyReviewTriggeringState,
} from '../../sim/triggeringStates'

type RenderedFamily = {
  seed: IssueSeed
  choices: CardChoice[]
}

function renderFamily(
  family: IssueSeedFamilyId,
  buildState: () => TavernState,
): RenderedFamily {
  ensureRequiredCardsRegistered()
  let result = runOneDay(buildState(), { seed: `phase191-${family}` })
  let seed = getIssueSeeds(result.state, { family })[0]
  if (seed === undefined) {
    result = runOneDay(result.state, { seed: `phase191-${family}-warm` })
    seed = getIssueSeeds(result.state, { family })[0]
  }
  expect(seed, `expected a ${family} seed`).toBeDefined()

  const card = pickCardForSeed(seed!, result.state, cardRegistry.all()) ?? fallbackCard
  const rendered = card.render(seed!, result.state)
  return { seed: seed!, choices: rendered.choices }
}

function choiceBySlot(rendered: RenderedFamily, slotId: string): CardChoice {
  const choice = rendered.choices.find((candidate) => candidate.slotId === slotId)
  expect(choice, `expected rendered choice ${slotId}`).toBeDefined()
  return choice!
}

function mechanicalText(choice: CardChoice): string {
  return (choice.mechanicalEffects ?? []).join('\n')
}

describe('Phase 10 card-choice coherence — economy, debt, and recurring pressure cards', () => {
  it('annotates every core debt_rent slot with an explicit financial choice contract', () => {
    const rendered = renderFamily('debt_rent', buildDebtRentTriggeringState)

    expect(Object.fromEntries(rendered.seed.responseSlots.map((slot) => [slot.id, slot.choiceContract?.archetype]))).toEqual({
      pay: 'compensate',
      borrow: 'cut_corners',
      delay: 'delay',
      raise_prices: 'cut_corners',
    })
    for (const slot of rendered.seed.responseSlots) {
      expect(slot.choiceContract?.payoffTiming, slot.id).toEqual(expect.any(String))
      expect(slot.choiceContract?.costTypes, slot.id).toEqual(expect.any(Array))
    }
  })

  it('shows exact debt_rent money values and the future risks of deferring payment', () => {
    const rendered = renderFamily('debt_rent', buildDebtRentTriggeringState)

    expect(mechanicalText(choiceBySlot(rendered, 'pay'))).toContain('Coin -120')
    expect(mechanicalText(choiceBySlot(rendered, 'borrow'))).toContain('Coin +40')
    expect(mechanicalText(choiceBySlot(rendered, 'borrow'))).toContain('later: Debt Pressure +12')
    expect(mechanicalText(choiceBySlot(rendered, 'delay'))).toContain('Landlord Pressure +10')
    expect(mechanicalText(choiceBySlot(rendered, 'delay'))).toContain('Landlord may threaten eviction')
    expect(mechanicalText(choiceBySlot(rendered, 'raise_prices'))).toContain('Ale Sale Price +1')
  })

  it('treats an already-paid monthly rent review as Coin 0 instead of promising a new payment', () => {
    const rendered = renderFamily('monthly_review', buildMonthlyReviewTriggeringState)
    const pay = choiceBySlot(rendered, 'pay_landlord_on_time')
    const paySlot = rendered.seed.responseSlots.find((slot) => slot.id === 'pay_landlord_on_time')

    expect(paySlot?.expectedEffects).toEqual(['lower landlord pressure', 'rent already paid'])
    expect(paySlot?.choiceContract?.costTypes).toEqual(['none'])
    expect(pay.previewEffects.join('\n')).toContain('Coin stays unchanged; rent was already settled')
    expect(pay.previewEffects.join('\n')).not.toContain('Coin would leave the till for the landlord')
    expect(mechanicalText(pay)).toContain('Coin 0')
    expect(mechanicalText(pay)).toContain('Landlord Pressure -25')
  })

  it('justifies expensive monthly-review choices with visible payoffs and recurring-pressure tradeoffs', () => {
    const rendered = renderFamily('monthly_review', buildMonthlyReviewTriggeringState)

    expect(mechanicalText(choiceBySlot(rendered, 'invest_in_cellar'))).toEqual(expect.stringContaining('Coin -20'))
    expect(mechanicalText(choiceBySlot(rendered, 'invest_in_cellar'))).toEqual(expect.stringContaining('Cellar Condition +12'))
    expect(mechanicalText(choiceBySlot(rendered, 'invest_in_cellar'))).toEqual(expect.stringContaining('later: Cellar capacity may unlock next month'))
    expect(mechanicalText(choiceBySlot(rendered, 'hold_reserves'))).toContain('later: Staff Loyalty Risk +6')
    expect(mechanicalText(choiceBySlot(rendered, 'settle_with_rival'))).toContain('Coin -15')
    expect(mechanicalText(choiceBySlot(rendered, 'settle_with_rival'))).toContain('later: Rumour Pressure +6')
  })
})
