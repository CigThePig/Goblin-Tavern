import type { SimContext } from '../../core/context'
import type { SimulationModule } from '../../core/module'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'

import { ensureObligationEventsRegistered } from './obligationEvents'
import {
  MAX_CLOSED_OBLIGATIONS,
  MAX_OPEN_OBLIGATIONS,
  OBLIGATIONS_MODULE_ID,
  ObligationsModuleStateSchema,
  createInitialObligationsModuleState,
  listObligations,
  readObligationsSlice,
  totalOutstanding,
} from './state'
import { graceEndsOnDay, outstandingAmount } from './lifecycle'
import { isTerminalContractStatus } from './types'

// Expansion Phase 1 §1.2 — the obligation ledger module.
//
// Registering the shared mechanical events at import time (rather than in a
// hook) means any pipeline containing this module can schedule an
// `obligation_due` before its first day runs, and a pipeline built WITHOUT
// it will correctly reject those schedules as unowned instead of quietly
// queueing a promise nothing will keep.
ensureObligationEventsRegistered()

const SOURCE = OBLIGATIONS_MODULE_ID

function validate(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const slice = readObligationsSlice(ctx.state)
  const open = Object.values(slice.records)

  if (open.length > MAX_OPEN_OBLIGATIONS) {
    issues.push({
      path: `modules.${OBLIGATIONS_MODULE_ID}.records`,
      message: `${open.length} open obligations, above the ${MAX_OPEN_OBLIGATIONS} cap`,
      code: 'obligations_open_over_cap',
    })
  }
  if (slice.closed.length > MAX_CLOSED_OBLIGATIONS) {
    issues.push({
      path: `modules.${OBLIGATIONS_MODULE_ID}.closed`,
      message: `${slice.closed.length} archived obligations, above the ${MAX_CLOSED_OBLIGATIONS} cap`,
      code: 'obligations_closed_over_cap',
    })
  }

  for (const record of open) {
    // A terminal record has no business being in the live map: it means a
    // domain wrote the status without going through `upsertObligation`, and
    // the record would then be invisible to the archive that answers "what
    // happened to that debt?".
    if (isTerminalContractStatus(record.status)) {
      issues.push({
        path: `modules.${OBLIGATIONS_MODULE_ID}.records.${record.id}`,
        message: `Obligation '${record.id}' is ${record.status} but still in the live ledger`,
        code: 'obligations_terminal_still_live',
      })
    }
    if (record.paid + record.forgiven > record.principal + record.accruedCharges) {
      issues.push({
        path: `modules.${OBLIGATIONS_MODULE_ID}.records.${record.id}`,
        message: `Obligation '${record.id}' has been over-settled`,
        code: 'obligations_over_settled',
      })
    }
    if (record.history.length === 0) {
      issues.push({
        path: `modules.${OBLIGATIONS_MODULE_ID}.records.${record.id}`,
        message: `Obligation '${record.id}' has no recorded transitions`,
        code: 'obligations_no_history',
      })
    }
  }

  return issues
}

function buildReport(ctx: SimContext): ReportSection | null {
  const slice = readObligationsSlice(ctx.state)
  const open = listObligations(ctx.state)
  if (open.length === 0 && slice.closed.length === 0) return null

  const payable = totalOutstanding(ctx.state, 'payable')
  const receivable = totalOutstanding(ctx.state, 'receivable')
  const lines: string[] = [
    `Owed by you: ${payable}`,
    `Owed to you: ${receivable}`,
  ]
  for (const record of open.slice(0, 8)) {
    const due =
      record.dueOnDay !== undefined ? ` (due day ${record.dueOnDay}` : ' ('
    const grace =
      record.status === 'grace'
        ? `, grace ends day ${graceEndsOnDay(record)}`
        : ''
    lines.push(
      `  - ${record.readable}: ${outstandingAmount(record)} outstanding [${record.status}]${due}${grace})`,
    )
  }

  return {
    id: 'obligations',
    source: SOURCE,
    title: 'OBLIGATIONS',
    lines,
    data: {
      open: open.length,
      payable,
      receivable,
      byStatus: open.reduce<Record<string, number>>((acc, record) => {
        acc[record.status] = (acc[record.status] ?? 0) + 1
        return acc
      }, {}),
      totals: slice.totals,
    },
  }
}

export const obligationsModule: SimulationModule = {
  id: OBLIGATIONS_MODULE_ID,
  version: '0.1.0',
  // The ledger's own timekeeping runs through registered scheduled events,
  // so this module needs no hooks of its own — the scheduler drives it.
  // `dependsOn` records the ordering requirement anyway: the scheduled-event
  // module must have initialised its slice before an obligation event fires.
  dependsOn: ['scheduledEvents'],
  buildReport,
  validate,
  stateSchema: ObligationsModuleStateSchema,
}

export { createInitialObligationsModuleState }
