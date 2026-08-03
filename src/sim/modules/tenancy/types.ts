import { z } from 'zod'

import {
  ContractRecordBaseSchema,
  type TenancyRecord,
} from '../../contracts/obligations/index'

// Expansion Phase 7 §7.2 — landlord and tenancy.
//
// WHAT WAS THERE BEFORE. `modules.monthly.rent` was four numbers
// (`monthlyAmount`, `paidThisMonth`, `missedPayments`, `arrears`) settled
// once a month by `resolveRent`, and `modules.monthly.landlord` was an
// opinion meter that drifted toward 50. A missed month raised landlord
// pressure and wrote a memory; `eviction_threat_possible` was a string a
// response could queue that drained into nothing. There was no notice, no
// cure amount, no deadline, no proceeding, and no way for the tavern to
// actually lose the building. That is the eviction half of `OBL-02` and the
// tenancy half of `DEP-07`.
//
// OWNERSHIP (§5.4). The tenancy module owns the AGREEMENT and the
// ESCALATION LADDER: the rent schedule, the landlord's concern and beliefs,
// notices and their cure conditions, access requests, repairs, negotiated
// terms and payment plans, and the eviction proceeding at the end of it. It
// does NOT own the money falling due — each rent period is an
// `ObligationRecord` in the shared ledger, so it inherits the same due →
// grace → default → collections timekeeping a loan instalment or a supplier
// invoice gets, and lands on the §7.4 calendar without a second book.
//
// `modules.monthly.rent` survives as a PROJECTION written by this module,
// so the pressure calculators, the `debt_rent` card and the monthly report
// keep reading the field they always read — and cannot disagree with the
// tenancy record, because they are no longer a second copy of it.

export const TENANCY_MODULE_ID = 'tenancy'

/** The one landlord the tavern rents from. */
export const LANDLORD_ID = 'landlord'
export const LANDLORD_LABEL = 'The Landlord'

/**
 * Expansion Phase 7 §7.2 — the effect target a response uses to pay rent.
 *
 * `monthly.rent.payment` (Phase 200) keeps its id and its meaning; this
 * module now answers it. Declared here so the response appliers can route
 * to tenancy without importing the monthly module's implementation.
 */
export const RENT_PAYMENT_TARGET = 'monthly.rent.payment'

/**
 * The escalation ladder, in order.
 *
 * Each rung names what the tavern can still do about it — that is the §7.2
 * requirement that "an eviction warning must identify what can prevent or
 * delay it", expressed as state rather than as prose in a card.
 */
export type TenancyNoticeKind =
  /** "You are behind." Courtesy, no deadline yet. */
  | 'reminder'
  /** A dated demand. Cure by the deadline or it escalates. */
  | 'formal_notice'
  /** The last one before proceedings. */
  | 'final_notice'
  /** The landlord has begun the proceeding. A hearing day is set. */
  | 'eviction_filed'
  /** The proceeding concluded against the tavern. */
  | 'eviction_granted'

export const NOTICE_LADDER: ReadonlyArray<TenancyNoticeKind> = [
  'reminder',
  'formal_notice',
  'final_notice',
  'eviction_filed',
  'eviction_granted',
] as const

export function noticeRung(kind: TenancyNoticeKind): number {
  return NOTICE_LADDER.indexOf(kind)
}

export type TenancyNoticeStatus = 'live' | 'cured' | 'escalated' | 'withdrawn' | 'expired'

export type TenancyNotice = {
  id: string
  kind: TenancyNoticeKind
  issuedOnDay: number
  /** The day the notice bites if nothing changes. */
  deadlineDay: number
  /** Coin that would clear this notice on the day it was issued. */
  cureAmount: number
  status: TenancyNoticeStatus
  resolvedOnDay?: number | undefined
  /** What the landlord says. */
  readable: string
  /**
   * The routes out, in player-facing words. Named on the record rather than
   * assembled by a card, because §5 fails a phase where "a card promises a
   * consequence owned by no domain".
   */
  remedies: string[]
  tags: string[]
}

export const MAX_TENANCY_NOTICES = 12

/**
 * A repair the landlord is responsible for.
 *
 * §7.2 asks for "repair responsibilities where appropriate". The split is
 * the building itself (structure — the landlord's) versus what the tavern
 * does to it (wear, filth, damage from brawls — the tenant's), which is
 * both the real-world rule and a decision the player can act on: reporting
 * a structural fault is free and slow, fixing it yourself is fast and dear.
 */
export type LandlordRepairRequest = {
  id: string
  areaId: string
  raisedOnDay: number
  /** Condition the area was in when the request was raised. */
  conditionAtRequest: number
  status: 'requested' | 'scheduled' | 'completed' | 'refused'
  /** Day the landlord's tradesmen are expected. */
  scheduledForDay?: number | undefined
  resolvedOnDay?: number | undefined
  readable: string
}

export const MAX_REPAIR_REQUESTS = 8

/** A concession the landlord granted, and the day it lapses. */
export type TenancyConcession = {
  kind: 'deferral' | 'reduction' | 'payment_plan'
  grantedOnDay: number
  expiresOnDay: number
  /** Multiplier on the rent for the concession's life. 1 = unchanged. */
  rentFactor: number
  /** Days the next period's due day is pushed out. */
  deferralDays: number
  readable: string
}

/**
 * What the landlord thinks, and why.
 *
 * `concern` is the landlord's own escalation appetite and is what the
 * notice ladder reads — deliberately NOT `pressure:landlord`, which stays a
 * forecast the player can read. `beliefs` are the specific things the
 * landlord holds against (or in favour of) the tavern, so a notice can say
 * what it is actually about.
 */
export type LandlordState = {
  /** 0–100. What the landlord thinks of the tavern as a tenant. */
  opinion: number
  /** 0–100. How close the landlord is to acting. */
  concern: number
  beliefs: Array<{
    id: string
    readable: string
    /** -100..100. Negative counts against the tavern. */
    weight: number
    lastSeenOnDay: number
  }>
  /** Day the landlord last visited or wrote. */
  lastContactDay: number
  /**
   * An outstanding request to come and walk the building.
   *
   * §7.2 asks for "inspection/access requests" as a modelled thing rather
   * than flavour, and this is what makes answering one a decision: it has a
   * deadline, ignoring it counts as a refusal, and the landlord's opinion —
   * which every negotiation and the whole notice ladder read — moves either
   * way. At most one is live at a time.
   */
  accessRequest?:
    | {
        raisedOnDay: number
        deadlineDay: number
        reason: string
      }
    | undefined
  /** Access requests the tavern has refused. The landlord remembers. */
  accessRefusals: number
  accessGrants: number
  negotiationsUsed: number
}

export const MAX_LANDLORD_BELIEFS = 10
export const MAX_NEGOTIATIONS = 3

export type TenancyStatus =
  | 'current'
  | 'in_arrears'
  | 'under_notice'
  | 'eviction_proceeding'
  | 'evicted'
  | 'terminated'

/**
 * The tenancy agreement.
 *
 * Extends the shared `TenancyRecord` (family `tenancy`) so `status`,
 * `history` and `escalation` mean the same thing they mean on a loan.
 */
export type TavernTenancyRecord = TenancyRecord & {
  landlordId: string
  tenancyStatus: TenancyStatus
  /** Absolute day the current rent period ends and rent falls due. */
  periodEndsOnDay: number
  /** Period index, from 0. */
  periodIndex: number
  /** Ledger obligation for the current period, once it has been raised. */
  currentObligationId?: string | undefined
  /**
   * The last period index that has been billed.
   *
   * Without it, `ensurePeriodObligation` — which is idempotent by checking
   * whether a live obligation exists — would re-bill the moment one stopped
   * existing, and an obligation stops existing the moment it is PAID. A
   * player who cleared the rent early would be charged again the next
   * morning. `-1` means nothing has been billed yet.
   */
  lastBilledPeriodIndex: number
  /** Ledger obligations for unpaid past periods, oldest first. */
  arrearObligationIds: string[]
  /** Rent the tavern has actually paid, lifetime. */
  totalPaid: number
  /** Periods paid in full and on time. */
  periodsPaidOnTime: number
  concession?: TenancyConcession | undefined
  /** True once the landlord has been paid at least one period in full. */
  everPaid: boolean
}

export type TenancyTotals = {
  periodsBilled: number
  periodsPaid: number
  periodsMissed: number
  noticesIssued: number
  noticesCured: number
  evictionsFiled: number
  evictionsGranted: number
  rentPaid: number
  concessionsGranted: number
  repairsRequested: number
  repairsCompleted: number
}

export type TenancyModuleState = {
  /** The one live tenancy. Absent only before the module's first day. */
  tenancy?: TavernTenancyRecord
  landlord: LandlordState
  /** Live and recently resolved notices, oldest first. Bounded. */
  notices: TenancyNotice[]
  repairs: LandlordRepairRequest[]
  nextNoticeSuffix: number
  nextRepairSuffix: number
  totals: TenancyTotals
}

// ---------- Derived reads ----------

export function liveNotice(state: TenancyModuleState): TenancyNotice | undefined {
  // Highest live rung wins: a final notice supersedes the reminder that
  // preceded it, and the player needs to see the one that bites.
  return [...state.notices]
    .filter((notice) => notice.status === 'live')
    .sort((a, b) => noticeRung(b.kind) - noticeRung(a.kind))[0]
}

// ---------- Schemas (§5.7) ----------

export const TenancyNoticeSchema = z.object({
  id: z.string(),
  kind: z.enum([
    'reminder',
    'formal_notice',
    'final_notice',
    'eviction_filed',
    'eviction_granted',
  ]),
  issuedOnDay: z.number().int(),
  deadlineDay: z.number().int(),
  cureAmount: z.number().min(0),
  status: z.enum(['live', 'cured', 'escalated', 'withdrawn', 'expired']),
  resolvedOnDay: z.number().int().optional(),
  readable: z.string(),
  remedies: z.array(z.string()),
  tags: z.array(z.string()),
})

export const LandlordRepairRequestSchema = z.object({
  id: z.string(),
  areaId: z.string(),
  raisedOnDay: z.number().int(),
  conditionAtRequest: z.number(),
  status: z.enum(['requested', 'scheduled', 'completed', 'refused']),
  scheduledForDay: z.number().int().optional(),
  resolvedOnDay: z.number().int().optional(),
  readable: z.string(),
})

export const TenancyConcessionSchema = z.object({
  kind: z.enum(['deferral', 'reduction', 'payment_plan']),
  grantedOnDay: z.number().int(),
  expiresOnDay: z.number().int(),
  rentFactor: z.number().min(0),
  deferralDays: z.number().int().min(0),
  readable: z.string(),
})

export const LandlordStateSchema = z.object({
  opinion: z.number().min(0).max(100),
  concern: z.number().min(0).max(100),
  beliefs: z.array(
    z.object({
      id: z.string(),
      readable: z.string(),
      weight: z.number(),
      lastSeenOnDay: z.number().int(),
    }),
  ),
  lastContactDay: z.number().int(),
  accessRequest: z
    .object({
      raisedOnDay: z.number().int(),
      deadlineDay: z.number().int(),
      reason: z.string(),
    })
    .optional(),
  accessRefusals: z.number().int().min(0),
  accessGrants: z.number().int().min(0),
  negotiationsUsed: z.number().int().min(0),
})

export const TavernTenancyRecordSchema = ContractRecordBaseSchema.extend({
  family: z.literal('tenancy'),
  rentPerPeriod: z.number().min(0),
  periodDays: z.number().int().min(1),
  missedPeriods: z.number().int().min(0),
  landlordId: z.string(),
  tenancyStatus: z.enum([
    'current',
    'in_arrears',
    'under_notice',
    'eviction_proceeding',
    'evicted',
    'terminated',
  ]),
  periodEndsOnDay: z.number().int(),
  periodIndex: z.number().int().min(0),
  currentObligationId: z.string().optional(),
  lastBilledPeriodIndex: z.number().int().min(-1),
  arrearObligationIds: z.array(z.string()),
  totalPaid: z.number().min(0),
  periodsPaidOnTime: z.number().int().min(0),
  concession: TenancyConcessionSchema.optional(),
  everPaid: z.boolean(),
})

export const TenancyModuleStateSchema = z.object({
  tenancy: TavernTenancyRecordSchema.optional(),
  landlord: LandlordStateSchema,
  notices: z.array(TenancyNoticeSchema),
  repairs: z.array(LandlordRepairRequestSchema),
  nextNoticeSuffix: z.number().int().min(0),
  nextRepairSuffix: z.number().int().min(0),
  totals: z.object({
    periodsBilled: z.number().int().min(0),
    periodsPaid: z.number().int().min(0),
    periodsMissed: z.number().int().min(0),
    noticesIssued: z.number().int().min(0),
    noticesCured: z.number().int().min(0),
    evictionsFiled: z.number().int().min(0),
    evictionsGranted: z.number().int().min(0),
    rentPaid: z.number().min(0),
    concessionsGranted: z.number().int().min(0),
    repairsRequested: z.number().int().min(0),
    repairsCompleted: z.number().int().min(0),
  }),
})
