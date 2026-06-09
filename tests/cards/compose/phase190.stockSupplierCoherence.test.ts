// Card-choice coherence repair — Phase 6 resource/supplier vertical slice.
// These tests exercise real generated seeds through the registered card
// renderer so stock, kitchen, and supplier choices prove their exact visible
// quantity/cost/tradeoff chips rather than only authored profile data.

import { describe, expect, it } from 'vitest'

import { cardRegistry, ensureRequiredCardsRegistered } from '../../../src/cards/registry'
import { pickCardForSeed } from '../../../src/cards/selection'
import { fallbackCard } from '../../../src/cards/templates/fallback'
import type { CardChoice } from '../../../src/cards/types'
import { getIssueSeeds } from '../../../src/sim/modules/issues/issueSeedQueries'
import type { IssueSeedFamilyId } from '../../../src/sim/modules/issues/issueSeedTypes'
import { runOneDay } from '../../../src/sim/testing/simRunner'
import type { TavernState } from '../../../src/sim/state/TavernState'
import {
  buildFoodSafetyTriggeringState,
  buildStockShortageTriggeringState,
  buildSupplierRelationshipTriggeringState,
} from '../../sim/triggeringStates'

function renderFamilyChoice(
  family: IssueSeedFamilyId,
  buildState: () => TavernState,
  slotId: string,
): CardChoice {
  ensureRequiredCardsRegistered()
  let result = runOneDay(buildState(), { seed: `phase190-${family}` })
  let seed = getIssueSeeds(result.state, { family })[0]
  if (seed === undefined) {
    result = runOneDay(result.state, { seed: `phase190-${family}-warm` })
    seed = getIssueSeeds(result.state, { family })[0]
  }
  expect(seed, `expected a ${family} seed`).toBeDefined()

  const card = pickCardForSeed(seed!, result.state, cardRegistry.all()) ?? fallbackCard
  const rendered = card.render(seed!, result.state)
  const choice = rendered.choices.find((candidate) => candidate.slotId === slotId)
  expect(choice, `expected rendered choice ${slotId}`).toBeDefined()
  return choice!
}

function mechanicalText(choice: CardChoice): string {
  return (choice.mechanicalEffects ?? []).join('\n')
}

describe('Phase 6 card-choice coherence — stock, kitchen, and supplier cards', () => {
  it('restocking shows the gained stock quantity and exact coin cost', () => {
    const choice = renderFamilyChoice('stock_shortage', buildStockShortageTriggeringState, 'restock')
    const text = mechanicalText(choice)

    expect(text).toContain('Ale Quantity +60')
    expect(text).toContain('Coin -30')
  })

  it('rationing shows both the guest tradeoff and later shortage relief', () => {
    const choice = renderFamilyChoice('stock_shortage', buildStockShortageTriggeringState, 'limit_sales')
    const text = mechanicalText(choice)

    expect(text).toContain('Miners Satisfaction -5')
    expect(text).toContain('later: Stock Shortage Risk -4')
  })

  it('kitchen cleanup is no longer free: cleanliness gain, safety relief, and staff load are visible', () => {
    const choice = renderFamilyChoice('food_safety', buildFoodSafetyTriggeringState, 'clean_kitchen')
    const text = mechanicalText(choice)

    expect(text).toContain('Kitchen Cleanliness +25')
    expect(text).toContain('Food Safety Risk -10')
    expect(text).toMatch(/Fatigue \+6/)
  })

  it('supplier negotiation carries an explicit concession cost', () => {
    const choice = renderFamilyChoice('supplier_relationship', buildSupplierRelationshipTriggeringState, 'negotiate_supplier')
    const text = mechanicalText(choice)

    expect(text).toContain('Coin -5')
    expect(text).toContain('Stock Shortage Risk -6')
  })

  it('cheap suspicious supplier goods show stock gained, discounted cost, and spoilage risk', () => {
    const choice = renderFamilyChoice('supplier_relationship', buildSupplierRelationshipTriggeringState, 'accept_suspicious_goods')
    const text = mechanicalText(choice)

    expect(text).toContain('Mushrooms Quantity +18')
    expect(text).toContain('Coin -8')
    expect(text).toContain('Mushrooms Spoilage +6')
  })
})
