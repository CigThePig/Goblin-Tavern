import { z } from 'zod'

import type {
  EntityRef,
  StaffAbsenceKind,
  StaffCareerGoal,
  StaffIdentityState,
  StaffPriorityId,
  StaffRoleId,
  StaffShiftId,
} from '../../state/TavernState'
import type { CastAttributes } from '../../content/cast/castTypes'
import type { GeneratedName } from '../../content/naming/nameTypes'
import type { EmploymentRecord } from '../../contracts/obligations/index'
import type { ActorState } from '../../contracts/actors/index'

// Expansion Phase 3 §3.1–§3.3 — the persistent workforce records.
//
// WHAT CHANGED, AND WHY IT NEEDED NEW STATE. Before this phase a staff member
// was six meters, a wage, and a boolean. Everything the game said about people
// — that they get tired, fall out with each other, learn the job, ask to be
// paid properly, and walk out when none of that is answered — was either a
// pressure nudge or a promise nobody kept (`OBL-02`). Meters cannot carry any
// of it: "who covered for whom", "what did we agree to pay", and "how long has
// this been going on" are facts about a relationship over time, and a number
// between 0 and 100 has no room for them.
//
// So this file adds the records those facts live in, and nothing else. Each one
// exists because a rule in §3 reads it:
//
//   EmploymentRecord      the terms, the notice clock, the discipline rung
//   StaffApplicant        who is actually available to hire, and for what
//   StaffRelationshipEdge who works with whom, and how that is going
//   StaffRosterEntry      today's assignment — the thing service is derived FROM
//   StaffCoverageEntry    what the day wanted vs what it got
//   StaffWageSettlement   what was owed, what was paid, what is still owed
//
// The per-day lists (`roster`, `coverage`, `development`, `separations`) are
// rebuilt from scratch every morning, which is what keeps them bounded (§5.11);
// the persistent collections declare explicit caps and expiry below.

// ---------------------------------------------------------------------------
// §5.11 — bounded growth, declared with the collections they bound
// ---------------------------------------------------------------------------

/** Applicants on the board at once. A roster the player cannot read is not a choice. */
export const MAX_APPLICANTS = 8
/** Days an applicant waits before taking work elsewhere. */
export const APPLICANT_SHELF_LIFE_DAYS = 14
/** Open vacancies tracked at once — one per registered role at worst. */
export const MAX_VACANCIES = 12
/**
 * Active social edges per person (§3.3 "cap each person's active social
 * edges"). Four is deliberately small: it is the number of people whose
 * opinion of you the player can plausibly hold in mind, and an uncapped graph
 * of nine staff members is 36 edges nobody reads.
 */
export const MAX_ACTIVE_EDGES_PER_STAFF = 4
/** Total edges, active and forming. */
export const MAX_RELATIONSHIP_EDGES = 48
/** Days of recorded contact before an edge starts having consequences. */
export const MIN_CONTACTS_FOR_ACTIVE_EDGE = 3
/** An active edge with no contact for this long lapses. */
export const EDGE_EXPIRY_DAYS = 21
/** A still-forming edge lapses sooner — two people who met twice are not friends. */
export const FORMING_EDGE_EXPIRY_DAYS = 10
/** Cross-trained roles one person may hold. */
export const MAX_CROSS_TRAINED_ROLES = 3
/** Cross-training at or above this may cover the role in the coverage pass. */
export const CROSS_TRAINING_COVER_THRESHOLD = 60
/** Closed employment records kept for "what happened to them?". */
export const MAX_EMPLOYMENT_ARCHIVE = 40
/** Separations kept in the run's history. */
export const MAX_SEPARATION_HISTORY = 30

// ---------------------------------------------------------------------------
// Work kinds
// ---------------------------------------------------------------------------

/**
 * §3.2 — what a staff member's day actually consists of.
 *
 * Declared on the priority definition rather than inferred from tag strings,
 * because the roster has to know whether someone is on the floor or in the
 * cellar to place them, and a tag list is a search, not an answer.
 */
export type StaffWorkKind =
  | 'kitchen'
  | 'service'
  | 'cleaning'
  | 'repair'
  | 'security'
  | 'procurement'

// ---------------------------------------------------------------------------
// Labor market
// ---------------------------------------------------------------------------

/**
 * §3.1 — someone looking for work.
 *
 * An applicant is a person, not a role slot: they are generated once with a
 * name, an identity and a wage they will accept, they sit on the board for a
 * bounded number of days, and they leave if nobody hires them. That is what
 * makes hiring a decision rather than a purchase — the master chef on the
 * board this week may not be there next week.
 */
export type StaffApplicant = {
  id: string
  name: GeneratedName
  roleId: StaffRoleId
  skill: number
  /** Weekly wage they will accept. The same unit as `StaffState.wage`. */
  wageAsk: number
  identity: StaffIdentityState
  castAttributes: CastAttributes
  careerGoal: StaffCareerGoal
  /**
   * Why they are on the market. Not decoration: a `referral` arrives cheaper
   * because a current staff member vouched for them, and a `poached` hand asks
   * above the role's going rate.
   */
  provenance: 'walk_in' | 'referral' | 'poached' | 'apprentice'
  /** Set when a current staff member referred them. Drives the arrival relationship. */
  referredByStaffId?: string
  /** Set when this applicant arrived in answer to a vacancy the tavern posted. */
  answersVacancyForRole?: StaffRoleId
  postedOnDay: number
  /** Last day they are still available (§5.11 expiry). */
  availableUntilDay: number
  readable: string
}

export type StaffVacancy = {
  roleId: StaffRoleId
  openedOnDay: number
  reason: string
}

export type StaffLaborMarketState = {
  applicants: StaffApplicant[]
  vacancies: StaffVacancy[]
  lastRefreshedOnDay: number
  nextSuffix: number
}

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

/**
 * §3.3 — one relationship, held once.
 *
 * A staff–staff edge is stored ONCE under a canonical id rather than mirrored
 * on both people, for the same reason §2.2 forbade a stored `usableSeats`: two
 * copies of one fact can disagree, and then no report can say which is true.
 * Degree per person is computed from this list.
 */
export type StaffRelationshipEdge = {
  id: string
  kind: 'coworker' | 'owner'
  /** For `owner` edges this is always `{ kind: 'system', id: 'owner' }`. */
  from: EntityRef
  to: EntityRef
  /** Days on which these two actually had contact. */
  contacts: number
  /** -100..100. Cooperation above zero, friction below. */
  affinity: number
  /** 0..100. Gates raise demands, negotiation and willingness to cover. */
  trust: number
  lastContactOnDay: number
  createdOnDay: number
  tags: string[]
}

/** An edge only has consequences once contact has actually repeated. */
export function isActiveEdge(edge: StaffRelationshipEdge): boolean {
  return edge.contacts >= MIN_CONTACTS_FOR_ACTIVE_EDGE
}

// ---------------------------------------------------------------------------
// The day's derived roster
// ---------------------------------------------------------------------------

/**
 * §3.2 — one person's actual assignment today.
 *
 * This is the record that makes "service outputs traceable to actual
 * assignment and staff state" a checkable claim: `contribution` is the single
 * multiplier the service-quality derivation applies to this member, and every
 * factor that produced it is on the same row.
 */
export type StaffRosterEntry = {
  staffId: string
  roleId: StaffRoleId
  shift: StaffShiftId
  areaId: string
  workKind: StaffWorkKind
  priorityId?: StaffPriorityId
  available: boolean
  absenceKind?: StaffAbsenceKind
  /** 0..1 — how well role, priority and station fit each other. */
  skillFit: number
  /** 0..1 lost to switching focus or covering a second role. */
  handoffPenalty: number
  /** 0..1 — what fraction of the trading day this shift covers. */
  shiftCoverage: number
  /** `skillFit × shiftCoverage × (1 − handoffPenalty)`, 0 when unavailable. */
  contribution: number
  overtime: boolean
  /** Set when this member is standing in for a role that is not theirs. */
  coveringRoleId?: StaffRoleId
  fatigueAdded: number
  stressAdded: number
  experienceAdded: number
  /** Always populated when something reduced `contribution`. */
  notes: string[]
}

export type StaffCoverageEntry = {
  roleId: StaffRoleId
  /** Bodies the day wants on this role. */
  demand: number
  /** Bodies actually on it, including cross-trained cover. */
  covered: number
  gap: number
  coveredBy: string[]
  readable: string
}

export type StaffDevelopmentEntry = {
  staffId: string
  kind:
    | 'experience'
    | 'skill_growth'
    | 'cross_training'
    | 'promotion'
    | 'raise'
    | 'wage_cut'
    | 'discipline'
    | 'training'
  readable: string
  before?: number
  after?: number
  roleId?: StaffRoleId
}

export type StaffSeparationEntry = {
  staffId: string
  staffName: string
  roleId: StaffRoleId
  kind: 'resigned' | 'dismissed' | 'notice_expired' | 'abandoned'
  onDay: number
  severancePaid: number
  reason: string
  readable: string
}

// ---------------------------------------------------------------------------
// Wages
// ---------------------------------------------------------------------------

/**
 * §3.1 — what the week's wage bill actually did.
 *
 * Partial payment is first-class here, which is the change that makes
 * non-payment a situation rather than a switch: paying four of five hands
 * leaves one specific person unpaid, with a named arrears record they can
 * point at, and that is what the quit-risk resolver reads.
 */
export type StaffWageSettlement = {
  onDay: number
  totalDue: number
  paid: number
  shortfall: number
  perStaff: Array<{
    staffId: string
    due: number
    paid: number
    /** The arrears record opened for anything left unpaid. */
    obligationId?: string
  }>
  /** Live arrears records after this settlement. */
  arrearsObligationIds: string[]
  readable: string
}

// ---------------------------------------------------------------------------
// The slice
// ---------------------------------------------------------------------------

export type StaffWorkforceTotals = {
  hired: number
  separated: number
  resigned: number
  dismissed: number
  promotions: number
  raises: number
  trainingSessions: number
  skillPointsGained: number
  absenceDays: number
  coverageGapDays: number
  overtimeDays: number
  wagesPaid: number
  wageShortfall: number
  quitRisksWarned: number
  quitRisksAverted: number
  quitRisksHonoured: number
  relationshipsFormed: number
}

export type StaffWorkforceState = {
  /** Live employment terms, keyed by staff id. */
  employment: Record<string, EmploymentRecord>
  /** Closed terms, most recent last. Bounded archive. */
  employmentArchive: EmploymentRecord[]
  laborMarket: StaffLaborMarketState
  relationships: StaffRelationshipEdge[]
  /** Autonomous decision state, keyed by staff id (§3.3 / Phase 1 §1.6). */
  actors: Record<string, ActorState>
  /** Rebuilt every morning. */
  roster: StaffRosterEntry[]
  coverage: StaffCoverageEntry[]
  development: StaffDevelopmentEntry[]
  separations: StaffSeparationEntry[]
  separationHistory: StaffSeparationEntry[]
  lastWageSettlement?: StaffWageSettlement
  totals: StaffWorkforceTotals
}

export function createInitialStaffWorkforceState(): StaffWorkforceState {
  return {
    employment: {},
    employmentArchive: [],
    laborMarket: {
      applicants: [],
      vacancies: [],
      lastRefreshedOnDay: -1,
      nextSuffix: 0,
    },
    relationships: [],
    actors: {},
    roster: [],
    coverage: [],
    development: [],
    separations: [],
    separationHistory: [],
    totals: createInitialStaffWorkforceTotals(),
  }
}

export function createInitialStaffWorkforceTotals(): StaffWorkforceTotals {
  return {
    hired: 0,
    separated: 0,
    resigned: 0,
    dismissed: 0,
    promotions: 0,
    raises: 0,
    trainingSessions: 0,
    skillPointsGained: 0,
    absenceDays: 0,
    coverageGapDays: 0,
    overtimeDays: 0,
    wagesPaid: 0,
    wageShortfall: 0,
    quitRisksWarned: 0,
    quitRisksAverted: 0,
    quitRisksHonoured: 0,
    relationshipsFormed: 0,
  }
}

// ---------------------------------------------------------------------------
// Schemas (§5.7 — persisted field, schema in the same phase)
// ---------------------------------------------------------------------------

const EntityRefSchema = z.object({ kind: z.string(), id: z.string() })
const meter = () => z.number().min(0).max(100)

// The staff-identity and cast-attribute shapes are already schema'd in
// `state/schemas.ts`; re-parsing them structurally here would be a second
// definition that could drift, so an applicant's copies are validated as
// permissive records and the identity registries do the membership check
// (the same split `StaffState.role` already uses).
const ApplicantIdentitySchema = z.looseObject({
  groupId: z.string(),
  namingProfileId: z.string(),
  personalityTags: z.array(z.string()),
  workStyle: z.string(),
  stressResponse: z.string(),
  loyalties: z.array(z.string()),
  dislikes: z.array(z.string()),
})

export const StaffApplicantSchema = z.object({
  id: z.string(),
  name: z.looseObject({ display: z.string(), profileId: z.string() }),
  roleId: z.string(),
  skill: meter(),
  wageAsk: z.number().min(0),
  identity: ApplicantIdentitySchema,
  castAttributes: z.looseObject({}),
  careerGoal: z.enum(['mastery', 'coin', 'security', 'standing']),
  provenance: z.enum(['walk_in', 'referral', 'poached', 'apprentice']),
  referredByStaffId: z.string().optional(),
  answersVacancyForRole: z.string().optional(),
  postedOnDay: z.number().int(),
  availableUntilDay: z.number().int(),
  readable: z.string(),
})

export const StaffRelationshipEdgeSchema = z.object({
  id: z.string(),
  kind: z.enum(['coworker', 'owner']),
  from: EntityRefSchema,
  to: EntityRefSchema,
  contacts: z.number().int().min(0),
  affinity: z.number().min(-100).max(100),
  trust: meter(),
  lastContactOnDay: z.number().int(),
  createdOnDay: z.number().int(),
  tags: z.array(z.string()),
})

export const StaffRosterEntrySchema = z.object({
  staffId: z.string(),
  roleId: z.string(),
  shift: z.enum(['early', 'late', 'double', 'rest']),
  areaId: z.string(),
  workKind: z.enum([
    'kitchen',
    'service',
    'cleaning',
    'repair',
    'security',
    'procurement',
  ]),
  priorityId: z.string().optional(),
  available: z.boolean(),
  absenceKind: z
    .enum(['illness', 'injury', 'leave', 'unexcused', 'notice_served'])
    .optional(),
  skillFit: z.number().min(0).max(1),
  handoffPenalty: z.number().min(0).max(1),
  shiftCoverage: z.number().min(0).max(2),
  contribution: z.number().min(0).max(2),
  overtime: z.boolean(),
  coveringRoleId: z.string().optional(),
  fatigueAdded: z.number(),
  stressAdded: z.number(),
  experienceAdded: z.number(),
  notes: z.array(z.string()),
})

export const StaffCoverageEntrySchema = z.object({
  roleId: z.string(),
  demand: z.number().min(0),
  covered: z.number().min(0),
  gap: z.number().min(0),
  coveredBy: z.array(z.string()),
  readable: z.string(),
})

export const StaffDevelopmentEntrySchema = z.object({
  staffId: z.string(),
  kind: z.enum([
    'experience',
    'skill_growth',
    'cross_training',
    'promotion',
    'raise',
    'wage_cut',
    'discipline',
    'training',
  ]),
  readable: z.string(),
  before: z.number().optional(),
  after: z.number().optional(),
  roleId: z.string().optional(),
})

export const StaffSeparationEntrySchema = z.object({
  staffId: z.string(),
  staffName: z.string(),
  roleId: z.string(),
  kind: z.enum(['resigned', 'dismissed', 'notice_expired', 'abandoned']),
  onDay: z.number().int(),
  severancePaid: z.number().min(0),
  reason: z.string(),
  readable: z.string(),
})

export const StaffWageSettlementSchema = z.object({
  onDay: z.number().int(),
  totalDue: z.number().min(0),
  paid: z.number().min(0),
  shortfall: z.number().min(0),
  perStaff: z.array(
    z.object({
      staffId: z.string(),
      due: z.number().min(0),
      paid: z.number().min(0),
      obligationId: z.string().optional(),
    }),
  ),
  arrearsObligationIds: z.array(z.string()),
  readable: z.string(),
})

/**
 * The employment record's own schema.
 *
 * `ContractRecordBaseSchema` (Phase 1) carries the shared half; the employment
 * family's four fields are extended on here rather than in the contract file,
 * because §1.2 is explicit that the shared module owns the vocabulary and each
 * domain owns its own family.
 */
export const EmploymentRecordSchema = z.object({
  id: z.string(),
  family: z.literal('employment'),
  ownerModuleId: z.string(),
  counterparty: EntityRefSchema,
  status: z.enum([
    'pending',
    'active',
    'grace',
    'defaulted',
    'in_collections',
    'settled',
    'forgiven',
    'cancelled',
    'expired',
  ]),
  openedOnDay: z.number().int(),
  dueOnDay: z.number().int().optional(),
  graceDays: z.number().int().min(0),
  closedOnDay: z.number().int().optional(),
  lastTransitionOnDay: z.number().int(),
  history: z.array(
    z.object({
      onDay: z.number().int(),
      from: z.string(),
      to: z.string(),
      reason: z.string(),
      amount: z.number().optional(),
    }),
  ),
  escalation: z.number().int().min(0),
  readable: z.string(),
  tags: z.array(z.string()),
  staffId: z.string(),
  wagePerDay: z.number().min(0),
  noticeDays: z.number().int().min(0),
  lastRaiseOnDay: z.number().int().optional(),
  notice: z
    .object({
      givenBy: z.enum(['owner', 'staff']),
      givenOnDay: z.number().int(),
      reason: z.string(),
    })
    .optional(),
})

const ActorStateLooseSchema = z.looseObject({
  ref: EntityRefSchema,
  ownerModuleId: z.string(),
  budget: z.number(),
  goals: z.array(
    z.object({ id: z.string(), weight: z.number(), readable: z.string() }),
  ),
  beliefs: z.record(z.string(), z.string()),
  cooldowns: z.record(z.string(), z.number()),
  history: z.array(z.looseObject({})),
})

export const StaffWorkforceStateSchema = z.object({
  employment: z.record(z.string(), EmploymentRecordSchema).optional(),
  employmentArchive: z.array(EmploymentRecordSchema).optional(),
  laborMarket: z
    .object({
      applicants: z.array(StaffApplicantSchema),
      vacancies: z.array(
        z.object({
          roleId: z.string(),
          openedOnDay: z.number().int(),
          reason: z.string(),
        }),
      ),
      lastRefreshedOnDay: z.number().int(),
      nextSuffix: z.number().int().min(0),
    })
    .optional(),
  relationships: z.array(StaffRelationshipEdgeSchema).optional(),
  actors: z.record(z.string(), ActorStateLooseSchema).optional(),
  roster: z.array(StaffRosterEntrySchema).optional(),
  coverage: z.array(StaffCoverageEntrySchema).optional(),
  development: z.array(StaffDevelopmentEntrySchema).optional(),
  separations: z.array(StaffSeparationEntrySchema).optional(),
  separationHistory: z.array(StaffSeparationEntrySchema).optional(),
  lastWageSettlement: StaffWageSettlementSchema.optional(),
  totals: z
    .object({
      hired: z.number().int().min(0),
      separated: z.number().int().min(0),
      resigned: z.number().int().min(0),
      dismissed: z.number().int().min(0),
      promotions: z.number().int().min(0),
      raises: z.number().int().min(0),
      trainingSessions: z.number().int().min(0),
      skillPointsGained: z.number().int().min(0),
      absenceDays: z.number().int().min(0),
      coverageGapDays: z.number().int().min(0),
      overtimeDays: z.number().int().min(0),
      wagesPaid: z.number().min(0),
      wageShortfall: z.number().min(0),
      quitRisksWarned: z.number().int().min(0),
      quitRisksAverted: z.number().int().min(0),
      quitRisksHonoured: z.number().int().min(0),
      relationshipsFormed: z.number().int().min(0),
    })
    .optional(),
})
