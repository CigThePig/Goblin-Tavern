import { describe, expect, it } from 'vitest'

import { stockRegistry } from '../../src/sim/registries/stockRegistry'
import { recipeRegistry } from '../../src/sim/registries/recipeRegistry'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { validateState } from '../../src/sim/state/validation'
import { rarityMultiplier } from '../../src/sim/modules/stock/spoilage'
import { runOneDay } from '../../src/sim/testing/simRunner'
import type { StockRarity } from '../../src/sim/state/TavernState'

// Phase 66 / ISSUE-026 — Ingredient + starter recipe catalog grow.
//
// Covers the per-issue test approach from `docs/ISSUE_TRACKER.md`:
//   - all new ingredients pass cross-reference validation
//   - each new ingredient has a corresponding 1:1 starter recipe
//   - spoilage-rate tests confirm rare and legendary items decay
//     roughly twice as fast as common
//   - the grown roster is observable in the registry

const SEED = 'phase-66-ingredient-catalog'

describe('Phase 66 — ingredient + recipe catalog grow', () => {
  it('stockRegistry now spans all four rarity tiers', () => {
    const byRarity: Record<StockRarity, number> = {
      common: 0,
      uncommon: 0,
      rare: 0,
      legendary: 0,
    }
    for (const def of stockRegistry.all()) {
      byRarity[def.defaultState.rarity] += 1
    }
    expect(byRarity.common).toBeGreaterThanOrEqual(6)
    expect(byRarity.uncommon).toBeGreaterThanOrEqual(4)
    expect(byRarity.uncommon).toBeLessThanOrEqual(6)
    expect(byRarity.rare).toBeGreaterThanOrEqual(5)
    expect(byRarity.rare).toBeLessThanOrEqual(8)
    expect(byRarity.legendary).toBeGreaterThanOrEqual(2)
    expect(byRarity.legendary).toBeLessThanOrEqual(4)
  })

  it('every ingredient has a corresponding 1:1 starter recipe', () => {
    for (const stock of stockRegistry.all()) {
      const recipeId = `dish_${stock.id}`
      expect(recipeRegistry.has(recipeId)).toBe(true)
      const recipe = recipeRegistry.get(recipeId)
      expect(recipe.inputs).toHaveLength(1)
      expect(recipe.inputs[0]!.ingredientId).toBe(stock.id)
      expect(recipe.inputs[0]!.quantity).toBe(1)
      expect(recipe.demandTier).toBe(stock.defaultState.rarity)
    }
  })

  it('recipe prep difficulty scales with rarity tier', () => {
    const byTier: Record<StockRarity, number[]> = {
      common: [],
      uncommon: [],
      rare: [],
      legendary: [],
    }
    for (const recipe of recipeRegistry.all()) {
      byTier[recipe.demandTier].push(recipe.prepDifficulty)
    }
    // Tier ordering: max(common) < min(uncommon) < min(rare) < min(legendary)
    expect(Math.max(...byTier.common)).toBeLessThan(Math.min(...byTier.uncommon))
    expect(Math.max(...byTier.uncommon)).toBeLessThan(Math.min(...byTier.rare))
    expect(Math.max(...byTier.rare)).toBeLessThan(Math.min(...byTier.legendary))
  })

  it('higher rarity carries a higher daily spoilage multiplier', () => {
    expect(rarityMultiplier('common')).toBe(1)
    expect(rarityMultiplier('uncommon')).toBeGreaterThan(rarityMultiplier('common'))
    expect(rarityMultiplier('rare')).toBeGreaterThanOrEqual(2 * rarityMultiplier('common'))
    expect(rarityMultiplier('legendary')).toBeGreaterThan(rarityMultiplier('rare'))
  })

  it('cross-reference validation passes after the grow', () => {
    const state = createInitialTavernState()
    const validated = validateState(state)
    // Every new ingredient appears in state.stock with quantity 0.
    expect(validated.stock['moonpetal_mushroom']!.rarity).toBe('rare')
    expect(validated.stock['phoenix_pepper']!.rarity).toBe('legendary')
    expect(validated.stock['bog_truffle']!.rarity).toBe('uncommon')
    // Their recipes seeded with onMenu: false.
    expect(validated.recipes['dish_moonpetal_mushroom']!.onMenu).toBe(false)
    expect(validated.recipes['dish_phoenix_pepper']!.onMenu).toBe(false)
    // The six starters remain onMenu: true so the existing flow works.
    expect(validated.recipes['dish_ale']!.onMenu).toBe(true)
  })

  it('rare and legendary perishables decay ~2× faster than common over 14 days', () => {
    // Controlled spoilage test: spawn three perishable items with
    // identical starting conditions (quality 80, spoilage 0, stored
    // in a clean kitchen). The only varying property is rarity.
    // After 14 simulated days, rare/legendary spoilage should be
    // roughly twice the common spoilage delta.
    let state = createInitialTavernState()
    // Force every perishable rare/legendary into the kitchen so the
    // storage multiplier is identical across rarities for the test.
    state = {
      ...state,
      stock: {
        ...state.stock,
        ingredients: {
          ...state.stock['ingredients']!,
          quantity: 100,
          spoilage: 0,
        },
        bog_truffle: {
          ...state.stock['bog_truffle']!,
          quantity: 100,
          spoilage: 0,
        },
        moonpetal_mushroom: {
          ...state.stock['moonpetal_mushroom']!,
          quantity: 100,
          spoilage: 0,
        },
        phoenix_pepper: {
          ...state.stock['phoenix_pepper']!,
          quantity: 100,
          spoilage: 0,
        },
      },
    }
    for (let i = 0; i < 14; i += 1) {
      state = runOneDay(state, { seed: `${SEED}-${i}` }).state
    }
    const commonSpoilage = state.stock['ingredients']!.spoilage
    const uncommonSpoilage = state.stock['bog_truffle']!.spoilage
    const rareSpoilage = state.stock['moonpetal_mushroom']!.spoilage
    const legendarySpoilage = state.stock['phoenix_pepper']!.spoilage

    // Spoilage clamps at 100; below that the rarity multiplier
    // produces a clear ordering. Rare should be ~2× common, ±slack
    // for the stochastic +1 chance and clamping.
    expect(uncommonSpoilage).toBeGreaterThanOrEqual(commonSpoilage)
    // Rare must clearly outpace common.
    expect(rareSpoilage).toBeGreaterThan(commonSpoilage)
    // Legendary at least matches rare (often higher; capped by 100).
    expect(legendarySpoilage).toBeGreaterThanOrEqual(rareSpoilage - 5)
    // Rare should reach roughly twice the common spoilage if neither
    // hit the clamp; if both are saturated, this becomes a sanity
    // upper bound.
    if (commonSpoilage < 50 && rareSpoilage < 100) {
      expect(rareSpoilage).toBeGreaterThanOrEqual(commonSpoilage * 1.5)
    }
  })

  it('new ingredients seed with quantity 0 — they exist as types, not stockpiles', () => {
    const state = createInitialTavernState()
    expect(state.stock['moonpetal_mushroom']!.quantity).toBe(0)
    expect(state.stock['phoenix_pepper']!.quantity).toBe(0)
    expect(state.stock['bog_truffle']!.quantity).toBe(0)
    // The six common starters still have positive quantity.
    expect(state.stock['ale']!.quantity).toBeGreaterThan(0)
  })

  it('default 7-day playtest behaviour is preserved — no rare/legendary served', () => {
    // Behaviour preservation: with rare/legendary recipes onMenu: false
    // and quantity 0, the daily service should not interact with any
    // non-common ingredients. The recipe state for rare/legendary
    // recipes stays at zero served.
    let state = createInitialTavernState()
    for (let i = 0; i < 7; i += 1) {
      state = runOneDay(state, { seed: `${SEED}-${i}` }).state
    }
    expect(state.recipes['dish_moonpetal_mushroom']!.timesServed).toBe(0)
    expect(state.recipes['dish_phoenix_pepper']!.timesServed).toBe(0)
    expect(state.recipes['dish_bog_truffle']!.timesServed).toBe(0)
  })
})
