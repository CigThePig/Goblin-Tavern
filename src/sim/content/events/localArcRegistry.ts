import { Registry } from '../../registries/Registry'
import type { LocalArcDefinition } from './localArcTypes'
import { ARC_PROGRESSIONS } from './localArcProgressions'

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
  // -------------------------------------------------------------------------
  // Expansion Phase 9 §9.2 — the four shapes the starter five never covered.
  //
  // §9.2 requires the catalog to collectively exercise eight materially
  // different arc shapes. The five above are a market disruption, two
  // cultural events, a regulatory campaign and a rival move; these four are
  // the state-driven crisis, the faction conflict, the recovery arc, and the
  // arc that changes the world for good. Their goals, stages, interventions
  // and outcomes live in `localArcProgressions.ts` with the other five.
  // -------------------------------------------------------------------------
  {
    id: 'sickness_in_the_quarter',
    type: 'winter_shortage',
    label: 'Sickness In The Quarter',
    tags: ['health', 'food', 'rumour', 'crisis'],
    minDurationDays: 10,
    maxDurationDays: 35,
    startConditions: [
      // A STATE-DRIVEN start, which is the whole point of the shape: this
      // arc cannot seed in a clean house. Something has to have actually
      // gone wrong in the kitchen first.
      { kind: 'pressure_above', id: 'food_safety', threshold: 45 },
      { kind: 'random_weight', weight: 4 },
    ],
    progressRules: [
      { fromStage: 'seeded', toStage: 'rising', afterDays: 3 },
      { fromStage: 'rising', toStage: 'climax', afterDays: 14 },
      { fromStage: 'climax', toStage: 'resolved', afterDays: 35 },
    ],
    effects: [
      { kind: 'pressure_delta', id: 'food_safety', amount: 8 },
      { kind: 'pressure_delta', id: 'rumour_pressure', amount: 5 },
      { kind: 'issue_seed_tag', id: 'food_quality' },
    ],
    possibleIssueSeedTags: ['food_quality', 'cleanliness'],
  },
  {
    id: 'guild_turf_dispute',
    type: 'faction_tension',
    label: 'Guild Turf Dispute',
    tags: ['faction', 'conflict', 'social'],
    minDurationDays: 12,
    maxDurationDays: 40,
    startConditions: [
      { kind: 'pressure_above', id: 'faction_anger', threshold: 35 },
      { kind: 'random_weight', weight: 3 },
    ],
    progressRules: [
      { fromStage: 'seeded', toStage: 'active', afterDays: 4 },
      { fromStage: 'active', toStage: 'resolved', afterDays: 40 },
    ],
    effects: [
      { kind: 'pressure_delta', id: 'faction_anger', amount: 7 },
      { kind: 'issue_seed_tag', id: 'faction_pressure' },
    ],
    possibleIssueSeedTags: ['faction_pressure'],
  },
  {
    id: 'back_from_the_brink',
    type: 'winter_shortage',
    label: 'Back From The Brink',
    tags: ['economy', 'recovery', 'debt'],
    minDurationDays: 14,
    maxDurationDays: 45,
    startConditions: [
      // A recovery arc needs something to recover FROM. It seeds off real
      // debt pressure rather than a die roll, which is what makes it the
      // recovery shape rather than another crisis.
      { kind: 'pressure_above', id: 'debt', threshold: 50 },
      { kind: 'random_weight', weight: 5 },
    ],
    progressRules: [
      { fromStage: 'seeded', toStage: 'active', afterDays: 5 },
      { fromStage: 'active', toStage: 'resolved', afterDays: 45 },
    ],
    effects: [
      { kind: 'pressure_delta', id: 'debt', amount: 4 },
      { kind: 'issue_seed_tag', id: 'debt_pressure' },
    ],
    possibleIssueSeedTags: ['debt_pressure'],
  },
  {
    id: 'the_road_moves',
    type: 'road_danger',
    label: 'The Road Moves',
    tags: ['market', 'merchants', 'permanent', 'transformation'],
    minDurationDays: 17,
    maxDurationDays: 40,
    startConditions: [{ kind: 'random_weight', weight: 1 }],
    progressRules: [
      { fromStage: 'seeded', toStage: 'climax', afterDays: 7 },
      { fromStage: 'climax', toStage: 'resolved', afterDays: 40 },
    ],
    effects: [
      { kind: 'pressure_delta', id: 'market_instability', amount: 5 },
      { kind: 'calendar_tag', id: 'road_survey' },
    ],
    possibleIssueSeedTags: ['market_shift'],
  },
]

let initialized = false

/**
 * Expansion Phase 9 §9.2 — attach the progression to its definition.
 *
 * Kept as a join rather than inlined into each definition for one reason
 * worth stating: `STARTER_LOCAL_ARC_DEFINITIONS` is the arc's mechanical
 * spine — durations, seeding gates, the pressure nudges it applies while it
 * runs — and the progression is its story: what the house wants, who is
 * pushing back, what can be done about it and what is left afterwards. The
 * two are edited by different kinds of change, and a definition with no
 * progression is still a valid arc that runs on the age spine.
 */
function withProgression(def: LocalArcDefinition): LocalArcDefinition {
  const progression = ARC_PROGRESSIONS[def.id]
  return progression ? { ...def, progression } : def
}

export function ensureRequiredLocalArcsRegistered(): void {
  if (initialized) return
  for (const def of STARTER_LOCAL_ARC_DEFINITIONS) {
    if (!localArcRegistry.has(def.id)) {
      localArcRegistry.register(withProgression(def))
    }
  }
  initialized = true
}

// Phase 35 §35.4 — register eagerly so consumers can read the registry
// without an explicit ensure call (mirrors the Phase 29 market-condition
// pattern).
ensureRequiredLocalArcsRegistered()
