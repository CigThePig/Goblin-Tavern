import { describe, expect, it } from 'vitest'

import { runOneDay } from '../../src/sim/testing/simRunner'
import {
  actionRegistry,
  ensureRequiredOwnerActionsRegistered,
} from '../../src/sim/modules/ownerActions/ownerActionsModule'
import { toggleRecipeMenu } from '../../src/sim/modules/ownerActions/actionDefinitions'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  recipeRegistry,
  ensureRequiredRecipesRegistered,
} from '../../src/sim/registries/recipeRegistry'
import { flipUpkeepRecipesOffMenu } from '../../src/sim/state/migrations'
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

// Phase 117 — the three `upkeep` recipes (firewood, mugs, raw
// ingredients) default off-menu and are NOT toggleable: they are
// consumption pipelines, not menu dishes. Skip them when looking for a
// togglable off-menu recipe.
function isUpkeep(recipeId: string): boolean {
  return recipeRegistry.has(recipeId) && recipeRegistry.get(recipeId).tags.includes('upkeep')
}

function findOffMenuRecipe(state: TavernState): string {
  const recipe = Object.values(state.recipes).find(
    (r) => !r.onMenu && !isUpkeep(r.id),
  )
  if (!recipe) throw new Error('expected at least one off-menu dish recipe')
  return recipe.id
}

describe('Phase 92 — toggle_recipe_menu owner action', () => {
  it('registers in the action registry under the canonical id', () => {
    ensureRequiredOwnerActionsRegistered()
    expect(actionRegistry.has('toggle_recipe_menu')).toBe(true)
    expect(toggleRecipeMenu.id).toBe('toggle_recipe_menu')
    expect(toggleRecipeMenu.category).toBe('immediate')
    expect(toggleRecipeMenu.targetType).toBe('recipe')
    expect(toggleRecipeMenu.timeCost).toBe(0)
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

  it('lists every menu-dish recipe in getValidTargets, excluding upkeep', () => {
    ensureRequiredRecipesRegistered()
    const state = createInitialTavernState()
    const dishIds = Object.keys(state.recipes).filter((id) => !isUpkeep(id))
    const upkeepIds = Object.keys(state.recipes).filter((id) => isUpkeep(id))
    expect(dishIds.length).toBeGreaterThan(0)
    expect(upkeepIds.length).toBeGreaterThan(0)

    const targets = toggleRecipeMenu.getValidTargets({ state } as never)
    expect(targets.length).toBe(dishIds.length)
    for (const target of targets) {
      expect(state.recipes[target.id]).toBeDefined()
      expect(isUpkeep(target.id)).toBe(false)
      expect(typeof target.label).toBe('string')
    }
  })

  // Regression — an `upkeep` recipe toggled on-menu used to survive the
  // session and then be silently flipped back off by
  // `flipUpkeepRecipesOffMenu`, which runs on every save load. The action
  // now refuses upkeep recipes so state and the load-time migration agree.
  it('refuses to toggle an upkeep recipe', () => {
    ensureRequiredRecipesRegistered()
    const state = createInitialTavernState()
    const upkeepId = Object.keys(state.recipes).find((id) => isUpkeep(id))
    expect(upkeepId).toBeDefined()

    const verdict = toggleRecipeMenu.canApply({ state } as never, {
      actionId: 'toggle_recipe_menu',
      targetId: upkeepId!,
    })
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.code).toBe('upkeep_recipe')

    const result = runOneDay(state, {
      seed: `${SEED}-upkeep-refused`,
      ownerActions: [{ actionId: 'toggle_recipe_menu', targetId: upkeepId! }],
    })
    expect(result.state.recipes[upkeepId!]?.onMenu).toBe(false)
  })

  // The invariant the refusal protects: whatever the sim ends a day with
  // must survive the load-time upkeep migration unchanged.
  it('leaves post-day recipe state stable across the load migration', () => {
    ensureRequiredRecipesRegistered()
    const state = createInitialTavernState()
    const dishId = findOffMenuRecipe(state)
    const result = runOneDay(state, {
      seed: `${SEED}-migration-stable`,
      ownerActions: [{ actionId: 'toggle_recipe_menu', targetId: dishId }],
    })
    expect(result.state.recipes[dishId]?.onMenu).toBe(true)

    const reloaded = flipUpkeepRecipesOffMenu(
      JSON.parse(JSON.stringify(result.state)) as TavernState,
    )
    expect(reloaded.recipes).toEqual(result.state.recipes)
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

  it('does not consume time against the daily budget', () => {
    let state = createInitialTavernState()
    const recipeId = findOnMenuRecipe(state)
    // Queue three regular actions plus a toggle in one day; only the
    // three should consume owner time. The toggle (zero-time) still applies.
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
    // All four should land — toggle costs 0m, three cleans cost 360m (the cap).
    expect(state.recipes[recipeId]?.onMenu).toBe(false)
  })
})
