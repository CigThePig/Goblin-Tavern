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
