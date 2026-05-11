import type { ReportSection } from '../../core/reports'

import type {
  MonthlyEconomyTotals,
  MonthlyResult,
  ReputationAxisShift,
  UpgradeReadinessEntry,
} from './types'

// Phase 15 §15.10 — Monthly report builder.
//
// Numeric-and-summary; no narrative prose, no card text. Reports surface
// the four pressures (rent, landlord, inspection, rival), the reputation
// shifts with tier labels, the upgrade readiness shortlist, and the next
// month's modifier.

const SOURCE = 'monthly'

function formatSigned(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

function formatEconomy(economy: MonthlyEconomyTotals): string[] {
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

function formatReputationShifts(shifts: ReputationAxisShift[]): string[] {
  if (shifts.length === 0) return ['  (no reputation shifts)']
  const lines: string[] = []
  for (const shift of shifts) {
    const deltaTag = shift.delta === 0 ? '' : ` (${formatSigned(shift.delta)})`
    const tierMove =
      shift.tierBefore === shift.tierAfter
        ? shift.tierAfter
        : `${shift.tierBefore} → ${shift.tierAfter}`
    lines.push(
      `  ${shift.axisId}: ${shift.before} → ${shift.after}${deltaTag} ${tierMove}`,
    )
  }
  return lines
}

function formatUpgradeReadiness(entries: UpgradeReadinessEntry[]): string[] {
  if (entries.length === 0) return ['  (no upgrade readiness signals)']
  const lines: string[] = []
  for (const entry of entries) {
    lines.push(`  ${entry.label}: ${entry.rationale}`)
  }
  return lines
}

export function buildMonthlyReportSection(result: MonthlyResult): ReportSection {
  const lines: string[] = []

  lines.push('Rent:')
  if (result.rent.paid) {
    lines.push(`  Paid ${result.rent.paidAmount} coin.`)
  } else {
    lines.push(
      `  UNPAID — ${result.rent.amountDue} coin owed (insufficient coin).`,
    )
  }
  lines.push(`  Missed payments to date: ${result.rent.missedPayments}`)
  if (result.rent.arrears > 0) {
    lines.push(`  Arrears: ${result.rent.arrears}`)
  }
  lines.push(`Ending Coin: ${result.endingCoin}`)
  lines.push('')

  lines.push('Landlord:')
  lines.push(
    `  Opinion: ${result.landlord.opinionBefore} → ${result.landlord.opinionAfter}`,
  )
  lines.push(
    `  Pressure: ${result.landlord.pressureBefore} → ${result.landlord.pressureAfter}`,
  )
  for (const note of result.landlord.notes) lines.push(`  - ${note}`)
  lines.push('')

  lines.push('Inspection:')
  lines.push(
    `  Suspicion: ${result.inspection.suspicionBefore} → ${result.inspection.suspicionAfter}`,
  )
  if (result.inspection.warningIssuedThisMonth) {
    lines.push(`  Warning issued (total ${result.inspection.warningCount}).`)
  }
  for (const note of result.inspection.notes) lines.push(`  - ${note}`)
  lines.push('')

  lines.push('Reputation:')
  lines.push(...formatReputationShifts(result.reputationShifts))
  lines.push('')

  lines.push('Customers:')
  if (result.bestGroupId) lines.push(`  Best group: ${result.bestGroupId}`)
  if (result.worstGroupId) lines.push(`  Worst group: ${result.worstGroupId}`)
  if (!result.bestGroupId && !result.worstGroupId) {
    lines.push('  (no customer data)')
  }
  lines.push('')

  lines.push('Upgrade Readiness:')
  lines.push(...formatUpgradeReadiness(result.upgradeReadiness))
  lines.push('')

  lines.push('Rival Tavern:')
  lines.push(
    `  Pressure: ${result.rivalTavern.pressureBefore} → ${result.rivalTavern.pressureAfter}`,
  )
  lines.push(
    `  Appeal: ${result.rivalTavern.appealBefore} → ${result.rivalTavern.appealAfter}`,
  )
  for (const note of result.rivalTavern.notes) lines.push(`  - ${note}`)
  lines.push('')

  lines.push('Economy:')
  for (const line of formatEconomy(result.economy)) lines.push(`  ${line}`)
  lines.push('')

  lines.push(`Active Modifier: ${result.activeModifier.label}`)
  lines.push(`Next Month Modifier: ${result.nextMonthModifier.label}`)

  if (result.strategicSummary.length > 0) {
    lines.push('')
    lines.push('Strategic Summary:')
    for (const note of result.strategicSummary) lines.push(`  - ${note}`)
  }

  return {
    id: 'monthly',
    source: SOURCE,
    title: `MONTHLY REPORT — Month ${result.monthNumber}, Year ${result.yearNumber}`,
    lines,
    data: {
      monthKey: result.monthKey,
      monthNumber: result.monthNumber,
      yearNumber: result.yearNumber,
      endDay: result.endDay,
      endingCoin: result.endingCoin,
      rent: { ...result.rent },
      landlord: { ...result.landlord, notes: [...result.landlord.notes] },
      inspection: {
        ...result.inspection,
        notes: [...result.inspection.notes],
      },
      rivalTavern: {
        ...result.rivalTavern,
        notes: [...result.rivalTavern.notes],
      },
      reputationShifts: result.reputationShifts.map((s) => ({
        ...s,
        reasons: [...s.reasons],
      })),
      upgradeReadiness: result.upgradeReadiness.map((u) => ({ ...u })),
      economy: { ...result.economy },
      activeModifier: { ...result.activeModifier, tags: [...result.activeModifier.tags] },
      nextMonthModifier: {
        ...result.nextMonthModifier,
        tags: [...result.nextMonthModifier.tags],
      },
      bestGroupId: result.bestGroupId,
      worstGroupId: result.worstGroupId,
      strategicSummary: [...result.strategicSummary],
    },
  }
}
