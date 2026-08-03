import type { SimContext } from '../../core/context'
import type { EntityRef, TavernState } from '../../state/TavernState'
import { getRule } from '../../contracts/ruleset/index'
import {
  getObligation,
  nextObligationId,
  openObligation,
  forgiveObligation,
  outstandingAmount,
  payObligation,
  recordObligationPayment,
  scheduleObligationDueDate,
  settleObligation,
  transitionContract,
  upsertObligation,
  type ContractStatus,
  type ObligationRecord,
} from '../../contracts/obligations/index'
import {
  getLenderDefinition,
  listLenders,
  type LenderDefinition,
} from '../../content/finance/lenderRegistry'
import { addCoin, spendCoin } from '../stock/ledger'

import {
  bumpFinanceTotals,
  createLenderAccount,
  getFinanceModuleState,
  getLenderAccount,
  getLoan,
  listLoans,
  nextLoanId,
  upsertLoan,
  writeLenderAccount,
} from './state'
import {
  FINANCE_MODULE_ID,
  MAX_LOAN_INSTALMENTS,
  MAX_OPEN_LOANS,
  MAX_RENEGOTIATIONS,
  loanOutstanding,
  nextInstalment,
  type LoanInstalment,
  type LoanRecord,
} from './types'

// Expansion Phase 7 §7.1 — the loan lifecycle, end to end.
//
// Every transition a loan can make lives here and nowhere else (§5.4). The
// scheduled events in `financeEvents.ts` and the owner actions in
// `actions.ts` are both thin: they decide WHEN and WHETHER, and call one of
// these functions to decide WHAT. That is what keeps a loan repaid from the
// morning card and a loan repaid from the action picker the same transition.

const SOURCE = FINANCE_MODULE_ID

export function lenderRef(lenderId: string): EntityRef {
  // `other` rather than a new EntityRef kind: a lender is a counterparty the
  // reference validator has no collection to check against, which is exactly
  // what `other` is for. Prefixing the id keeps it unambiguous in a report.
  return { kind: 'other', id: `lender:${lenderId}` }
}

// ---------- Quoting ----------

export type LoanQuote = {
  lenderId: string
  lenderLabel: string
  principal: number
  feeRate: number
  fee: number
  totalRepayable: number
  instalmentCount: number
  instalmentAmount: number
  periodDays: number
  firstDueOnDay: number
  finalDueOnDay: number
  graceDays: number
  /** Present when the lender will not deal today. Names what would change it. */
  refusal?: { code: string; reason: string }
  readable: string
}

/**
 * What one lender would advance today, on what terms.
 *
 * PURE, and the single source of the numbers: the picker hint, the action's
 * validation, and the disbursement all read this one function, so what the
 * player is shown and what they are charged cannot drift apart.
 *
 * Standing moves the fee as well as the answer. A tavern the lender trusts
 * borrows more cheaply, which is the mechanism that makes repaying a loan
 * worth something beyond making the debt stop.
 */
export function quoteLoan(
  state: TavernState,
  input: { lenderId: string; principal?: number },
): LoanQuote {
  const today = state.calendar.totalDaysElapsed
  const def = getLenderDefinition(input.lenderId)
  if (!def) {
    return {
      lenderId: input.lenderId,
      lenderLabel: input.lenderId,
      principal: 0,
      feeRate: 0,
      fee: 0,
      totalRepayable: 0,
      instalmentCount: 0,
      instalmentAmount: 0,
      periodDays: 7,
      firstDueOnDay: today,
      finalDueOnDay: today,
      graceDays: 0,
      refusal: {
        code: 'unknown_lender',
        reason: `No lender '${input.lenderId}' operates here.`,
      },
      readable: `Unknown lender '${input.lenderId}'.`,
    }
  }

  const account =
    getLenderAccount(state, def.id) ?? createLenderAccount(def.id, today)
  const graceDays = getRule(state, 'obligationGraceDays')

  // Standing widens or narrows the line by ±40% around the definition's
  // ceiling, so a trusted borrower has a materially different option set.
  const standingFactor = 0.6 + (account.standing / 100) * 0.8
  const ceiling = Math.max(
    def.minPrincipal,
    Math.round(def.maxPrincipal * standingFactor),
  )
  const requested = Math.round(input.principal ?? Math.min(120, ceiling))
  const principal = Math.max(def.minPrincipal, Math.min(requested, ceiling))

  // Poor standing is dearer. Half the definition's fee rate again at zero
  // standing, and a tenth off at full standing.
  const feeRate = round2(def.feeRate * (1.5 - (account.standing / 100) * 0.6))
  const fee = Math.round(principal * feeRate)
  const totalRepayable = principal + fee
  const instalmentCount = Math.min(def.instalmentCount, MAX_LOAN_INSTALMENTS)
  const instalmentAmount = Math.ceil(totalRepayable / instalmentCount)
  const firstDueOnDay = today + def.periodDays
  const finalDueOnDay = today + def.periodDays * instalmentCount

  const refusal = loanRefusal(state, def, account, principal, requested, ceiling)

  return {
    lenderId: def.id,
    lenderLabel: def.label,
    principal,
    feeRate,
    fee,
    totalRepayable,
    instalmentCount,
    instalmentAmount,
    periodDays: def.periodDays,
    firstDueOnDay,
    finalDueOnDay,
    graceDays,
    ...(refusal ? { refusal } : {}),
    readable:
      `${def.label}: ${principal} coin now, ${totalRepayable} back over ` +
      `${instalmentCount} payments of ${instalmentAmount} every ${def.periodDays} days ` +
      `(fee ${fee}, first due day ${firstDueOnDay}, ${graceDays} days grace).`,
  }
}

function loanRefusal(
  state: TavernState,
  def: LenderDefinition,
  account: ReturnType<typeof createLenderAccount>,
  principal: number,
  requested: number,
  ceiling: number,
): { code: string; reason: string } | undefined {
  const today = state.calendar.totalDaysElapsed
  if (account.refusingUntilDay !== undefined && account.refusingUntilDay > today) {
    return {
      code: 'lender_refusing',
      reason: `${def.label} will not deal until day ${account.refusingUntilDay}${
        account.refusingReason ? ` (${account.refusingReason})` : ''
      }.`,
    }
  }
  if (account.standing < def.standingRequired) {
    return {
      code: 'standing_too_low',
      reason: `${def.label} lends at standing ${def.standingRequired}; yours is ${account.standing}. Repay what you owe to raise it.`,
    }
  }
  // One live loan per lender. Two concurrent schedules with the same
  // counterparty is bookkeeping, not a decision.
  const live = listLoans(state, { lenderId: def.id })
  if (live.length > 0) {
    return {
      code: 'loan_already_open',
      reason: `${def.label} already has a loan out to you (${live[0]!.id}). Settle it before borrowing again.`,
    }
  }
  if (Object.keys(getFinanceModuleState(state).loans).length >= MAX_OPEN_LOANS) {
    return {
      code: 'too_many_loans',
      reason: `You are already carrying ${MAX_OPEN_LOANS} loans. Settle one first.`,
    }
  }
  if (requested > ceiling) {
    return {
      code: 'over_ceiling',
      reason: `${def.label} will advance at most ${ceiling} coin at your standing; you asked for ${requested}.`,
    }
  }
  if (principal < def.minPrincipal) {
    return {
      code: 'under_minimum',
      reason: `${def.label} does not bother with less than ${def.minPrincipal} coin.`,
    }
  }
  return undefined
}

// ---------- Disbursement ----------

export type TakeLoanResult =
  | { ok: true; loan: LoanRecord; quote: LoanQuote }
  | { ok: false; code: string; reason: string }

/**
 * Take a loan: agree the terms, take the coin, and put the first payment on
 * the calendar in the same transition.
 *
 * The pairing is deliberate, and it is the §7.1 requirement that
 * `loan_due_soon` "cannot be scheduled when no loan exists" read from the
 * other end: a loan cannot exist without a dated payment nobody has to
 * remember to collect.
 */
export function takeLoan(
  ctx: SimContext,
  input: { lenderId: string; principal?: number; purpose?: string },
): TakeLoanResult {
  const quote = quoteLoan(ctx.state, input)
  if (quote.refusal) {
    return { ok: false, code: quote.refusal.code, reason: quote.refusal.reason }
  }
  const today = ctx.state.calendar.totalDaysElapsed
  const def = getLenderDefinition(quote.lenderId)!
  const id = nextLoanId(ctx.state)

  const instalments: LoanInstalment[] = []
  let remaining = quote.totalRepayable
  for (let index = 0; index < quote.instalmentCount; index += 1) {
    const last = index === quote.instalmentCount - 1
    // The final instalment absorbs the rounding so the schedule sums to the
    // repayable total exactly. A loan that cannot be paid off to the coin is
    // a loan that never settles.
    const amount = last ? remaining : Math.min(quote.instalmentAmount, remaining)
    remaining -= amount
    instalments.push({
      index,
      dueOnDay: today + quote.periodDays * (index + 1),
      amount,
      paid: 0,
      status: 'scheduled',
    })
  }

  const purpose = input.purpose ?? 'working capital'
  const loan: LoanRecord = {
    id,
    family: 'loan',
    ownerModuleId: FINANCE_MODULE_ID,
    counterparty: lenderRef(quote.lenderId),
    status: 'active',
    openedOnDay: today,
    dueOnDay: instalments[0]!.dueOnDay,
    graceDays: quote.graceDays,
    lastTransitionOnDay: today,
    history: [
      {
        onDay: today,
        from: 'pending',
        to: 'active',
        reason: `borrowed ${quote.principal} from ${quote.lenderLabel} (${purpose})`,
        amount: quote.principal,
      },
    ],
    escalation: 0,
    readable: `${quote.lenderLabel} loan of ${quote.principal}`,
    tags: ['loan', 'finance', ...def.tags],
    lenderId: quote.lenderId,
    lenderLabel: quote.lenderLabel,
    principal: quote.principal,
    disbursedOnDay: today,
    feeRate: quote.feeRate,
    fee: quote.fee,
    totalRepayable: quote.totalRepayable,
    repaid: 0,
    loanStatus: 'active',
    periodDays: quote.periodDays,
    instalments,
    lateChargeRate: getRule(ctx.state, 'obligationLateChargeRate'),
    missedInstalments: 0,
    renegotiations: 0,
    collectedByLender: 0,
    // Snapshotted with the rest of the terms: what this lender does on a
    // default is part of the bargain the player agreed to.
    collections: def.collections,
    refusalDays: def.refusalDays,
    seizureFraction: def.seizureFraction,
    purpose,
  }

  upsertLoan(ctx, loan, 'loan_opened')

  addCoin(ctx, quote.principal, {
    source: `${SOURCE}.disbursement`,
    category: 'other',
    readable: `${quote.lenderLabel} advanced ${quote.principal} coin.`,
    tags: ['loan', 'loan_proceeds', 'finance'],
  })

  const withFirst = openNextInstalment(ctx, loan, 'first instalment')
  bumpFinanceTotals(
    ctx,
    {
      loansTaken: 1,
      principalBorrowed: quote.principal,
      feesCharged: quote.fee,
    },
    'loan_opened',
  )

  const account =
    getLenderAccount(ctx.state, quote.lenderId) ??
    createLenderAccount(quote.lenderId, today)
  writeLenderAccount(
    ctx,
    {
      ...account,
      loansTaken: account.loansTaken + 1,
      lastDecisionDay: today,
      lastDecisionReason: `advanced ${quote.principal} coin`,
    },
    'loan_opened',
  )

  ctx.addHistory({
    category: 'system',
    summary: `Borrowed ${quote.principal} coin from ${quote.lenderLabel}; ${quote.totalRepayable} repayable by day ${quote.finalDueOnDay}.`,
    tags: ['loan', 'finance', 'borrow'],
    relatedActors: [lenderRef(quote.lenderId)],
    relatedSystems: [FINANCE_MODULE_ID],
  })
  ctx.addCause({
    source: `${SOURCE}.borrow`,
    sourceType: 'system',
    target: 'coin',
    targetType: 'global',
    amount: quote.principal,
    direction: 'increase',
    weight: quote.principal,
    readable: `Borrowed ${quote.principal} coin from ${quote.lenderLabel}.`,
    tags: ['loan', 'finance', 'borrow'],
    relatedActors: [lenderRef(quote.lenderId)],
    expiresAfterDays: 14,
  })

  return { ok: true, loan: withFirst, quote }
}

// ---------- Instalments ----------

/**
 * Set by `financeEvents.ts` at import time.
 *
 * The delinquency check's definition belongs in `financeEvents.ts` — that is
 * where scheduled-event definitions live — and its resolver calls back into
 * this file. Injecting the scheduler the other way keeps the two acyclic
 * without either reaching into the other's internals, exactly as the
 * supplier module does for delivery scheduling.
 */
let scheduleReviewEvent: (
  ctx: SimContext,
  loan: LoanRecord,
  instalmentIndex: number,
  dueOnDay: number,
) => void = () => {
  throw new Error(
    'finance: instalment review scheduling was used before financeEvents registered it',
  )
}

export function setInstalmentReviewScheduler(
  scheduler: (
    ctx: SimContext,
    loan: LoanRecord,
    instalmentIndex: number,
    dueOnDay: number,
  ) => void,
): void {
  scheduleReviewEvent = scheduler
}

/**
 * Open the next scheduled instalment as a shared-ledger obligation and put
 * its due date on the calendar.
 *
 * One at a time, deliberately: the player's calendar shows the payment they
 * can act on, and a renegotiation can rewrite the unopened tail without
 * cancelling a promise already made.
 */
export function openNextInstalment(
  ctx: SimContext,
  loan: LoanRecord,
  reason: string,
): LoanRecord {
  const pending = loan.instalments.find(
    (instalment) => instalment.status === 'scheduled',
  )
  if (!pending) return loan
  const alreadyOpen = loan.instalments.some(
    (instalment) => instalment.status === 'open',
  )
  if (alreadyOpen) return loan

  const today = ctx.state.calendar.totalDaysElapsed
  const obligationId = nextObligationId(ctx.state, FINANCE_MODULE_ID)
  const obligation = openObligation({
    id: obligationId,
    ownerModuleId: FINANCE_MODULE_ID,
    counterparty: loan.counterparty,
    direction: 'payable',
    principal: pending.amount,
    openedOnDay: today,
    dueOnDay: pending.dueOnDay,
    graceDays: loan.graceDays,
    lateChargeRate: loan.lateChargeRate,
    readable: `${loan.lenderLabel} loan payment ${pending.index + 1}/${loan.instalments.length}`,
    tags: ['loan', 'finance', loan.lenderId],
  })
  upsertObligation(ctx, obligation, 'loan_instalment_opened')
  scheduleObligationDueDate(ctx, obligation)

  const next: LoanRecord = {
    ...loan,
    dueOnDay: pending.dueOnDay,
    instalments: loan.instalments.map((instalment) =>
      instalment.index === pending.index
        ? { ...instalment, status: 'open', obligationId }
        : instalment,
    ),
  }
  upsertLoan(ctx, next, `instalment_opened:${reason}`)
  // The pairing that makes delinquency self-driving: opening a payment also
  // puts the day it stops being optional on the calendar, so no daily sweep
  // has to remember to look.
  scheduleReviewEvent(ctx, next, pending.index, pending.dueOnDay)
  return next
}

/** The instalment currently carrying a live ledger obligation, if any. */
export function openInstalmentOf(
  loan: LoanRecord,
): LoanInstalment | undefined {
  return loan.instalments.find((instalment) => instalment.status === 'open')
}

/**
 * Discharge the ledger obligation behind an instalment the schedule has
 * stopped billing, folding what it accrued into the agreement's own balance.
 *
 * The AGREEMENT, not the ledger, is what the player pays down once the
 * schedule has moved past an instalment: `loanOutstanding` still contains the
 * unpaid principal, but `repayLoan`/`settleLoan` reach the ledger only
 * through the CURRENTLY open instalment. So an obligation left live behind a
 * `missed` instalment is both a double count and a debt no player action can
 * ever reach — a promise nobody can keep, which is precisely the shape
 * `OBL-02` exists to remove, and `renegotiateLoan` already settles its open
 * instalment for the same reason.
 *
 * Late charges the ledger managed to accrue are real and move ONTO the
 * agreement rather than being written off with it, so missing a payment still
 * costs what the loan's snapshotted `lateChargeRate` says it costs — the
 * player simply pays it where they can actually reach it.
 */
function absorbInstalmentObligation(
  ctx: SimContext,
  loan: LoanRecord,
  instalment: LoanInstalment,
  reason: string,
): LoanRecord {
  if (!instalment.obligationId) return loan
  const obligation = getObligation(ctx.state, instalment.obligationId)
  if (!obligation) return loan
  const outstanding = outstandingAmount(obligation)
  if (outstanding <= 0) return loan

  upsertObligation(
    ctx,
    settleObligation(obligation, ctx.state.calendar.totalDaysElapsed, reason),
    'loan_instalment_absorbed',
  )

  // Only the part the agreement does not already carry moves across. The
  // unpaid principal is inside `totalRepayable - repaid` already; the charges
  // the ledger added on top of it are not.
  const alreadyOnTheLoan = Math.max(0, instalment.amount - instalment.paid)
  const extra = Math.max(0, outstanding - alreadyOnTheLoan)
  if (extra <= 0) return loan
  return { ...loan, totalRepayable: loan.totalRepayable + extra }
}

/**
 * Close out every ledger obligation a terminal loan still has open.
 *
 * A settled loan discharges them; a forgiven one writes them off. Either way
 * nothing loan-shaped is left live in the shared ledger once the agreement it
 * belonged to is gone.
 */
function dischargeRemainingInstalments(
  ctx: SimContext,
  loan: LoanRecord,
  status: 'settled' | 'forgiven',
  reason: string,
): void {
  const today = ctx.state.calendar.totalDaysElapsed
  for (const instalment of loan.instalments) {
    if (!instalment.obligationId) continue
    const obligation = getObligation(ctx.state, instalment.obligationId)
    if (!obligation || outstandingAmount(obligation) <= 0) continue
    upsertObligation(
      ctx,
      status === 'settled'
        ? settleObligation(obligation, today, reason)
        : forgiveObligation(obligation, today, reason),
      `loan_${status}`,
    )
  }
}

export function loanForObligation(
  state: TavernState,
  obligationId: string,
): LoanRecord | undefined {
  return Object.values(getFinanceModuleState(state).loans).find((loan) =>
    loan.instalments.some(
      (instalment) => instalment.obligationId === obligationId,
    ),
  )
}

// ---------- Repayment ----------

export type RepayResult =
  | {
      ok: true
      applied: number
      instalmentSettled: boolean
      loanSettled: boolean
      loan: LoanRecord
    }
  | { ok: false; code: string; reason: string }

/**
 * Pay against a loan. Partial payment is the normal case, not an edge case:
 * paying half of what is due keeps the instalment live at a lower balance
 * and buys goodwill, and it does NOT move the deadline.
 */
export function repayLoan(
  ctx: SimContext,
  loanId: string,
  amountRequested: number,
  reason: string,
): RepayResult {
  const loan = getLoan(ctx.state, loanId)
  if (!loan) {
    return { ok: false, code: 'unknown_loan', reason: `No live loan '${loanId}'.` }
  }
  const instalment = openInstalmentOf(loan)
  if (!instalment?.obligationId) {
    return {
      ok: false,
      code: 'no_open_instalment',
      reason: `${loan.readable} has no payment open right now. The next one falls due on day ${loan.dueOnDay ?? '—'}.`,
    }
  }
  const obligation = getObligation(ctx.state, instalment.obligationId)
  if (!obligation) {
    return {
      ok: false,
      code: 'instalment_closed',
      reason: `${loan.readable}'s payment has already been closed.`,
    }
  }
  const outstanding = outstandingAmount(obligation)
  const wanted = Math.max(0, Math.floor(amountRequested))
  const applied = Math.min(wanted, outstanding, ctx.state.coin)
  if (applied <= 0) {
    return {
      ok: false,
      code: 'cannot_pay',
      reason:
        ctx.state.coin <= 0
          ? 'The till is empty.'
          : `Nothing to pay: ${outstanding} outstanding, ${wanted} offered.`,
    }
  }

  spendCoin(ctx, applied, {
    source: `${SOURCE}.repayment`,
    category: 'other',
    readable: `Paid ${applied} against ${loan.readable}.`,
    tags: ['loan', 'loan_payment', 'finance'],
  })
  const result = payObligation(obligation, applied, ctx.state.calendar.totalDaysElapsed, reason)
  upsertObligation(ctx, result.record, 'loan_repayment')
  recordObligationPayment(ctx, applied, 'loan_repayment')

  return {
    ok: true,
    ...applyRepaymentToLoan(ctx, loan, instalment, applied, result.settled, reason),
  }
}

/**
 * Fold a payment back into the agreement.
 *
 * Split out from `repayLoan` because a scheduled event settles an
 * instalment through exactly the same bookkeeping without going through the
 * player's action, and the two must not drift.
 */
export function applyRepaymentToLoan(
  ctx: SimContext,
  loan: LoanRecord,
  instalment: LoanInstalment,
  applied: number,
  instalmentSettled: boolean,
  reason: string,
): { applied: number; instalmentSettled: boolean; loanSettled: boolean; loan: LoanRecord } {
  const today = ctx.state.calendar.totalDaysElapsed
  let next: LoanRecord = {
    ...loan,
    repaid: loan.repaid + applied,
    instalments: loan.instalments.map((entry) =>
      entry.index === instalment.index
        ? {
            ...entry,
            paid: entry.paid + applied,
            status: instalmentSettled ? 'paid' : entry.status,
          }
        : entry,
    ),
    lastTransitionOnDay: today,
    // Paying while delinquent pulls the agreement back to active. The
    // escalation rung already reached is kept — the relationship damage
    // happened — but the ladder stops climbing.
    loanStatus:
      loan.loanStatus === 'delinquent' || loan.loanStatus === 'in_collections'
        ? 'active'
        : loan.loanStatus,
  }

  bumpFinanceTotals(ctx, { repaid: applied }, 'loan_repayment')

  const settled = loanOutstanding(next) <= 0
  if (settled) {
    next = closeLoan(ctx, next, 'settled', reason)
  } else {
    upsertLoan(ctx, next, 'loan_repayment')
    if (instalmentSettled) next = openNextInstalment(ctx, next, 'next instalment')
  }

  ctx.addCause({
    source: `${SOURCE}.repayment`,
    sourceType: 'system',
    target: 'coin',
    targetType: 'global',
    amount: -applied,
    direction: 'decrease',
    weight: applied,
    readable: `Paid ${applied} against ${loan.readable}.`,
    tags: ['loan', 'finance', 'repayment'],
    relatedActors: [loan.counterparty],
    expiresAfterDays: 7,
  })

  return { applied, instalmentSettled, loanSettled: settled, loan: next }
}

// ---------- Delinquency, default, collections ----------

/**
 * An instalment went past its grace window.
 *
 * The shared ledger has already defaulted the OBLIGATION; what happens here
 * is what it means for the AGREEMENT. Two misses is delinquency the player
 * can still recover from; the third defaults the loan and hands it to the
 * lender's own collections behaviour.
 */
export function recordMissedInstalment(
  ctx: SimContext,
  loan: LoanRecord,
  obligationId: string,
  reason: string,
): LoanRecord {
  const today = ctx.state.calendar.totalDaysElapsed
  const instalment = loan.instalments.find(
    (entry) => entry.obligationId === obligationId,
  )
  const missed = loan.missedInstalments + 1
  const defaulting = missed >= 3
  // The schedule stops billing this instalment from here, so its ledger
  // obligation must stop being the thing that carries the debt — otherwise it
  // sits live, unreachable and double-counted for the rest of the run.
  const absorbed = instalment
    ? absorbInstalmentObligation(
        ctx,
        loan,
        instalment,
        `${reason}; carried onto ${loan.readable}`,
      )
    : loan
  let next: LoanRecord = {
    ...absorbed,
    missedInstalments: missed,
    escalation: loan.escalation + 1,
    loanStatus: defaulting ? 'defaulted' : 'delinquent',
    lastTransitionOnDay: today,
    instalments: instalment
      ? loan.instalments.map((entry) =>
          entry.index === instalment.index
            ? { ...entry, status: 'missed' }
            : entry,
        )
      : loan.instalments,
    history: [
      ...loan.history,
      {
        onDay: today,
        from: loan.status,
        to: (defaulting ? 'defaulted' : 'grace') as ContractStatus,
        reason,
      },
    ].slice(-24),
    status: defaulting ? 'defaulted' : 'grace',
  }
  upsertLoan(ctx, next, defaulting ? 'loan_defaulted' : 'loan_delinquent')

  const account = getLenderAccount(ctx.state, loan.lenderId)
  if (account) {
    writeLenderAccount(
      ctx,
      {
        ...account,
        standing: Math.max(0, account.standing - (defaulting ? 25 : 10)),
        loansDefaulted: defaulting ? account.loansDefaulted + 1 : account.loansDefaulted,
        ...(defaulting
          ? {
              // From the AGREEMENT, not the registry: the refusal window is
              // one of the terms this loan snapshotted at signing.
              refusingUntilDay: today + loan.refusalDays,
              refusingReason: 'defaulted loan',
            }
          : {}),
        lastDecisionDay: today,
        lastDecisionReason: defaulting ? 'loan defaulted' : 'payment missed',
      },
      defaulting ? 'loan_defaulted' : 'loan_delinquent',
    )
  }

  if (defaulting) {
    bumpFinanceTotals(ctx, { loansDefaulted: 1 }, 'loan_defaulted')
    // A defaulted loan still has money owed on it, and the remaining
    // instalments still exist — but they stop being a schedule and become a
    // balance the lender comes after. Mark the tail so nothing re-opens it.
    next = {
      ...next,
      instalments: next.instalments.map((entry) =>
        entry.status === 'scheduled' ? { ...entry, status: 'missed' } : entry,
      ),
    }
    upsertLoan(ctx, next, 'loan_default_tail')
  } else {
    // Still recoverable: the schedule continues, so the next payment goes on
    // the calendar rather than the loan going quiet until it defaults.
    next = openNextInstalment(ctx, next, 'after missed payment')
  }

  return next
}

/**
 * The lender comes to collect on a defaulted loan.
 *
 * A seizure lender takes what it can from the till; a refusal lender simply
 * keeps the door shut. Both change what the player can do next — neither is
 * a pressure adjustment standing in for a consequence.
 */
export function runCollections(
  ctx: SimContext,
  loan: LoanRecord,
): { seized: number; loan: LoanRecord; readable: string } {
  const today = ctx.state.calendar.totalDaysElapsed
  const outstanding = loanOutstanding(loan)
  if (outstanding <= 0) {
    return { seized: 0, loan, readable: `${loan.readable} has nothing left to collect.` }
  }

  // Collections behaviour comes off the AGREEMENT, not off the registry: a
  // lender re-tuned since signing must not change what an in-flight loan
  // does to this player, and a lender removed from the registry entirely
  // must still be able to collect on the debt it is owed.
  let seized = 0
  if (loan.collections === 'seizure') {
    const wanted = Math.max(1, Math.round(outstanding * loan.seizureFraction))
    seized = Math.min(wanted, ctx.state.coin)
    if (seized > 0) {
      spendCoin(ctx, seized, {
        source: `${SOURCE}.collections`,
        category: 'other',
        readable: `${loan.lenderLabel} took ${seized} coin from the till.`,
        tags: ['loan', 'loan_payment', 'collections', 'finance'],
      })
    }
  }

  let next: LoanRecord = {
    ...loan,
    repaid: loan.repaid + seized,
    collectedByLender: loan.collectedByLender + seized,
    escalation: loan.escalation + 1,
    loanStatus: 'in_collections',
    status: 'in_collections',
    lastTransitionOnDay: today,
    history: [
      ...loan.history,
      {
        onDay: today,
        from: loan.status,
        to: 'in_collections' as ContractStatus,
        reason:
          seized > 0
            ? `${loan.lenderLabel} seized ${seized} coin`
            : `${loan.lenderLabel} refuses further dealings`,
        amount: seized,
      },
    ].slice(-24),
  }

  if (seized > 0) bumpFinanceTotals(ctx, { collectionsSeized: seized, repaid: seized }, 'collections')

  if (loanOutstanding(next) <= 0) {
    next = closeLoan(ctx, next, 'settled', 'collected in full')
  } else {
    upsertLoan(ctx, next, 'loan_collections')
  }

  return {
    seized,
    loan: next,
    readable:
      seized > 0
        ? `${loan.lenderLabel} took ${seized} coin against ${loan.readable} (${loanOutstanding(next)} still owed).`
        : `${loan.lenderLabel} has stopped dealing with you over ${loan.readable} (${loanOutstanding(next)} still owed).`,
  }
}

// ---------- Renegotiation ----------

export type RenegotiateResult =
  | { ok: true; loan: LoanRecord; readable: string }
  | { ok: false; code: string; reason: string }

/**
 * Rewrite the remaining schedule: smaller payments, spread further out, for
 * a fee added to the balance.
 *
 * This is real counterplay before the consequence, not a way out of it. The
 * player pays more in total and the lender's standing does not recover —
 * what they buy is time, which is exactly the resource a failing tavern is
 * short of.
 */
export function renegotiateLoan(
  ctx: SimContext,
  loanId: string,
): RenegotiateResult {
  const loan = getLoan(ctx.state, loanId)
  if (!loan) {
    return { ok: false, code: 'unknown_loan', reason: `No live loan '${loanId}'.` }
  }
  if (loan.renegotiations >= MAX_RENEGOTIATIONS) {
    return {
      ok: false,
      code: 'renegotiation_exhausted',
      reason: `${loan.lenderLabel} has already rewritten this loan ${loan.renegotiations} times and will not do it again.`,
    }
  }
  if (loan.loanStatus === 'in_collections') {
    return {
      ok: false,
      code: 'in_collections',
      reason: `${loan.lenderLabel} is collecting on this loan; only paying it down will stop that.`,
    }
  }
  const account = getLenderAccount(ctx.state, loan.lenderId)
  if (account && account.standing < 15) {
    return {
      ok: false,
      code: 'standing_too_low',
      reason: `${loan.lenderLabel} thinks too little of you to rewrite terms (standing ${account.standing}). Pay something first.`,
    }
  }

  const today = ctx.state.calendar.totalDaysElapsed
  const outstanding = loanOutstanding(loan)
  if (outstanding <= 0) {
    return {
      ok: false,
      code: 'nothing_owed',
      reason: `${loan.readable} is already repaid.`,
    }
  }

  // Close the live instalment obligation as settled-by-renegotiation. It is
  // genuinely discharged: the sum it represented has moved into the rewritten
  // schedule, and leaving it live would double-count the debt.
  const open = openInstalmentOf(loan)
  if (open?.obligationId) {
    const obligation = getObligation(ctx.state, open.obligationId)
    if (obligation) {
      upsertObligation(
        ctx,
        settleObligation(obligation, today, 'rolled into renegotiated schedule'),
        'loan_renegotiated',
      )
    }
  }

  const fee = Math.max(1, Math.round(outstanding * 0.08))
  const newTotal = loan.totalRepayable + fee
  const remaining = newTotal - loan.repaid
  const paidInstalments = loan.instalments.filter(
    (entry) => entry.status === 'paid',
  )
  const count = Math.min(
    MAX_LOAN_INSTALMENTS - paidInstalments.length,
    Math.max(2, loan.instalments.length - paidInstalments.length + 1),
  )
  const periodDays = loan.periodDays + 2
  const per = Math.ceil(remaining / count)

  const instalments: LoanInstalment[] = [...paidInstalments]
  let left = remaining
  for (let i = 0; i < count; i += 1) {
    const index = paidInstalments.length + i
    const last = i === count - 1
    const amount = last ? left : Math.min(per, left)
    left -= amount
    instalments.push({
      index,
      dueOnDay: today + periodDays * (i + 1),
      amount,
      paid: 0,
      status: 'scheduled',
    })
  }

  let next: LoanRecord = {
    ...loan,
    totalRepayable: newTotal,
    fee: loan.fee + fee,
    periodDays,
    instalments,
    renegotiations: loan.renegotiations + 1,
    loanStatus: 'active',
    status: 'active',
    ...(instalments[paidInstalments.length]?.dueOnDay !== undefined
      ? { dueOnDay: instalments[paidInstalments.length]!.dueOnDay }
      : {}),
    lastTransitionOnDay: today,
    history: [
      ...loan.history,
      {
        onDay: today,
        from: loan.status,
        to: 'active' as ContractStatus,
        reason: `renegotiated: ${count} payments of about ${per} every ${periodDays} days, fee ${fee}`,
        amount: fee,
      },
    ].slice(-24),
  }
  upsertLoan(ctx, next, 'loan_renegotiated')
  next = openNextInstalment(ctx, next, 'renegotiated schedule')
  bumpFinanceTotals(ctx, { renegotiations: 1, feesCharged: fee }, 'loan_renegotiated')

  const readable =
    `${loan.lenderLabel} rewrote the loan: ${count} payments of about ${per} every ${periodDays} days, ` +
    `for a ${fee} coin fee (${newTotal} repayable in total).`
  ctx.addHistory({
    category: 'system',
    summary: readable,
    tags: ['loan', 'finance', 'renegotiation'],
    relatedActors: [loan.counterparty],
    relatedSystems: [FINANCE_MODULE_ID],
  })

  return { ok: true, loan: next, readable }
}

// ---------- Settlement ----------

export type SettleResult =
  | { ok: true; paid: number; loan: LoanRecord; readable: string }
  | { ok: false; code: string; reason: string }

/**
 * Clear the whole balance now.
 *
 * A loan settled early costs less than it would have: the lender rebates a
 * tenth of the outstanding fee, which is what makes "pay it off while you
 * can" a decision rather than an accounting formality.
 */
export function settleLoan(ctx: SimContext, loanId: string): SettleResult {
  const loan = getLoan(ctx.state, loanId)
  if (!loan) {
    return { ok: false, code: 'unknown_loan', reason: `No live loan '${loanId}'.` }
  }
  const outstanding = loanOutstanding(loan)
  if (outstanding <= 0) {
    return { ok: false, code: 'nothing_owed', reason: `${loan.readable} is already repaid.` }
  }
  const onSchedule = loan.loanStatus === 'active'
  const rebate = onSchedule ? Math.round(outstanding * 0.1) : 0
  const due = outstanding - rebate
  if (ctx.state.coin < due) {
    return {
      ok: false,
      code: 'cannot_afford',
      reason: `Settling ${loan.readable} needs ${due} coin; the till holds ${ctx.state.coin}.`,
    }
  }

  const today = ctx.state.calendar.totalDaysElapsed
  spendCoin(ctx, due, {
    source: `${SOURCE}.settlement`,
    category: 'other',
    readable: `Settled ${loan.readable} for ${due} coin.`,
    tags: ['loan', 'loan_payment', 'settlement', 'finance'],
  })
  recordObligationPayment(ctx, due, 'loan_settlement')

  const open = openInstalmentOf(loan)
  if (open?.obligationId) {
    const obligation = getObligation(ctx.state, open.obligationId)
    if (obligation) {
      upsertObligation(
        ctx,
        settleObligation(obligation, today, 'loan settled in full'),
        'loan_settled',
      )
    }
  }

  const settledLoan = closeLoan(
    ctx,
    {
      ...loan,
      repaid: loan.totalRepayable,
      instalments: loan.instalments.map((entry) =>
        entry.status === 'paid' ? entry : { ...entry, status: 'paid' },
      ),
    },
    'settled',
    rebate > 0
      ? `settled early for ${due} (${rebate} rebated)`
      : `settled for ${due}`,
  )
  bumpFinanceTotals(ctx, { repaid: due }, 'loan_settled')

  const readable =
    rebate > 0
      ? `Settled ${loan.readable} early for ${due} coin — ${loan.lenderLabel} rebated ${rebate}.`
      : `Settled ${loan.readable} for ${due} coin.`
  return { ok: true, paid: due, loan: settledLoan, readable }
}

/** Move a loan to a terminal status and update the lender's opinion of the tavern. */
export function closeLoan(
  ctx: SimContext,
  loan: LoanRecord,
  status: 'settled' | 'forgiven',
  reason: string,
): LoanRecord {
  const today = ctx.state.calendar.totalDaysElapsed
  // Nothing loan-shaped may outlive the agreement it belonged to: any
  // instalment obligation still live in the shared ledger is discharged here,
  // so a closed loan cannot go on accruing charges or showing on the calendar.
  dischargeRemainingInstalments(ctx, loan, status, `${loan.readable} ${status}: ${reason}`)
  const next: LoanRecord = {
    ...loan,
    loanStatus: status,
    status: status,
    closedOnDay: today,
    lastTransitionOnDay: today,
    history: [
      ...loan.history,
      { onDay: today, from: loan.status, to: status as ContractStatus, reason },
    ].slice(-24),
  }
  upsertLoan(ctx, next, `loan_${status}`)

  const account = getLenderAccount(ctx.state, loan.lenderId)
  if (account) {
    const cleanly = status === 'settled' && loan.missedInstalments === 0
    writeLenderAccount(
      ctx,
      {
        ...account,
        standing: Math.min(
          100,
          Math.max(0, account.standing + (cleanly ? 12 : status === 'settled' ? 5 : -15)),
        ),
        loansSettled:
          status === 'settled' ? account.loansSettled + 1 : account.loansSettled,
        // Repaying clears a refusal that a default put in place — which is
        // what makes "pay off Grimwick and he'll deal again" a real route.
        ...(status === 'settled'
          ? {
              refusingUntilDay: undefined as number | undefined,
              refusingReason: undefined as string | undefined,
            }
          : {}),
        lastDecisionDay: today,
        lastDecisionReason: reason,
      },
      `loan_${status}`,
    )
  }
  if (status === 'settled') bumpFinanceTotals(ctx, { loansSettled: 1 }, 'loan_settled')

  ctx.addHistory({
    category: 'system',
    summary: `${loan.readable} ${status} (${reason}).`,
    tags: ['loan', 'finance', status],
    relatedActors: [loan.counterparty],
    relatedSystems: [FINANCE_MODULE_ID],
  })
  return next
}

// ---------- Queries used by the report and the events ----------

/** Every live loan-instalment obligation, for the §7.4 calendar. */
export function loanObligations(state: TavernState): ObligationRecord[] {
  const out: ObligationRecord[] = []
  for (const loan of listLoans(state)) {
    for (const instalment of loan.instalments) {
      if (!instalment.obligationId) continue
      const obligation = getObligation(state, instalment.obligationId)
      if (obligation) out.push(obligation)
    }
  }
  return out
}

export function totalLoanDebt(state: TavernState): number {
  return listLoans(state).reduce((sum, loan) => sum + loanOutstanding(loan), 0)
}

/** The soonest payment the player owes, if any. Drives the picker hints. */
export function nextLoanPayment(
  state: TavernState,
): { loan: LoanRecord; instalment: LoanInstalment } | undefined {
  let best: { loan: LoanRecord; instalment: LoanInstalment } | undefined
  for (const loan of listLoans(state)) {
    const instalment = nextInstalment(loan)
    if (!instalment) continue
    if (!best || instalment.dueOnDay < best.instalment.dueOnDay) {
      best = { loan, instalment }
    }
  }
  return best
}

export function availableLenders(state: TavernState): LoanQuote[] {
  return listLenders().map((lender) => quoteLoan(state, { lenderId: lender.id }))
}

/** Mark a loan record transition without a money movement. */
export function noteLoanTransition(
  ctx: SimContext,
  loan: LoanRecord,
  reason: string,
): LoanRecord {
  const next = transitionContract(
    loan,
    loan.status,
    ctx.state.calendar.totalDaysElapsed,
    reason,
  )
  upsertLoan(ctx, next, 'loan_note')
  return next
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
