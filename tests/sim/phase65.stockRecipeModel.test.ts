import { describe, expect, it } from 'vitest'

import { stockRegistry } from '../../src/sim/registries/stockRegistry'
import {
  recipeRegistry,
  ensureRequiredRecipesRegistered,
} from '../../src/sim/registries/recipeRegistry'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { runOneDay, runOneWeek } from '../../src/sim/testing/simRunner'
import { safeValidateState, validateState } from '../../src/sim/state/validation'
import { validateRecipeReferences } from '../../src/sim/state/referenceValidation'
import { sellRecipe } from '../../src/sim/modules/service/recipes'
import { simulateDay } from '../../src/sim/core/engine'
import { stockModule } from '../../src/sim/modules/stock/index'
import type { SimContext } from '../../src/sim/core/context'
import type { SimulationModule } from '../../src/sim/core/module'

// Phase 65 / ISSUE-025 — Stock-and-recipe model extension.
//
// Covers the per-issue test approach from `docs/ISSUE_TRACKER.md`:
//   - `rarity` round-trips through Zod
//   - cross-reference validation catches a recipe with an unknown
//     ingredient input
//   - `state.recipes` round-trips through the schema
//   - a 7-day playtest using only the existing six items produces a
//     reproducible coin total (the behaviour-preservation guard
//     against the recipe-routing rewrite)

const SEED = 'phase-65-stock-recipe-test'

describe('Phase 65 — stock-and-recipe model extension', () => {
  it('rarity field round-trips through state validation', () => {
    const state = createInitialTavernState()
    // The six original starters are all graded `common`.
    for (const id of ['ale', 'stew', 'ingredients', 'mushrooms', 'firewood', 'mugs']) {
      expect(state.stock[id]!.rarity).toBe('common')
    }
    // Full validation passes including rarity-aware schema.
    const validated = validateState(state)
    expect(validated.stock['ale']!.rarity).toBe('common')
  })

  it('safeValidateState rejects a stock entry missing rarity', () => {
    const state = createInitialTavernState() as unknown as Record<
      string,
      unknown
    >
    // Strip rarity from one stock item.
    const stock = state['stock'] as Record<string, Record<string, unknown>>
    const ale = { ...stock['ale']! }
    delete ale['rarity']
    stock['ale'] = ale
    const result = safeValidateState(state)
    expect(result.success).toBe(false)
    if (!result.success) {
      const hasRarityError = result.errors.some((e) =>
        e.path.includes('stock.ale.rarity'),
      )
      expect(hasRarityError).toBe(true)
    }
  })

  it('recipe registry exposes the six starter recipes 1:1 with stock', () => {
    ensureRequiredRecipesRegistered()
    const recipeIds = recipeRegistry
      .all()
      .map((r) => r.id)
      .sort()
    expect(recipeIds).toContain('dish_ale')
    expect(recipeIds).toContain('dish_stew')
    expect(recipeIds).toContain('dish_mushrooms')
    expect(recipeIds).toContain('dish_ingredients')
    expect(recipeIds).toContain('dish_firewood')
    expect(recipeIds).toContain('dish_mugs')

    // Every registered recipe must be a 1:1 starter (one ingredient,
    // quantity 1) wrapping a real stock item. Recipe demand tier
    // matches its input ingredient's rarity.
    for (const recipe of recipeRegistry.all()) {
      expect(recipe.inputs).toHaveLength(1)
      expect(recipe.inputs[0]!.quantity).toBe(1)
      expect(stockRegistry.has(recipe.inputs[0]!.ingredientId)).toBe(true)
      const input = stockRegistry.get(recipe.inputs[0]!.ingredientId)
      expect(recipe.demandTier).toBe(input.defaultState.rarity)
    }
  })

  it('state.recipes seeds from registry with onMenu: true for starters', () => {
    const state = createInitialTavernState()
    expect(Object.keys(state.recipes).length).toBeGreaterThanOrEqual(6)
    expect(state.recipes['dish_ale']!.onMenu).toBe(true)
    expect(state.recipes['dish_ale']!.timesServed).toBe(0)
    expect(state.recipes['dish_ale']!.lastServedDay).toBeNull()
  })

  it('cross-reference validation catches a recipe with an unknown ingredient', () => {
    // Register a transient broken recipe — content-layer mistake
    // simulation. We unregister it at the end so the registry stays
    // clean for the rest of the suite.
    const cleanup = (): void => {
      recipeRegistry.unregister('dish_phase65_broken')
    }
    try {
      recipeRegistry.register({
        id: 'dish_phase65_broken',
        label: 'Broken Dish',
        tags: ['dish'],
        inputs: [{ ingredientId: 'nonexistent_ingredient', quantity: 1 }],
        prepDifficulty: 20,
        demandTier: 'common',
        culturalTags: [],
        defaultState: {
          onMenu: false,
          timesServed: 0,
          daysSinceLastServed: 0,
          lastServedDay: null,
        },
      })
      const state = createInitialTavernState()
      // Initial state seeds the broken recipe from registry; the
      // validator must catch the unknown ingredient reference.
      const issues = validateRecipeReferences(state)
      const hasUnknownStockRef = issues.some(
        (i) =>
          i.code === 'unknown_stock_ref' &&
          i.path.includes('dish_phase65_broken'),
      )
      expect(hasUnknownStockRef).toBe(true)
    } finally {
      cleanup()
    }
  })

  it('sellRecipe consumes 1:1 starter recipe inputs from stock', () => {
    const state = createInitialTavernState()
    let captured: { earned: number; sold: number } | null = null

    // Run a one-shot service hook that sells 5 ales via recipe path.
    const probe: SimulationModule = {
      id: 'phase65.test.sellRecipe',
      version: '0.0.0',
      dependsOn: ['stock'],
      hooks: {
        service: [
          (ctx: SimContext) => {
            const before = ctx.state.stock['ale']!.quantity
            const result = sellRecipe(ctx, 'dish_ale', 5, {
              buyerGroupId: 'local_goblins',
            })
            const after = ctx.state.stock['ale']!.quantity
            // Each 1:1 starter recipe takes exactly 1 input × 1 qty.
            expect(before - after).toBe(result.sold)
            captured = { earned: result.earned, sold: result.sold }
          },
        ],
      },
    }
    const aleSalePrice = state.stock['ale']!.salePrice
    simulateDay(state, { seed: SEED }, [stockModule, probe])
    expect(captured).not.toBeNull()
    expect(captured!.sold).toBe(5)
    // 1:1 starter recipe: earned equals stock.salePrice × servings.
    expect(captured!.earned).toBe(5 * aleSalePrice)
  })

  it('sellRecipe caps multi-input consumption at the bottleneck and earns only for served dishes', () => {
    // Regression for the 2026-06-10 recipe-consumption audit §1: a
    // multi-input recipe must consume the bottleneck-capped amount of
    // each input (never over-drain non-bottleneck inputs), earn coin
    // only for dishes actually served, and emit exactly one deliberate
    // shortage for the bottleneck ingredient — not a spurious shortage
    // per over-requested input. The shipped six recipes are all 1:1, so
    // we register a transient 2-input recipe to exercise the path.
    const cleanup = (): void => {
      recipeRegistry.unregister('dish_phase65_multi')
    }
    try {
      recipeRegistry.register({
        id: 'dish_phase65_multi',
        label: 'Hearty Stew & Ale',
        tags: ['dish'],
        inputs: [
          { ingredientId: 'stew', quantity: 2 },
          { ingredientId: 'ale', quantity: 1 },
        ],
        prepDifficulty: 20,
        demandTier: 'common',
        culturalTags: [],
        defaultState: {
          onMenu: true,
          timesServed: 0,
          daysSinceLastServed: 0,
          lastServedDay: null,
        },
      })

      const state = createInitialTavernState()
      // Bottleneck: 5 stew backs floor(5/2) = 2 servings; 50 ale is
      // plentiful. Requesting 3 servings should serve only 2.
      state.stock['stew']!.quantity = 5
      state.stock['ale']!.quantity = 50
      const stewPrice = state.stock['stew']!.salePrice
      const alePrice = state.stock['ale']!.salePrice

      let captured: {
        result: ReturnType<typeof sellRecipe>
        stewBefore: number
        stewAfter: number
        aleBefore: number
        aleAfter: number
      } | null = null

      const probe: SimulationModule = {
        id: 'phase65.test.sellRecipe.multi',
        version: '0.0.0',
        dependsOn: ['stock'],
        hooks: {
          service: [
            (ctx: SimContext) => {
              const stewBefore = ctx.state.stock['stew']!.quantity
              const aleBefore = ctx.state.stock['ale']!.quantity
              const result = sellRecipe(ctx, 'dish_phase65_multi', 3, {
                buyerGroupId: 'local_goblins',
              })
              captured = {
                result,
                stewBefore,
                stewAfter: ctx.state.stock['stew']!.quantity,
                aleBefore,
                aleAfter: ctx.state.stock['ale']!.quantity,
              }
            },
          ],
        },
      }

      simulateDay(state, { seed: SEED }, [stockModule, probe])
      expect(captured).not.toBeNull()
      const { result, stewBefore, stewAfter, aleBefore, aleAfter } = captured!

      // Served the bottleneck-capped 2 servings, not the requested 3.
      expect(result.sold).toBe(2)
      // Consume exactly the capped amounts: 2 servings × (2 stew + 1 ale).
      expect(stewBefore - stewAfter).toBe(4)
      expect(aleBefore - aleAfter).toBe(2)
      expect(result.itemsConsumed).toEqual([
        { stockId: 'stew', quantity: 4 },
        { stockId: 'ale', quantity: 2 },
      ])
      // Earn coin only for the 2 served dishes' inputs — no revenue for
      // ingredients no customer was served.
      expect(result.earned).toBe(2 * (2 * stewPrice + alePrice))
      // Exactly one deliberate shortage, for the bottleneck (stew), with
      // the unmet demand (6 requested vs 5 available) — not a per-input
      // over-request side effect.
      expect(result.shortages).toHaveLength(1)
      expect(result.shortages[0]!.stockId).toBe('stew')
      expect(result.shortages[0]!.requested).toBe(6)
      expect(result.shortages[0]!.available).toBe(5)
    } finally {
      cleanup()
    }
  })

  it('a 7-day playtest with default state produces a deterministic coin total', () => {
    // Behaviour-preservation guard: with the six 1:1 starter recipes,
    // a deterministic 7-day run from default state must produce a
    // stable result. We assert determinism (same seed → same totals
    // across two runs) rather than a hardcoded total, because the
    // baseline coin number is sensitive to many cross-module hooks
    // that other phases tune.
    const stateA = createInitialTavernState()
    const stateB = createInitialTavernState()
    const runA = runOneWeek({ seed: SEED, initialState: stateA })
    const runB = runOneWeek({ seed: SEED, initialState: stateB })
    const finalA = runA.days[runA.days.length - 1]!.result.state.coin
    const finalB = runB.days[runB.days.length - 1]!.result.state.coin
    expect(finalA).toBe(finalB)
    // Sanity: at least some recipes were served, since starter dishes
    // are on the menu.
    const recipesA = runA.days[runA.days.length - 1]!.result.state.recipes
    const totalServed = Object.values(recipesA).reduce(
      (acc, r) => acc + r.timesServed,
      0,
    )
    expect(totalServed).toBeGreaterThan(0)
  })

  it('runOneDay leaves state valid (full pipeline + recipes)', () => {
    const state = createInitialTavernState()
    const result = runOneDay(state, { seed: SEED })
    expect(result.validation.errors).toEqual([])
    // Recipes round-trip through schema each day.
    expect(Object.keys(result.state.recipes).length).toBeGreaterThanOrEqual(6)
  })
})
