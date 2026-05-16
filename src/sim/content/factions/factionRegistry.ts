import { Registry } from '../../registries/Registry'
import type { FactionDefinition } from './factionTypes'

// Phase 22 §"Registry Pattern" / Phase 30 §30.4 — faction registry.
//
// Phase 22 reserved the seam; Phase 30 fills it with starter factions
// chosen for the mechanical hooks they will eventually feed (inspections,
// suppliers, payday traffic, caravan reliability). Factions are not lore
// wallpaper — each starter entry has tags Phase 30+ logic can read.

export const factionRegistry = new Registry<FactionDefinition>()

const REQUIRED_FACTIONS: FactionDefinition[] = [
  {
    id: 'miners_union',
    label: "Miners' Union",
    cultureId: 'miner_workcrew',
    description:
      'Pit foremen and shift bosses who watch payday traffic and side with their crews.',
    defaultRelationship: 55,
    defaultInfluence: 45,
    defaultTrust: 55,
    defaultFear: 25,
    interests: ['payday_traffic', 'cheap_drink'],
    likedPolicies: ['cheap_payday_specials'],
    dislikedPolicies: ['inflated_prices'],
    tags: ['worker', 'payday_pressure'],
  },
  {
    id: 'brewers_guild',
    label: 'Brewers Guild',
    cultureId: 'guild_artisans',
    description:
      'Town brewers who price the ale supply and remember every late payment.',
    defaultRelationship: 50,
    defaultInfluence: 55,
    defaultTrust: 50,
    defaultFear: 30,
    interests: ['ale_supply', 'tavern_debt'],
    likedPolicies: ['prompt_payment'],
    dislikedPolicies: ['watered_drinks', 'unpaid_tabs'],
    tags: ['supplier_authority', 'debt_pressure', 'ale'],
  },
  {
    id: 'town_watch',
    label: 'Town Watch',
    description:
      'Underpaid guards who tolerate noise but draw the line at corpses on the floor.',
    defaultRelationship: 45,
    defaultInfluence: 60,
    defaultTrust: 40,
    defaultFear: 55,
    interests: ['violence_control', 'inspection'],
    likedPolicies: ['quiet_nights', 'compliance'],
    dislikedPolicies: ['brawls', 'unpaid_fines'],
    tags: ['inspection_authority', 'violence_sensitive'],
  },
  {
    id: 'market_caravan_circle',
    label: 'Market Caravan Circle',
    description:
      'Roving merchants whose reliability ties to weather, roads, and rumours.',
    defaultRelationship: 50,
    defaultInfluence: 40,
    defaultTrust: 45,
    defaultFear: 20,
    interests: ['road_safety', 'market_day'],
    likedPolicies: ['reliable_purchasing'],
    dislikedPolicies: ['merchant_disrespect'],
    tags: ['supplier_authority', 'merchant', 'road_sensitive'],
  },
  {
    id: 'local_shrine',
    label: 'Local Shrine',
    description:
      'Neighbourhood shrine-keepers who run festivals and disapprove of cruelty.',
    defaultRelationship: 50,
    defaultInfluence: 35,
    defaultTrust: 55,
    defaultFear: 15,
    interests: ['festivals', 'goblin_traditions'],
    likedPolicies: ['festival_participation'],
    dislikedPolicies: ['festival_disregard'],
    tags: ['ritual', 'reputation_influence'],
  },
  {
    id: 'scrap_collectors',
    label: 'Scrap Collectors',
    description:
      'Refuse haulers who keep the privy and cellar from becoming a public hazard.',
    defaultRelationship: 45,
    defaultInfluence: 25,
    defaultTrust: 40,
    defaultFear: 20,
    interests: ['waste_removal', 'pest_control'],
    likedPolicies: ['regular_waste_payment'],
    dislikedPolicies: ['missed_pickups'],
    tags: ['pest_relevant', 'cleanliness_relevant'],
  },
]

let initialized = false

export function ensureRequiredFactionsRegistered(): void {
  if (initialized) return
  for (const def of REQUIRED_FACTIONS) {
    if (!factionRegistry.has(def.id)) {
      factionRegistry.register(def)
    }
  }
  initialized = true
}
