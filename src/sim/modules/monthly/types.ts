import type { WeeklySignalTotals } from '../weekly/types'

// Phase 15 — Monthly pressure system types.
//
// The monthly module rolls weekly outputs into a strategic layer: rent,
// landlord pressure, inspection suspicion, multi-axis reputation shifts,
// upgrade readiness, rival tavern pressure, and month modifiers. Phase 15
// §"Do Not Do" — no cards, no issue seeds, no narrative event content.

export const MONTHLY_MODULE_ID = 'monthly'

// ---------- Rent / landlord / inspection / rival ----------

export type RentState = {
  /** Coin owed each month. */
  monthlyAmount: number
  /** True if the most recently resolved month was paid in full. */
  paidThisMonth: boolean
  /** Lifetime count of missed full payments. */
  missedPayments: number
  /** Unpaid rent rolled over from past missed months (rolling debt). */
  arrears: number
}

export type LandlordState = {
  /** 0–100, drifts toward 50; "what does the landlord think of you". */
  opinion: number
  /** 0–100, rises when rent slips or the building looks bad. */
  pressure: number
  /** Lifetime count of times rent was not paid in full. */
  missedRentCount: number
}

export type InspectionState = {
  /** 0–100, the chance an inspector takes a closer look. */
  suspicion: number
  /** Month number of the most recently resolved inspection cycle. */
  lastInspectionMonth?: number
  /** Number of times suspicion crossed the warning threshold. */
  warningCount: number
}

export type RivalTavernStrategy =
  | 'unknown'
  | 'clean'
  | 'cheap'
  | 'rowdy'
  | 'fancy'

export type RivalTavernState = {
  pressure: number
  appeal: number
  strategy: RivalTavernStrategy
}

// ---------- Reputation tiers ----------

export type ReputationTier =
  | 'absent'
  | 'faint'
  | 'known'
  | 'strong'
  | 'defining'

export const REPUTATION_AXIS_IDS = [
  'cheap',
  'tasty',
  'filthy',
  'dangerous',
  'cozy',
  'reliable',
  'goblinAuthentic',
  'respectable',
  'strange',
] as const

export type ReputationAxisId = (typeof REPUTATION_AXIS_IDS)[number]

export type ReputationAxisShift = {
  axisId: ReputationAxisId
  before: number
  after: number
  delta: number
  tierBefore: ReputationTier
  tierAfter: ReputationTier
  reasons: string[]
}

// ---------- Upgrade readiness ----------

export type UpgradeReadinessEntry = {
  id: string
  label: string
  rationale: string
  /** 0–100, how urgent the readiness signal is. */
  relevance: number
}

// ---------- Month modifiers ----------

export type MonthModifierId =
  | 'rainy_month'
  | 'festival_month'
  | 'tax_month'
  | 'mold_bloom'
  | 'quiet_roads'
  | 'adventurer_season'

export type MonthModifier = {
  id: MonthModifierId
  label: string
  tags: string[]
  description: string
}

// ---------- Monthly accumulator ----------

export type MonthlyEconomyTotals = {
  sales: number
  purchases: number
  repairs: number
  wages: number
  rent: number
  waste: number
  other: number
  net: number
}

export type MonthlyAccumulator = {
  /** Weeks finalized into the current month, by weekKey. */
  weekKeys: string[]
  /** Sum of weekly signal totals across the month. */
  signals: WeeklySignalTotals
  signalNotes: string[]
  /** Sum of weekly economy totals across the month. */
  economy: MonthlyEconomyTotals
  /** Cumulative shortage count across the month. */
  shortageCount: number
  /** Cumulative incidents observed across the month. */
  incidentCount: number
  /** Count of weeks where wages went unpaid. */
  unpaidWageWeeks: number
  /** End-of-week snapshots of total damage (one sample per finalized week). */
  damageSamples: number[]
}

// ---------- Monthly result ----------

export type RentResolution = {
  amountDue: number
  paid: boolean
  paidAmount: number
  arrears: number
  missedPayments: number
}

export type LandlordResolution = {
  opinionBefore: number
  opinionAfter: number
  pressureBefore: number
  pressureAfter: number
  notes: string[]
}

export type InspectionResolution = {
  suspicionBefore: number
  suspicionAfter: number
  warningCount: number
  warningIssuedThisMonth: boolean
  notes: string[]
}

export type RivalTavernResolution = {
  pressureBefore: number
  pressureAfter: number
  appealBefore: number
  appealAfter: number
  notes: string[]
}

export type MonthlyResult = {
  monthKey: string
  monthNumber: number
  yearNumber: number
  endDay: number
  endingCoin: number

  rent: RentResolution
  landlord: LandlordResolution
  inspection: InspectionResolution
  rivalTavern: RivalTavernResolution

  reputationShifts: ReputationAxisShift[]
  upgradeReadiness: UpgradeReadinessEntry[]

  economy: MonthlyEconomyTotals

  /** The modifier that was active for the month that just ended. */
  activeModifier: MonthModifier
  /** The modifier picked for the month that begins next. */
  nextMonthModifier: MonthModifier

  bestGroupId?: string
  worstGroupId?: string

  strategicSummary: string[]
}

// ---------- Module state ----------

export type MonthlyModuleState = {
  /** Calendar coordinate of the month currently being accumulated. */
  monthKey: string
  monthNumber: number
  yearNumber: number

  rent: RentState
  landlord: LandlordState
  inspection: InspectionState
  rivalTavern: RivalTavernState

  /** The modifier active for the current in-progress month. */
  currentModifier: MonthModifier
  /** The accumulator buffer for the in-progress month. */
  accumulator: MonthlyAccumulator
  /** Last finalized monthly result; cleared at the start of a new month. */
  lastMonthlyResult?: MonthlyResult
  /** Has the current accumulation window already had endMonth run on it? */
  monthFinalized: boolean
}
