import { z } from 'zod'

import { ContractRecordBaseSchema } from '../../contracts/obligations/index'
import type { RegulatoryRecord } from '../../contracts/obligations/index'

// Expansion Phase 7 §7.3 — the inspection lifecycle.
//
// WHAT WAS THERE BEFORE. `modules.monthly.inspection` was two numbers.
// `resolveInspection` ran once a month, moved `suspicion` up or down from
// kitchen cleanliness, privy smell, spoilage, merchant mood and reputation,
// and — when it crossed 70 — incremented `warningCount` and wrote a memory.
// The Phase 15 doc says so in as many words: "there is no inspection event
// yet. Pressure is allowed to rise without a discharging event." No
// inspector ever came. That is `OBL-03`, entire.
//
// OWNERSHIP (§5.4). The regulatory module owns EVIDENCE, CASES, VISITS and
// FINDINGS. It does not own the money: a fine is an `ObligationRecord` in
// the shared ledger like any other payable, so it inherits due dates, grace
// and default rather than being a number that vanishes when nobody pays it.
// It does not own remediation of the underlying state either — cleaning a
// kitchen is still the areas module's job, and the follow-up visit reads the
// area, not a "remediated" flag. That is what stops the loop from grading
// its own homework.
//
// The plan's §7.3 is explicit that "the inspection must consume actual
// current state, not only the pressure meter. Pressure remains a forecast of
// risk, not the event itself." So `pressure:inspection` stays exactly what
// it was — a forecast — and the visit reads areas, stock, damage, policies
// and records directly.

export const REGULATORY_MODULE_ID = 'regulatory'

/** The office that inspects the tavern. Fixed content, not a generated name. */
export const WATCH_ID = 'town_watch'
export const WATCH_LABEL = 'The Town Watch'

/**
 * The dimensions an inspector grades, straight from §7.3.7.
 *
 * Each one names a REAL piece of state, and `evaluateDimension` is the only
 * place that decides what a dimension is worth — so "the inspection consumes
 * actual current state" is a property of the code rather than a hope.
 */
export type InspectionDimension =
  | 'food_safety'
  | 'cleanliness'
  | 'spoilage'
  | 'damage'
  | 'house_rules'
  | 'records'
  | 'recent_evidence'

export const INSPECTION_DIMENSIONS: ReadonlyArray<InspectionDimension> = [
  'food_safety',
  'cleanliness',
  'spoilage',
  'damage',
  'house_rules',
  'records',
  'recent_evidence',
] as const

/**
 * One observed fact that could interest an inspector.
 *
 * Evidence is accumulated DAILY from real state and decays; it is not the
 * suspicion meter by another name. The distinction matters because a visit
 * grades the tavern as it stands today, while evidence is what made the
 * watch curious in the first place — and §7.3.7 asks for both.
 */
export type EvidenceEntry = {
  id: string
  dimension: InspectionDimension
  observedOnDay: number
  /** 1–20. How bad the observation was. */
  severity: number
  readable: string
  /** Where it was seen, when it was somewhere. */
  areaId?: string
  tags: string[]
}

/** §5.11 — evidence is a rolling window, not a permanent record. */
export const MAX_EVIDENCE_ENTRIES = 40
export const EVIDENCE_WINDOW_DAYS = 21

export type InspectionOutcome =
  | 'pass'
  | 'conditional_pass'
  | 'warning'
  | 'fine'
  | 'remediation_order'
  | 'closure'
  | 'escalation'

export type FindingStatus = 'open' | 'remediated' | 'verified' | 'appealed' | 'upheld' | 'quashed'

/**
 * One thing an inspector wrote down, and what it will take to clear it.
 *
 * `requirement` is checked against LIVE STATE at the follow-up, never
 * against a flag the player set: `verifyFinding` re-reads the area or the
 * stock. A finding the player "remediated" without fixing anything is
 * `remediated` but not `verified`, and the follow-up says so.
 */
export type InspectionFinding = {
  id: string
  caseId: string
  dimension: InspectionDimension
  raisedOnDay: number
  /** 1–20, same scale as evidence. */
  severity: number
  readable: string
  /** What the inspector requires, in player-facing words. */
  requirement: string
  /** The state the follow-up re-reads. */
  target: {
    kind: 'area' | 'stock' | 'records' | 'policy' | 'global'
    id?: string
    /** The value the follow-up needs to see at or above (or, for smell, at or below). */
    threshold?: number
    /** True when the threshold is a ceiling rather than a floor. */
    ceiling?: boolean
  }
  status: FindingStatus
  resolvedOnDay?: number | undefined
  /** Day the follow-up will check. */
  dueOnDay?: number | undefined
  tags: string[]
}

export const MAX_FINDINGS_PER_CASE = 8

export type RegulatoryCaseStatus =
  /** Evidence has accumulated; a visit is scheduled. */
  | 'open'
  /** The visit happened; findings are outstanding. */
  | 'awaiting_remediation'
  /** A finding is under appeal. */
  | 'under_appeal'
  /** Everything checked out; the case is being wound up. */
  | 'closing'
  | 'closed'
  /** The watch escalated beyond this case. */
  | 'escalated'

/**
 * A regulatory case.
 *
 * Extends the shared `RegulatoryRecord` (family `regulatory`) so a case's
 * status, history and escalation read like a loan's or a tenancy's.
 */
export type TavernRegulatoryCase = RegulatoryRecord & {
  caseStatus: RegulatoryCaseStatus
  inspectorId: string
  inspectorName: string
  /** Days the player has between being told and the visit. 0 = unannounced. */
  preparationDays: number
  /** The next visit on the calendar, when one is scheduled. */
  nextVisitDay?: number | undefined
  /** Whether the player was told the visit was coming. */
  announced: boolean
  findingIds: string[]
  outcomes: Array<{ onDay: number; outcome: InspectionOutcome; readable: string }>
  /** Fines raised against this case, as shared-ledger obligation ids. */
  fineObligationIds: string[]
  /** Set when the player tried to buy the inspector off. */
  bribe?: {
    onDay: number
    amount: number
    accepted: boolean
    exposed: boolean
  }
  appealsUsed: number
  /** Evidence severity total the case was opened on. */
  openedOnEvidence: number
}

export const MAX_APPEALS_PER_CASE = 1
export const MAX_OPEN_CASES = 3
export const MAX_ARCHIVED_CASES = 12

/**
 * The tavern's own paperwork.
 *
 * §7.3.7 lists "records" as a graded dimension, and this is the state
 * behind it: a real, decaying number the player raises by actually spending
 * an hour on the books. It exists so the preparation window has something
 * to prepare that is NOT a duplicate of cleaning a room — the areas module
 * already owns that, and a second way to clean would be two owners for one
 * transition.
 */
export type RecordsState = {
  /** 0–100. Falls a little every day; rises when the player does the books. */
  readiness: number
  lastUpdatedOnDay: number
  /** Times the player has put the books in order. */
  timesUpdated: number
}

/** How the tavern stands with the watch, across cases. */
export type WatchStanding = {
  /** 0–100. Rises with clean visits, falls with findings and exposure. */
  standing: number
  visitsPassed: number
  visitsFailed: number
  finesIssued: number
  finesPaid: number
  closuresOrdered: number
  bribesOffered: number
  bribesAccepted: number
  bribesExposed: number
  /**
   * A relationship with a particular inspector. §7.3.9 allows bribery
   * "only if consistent with the game", and the ledger already carries
   * `HOOK-corrupt_inspector_relationship` and
   * `HOOK-inspection_bribe_exposed_*`, so it is. This is what a successful
   * bribe actually buys, and what an exposure destroys.
   */
  corruptInspectorId?: string | undefined
  corruptUntilDay?: number | undefined
}

export type RegulatoryTotals = {
  casesOpened: number
  visitsCompleted: number
  findingsRaised: number
  findingsCleared: number
  finesRaised: number
  fineValue: number
  appealsUpheld: number
  appealsQuashed: number
  closuresOrdered: number
}

export type RegulatoryModuleState = {
  /** Rolling evidence window, oldest first. */
  evidence: EvidenceEntry[]
  /** Live cases, keyed by id. */
  cases: Record<string, TavernRegulatoryCase>
  /** Closed cases, oldest first. Bounded archive. */
  caseArchive: TavernRegulatoryCase[]
  /** Findings across live cases, keyed by id. */
  findings: Record<string, InspectionFinding>
  records: RecordsState
  watch: WatchStanding
  nextCaseSuffix: number
  nextFindingSuffix: number
  nextEvidenceSuffix: number
  totals: RegulatoryTotals
}

// ---------- Derived reads ----------

export function liveEvidence(
  state: RegulatoryModuleState,
  today: number,
): EvidenceEntry[] {
  return state.evidence.filter(
    (entry) => today - entry.observedOnDay <= EVIDENCE_WINDOW_DAYS,
  )
}

export function evidenceWeight(
  state: RegulatoryModuleState,
  today: number,
): number {
  return liveEvidence(state, today).reduce(
    // Older evidence counts for less. A fortnight-old spill is not what the
    // watch turns up about, but it is part of why they are watching.
    (sum, entry) =>
      sum +
      entry.severity *
        Math.max(0.2, 1 - (today - entry.observedOnDay) / EVIDENCE_WINDOW_DAYS),
    0,
  )
}

export function openCases(state: RegulatoryModuleState): TavernRegulatoryCase[] {
  return Object.values(state.cases).sort((a, b) => a.id.localeCompare(b.id))
}

// ---------- Schemas (§5.7) ----------

const DimensionSchema = z.enum([
  'food_safety',
  'cleanliness',
  'spoilage',
  'damage',
  'house_rules',
  'records',
  'recent_evidence',
])

export const EvidenceEntrySchema = z.object({
  id: z.string(),
  dimension: DimensionSchema,
  observedOnDay: z.number().int(),
  severity: z.number().min(0),
  readable: z.string(),
  areaId: z.string().optional(),
  tags: z.array(z.string()),
})

export const InspectionFindingSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  dimension: DimensionSchema,
  raisedOnDay: z.number().int(),
  severity: z.number().min(0),
  readable: z.string(),
  requirement: z.string(),
  target: z.object({
    kind: z.enum(['area', 'stock', 'records', 'policy', 'global']),
    id: z.string().optional(),
    threshold: z.number().optional(),
    ceiling: z.boolean().optional(),
  }),
  status: z.enum([
    'open',
    'remediated',
    'verified',
    'appealed',
    'upheld',
    'quashed',
  ]),
  resolvedOnDay: z.number().int().optional(),
  dueOnDay: z.number().int().optional(),
  tags: z.array(z.string()),
})

export const TavernRegulatoryCaseSchema = ContractRecordBaseSchema.extend({
  family: z.literal('regulatory'),
  caseType: z.string(),
  scheduledVisitDays: z.array(z.number().int()),
  visitsCompleted: z.number().int().min(0),
  findings: z.array(
    z.object({
      onDay: z.number().int(),
      code: z.string(),
      readable: z.string(),
      severity: z.number(),
    }),
  ),
  caseStatus: z.enum([
    'open',
    'awaiting_remediation',
    'under_appeal',
    'closing',
    'closed',
    'escalated',
  ]),
  inspectorId: z.string(),
  inspectorName: z.string(),
  preparationDays: z.number().int().min(0),
  nextVisitDay: z.number().int().optional(),
  announced: z.boolean(),
  findingIds: z.array(z.string()),
  outcomes: z.array(
    z.object({
      onDay: z.number().int(),
      outcome: z.enum([
        'pass',
        'conditional_pass',
        'warning',
        'fine',
        'remediation_order',
        'closure',
        'escalation',
      ]),
      readable: z.string(),
    }),
  ),
  fineObligationIds: z.array(z.string()),
  bribe: z
    .object({
      onDay: z.number().int(),
      amount: z.number().min(0),
      accepted: z.boolean(),
      exposed: z.boolean(),
    })
    .optional(),
  appealsUsed: z.number().int().min(0),
  openedOnEvidence: z.number().min(0),
})

export const RegulatoryModuleStateSchema = z.object({
  evidence: z.array(EvidenceEntrySchema),
  cases: z.record(z.string(), TavernRegulatoryCaseSchema),
  caseArchive: z.array(TavernRegulatoryCaseSchema),
  findings: z.record(z.string(), InspectionFindingSchema),
  records: z.object({
    readiness: z.number().min(0).max(100),
    lastUpdatedOnDay: z.number().int(),
    timesUpdated: z.number().int().min(0),
  }),
  watch: z.object({
    standing: z.number().min(0).max(100),
    visitsPassed: z.number().int().min(0),
    visitsFailed: z.number().int().min(0),
    finesIssued: z.number().int().min(0),
    finesPaid: z.number().int().min(0),
    closuresOrdered: z.number().int().min(0),
    bribesOffered: z.number().int().min(0),
    bribesAccepted: z.number().int().min(0),
    bribesExposed: z.number().int().min(0),
    corruptInspectorId: z.string().optional(),
    corruptUntilDay: z.number().int().optional(),
  }),
  nextCaseSuffix: z.number().int().min(0),
  nextFindingSuffix: z.number().int().min(0),
  nextEvidenceSuffix: z.number().int().min(0),
  totals: z.object({
    casesOpened: z.number().int().min(0),
    visitsCompleted: z.number().int().min(0),
    findingsRaised: z.number().int().min(0),
    findingsCleared: z.number().int().min(0),
    finesRaised: z.number().int().min(0),
    fineValue: z.number().min(0),
    appealsUpheld: z.number().int().min(0),
    appealsQuashed: z.number().int().min(0),
    closuresOrdered: z.number().int().min(0),
  }),
})
