import { Registry } from './Registry'
import type { StockState } from '../state/TavernState'

// Phase 9 §9.1 — Stock registry.
//
// Each registered stock item carries the data needed to seed a fresh
// tavern: id, display label, tag list, and the per-field `defaultState`
// that `createInitialTavernState` reads to build `state.stock`. The
// quantity/quality/spoilage numbers come straight from `phases-02-05.md`
// Phase 5 §"Stock State" — Phase 9 consolidates them into the registry
// rather than re-tuning them. `basePrice`, `salePrice`, and
// `storageAreaId` are the new Phase 9 fields and are tuned here.
//
// Phase 65 / ISSUE-025 §5.1 — `defaultState` carries a `rarity` tier.
// The six existing items are all `common`; phase 66 introduces
// uncommon/rare/legendary ingredients in the same registry.

export type StockDefaultState = Omit<StockState, 'id' | 'label' | 'tags'>

export type StockDefinition = {
  id: string
  label: string
  tags: string[]
  defaultState: StockDefaultState
}

export const stockRegistry = new Registry<StockDefinition>()

const REQUIRED_STOCK: StockDefinition[] = [
  {
    id: 'ale',
    label: 'Ale',
    tags: ['drink', 'alcohol', 'service_item', 'quality_sensitive'],
    defaultState: {
      quantity: 80,
      quality: 45,
      spoilage: 5,
      basePrice: 2,
      salePrice: 3,
      storageAreaId: 'cellar',
      rarity: 'common',
    },
  },
  {
    id: 'stew',
    label: 'Stew',
    tags: ['food', 'prepared', 'service_item', 'perishable'],
    defaultState: {
      quantity: 40,
      quality: 35,
      spoilage: 20,
      basePrice: 2,
      salePrice: 3,
      storageAreaId: 'kitchen',
      rarity: 'common',
    },
  },
  {
    id: 'ingredients',
    label: 'Ingredients',
    tags: ['food', 'raw', 'perishable', 'ingredient'],
    defaultState: {
      quantity: 60,
      quality: 45,
      spoilage: 15,
      basePrice: 1,
      salePrice: 1,
      storageAreaId: 'kitchen',
      rarity: 'common',
    },
  },
  {
    id: 'mushrooms',
    label: 'Mushrooms',
    tags: [
      'food',
      'raw',
      'ingredient',
      'perishable',
      'goblin_favourite',
      'risky',
    ],
    defaultState: {
      quantity: 45,
      quality: 40,
      spoilage: 25,
      basePrice: 1,
      salePrice: 2,
      storageAreaId: 'cellar',
      rarity: 'common',
    },
  },
  {
    id: 'firewood',
    label: 'Firewood',
    tags: ['fuel', 'utility'],
    defaultState: {
      quantity: 50,
      quality: 50,
      spoilage: 0,
      basePrice: 1,
      salePrice: 1,
      storageAreaId: 'cellar',
      rarity: 'common',
    },
  },
  {
    id: 'mugs',
    label: 'Mugs',
    tags: ['equipment', 'service_item', 'service_capacity', 'breakable'],
    defaultState: {
      quantity: 35,
      quality: 35,
      spoilage: 0,
      basePrice: 1,
      salePrice: 1,
      storageAreaId: 'main_room',
      rarity: 'common',
    },
  },
  // Phase 66 / ISSUE-026 §4.1 — Uncommon-tier ingredients.
  //
  // Uncommon items have moderate spoilage profiles and 2–3× the common
  // sale price. Suppliers in the new "specialty goods" category
  // introduced in phase 68 (ISSUE-028) carry these as their baseline
  // route to non-common ingredients. Default quantity is zero — the
  // tavern starts the simulation knowing these ingredient types exist
  // but holding none of them.
  {
    id: 'bog_truffle',
    label: 'Bog Truffle',
    tags: ['food', 'raw', 'ingredient', 'perishable', 'fungus'],
    defaultState: {
      quantity: 0,
      quality: 55,
      spoilage: 0,
      basePrice: 3,
      salePrice: 7,
      storageAreaId: 'kitchen',
      rarity: 'uncommon',
    },
  },
  {
    id: 'frost_cap_mushroom',
    label: 'Frost-Cap Mushroom',
    tags: [
      'food',
      'raw',
      'ingredient',
      'perishable',
      'fungus',
      'goblin_favourite',
    ],
    defaultState: {
      quantity: 0,
      quality: 60,
      spoilage: 0,
      basePrice: 3,
      salePrice: 6,
      storageAreaId: 'cellar',
      rarity: 'uncommon',
    },
  },
  {
    id: 'river_eel',
    label: 'River Eel',
    tags: ['food', 'raw', 'ingredient', 'perishable', 'meat'],
    defaultState: {
      quantity: 0,
      quality: 50,
      spoilage: 0,
      basePrice: 4,
      salePrice: 8,
      storageAreaId: 'cellar',
      rarity: 'uncommon',
    },
  },
  {
    id: 'wild_thyme',
    label: 'Wild Thyme',
    tags: ['food', 'raw', 'ingredient', 'perishable', 'herb'],
    defaultState: {
      quantity: 0,
      quality: 65,
      spoilage: 0,
      basePrice: 2,
      salePrice: 5,
      storageAreaId: 'kitchen',
      rarity: 'uncommon',
    },
  },
  {
    id: 'smoked_boar_haunch',
    label: 'Smoked Boar Haunch',
    tags: ['food', 'prepared', 'ingredient', 'perishable', 'meat'],
    defaultState: {
      quantity: 0,
      quality: 55,
      spoilage: 0,
      basePrice: 5,
      salePrice: 9,
      storageAreaId: 'cellar',
      rarity: 'uncommon',
    },
  },
  // Phase 66 / ISSUE-026 §4.1 — Rare-tier ingredients.
  //
  // Rare items have aggressive spoilage profiles and 5–8× the common
  // sale price. Only reachable via the open expedition mode introduced
  // in phase 70 (ISSUE-030). Default quantity is zero.
  {
    id: 'moonpetal_mushroom',
    label: 'Moonpetal Mushroom',
    tags: [
      'food',
      'raw',
      'ingredient',
      'perishable',
      'fungus',
      'mystical',
    ],
    defaultState: {
      quantity: 0,
      quality: 70,
      spoilage: 0,
      basePrice: 8,
      salePrice: 18,
      storageAreaId: 'cellar',
      rarity: 'rare',
    },
  },
  {
    id: 'kraken_ink',
    label: 'Kraken Ink',
    tags: ['food', 'raw', 'ingredient', 'perishable', 'exotic'],
    defaultState: {
      quantity: 0,
      quality: 65,
      spoilage: 0,
      basePrice: 12,
      salePrice: 25,
      storageAreaId: 'cellar',
      rarity: 'rare',
    },
  },
  {
    id: 'dragontongue_pepper',
    label: 'Dragontongue Pepper',
    tags: ['food', 'raw', 'ingredient', 'perishable', 'spice', 'fiery'],
    defaultState: {
      quantity: 0,
      quality: 75,
      spoilage: 0,
      basePrice: 10,
      salePrice: 22,
      storageAreaId: 'kitchen',
      rarity: 'rare',
    },
  },
  {
    id: 'silvercap_truffle',
    label: 'Silvercap Truffle',
    tags: ['food', 'raw', 'ingredient', 'perishable', 'fungus', 'prized'],
    defaultState: {
      quantity: 0,
      quality: 80,
      spoilage: 0,
      basePrice: 14,
      salePrice: 30,
      storageAreaId: 'cellar',
      rarity: 'rare',
    },
  },
  {
    id: 'ironbark_honey',
    label: 'Ironbark Honey',
    tags: ['food', 'raw', 'ingredient', 'perishable', 'sweet'],
    defaultState: {
      quantity: 0,
      quality: 70,
      spoilage: 0,
      basePrice: 9,
      salePrice: 20,
      storageAreaId: 'cellar',
      rarity: 'rare',
    },
  },
  {
    id: 'cave_pearl_oyster',
    label: 'Cave-Pearl Oyster',
    tags: ['food', 'raw', 'ingredient', 'perishable', 'shellfish'],
    defaultState: {
      quantity: 0,
      quality: 60,
      spoilage: 0,
      basePrice: 11,
      salePrice: 24,
      storageAreaId: 'cellar',
      rarity: 'rare',
    },
  },
  // Phase 66 / ISSUE-026 §4.1 — Legendary-tier ingredients.
  //
  // Legendary items have aggressive + unstable spoilage profiles and
  // 10–20× the common sale price. Reachable only via targeted
  // expeditions (phase 70 / ISSUE-030). Default quantity is zero.
  {
    id: 'phoenix_pepper',
    label: 'Phoenix Pepper',
    tags: [
      'food',
      'raw',
      'ingredient',
      'perishable',
      'spice',
      'mythic',
      'fiery',
    ],
    defaultState: {
      quantity: 0,
      quality: 90,
      spoilage: 0,
      basePrice: 25,
      salePrice: 55,
      storageAreaId: 'kitchen',
      rarity: 'legendary',
    },
  },
  {
    id: 'wyrmheart_tea_leaves',
    label: 'Wyrmheart Tea Leaves',
    tags: ['food', 'raw', 'ingredient', 'perishable', 'mythic', 'tea'],
    defaultState: {
      quantity: 0,
      quality: 85,
      spoilage: 0,
      basePrice: 20,
      salePrice: 48,
      storageAreaId: 'cellar',
      rarity: 'legendary',
    },
  },
  {
    id: 'sunblood_orange',
    label: 'Sunblood Orange',
    tags: ['food', 'raw', 'ingredient', 'perishable', 'fruit', 'mythic'],
    defaultState: {
      quantity: 0,
      quality: 95,
      spoilage: 0,
      basePrice: 30,
      salePrice: 65,
      storageAreaId: 'cellar',
      rarity: 'legendary',
    },
  },
]

let initialized = false

export function ensureRequiredStockRegistered(): void {
  if (initialized) return
  for (const def of REQUIRED_STOCK) {
    if (!stockRegistry.has(def.id)) {
      stockRegistry.register(def)
    }
  }
  initialized = true
}

ensureRequiredStockRegistered()
