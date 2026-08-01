import { z } from 'zod'

import type { SimulationModule, SimulationHook } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'
import type { TavernState } from '../../state/TavernState'
import {
  outstandingAmount,
  readObligationsSlice,
} from '../../contracts/obligations/index'

import { getStockModuleState } from '../stock/state'
import type { CoinLedgerEntry } from '../stock/types'
import {
  EconomyAccountingTotalsSchema,
  accountingFromEntries,
  addAccountingTotals,
} from '../economy/accounting'
import { refreshLatestDailyEconomyRecord } from '../economy/economyModule'
import {
  emptyEconomyAccounting,
  getEconomyModuleState,
} from '../economy/state'
import type { CustomerModuleState } from '../customers/types'
import type { RegularModuleState } from '../regulars/types'
import type {
  DailyServiceResult,
  ServiceModuleState,
} from '../service/types'

import {
  MAX_WEEKLY_HISTORY,
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
import {
  emptyWeeklyCommunityResult,
  resolveWeeklyCommunity,
} from './community'
import { buildWeeklyReportSection } from './report'
import type {
  CustomerWeeklyTrendEntry,
  WeeklyCommunityResult,
  WeeklyEconomyTotals,
  WeeklyModuleState,
  WeeklyResult,
  SupplierInvoice,
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
  // Phase 90 — `lastWeeklyResult` and `weeklyHistory` are durable across
  // the accumulator reset so the Reports → Weekly screen has data on days
  // 1–6 of the next week. Everything else is reset for the new accumulation
  // window.
  const previous = getWeeklyModuleState(state)
  const { satisfaction, patronage } = snapshotCustomerStarting(state)
  const carry: Pick<WeeklyModuleState, 'lastWeeklyResult' | 'weeklyHistory'> = {
    weeklyHistory: [...previous.weeklyHistory],
    ...(previous.lastWeeklyResult ? { lastWeeklyResult: previous.lastWeeklyResult } : {}),
  }
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
    accounting: emptyEconomyAccounting(),
    salesByStockId: {},
    signals: emptySignalTotals(),
    signalNotes: [],
    supplierInvoices: [],
    weekFinalized: false,
    // Phase 34 §34.1 — community accumulators.
    regularVisitsById: {},
    regularSceneCounts: {},
    groupSceneCounts: {},
    sceneTypeCounts: {},
    ...carry,
  }
}

function readCustomerModuleState(state: TavernState): CustomerModuleState | undefined {
  const slice = state.modules['customers'] as CustomerModuleState | undefined
  return slice
}

function readRegularModuleState(state: TavernState): RegularModuleState | undefined {
  return state.modules['regulars'] as RegularModuleState | undefined
}

function readServiceResult(state: TavernState): DailyServiceResult | undefined {
  const slice = state.modules['service'] as ServiceModuleState | undefined
  return slice?.result
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

function supplierInvoicesForWeek(state: TavernState): SupplierInvoice[] {
  const today = state.calendar.totalDaysElapsed + 1
  const weekStart = Math.max(1, today - 6)
  const obligations = readObligationsSlice(state)
  const records = [
    ...Object.values(obligations.records),
    ...obligations.closed.filter(
      (record) => record.lastTransitionOnDay >= weekStart,
    ),
  ]
  return records
    .filter(
      (record) =>
        record.direction === 'payable' &&
        (record.counterparty.kind === 'supplier' ||
          record.ownerModuleId === 'suppliers' ||
          record.tags.some((tag) =>
            ['supplier', 'invoice', 'credit_purchase'].includes(tag),
          )),
    )
    .map((record) => ({
      id: record.id,
      supplierId: record.counterparty.id,
      amount: outstandingAmount(record),
      dueWeek: Math.ceil((record.dueOnDay ?? today) / 7),
      paid: outstandingAmount(record) <= 0,
      relatedStockIds: record.tags
        .map((tag) => (tag.startsWith('stock:') ? tag.slice(6) : tag))
        .filter((tag) => state.stock[tag] !== undefined),
    }))
    .sort((a, b) => a.dueWeek - b.dueWeek || a.id.localeCompare(b.id))
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
  const dailyAccounting =
    getEconomyModuleState(ctx.state).lastDailyRecord?.accounting ??
    accountingFromEntries(dailyLedger)
  const accounting = addAccountingTotals(
    slice.accounting ?? emptyEconomyAccounting(),
    dailyAccounting,
  )
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

  // Phase 34 §34.1 — accumulate community signals.
  //
  // Regular visit counts come from the regulars module's `visitedToday`
  // list; scene counts come from the daily service result that landed
  // before this hook (service runs in `service`/`afterService`, weekly
  // accumulates in `endDay`). Both feed `resolveWeeklyCommunity` on
  // `endWeek` without re-walking history.
  const regularSlice = readRegularModuleState(ctx.state)
  const regularVisitsById = { ...slice.regularVisitsById }
  if (regularSlice) {
    for (const id of regularSlice.visitedToday) {
      regularVisitsById[id] = (regularVisitsById[id] ?? 0) + 1
    }
  }

  const serviceResult = readServiceResult(ctx.state)
  const regularSceneCounts = { ...slice.regularSceneCounts }
  const groupSceneCounts = { ...slice.groupSceneCounts }
  const sceneTypeCounts = { ...slice.sceneTypeCounts }
  if (serviceResult) {
    for (const scene of serviceResult.scenes) {
      sceneTypeCounts[scene.sceneType] =
        (sceneTypeCounts[scene.sceneType] ?? 0) + 1
      for (const id of scene.regularIds) {
        regularSceneCounts[id] = (regularSceneCounts[id] ?? 0) + 1
      }
      for (const id of scene.involvedGroupIds) {
        groupSceneCounts[id] = (groupSceneCounts[id] ?? 0) + 1
      }
    }
  }

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
      accounting,
      salesByStockId,
      signals: addSignalTotals(slice.signals, deltas),
      signalNotes: nextSignalNotes,
      regularVisitsById,
      regularSceneCounts,
      groupSceneCounts,
      sceneTypeCounts,
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
  const ledgerBeforeWages = getStockModuleState(ctx.state).ledger.length
  const wages = resolveWages(ctx)

  let economy: WeeklyEconomyTotals = { ...before.economy }
  const wageEntries = getStockModuleState(ctx.state).ledger.slice(ledgerBeforeWages)
  for (const entry of wageEntries) {
    economy = applyLedgerEntryToEconomy(economy, entry)
  }

  refreshLatestDailyEconomyRecord(ctx, 'Weekly wages posted.')
  const latestDailyAccounting =
    getEconomyModuleState(ctx.state).lastDailyRecord?.accounting
  let accounting = addAccountingTotals(
    before.accounting ?? emptyEconomyAccounting(),
    accountingFromEntries(wageEntries),
  )
  if (latestDailyAccounting) {
    accounting = {
      ...accounting,
      payableOutstanding: latestDailyAccounting.payableOutstanding,
      receivableOutstanding: latestDailyAccounting.receivableOutstanding,
    }
  }

  // Step 2 — read latest slice (wage payment may have rewritten it
  // through `spendCoin` → `appendEntry` → `modifyModuleState('stock')`,
  // but our own slice is untouched until we patch it below).
  const sliceAfterWages: WeeklyModuleState = { ...before, economy, accounting }

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

  const supplierInvoices = supplierInvoicesForWeek(ctx.state)

  // Phase 34 §34.2 — resolve community block after the rest of the
  // weekly result is in hand but before the report is built. The
  // community routine reads supplier/regular/faction state, the
  // recent social-action ring, and this week's scene/visit
  // accumulators; it mutates state for any meaningful relationship
  // shifts and produces a structured `WeeklyCommunityResult`.
  const baseForCommunity: WeeklyResult = {
    weekKey: sliceAfterWages.weekKey,
    weekNumber: sliceAfterWages.weekNumber,
    monthNumber: sliceAfterWages.monthNumber,
    yearNumber: sliceAfterWages.yearNumber,
    endDay: ctx.state.calendar.day,
    economy,
    accounting,
    wages,
    maintenance,
    staffTrend,
    customerTrend,
    signals: sliceAfterWages.signals,
    signalNotes: sliceAfterWages.signalNotes,
    supplierInvoices,
    ...highlights,
    ...bestWorst,
    community: emptyWeeklyCommunityResult(),
  }

  const community: WeeklyCommunityResult = resolveWeeklyCommunity({
    ctx,
    currentWeeklyState: sliceAfterWages,
    baseWeeklyResult: baseForCommunity,
  })

  const result: WeeklyResult = { ...baseForCommunity, community }

  // Phase 90 — append the finalized result to the bounded history buffer
  // so the Reports → Weekly screen and future analytics can read it
  // beyond the close day.
  const nextHistory = [...sliceAfterWages.weeklyHistory, result]
  const trimmedHistory =
    nextHistory.length > MAX_WEEKLY_HISTORY
      ? nextHistory.slice(nextHistory.length - MAX_WEEKLY_HISTORY)
      : nextHistory

  replaceSlice(
    ctx,
    {
      ...sliceAfterWages,
      lastWeeklyResult: result,
      weeklyHistory: trimmedHistory,
      weekFinalized: true,
      supplierInvoices,
    },
    'finalize_week',
  )
}

/**
 * A month-close charge is posted after `endWeek`, even when day 28 is also
 * the final day of the current week. Keep that completed week's durable
 * report aligned with the same final daily ledger instead of leaving rent
 * visible only in the monthly view.
 */
export function refreshLatestWeeklyAccounting(
  ctx: SimContext,
  lateEntries: ReadonlyArray<CoinLedgerEntry>,
): void {
  const slice = getWeeklyModuleState(ctx.state)
  const current = slice.lastWeeklyResult
  if (!current || current.endDay !== ctx.state.calendar.day) return

  let economy = { ...current.economy }
  for (const entry of lateEntries) economy = applyLedgerEntryToEconomy(economy, entry)
  const currentAccounting = current.accounting ?? emptyEconomyAccounting()
  const accounting =
    lateEntries.length > 0
      ? addAccountingTotals(currentAccounting, accountingFromEntries(lateEntries))
      : { ...currentAccounting }
  const latest = getEconomyModuleState(ctx.state).lastDailyRecord?.accounting
  const next: WeeklyResult = {
    ...current,
    economy,
    accounting: latest
      ? {
          ...accounting,
          payableOutstanding: latest.payableOutstanding,
          receivableOutstanding: latest.receivableOutstanding,
        }
      : accounting,
  }
  const weeklyHistory = slice.weeklyHistory.map((entry) =>
    entry.weekKey === current.weekKey ? next : entry,
  )
  writeSlice(
    ctx,
    { lastWeeklyResult: next, weeklyHistory },
    'late_accounting_refresh',
  )
}

function buildWeeklyReport(ctx: SimContext): ReportSection | null {
  const slice = getWeeklyModuleState(ctx.state)
  if (!slice.lastWeeklyResult) return null
  // Phase 90 — `lastWeeklyResult` now persists across the next week, so
  // the implicit "wiped tomorrow" one-shot is gone. Gate emission to the
  // close day explicitly: generateReports runs before advanceCalendar,
  // so on the close day `state.calendar.day` (the day-of-month) still
  // matches the result's `endDay`. On the next day it has advanced and
  // we skip emission until the next endWeek finalises a new result.
  if (slice.lastWeeklyResult.endDay !== ctx.state.calendar.day) return null
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
  supplierId: z.string().optional(),
  amount: z.number(),
  dueWeek: z.number(),
  paid: z.boolean(),
  relatedStockIds: z.array(z.string()),
})

// Phase 34 §34.1 — community block schemas. Validated as part of the
// weekly module state so a finalized result with malformed community
// data fails state validation immediately.
const EntityRefSchema = z.object({
  kind: z.enum([
    'staff',
    'customer_group',
    'area',
    'stock',
    'role',
    'system',
    'other',
    'culture',
    'faction',
    'supplier',
    'regular',
    'notable_npc',
    'local_event',
    'rumour',
    'tavern_identity',
  ]),
  id: z.string(),
})

const WeeklySupplierTrendSchema = z.object({
  supplierId: z.string(),
  relationshipDelta: z.number(),
  reliabilityDelta: z.number(),
  pricePressureDelta: z.number(),
  notes: z.array(z.string()),
})

const WeeklyRegularTrendSchema = z.object({
  regularId: z.string(),
  loyaltyDelta: z.number(),
  irritationDelta: z.number(),
  visitsThisWeek: z.number(),
  notes: z.array(z.string()),
})

const WeeklyFactionTrendSchema = z.object({
  factionId: z.string(),
  satisfactionDelta: z.number(),
  tensionDelta: z.number(),
  notes: z.array(z.string()),
})

const WeeklyCommunityRumourSchema = z.object({
  id: z.string(),
  sourceType: z.enum([
    'service_scene',
    'memory',
    'policy',
    'incident',
    'supplier',
    'faction',
  ]),
  sourceId: z.string(),
  strength: z.number().min(0).max(100),
  accuracy: z.enum(['true', 'partial', 'false', 'unknown']),
  tags: z.array(z.string()),
  involvedRefs: z.array(EntityRefSchema),
  summary: z.string(),
})

const WeeklyCommunityResultSchema = z.object({
  supplierTrend: z.array(WeeklySupplierTrendSchema),
  regularTrend: z.array(WeeklyRegularTrendSchema),
  factionTrend: z.array(WeeklyFactionTrendSchema),
  rumours: z.array(WeeklyCommunityRumourSchema),
  notes: z.array(z.string()),
})

const WeeklyResultSchema = z.object({
  weekKey: z.string(),
  weekNumber: z.number(),
  monthNumber: z.number(),
  yearNumber: z.number(),
  endDay: z.number(),
  economy: EconomySchema,
  accounting: EconomyAccountingTotalsSchema.optional(),
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
  community: WeeklyCommunityResultSchema,
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
  accounting: EconomyAccountingTotalsSchema.optional(),
  salesByStockId: z.record(z.string(), z.number()),
  signals: SignalSchema,
  signalNotes: z.array(z.string()),
  lastWeeklyResult: WeeklyResultSchema.optional(),
  weeklyHistory: z.array(WeeklyResultSchema),
  supplierInvoices: z.array(SupplierInvoiceSchema),
  weekFinalized: z.boolean(),
  // Phase 34 §34.1 — community accumulators.
  regularVisitsById: z.record(z.string(), z.number()),
  regularSceneCounts: z.record(z.string(), z.number()),
  groupSceneCounts: z.record(z.string(), z.number()),
  sceneTypeCounts: z.record(z.string(), z.number()),
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
