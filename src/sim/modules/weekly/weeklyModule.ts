import { z } from 'zod'

import type { SimulationModule, SimulationHook } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'
import type { TavernState } from '../../state/TavernState'

import { getStockModuleState } from '../stock/state'
import type { CoinLedgerEntry } from '../stock/types'
import type { CustomerModuleState } from '../customers/types'

import {
  WEEKLY_MODULE_ID,
  createInitialWeeklyModuleState,
  emptyEconomyTotals,
  emptySignalTotals,
  formatWeekKey,
  getWeeklyModuleState,
} from './state'
import { resolveWages } from './wages'
import { computeMaintenanceBacklog } from './maintenance'
import { addSignalTotals, computeDailySignals } from './signals'
import { computeCustomerTrend, computeStaffTrend } from './trends'
import { buildWeeklyReportSection } from './report'
import type {
  CustomerWeeklyTrendEntry,
  WeeklyEconomyTotals,
  WeeklyModuleState,
  WeeklyResult,
} from './types'

// Phase 14 — Weekly routine module.
//
// Responsibilities:
//   - On the first day of a new week (`dayOfWeek === 1`), reset the
//     weekly accumulators and snapshot starting satisfaction/patronage
//     for trend computation (§14.7 scope note: aggregate-only inputs).
//   - On `endDay` of every day, fold the day's ledger entries, customer
//     turnouts, area-damage delta, and incident count into the weekly
//     accumulators (§14.4, §14.5, §14.7, §14.8).
//   - On `endWeek` (engine runs this hook only on day 7 — see Phase 7
//     §7.4 calendar gating), resolve wages (§14.2), compute the staff
//     and customer trends (§14.6/§14.7), build the maintenance backlog
//     (§14.5), accumulate the supplier-invoice placeholder (§14.3),
//     and finalize the `WeeklyResult` consumed by the report.
//   - On `generateReports`, emit the WEEKLY REPORT section whenever
//     the slice carries a `lastWeeklyResult` from the current day.
//
// Phase 14 §"Do Not Do" — no rent, no landlord cards, no issue seeds,
// no narrative event content. The slice is data only.

const SOURCE = WEEKLY_MODULE_ID

const SUPPLIER_INVOICES_OPTION: 'A' | 'B' = 'A'

function writeSlice(
  ctx: SimContext,
  patch: Partial<WeeklyModuleState>,
  reason: string,
): void {
  ctx.modifyModuleState<WeeklyModuleState>(
    WEEKLY_MODULE_ID,
    (current) => {
      const base = current ?? createInitialWeeklyModuleState()
      return { ...base, ...patch }
    },
    { source: SOURCE, reason },
  )
}

function replaceSlice(
  ctx: SimContext,
  next: WeeklyModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<WeeklyModuleState>(
    WEEKLY_MODULE_ID,
    () => next,
    { source: SOURCE, reason },
  )
}

function snapshotCustomerStarting(state: TavernState): {
  satisfaction: Record<string, number>
  patronage: Record<string, number>
} {
  const satisfaction: Record<string, number> = {}
  const patronage: Record<string, number> = {}
  for (const group of Object.values(state.customerGroups)) {
    satisfaction[group.id] = group.satisfaction
    patronage[group.id] = group.patronage
  }
  return { satisfaction, patronage }
}

function freshAccumulator(state: TavernState): WeeklyModuleState {
  const { satisfaction, patronage } = snapshotCustomerStarting(state)
  return {
    weekKey: formatWeekKey(state),
    weekNumber: state.calendar.week,
    monthNumber: state.calendar.month,
    yearNumber: state.calendar.year,
    startedOnDay: state.calendar.day,
    startingSatisfaction: satisfaction,
    startingPatronage: patronage,
    trafficByGroup: {},
    satisfactionSumByGroup: {},
    satisfactionSamplesByGroup: {},
    shortageCountByGroup: {},
    shortageCountByStock: {},
    dayTypeCounts: {},
    economy: emptyEconomyTotals(),
    salesByStockId: {},
    signals: emptySignalTotals(),
    signalNotes: [],
    supplierInvoices: [],
    weekFinalized: false,
  }
}

function readCustomerModuleState(state: TavernState): CustomerModuleState | undefined {
  const slice = state.modules['customers'] as CustomerModuleState | undefined
  return slice
}

function totalDamageInState(state: TavernState): number {
  let sum = 0
  for (const area of Object.values(state.areas)) sum += area.damage
  return sum
}

function findRevenueAndCostHighlights(
  slice: WeeklyModuleState,
): { topRevenueSource?: string; largestCost?: string } {
  let topRevenueSource: string | undefined
  let topRevenue = 0
  for (const [stockId, amount] of Object.entries(slice.salesByStockId)) {
    if (amount > topRevenue) {
      topRevenue = amount
      topRevenueSource = stockId
    }
  }

  let largestCost: string | undefined
  let costAmount = 0
  if (slice.economy.purchases > costAmount) {
    costAmount = slice.economy.purchases
    largestCost = 'purchases'
  }
  if (slice.economy.repairs > costAmount) {
    costAmount = slice.economy.repairs
    largestCost = 'repairs'
  }
  if (slice.economy.wages > costAmount) {
    costAmount = slice.economy.wages
    largestCost = 'wages'
  }
  if (slice.economy.rent > costAmount) {
    costAmount = slice.economy.rent
    largestCost = 'rent'
  }
  if (slice.economy.waste > costAmount) {
    costAmount = slice.economy.waste
    largestCost = 'waste'
  }

  return {
    ...(topRevenueSource !== undefined ? { topRevenueSource } : {}),
    ...(largestCost !== undefined ? { largestCost } : {}),
  }
}

function findBestWorstGroup(
  trend: ReadonlyArray<CustomerWeeklyTrendEntry>,
): { bestGroupId?: string; worstGroupId?: string } {
  let best: { id: string; score: number } | undefined
  let worst: { id: string; score: number } | undefined
  for (const entry of trend) {
    const score = entry.averageSatisfaction + entry.patronageDelta * 5
    if (!best || score > best.score) best = { id: entry.groupId, score }
    if (!worst || score < worst.score) worst = { id: entry.groupId, score }
  }
  return {
    ...(best ? { bestGroupId: best.id } : {}),
    ...(worst ? { worstGroupId: worst.id } : {}),
  }
}

function applyLedgerEntryToEconomy(
  economy: WeeklyEconomyTotals,
  entry: CoinLedgerEntry,
): WeeklyEconomyTotals {
  const next: WeeklyEconomyTotals = { ...economy }
  const amount = entry.amount
  next.net += amount
  switch (entry.category) {
    case 'sales':
      next.sales += amount
      break
    case 'purchase':
      next.purchases += -amount
      break
    case 'repair':
      next.repairs += -amount
      break
    case 'wage':
      next.wages += -amount
      break
    case 'rent':
      next.rent += -amount
      break
    case 'waste':
      next.waste += -amount
      break
    case 'other':
      next.other += amount
      break
  }
  return next
}

function applySalesByStock(
  salesByStockId: Record<string, number>,
  entry: CoinLedgerEntry,
): Record<string, number> {
  if (entry.category !== 'sales') return salesByStockId
  // Phase 9 sales tag the stock id alongside `sale` and `buyer:*` tags;
  // pick the first tag that isn't one of those special prefixes.
  const stockTag = entry.tags.find(
    (t) => t !== 'sale' && !t.startsWith('buyer:'),
  )
  if (!stockTag) return salesByStockId
  return {
    ...salesByStockId,
    [stockTag]: (salesByStockId[stockTag] ?? 0) + entry.amount,
  }
}

function averageAleSalePrice(state: TavernState): number {
  const ale = state.stock['ale']
  if (!ale) return 0
  return ale.salePrice
}

// ---------- Hooks ----------

// Phase 7 §7.4 — the engine processes phases sequentially within a
// single `simulateDay` call. A module-local closure variable is the
// established pattern (see `serviceModule.ts` Phase 12) for handing a
// snapshot from one phase to a later phase in the same day.
let priorDamageTotal = 0

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  const slice = getWeeklyModuleState(ctx.state)
  const isFirstDayOfWeek = ctx.state.calendar.dayOfWeek === 1
  const previouslyFinalized = slice.weekFinalized || slice.weekKey === ''

  if (isFirstDayOfWeek || previouslyFinalized || slice.weekKey === '') {
    // Start a fresh accumulator window. Preserves nothing from the prior
    // week — `lastWeeklyResult` lived on the slice only long enough to
    // feed `generateReports`; by the time we hit the next day's startDay
    // it has already been emitted. Clearing it here keeps the buffer
    // shape predictable for the rest of the week.
    const fresh = freshAccumulator(ctx.state)
    replaceSlice(ctx, fresh, 'reset_week')
  }

  // Snapshot today's damage total so endDay can compute the daily delta.
  priorDamageTotal = totalDamageInState(ctx.state)
}

const endDayHook: SimulationHook = (ctx: SimContext): void => {
  const slice = getWeeklyModuleState(ctx.state)

  // Read the day's data sources.
  const stockSlice = getStockModuleState(ctx.state)
  const dailyLedger: ReadonlyArray<CoinLedgerEntry> = stockSlice.ledger
  const customerSlice = readCustomerModuleState(ctx.state)
  const turnouts = customerSlice?.turnouts ?? []

  let economy = slice.economy
  let salesByStockId = slice.salesByStockId
  for (const entry of dailyLedger) {
    economy = applyLedgerEntryToEconomy(economy, entry)
    salesByStockId = applySalesByStock(salesByStockId, entry)
  }

  // Per-group traffic, satisfaction sample, shortage tally.
  const trafficByGroup = { ...slice.trafficByGroup }
  const shortageCountByGroup = { ...slice.shortageCountByGroup }
  const shortageCountByStock = { ...slice.shortageCountByStock }
  const satisfactionSumByGroup = { ...slice.satisfactionSumByGroup }
  const satisfactionSamplesByGroup = { ...slice.satisfactionSamplesByGroup }
  let totalTraffic = 0
  let shortageCount = 0

  for (const turnout of turnouts) {
    trafficByGroup[turnout.groupId] =
      (trafficByGroup[turnout.groupId] ?? 0) + turnout.visitors
    totalTraffic += turnout.visitors

    const group = ctx.state.customerGroups[turnout.groupId]
    if (group) {
      satisfactionSumByGroup[turnout.groupId] =
        (satisfactionSumByGroup[turnout.groupId] ?? 0) + group.satisfaction
      satisfactionSamplesByGroup[turnout.groupId] =
        (satisfactionSamplesByGroup[turnout.groupId] ?? 0) + 1
    }

    if (turnout.shortages.length > 0) {
      shortageCountByGroup[turnout.groupId] =
        (shortageCountByGroup[turnout.groupId] ?? 0) + turnout.shortages.length
      shortageCount += turnout.shortages.length
      for (const s of turnout.shortages) {
        shortageCountByStock[s.stockId] =
          (shortageCountByStock[s.stockId] ?? 0) + 1
      }
    }
  }

  // Damage delta and incident count (best-effort: read from service slice
  // when available, otherwise fall back to whole-tavern damage drift).
  const damageNow = totalDamageInState(ctx.state)
  const damageGained = Math.max(0, damageNow - priorDamageTotal)
  const serviceSlice = ctx.state.modules['service'] as
    | { result?: { incidents?: ReadonlyArray<unknown> } }
    | undefined
  const incidentCount = serviceSlice?.result?.incidents?.length ?? 0

  const { deltas, notes } = computeDailySignals({
    state: ctx.state,
    dailyLedger,
    shortageCount,
    totalTraffic,
    damageGained,
    incidentCount,
    averageAleSalePrice: averageAleSalePrice(ctx.state),
  })

  const dayTypeCounts = { ...slice.dayTypeCounts }
  const dayType = ctx.state.calendar.dayType
  dayTypeCounts[dayType] = (dayTypeCounts[dayType] ?? 0) + 1

  const nextSignalNotes =
    notes.length > 0 ? [...slice.signalNotes, ...notes] : slice.signalNotes

  writeSlice(
    ctx,
    {
      trafficByGroup,
      shortageCountByGroup,
      shortageCountByStock,
      satisfactionSumByGroup,
      satisfactionSamplesByGroup,
      dayTypeCounts,
      economy,
      salesByStockId,
      signals: addSignalTotals(slice.signals, deltas),
      signalNotes: nextSignalNotes,
    },
    'accumulate_day',
  )

  // Reset the inter-hook tracking variable. The closure-scoped var
  // mirrors the Phase 12 service-module precedent — the engine processes
  // phases sequentially within a single `simulateDay` call, so a
  // module-local stash is safe.
  priorDamageTotal = 0
}

const endWeekHook: SimulationHook = (ctx: SimContext): void => {
  // Step 1 — wages. `resolveWages` already mutates staff state and
  // spends coin through the Phase 9 ledger; we then mirror the wage
  // spend into the weekly economy totals so the wage entry from the
  // just-appended daily ledger row never depends on the next day's
  // endDay to reach the report.
  const before = getWeeklyModuleState(ctx.state)
  const wages = resolveWages(ctx)

  let economy: WeeklyEconomyTotals = { ...before.economy }
  if (wages.paid && wages.paidAmount > 0) {
    economy = {
      ...economy,
      wages: economy.wages + wages.paidAmount,
      net: economy.net - wages.paidAmount,
    }
  }

  // Step 2 — read latest slice (wage payment may have rewritten it
  // through `spendCoin` → `appendEntry` → `modifyModuleState('stock')`,
  // but our own slice is untouched until we patch it below).
  const sliceAfterWages: WeeklyModuleState = { ...before, economy }

  // Step 3 — staff and customer trends. These mutate state but only
  // produce summary entries for the report; their math is gated on the
  // wage outcome and the week's aggregates.
  const staffTrend = computeStaffTrend(ctx, sliceAfterWages, wages)
  const customerTrend = computeCustomerTrend(ctx, sliceAfterWages)

  // Step 4 — maintenance backlog reflects end-of-week area state.
  const maintenance = computeMaintenanceBacklog(ctx.state)

  // Step 5 — revenue / cost highlights for the report header.
  const highlights = findRevenueAndCostHighlights(sliceAfterWages)
  const bestWorst = findBestWorstGroup(customerTrend)

  const supplierInvoices = SUPPLIER_INVOICES_OPTION === 'A'
    ? []
    : [...sliceAfterWages.supplierInvoices]

  const result: WeeklyResult = {
    weekKey: sliceAfterWages.weekKey,
    weekNumber: sliceAfterWages.weekNumber,
    monthNumber: sliceAfterWages.monthNumber,
    yearNumber: sliceAfterWages.yearNumber,
    endDay: ctx.state.calendar.day,
    economy,
    wages,
    maintenance,
    staffTrend,
    customerTrend,
    signals: sliceAfterWages.signals,
    signalNotes: sliceAfterWages.signalNotes,
    supplierInvoices,
    ...highlights,
    ...bestWorst,
  }

  replaceSlice(
    ctx,
    {
      ...sliceAfterWages,
      lastWeeklyResult: result,
      weekFinalized: true,
      supplierInvoices,
    },
    'finalize_week',
  )
}

function buildWeeklyReport(ctx: SimContext): ReportSection | null {
  const slice = getWeeklyModuleState(ctx.state)
  if (!slice.lastWeeklyResult) return null
  // Only emit a weekly report on the day endWeek finalized it. The
  // slice gets reset on the next day's startDay so this stays one-shot.
  return buildWeeklyReportSection(slice.lastWeeklyResult)
}

// ---------- Validation ----------

function validateWeekly(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const slice = getWeeklyModuleState(ctx.state)
  if (slice.economy.sales < 0) {
    issues.push({
      path: 'modules.weekly.economy.sales',
      message: 'Weekly sales total must be non-negative',
      code: 'negative_weekly_sales',
    })
  }
  if (slice.lastWeeklyResult) {
    const r = slice.lastWeeklyResult
    if (r.wages.totalDue < 0) {
      issues.push({
        path: 'modules.weekly.lastWeeklyResult.wages.totalDue',
        message: 'Weekly wage total must be non-negative',
        code: 'negative_wage_total',
      })
    }
  }
  return issues
}

// ---------- Module schema ----------

const EconomySchema = z.object({
  sales: z.number(),
  purchases: z.number(),
  repairs: z.number(),
  wages: z.number(),
  rent: z.number(),
  waste: z.number(),
  other: z.number(),
  net: z.number(),
})

const SignalSchema = z.object({
  cheap: z.number(),
  filthy: z.number(),
  dangerous: z.number(),
  tasty: z.number(),
  reliable: z.number(),
})

const WageResolutionSchema = z.object({
  totalDue: z.number().min(0),
  paid: z.boolean(),
  paidAmount: z.number().min(0),
  unpaidStaffIds: z.array(z.string()),
})

const MaintenanceEntrySchema = z.object({
  areaId: z.string(),
  reasons: z.array(z.string()),
  severity: z.number(),
})

const StaffTrendSchema = z.object({
  staffId: z.string(),
  moraleDelta: z.number(),
  stressDelta: z.number(),
  fatigueDelta: z.number(),
  loyaltyDelta: z.number(),
  notes: z.array(z.string()),
})

const CustomerTrendSchema = z.object({
  groupId: z.string(),
  patronageDelta: z.number(),
  loyaltyDelta: z.number(),
  averageSatisfaction: z.number(),
  totalTraffic: z.number(),
  shortageCount: z.number(),
  notes: z.array(z.string()),
})

const SupplierInvoiceSchema = z.object({
  id: z.string(),
  amount: z.number(),
  dueWeek: z.number(),
  paid: z.boolean(),
  relatedStockIds: z.array(z.string()),
})

const WeeklyResultSchema = z.object({
  weekKey: z.string(),
  weekNumber: z.number(),
  monthNumber: z.number(),
  yearNumber: z.number(),
  endDay: z.number(),
  economy: EconomySchema,
  wages: WageResolutionSchema,
  maintenance: z.array(MaintenanceEntrySchema),
  staffTrend: z.array(StaffTrendSchema),
  customerTrend: z.array(CustomerTrendSchema),
  topRevenueSource: z.string().optional(),
  largestCost: z.string().optional(),
  bestGroupId: z.string().optional(),
  worstGroupId: z.string().optional(),
  signals: SignalSchema,
  signalNotes: z.array(z.string()),
  supplierInvoices: z.array(SupplierInvoiceSchema),
})

const WeeklyModuleStateSchema = z.object({
  weekKey: z.string(),
  weekNumber: z.number(),
  monthNumber: z.number(),
  yearNumber: z.number(),
  startedOnDay: z.number(),
  startingSatisfaction: z.record(z.string(), z.number()),
  startingPatronage: z.record(z.string(), z.number()),
  trafficByGroup: z.record(z.string(), z.number()),
  satisfactionSumByGroup: z.record(z.string(), z.number()),
  satisfactionSamplesByGroup: z.record(z.string(), z.number()),
  shortageCountByGroup: z.record(z.string(), z.number()),
  shortageCountByStock: z.record(z.string(), z.number()),
  dayTypeCounts: z.record(z.string(), z.number()),
  economy: EconomySchema,
  salesByStockId: z.record(z.string(), z.number()),
  signals: SignalSchema,
  signalNotes: z.array(z.string()),
  lastWeeklyResult: WeeklyResultSchema.optional(),
  supplierInvoices: z.array(SupplierInvoiceSchema),
  weekFinalized: z.boolean(),
})

export const weeklyModule: SimulationModule = {
  id: WEEKLY_MODULE_ID,
  version: '0.1.0',
  // Weekly accumulates from the stock ledger and the customer turnouts,
  // and pays wages through `spendCoin` (Phase 9 ledger). Declaring the
  // upstream modules keeps engine ordering honest: stock/customers must
  // finalize their daily data before weekly reads it on endDay.
  dependsOn: ['stock', 'customers'],
  hooks: {
    startDay: [startDayHook],
    endDay: [endDayHook],
    endWeek: [endWeekHook],
  },
  buildReport: buildWeeklyReport,
  validate: validateWeekly,
  stateSchema: WeeklyModuleStateSchema,
}
