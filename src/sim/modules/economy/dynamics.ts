import type { SimContext } from '../../core/context'
import type { CustomerGroupState, TavernState } from '../../state/TavernState'
import { listObligations, outstandingAmount } from '../../contracts/obligations/index'
import type { DailyServiceResult, ServiceModuleState } from '../service/types'

import { getEconomyModuleState, writeEconomyState } from './state'
import type {
  EconomyModifiers,
  FinancialState,
  FinancialStatus,
  OperatingCostSettlement,
} from './types'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function serviceResult(state: TavernState): DailyServiceResult | undefined {
  return (state.modules['service'] as ServiceModuleState | undefined)?.result
}

function averageSatisfaction(state: TavernState): number {
  let weighted = 0
  let weight = 0
  for (const group of Object.values(state.customerGroups)) {
    if (group.patronage <= 0) continue
    const groupWeight = Math.max(1, group.patronage)
    weighted += group.satisfaction * groupWeight
    weight += groupWeight
  }
  return weight > 0 ? weighted / weight : 0
}

function servedRatio(state: TavernState): number {
  const flow = serviceResult(state)?.flow
  if (!flow?.ran) return 0
  const demand = Object.values(flow.demandByGroup).reduce((sum, n) => sum + n, 0)
  const served = Object.values(flow.servedByGroup).reduce((sum, n) => sum + n, 0)
  return demand > 0 ? clamp(served / demand, 0, 1) : 0
}

function areaHealth(state: TavernState): number {
  const facing = Object.values(state.areas).filter((area) =>
    area.tags.includes('customer_facing'),
  )
  if (facing.length === 0) return 50
  return facing.reduce(
    (sum, area) =>
      sum +
      clamp(
        area.cleanliness * 0.4 +
          area.condition * 0.4 +
          (100 - area.damage) * 0.2,
        0,
        100,
      ),
    0,
  ) / facing.length
}

function reputationHealth(state: TavernState): number {
  return clamp(
    (state.reputation.tasty +
      state.reputation.reliable +
      state.reputation.respectable +
      (100 - state.reputation.filthy) +
      (100 - state.reputation.dangerous)) /
      5,
    0,
    100,
  )
}

export function currentServiceHealthScore(state: TavernState): number {
  return round2(
    clamp(
      averageSatisfaction(state) * 0.65 +
        servedRatio(state) * 100 * 0.2 +
        reputationHealth(state) * 0.1 +
        areaHealth(state) * 0.05,
      0,
      100,
    ),
  )
}

function moveToward(current: number, target: number, down: number, up: number): number {
  if (target < current) return Math.max(target, current - down)
  return Math.min(target, current + up)
}

export function advanceEconomyModifiers(
  previous: EconomyModifiers,
  health: number,
  collapseStreak: number,
  recoveryStreak: number,
): EconomyModifiers {
  // One poor night is remembered in health but does not touch demand. The
  // persistence term begins on night two and reaches full force over ten.
  const persistence = clamp((collapseStreak - 1) / 10, 0, 1)
  const severity = clamp((58 - health) / 58, 0, 1)
  const targetDemand = clamp(1 - severity * persistence * 0.92, 0.2, 1.05)
  const recoveryLagDays =
    collapseStreak > 0
      ? Math.max(previous.recoveryLagDays, Math.ceil(collapseStreak / 2))
      : recoveryStreak > 0
        ? Math.max(0, previous.recoveryLagDays - 1)
        : previous.recoveryLagDays
  // Distrust can deepen immediately, but an improving night does not erase a
  // persisted collapse or a due price complaint until its recovery clock has
  // actually elapsed. `recoveryLagDays` is therefore a rule, not report-only
  // metadata.
  const demandStepTarget =
    recoveryLagDays > 0 && targetDemand > previous.demandFactor
      ? previous.demandFactor
      : targetDemand
  const demandFactor = round2(
    moveToward(previous.demandFactor, demandStepTarget, 0.1, 0.035),
  )
  const targetSpend = clamp(1 - severity * persistence * 0.55, 0.55, 1.05)
  const spendStepTarget =
    recoveryLagDays > 0 && targetSpend > previous.spendFactor
      ? previous.spendFactor
      : targetSpend
  const spendFactor = round2(
    moveToward(previous.spendFactor, spendStepTarget, 0.07, 0.025),
  )
  const priceToleranceFactor = round2(clamp(0.58 + health / 170, 0.58, 1.08))
  const distress = 1 - demandFactor
  return {
    demandFactor,
    spendFactor,
    priceToleranceFactor,
    supplierTermsFactor: round2(1 + distress * 0.5),
    wageDemandFactor: round2(1 + distress * 0.35),
    landlordRiskFactor: round2(1 + distress * 0.65),
    repairCostFactor: round2(1 + distress * 0.45),
    recoveryLagDays,
  }
}

/** Rival appeal turns the monthly opponent into a real group-specific choice. */
export function getCompetitorChoiceFactorForGroup(
  state: TavernState,
  groupId: string,
): number {
  const group = state.customerGroups[groupId]
  if (!group) return 1
  const monthly = state.modules['monthly'] as
    | { rivalTavern?: { appeal?: number } }
    | undefined
  const appeal = monthly?.rivalTavern?.appeal ?? 30
  const appealDelta = (appeal - 30) / 70
  const susceptibility = clamp(
    0.55 + group.priceSensitivity / 200 - group.loyalty / 150,
    0.35,
    1.15,
  )
  return round2(clamp(1 - appealDelta * 0.2 * susceptibility, 0.75, 1.08))
}

function externalArrears(state: TavernState): number {
  const rent = state.modules['monthly'] as
    | { rent?: { arrears?: number } }
    | undefined
  const payable = listObligations(state, { direction: 'payable' }).reduce(
    (sum, obligation) => sum + outstandingAmount(obligation),
    0,
  )
  return (rent?.rent?.arrears ?? 0) + payable
}

function transitionFinancial(
  state: TavernState,
  previous: FinancialState,
  settlement: OperatingCostSettlement,
  today: number,
): FinancialState {
  const arrears = previous.operatingArrears + externalArrears(state)
  const dailyNeed = Math.max(8, settlement.due)
  const distressed = state.coin < dailyNeed * 2 || arrears > 0
  const cashStressDays = distressed ? previous.cashStressDays + 1 : 0
  const healthyDays = distressed ? 0 : previous.healthyDays + 1
  let status: FinancialStatus = previous.status
  let insolvencyDays = previous.insolvencyDays
  let reason = previous.lastTransitionReason

  switch (previous.status) {
    case 'stable':
      if (cashStressDays >= 3) {
        status = 'cash_stress'
        reason = 'three days without a safe operating cushion'
      }
      break
    case 'cash_stress':
      if (!distressed && healthyDays >= 3) {
        status = 'stable'
        reason = 'the till and obligations recovered'
      } else if (cashStressDays >= 7 || arrears >= 20) {
        status = 'insolvent'
        insolvencyDays = 1
        reason = 'persistent arrears exceeded ordinary cash stress'
      }
      break
    case 'insolvent':
      insolvencyDays += 1
      if (!distressed && healthyDays >= 4) {
        status = 'recovering'
        reason = 'arrears cleared before closure'
      } else if (insolvencyDays >= 7) {
        status = 'temporarily_closed'
        reason = 'the tavern could no longer fund safe operation'
      }
      break
    case 'temporarily_closed':
      // Closure is explicit. Only `restructure_tavern` / `reopen_tavern`
      // moves it, so passive sales cannot silently reopen the doors.
      break
    case 'restructuring':
      // The financing action prepares a reopening; it does not silently open
      // the doors. Only the registered `reopen_tavern` owner action does that.
      break
    case 'recovering':
      if (distressed && cashStressDays >= 3) {
        status = 'cash_stress'
        reason = 'the recovery lost its operating cushion'
      } else if (healthyDays >= 7 && previous.restructuringBalance <= 0) {
        status = 'stable'
        reason = 'seven healthy days completed the recovery'
      }
      break
  }

  return {
    ...previous,
    status,
    statusSinceDay: status === previous.status ? previous.statusSinceDay : today,
    cashStressDays,
    insolvencyDays: status === 'insolvent' ? insolvencyDays : 0,
    healthyDays,
    lastTransitionReason: reason,
  }
}

export function updateEconomyDynamics(
  ctx: SimContext,
  settlement: OperatingCostSettlement,
): void {
  const today = ctx.state.calendar.totalDaysElapsed + 1
  const before = getEconomyModuleState(ctx.state)
  const score = currentServiceHealthScore(ctx.state)
  const health = round2(before.serviceHealth * 0.65 + score * 0.35)
  const collapsed = score < 40
  const recovering = score >= 60
  const collapseStreak = collapsed ? before.collapseStreak + 1 : Math.max(0, before.collapseStreak - 1)
  const recoveryStreak = recovering ? before.recoveryStreak + 1 : 0
  const modifiers = advanceEconomyModifiers(
    before.modifiers,
    health,
    collapseStreak,
    recoveryStreak,
  )
  const financial = transitionFinancial(
    ctx.state,
    before.financial,
    settlement,
    today,
  )

  writeEconomyState(
    ctx,
    (current) => ({
      ...current,
      serviceHealth: health,
      collapseStreak,
      recoveryStreak,
      modifiers,
      financial,
    }),
    'daily_dynamics',
  )

  if (financial.status !== before.financial.status) {
    ctx.addHistory({
      category: 'state_change',
      summary: `Financial status changed: ${before.financial.status} → ${financial.status}.`,
      tags: ['economy', 'financial_status', financial.status],
      relatedSystems: ['economy'],
      mechanicalRefs: ['economy.financial.status'],
    })
    ctx.addCause({
      source: 'economy.financial',
      sourceType: 'system',
      target: 'economy:financial.status',
      targetType: 'global',
      amount: financial.status === 'stable' ? -1 : 1,
      readable: financial.lastTransitionReason,
      tags: ['economy', 'financial_status', financial.status],
      relatedSystems: ['economy'],
    })
  }
}

function groupElasticity(group: CustomerGroupState): number {
  let elasticity = 0.6 + group.priceSensitivity / 220
  if (group.tags.includes('quality_sensitive') || group.preferredStockTags.includes('quality_sensitive')) {
    elasticity += 0.15
  }
  if (group.spendingProfile === 'cheap_volume') elasticity -= 0.1
  if (group.loyalty >= 70) elasticity -= 0.08
  return clamp(elasticity, 0.45, 1.25)
}

export function getDemandFactorForGroup(
  state: TavernState,
  groupId: string,
): number {
  const group = state.customerGroups[groupId]
  const base = getEconomyModuleState(state).modifiers.demandFactor
  if (!group) return base
  return round2(clamp(1 - (1 - base) * groupElasticity(group), 0.12, 1.1))
}

export function getSpendFactorForGroup(
  state: TavernState,
  groupId: string,
): number {
  const group = state.customerGroups[groupId]
  const base = getEconomyModuleState(state).modifiers.spendFactor
  if (!group) return base
  const resilience = clamp(group.wealth / 250 + group.loyalty / 500, 0, 0.3)
  return round2(clamp(base + (1 - base) * resilience, 0.5, 1.1))
}

export function getPriceToleranceFactorForGroup(
  state: TavernState,
  groupId: string,
): number {
  const group = state.customerGroups[groupId]
  const base = getEconomyModuleState(state).modifiers.priceToleranceFactor
  if (!group) return base
  const reputation = (state.reputation.tasty + state.reputation.reliable) / 200
  return round2(clamp(base + reputation * 0.12 - group.priceSensitivity / 1000, 0.5, 1.2))
}

export function isTavernTemporarilyClosed(state: TavernState): boolean {
  const status = getEconomyModuleState(state).financial.status
  return status === 'temporarily_closed' || status === 'restructuring'
}

/** Cash stress constrains consumables, casual cover and operating slack. */
export function getFinancialServiceCapacityFactor(state: TavernState): number {
  switch (getEconomyModuleState(state).financial.status) {
    case 'cash_stress':
      return 0.92
    case 'insolvent':
      return 0.75
    case 'restructuring':
      return 0
    case 'temporarily_closed':
      return 0
    case 'recovering':
      return 0.95
    case 'stable':
      return 1
  }
}
