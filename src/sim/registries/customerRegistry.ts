import { Registry } from './Registry'
import type { CustomerGroupState } from '../state/TavernState'

// Phase 10 §10.1 — Customer registry.
//
// Each registered customer group carries the data needed to seed a fresh
// tavern: id, display label, tag list, and the per-field `defaultState`
// that `createInitialTavernState` reads to build `state.customerGroups`.
//
// The existing field values (`patronage`, `satisfaction`, `wealth`,
// `rowdiness`, `dangerTolerance`, `filthTolerance`, `priceSensitivity`,
// `damageRisk`, `tabRisk`) come straight from `phases-02-05.md` Phase 5
// §"Customer Group State". The new Phase 10 fields (`loyalty`,
// `preferredStockTags`, `dislikedTags`) follow the §10.1 examples. Phase
// 10 consolidates these into the registry rather than re-tuning them.

export type CustomerGroupDefaultState = Omit<
  CustomerGroupState,
  'id' | 'label' | 'tags'
>

export type CustomerGroupDefinition = {
  id: string
  label: string
  tags: string[]
  defaultState: CustomerGroupDefaultState
}

export const customerRegistry = new Registry<CustomerGroupDefinition>()

const REQUIRED_CUSTOMER_GROUPS: CustomerGroupDefinition[] = [
  {
    id: 'local_goblins',
    label: 'Local Goblins',
    tags: ['local', 'cheap_seeking', 'drink_focused'],
    defaultState: {
      patronage: 65,
      satisfaction: 55,
      wealth: 25,
      rowdiness: 50,
      dangerTolerance: 75,
      filthTolerance: 85,
      priceSensitivity: 80,
      loyalty: 70,
      damageRisk: 30,
      tabRisk: 35,
      preferredStockTags: ['drink', 'goblin_favourite', 'food'],
      dislikedTags: ['expensive'],
      activeGrudges: [],
    },
  },
  {
    id: 'miners',
    label: 'Miners',
    tags: ['worker', 'rowdy', 'drink_focused'],
    defaultState: {
      patronage: 45,
      satisfaction: 50,
      wealth: 45,
      rowdiness: 70,
      dangerTolerance: 70,
      filthTolerance: 60,
      priceSensitivity: 50,
      loyalty: 45,
      damageRisk: 55,
      tabRisk: 30,
      preferredStockTags: ['drink', 'food'],
      dislikedTags: [],
      activeGrudges: [],
    },
  },
  {
    id: 'merchants',
    label: 'Merchants',
    tags: ['wealthy', 'cleanliness_sensitive', 'high_spend'],
    defaultState: {
      patronage: 25,
      satisfaction: 40,
      wealth: 75,
      rowdiness: 15,
      dangerTolerance: 20,
      filthTolerance: 20,
      priceSensitivity: 35,
      loyalty: 25,
      damageRisk: 10,
      tabRisk: 15,
      preferredStockTags: ['quality_sensitive', 'food'],
      dislikedTags: ['filth', 'danger', 'risky'],
      activeGrudges: [],
    },
  },
  {
    id: 'ogres',
    label: 'Ogres',
    tags: ['rowdy', 'dangerous', 'high_spend', 'incident_prone'],
    defaultState: {
      patronage: 15,
      satisfaction: 45,
      wealth: 65,
      rowdiness: 90,
      dangerTolerance: 90,
      filthTolerance: 70,
      priceSensitivity: 30,
      loyalty: 35,
      damageRisk: 90,
      tabRisk: 25,
      preferredStockTags: ['drink', 'food', 'alcohol'],
      dislikedTags: [],
      activeGrudges: [],
    },
  },
  {
    id: 'adventurers',
    label: 'Adventurers',
    tags: ['dangerous', 'high_spend', 'incident_prone'],
    defaultState: {
      patronage: 20,
      satisfaction: 50,
      wealth: 70,
      rowdiness: 65,
      dangerTolerance: 95,
      filthTolerance: 45,
      priceSensitivity: 25,
      loyalty: 30,
      damageRisk: 60,
      tabRisk: 20,
      preferredStockTags: ['food', 'drink', 'quality_sensitive'],
      dislikedTags: ['filth'],
      activeGrudges: [],
    },
  },
]

let initialized = false

export function ensureRequiredCustomerGroupsRegistered(): void {
  if (initialized) return
  for (const def of REQUIRED_CUSTOMER_GROUPS) {
    if (!customerRegistry.has(def.id)) {
      customerRegistry.register(def)
    }
  }
  initialized = true
}

ensureRequiredCustomerGroupsRegistered()
