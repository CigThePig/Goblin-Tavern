import { describe, expect, it } from 'vitest'

import { runOneDay } from '../../src/sim/testing/simRunner'
import {
  actionRegistry,
  ensureRequiredOwnerActionsRegistered,
} from '../../src/sim/modules/ownerActions/ownerActionsModule'
import { toggleRecipeMenu } from '../../src/sim/modules/ownerActions/actionDefinitions'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'

// Phase 92 — toggle_recipe_menu owner action.
//
// Recipes panel needs a player-driven way to flip RecipeState.onMenu.
// Zero AP cost (logistical toggle, not a labor action). Service code
// still enforces ingredient and skill gates; the toggle is purely a
// menu offering signal.

const SEED = 'phase-92-toggle-recipe-menu-test'

function findOnMenuRecipe(state: TavernState): string {
  const recipe = Object.values(state.recipes).find((r) => r.onMenu)
  if (!recipe) throw new Error('expected at least one on-menu recipe')
  return recipe.id
}

function findOffMenuRecipe(state: TavernState): string {
  const recipe = Object.values(state.recipes).find((r) => !r.onMenu)
  if (!recipe) throw new Error('expected at least one off-menu recipe')
  return recipe.id
}

describe('Phase 92 — toggle_recipe_menu owner action', () => {
  it('registers in the action registry under the canonical id', () => {
    ensureRequiredOwnerActionsRegistered()
    expect(actionRegistry.has('toggle_recipe_menu')).toBe(true)
    expect(toggleRecipeMenu.id).toBe('toggle_recipe_menu')
    expect(toggleRecipeMenu.category).toBe('immediate')
    expect(toggleRecipeMenu.targetType).toBe('recipe')
    expect(toggleRecipeMenu.actionPointCost).toBe(0)
  })

  it('flips an on-menu recipe to off-menu', () => {
    const state = createInitialTavernState()
    const recipeId = findOnMenuRecipe(state)
    const result = runOneDay(state, {
      seed: `${SEED}-flip-off`,
      ownerActions: [{ actionId: 'toggle_recipe_menu', targetId: recipeId }],
    })
    expect(result.state.recipes[recipeId]?.onMenu).toBe(false)
  })

  it('flips an off-menu recipe to on-menu', () => {
    const state = createInitialTavernState()
    const recipeId = findOffMenuRecipe(state)
    const result = runOneDay(state, {
      seed: `${SEED}-flip-on`,
      ownerActions: [{ actionId: 'toggle_recipe_menu', targetId: recipeId }],
    })
    expect(result.state.recipes[recipeId]?.onMenu).toBe(true)
  })

  it('toggles back to the original on a second application', () => {
    let state = createInitialTavernState()
    const recipeId = findOnMenuRecipe(state)
    const r1 = runOneDay(state, {
      seed: `${SEED}-toggle-1`,
      ownerActions: [{ actionId: 'toggle_recipe_menu', targetId: recipeId }],
    })
    state = r1.state
    expect(state.recipes[recipeId]?.onMenu).toBe(false)

    const r2 = runOneDay(state, {
      seed: `${SEED}-toggle-2`,
      ownerActions: [{ actionId: 'toggle_recipe_menu', targetId: recipeId }],
    })
    state = r2.state
    expect(state.recipes[recipeId]?.onMenu).toBe(true)
  })

  it('lists every recipe in getValidTargets', () => {
    const state = createInitialTavernState()
    const recipeCount = Object.keys(state.recipes).length
    expect(recipeCount).toBeGreaterThan(0)

    const targets = toggleRecipeMenu.getValidTargets({ state } as never)
    expect(targets.length).toBe(recipeCount)
    for (const target of targets) {
      expect(state.recipes[target.id]).toBeDefined()
      expect(typeof target.label).toBe('string')
    }
  })

  it('rejects canApply with missing targetId', () => {
    const state = createInitialTavernState()
    const verdict = toggleRecipeMenu.canApply({ state } as never, {
      actionId: 'toggle_recipe_menu',
    })
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) {
      expect(verdict.code).toBe('missing_target')
    }
  })

  it('rejects canApply with unknown recipe id', () => {
    const state = createInitialTavernState()
    const verdict = toggleRecipeMenu.canApply({ state } as never, {
      actionId: 'toggle_recipe_menu',
      targetId: 'does_not_exist',
    })
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) {
      expect(verdict.code).toBe('unknown_target')
    }
  })

  it('does not consume an action point against the daily budget', () => {
    let state = createInitialTavernState()
    const recipeId = findOnMenuRecipe(state)
    // Queue three regular actions plus a toggle in one day; only the
    // three should consume action points. The toggle should still apply.
    const result = runOneDay(state, {
      seed: `${SEED}-budget`,
      ownerActions: [
        { actionId: 'toggle_recipe_menu', targetId: recipeId },
        { actionId: 'clean_area', targetId: 'main_room' },
        { actionId: 'clean_area', targetId: 'kitchen' },
        { actionId: 'clean_area', targetId: 'cellar' },
      ],
    })
    state = result.state
    // All four should land — toggle costs 0, three cleans cost 3 (the cap).
    expect(state.recipes[recipeId]?.onMenu).toBe(false)
  })
})
