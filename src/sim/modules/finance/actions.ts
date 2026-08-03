import type { SimContext } from '../../core/context'
import {
  TIME_COST_QUICK,
  TIME_COST_SHORT,
} from '../ownerActions/stateHelpers'
import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionApplied,
  OwnerActionDefinition,
  OwnerActionInput,
} from '../ownerActions/types'
import { getObligation, outstandingAmount } from '../../contracts/obligations/index'

import {
  availableLenders,
  openInstalmentOf,
  quoteLoan,
  renegotiateLoan,
  repayLoan,
  settleLoan,
  takeLoan,
} from './loans'
import { getLoan, listLoans } from './state'
import { loanOutstanding } from './types'

// Expansion Phase 7 §7.1 — "borrowing must be a deliberate capability with
// visible terms".
//
// Four registered owner actions, so borrowing inherits the day's time
// budget, the planner, and the generic action picker without a bespoke UI
// path — the same route the Phase 6 supplier actions take. Every rejection
// names the condition that would change the answer, because §5 fails a
// phase where "a player cannot discover what action is available and why".
//
// Target-id shapes:
//   take_loan                      "<lenderId>"      amount = principal
//   repay_loan / renegotiate_loan  "<loanId>"        amount = coin offered
//   settle_loan                    "<loanId>"

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

// ---------- take_loan ----------

function listLenderTargets(ctx: SimContext): ActionTarget[] {
  return availableLenders(ctx.state).map((quote) => ({
    id: quote.lenderId,
    label: quote.lenderLabel,
    // The hint IS the quote, not a description of one, so the terms the
    // player is shown and the terms they are charged cannot drift.
    hint: quote.refusal ? quote.refusal.reason : quote.readable,
  }))
}

const takeLoanAction: OwnerActionDefinition = {
  id: 'take_loan',
  label: 'Borrow coin',
  category: 'immediate',
  tags: ['finance', 'loan', 'coin'],
  targetType: 'global',
  timeCost: TIME_COST_SHORT,
  effectsPreview: 'Take a loan on stated terms; repayments go on the calendar.',
  pressureAffinity: ['debt'],
  getValidTargets: listLenderTargets,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('no_target', 'Choose a lender.')
    const quote = quoteLoan(ctx.state, {
      lenderId: input.targetId,
      ...(input.amount !== undefined ? { principal: input.amount } : {}),
    })
    if (quote.refusal) return reject(quote.refusal.code, quote.refusal.reason)
    return OK
  },
  apply: (ctx, input) => {
    const lenderId = input.targetId!
    const result = takeLoan(ctx, {
      lenderId,
      ...(input.amount !== undefined ? { principal: input.amount } : {}),
      purpose: typeof input.options?.['purpose'] === 'string'
        ? (input.options['purpose'] as string)
        : 'working capital',
    })
    if (!result.ok) {
      return applied('take_loan', 'Borrow coin', lenderId, [result.reason], {
        ok: false,
        code: result.code,
      })
    }
    return applied(
      'take_loan',
      'Borrow coin',
      lenderId,
      [
        `${result.quote.lenderLabel} advanced ${result.quote.principal} coin.`,
        `${result.quote.instalmentCount} payments of about ${result.quote.instalmentAmount} every ${result.quote.periodDays} days.`,
        `First payment due day ${result.quote.firstDueOnDay} (${result.quote.graceDays} days grace).`,
      ],
      {
        ok: true,
        loanId: result.loan.id,
        principal: result.quote.principal,
        fee: result.quote.fee,
        totalRepayable: result.quote.totalRepayable,
        firstDueOnDay: result.quote.firstDueOnDay,
      },
      result.quote.lenderLabel,
    )
  },
}

// ---------- repay_loan ----------

function listLoanTargets(ctx: SimContext): ActionTarget[] {
  return listLoans(ctx.state).map((loan) => {
    const instalment = openInstalmentOf(loan)
    const obligation = instalment?.obligationId
      ? getObligation(ctx.state, instalment.obligationId)
      : undefined
    const due = obligation ? outstandingAmount(obligation) : 0
    return {
      id: loan.id,
      label: loan.readable,
      hint: obligation
        ? `${due} due day ${instalment!.dueOnDay}; ${loanOutstanding(loan)} outstanding in total [${loan.loanStatus}]`
        : `${loanOutstanding(loan)} outstanding, no payment open [${loan.loanStatus}]`,
    }
  })
}

const repayLoanAction: OwnerActionDefinition = {
  id: 'repay_loan',
  label: 'Pay a loan instalment',
  category: 'immediate',
  tags: ['finance', 'loan', 'coin'],
  targetType: 'global',
  timeCost: TIME_COST_QUICK,
  effectsPreview: 'Pay what you can against the open instalment. Partial payment counts.',
  pressureAffinity: ['debt'],
  getValidTargets: listLoanTargets,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('no_target', 'Choose a loan.')
    const loan = getLoan(ctx.state, input.targetId)
    if (!loan) return reject('unknown_loan', `No live loan '${input.targetId}'.`)
    const instalment = openInstalmentOf(loan)
    if (!instalment?.obligationId) {
      return reject(
        'no_open_instalment',
        `${loan.readable} has no payment open. The next one falls due on day ${loan.dueOnDay ?? '—'}.`,
      )
    }
    if (ctx.state.coin <= 0) {
      return reject('no_coin', 'The till is empty — take the day\'s sales first.')
    }
    return OK
  },
  apply: (ctx, input) => {
    const loanId = input.targetId!
    const loan = getLoan(ctx.state, loanId)
    const instalment = loan ? openInstalmentOf(loan) : undefined
    const obligation = instalment?.obligationId
      ? getObligation(ctx.state, instalment.obligationId)
      : undefined
    // No amount means "pay what is due, as far as the till stretches" —
    // which is what a player who opened the picker and pressed the button
    // meant, and it is the same partial-payment path as an explicit amount.
    const wanted =
      input.amount !== undefined && input.amount > 0
        ? Math.floor(input.amount)
        : obligation
          ? outstandingAmount(obligation)
          : 0
    const result = repayLoan(ctx, loanId, wanted, 'owner paid')
    if (!result.ok) {
      return applied('repay_loan', 'Pay a loan instalment', loanId, [result.reason], {
        ok: false,
        code: result.code,
      })
    }
    const lines = [`Paid ${result.applied} coin against ${loan?.readable ?? loanId}.`]
    if (result.instalmentSettled) lines.push('That payment is cleared.')
    else lines.push('Part payment — the balance stays due on the same day.')
    if (result.loanSettled) lines.push('The loan is repaid in full.')
    return applied(
      'repay_loan',
      'Pay a loan instalment',
      loanId,
      lines,
      {
        ok: true,
        applied: result.applied,
        instalmentSettled: result.instalmentSettled,
        loanSettled: result.loanSettled,
        outstanding: loanOutstanding(result.loan),
      },
      loan?.readable,
    )
  },
}

// ---------- renegotiate_loan ----------

const renegotiateLoanAction: OwnerActionDefinition = {
  id: 'renegotiate_loan',
  label: 'Renegotiate a loan',
  category: 'social',
  tags: ['finance', 'loan', 'negotiation'],
  targetType: 'global',
  timeCost: TIME_COST_SHORT,
  effectsPreview: 'Smaller payments spread further out, for a fee on the balance.',
  pressureAffinity: ['debt'],
  getValidTargets: listLoanTargets,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('no_target', 'Choose a loan.')
    const loan = getLoan(ctx.state, input.targetId)
    if (!loan) return reject('unknown_loan', `No live loan '${input.targetId}'.`)
    if (loan.loanStatus === 'in_collections') {
      return reject(
        'in_collections',
        `${loan.lenderLabel} is collecting on this loan; only paying it down will stop that.`,
      )
    }
    if (loanOutstanding(loan) <= 0) {
      return reject('nothing_owed', `${loan.readable} is already repaid.`)
    }
    return OK
  },
  apply: (ctx, input) => {
    const loanId = input.targetId!
    const result = renegotiateLoan(ctx, loanId)
    if (!result.ok) {
      return applied(
        'renegotiate_loan',
        'Renegotiate a loan',
        loanId,
        [result.reason],
        { ok: false, code: result.code },
      )
    }
    return applied(
      'renegotiate_loan',
      'Renegotiate a loan',
      loanId,
      [result.readable],
      {
        ok: true,
        totalRepayable: result.loan.totalRepayable,
        renegotiations: result.loan.renegotiations,
        nextDueOnDay: result.loan.dueOnDay,
      },
      result.loan.readable,
    )
  },
}

// ---------- settle_loan ----------

const settleLoanAction: OwnerActionDefinition = {
  id: 'settle_loan',
  label: 'Settle a loan in full',
  category: 'immediate',
  tags: ['finance', 'loan', 'coin'],
  targetType: 'global',
  timeCost: TIME_COST_QUICK,
  effectsPreview: 'Clear the whole balance now. On-schedule loans get a rebate.',
  pressureAffinity: ['debt'],
  getValidTargets: listLoanTargets,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('no_target', 'Choose a loan.')
    const loan = getLoan(ctx.state, input.targetId)
    if (!loan) return reject('unknown_loan', `No live loan '${input.targetId}'.`)
    const outstanding = loanOutstanding(loan)
    if (outstanding <= 0) {
      return reject('nothing_owed', `${loan.readable} is already repaid.`)
    }
    const rebate = loan.loanStatus === 'active' ? Math.round(outstanding * 0.1) : 0
    const due = outstanding - rebate
    if (ctx.state.coin < due) {
      return reject(
        'cannot_afford',
        `Settling ${loan.readable} needs ${due} coin; the till holds ${ctx.state.coin}.`,
      )
    }
    return OK
  },
  apply: (ctx, input) => {
    const loanId = input.targetId!
    const loan = getLoan(ctx.state, loanId)
    const result = settleLoan(ctx, loanId)
    if (!result.ok) {
      return applied(
        'settle_loan',
        'Settle a loan in full',
        loanId,
        [result.reason],
        { ok: false, code: result.code },
      )
    }
    return applied(
      'settle_loan',
      'Settle a loan in full',
      loanId,
      [result.readable],
      { ok: true, paid: result.paid },
      loan?.readable,
    )
  },
}

function applied(
  actionId: string,
  label: string,
  targetId: string,
  effects: string[],
  data: Record<string, unknown>,
  targetLabel?: string,
): OwnerActionApplied {
  const definition = FINANCE_ACTIONS.find((entry) => entry.id === actionId)
  return {
    actionId,
    label,
    targetId,
    ...(targetLabel ? { targetLabel } : {}),
    // The owner-actions module charges what the result reports, so it must
    // be the definition's own cost — a rejected outcome still consumed the
    // walk to the moneylender.
    timeCost: definition?.timeCost ?? 0,
    effects,
    data,
  }
}

export const FINANCE_ACTIONS: OwnerActionDefinition[] = [
  takeLoanAction,
  repayLoanAction,
  renegotiateLoanAction,
  settleLoanAction,
]
