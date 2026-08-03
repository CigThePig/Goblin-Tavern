import type { SimContext } from '../../core/context'
import type { SimulationHook, SimulationModule } from '../../core/module'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'
import { ensureRequiredLendersRegistered } from '../../content/finance/lenderRegistry'
import { getObligation, outstandingAmount } from '../../contracts/obligations/index'

import { ensureFinanceEventsRegistered, reconcileOverdueInstalments } from './financeEvents'
import { buildFinanceReport } from './financeReport'
import {
  createInitialFinanceModuleState,
  ensureLenderAccounts,
  getFinanceModuleState,
} from './state'
import {
  FINANCE_MODULE_ID,
  FinanceModuleStateSchema,
  MAX_ARCHIVED_LOANS,
  MAX_LOAN_INSTALMENTS,
  MAX_OPEN_LOANS,
  isTerminalLoanStatus,
} from './types'

// Expansion Phase 7 §7.1 — the finance module.
//
// Registering the events at import time (rather than in a hook) means any
// pipeline containing this module can schedule an instalment review before
// its first day runs, and a pipeline built WITHOUT it correctly rejects
// those schedules as unowned instead of queueing a promise nothing keeps.
ensureRequiredLendersRegistered()
ensureFinanceEventsRegistered()

const beforeOwnerActionsHook: SimulationHook = (ctx: SimContext): void => {
  // A lender the player can borrow from must have somewhere for their
  // record of the tavern to live, and a lender who has left takes their
  // record with them (§5.11).
  ensureLenderAccounts(ctx)
  // Backstop only — see `reconcileOverdueInstalments`. The scheduled review
  // is the mechanism; this catches a review that expired unresolved so a
  // loan can never go quiet.
  reconcileOverdueInstalments(ctx)
}

function validate(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const slice = getFinanceModuleState(ctx.state)
  const loans = Object.values(slice.loans)

  if (loans.length > MAX_OPEN_LOANS) {
    issues.push({
      path: `modules.${FINANCE_MODULE_ID}.loans`,
      message: `${loans.length} open loans, above the ${MAX_OPEN_LOANS} cap`,
      code: 'finance_loans_over_cap',
    })
  }
  if (slice.loanArchive.length > MAX_ARCHIVED_LOANS) {
    issues.push({
      path: `modules.${FINANCE_MODULE_ID}.loanArchive`,
      message: `${slice.loanArchive.length} archived loans, above the ${MAX_ARCHIVED_LOANS} cap`,
      code: 'finance_archive_over_cap',
    })
  }

  for (const loan of loans) {
    if (isTerminalLoanStatus(loan.loanStatus)) {
      issues.push({
        path: `modules.${FINANCE_MODULE_ID}.loans.${loan.id}`,
        message: `Loan '${loan.id}' is ${loan.loanStatus} but still live`,
        code: 'finance_terminal_still_live',
      })
    }
    if (loan.instalments.length > MAX_LOAN_INSTALMENTS) {
      issues.push({
        path: `modules.${FINANCE_MODULE_ID}.loans.${loan.id}.instalments`,
        message: `Loan '${loan.id}' has ${loan.instalments.length} instalments, above the ${MAX_LOAN_INSTALMENTS} cap`,
        code: 'finance_instalments_over_cap',
      })
    }
    if (loan.repaid > loan.totalRepayable) {
      issues.push({
        path: `modules.${FINANCE_MODULE_ID}.loans.${loan.id}`,
        message: `Loan '${loan.id}' has been over-repaid (${loan.repaid} of ${loan.totalRepayable})`,
        code: 'finance_over_repaid',
      })
    }
    // The invariant that makes §7.1's "no loan event without a real owning
    // record" checkable from the other direction: an instalment marked open
    // must have a live ledger obligation behind it.
    const open = loan.instalments.filter((entry) => entry.status === 'open')
    if (open.length > 1) {
      issues.push({
        path: `modules.${FINANCE_MODULE_ID}.loans.${loan.id}.instalments`,
        message: `Loan '${loan.id}' has ${open.length} instalments open at once`,
        code: 'finance_multiple_open_instalments',
      })
    }
    for (const instalment of open) {
      if (!instalment.obligationId) {
        issues.push({
          path: `modules.${FINANCE_MODULE_ID}.loans.${loan.id}.instalments.${instalment.index}`,
          message: `Open instalment ${instalment.index} on '${loan.id}' has no ledger obligation`,
          code: 'finance_instalment_without_obligation',
        })
        continue
      }
      if (!getObligation(ctx.state, instalment.obligationId)) {
        issues.push({
          path: `modules.${FINANCE_MODULE_ID}.loans.${loan.id}.instalments.${instalment.index}`,
          message: `Open instalment ${instalment.index} on '${loan.id}' points at closed obligation '${instalment.obligationId}'`,
          code: 'finance_instalment_obligation_missing',
        })
      }
    }
  }

  // …and the same invariant read the OTHER way, which is the direction that
  // actually catches a leak: an obligation the ledger still holds must belong
  // to an instalment that is still open. One left behind a `missed` or closed
  // instalment is unreachable by every player action — a debt that can only
  // grow — so it is a defect, not merely untidy. Archived loans are included
  // because a closed loan must not leave one behind either.
  const liveInstalmentObligationIds = new Set(
    loans.flatMap((loan) =>
      loan.instalments
        .filter((entry) => entry.status === 'open' && entry.obligationId)
        .map((entry) => entry.obligationId as string),
    ),
  )
  for (const loan of [...loans, ...slice.loanArchive]) {
    for (const instalment of loan.instalments) {
      if (!instalment.obligationId) continue
      if (liveInstalmentObligationIds.has(instalment.obligationId)) continue
      const obligation = getObligation(ctx.state, instalment.obligationId)
      if (!obligation || outstandingAmount(obligation) <= 0) continue
      issues.push({
        path: `modules.${FINANCE_MODULE_ID}.loans.${loan.id}.instalments.${instalment.index}`,
        message:
          `Instalment ${instalment.index} on '${loan.id}' is ${instalment.status} but its obligation ` +
          `'${instalment.obligationId}' still owes ${outstandingAmount(obligation)} — no action can reach it`,
        code: 'finance_orphaned_instalment_obligation',
      })
    }
  }

  return issues
}

function buildReport(ctx: SimContext): ReportSection | null {
  return buildFinanceReport(ctx)
}

export const financeModule: SimulationModule = {
  id: FINANCE_MODULE_ID,
  version: '0.1.0',
  // The obligation ledger must have its slice before a loan instalment can
  // be written into it, and the scheduled-event queue before a review can be
  // put on the calendar.
  dependsOn: ['scheduledEvents', 'obligations'],
  hooks: {
    beforeOwnerActions: [beforeOwnerActionsHook],
  },
  buildReport,
  validate,
  stateSchema: FinanceModuleStateSchema,
}

export { createInitialFinanceModuleState }
