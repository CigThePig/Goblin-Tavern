import { Registry } from '../../registries/Registry'
import type { MarketConditionDefinition } from './marketTypes'

// Phase 29 §29.3 — Market condition registry.
//
// Starter set covers the eight conditions named in §29.3. Multipliers
// are intentionally modest — Phase 29 introduces the seam, later phases
// may retune. `pressureTags` describe which pressures a condition is
// expected to nudge (the supplier module reads them, not the
// definition's internals).

export const marketConditionRegistry = new Registry<MarketConditionDefinition>()

const STARTER_MARKET_CONDITIONS: MarketConditionDefinition[] = [
  {
    id: 'grain_shortage',
    label: 'Grain Shortage',
    description: 'Bulk grain is scarce on the road this week.',
    affectedStockIds: ['ingredients'],
    priceMultiplier: 1.4,
    availabilityMultiplier: 0.6,
    pressureTags: ['stock_shortage'],
    tags: ['shortage', 'food'],
  },
  {
    id: 'cheap_mushrooms',
    label: 'Cheap Mushrooms',
    description: 'A glut of mushrooms in the foothills cuts wholesale prices.',
    affectedStockIds: ['mushrooms'],
    priceMultiplier: 0.7,
    availabilityMultiplier: 1.2,
    pressureTags: [],
    tags: ['glut', 'food'],
  },
  {
    id: 'ale_tax',
    label: 'Ale Tax',
    description: 'The town levies a brewing tax that pushes ale prices up.',
    affectedStockTags: ['alcohol'],
    priceMultiplier: 1.25,
    pressureTags: ['debt', 'reputation_drift'],
    tags: ['tax', 'alcohol'],
  },
  {
    id: 'road_bandits',
    label: 'Road Bandits',
    description: 'Caravan routes are unsafe; deliveries slip.',
    availabilityMultiplier: 0.5,
    priceMultiplier: 1.15,
    pressureTags: ['stock_shortage', 'violence'],
    tags: ['road', 'danger'],
  },
  {
    id: 'merchant_surplus',
    label: 'Merchant Surplus',
    description: 'Town merchants undercut each other; goods are cheap.',
    priceMultiplier: 0.85,
    availabilityMultiplier: 1.1,
    pressureTags: [],
    tags: ['surplus'],
  },
  {
    id: 'winter_prices',
    label: 'Winter Prices',
    description: 'Cold-season scarcity drags every basic up a step.',
    priceMultiplier: 1.2,
    pressureTags: ['debt'],
    calendarTags: ['deepfrost'],
    tags: ['season', 'cold'],
  },
  {
    id: 'festival_demand',
    label: 'Festival Demand',
    description: 'A festival in town drives extra orders for ale and stew.',
    affectedStockTags: ['alcohol', 'food'],
    priceMultiplier: 1.1,
    availabilityMultiplier: 0.9,
    pressureTags: [],
    tags: ['festival', 'demand'],
  },
  {
    id: 'spoiled_delivery_rumour',
    label: 'Spoiled Delivery Rumour',
    description:
      'Word spreads that a recent delivery was off — buyers haggle harder.',
    qualityModifier: -10,
    pressureTags: ['reputation_drift'],
    tags: ['rumour'],
  },
]

let initialized = false

export function ensureRequiredMarketConditionsRegistered(): void {
  if (initialized) return
  for (const def of STARTER_MARKET_CONDITIONS) {
    if (!marketConditionRegistry.has(def.id)) {
      marketConditionRegistry.register(def)
    }
  }
  initialized = true
}

// Phase 29 §29.3 — Market conditions are new in Phase 29 (no Phase 22
// "starts empty" contract); register them eagerly so importers can read
// the registry without an explicit ensure call.
ensureRequiredMarketConditionsRegistered()
