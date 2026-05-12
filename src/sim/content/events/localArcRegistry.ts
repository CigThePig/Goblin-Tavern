import { Registry } from '../../registries/Registry'
import type { LocalArcDefinition } from './localArcTypes'

// Phase 35 §35.4 — Local arc registry.
//
// Starter definitions cover the five archetypes called out in the plan:
// mushroom blights, miner paydays, inspection campaigns, rival expansions,
// and festival approaches. Each registry entry is a deterministic
// description; per-tavern instances live in `state.world.localEvents`.
//
// The progress rules deliberately keep arc transitions slow — the
// `seeded → rising → active → climax → resolved` path is gated on
// either days elapsed or accumulated pressure so a single noisy month
// cannot rocket an arc through every stage at once.
//
// Effect sizes are modest by design (Phase 35 §"Arc Effects" and the
// monthly module integration note §35.5: "do not swallow rent /
// landlord / inspection / rival like an overfed cellar mold"). Larger
// effects belong to later phases.

export const localArcRegistry = new Registry<LocalArcDefinition>()

export const STARTER_LOCAL_ARC_DEFINITIONS: LocalArcDefinition[] = [
  {
    id: 'mushroom_blight',
    type: 'mushroom_blight',
    label: 'Mushroom Blight',
    tags: ['supplier', 'mushrooms', 'food', 'shortage', 'market'],
    minDurationDays: 28,
    maxDurationDays: 84,
    startConditions: [
      // No hard gates — blights can seed at any time, but a random
      // weight keeps them from triggering every candidate month.
      { kind: 'random_weight', weight: 3 },
    ],
    progressRules: [
      { fromStage: 'seeded', toStage: 'rising', afterDays: 14 },
      { fromStage: 'rising', toStage: 'active', afterDays: 28 },
      { fromStage: 'active', toStage: 'climax', afterDays: 56 },
      { fromStage: 'climax', toStage: 'resolved', afterDays: 84 },
    ],
    effects: [
      { kind: 'pressure_delta', id: 'stock_shortage', amount: 8 },
      { kind: 'pressure_delta', id: 'food_safety', amount: 4 },
      { kind: 'market_condition', id: 'cheap_mushrooms' },
      { kind: 'calendar_tag', id: 'mushroom_blight' },
      { kind: 'issue_seed_tag', id: 'supplier_suspicious_goods' },
      { kind: 'issue_seed_tag', id: 'stock_shortage' },
      { kind: 'issue_seed_tag', id: 'food_quality' },
    ],
    possibleIssueSeedTags: [
      'supplier_suspicious_goods',
      'stock_shortage',
      'food_quality',
    ],
  },
  {
    id: 'miner_payday_boom',
    type: 'mining_boom',
    label: 'Miner Payday Boom',
    tags: ['miners', 'rowdy', 'traffic', 'ale'],
    minDurationDays: 14,
    maxDurationDays: 56,
    startConditions: [
      { kind: 'calendar_tag', id: 'miner_payday' },
      { kind: 'random_weight', weight: 2 },
    ],
    progressRules: [
      { fromStage: 'seeded', toStage: 'rising', afterDays: 7 },
      { fromStage: 'rising', toStage: 'active', afterDays: 14 },
      { fromStage: 'active', toStage: 'climax', afterDays: 28 },
      { fromStage: 'climax', toStage: 'resolved', afterDays: 56 },
    ],
    effects: [
      { kind: 'pressure_delta', id: 'violence', amount: 6 },
      { kind: 'customer_group_modifier', id: 'miners', tags: ['boom'] },
      { kind: 'calendar_tag', id: 'miner_boom' },
      { kind: 'issue_seed_tag', id: 'rowdy_crowd' },
    ],
    possibleIssueSeedTags: ['rowdy_crowd', 'miner_traffic'],
  },
  {
    id: 'inspection_campaign',
    type: 'inspection_campaign',
    label: 'Inspection Campaign',
    tags: ['inspection', 'town_watch', 'risk'],
    minDurationDays: 28,
    maxDurationDays: 56,
    startConditions: [
      { kind: 'pressure_above', id: 'inspection', threshold: 50 },
      { kind: 'random_weight', weight: 4 },
    ],
    progressRules: [
      { fromStage: 'seeded', toStage: 'rising', afterDays: 7 },
      { fromStage: 'rising', toStage: 'active', afterDays: 14 },
      { fromStage: 'active', toStage: 'climax', afterDays: 28 },
      { fromStage: 'climax', toStage: 'resolved', afterDays: 56 },
    ],
    effects: [
      { kind: 'pressure_delta', id: 'inspection', amount: 12 },
      { kind: 'calendar_tag', id: 'inspection_campaign_active' },
      { kind: 'reputation_signal', id: 'respectable', amount: 1 },
      { kind: 'issue_seed_tag', id: 'inspection_pressure' },
      { kind: 'issue_seed_tag', id: 'food_safety' },
    ],
    possibleIssueSeedTags: ['inspection_pressure', 'food_safety', 'cleanliness'],
  },
  {
    id: 'rival_tavern_expansion',
    type: 'rival_tavern_expansion',
    label: 'Rival Tavern Expansion',
    tags: ['rival', 'reputation', 'competition'],
    minDurationDays: 28,
    maxDurationDays: 84,
    startConditions: [
      { kind: 'random_weight', weight: 2 },
    ],
    progressRules: [
      { fromStage: 'seeded', toStage: 'rising', afterDays: 14 },
      { fromStage: 'rising', toStage: 'active', afterDays: 28 },
      { fromStage: 'active', toStage: 'climax', afterDays: 56 },
      { fromStage: 'climax', toStage: 'resolved', afterDays: 84 },
    ],
    effects: [
      { kind: 'pressure_delta', id: 'reputation_drift', amount: 6 },
      { kind: 'calendar_tag', id: 'rival_expansion' },
      { kind: 'issue_seed_tag', id: 'rival_pressure' },
      { kind: 'issue_seed_tag', id: 'upgrade_urgency' },
    ],
    possibleIssueSeedTags: ['rival_pressure', 'upgrade_urgency'],
  },
  {
    id: 'festival_approaching',
    type: 'festival_approaching',
    label: 'Festival Approaching',
    tags: ['festival', 'traffic', 'preparation'],
    minDurationDays: 14,
    maxDurationDays: 42,
    startConditions: [
      { kind: 'calendar_tag', id: 'festival_window' },
      { kind: 'random_weight', weight: 5 },
    ],
    progressRules: [
      { fromStage: 'seeded', toStage: 'rising', afterDays: 7 },
      { fromStage: 'rising', toStage: 'active', afterDays: 14 },
      { fromStage: 'active', toStage: 'climax', afterDays: 28 },
      { fromStage: 'climax', toStage: 'resolved', afterDays: 42 },
    ],
    effects: [
      { kind: 'calendar_tag', id: 'festival_preparation' },
      { kind: 'pressure_delta', id: 'stock_shortage', amount: 4 },
      { kind: 'customer_group_modifier', id: 'merchants', tags: ['festival'] },
      { kind: 'issue_seed_tag', id: 'festival_preparation' },
      { kind: 'issue_seed_tag', id: 'extra_traffic' },
    ],
    possibleIssueSeedTags: ['festival_preparation', 'extra_traffic'],
  },
]

let initialized = false

export function ensureRequiredLocalArcsRegistered(): void {
  if (initialized) return
  for (const def of STARTER_LOCAL_ARC_DEFINITIONS) {
    if (!localArcRegistry.has(def.id)) {
      localArcRegistry.register(def)
    }
  }
  initialized = true
}

// Phase 35 §35.4 — register eagerly so consumers can read the registry
// without an explicit ensure call (mirrors the Phase 29 market-condition
// pattern).
ensureRequiredLocalArcsRegistered()
