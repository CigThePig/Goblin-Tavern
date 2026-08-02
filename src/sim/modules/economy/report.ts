import type { ReportSection } from '../../core/reports'

import type {
  EconomyAccountingTotals,
  EconomyModuleState,
  PolicyComplianceState,
} from './types'

function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}

export function formatEconomyAccountingLines(
  accounting: EconomyAccountingTotals,
): string[] {
  const lines = [
    `Sales: ${signed(accounting.sales)}`,
    `Stock purchases: ${signed(-accounting.stockPurchases)}`,
    `Wages: -${accounting.wages}`,
    `Rent: -${accounting.rent}`,
    `Maintenance: -${accounting.maintenance}`,
    `Construction: -${accounting.construction}`,
    `Upgrade upkeep: -${accounting.upgradeUpkeep}`,
    `Operating overhead: -${accounting.overhead}`,
    `Financing: -${accounting.financingCharges}`,
    `Fines: -${accounting.fines}`,
    `Supplier credit: ${accounting.creditPurchases} opened; ${accounting.invoicePayments} paid`,
    `Loans: +${accounting.loanProceeds} proceeds; -${accounting.loanPayments} repaid`,
    `Other: +${accounting.otherIncome} income; -${accounting.otherCosts} costs`,
  ]
  if (accounting.tabCollections !== 0 || accounting.tabCredit !== 0) {
    lines.push(
      `Tabs: +${accounting.tabCollections} collected; ${accounting.tabCredit} new credit`,
    )
  }
  if (accounting.inventoryWriteOffs !== 0 || accounting.writeOffs !== 0) {
    lines.push(
      `Write-offs: ${accounting.writeOffs} obligations; ${accounting.inventoryWriteOffs} inventory`,
    )
  }
  if (accounting.expeditionCosts !== 0 || accounting.expeditionReturns !== 0) {
    lines.push(
      `Expeditions: -${accounting.expeditionCosts} commissioned; ${accounting.expeditionReturns} returned stock value`,
    )
  }
  lines.push(
    `Outstanding: ${accounting.payableOutstanding} payable; ${accounting.receivableOutstanding} receivable`,
  )
  lines.push(`Cash net: ${signed(accounting.cashNet)}`)
  return lines
}

function policyLine(policy: PolicyComplianceState): string {
  const enforcer =
    policy.enforcerIds.length > 0 ? policy.enforcerIds.join(', ') : 'no enforcer'
  return `${policy.policyId}: intended ${policy.intendedEnabled ? 'on' : 'off'}; actual ${policy.status} (${Math.round(policy.compliance * 100)}%, ${enforcer}, ${policy.enforcementMinutes}m, ${policy.operatingCost} coin); support ${policy.support}, backlash ${policy.backlash}`
}

export function buildEconomyReportSection(
  state: EconomyModuleState,
): ReportSection {
  const lines: string[] = []
  lines.push(
    `Status: ${state.financial.status} — ${state.financial.lastTransitionReason}`,
  )
  lines.push(`Service health: ${state.serviceHealth.toFixed(1)}/100`)
  lines.push(
    `Demand ×${state.modifiers.demandFactor.toFixed(2)} · spend ×${state.modifiers.spendFactor.toFixed(2)} · price tolerance ×${state.modifiers.priceToleranceFactor.toFixed(2)}`,
  )
  lines.push(
    `Operating arrears: ${state.financial.operatingArrears} · restructuring balance: ${state.financial.restructuringBalance}`,
  )

  const record = state.lastDailyRecord
  if (record) {
    lines.push('')
    lines.push('Operating costs:')
    for (const line of record.costs.lines) {
      lines.push(
        `  ${line.kind}: ${line.paid}/${line.due} paid${line.shortfall > 0 ? ` (${line.shortfall} overdue)` : ''} — ${line.readable}`,
      )
    }
    lines.push('')
    lines.push('Accounting:')
    for (const line of formatEconomyAccountingLines(record.accounting)) {
      lines.push(`  ${line}`)
    }
    lines.push(
      `  Reconciled: ${record.reconciled ? 'yes' : 'NO'} (${record.openingCoin} → ${record.closingCoin})`,
    )
  }

  const policies = Object.values(state.policies).sort((a, b) =>
    a.policyId.localeCompare(b.policyId),
  )
  if (policies.length > 0) {
    lines.push('')
    lines.push('Policy compliance:')
    for (const policy of policies) lines.push(`  ${policyLine(policy)}`)
  }

  return {
    id: 'economy',
    source: 'economy',
    title: 'ECONOMY & OPERATIONS REPORT',
    lines,
    data: {
      serviceHealth: state.serviceHealth,
      collapseStreak: state.collapseStreak,
      recoveryStreak: state.recoveryStreak,
      modifiers: { ...state.modifiers },
      financial: { ...state.financial },
      ...(record
        ? {
            daily: {
              ...record,
              costs: {
                ...record.costs,
                lines: record.costs.lines.map((line) => ({
                  ...line,
                  tags: [...line.tags],
                })),
              },
              accounting: { ...record.accounting },
              notes: [...record.notes],
            },
          }
        : {}),
      policies: Object.fromEntries(
        policies.map((policy) => [
          policy.policyId,
          {
            ...policy,
            enforcerIds: [...policy.enforcerIds],
            evidence: policy.evidence.map((entry) => ({
              ...entry,
              tags: [...entry.tags],
            })),
          },
        ]),
      ),
    },
  }
}
