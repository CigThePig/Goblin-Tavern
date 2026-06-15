import type {
  CalendarStamp,
  CauseEntry,
  EntityRef,
} from '../../state/TavernState'
import type { MemoryDraft } from '../memories/memoryTypes'
import type { PressureSnapshot } from '../pressures/pressureTypes'
import type { EffectPreview, EffectResult } from '../../core/effect'
import type { StateDiff } from '../../core/diff'
import type { ReportSection } from '../../core/reports'

// Phase 19 §"Issue Seed Shape" — the structured contract between the
// simulation and any future card layer. Seeds are generated from real
// pressure/cause/state inputs (Phase 18 wrote pressure snapshots; Phase
// 17 wrote causes). The card layer turns these into text; the simulation
// remains the source of truth.

/** Phase 19 §"Issue Seed Shape" — the seed timing slot. */
export type IssueSeedTiming =
  | 'morning_prep'
  | 'during_service'
  | 'closing'
  | 'end_week'
  | 'end_month'

/** Phase 19 §"Issue Seed Shape" — the seed type. Phase 39 §39.2 adds the
 *  expanded-world types alongside the canonical Phase 19 list so existing
 *  consumers keep working. */
export type IssueSeedType =
  | 'crisis'
  | 'complaint'
  | 'opportunity'
  | 'warning'
  | 'staff_request'
  | 'supplier_offer'
  | 'maintenance_problem'
  | 'customer_incident'
  | 'reputation_shift'
  | 'debt_pressure'
  | 'inspection_threat'
  | 'monthly_review'
  | 'relationship_test'
  | 'social_conflict'
  | 'policy_reaction'
  | 'festival_preparation'
  | 'rumour'
  | 'arc_milestone'

/** Phase 19 §19.7 / Phase 39 §39.1 — canonical seed family ids. The
 *  expanded families are appended additively; the original ten remain
 *  so Phase 20 coverage reports and tests keep working. */
export type IssueSeedFamilyId =
  | 'food_safety'
  | 'stock_shortage'
  | 'maintenance'
  | 'staff_burnout'
  | 'customer_complaint'
  | 'violence'
  | 'debt_rent'
  | 'inspection'
  | 'reputation_shift'
  | 'monthly_review'
  | 'staff_identity'
  | 'regular_customer'
  | 'supplier_relationship'
  | 'faction_request'
  | 'culture_conflict'
  | 'area_atmosphere'
  | 'seasonal_arc'
  | 'policy_backlash'
  | 'rumour_crisis'
  | 'rival_tavern'
  | 'venture'
  | 'opening'
  | 'liquor_compliance'
  | 'licensed_service'
  | 'staff_arc'

/** Phase 39 §39.1 — the original ten canonical families. */
export const CORE_ISSUE_SEED_FAMILIES = [
  'food_safety',
  'stock_shortage',
  'maintenance',
  'staff_burnout',
  'customer_complaint',
  'violence',
  'debt_rent',
  'inspection',
  'reputation_shift',
  'monthly_review',
] as const

/** Phase 39 §39.1 — the expanded families added in Phase 39. */
export const EXPANDED_ISSUE_SEED_FAMILIES = [
  'staff_identity',
  'regular_customer',
  'supplier_relationship',
  'faction_request',
  'culture_conflict',
  'area_atmosphere',
  'seasonal_arc',
  'policy_backlash',
  'rumour_crisis',
  'rival_tavern',
  'venture',
  'opening',
  'liquor_compliance',
  'licensed_service',
  'staff_arc',
] as const

export type CoreIssueSeedFamilyId = (typeof CORE_ISSUE_SEED_FAMILIES)[number]
export type ExpandedIssueSeedFamilyId =
  (typeof EXPANDED_ISSUE_SEED_FAMILIES)[number]

/** Phase 19 §"Response Intent Shape" — verbs the response intent layer
 *  may use. */
export type ResponseIntentVerb =
  | 'repair'
  | 'clean'
  | 'pay'
  | 'bribe'
  | 'blame'
  | 'hide'
  | 'confess'
  | 'discount'
  | 'raise_price'
  | 'lower_price'
  | 'serve'
  | 'discard'
  | 'buy'
  | 'sell'
  | 'negotiate'
  | 'threaten'
  | 'appease'
  | 'delegate'
  | 'delay'
  | 'inspect'
  | 'upgrade'
  | 'ban'
  | 'invite'
  | 'promote'
  | 'fire'
  | 'borrow'
  | 'gamble'
  | 'rebrand'
  | 'ignore'

/** Phase 19 §"Response Intent Shape" — shape classifies the trade-off. */
export type ResponseIntentShape =
  | 'safe_costly'
  | 'risky_profitable'
  | 'relationship_sacrifice'
  | 'delay_problem'
  | 'long_term_investment'
  | 'short_term_patch'
  | 'deception'
  | 'escalation'
  | 'compromise'
  | 'reputation_play'
  | 'ignore'

/**
 * Card-choice coherence contract archetype.
 *
 * `ResponseIntentShape` is intentionally broad and remains the renderer-facing
 * compatibility layer. `ChoiceArchetype` is a narrower design/audit contract:
 * it names the strategic job the option promises to do so non-rendering tools
 * can check that authored costs, payoffs, and tradeoffs match the option.
 */
export type ChoiceArchetype =
  | 'patch'
  | 'proper_repair'
  | 'major_project'
  | 'clean'
  | 'close_temporarily'
  | 'ignore'
  | 'spin_or_rebrand'
  | 'compensate'
  | 'staff_push'
  | 'staff_care'
  | 'buy_stock'
  | 'cheap_supplier'
  | 'negotiate'
  | 'escalate'
  | 'policy_change'
  | 'delay'
  | 'call_in_favor'
  | 'appease'
  | 'cut_corners'

export type ChoiceContractCostType =
  | 'coin'
  | 'staff_fatigue'
  | 'staff_morale'
  | 'owner_time'
  | 'service_capacity'
  | 'reputation_risk'
  | 'relationship_risk'
  | 'stock'
  | 'pressure_risk'
  | 'none'

export type ChoicePayoffTiming = 'immediate' | 'delayed' | 'mixed' | 'none'

/**
 * Slot-level promise read by audits and future card composition repairs.
 * Keep these fields mechanical and terse; they describe intent, not prose.
 */
export type ChoiceContract = {
  archetype: ChoiceArchetype
  primaryTarget?: string
  solves?: string[]
  doesNotSolve?: string[]
  costTypes?: ChoiceContractCostType[]
  payoffTiming?: ChoicePayoffTiming
  mustShowDelayedPayoff?: boolean
  requiresVisibleTradeoff?: boolean
}

/** Phase 19 §"Stake" — what is mechanically at stake on a seed. */
export type StakeRef = {
  id: string
  /** What this stake protects or threatens. */
  target: string
  readable: string
  /** Direction of the threat: "loss" = something will get worse; "gain" =
   *  opportunity. */
  direction: 'loss' | 'gain' | 'risk'
  tags: string[]
}

/** Phase 19 §19.8 — response slot. */
export type ResponseSlot = {
  id: string
  labelHint: string
  allowedVerbs: ResponseIntentVerb[]
  shape: ResponseIntentShape
  /** Possible entity targets the verb could act against. May be empty for
   *  generic responses (e.g. "ignore"). */
  targetOptions: EntityRef[]
  /** Mechanical effect labels — not prose. */
  expectedEffects: string[]
  /** Optional strategic contract for non-rendering audits and future preview repair. */
  choiceContract?: ChoiceContract
  requiredTags?: string[]
}

/** Phase 19 §19.9 — consequence profile. */
export type ConsequenceProfile = {
  id: string
  responseSlotId: string
  immediateEffects: EffectPreview[]
  delayedEffects: EffectPreview[]
  memories: MemoryDraft[]
  futureHooks: MemoryDraft[]
  impactScore: number
}

/** Phase 19 §19.12 / Phase 39 §39.3 — text ingredient budget limits.
 *  Phase 39 extends the limits with expanded-world fields. Ingredients
 *  remain fragments, not prose; the card layer is responsible for any
 *  rendering. */
export const TEXT_INGREDIENT_LIMITS = {
  sensoryDetails: { maxEntries: 3, maxWordsPerEntry: 6 },
  actorOpinions: { maxEntries: 2, maxWordsPerEntry: 8 },
  recentContext: { maxEntries: 3, maxWordsPerEntry: 10 },
  stakesReadable: { maxEntries: 3, maxWordsPerEntry: 12 },
  problemNoun: { maxEntries: 1, maxWordsPerEntry: 4 },
  subject: { maxEntries: 1, maxWordsPerEntry: 4 },
  namedEntities: { maxEntries: 4, maxWordsPerEntry: 5 },
  socialContext: { maxEntries: 3, maxWordsPerEntry: 10 },
  relevantMemories: { maxEntries: 3, maxWordsPerEntry: 10 },
  perceivedBlame: { maxEntries: 2, maxWordsPerEntry: 12 },
  pressureContext: { maxEntries: 3, maxWordsPerEntry: 10 },
  calendarContext: { maxEntries: 2, maxWordsPerEntry: 8 },
  marketContext: { maxEntries: 2, maxWordsPerEntry: 8 },
  arcContext: { maxEntries: 2, maxWordsPerEntry: 10 },
} as const

/** Phase 127 / ISSUE-096 — Voiced Surface arc, Phase 1. The contract
 *  split between "facts the snippet layer must reach for via signals"
 *  and "sensory seeds a flavor snippet may borrow as decoration."
 *
 *  `signal-backed` fields hold numbers, relations, or classifications
 *  whose underlying truth lives on `TavernState`. A `sim_backed` slot
 *  must NOT read these as truth — it must query the signal surface at
 *  `src/sim/signals/` so the gate can validate the claim. The fields
 *  remain on `TextIngredients` for non-card consumers (validation,
 *  legacy templates, debugging).
 *
 *  `flavor-seed` fields are short sensory or structural fragments. A
 *  `flavor` slot may read them as decoration (the gates allow it). They
 *  carry no checkable sim claim.
 *
 *  See `docs/plans/cards-contract.md §3.3` for the contract paragraph
 *  this constant backs. The Phase 1 test asserts the map is exhaustive
 *  over `keyof TextIngredients`. */
export type TextIngredientRole = 'signal-backed' | 'flavor-seed'

/** Phase 39 §39.3 — named-entity text ingredient entry. */
export type NamedEntityIngredient = {
  role: string
  ref: EntityRef
  displayName: string
}

/** Phase 19 §19.12 / Phase 39 §39.3 — text ingredients. Short fragments,
 *  not card prose. */
export type TextIngredients = {
  subject: string
  problemNoun?: string
  sensoryDetails: string[]
  actorOpinions: Record<string, string>
  recentContext: string[]
  stakesReadable: string[]

  namedEntities?: NamedEntityIngredient[]
  socialContext?: string[]
  relevantMemories?: string[]
  perceivedBlame?: string[]
  pressureContext?: string[]
  calendarContext?: string[]
  marketContext?: string[]
  arcContext?: string[]
}

/** Phase 127 / ISSUE-096 — see `TextIngredientRole` above. Exhaustive
 *  over `keyof TextIngredients`. The Phase 127 contract test asserts
 *  every key is present and asserts the role assignments below.
 *
 *  Field-by-field rationale:
 *  - `recentContext`, `pressureContext`, `marketContext`,
 *    `perceivedBlame` carry numbers / classifications today (e.g.
 *    `["reliability 82"]`, `["distrust 35"]`) — these are facts and
 *    must be queried through `src/sim/signals/`, not read as strings.
 *  - `sensoryDetails`, `actorOpinions`, `socialContext`,
 *    `relevantMemories`, `calendarContext`, `arcContext` are sensory
 *    or narrative fragments that decorate without claiming.
 *  - `subject`, `problemNoun`, `stakesReadable`, `namedEntities` are
 *    structural / referential labels. Snippets read them as names, not
 *    truth claims; the gates check `namedEntities` separately via
 *    `hasNamedEntity`.
 */
export const TEXT_INGREDIENT_ROLE: Record<
  keyof TextIngredients,
  TextIngredientRole
> = {
  subject: 'flavor-seed',
  problemNoun: 'flavor-seed',
  sensoryDetails: 'flavor-seed',
  actorOpinions: 'flavor-seed',
  recentContext: 'signal-backed',
  stakesReadable: 'flavor-seed',
  namedEntities: 'flavor-seed',
  socialContext: 'flavor-seed',
  relevantMemories: 'flavor-seed',
  perceivedBlame: 'signal-backed',
  pressureContext: 'signal-backed',
  calendarContext: 'flavor-seed',
  marketContext: 'signal-backed',
  arcContext: 'flavor-seed',
}

/** Phase 19 §19.5 — validation result attached to a seed. Invalid seeds
 *  are surfaced for debugging but never selected for card presentation. */
export type SeedValidation = {
  valid: boolean
  /** Hard failures — these always block the seed. */
  errors: string[]
  /** Soft warnings — non-blocking issues (e.g. over-budget text
   *  ingredients). */
  warnings: string[]
  /** Mapping to Phase 1 Contract §4.10 conditions. Each entry tracks
   *  which of the ten conditions passed/failed. */
  contractChecks: Record<string, boolean>
}

/** Phase 19 §"Issue Seed Shape" — the canonical seed. */
export type IssueSeed = {
  id: string
  family: IssueSeedFamilyId | string
  type: IssueSeedType
  domain: string[]
  timing: IssueSeedTiming

  severity: number
  urgency: number
  novelty: number
  cardWorthiness: number

  location?: EntityRef
  primaryActor?: EntityRef
  affectedActors: EntityRef[]

  causes: CauseEntry[]
  pressures: PressureSnapshot[]
  stakes: StakeRef[]

  responseSlots: ResponseSlot[]
  consequenceProfiles: ConsequenceProfile[]

  memoriesCreated: MemoryDraft[]
  futureHooks: MemoryDraft[]

  toneHints: string[]
  textIngredients: TextIngredients

  validation: SeedValidation

  /** When was this seed generated. */
  generatedAt: CalendarStamp
}

/** Phase 19 §19.2 — query options. */
export type IssueSeedQuery = {
  timing?: IssueSeedTiming
  types?: IssueSeedType[]
  family?: IssueSeedFamilyId | string
  max?: number
  minCardWorthiness?: number
  includeLowPriority?: boolean
  includeInvalid?: boolean
}

/** Phase 19 §"Response Intent Shape" — the player-side intent. */
export type ResponseIntent = {
  id: string
  seedId: string
  verb: ResponseIntentVerb
  shape: ResponseIntentShape
  target?: EntityRef
  tags: string[]
  intensity: number
  metadata?: Record<string, unknown>
}

/** Phase 19 §19.10 — response resolver result. */
export type ResponseResolutionResult = {
  appliedEffects: EffectResult[]
  stateDiff: StateDiff
  memoriesAdded: MemoryDraft[]
  futureHooksAdded: MemoryDraft[]
  causesAdded: Array<{
    source: string
    target: string
    readable: string
    amount: number
  }>
  impactScore: number
  report: ReportSection
}

/** Phase 19 §19.4 — cooldown tracking state per seed family/template. */
export type CooldownEntry = {
  templateId: string
  family: string
  lastGeneratedDay: number
  lastSelectedDay: number
  timesSelected: number
  timesGenerated: number
  actorIds: string[]
  locationIds: string[]
}

export type IssueSeedModuleState = {
  /** Seeds generated today, ordered by ranking. This is the budget-bounded
   *  *visible* hand: each segment-local generation pass re-ranks and
   *  re-applies the hand budget, so a seed surfaced in an earlier pass can
   *  be displaced from this list by a later, higher-ranked seed. */
  seedsToday: IssueSeed[]
  /** Phase 2 (teleology) — every seed that has been part of the visible
   *  hand (`seedsToday`) at the end of *any* generation pass today, unioned
   *  by id and cleared each `startDay`. The hand budget truncates the
   *  visible hand per pass, but a seed shown to the player in segment A must
   *  stay resolvable in `applyResponses` even after segment B/C displace it
   *  from the budgeted hand. Response lookup resolves against this set so a
   *  valid player choice is never silently dropped on a crowded day. */
  surfacedToday: IssueSeed[]
  /** Cooldown tracking for novelty/repetition control. */
  cooldowns: Record<string, CooldownEntry>
  /** Rejected seeds with reasons (debug). */
  rejectedToday: Array<{
    family: string
    templateId: string
    reason: string
  }>
  /** Total seeds generated since simulation start. */
  totalGenerated: number
  /** Total seeds rejected since simulation start. */
  totalRejected: number
  /** Absolute day of the most recent generation pass. */
  lastGeneratedDay: number
  /** Per-family entity picks: family id → entity refKey → absolute day of
   *  last pick. Used by expanded seed generators to apply a recency
   *  penalty so the same actor doesn't dominate a family across days. */
  recentPicks: Record<string, Record<string, number>>
}

export function createInitialIssueSeedModuleState(): IssueSeedModuleState {
  return {
    seedsToday: [],
    surfacedToday: [],
    cooldowns: {},
    rejectedToday: [],
    totalGenerated: 0,
    totalRejected: 0,
    lastGeneratedDay: -1,
    recentPicks: {},
  }
}
