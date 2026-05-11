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

/** Phase 19 §"Issue Seed Shape" — the seed type. */
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

/** Phase 19 §19.7 — canonical seed family ids. */
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

/** Phase 19 §19.12 — text ingredient budget limits (discipline rails). */
export const TEXT_INGREDIENT_LIMITS = {
  sensoryDetails: { maxEntries: 3, maxWordsPerEntry: 6 },
  actorOpinions: { maxEntries: 2, maxWordsPerEntry: 8 },
  recentContext: { maxEntries: 3, maxWordsPerEntry: 10 },
  stakesReadable: { maxEntries: 3, maxWordsPerEntry: 12 },
  problemNoun: { maxEntries: 1, maxWordsPerEntry: 4 },
  subject: { maxEntries: 1, maxWordsPerEntry: 4 },
} as const

/** Phase 19 §19.12 — text ingredients. Short fragments, not card prose. */
export type TextIngredients = {
  subject: string
  problemNoun?: string
  sensoryDetails: string[]
  actorOpinions: Record<string, string>
  recentContext: string[]
  stakesReadable: string[]
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
  /** Seeds generated today, ordered by ranking. */
  seedsToday: IssueSeed[]
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
}

export function createInitialIssueSeedModuleState(): IssueSeedModuleState {
  return {
    seedsToday: [],
    cooldowns: {},
    rejectedToday: [],
    totalGenerated: 0,
    totalRejected: 0,
    lastGeneratedDay: -1,
  }
}
