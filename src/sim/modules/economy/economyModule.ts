import { z } from 'zod'

import type { SimulationHook, SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ValidationIssue } from '../../state/types'
import { getStockModuleState } from '../stock/state'

import {
  EconomyAccountingTotalsSchema,
  reconcileDailyAccounting,
} from './accounting'
import { settleOperatingCosts } from './costs'
import { updateEconomyDynamics } from './dynamics'
import { ensureEconomyScheduledEventsRegistered } from './economyEvents'
import { evaluatePolicyCompliance } from './policies'
import { buildEconomyReportSection } from './report'
import {
  ECONOMY_MODULE_ID,
  MAX_ECONOMY_DAILY_HISTORY,
  capDailyHistory,
  createInitialEconomyModuleState,
  emptyOperatingCostSettlement,
  getEconomyModuleState,
  inventorySpoilageSnapshot,
  writeEconomyState,
} from './state'
import type { DailyEconomyRecord } from './types'

const startDayHook: SimulationHook = (ctx): void => {
  ensureEconomyScheduledEventsRegistered()
  const before = getEconomyModuleState(ctx.state)
  writeEconomyState(
    ctx,
    (current) => ({
      ...current,
      openingCoin: ctx.state.coin,
      openingFinancialStatus: before.financial.status,
      openingSpoilageByStock: inventorySpoilageSnapshot(ctx.state),
      todayCosts: emptyOperatingCostSettlement(),
      operatingWriteOffsToday: 0,
    }),
    'day_initialize',
  )
}

const beforeServiceHook: SimulationHook = (ctx): void => {
  evaluatePolicyCompliance(ctx)
}

function buildDailyRecord(ctx: SimContext, prior?: DailyEconomyRecord): DailyEconomyRecord {
  const economy = getEconomyModuleState(ctx.state)
  const accounting = reconcileDailyAccounting(
    ctx.state,
    economy.openingSpoilageByStock,
  )
  const cashMovement = ctx.state.coin - economy.openingCoin
  const reconciled = Math.abs(accounting.cashNet - cashMovement) < 1e-8
  const notes = prior ? [...prior.notes] : []
  const operatingShortfall = economy.todayCosts.lines.some(
    (line) => line.kind !== 'restructuring_payment' && line.shortfall > 0,
  )
  if (operatingShortfall && !notes.includes('Operating costs left arrears.')) {
    notes.push('Operating costs left arrears.')
  }
  const principalShortfall = economy.todayCosts.lines.some(
    (line) => line.kind === 'restructuring_payment' && line.shortfall > 0,
  )
  if (
    principalShortfall &&
    !notes.includes('Restructuring principal remained outstanding.')
  ) {
    notes.push('Restructuring principal remained outstanding.')
  }
  if (accounting.inventoryWriteOffs > 0 && !notes.includes('Perishable inventory deteriorated.')) {
    notes.push('Perishable inventory deteriorated.')
  }
  return {
    day: ctx.state.calendar.totalDaysElapsed + 1,
    openingCoin: economy.openingCoin,
    closingCoin: ctx.state.coin,
    serviceHealth: economy.serviceHealth,
    demandFactor: economy.modifiers.demandFactor,
    spendFactor: economy.modifiers.spendFactor,
    statusBefore: economy.openingFinancialStatus,
    statusAfter: economy.financial.status,
    costs: economy.todayCosts,
    accounting,
    ledgerEntries: getStockModuleState(ctx.state).ledger.length,
    reconciled,
    notes,
  }
}

const endDayHook: SimulationHook = (ctx): void => {
  // Wrap-up costs resolve after player responses, so a due obligation the
  // player explicitly chose to pay is not pre-empted by routine overhead.
  const costs = settleOperatingCosts(ctx)
  writeEconomyState(
    ctx,
    (current) => ({ ...current, todayCosts: costs }),
    'cost_settlement_recorded',
  )
  updateEconomyDynamics(ctx, costs)
  const record = buildDailyRecord(ctx)
  writeEconomyState(
    ctx,
    (current) => ({
      ...current,
      lastDailyRecord: record,
      dailyHistory: capDailyHistory([...current.dailyHistory, record]),
    }),
    'daily_record',
  )
}

/**
 * Wages and rent are posted in later calendar hooks. Their owners call this
 * after posting so the same daily record stays the exact cash reconciliation.
 */
export function refreshLatestDailyEconomyRecord(
  ctx: SimContext,
  note: string,
): void {
  const current = getEconomyModuleState(ctx.state)
  const prior = current.lastDailyRecord
  const today = ctx.state.calendar.totalDaysElapsed + 1
  if (!prior || prior.day !== today) return
  const record = buildDailyRecord(ctx, {
    ...prior,
    notes: prior.notes.includes(note) ? prior.notes : [...prior.notes, note],
  })
  const history = [...current.dailyHistory]
  let index = -1
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.day === today) {
      index = i
      break
    }
  }
  if (index >= 0) history[index] = record
  writeEconomyState(
    ctx,
    (state) => ({ ...state, lastDailyRecord: record, dailyHistory: history }),
    'late_accounting_refresh',
  )
}

function validateEconomy(ctx: SimContext): ValidationIssue[] {
  const state = getEconomyModuleState(ctx.state)
  const issues: ValidationIssue[] = []
  if (state.dailyHistory.length > MAX_ECONOMY_DAILY_HISTORY) {
    issues.push({
      path: 'modules.economy.dailyHistory',
      message: `Economy daily history exceeds ${MAX_ECONOMY_DAILY_HISTORY}`,
      code: 'economy_history_unbounded',
    })
  }
  if (state.financial.operatingArrears < 0) {
    issues.push({
      path: 'modules.economy.financial.operatingArrears',
      message: 'Operating arrears cannot be negative',
      code: 'negative_operating_arrears',
    })
  }
  if (state.lastDailyRecord && !state.lastDailyRecord.reconciled) {
    issues.push({
      path: 'modules.economy.lastDailyRecord.reconciled',
      message: 'Daily cash ledger does not reconcile to the till',
      code: 'economy_ledger_mismatch',
    })
  }
  return issues
}

const FinancialStatusSchema = z.enum([
  'stable',
  'cash_stress',
  'insolvent',
  'restructuring',
  'temporarily_closed',
  'recovering',
])

const ModifiersSchema = z.object({
  demandFactor: z.number().min(0),
  spendFactor: z.number().min(0),
  priceToleranceFactor: z.number().min(0),
  supplierTermsFactor: z.number().min(0),
  wageDemandFactor: z.number().min(0),
  landlordRiskFactor: z.number().min(0),
  repairCostFactor: z.number().min(0),
  recoveryLagDays: z.number().int().min(0),
})

const FinancialSchema = z.object({
  status: FinancialStatusSchema,
  statusSinceDay: z.number().int().min(0),
  cashStressDays: z.number().int().min(0),
  insolvencyDays: z.number().int().min(0),
  healthyDays: z.number().int().min(0),
  operatingArrears: z.number().int().min(0),
  restructuringBalance: z.number().int().min(0),
  lastTransitionReason: z.string(),
})

const CostKindSchema = z.enum([
  'overhead',
  'maintenance',
  'upgrade_upkeep',
  'emergency_premium',
  'financing_charge',
  'restructuring_payment',
  'arrears_payment',
  'policy_enforcement',
])

const CostLineSchema = z.object({
  kind: CostKindSchema,
  due: z.number().int().min(0),
  paid: z.number().int().min(0),
  shortfall: z.number().int().min(0),
  readable: z.string(),
  tags: z.array(z.string()),
})

const CostSettlementSchema = z.object({
  due: z.number().int().min(0),
  paid: z.number().int().min(0),
  shortfall: z.number().int().min(0),
  lines: z.array(CostLineSchema),
})

const DailyRecordSchema = z.object({
  day: z.number().int().min(1),
  openingCoin: z.number().min(0),
  closingCoin: z.number().min(0),
  serviceHealth: z.number().min(0).max(100),
  demandFactor: z.number().min(0),
  spendFactor: z.number().min(0),
  statusBefore: FinancialStatusSchema,
  statusAfter: FinancialStatusSchema,
  costs: CostSettlementSchema,
  accounting: EconomyAccountingTotalsSchema,
  ledgerEntries: z.number().int().min(0),
  reconciled: z.boolean(),
  notes: z.array(z.string()),
})

const PolicyStatusSchema = z.enum([
  'inactive',
  'compliant',
  'partial',
  'violated',
  'suspended',
])

const PolicyEvidenceSchema = z.object({
  day: z.number().int().min(0),
  status: PolicyStatusSchema,
  readable: z.string(),
  tags: z.array(z.string()),
})

const PolicySchema = z.object({
  policyId: z.string(),
  intendedEnabled: z.boolean(),
  status: PolicyStatusSchema,
  compliance: z.number().min(0).max(1),
  enforcerIds: z.array(z.string()),
  enforcementMinutes: z.number().int().min(0),
  operatingCost: z.number().int().min(0),
  support: z.number().min(0).max(100),
  backlash: z.number().min(0).max(100),
  fulfilledCount: z.number().int().min(0),
  violationCount: z.number().int().min(0),
  reversalCount: z.number().int().min(0),
  lastEvaluatedDay: z.number().int().min(0),
  evidence: z.array(PolicyEvidenceSchema),
})

export const EconomyModuleStateSchema = z.object({
  openingCoin: z.number().min(0),
  openingFinancialStatus: FinancialStatusSchema,
  openingSpoilageByStock: z.record(z.string(), z.number().min(0).max(100)),
  todayCosts: CostSettlementSchema,
  serviceHealth: z.number().min(0).max(100),
  collapseStreak: z.number().int().min(0),
  recoveryStreak: z.number().int().min(0),
  modifiers: ModifiersSchema,
  financial: FinancialSchema,
  policies: z.record(z.string(), PolicySchema),
  reserveStreak: z.number().int().min(0),
  operatingWriteOffsToday: z.number().int().min(0),
  lastDailyRecord: DailyRecordSchema.optional(),
  dailyHistory: z.array(DailyRecordSchema),
})

export const economyModule: SimulationModule = {
  id: ECONOMY_MODULE_ID,
  version: '0.1.0',
  dependsOn: ['areas', 'stock', 'staff', 'customers', 'ownerActions', 'service'],
  hooks: {
    startDay: [startDayHook],
    beforeService: [beforeServiceHook],
    endDay: [endDayHook],
  },
  buildReport: (ctx) => buildEconomyReportSection(getEconomyModuleState(ctx.state)),
  validate: validateEconomy,
  stateSchema: EconomyModuleStateSchema,
}
