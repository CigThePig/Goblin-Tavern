// Phase 117 / ISSUE-078 — Upkeep recipe filtering.
//
// Three recipes (`dish_firewood`, `dish_mugs`, `dish_ingredients`)
// consume internal upkeep stock (firewood for heat, mugs as service
// equipment, raw ingredients as kitchen prep). They share the recipe
// shape with food items but are not menu choices. The clarity pass
// tags them `upkeep` and filters them from `RecipePanelData.onMenu`
// and `RecipePanelData.available`. The migration also flips any
// pre-clarity-pass save's `onMenu` to false for these recipes.

import { describe, expect, it } from 'vitest'

import {
  buildTavernOverview,
} from '../../src/reports/tavernOverviewProjection'
import {
  createInitialTavernState,
} from '../../src/sim/state/defaults'
import { flipUpkeepRecipesOffMenu } from '../../src/sim/state/migrations'
import { recipeRegistry } from '../../src/sim/registries/recipeRegistry'
import type { TavernState } from '../../src/sim/state/TavernState'

const UPKEEP_IDS = ['dish_firewood', 'dish_mugs', 'dish_ingredients'] as const

describe('upkeep recipe filtering', () => {
  it('marks the three upkeep recipes with the upkeep tag in the registry', () => {
    for (const id of UPKEEP_IDS) {
      const def = recipeRegistry.get(id)
      expect(def.tags, `recipe ${id} tags`).toContain('upkeep')
    }
  })

  it('starts upkeep recipes off-menu by default', () => {
    const state = createInitialTavernState()
    for (const id of UPKEEP_IDS) {
      expect(state.recipes[id]?.onMenu, `recipe ${id}`).toBe(false)
    }
  })

  it('excludes upkeep recipes from both onMenu and available lists', () => {
    const state = createInitialTavernState()
    const view = buildTavernOverview(state)
    const allIds = [
      ...view.recipes.onMenu.map((r) => r.id),
      ...view.recipes.available.map((r) => r.id),
    ]
    for (const id of UPKEEP_IDS) {
      expect(allIds, `${id} should not appear in panel`).not.toContain(id)
    }
  })

  it('flags firewood and mugs as upkeep-consumed in the stock panel', () => {
    const state = createInitialTavernState()
    const view = buildTavernOverview(state)
    const byId = new Map(view.stock.inventory.rows.map((r) => [r.id, r]))
    expect(byId.get('firewood')?.isUpkeepConsumed).toBe(true)
    expect(byId.get('mugs')?.isUpkeepConsumed).toBe(true)
    expect(byId.get('ale')?.isUpkeepConsumed).toBe(false)
    expect(byId.get('stew')?.isUpkeepConsumed).toBe(false)
  })
})

describe('flipUpkeepRecipesOffMenu migration', () => {
  it('flips legacy onMenu: true upkeep recipes to false', () => {
    const fresh = createInitialTavernState()
    // Simulate a pre-clarity-pass save: upkeep recipes still onMenu
    // and tags missing the new 'upkeep' marker.
    const legacy: TavernState = {
      ...fresh,
      recipes: {
        ...fresh.recipes,
        dish_firewood: {
          ...fresh.recipes['dish_firewood']!,
          onMenu: true,
          tags: ['fuel', 'utility', 'dish'],
        },
        dish_mugs: {
          ...fresh.recipes['dish_mugs']!,
          onMenu: true,
          tags: ['equipment', 'service_item', 'dish'],
        },
      },
    }
    const migrated = flipUpkeepRecipesOffMenu(legacy)
    expect(migrated.recipes['dish_firewood']?.onMenu).toBe(false)
    expect(migrated.recipes['dish_mugs']?.onMenu).toBe(false)
    expect(migrated.recipes['dish_firewood']?.tags).toContain('upkeep')
    expect(migrated.recipes['dish_mugs']?.tags).toContain('upkeep')
  })

  it('is idempotent on already-migrated state', () => {
    const state = createInitialTavernState()
    const once = flipUpkeepRecipesOffMenu(state)
    const twice = flipUpkeepRecipesOffMenu(once)
    expect(twice).toBe(once)
  })

  it('leaves non-upkeep recipes untouched', () => {
    const state = createInitialTavernState()
    const ale = state.recipes['dish_ale']!
    const migrated = flipUpkeepRecipesOffMenu(state)
    expect(migrated.recipes['dish_ale']).toBe(ale)
  })
})
