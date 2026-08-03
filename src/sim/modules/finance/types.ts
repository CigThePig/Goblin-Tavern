import { z } from 'zod'

import {
  ContractRecordBaseSchema,
  type ContractRecordBase,
} from '../../contracts/obligations/index'

// Expansion Phase 7 §7.1 — loans.
//
// WHAT WAS THERE BEFORE. Nothing. `loan_due_soon` was a string a response
// profile queued after handing the player 40 coin; the responses module
// drained it on its scheduled day and wrote a memory. There was no lender,
// no principal, no schedule, and nothing to repay — the coin was a gift
// with a rumour attached. That is the loan half of `OBL-02` and the loan
// half of `DEP-07`.
//
// OWNERSHIP (§5.4). The finance module owns the AGREEMENT: who lent, how
// much, at what fee, on what schedule, and every transition the agreement
// can make (disbursement, renegotiation, delinquency, default, collections,
// settlement). It does NOT own the money falling due — each instalment is
// an `ObligationRecord` in the shared ledger, which is what gives it the
// same due → grace → default → collections timekeeping a supplier invoice
// or a rent period gets, and what puts it on the §7.4 obligation calendar
// without a second bookkeeping map.
//
// The split is the point: a loan with no live instalment obligation is a
// bug the validator can name, and an instalment obligation with no owning
// loan is a promise nobody made.

export const FINANCE_MODULE_ID = 'finance'

/**
 * Expansion Phase 7 §7.1 — the effect target a response uses to BORROW.
 *
 * The `debt_rent` card's borrow choice used to be `state_change: coin +40`
 * with a `loan_due_soon` future hook stapled on: forty coin from nowhere,
 * and a promise no domain could keep. Routing it through a named target
 * instead — the same shape `monthly.rent.payment` uses for paying — is what
 * makes the coin an actual disbursement against an actual agreement, so the
 * hook it schedules has a real loan to resolve against.
 *
 * It lives in this dependency-light module (not in `loans.ts`) so the card
 * layer's target classification can import it without pulling the finance
 * implementation into the issue generators.
 */
export const LOAN_BORROW_EFFECT_TARGET = 'finance.loan.borrow'

export type LoanStatus =
  /** Agreed and disbursed; instalments are being paid on schedule. */
  | 'active'
  /** An instalment is past its grace window. Recoverable by paying. */
  | 'delinquent'
  /** Too many missed instalments. The lender has stopped waiting. */
  | 'defaulted'
  /** The lender is actively taking what it is owed. */
  | 'in_collections'
  /** Repaid in full — on schedule, early, or by settlement. */
  | 'settled'
  /** Written off by the lender. The player did not repay it. */
  | 'forgiven'

export const TERMINAL_LOAN_STATUSES: ReadonlyArray<LoanStatus> = [
  'settled',
  'forgiven',
] as const

export function isTerminalLoanStatus(status: LoanStatus): boolean {
  return TERMINAL_LOAN_STATUSES.includes(status)
}

/**
 * One instalment on the schedule.
 *
 * `obligationId` is set when the instalment becomes CURRENT — the loan
 * opens one ledger obligation at a time rather than all of them at once,
 * so a six-instalment loan does not put six rows on the calendar for a
 * day the player cannot act on yet, and renegotiation can rewrite the
 * unopened tail without cancelling promises already made.
 */
export type LoanInstalment = {
  index: number
  dueOnDay: number
  amount: number
  /** The shared-ledger obligation, once this instalment has been opened. */
  obligationId?: string | undefined
  /** Coin actually applied to this instalment. */
  paid: number
  status: 'scheduled' | 'open' | 'paid' | 'missed' | 'rescheduled'
}

/** §5.11 — an instalment schedule cannot grow without bound. */
export const MAX_LOAN_INSTALMENTS = 12

/**
 * A borrowing agreement.
 *
 * Extends the shared `ContractRecordBase` (family `loan`) so `status`,
 * `history`, `escalation` and `readable` mean on a loan exactly what they
 * mean on an invoice or a tenancy. The loan-specific half is the TERMS:
 * they are snapshotted at disbursement and never re-read, for the same
 * reason a purchase order snapshots its quote — terms that moved under the
 * player after they agreed to them are the broken promise this arc removes.
 */
export type LoanRecord = ContractRecordBase & {
  family: 'loan'
  lenderId: string
  lenderLabel: string
  /** Coin the lender handed over. */
  principal: number
  /** The day the coin actually arrived. */
  disbursedOnDay: number
  /**
   * The lender's charge, as a flat fee on the principal captured at
   * disbursement. A fee rather than compounding interest, for the same
   * reason `accrueLateCharge` does not compound: an exponential debt in a
   * game about a failing tavern is an unrecoverable spiral.
   */
  feeRate: number
  fee: number
  /** Principal + fee + any renegotiation charges. What must come back. */
  totalRepayable: number
  /** Coin applied so far, across every instalment. */
  repaid: number
  loanStatus: LoanStatus
  periodDays: number
  instalments: LoanInstalment[]
  /** Grace days each instalment obligation inherits, from the ruleset at open time. */
  graceDays: number
  lateChargeRate: number
  /** How many instalments went past grace unpaid. */
  missedInstalments: number
  /** How many times the schedule has been rewritten. Bounded — see `MAX_RENEGOTIATIONS`. */
  renegotiations: number
  /** Coin the lender has taken directly during collections. */
  collectedByLender: number
  purpose: string
}

export const MAX_RENEGOTIATIONS = 2

/**
 * What one lender thinks of the tavern, and what they will lend it next.
 *
 * Bounded by construction: one entry per lender in the lender registry,
 * and `pruneLenderAccounts` drops entries whose lender is gone.
 */
export type LenderAccountState = {
  lenderId: string
  /** 0–100. Rises with repaid loans, falls with misses and defaults. */
  standing: number
  loansTaken: number
  loansSettled: number
  loansDefaulted: number
  /** The lender will not lend again before this day. */
  refusingUntilDay?: number | undefined
  refusingReason?: string | undefined
  lastDecisionDay: number
  lastDecisionReason: string
}

export type FinanceTotals = {
  loansTaken: number
  principalBorrowed: number
  feesCharged: number
  repaid: number
  loansSettled: number
  loansDefaulted: number
  collectionsSeized: number
  renegotiations: number
}

/** §5.11 bounded growth for the two persistent collections. */
export const MAX_OPEN_LOANS = 6
export const MAX_ARCHIVED_LOANS = 24

export type FinanceModuleState = {
  /** Live agreements, keyed by id. */
  loans: Record<string, LoanRecord>
  /** Terminal agreements, oldest first. Bounded archive. */
  loanArchive: LoanRecord[]
  /** Per-lender standing and refusal window. */
  lenders: Record<string, LenderAccountState>
  nextLoanSuffix: number
  totals: FinanceTotals
}

// ---------- Derived reads ----------

export function loanOutstanding(loan: LoanRecord): number {
  return Math.max(0, loan.totalRepayable - loan.repaid)
}

export function nextInstalment(loan: LoanRecord): LoanInstalment | undefined {
  return loan.instalments.find(
    (instalment) => instalment.status === 'open' || instalment.status === 'scheduled',
  )
}

export function isLoanOpen(loan: LoanRecord): boolean {
  return !isTerminalLoanStatus(loan.loanStatus)
}

// ---------- Schemas (§5.7) ----------

export const LoanInstalmentSchema = z.object({
  index: z.number().int().min(0),
  dueOnDay: z.number().int(),
  amount: z.number().min(0),
  obligationId: z.string().optional(),
  paid: z.number().min(0),
  status: z.enum(['scheduled', 'open', 'paid', 'missed', 'rescheduled']),
})

export const LoanRecordSchema = ContractRecordBaseSchema.extend({
  family: z.literal('loan'),
  lenderId: z.string(),
  lenderLabel: z.string(),
  principal: z.number().min(0),
  disbursedOnDay: z.number().int(),
  feeRate: z.number().min(0),
  fee: z.number().min(0),
  totalRepayable: z.number().min(0),
  repaid: z.number().min(0),
  loanStatus: z.enum([
    'active',
    'delinquent',
    'defaulted',
    'in_collections',
    'settled',
    'forgiven',
  ]),
  periodDays: z.number().int().min(1),
  instalments: z.array(LoanInstalmentSchema),
  graceDays: z.number().int().min(0),
  lateChargeRate: z.number().min(0),
  missedInstalments: z.number().int().min(0),
  renegotiations: z.number().int().min(0),
  collectedByLender: z.number().min(0),
  purpose: z.string(),
})

export const LenderAccountStateSchema = z.object({
  lenderId: z.string(),
  standing: z.number().min(0).max(100),
  loansTaken: z.number().int().min(0),
  loansSettled: z.number().int().min(0),
  loansDefaulted: z.number().int().min(0),
  refusingUntilDay: z.number().int().optional(),
  refusingReason: z.string().optional(),
  lastDecisionDay: z.number().int(),
  lastDecisionReason: z.string(),
})

export const FinanceModuleStateSchema = z.object({
  loans: z.record(z.string(), LoanRecordSchema),
  loanArchive: z.array(LoanRecordSchema),
  lenders: z.record(z.string(), LenderAccountStateSchema),
  nextLoanSuffix: z.number().int().min(0),
  totals: z.object({
    loansTaken: z.number().int().min(0),
    principalBorrowed: z.number().min(0),
    feesCharged: z.number().min(0),
    repaid: z.number().min(0),
    loansSettled: z.number().int().min(0),
    loansDefaulted: z.number().int().min(0),
    collectionsSeized: z.number().min(0),
    renegotiations: z.number().int().min(0),
  }),
})
