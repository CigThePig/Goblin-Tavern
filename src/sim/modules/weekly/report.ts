import type { ReportSection } from '../../core/reports'

import type {
  CustomerWeeklyTrendEntry,
  MaintenanceBacklogEntry,
  StaffWeeklyTrendEntry,
  WeeklyEconomyTotals,
  WeeklyResult,
  WeeklySignalTotals,
} from './types'

// Phase 14 §14.9 — Weekly report builder.
//
// The weekly module emits this section once per week, on the day the
// week was finalized. The shape is intentionally numeric-and-summary;
// no narrative prose, no card text (Phase 14 §"Do Not Do").

const SOURCE = 'weekly'

function formatSigned(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

function formatEconomyLines(economy: WeeklyEconomyTotals): string[] {
  const lines: string[] = []
  lines.push(`Sales: ${formatSigned(economy.sales)}`)
  lines.push(`Purchases: ${formatSigned(-economy.purchases)}`)
  lines.push(`Repairs: ${formatSigned(-economy.repairs)}`)
  lines.push(`Wages: ${formatSigned(-economy.wages)}`)
  if (economy.rent > 0) {
    lines.push(`Rent: ${formatSigned(-economy.rent)}`)
  }
  if (economy.waste > 0) {
    lines.push(`Waste: ${formatSigned(-economy.waste)}`)
  }
  if (economy.other !== 0) {
    lines.push(`Other: ${formatSigned(economy.other)}`)
  }
  lines.push(`Net: ${formatSigned(economy.net)}`)
  return lines
}

function formatStaffTrendLines(staff: StaffWeeklyTrendEntry[]): string[] {
  if (staff.length === 0) return ['  (no staff)']
  const lines: string[] = []
  for (const entry of staff) {
    const deltas: string[] = []
    if (entry.moraleDelta !== 0) deltas.push(`morale ${formatSigned(entry.moraleDelta)}`)
    if (entry.stressDelta !== 0) deltas.push(`stress ${formatSigned(entry.stressDelta)}`)
    if (entry.fatigueDelta !== 0) deltas.push(`fatigue ${formatSigned(entry.fatigueDelta)}`)
    if (entry.loyaltyDelta !== 0) deltas.push(`loyalty ${formatSigned(entry.loyaltyDelta)}`)
    const change = deltas.length > 0 ? deltas.join(', ') : 'no change'
    lines.push(`  ${entry.staffId}: ${change}`)
    if (entry.notes.length > 0) {
      lines.push(`    ${entry.notes.join(' ')}`)
    }
  }
  return lines
}

function formatCustomerTrendLines(groups: CustomerWeeklyTrendEntry[]): string[] {
  if (groups.length === 0) return ['  (no customer groups)']
  const lines: string[] = []
  for (const entry of groups) {
    const deltas: string[] = []
    if (entry.patronageDelta !== 0) {
      deltas.push(`patronage ${formatSigned(entry.patronageDelta)}`)
    }
    if (entry.loyaltyDelta !== 0) {
      deltas.push(`loyalty ${formatSigned(entry.loyaltyDelta)}`)
    }
    const change = deltas.length > 0 ? deltas.join(', ') : 'no change'
    lines.push(
      `  ${entry.groupId}: ${change} (avg satisfaction ${entry.averageSatisfaction}, ${entry.totalTraffic} visitors)`,
    )
    if (entry.notes.length > 0) {
      lines.push(`    ${entry.notes.join(' ')}`)
    }
  }
  return lines
}

function formatMaintenanceLines(
  backlog: MaintenanceBacklogEntry[],
): string[] {
  if (backlog.length === 0) return ['  (no maintenance backlog)']
  const lines: string[] = []
  for (const entry of backlog) {
    lines.push(`  ${entry.areaId}: ${entry.reasons.join(', ')}`)
  }
  return lines
}

function formatSignalLines(signals: WeeklySignalTotals): string[] {
  return [
    `  Cheap ${formatSigned(signals.cheap)}`,
    `  Filthy ${formatSigned(signals.filthy)}`,
    `  Dangerous ${formatSigned(signals.dangerous)}`,
    `  Tasty ${formatSigned(signals.tasty)}`,
    `  Reliable ${formatSigned(signals.reliable)}`,
  ]
}

export function buildWeeklyReportSection(result: WeeklyResult): ReportSection {
  const lines: string[] = []
  lines.push('Economy:')
  for (const line of formatEconomyLines(result.economy)) lines.push(`  ${line}`)
  lines.push('')

  lines.push('Wages:')
  if (result.wages.totalDue === 0) {
    lines.push('  No wages due.')
  } else if (result.wages.paid) {
    lines.push(`  Paid in full (${result.wages.paidAmount} coin).`)
  } else {
    lines.push(
      `  UNPAID — ${result.wages.totalDue} coin owed (insufficient coin).`,
    )
    if (result.wages.unpaidStaffIds.length > 0) {
      lines.push(`  Affected: ${result.wages.unpaidStaffIds.join(', ')}`)
    }
  }
  lines.push('')

  lines.push('Staff:')
  lines.push(...formatStaffTrendLines(result.staffTrend))
  lines.push('')

  lines.push('Customers:')
  lines.push(...formatCustomerTrendLines(result.customerTrend))
  if (result.bestGroupId) {
    lines.push(`  Best group: ${result.bestGroupId}`)
  }
  if (result.worstGroupId) {
    lines.push(`  Worst group: ${result.worstGroupId}`)
  }
  lines.push('')

  lines.push('Maintenance:')
  lines.push(...formatMaintenanceLines(result.maintenance))
  lines.push('')

  if (result.topRevenueSource) {
    lines.push(`Top revenue source: ${result.topRevenueSource}`)
  }
  if (result.largestCost) {
    lines.push(`Largest cost: ${result.largestCost}`)
  }
  if (result.topRevenueSource || result.largestCost) {
    lines.push('')
  }

  lines.push('Signals:')
  lines.push(...formatSignalLines(result.signals))

  return {
    id: 'weekly',
    source: SOURCE,
    title: `WEEKLY REPORT — Week ${result.weekNumber}, Month ${result.monthNumber}`,
    lines,
    data: {
      weekKey: result.weekKey,
      weekNumber: result.weekNumber,
      monthNumber: result.monthNumber,
      yearNumber: result.yearNumber,
      endDay: result.endDay,
      economy: { ...result.economy },
      wages: { ...result.wages, unpaidStaffIds: [...result.wages.unpaidStaffIds] },
      maintenance: result.maintenance.map((m) => ({
        ...m,
        reasons: [...m.reasons],
      })),
      staffTrend: result.staffTrend.map((s) => ({ ...s, notes: [...s.notes] })),
      customerTrend: result.customerTrend.map((c) => ({
        ...c,
        notes: [...c.notes],
      })),
      signals: { ...result.signals },
      signalNotes: [...result.signalNotes],
      topRevenueSource: result.topRevenueSource,
      largestCost: result.largestCost,
      bestGroupId: result.bestGroupId,
      worstGroupId: result.worstGroupId,
      supplierInvoices: result.supplierInvoices.map((s) => ({
        ...s,
        relatedStockIds: [...s.relatedStockIds],
      })),
    },
  }
}
