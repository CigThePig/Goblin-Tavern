import type { SimContext } from '../../core/context'
import type { SimulationHook, SimulationModule } from '../../core/module'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'
import { getObligation, outstandingAmount } from '../../contracts/obligations/index'

import {
  ensureTenancySchedule,
  ensureTenancyEventsRegistered,
} from './tenancyEvents'
import {
  ageLandlordBeliefs,
  createInitialTenancyModuleState,
  getTenancyModuleState,
  landlordRef,
  upsertRepairRequest,
} from './state'
import {
  arrearsOutstanding,
  effectiveRent,
  rentOutstanding,
  syncTenancyStatus,
  updateLandlordConcern,
} from './tenancy'
import {
  LANDLORD_LABEL,
  MAX_REPAIR_REQUESTS,
  MAX_TENANCY_NOTICES,
  TENANCY_MODULE_ID,
  TenancyModuleStateSchema,
  liveNotice,
} from './types'

// Expansion Phase 7 §7.2 — the tenancy module.

ensureTenancyEventsRegistered()

const beforeOwnerActionsHook: SimulationHook = (ctx: SimContext): void => {
  // Open the tenancy, keep the current period billed, and keep the ladder's
  // events on the calendar. Idempotent — a fresh run, a migrated save and a
  // reload all converge here rather than relying on a one-off call.
  ensureTenancySchedule(ctx)
  updateLandlordConcern(ctx)
  ageLandlordBeliefs(ctx)
  completeScheduledRepairs(ctx)
  syncTenancyStatus(ctx)
}

/**
 * The landlord's tradesmen turn up on the day they said they would.
 *
 * A repair the landlord accepted is a real promise: it restores the area's
 * condition through the same `modifyArea` path an owner repair uses, so the
 * player can see it happen and every downstream system (deterioration,
 * capacity, inspection evidence) reads the same number.
 */
function completeScheduledRepairs(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  for (const repair of getTenancyModuleState(ctx.state).repairs) {
    if (repair.status !== 'scheduled') continue
    if ((repair.scheduledForDay ?? Infinity) > today) continue
    const area = ctx.state.areas[repair.areaId]
    if (!area) {
      upsertRepairRequest(
        ctx,
        { ...repair, status: 'refused', resolvedOnDay: today, readable: 'The area is gone.' },
        'repair_area_missing',
      )
      continue
    }
    const restored = Math.min(100, area.condition + 25)
    ctx.modifyArea(
      repair.areaId,
      { condition: restored },
      {
        source: `${TENANCY_MODULE_ID}.repair`,
        reason: 'landlord_repair',
        readable: `${LANDLORD_LABEL}'s tradesmen worked on ${area.label}.`,
      },
    )
    upsertRepairRequest(
      ctx,
      {
        ...repair,
        status: 'completed',
        resolvedOnDay: today,
        readable: `${LANDLORD_LABEL}'s tradesmen repaired ${area.label} (condition ${area.condition} → ${restored}).`,
      },
      'repair_completed',
    )
    ctx.addHistory({
      category: 'system',
      summary: `${LANDLORD_LABEL}'s tradesmen repaired ${area.label}.`,
      tags: ['tenancy', 'repair', 'completed'],
      relatedActors: [landlordRef()],
      relatedSystems: [TENANCY_MODULE_ID],
    })
    ctx.addCause({
      source: `${TENANCY_MODULE_ID}.repair`,
      sourceType: 'system',
      target: `area:${repair.areaId}`,
      targetType: 'area',
      amount: restored - area.condition,
      direction: 'increase',
      weight: restored - area.condition,
      readable: `${LANDLORD_LABEL} repaired ${area.label}.`,
      tags: ['tenancy', 'repair', 'landlord'],
      relatedActors: [landlordRef()],
      expiresAfterDays: 14,
    })
  }
}

function validate(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const slice = getTenancyModuleState(ctx.state)

  if (slice.notices.length > MAX_TENANCY_NOTICES) {
    issues.push({
      path: `modules.${TENANCY_MODULE_ID}.notices`,
      message: `${slice.notices.length} notices, above the ${MAX_TENANCY_NOTICES} cap`,
      code: 'tenancy_notices_over_cap',
    })
  }
  if (slice.repairs.length > MAX_REPAIR_REQUESTS * 2) {
    issues.push({
      path: `modules.${TENANCY_MODULE_ID}.repairs`,
      message: `${slice.repairs.length} repair requests, above the ${MAX_REPAIR_REQUESTS * 2} cap`,
      code: 'tenancy_repairs_over_cap',
    })
  }

  const live = slice.notices.filter((notice) => notice.status === 'live')
  if (live.length > 1) {
    issues.push({
      path: `modules.${TENANCY_MODULE_ID}.notices`,
      message: `${live.length} notices are live at once; the ladder allows one`,
      code: 'tenancy_multiple_live_notices',
    })
  }

  const tenancy = slice.tenancy
  if (tenancy) {
    // The invariant that makes §7.2's "no eviction event without a real
    // owning record" checkable: an arrear id must point at a live obligation.
    for (const id of tenancy.arrearObligationIds) {
      if (!getObligation(ctx.state, id)) {
        issues.push({
          path: `modules.${TENANCY_MODULE_ID}.tenancy.arrearObligationIds`,
          message: `Arrear '${id}' points at an obligation that is no longer live`,
          code: 'tenancy_arrear_obligation_missing',
        })
      }
    }
    if (
      tenancy.currentObligationId &&
      !getObligation(ctx.state, tenancy.currentObligationId)
    ) {
      issues.push({
        path: `modules.${TENANCY_MODULE_ID}.tenancy.currentObligationId`,
        message: `Current rent obligation '${tenancy.currentObligationId}' is no longer live`,
        code: 'tenancy_current_obligation_missing',
      })
    }
    // A live period must have been BILLED. It need not still have an open
    // obligation: paying the rent settles and archives it, and the window
    // between the payment and the next rollover is the normal state of a
    // tavern that pays on time — flagging that would fail every well-run
    // route on the last day of every month.
    if (
      tenancy.tenancyStatus !== 'evicted' &&
      tenancy.tenancyStatus !== 'terminated' &&
      tenancy.lastBilledPeriodIndex < tenancy.periodIndex &&
      tenancy.rentPerPeriod > 0
    ) {
      issues.push({
        path: `modules.${TENANCY_MODULE_ID}.tenancy`,
        message: 'A live tenancy has no rent obligation for the current period',
        code: 'tenancy_period_not_billed',
      })
    }
  }

  return issues
}

function buildReport(ctx: SimContext): ReportSection | null {
  const slice = getTenancyModuleState(ctx.state)
  const tenancy = slice.tenancy
  if (!tenancy) return null

  const today = ctx.state.calendar.totalDaysElapsed
  const owed = rentOutstanding(ctx.state)
  const arrears = arrearsOutstanding(ctx.state)
  const notice = liveNotice(slice)
  const lines: string[] = [
    `Rent: ${effectiveRent(tenancy)} a month, month ${tenancy.periodIndex + 1} due day ${tenancy.periodEndsOnDay} (${tenancy.periodEndsOnDay - today} day(s))`,
    `Outstanding: ${owed}${arrears > 0 ? ` (${arrears} in arrears across ${tenancy.arrearObligationIds.length} month(s))` : ''}`,
    `${LANDLORD_LABEL}: opinion ${slice.landlord.opinion}, concern ${slice.landlord.concern} [${tenancy.tenancyStatus}]`,
  ]
  if (tenancy.concession) lines.push(`  ~ ${tenancy.concession.readable}`)
  if (notice) {
    lines.push(`  ! ${notice.readable}`)
    for (const remedy of notice.remedies) lines.push(`      → ${remedy}`)
  }
  if (slice.landlord.accessRequest) {
    lines.push(
      `  ? Access requested (${slice.landlord.accessRequest.reason}) — answer by day ${slice.landlord.accessRequest.deadlineDay}`,
    )
  }
  for (const repair of slice.repairs) {
    if (repair.status === 'requested' || repair.status === 'scheduled') {
      lines.push(`  · ${repair.readable}`)
    }
  }
  for (const belief of slice.landlord.beliefs.slice(0, 4)) {
    lines.push(`      (${belief.weight >= 0 ? '+' : ''}${belief.weight}) ${belief.readable}`)
  }

  return {
    id: 'tenancy',
    source: TENANCY_MODULE_ID,
    title: 'TENANCY',
    lines,
    data: {
      status: tenancy.tenancyStatus,
      rentPerPeriod: tenancy.rentPerPeriod,
      effectiveRent: effectiveRent(tenancy),
      periodIndex: tenancy.periodIndex,
      periodEndsOnDay: tenancy.periodEndsOnDay,
      outstanding: owed,
      arrears,
      missedPeriods: tenancy.missedPeriods,
      landlord: {
        opinion: slice.landlord.opinion,
        concern: slice.landlord.concern,
        accessGrants: slice.landlord.accessGrants,
        accessRefusals: slice.landlord.accessRefusals,
        negotiationsUsed: slice.landlord.negotiationsUsed,
      },
      ...(notice
        ? {
            notice: {
              kind: notice.kind,
              deadlineDay: notice.deadlineDay,
              cureAmount: notice.cureAmount,
              remedies: notice.remedies,
            },
          }
        : {}),
      currentOutstanding: tenancy.currentObligationId
        ? outstandingAmount(
            getObligation(ctx.state, tenancy.currentObligationId) ?? {
              principal: 0,
              paid: 0,
              accruedCharges: 0,
              forgiven: 0,
            } as never,
          )
        : 0,
      totals: slice.totals,
    },
  }
}

export const tenancyModule: SimulationModule = {
  id: TENANCY_MODULE_ID,
  version: '0.1.0',
  dependsOn: ['scheduledEvents', 'obligations', 'areas'],
  hooks: {
    beforeOwnerActions: [beforeOwnerActionsHook],
  },
  buildReport,
  validate,
  stateSchema: TenancyModuleStateSchema,
}

export { createInitialTenancyModuleState }
