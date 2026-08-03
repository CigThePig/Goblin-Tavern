import type { SimContext } from '../../core/context'
import type { SimulationHook, SimulationModule } from '../../core/module'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'
import { getObligation, outstandingAmount } from '../../contracts/obligations/index'
import { MONTHLY_MODULE_ID } from '../monthly/types'
import type { MonthlyModuleState } from '../monthly/types'

import { accumulateEvidence, suspicionFromEvidence } from './evidence'
import { checkRequirement } from './inspection'
import {
  closeSettledCases,
  ensureRegulatoryEventsRegistered,
  reviewWatchInterest,
} from './regulatoryEvents'
import {
  createInitialRegulatoryModuleState,
  getRegulatoryModuleState,
  listFindings,
  pruneEvidence,
  pruneFindings,
  watchRef,
} from './state'
import {
  MAX_ARCHIVED_CASES,
  MAX_EVIDENCE_ENTRIES,
  MAX_OPEN_CASES,
  REGULATORY_MODULE_ID,
  RegulatoryModuleStateSchema,
  WATCH_LABEL,
  evidenceWeight,
  liveEvidence,
  openCases,
} from './types'

// Expansion Phase 7 §7.3 — the regulatory module.

ensureRegulatoryEventsRegistered()

/**
 * Evidence accrues at `closing`, after the day's service.
 *
 * That beat is deliberate: an inspection is about what the tavern was like
 * while it was serving people, and `beforeOwnerActions` would read the rooms
 * before the night that dirtied them.
 */
const closingHook: SimulationHook = (ctx: SimContext): void => {
  accumulateEvidence(ctx)
  pruneEvidence(ctx)
  reviewWatchInterest(ctx)
  closeSettledCases(ctx)
  pruneFindings(ctx)
  syncInspectionProjection(ctx)
}

/**
 * Mirror the evidence weight into `modules.monthly.inspection.suspicion`.
 *
 * The monthly slice keeps its shape so the pressure calculator, the monthly
 * report and the `inspection` seeds keep reading the field they always read
 * — but nothing writes it except this projection, so it can no longer say
 * something the evidence does not.
 */
function syncInspectionProjection(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const suspicion = suspicionFromEvidence(ctx.state, today)
  const slice = getRegulatoryModuleState(ctx.state)
  // "How many times has the watch formally taken an interest?" — one per
  // case opened. A failed visit is not a second warning; it is what happened
  // inside the one the tavern already had.
  const warningCount = slice.totals.casesOpened
  ctx.modifyModuleState<MonthlyModuleState>(
    MONTHLY_MODULE_ID,
    (current) => {
      if (!current) return current as unknown as MonthlyModuleState
      if (
        current.inspection.suspicion === suspicion &&
        current.inspection.warningCount === warningCount
      ) {
        return current
      }
      return {
        ...current,
        inspection: {
          ...current.inspection,
          suspicion,
          warningCount,
        },
      }
    },
    { source: `${REGULATORY_MODULE_ID}.projection`, reason: 'inspection_projection' },
  )
}

function validate(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const slice = getRegulatoryModuleState(ctx.state)

  if (slice.evidence.length > MAX_EVIDENCE_ENTRIES) {
    issues.push({
      path: `modules.${REGULATORY_MODULE_ID}.evidence`,
      message: `${slice.evidence.length} evidence entries, above the ${MAX_EVIDENCE_ENTRIES} cap`,
      code: 'regulatory_evidence_over_cap',
    })
  }
  const cases = Object.values(slice.cases)
  if (cases.length > MAX_OPEN_CASES) {
    issues.push({
      path: `modules.${REGULATORY_MODULE_ID}.cases`,
      message: `${cases.length} open cases, above the ${MAX_OPEN_CASES} cap`,
      code: 'regulatory_cases_over_cap',
    })
  }
  if (slice.caseArchive.length > MAX_ARCHIVED_CASES) {
    issues.push({
      path: `modules.${REGULATORY_MODULE_ID}.caseArchive`,
      message: `${slice.caseArchive.length} archived cases, above the ${MAX_ARCHIVED_CASES} cap`,
      code: 'regulatory_archive_over_cap',
    })
  }

  for (const record of cases) {
    if (record.caseStatus === 'closed') {
      issues.push({
        path: `modules.${REGULATORY_MODULE_ID}.cases.${record.id}`,
        message: `Case '${record.id}' is closed but still live`,
        code: 'regulatory_terminal_still_live',
      })
    }
    // §7.3's own requirement, made checkable: an inspection promise with no
    // reachable visit is exactly what `OBL-03` was.
    const outstandingFindings = listFindings(ctx.state, { caseId: record.id }).filter(
      (finding) => finding.status === 'open' || finding.status === 'remediated',
    )
    // `escalated` is the top of the ladder: the watch has come back as many
    // times as it is going to, and the orders stand against the tavern until
    // somebody meets them. That is a deliberate terminal state, not a
    // promise nothing will keep, so it is exempt.
    if (
      outstandingFindings.length > 0 &&
      record.nextVisitDay === undefined &&
      record.caseStatus !== 'closed' &&
      record.caseStatus !== 'escalated'
    ) {
      issues.push({
        path: `modules.${REGULATORY_MODULE_ID}.cases.${record.id}`,
        message: `Case '${record.id}' has ${outstandingFindings.length} outstanding finding(s) and no visit scheduled`,
        code: 'regulatory_orders_without_followup',
      })
    }
    if (record.caseStatus === 'open' && record.nextVisitDay === undefined) {
      issues.push({
        path: `modules.${REGULATORY_MODULE_ID}.cases.${record.id}`,
        message: `Case '${record.id}' is open with no visit scheduled`,
        code: 'regulatory_case_without_visit',
      })
    }
  }

  for (const finding of Object.values(slice.findings)) {
    if (!(finding.caseId in slice.cases)) {
      issues.push({
        path: `modules.${REGULATORY_MODULE_ID}.findings.${finding.id}`,
        message: `Finding '${finding.id}' belongs to case '${finding.caseId}', which is not live`,
        code: 'regulatory_orphan_finding',
      })
    }
  }

  return issues
}

function buildReport(ctx: SimContext): ReportSection | null {
  const today = ctx.state.calendar.totalDaysElapsed
  const slice = getRegulatoryModuleState(ctx.state)
  const live = liveEvidence(slice, today)
  const cases = openCases(slice)
  if (live.length === 0 && cases.length === 0 && slice.caseArchive.length === 0) {
    return null
  }

  const weight = evidenceWeight(slice, today)
  const lines: string[] = [
    `${WATCH_LABEL}: standing ${slice.watch.standing}, interest ${Math.round(weight)} (${live.length} standing observation(s))`,
    `Records readiness: ${slice.records.readiness}`,
  ]
  for (const entry of [...live].sort((a, b) => b.severity - a.severity).slice(0, 5)) {
    lines.push(`  · (${entry.severity}) ${entry.readable}`)
  }
  for (const record of cases) {
    lines.push(
      `  ! ${record.readable} [${record.caseStatus}]` +
        (record.nextVisitDay !== undefined
          ? ` — next visit day ${record.nextVisitDay}`
          : ''),
    )
    for (const finding of listFindings(ctx.state, { caseId: record.id })) {
      if (finding.status !== 'open' && finding.status !== 'remediated') continue
      const met = checkRequirement(ctx.state, finding) ? 'met' : 'not met'
      lines.push(`      → ${finding.requirement} (${met})`)
    }
    for (const id of record.fineObligationIds) {
      const obligation = getObligation(ctx.state, id)
      if (!obligation) continue
      lines.push(
        `      ¤ ${obligation.readable}: ${outstandingAmount(obligation)} outstanding, due day ${obligation.dueOnDay ?? '—'}`,
      )
    }
  }

  return {
    id: 'regulatory',
    source: REGULATORY_MODULE_ID,
    title: 'INSPECTION',
    lines,
    data: {
      evidence: live.length,
      evidenceWeight: Math.round(weight),
      suspicion: suspicionFromEvidence(ctx.state, today),
      openCases: cases.length,
      archivedCases: slice.caseArchive.length,
      recordsReadiness: slice.records.readiness,
      watch: slice.watch,
      totals: slice.totals,
      cases: cases.map((record) => ({
        id: record.id,
        status: record.caseStatus,
        inspector: record.inspectorName,
        nextVisitDay: record.nextVisitDay,
        announced: record.announced,
        findings: listFindings(ctx.state, { caseId: record.id }).map((finding) => ({
          id: finding.id,
          dimension: finding.dimension,
          status: finding.status,
          requirement: finding.requirement,
          met: checkRequirement(ctx.state, finding),
        })),
      })),
    },
  }
}

export const regulatoryModule: SimulationModule = {
  id: REGULATORY_MODULE_ID,
  version: '0.1.0',
  dependsOn: ['scheduledEvents', 'obligations', 'areas', 'stock', 'economy'],
  hooks: {
    closing: [closingHook],
  },
  buildReport,
  validate,
  stateSchema: RegulatoryModuleStateSchema,
}

export { createInitialRegulatoryModuleState, watchRef }
