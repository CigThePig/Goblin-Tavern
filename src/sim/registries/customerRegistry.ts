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
//
// Phase 30 §30.2 — `CustomerGroupDefinition` now also carries
// `cultureId`, `namingProfileId`, `trafficPattern`, `spendingProfile`,
// and an optional `relationshipToOtherGroups` seed map. These flow
// through `defaultState` into `state.customerGroups[id]` so the
// customer module, forecast, and Phase 30 reports can read culture and
// inter-group relationships without re-walking the registry every day.

export type CustomerGroupDefaultState = Omit<
  CustomerGroupState,
  'id' | 'label' | 'tags'
>

export type CustomerGroupDefinition = {
  id: string
  label: string
  tags: string[]
  // Phase 30 §30.2 — cultural metadata.
  cultureId: string
  namingProfileId: string
  trafficPattern: string
  spendingProfile: string
  relationshipToOtherGroups?: Record<string, number>
  defaultState: CustomerGroupDefaultState
}

export const customerRegistry = new Registry<CustomerGroupDefinition>()

const REQUIRED_CUSTOMER_GROUPS: CustomerGroupDefinition[] = [
  {
    id: 'local_goblins',
    label: 'Local Goblins',
    tags: ['local', 'cheap_seeking', 'drink_focused'],
    cultureId: 'goblin_local',
    namingProfileId: 'goblin_common',
    trafficPattern: 'evening_locals',
    spendingProfile: 'cheap_volume',
    relationshipToOtherGroups: {
      miners: 10,
      merchants: -15,
      ogres: -5,
      adventurers: -10,
    },
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
      cultureId: 'goblin_local',
      namingProfileId: 'goblin_common',
      trafficPattern: 'evening_locals',
      spendingProfile: 'cheap_volume',
      relationshipToOtherGroups: {
        miners: 10,
        merchants: -15,
        ogres: -5,
        adventurers: -10,
      },
    },
  },
  {
    id: 'miners',
    label: 'Miners',
    tags: ['worker', 'rowdy', 'drink_focused'],
    cultureId: 'miner_workcrew',
    namingProfileId: 'miner_workcrew',
    trafficPattern: 'payday_burst',
    spendingProfile: 'binge_spend',
    relationshipToOtherGroups: {
      local_goblins: 10,
      merchants: -10,
      ogres: 0,
      adventurers: -5,
    },
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
      cultureId: 'miner_workcrew',
      namingProfileId: 'miner_workcrew',
      trafficPattern: 'payday_burst',
      spendingProfile: 'binge_spend',
      relationshipToOtherGroups: {
        local_goblins: 10,
        merchants: -10,
        ogres: 0,
        adventurers: -5,
      },
    },
  },
  {
    id: 'merchants',
    label: 'Merchants',
    tags: ['wealthy', 'cleanliness_sensitive', 'high_spend'],
    cultureId: 'merchant_roadfolk',
    namingProfileId: 'merchant_roadfolk',
    trafficPattern: 'market_day',
    spendingProfile: 'high_margin',
    relationshipToOtherGroups: {
      local_goblins: -15,
      miners: -10,
      ogres: -25,
      adventurers: 5,
    },
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
      cultureId: 'merchant_roadfolk',
      namingProfileId: 'merchant_roadfolk',
      trafficPattern: 'market_day',
      spendingProfile: 'high_margin',
      relationshipToOtherGroups: {
        local_goblins: -15,
        miners: -10,
        ogres: -25,
        adventurers: 5,
      },
    },
  },
  {
    id: 'ogres',
    label: 'Ogres',
    tags: ['rowdy', 'dangerous', 'high_spend', 'incident_prone'],
    cultureId: 'ogre_clans',
    namingProfileId: 'ogre_clans',
    trafficPattern: 'brawl_night',
    spendingProfile: 'binge_spend',
    relationshipToOtherGroups: {
      local_goblins: -5,
      miners: 0,
      merchants: -25,
      adventurers: -10,
    },
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
      cultureId: 'ogre_clans',
      namingProfileId: 'ogre_clans',
      trafficPattern: 'brawl_night',
      spendingProfile: 'binge_spend',
      relationshipToOtherGroups: {
        local_goblins: -5,
        miners: 0,
        merchants: -25,
        adventurers: -10,
      },
    },
  },
  {
    id: 'adventurers',
    label: 'Adventurers',
    tags: ['dangerous', 'high_spend', 'incident_prone'],
    cultureId: 'adventuring_bands',
    namingProfileId: 'adventuring_bands',
    trafficPattern: 'irregular',
    spendingProfile: 'high_margin',
    relationshipToOtherGroups: {
      local_goblins: -10,
      miners: -5,
      merchants: 5,
      ogres: -10,
    },
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
      cultureId: 'adventuring_bands',
      namingProfileId: 'adventuring_bands',
      trafficPattern: 'irregular',
      spendingProfile: 'high_margin',
      relationshipToOtherGroups: {
        local_goblins: -10,
        miners: -5,
        merchants: 5,
        ogres: -10,
      },
    },
  },
  // Phase 72 / ISSUE-032 §4.7, §5.6 — Niche customer groups. Each
  // seeds with `patronage: 0`; the customer module activates them
  // when `culinary_renown` crosses the per-group `minRenownThreshold`
  // declared in their `defaultState`.
  {
    id: 'gourmand',
    label: 'Gourmands',
    tags: ['niche', 'food_focused', 'tipper'],
    cultureId: 'goblin_local',
    namingProfileId: 'human_town',
    trafficPattern: 'sporadic',
    spendingProfile: 'splurge',
    relationshipToOtherGroups: {},
    defaultState: {
      patronage: 0,
      satisfaction: 60,
      wealth: 70,
      rowdiness: 25,
      dangerTolerance: 40,
      filthTolerance: 35,
      priceSensitivity: 30,
      loyalty: 35,
      damageRisk: 10,
      tabRisk: 10,
      preferredStockTags: ['food', 'dish'],
      dislikedTags: ['expensive'],
      activeGrudges: [],
      cultureId: 'goblin_local',
      namingProfileId: 'human_town',
      trafficPattern: 'sporadic',
      spendingProfile: 'splurge',
      relationshipToOtherGroups: {},
      minRenownThreshold: 30,
    },
  },
  {
    id: 'food_critic',
    label: 'Food Critics',
    tags: ['niche', 'critic', 'rare_visitor'],
    cultureId: 'goblin_local',
    namingProfileId: 'human_town',
    trafficPattern: 'rare',
    spendingProfile: 'careful_quality',
    relationshipToOtherGroups: {},
    defaultState: {
      patronage: 0,
      satisfaction: 55,
      wealth: 60,
      rowdiness: 15,
      dangerTolerance: 25,
      filthTolerance: 25,
      priceSensitivity: 35,
      loyalty: 25,
      damageRisk: 5,
      tabRisk: 5,
      preferredStockTags: ['dish', 'prized', 'mythic'],
      dislikedTags: ['risky'],
      activeGrudges: [],
      cultureId: 'goblin_local',
      namingProfileId: 'human_town',
      trafficPattern: 'rare',
      spendingProfile: 'careful_quality',
      relationshipToOtherGroups: {},
      minRenownThreshold: 50,
    },
  },
  {
    id: 'foreign_envoy',
    label: 'Foreign Envoys',
    tags: ['niche', 'foreign', 'party'],
    cultureId: 'goblin_local',
    namingProfileId: 'merchant_roadfolk',
    trafficPattern: 'large_party',
    spendingProfile: 'big_spend',
    relationshipToOtherGroups: {},
    defaultState: {
      patronage: 0,
      satisfaction: 60,
      wealth: 80,
      rowdiness: 30,
      dangerTolerance: 35,
      filthTolerance: 40,
      priceSensitivity: 25,
      loyalty: 30,
      damageRisk: 20,
      tabRisk: 15,
      preferredStockTags: ['dish', 'exotic', 'mythic'],
      dislikedTags: ['filth'],
      activeGrudges: [],
      cultureId: 'goblin_local',
      namingProfileId: 'merchant_roadfolk',
      trafficPattern: 'large_party',
      spendingProfile: 'big_spend',
      relationshipToOtherGroups: {},
      minRenownThreshold: 55,
    },
  },
  {
    id: 'eccentric_noble',
    label: 'Eccentric Nobles',
    tags: ['niche', 'noble', 'high_spend'],
    cultureId: 'goblin_local',
    namingProfileId: 'human_town',
    trafficPattern: 'very_rare',
    spendingProfile: 'lavish',
    relationshipToOtherGroups: {},
    defaultState: {
      patronage: 0,
      satisfaction: 65,
      wealth: 95,
      rowdiness: 10,
      dangerTolerance: 20,
      filthTolerance: 10,
      priceSensitivity: 10,
      loyalty: 20,
      damageRisk: 5,
      tabRisk: 5,
      preferredStockTags: ['mythic', 'prized', 'dish'],
      dislikedTags: ['filth', 'risky'],
      activeGrudges: [],
      cultureId: 'goblin_local',
      namingProfileId: 'human_town',
      trafficPattern: 'very_rare',
      spendingProfile: 'lavish',
      relationshipToOtherGroups: {},
      minRenownThreshold: 70,
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
