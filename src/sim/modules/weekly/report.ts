import type { ReportSection } from '../../core/reports'

import type {
  CustomerWeeklyTrendEntry,
  MaintenanceBacklogEntry,
  StaffWeeklyTrendEntry,
  WeeklyCommunityResult,
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

// Phase 34 §34.7 — Community report block. Compact, debug-readable;
// supplier/regular/faction trend entries surface their deltas plus the
// notes that motivated them, and rumours surface their strength and
// accuracy tag. Nothing here is card prose; the block is structural.
function formatCommunityLines(community: WeeklyCommunityResult): string[] {
  const lines: string[] = []

  if (
    community.supplierTrend.length === 0 &&
    community.regularTrend.length === 0 &&
    community.factionTrend.length === 0 &&
    community.rumours.length === 0
  ) {
    lines.push('  (quiet week)')
    return lines
  }

  if (community.supplierTrend.length > 0) {
    lines.push('  Suppliers:')
    for (const entry of community.supplierTrend) {
      const parts: string[] = []
      if (entry.relationshipDelta !== 0) {
        parts.push(`relationship ${formatSigned(entry.relationshipDelta)}`)
      }
      if (entry.reliabilityDelta !== 0) {
        parts.push(`reliability ${formatSigned(entry.reliabilityDelta)}`)
      }
      if (entry.pricePressureDelta !== 0) {
        parts.push(`price pressure ${formatSigned(entry.pricePressureDelta)}`)
      }
      lines.push(
        `    ${entry.supplierId}: ${parts.length > 0 ? parts.join(', ') : 'no change'}`,
      )
      if (entry.notes.length > 0) lines.push(`      ${entry.notes.join(' ')}`)
    }
  }

  if (community.regularTrend.length > 0) {
    lines.push('  Regulars:')
    for (const entry of community.regularTrend) {
      const parts: string[] = []
      if (entry.loyaltyDelta !== 0) parts.push(`loyalty ${formatSigned(entry.loyaltyDelta)}`)
      if (entry.irritationDelta !== 0) {
        parts.push(`irritation ${formatSigned(entry.irritationDelta)}`)
      }
      lines.push(
        `    ${entry.regularId}: ${parts.length > 0 ? parts.join(', ') : 'no change'} (${entry.visitsThisWeek} visit${entry.visitsThisWeek === 1 ? '' : 's'})`,
      )
      if (entry.notes.length > 0) lines.push(`      ${entry.notes.join(' ')}`)
    }
  }

  if (community.factionTrend.length > 0) {
    lines.push('  Factions:')
    for (const entry of community.factionTrend) {
      const parts: string[] = []
      if (entry.satisfactionDelta !== 0) {
        parts.push(`relationship ${formatSigned(entry.satisfactionDelta)}`)
      }
      if (entry.tensionDelta !== 0) {
        parts.push(`tension ${formatSigned(entry.tensionDelta)}`)
      }
      lines.push(
        `    ${entry.factionId}: ${parts.length > 0 ? parts.join(', ') : 'no change'}`,
      )
      if (entry.notes.length > 0) lines.push(`      ${entry.notes.join(' ')}`)
    }
  }

  if (community.rumours.length > 0) {
    lines.push('  Rumours:')
    for (const rumour of community.rumours) {
      lines.push(
        `    "${rumour.summary}" — strength ${rumour.strength}, ${rumour.accuracy}`,
      )
    }
  }

  for (const note of community.notes) {
    lines.push(`  ${note}`)
  }

  return lines
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
  lines.push('')

  // Phase 34 §34.7 — Community block always renders, even when quiet,
  // so downstream readers can rely on its presence.
  lines.push('Community:')
  lines.push(...formatCommunityLines(result.community))

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
      community: {
        supplierTrend: result.community.supplierTrend.map((s) => ({
          ...s,
          notes: [...s.notes],
        })),
        regularTrend: result.community.regularTrend.map((r) => ({
          ...r,
          notes: [...r.notes],
        })),
        factionTrend: result.community.factionTrend.map((f) => ({
          ...f,
          notes: [...f.notes],
        })),
        rumours: result.community.rumours.map((r) => ({
          ...r,
          tags: [...r.tags],
          involvedRefs: r.involvedRefs.map((ref) => ({ ...ref })),
        })),
        notes: [...result.community.notes],
      },
    },
  }
}
