import type { CardlessRunResult } from './simRunner'
import {
  summarizeRun,
  type RunSummary,
  type ReputationIdentity,
} from './cardlessPlaytest'
import { auditRunForContradictions } from './contradictionAudit'
import type { PolicyBotId } from './policyBots'
import type { StrategyComparisonRun } from './balanceRuns'

// Phase 20 §20.11 — Strategy comparison report.
//
// Takes the matrix of policy-bot runs and shows whether they produced
// *different* tavern outcomes: different reputations, different
// dominant customer groups, different seed family counts.
//
// "Distinct" is measured by simple set/coin gap rules. The readiness
// gate fails when the strategies all collapse to the same identity —
// that would mean inputs do not actually change the world.

export type StrategyRow = {
  botId: PolicyBotId
  summary: RunSummary
  contradictions: number
}

export type StrategyComparisonReport = {
  rows: StrategyRow[]
  distinctIdentityKeys: string[]
  distinctDominantCustomerGroups: string[]
  rentSurvivalRates: Record<PolicyBotId, boolean>
  endingCoinSpread: number
  diverseEnoughForReadiness: boolean
}

function diversityOf(rows: StrategyRow[]): {
  identities: string[]
  customers: string[]
  endingCoinSpread: number
  rentSurvival: Record<PolicyBotId, boolean>
} {
  const identitySet = new Set<string>()
  const customerSet = new Set<string>()
  const coins: number[] = []
  const rentSurvival: Record<string, boolean> = {}
  for (const row of rows) {
    identitySet.add(row.summary.reputationIdentity.identityKey)
    if (row.summary.dominantCustomerGroup) {
      customerSet.add(row.summary.dominantCustomerGroup)
    }
    coins.push(row.summary.finalCoin)
    rentSurvival[row.botId] = row.summary.rentPaymentsMissed === 0
  }
  const min = coins.length === 0 ? 0 : Math.min(...coins)
  const max = coins.length === 0 ? 0 : Math.max(...coins)
  return {
    identities: Array.from(identitySet).sort(),
    customers: Array.from(customerSet).sort(),
    endingCoinSpread: max - min,
    rentSurvival: rentSurvival as Record<PolicyBotId, boolean>,
  }
}

export function buildStrategyComparison(
  matrix: ReadonlyArray<StrategyComparisonRun>,
): StrategyComparisonReport {
  const rows: StrategyRow[] = matrix.map(({ botId, run }) => ({
    botId,
    summary: summarizeRun(run),
    contradictions: auditRunForContradictions(run).contradictionsFound.length,
  }))
  const diversity = diversityOf(rows)

  // Phase 20 §20.11 — "distinct outcomes" rule of thumb: at least two
  // different reputation identities + at least two different dominant
  // customer groups OR a non-trivial coin spread.
  const enoughIdentities = diversity.identities.length >= 2
  const enoughCustomers = diversity.customers.length >= 2
  const wideCoinSpread = diversity.endingCoinSpread > 50

  return {
    rows,
    distinctIdentityKeys: diversity.identities,
    distinctDominantCustomerGroups: diversity.customers,
    rentSurvivalRates: diversity.rentSurvival,
    endingCoinSpread: diversity.endingCoinSpread,
    diverseEnoughForReadiness:
      enoughIdentities && (enoughCustomers || wideCoinSpread),
  }
}

export type ReputationIdentitySummary = ReputationIdentity
