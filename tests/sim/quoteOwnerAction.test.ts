import { describe, expect, it } from 'vitest'

import { quoteOwnerAction } from '../../src/sim/modules/ownerActions/quoteOwnerAction'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  quoteAlternativeSuppliers,
  spotMarketUnitPrice,
} from '../../src/sim/modules/suppliers/quote'

describe('quoteOwnerAction', () => {
  // Expansion Phase 6 §6.1 — `restock_item` is the local spot market, not a
  // supplier purchase, so the quote prices the market and names the cheaper
  // planned alternative instead of naming a supplier it is not buying from.
  it('restock item quote includes amount, market cost, and before/after stock', () => {
    const state = createInitialTavernState()
    const before = state.stock.ale!.quantity
    const quote = quoteOwnerAction(state, {
      actionId: 'restock_item',
      targetId: 'ale',
      amount: 40,
    })

    expect(quote.amount).toBe(40)
    expect(quote.cost?.coin).toBeGreaterThan(0)
    expect(quote.supplier).toBeUndefined()
    expect(quote.risks?.[0]).toMatch(/Market premium/)
    // The planned route is quoted alongside it, so the premium is legible.
    expect(quote.risks?.some((risk) => /would sell at/.test(risk))).toBe(true)
    expect(quote.stockChanges).toContainEqual(
      expect.objectContaining({
        stockId: 'ale',
        before,
        after: before + 40,
        delta: 40,
      }),
    )
  })

  it('quotes the local market price, not the supplier price it undercuts', () => {
    const state = createInitialTavernState()
    const quote = quoteOwnerAction(state, {
      actionId: 'restock_item',
      targetId: 'ale',
      amount: 40,
    })
    const cheapest = quoteAlternativeSuppliers(state, {
      stockId: 'ale',
      quantity: 40,
    })[0]!
    expect(quote.cost!.coin).toBe(
      Math.ceil(40 * spotMarketUnitPrice(state, 'ale')),
    )
    expect(quote.cost!.coin).toBeGreaterThan(cheapest.totalPrice)
  })

  it('pay staff bonus quote includes cost, morale, stress, loyalty', () => {
    const state = createInitialTavernState()
    const cook = state.staff.cook!
    const quote = quoteOwnerAction(state, {
      actionId: 'pay_staff_bonus',
      targetId: 'cook',
      amount: 10,
    })

    expect(quote.cost?.coin).toBe(10)
    expect(quote.statChanges).toContainEqual(
      expect.objectContaining({ stat: 'morale', before: cook.morale, after: cook.morale + 5 }),
    )
    expect(quote.statChanges).toContainEqual(
      expect.objectContaining({ stat: 'stress', before: cook.stress, after: cook.stress - 3 }),
    )
    expect(quote.statChanges).toContainEqual(
      expect.objectContaining({ stat: 'loyalty', before: cook.loyalty, after: cook.loyalty + 3 }),
    )
  })

  it('improve stew quote includes ingredient cost and cook side effects', () => {
    const state = createInitialTavernState()
    const ingredients = state.stock.ingredients!
    const cook = state.staff.cook!
    const quote = quoteOwnerAction(state, { actionId: 'improve_stew' })

    expect(quote.stockChanges).toContainEqual(
      expect.objectContaining({
        stockId: 'ingredients',
        before: ingredients.quantity,
        after: ingredients.quantity - 5,
        delta: -5,
      }),
    )
    expect(quote.statChanges).toContainEqual(
      expect.objectContaining({ stat: 'stress', before: cook.stress, after: cook.stress + 2 }),
    )
    expect(quote.statChanges).toContainEqual(
      expect.objectContaining({ stat: 'fatigue', before: cook.fatigue, after: cook.fatigue + 2 }),
    )
  })

  it('water down ale quote includes quantity gain and quality loss', () => {
    const state = createInitialTavernState()
    const ale = state.stock.ale!
    const stretch = Math.max(4, Math.round(ale.quantity * 0.2))
    const quote = quoteOwnerAction(state, { actionId: 'water_down_ale' })

    expect(quote.stockChanges).toContainEqual(
      expect.objectContaining({ stockId: 'ale', before: ale.quantity, after: ale.quantity + stretch, delta: stretch }),
    )
    expect(quote.statChanges).toContainEqual(
      expect.objectContaining({ stat: 'quality', before: ale.quality, after: ale.quality - 15, delta: -15 }),
    )
    expect(quote.risks?.join(' ')).toMatch(/Reputation/i)
  })

  it('fumigate quote includes smell downside', () => {
    const state = createInitialTavernState()
    const cellar = state.areas.cellar!
    const quote = quoteOwnerAction(state, { actionId: 'fumigate_cellar' })

    expect(quote.cost?.coin).toBe(5)
    expect(quote.statChanges).toContainEqual(
      expect.objectContaining({ stat: 'smell', before: cellar.smell, after: cellar.smell + 10, delta: 10 }),
    )
    expect(quote.risks?.join(' ')).toMatch(/smell/i)
  })

  it('buy mugs quote includes amount and cost', () => {
    const state = createInitialTavernState()
    const mugs = state.stock.mugs!
    const quote = quoteOwnerAction(state, { actionId: 'buy_mugs', amount: 12 })

    expect(quote.amount).toBe(12)
    expect(quote.cost?.coin).toBe(12 * mugs.basePrice)
    expect(quote.stockChanges).toContainEqual(
      expect.objectContaining({ stockId: 'mugs', before: mugs.quantity, after: mugs.quantity + 12, delta: 12 }),
    )
  })
})
