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
    // Phase 117 — `dish_ingredients` consumes raw kitchen `ingredients`
    // stock; it never represented a coherent menu item ("Cook Surplus"
    // read as developer shorthand to players). Tagged `upkeep` so the
    // Recipes panel projection filters it out, and `onMenu: false` so
    // fresh saves don't expose it. Underlying consumption mechanics
    // are unchanged — service still resolves the recipe if explicitly
    // referenced.
    id: 'dish_ingredients',
    label: 'Cook Surplus',
    tags: ['food', 'raw', 'perishable', 'ingredient', 'dish', 'upkeep'],
    inputs: [{ ingredientId: 'ingredients', quantity: 1 }],
    prepDifficulty: 20,
    demandTier: 'common',
    culturalTags: [],
    defaultState: {
      onMenu: false,
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
    // Phase 117 — Firewood is fuel, not food. Tagged `upkeep` and
    // off-menu by default; the Recipes panel filters by tag and the
    // Stock panel surfaces a "used for upkeep" hint on firewood
    // instead.
    id: 'dish_firewood',
    label: 'Firewood Bundle',
    tags: ['fuel', 'utility', 'dish', 'upkeep'],
    inputs: [{ ingredientId: 'firewood', quantity: 1 }],
    prepDifficulty: 20,
    demandTier: 'common',
    culturalTags: [],
    defaultState: {
      onMenu: false,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  {
    // Phase 117 — Mugs are service equipment, not a menu item. Same
    // `upkeep` treatment as firewood.
    id: 'dish_mugs',
    label: 'Replacement Mug',
    tags: ['equipment', 'service_item', 'service_capacity', 'breakable', 'dish', 'upkeep'],
    inputs: [{ ingredientId: 'mugs', quantity: 1 }],
    prepDifficulty: 20,
    demandTier: 'common',
    culturalTags: [],
    defaultState: {
      onMenu: false,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  // Expansion Phase 2 §2.3 — construction materials follow the `firewood` /
  // `mugs` precedent exactly: the codebase's invariant is that every stock id
  // has a 1:1 `dish_<id>` record, and non-menu stock carries the `upkeep` tag
  // so `flipUpkeepRecipesOffMenu` keeps it off the board. Nothing ever cooks
  // timber; these exist so the stock/recipe pairing stays total.
  {
    id: 'dish_timber',
    label: 'Sawn Timber',
    tags: ['material', 'construction', 'utility', 'dish', 'upkeep'],
    inputs: [{ ingredientId: 'timber', quantity: 1 }],
    prepDifficulty: 20,
    demandTier: 'common',
    culturalTags: [],
    defaultState: {
      onMenu: false,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  {
    id: 'dish_cut_stone',
    label: 'Dressed Stone',
    tags: ['material', 'construction', 'utility', 'dish', 'upkeep'],
    inputs: [{ ingredientId: 'cut_stone', quantity: 1 }],
    prepDifficulty: 20,
    demandTier: 'common',
    culturalTags: [],
    defaultState: {
      onMenu: false,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  // Phase 66 / ISSUE-026 §4.1, §6.2 — Uncommon-tier 1:1 starter
  // recipes. Prep difficulty 40 puts these out of reach of a default
  // kitchen-hand cook (skill ~30 in phase 71) but within reach of a
  // seasoned cook. All start `onMenu: false` — they activate when the
  // player has stock and chooses to feature them.
  {
    id: 'dish_bog_truffle',
    label: 'Bog Truffle Plate',
    tags: ['food', 'raw', 'ingredient', 'perishable', 'fungus', 'dish'],
    inputs: [{ ingredientId: 'bog_truffle', quantity: 1 }],
    prepDifficulty: 40,
    demandTier: 'uncommon',
    culturalTags: [],
    defaultState: {
      onMenu: false,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  {
    id: 'dish_frost_cap_mushroom',
    label: 'Frost-Cap Sauté',
    tags: [
      'food',
      'raw',
      'ingredient',
      'perishable',
      'fungus',
      'goblin_favourite',
      'dish',
    ],
    inputs: [{ ingredientId: 'frost_cap_mushroom', quantity: 1 }],
    prepDifficulty: 40,
    demandTier: 'uncommon',
    culturalTags: ['goblin_food'],
    defaultState: {
      onMenu: false,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  {
    id: 'dish_river_eel',
    label: 'River Eel Stew',
    tags: ['food', 'raw', 'ingredient', 'perishable', 'meat', 'dish'],
    inputs: [{ ingredientId: 'river_eel', quantity: 1 }],
    prepDifficulty: 40,
    demandTier: 'uncommon',
    culturalTags: [],
    defaultState: {
      onMenu: false,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  {
    id: 'dish_wild_thyme',
    label: 'Wild-Thyme Roast',
    tags: ['food', 'raw', 'ingredient', 'perishable', 'herb', 'dish'],
    inputs: [{ ingredientId: 'wild_thyme', quantity: 1 }],
    prepDifficulty: 40,
    demandTier: 'uncommon',
    culturalTags: [],
    defaultState: {
      onMenu: false,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  {
    id: 'dish_smoked_boar_haunch',
    label: 'Smoked Boar Plate',
    tags: ['food', 'prepared', 'ingredient', 'perishable', 'meat', 'dish'],
    inputs: [{ ingredientId: 'smoked_boar_haunch', quantity: 1 }],
    prepDifficulty: 40,
    demandTier: 'uncommon',
    culturalTags: [],
    defaultState: {
      onMenu: false,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  // Phase 66 / ISSUE-026 §4.1, §6.2 — Rare-tier 1:1 starter recipes.
  // Prep difficulty 65 — out of reach of any default cook (skill 55);
  // requires the seasoned_cook role or higher introduced in phase 71.
  {
    id: 'dish_moonpetal_mushroom',
    label: 'Moonpetal Tart',
    tags: [
      'food',
      'raw',
      'ingredient',
      'perishable',
      'fungus',
      'mystical',
      'dish',
    ],
    inputs: [{ ingredientId: 'moonpetal_mushroom', quantity: 1 }],
    prepDifficulty: 65,
    demandTier: 'rare',
    culturalTags: [],
    defaultState: {
      onMenu: false,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  {
    id: 'dish_kraken_ink',
    label: 'Kraken-Ink Risotto',
    tags: ['food', 'raw', 'ingredient', 'perishable', 'exotic', 'dish'],
    inputs: [{ ingredientId: 'kraken_ink', quantity: 1 }],
    prepDifficulty: 65,
    demandTier: 'rare',
    culturalTags: [],
    defaultState: {
      onMenu: false,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  {
    id: 'dish_dragontongue_pepper',
    label: 'Dragontongue Stew',
    tags: [
      'food',
      'raw',
      'ingredient',
      'perishable',
      'spice',
      'fiery',
      'dish',
    ],
    inputs: [{ ingredientId: 'dragontongue_pepper', quantity: 1 }],
    prepDifficulty: 65,
    demandTier: 'rare',
    culturalTags: [],
    defaultState: {
      onMenu: false,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  {
    id: 'dish_silvercap_truffle',
    label: 'Silvercap Plate',
    tags: [
      'food',
      'raw',
      'ingredient',
      'perishable',
      'fungus',
      'prized',
      'dish',
    ],
    inputs: [{ ingredientId: 'silvercap_truffle', quantity: 1 }],
    prepDifficulty: 65,
    demandTier: 'rare',
    culturalTags: [],
    defaultState: {
      onMenu: false,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  {
    id: 'dish_ironbark_honey',
    label: 'Ironbark Glaze',
    tags: ['food', 'raw', 'ingredient', 'perishable', 'sweet', 'dish'],
    inputs: [{ ingredientId: 'ironbark_honey', quantity: 1 }],
    prepDifficulty: 65,
    demandTier: 'rare',
    culturalTags: [],
    defaultState: {
      onMenu: false,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  {
    id: 'dish_cave_pearl_oyster',
    label: 'Cave-Pearl Oyster Soup',
    tags: ['food', 'raw', 'ingredient', 'perishable', 'shellfish', 'dish'],
    inputs: [{ ingredientId: 'cave_pearl_oyster', quantity: 1 }],
    prepDifficulty: 65,
    demandTier: 'rare',
    culturalTags: [],
    defaultState: {
      onMenu: false,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  // Phase 66 / ISSUE-026 §4.1, §6.2 — Legendary-tier 1:1 starter
  // recipes. Prep difficulty 85 — only a master_chef (skill ~85,
  // phase 71) can clean-prep these. A botched legendary recipe
  // produces a major renown drop in phase 67.
  {
    id: 'dish_phoenix_pepper',
    label: 'Phoenix Pepper Stew',
    tags: [
      'food',
      'raw',
      'ingredient',
      'perishable',
      'spice',
      'mythic',
      'fiery',
      'dish',
    ],
    inputs: [{ ingredientId: 'phoenix_pepper', quantity: 1 }],
    prepDifficulty: 85,
    demandTier: 'legendary',
    culturalTags: [],
    defaultState: {
      onMenu: false,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  {
    id: 'dish_wyrmheart_tea_leaves',
    label: 'Wyrmheart Tea',
    tags: ['food', 'raw', 'ingredient', 'perishable', 'mythic', 'tea', 'dish'],
    inputs: [{ ingredientId: 'wyrmheart_tea_leaves', quantity: 1 }],
    prepDifficulty: 85,
    demandTier: 'legendary',
    culturalTags: [],
    defaultState: {
      onMenu: false,
      timesServed: 0,
      daysSinceLastServed: 0,
      lastServedDay: null,
    },
  },
  {
    id: 'dish_sunblood_orange',
    label: 'Sunblood Glazed Course',
    tags: ['food', 'raw', 'ingredient', 'perishable', 'fruit', 'mythic', 'dish'],
    inputs: [{ ingredientId: 'sunblood_orange', quantity: 1 }],
    prepDifficulty: 85,
    demandTier: 'legendary',
    culturalTags: [],
    defaultState: {
      onMenu: false,
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
