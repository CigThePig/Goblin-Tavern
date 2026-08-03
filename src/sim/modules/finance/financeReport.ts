import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import { getObligation, outstandingAmount } from '../../contracts/obligations/index'

import { openInstalmentOf } from './loans'
import { getFinanceModuleState, listLoans } from './state'
import { FINANCE_MODULE_ID, loanOutstanding } from './types'

// Expansion Phase 7 §7.4 — the loan half of the ledger view.
//
// Due dates, next amounts, escalation rungs and the lender's opinion, all
// read off the records rather than recomputed: a report that derives its own
// numbers is a second source of truth waiting to disagree with the first.

export function buildFinanceReport(ctx: SimContext): ReportSection | null {
  const slice = getFinanceModuleState(ctx.state)
  const loans = listLoans(ctx.state)
  if (loans.length === 0 && slice.loanArchive.length === 0) return null

  const today = ctx.state.calendar.totalDaysElapsed
  const lines: string[] = []
  const outstanding = loans.reduce((sum, loan) => sum + loanOutstanding(loan), 0)
  lines.push(`Loan debt outstanding: ${outstanding} across ${loans.length} loan(s)`)

  for (const loan of loans) {
    const instalment = openInstalmentOf(loan)
    const obligation = instalment?.obligationId
      ? getObligation(ctx.state, instalment.obligationId)
      : undefined
    const due = obligation ? outstandingAmount(obligation) : 0
    const when = instalment
      ? ` — ${due} due day ${instalment.dueOnDay} (${instalment.dueOnDay - today} day(s))`
      : ''
    lines.push(
      `  - ${loan.readable}: ${loanOutstanding(loan)} outstanding [${loan.loanStatus}]${when}`,
    )
    if (loan.missedInstalments > 0) {
      lines.push(
        `      ${loan.missedInstalments} missed payment(s), escalation ${loan.escalation}`,
      )
    }
    if (loan.renegotiations > 0) {
      lines.push(`      renegotiated ${loan.renegotiations} time(s)`)
    }
  }

  const refusing = Object.values(slice.lenders).filter(
    (account) =>
      account.refusingUntilDay !== undefined && account.refusingUntilDay > today,
  )
  for (const account of refusing) {
    lines.push(
      `  ! ${account.lenderId} will not lend until day ${account.refusingUntilDay}` +
        (account.refusingReason ? ` (${account.refusingReason})` : ''),
    )
  }

  return {
    id: 'finance',
    source: FINANCE_MODULE_ID,
    title: 'LOANS',
    lines,
    data: {
      openLoans: loans.length,
      outstanding,
      archived: slice.loanArchive.length,
      totals: slice.totals,
      lenders: Object.fromEntries(
        Object.values(slice.lenders).map((account) => [
          account.lenderId,
          {
            standing: account.standing,
            loansTaken: account.loansTaken,
            loansSettled: account.loansSettled,
            loansDefaulted: account.loansDefaulted,
            ...(account.refusingUntilDay !== undefined
              ? { refusingUntilDay: account.refusingUntilDay }
              : {}),
          },
        ]),
      ),
    },
  }
}
