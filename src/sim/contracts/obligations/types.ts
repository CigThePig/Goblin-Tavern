import { z } from 'zod'

import type { EntityRef } from '../../state/TavernState'

// Expansion Phase 1 §1.2 — shared obligation and contract records.
//
// Six unrelated systems are about to need the same lifecycle: supplier
// invoices (Phase 6), loans and rent (Phase 7), employment terms and
// notice periods (Phase 3), regulatory cases and inspection visits
// (Phase 7), tenancy escalation (Phase 7), and construction commitments
// (Phase 2). Each of them has a counterparty, a day it comes due, a grace
// period, and a set of ways it can end — settled, defaulted, forgiven,
// escalated, abandoned.
//
// The plan is explicit that this must NOT become one giant obligations
// module: "Suppliers own invoices, staff own employment, monthly/regulatory
// systems own inspections, and landlord/finance systems own tenancy and
// loans." So what lives here is the shared VOCABULARY and the shared
// TRANSITIONS — the record shapes, the status machine, and the pure
// functions that move a record through it. Each domain keeps its own
// records in its own slice and registers that slice as a ledger
// (`ledgerRegistry.ts`) so the shared due-date machinery can find them.
//
// The pay-off is that "this obligation came due and nothing happened" stops
// being possible per-domain: the due-date event is owned once, here, and
// every domain inherits it.

export type ContractFamily =
  /** A sum owed in one direction or the other. Invoices, rent periods, fines, tabs. */
  | 'obligation'
  /**
   * A borrowing agreement with a lender: principal, fee, and a schedule of
   * instalments. Expansion Phase 7 owns it.
   *
   * Distinct from `obligation` because a loan is not a single sum falling
   * due — it is the agreement that *produces* those sums. Each instalment
   * IS an `obligation` in the shared ledger, so the loan keeps the terms
   * and the schedule while the ledger keeps the timekeeping.
   */
  | 'loan'
  /** A promise of goods on a day. Purchase orders, standing orders, deliveries. */
  | 'order'
  /** Employment terms and the notice/separation clock. */
  | 'employment'
  /** A regulatory case with scheduled visits and findings. */
  | 'regulatory'
  /** Tenancy and its escalation ladder. */
  | 'tenancy'
  /** A build commitment with milestones. */
  | 'construction'

/**
 * The shared status machine.
 *
 * `grace` is a first-class status rather than a flag because the
 * difference between "late" and "defaulted" is the single most important
 * thing a player needs to be able to see and act on, and a boolean hides
 * it. `in_collections` is likewise distinct from `defaulted`: default is a
 * fact about the record, collections is an active process against the
 * player.
 */
export type ContractStatus =
  /** Agreed but not yet in force (a delivery promised for next week). */
  | 'pending'
  | 'active'
  /** Past its due day, inside the ruleset's grace window. */
  | 'grace'
  | 'defaulted'
  | 'in_collections'
  /** Discharged in full — paid, delivered, served out, completed. */
  | 'settled'
  /** Written off by the counterparty. Distinct from settled: the player did not pay. */
  | 'forgiven'
  /** Withdrawn before it took effect. */
  | 'cancelled'
  /** Ran out of time without resolving. */
  | 'expired'

export const TERMINAL_CONTRACT_STATUSES: ReadonlyArray<ContractStatus> = [
  'settled',
  'forgiven',
  'cancelled',
  'expired',
] as const

export function isTerminalContractStatus(status: ContractStatus): boolean {
  return TERMINAL_CONTRACT_STATUSES.includes(status)
}

/** One recorded step in a record's life. Bounded — see `MAX_CONTRACT_TRANSITIONS`. */
export type ContractTransition = {
  onDay: number
  from: ContractStatus
  to: ContractStatus
  /** Why. Never optional: an unexplained transition is the bug this phase exists to prevent. */
  reason: string
  /** Coin (or units) that moved with this transition, when any did. */
  amount?: number
}

export const MAX_CONTRACT_TRANSITIONS = 24

/**
 * What every contract family shares. Domains extend this rather than
 * redefining it, so `status`, `dueOnDay` and `history` mean the same thing
 * whether you are looking at a loan or an inspection case.
 */
export type ContractRecordBase = {
  id: string
  family: ContractFamily
  /** The module that owns this record's transitions (§5.4). */
  ownerModuleId: string
  /** Who it is with. A supplier, a landlord, the town watch, a staff member. */
  counterparty: EntityRef
  status: ContractStatus
  openedOnDay: number
  /** The day it comes due. Absent for open-ended records (an employment term). */
  dueOnDay?: number
  /** Days of grace after `dueOnDay` before default. Set from the ruleset at open time. */
  graceDays: number
  closedOnDay?: number
  lastTransitionOnDay: number
  history: ContractTransition[]
  /** Escalation rung. 0 = none. Collections, eviction, and regulatory ladders all use it. */
  escalation: number
  /** Player-readable one-liner. What the report and any future card shows. */
  readable: string
  tags: string[]
}

/**
 * A sum owed. `direction` is from the PLAYER's point of view: `payable`
 * is money the player owes, `receivable` is money owed to the player
 * (a patron's tab, a promised commission).
 */
export type ObligationRecord = ContractRecordBase & {
  family: 'obligation'
  direction: 'payable' | 'receivable'
  /** The original sum. Never mutated — payments accumulate separately. */
  principal: number
  /** Paid so far. Partial payment is the normal case, not an edge case. */
  paid: number
  /** Late charges accrued since grace ran out. */
  accruedCharges: number
  /** Written off by the counterparty. */
  forgiven: number
  /** Per-overdue-day charge rate, captured from the ruleset at open time. */
  lateChargeRate: number
}

/** A promise of goods on a day. Phase 6 owns the supplier half. */
export type OrderRecord = ContractRecordBase & {
  family: 'order'
  lines: Array<{ stockId: string; quantity: number; unitPrice: number }>
  /** Delivered so far, per stock id. Partial delivery is normal. */
  delivered: Record<string, number>
  promisedOnDay: number
}

/** Employment terms and the separation clock. Phase 3 owns this. */
export type EmploymentRecord = ContractRecordBase & {
  family: 'employment'
  staffId: string
  wagePerDay: number
  /** Days of notice either side owes. Drives the separation event. */
  noticeDays: number
  /** Set when notice has been given, by whom, and on what day. */
  notice?: { givenBy: 'owner' | 'staff'; givenOnDay: number; reason: string }
  /**
   * Expansion Phase 3 — the day the wage last went UP, and only up.
   *
   * A promise about a rise can only be judged against what the wage was when the
   * promise was made, and `wagePerDay` cannot answer that: granting the rise
   * moves it, so a resolver comparing the two would find them equal and call a
   * kept promise broken. This records the event instead of the level. Absent
   * means no rise has ever been given, which is the honest reading for a record
   * that predates the field.
   */
  lastRaiseOnDay?: number
  /**
   * Expansion Phase 3 — days of unexcused absence inside the remembered window,
   * and the day the last one started.
   *
   * Abandonment used to read one absence's length, and nothing in the game
   * produces a long unexcused absence, so the rule could not fire. These two
   * carry the run across separate no-shows. Absent means none, which is the
   * honest reading for a record that predates the field.
   */
  unexcusedDays?: number
  lastUnexcusedOnDay?: number
}

/** A regulatory case with scheduled visits. Phase 7 owns this. */
export type RegulatoryRecord = ContractRecordBase & {
  family: 'regulatory'
  caseType: string
  /** Absolute days of scheduled visits, in order. */
  scheduledVisitDays: number[]
  visitsCompleted: number
  findings: Array<{ onDay: number; code: string; readable: string; severity: number }>
}

/** Tenancy and its escalation ladder. Phase 7 owns this. */
export type TenancyRecord = ContractRecordBase & {
  family: 'tenancy'
  rentPerPeriod: number
  periodDays: number
  missedPeriods: number
}

/** A build commitment with milestones. Phase 2 owns this. */
export type ConstructionRecord = ContractRecordBase & {
  family: 'construction'
  projectId: string
  targetRef: EntityRef
  milestones: Array<{
    id: string
    label: string
    requiredProgress: number
    completedOnDay?: number
  }>
  progress: number
}

export type AnyContractRecord =
  | ObligationRecord
  | OrderRecord
  | EmploymentRecord
  | RegulatoryRecord
  | TenancyRecord
  | ConstructionRecord

// ---------- Derived reads ----------

/** What is still owed: principal plus charges, less anything paid or forgiven. */
export function outstandingAmount(record: ObligationRecord): number {
  return Math.max(
    0,
    record.principal + record.accruedCharges - record.paid - record.forgiven,
  )
}

export function isSettled(record: ObligationRecord): boolean {
  return outstandingAmount(record) <= 0
}

// ---------- Schemas (§5.7) ----------

const EntityRefSchema = z.object({ kind: z.string(), id: z.string() })

export const ContractStatusSchema = z.enum([
  'pending',
  'active',
  'grace',
  'defaulted',
  'in_collections',
  'settled',
  'forgiven',
  'cancelled',
  'expired',
])

export const ContractTransitionSchema = z.object({
  onDay: z.number().int(),
  from: ContractStatusSchema,
  to: ContractStatusSchema,
  reason: z.string(),
  amount: z.number().optional(),
})

export const ContractRecordBaseSchema = z.object({
  id: z.string(),
  family: z.enum([
    'obligation',
    'loan',
    'order',
    'employment',
    'regulatory',
    'tenancy',
    'construction',
  ]),
  ownerModuleId: z.string(),
  counterparty: EntityRefSchema,
  status: ContractStatusSchema,
  openedOnDay: z.number().int(),
  dueOnDay: z.number().int().optional(),
  graceDays: z.number().int().min(0),
  closedOnDay: z.number().int().optional(),
  lastTransitionOnDay: z.number().int(),
  history: z.array(ContractTransitionSchema),
  escalation: z.number().int().min(0),
  readable: z.string(),
  tags: z.array(z.string()),
})

export const ObligationRecordSchema = ContractRecordBaseSchema.extend({
  family: z.literal('obligation'),
  direction: z.enum(['payable', 'receivable']),
  principal: z.number().min(0),
  paid: z.number().min(0),
  accruedCharges: z.number().min(0),
  forgiven: z.number().min(0),
  lateChargeRate: z.number().min(0),
})
