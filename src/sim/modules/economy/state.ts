import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'

import type {
  EconomyAccountingTotals,
  EconomyModuleState,
  EconomyModifiers,
  OperatingCostSettlement,
} from './types'

export const ECONOMY_MODULE_ID = 'economy'

/** Twenty-eight weeks of daily evidence; long enough for the 180-day gate. */
export const MAX_ECONOMY_DAILY_HISTORY = 196
export const MAX_POLICY_EVIDENCE = 12

export function emptyEconomyModifiers(): EconomyModifiers {
  return {
    demandFactor: 1,
    spendFactor: 1,
    priceToleranceFactor: 1,
    supplierTermsFactor: 1,
    wageDemandFactor: 1,
    landlordRiskFactor: 1,
    repairCostFactor: 1,
    recoveryLagDays: 0,
  }
}

export function emptyEconomyAccounting(): EconomyAccountingTotals {
  return {
    sales: 0,
    stockPurchases: 0,
    wages: 0,
    rent: 0,
    maintenance: 0,
    construction: 0,
    upgradeUpkeep: 0,
    overhead: 0,
    financingCharges: 0,
    fines: 0,
    tabCollections: 0,
    tabCredit: 0,
    creditPurchases: 0,
    invoicePayments: 0,
    loanProceeds: 0,
    loanPayments: 0,
    writeOffs: 0,
    inventoryWriteOffs: 0,
    expeditionCosts: 0,
    expeditionReturns: 0,
    otherIncome: 0,
    otherCosts: 0,
    payableOutstanding: 0,
    receivableOutstanding: 0,
    cashNet: 0,
  }
}

export function emptyOperatingCostSettlement(): OperatingCostSettlement {
  return { due: 0, paid: 0, shortfall: 0, lines: [] }
}

export function createInitialEconomyModuleState(): EconomyModuleState {
  return {
    openingCoin: 0,
    openingFinancialStatus: 'stable',
    openingSpoilageByStock: {},
    todayCosts: emptyOperatingCostSettlement(),
    serviceHealth: 70,
    collapseStreak: 0,
    recoveryStreak: 0,
    modifiers: emptyEconomyModifiers(),
    financial: {
      status: 'stable',
      statusSinceDay: 0,
      cashStressDays: 0,
      insolvencyDays: 0,
      healthyDays: 0,
      operatingArrears: 0,
      restructuringBalance: 0,
      lastTransitionReason: 'opening position',
    },
    policies: {},
    reserveStreak: 0,
    operatingWriteOffsToday: 0,
    dailyHistory: [],
  }
}

/**
 * Read current state additively. This also gives saves produced by an early
 * Phase-5 build any fields added later in the phase without fabricating debt.
 */
export function getEconomyModuleState(
  state: { modules: Record<string, unknown> },
): EconomyModuleState {
  const raw = state.modules[ECONOMY_MODULE_ID] as
    | Partial<EconomyModuleState>
    | undefined
  const defaults = createInitialEconomyModuleState()
  if (!raw) return defaults
  return {
    openingCoin: raw.openingCoin ?? defaults.openingCoin,
    openingFinancialStatus:
      raw.openingFinancialStatus ?? defaults.openingFinancialStatus,
    openingSpoilageByStock: { ...(raw.openingSpoilageByStock ?? {}) },
    todayCosts: raw.todayCosts ?? defaults.todayCosts,
    serviceHealth: raw.serviceHealth ?? defaults.serviceHealth,
    collapseStreak: raw.collapseStreak ?? defaults.collapseStreak,
    recoveryStreak: raw.recoveryStreak ?? defaults.recoveryStreak,
    modifiers: { ...defaults.modifiers, ...(raw.modifiers ?? {}) },
    financial: { ...defaults.financial, ...(raw.financial ?? {}) },
    policies: { ...(raw.policies ?? {}) },
    reserveStreak: raw.reserveStreak ?? defaults.reserveStreak,
    operatingWriteOffsToday:
      raw.operatingWriteOffsToday ?? defaults.operatingWriteOffsToday,
    ...(raw.lastDailyRecord !== undefined
      ? { lastDailyRecord: raw.lastDailyRecord }
      : {}),
    dailyHistory: [...(raw.dailyHistory ?? [])],
  }
}

export function writeEconomyState(
  ctx: SimContext,
  updater: (current: EconomyModuleState) => EconomyModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<EconomyModuleState>(
    ECONOMY_MODULE_ID,
    (current) => updater(getEconomyModuleState({
      modules: { [ECONOMY_MODULE_ID]: current },
    })),
    { source: `${ECONOMY_MODULE_ID}.${reason}`, reason },
  )
}

export function inventorySpoilageSnapshot(state: TavernState): Record<string, number> {
  const snapshot: Record<string, number> = {}
  for (const item of Object.values(state.stock)) {
    // Empty perishable slots still need an opening quality baseline: an owner
    // action can refill them before today's spoilage pass.
    if (!item.tags.includes('perishable')) continue
    snapshot[item.id] = item.spoilage
  }
  return snapshot
}

export function capDailyHistory<T>(history: T[]): T[] {
  return history.length > MAX_ECONOMY_DAILY_HISTORY
    ? history.slice(history.length - MAX_ECONOMY_DAILY_HISTORY)
    : history
}
