import { Registry } from './Registry'
import type { RecipeState, StockRarity } from '../state/TavernState'

// Phase 65 / ISSUE-025 §4.2, §5.2, §6.1 — Recipe registry.
//
// A recipe is a derived dish that consumes one or more ingredients and
// is what customers order. In v1 every recipe is 1:1 — one input
// ingredient, one quantity — but the registry shape already supports
// multi-input recipes for future expansion (§13 of the design doc).
//
// Static config (inputs, prepDifficulty, demandTier, culturalTags)
// lives on the definition; `state.recipes[id]` only tracks runtime
// counters (timesServed, daysSinceLastServed) plus the player's
// `onMenu` flag. This mirrors the area/customer-group registry split
// between definition and per-instance state.

export type RecipeInput = {
  ingredientId: string
  quantity: number
}

export type RecipeDefaultState = Omit<RecipeState, 'id' | 'label' | 'tags'>

export type RecipeDefinition = {
  id: string
  label: string
  tags: string[]
  inputs: RecipeInput[]
  prepDifficulty: number // 0-100; cook skill threshold for clean prep
  demandTier: StockRarity // which renown threshold the dish attracts
  culturalTags: string[]
  defaultState: RecipeDefaultState
}

export const recipeRegistry = new Registry<RecipeDefinition>()

// Six starter recipes, one per existing stock item. All 1:1 and all
// common-tier so the existing service flow keeps producing identical
// behaviour: customer baskets pointing at recipe ids consume the same
// underlying stock item at the same rate as the pre-recipe code path.
const REQUIRED_RECIPES: RecipeDefinition[] = [
  {
    id: 'dish_ale',
    label: 'Mug of Ale',
    tags: ['drink', 'alcohol', 'service_item', 'quality_sensitive', 'dish'],
    inputs: [{ ingredientId: 'ale', quantity: 1 }],
    prepDifficulty: 20,
    demandTier: 'common',
    culturalTags: [],
    defaultState: {
      onMenu: true,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  {
    id: 'dish_stew',
    label: 'Bowl of Stew',
    tags: ['food', 'prepared', 'service_item', 'perishable', 'dish'],
    inputs: [{ ingredientId: 'stew', quantity: 1 }],
    prepDifficulty: 20,
    demandTier: 'common',
    culturalTags: [],
    defaultState: {
      onMenu: true,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  {
    id: 'dish_ingredients',
    label: 'Cook Surplus',
    tags: ['food', 'raw', 'perishable', 'ingredient', 'dish'],
    inputs: [{ ingredientId: 'ingredients', quantity: 1 }],
    prepDifficulty: 20,
    demandTier: 'common',
    culturalTags: [],
    defaultState: {
      onMenu: true,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  {
    id: 'dish_mushrooms',
    label: 'Roasted Mushrooms',
    tags: [
      'food',
      'raw',
      'ingredient',
      'perishable',
      'goblin_favourite',
      'risky',
      'dish',
    ],
    inputs: [{ ingredientId: 'mushrooms', quantity: 1 }],
    prepDifficulty: 20,
    demandTier: 'common',
    culturalTags: ['goblin_food'],
    defaultState: {
      onMenu: true,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  {
    id: 'dish_firewood',
    label: 'Firewood Bundle',
    tags: ['fuel', 'utility', 'dish'],
    inputs: [{ ingredientId: 'firewood', quantity: 1 }],
    prepDifficulty: 20,
    demandTier: 'common',
    culturalTags: [],
    defaultState: {
      onMenu: true,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  {
    id: 'dish_mugs',
    label: 'Replacement Mug',
    tags: ['equipment', 'service_item', 'service_capacity', 'breakable', 'dish'],
    inputs: [{ ingredientId: 'mugs', quantity: 1 }],
    prepDifficulty: 20,
    demandTier: 'common',
    culturalTags: [],
    defaultState: {
      onMenu: true,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
]

let initialized = false

export function ensureRequiredRecipesRegistered(): void {
  if (initialized) return
  for (const def of REQUIRED_RECIPES) {
    if (!recipeRegistry.has(def.id)) {
      recipeRegistry.register(def)
    }
  }
  initialized = true
}

ensureRequiredRecipesRegistered()
