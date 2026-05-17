// Phase 90 — Weekly Overview projection.
//
// `buildWeeklyOverview(state)` is the single function the
// `<WeeklyOverview>` Svelte component renders against. It is pure:
// same inputs → same WeeklyOverviewData. No DOM, no globals, no
// Math.random(). Cards-contract §1 — the simulation is the source of
// truth; this projection resolves entity references to display labels
// but never invents data not already in state.

import { getWeeklyModuleState } from '../sim/modules/weekly/state'
import { staffRegistry } from '../sim/registries/staffRegistry'
import type { TavernState } from '../sim/state/TavernState'
import type {
  CustomerWeeklyTrendEntry,
  MaintenanceBacklogEntry,
  StaffWeeklyTrendEntry,
  SupplierInvoice,
  WeeklyCommunityResult,
  WeeklyResult,
  WeeklySignalTotals,
} from '../sim/modules/weekly/types'

export type WeeklyOverviewEmptyReason = 'no_week_yet'

export type WeeklyOverviewHeader = {
  weekKey: string
  weekNumber: number
  monthNumber: number
  yearNumber: number
  endDay: number
  /**
   * Days elapsed since this week closed. 0 means "today is the close
   * day"; >0 means the player has run more days since then. The
   * component uses this to surface a "(closed N days ago)" note.
   */
  daysSinceClose: number
}

export type WeeklyOverviewEconomyTopRevenue = {
  id: string
  label: string
}

export type WeeklyOverviewEconomy = {
  sales: number
  purchases: number
  wages: number
  rent: number
  repairs: number
  waste: number
  other: number
  net: number
  topRevenueSource?: WeeklyOverviewEconomyTopRevenue
  largestCost?: string
}

export type WeeklyOverviewWages = {
  totalDue: number
  paidAmount: number
  paid: boolean
  unpaidStaff: { id: string; name: string; roleLabel: string }[]
}

export type WeeklyOverviewSignals = {
  cheap: number
  filthy: number
  dangerous: number
  tasty: number
  reliable: number
  notes: string[]
}

export type CustomerGroupRow = {
  id: string
  label: string
  patronageDelta: number
  loyaltyDelta: number
  averageSatisfaction: number
  totalTraffic: number
  shortageCount: number
  isBest: boolean
  isWorst: boolean
  notes: string[]
}

export type StaffRow = {
  id: string
  name: string
  roleLabel: string
  moraleDelta: number
  stressDelta: number
  fatigueDelta: number
  loyaltyDelta: number
  notes: string[]
}

export type MaintenanceRow = {
  areaId: string
  areaLabel: string
  /**
   * Severity on the 0–100 scale used by `MaintenanceBacklogEntry`
   * (`src/sim/modules/weekly/maintenance.ts:8`). The component can pass
   * this directly to `pressureColor()` for tint without rescaling.
   */
  severity: number
  reasons: string[]
}

export type InvoiceRow = {
  id: string
  supplierLabel: string
  amount: number
  dueWeek: number
  paid: boolean
  relatedStock: string[]
}

export type WeeklyOverviewCustomerGroups = {
  rows: CustomerGroupRow[]
  bestGroupId?: string
  worstGroupId?: string
}

export type WeeklyOverviewStaff = { rows: StaffRow[] }
export type WeeklyOverviewMaintenance = { rows: MaintenanceRow[] }

export type WeeklyOverviewInvoices = {
  paidCount: number
  unpaidCount: number
  totalUnpaid: number
  rows: InvoiceRow[]
}

export type WeeklyOverviewCommunity = {
  suppliersTouched: number
  regularsTouched: number
  factionShifts: number
  rumoursActive: number
  notes: string[]
}

export type WeeklyComparison = {
  previousWeekKey: string
  netDelta: number
  salesDelta: number
  wagesDelta: number
  signalsDelta: {
    cheap: number
    filthy: number
    dangerous: number
    tasty: number
    reliable: number
  }
  averageSatisfactionDelta: number
}

export type WeeklyOverviewData = {
  hasResult: boolean
  /** Present when hasResult === false. */
  empty?: { reason: WeeklyOverviewEmptyReason; message: string }

  header?: WeeklyOverviewHeader
  economy?: WeeklyOverviewEconomy
  wages?: WeeklyOverviewWages
  signals?: WeeklyOverviewSignals
  customerGroups?: WeeklyOverviewCustomerGroups
  staff?: WeeklyOverviewStaff
  maintenance?: WeeklyOverviewMaintenance
  supplierInvoices?: WeeklyOverviewInvoices
  community?: WeeklyOverviewCommunity

  /** Present when at least one prior week exists in weeklyHistory. */
  comparison?: WeeklyComparison
}

const EMPTY_MESSAGE = 'Your first weekly summary appears after day 7.'

export function buildWeeklyOverview(state: TavernState): WeeklyOverviewData {
  const slice = getWeeklyModuleState(state)
  const latest = slice.lastWeeklyResult
  if (!latest) {
    return {
      hasResult: false,
      empty: { reason: 'no_week_yet', message: EMPTY_MESSAGE },
    }
  }

  return {
    hasResult: true,
    header: projectHeader(latest, state),
    economy: projectEconomy(latest, state),
    wages: projectWages(latest, state),
    signals: projectSignals(latest),
    customerGroups: projectCustomerGroups(latest, state),
    staff: projectStaff(latest, state),
    maintenance: projectMaintenance(latest, state),
    supplierInvoices: projectSupplierInvoices(latest, state),
    ...projectCommunityIfPresent(latest.community),
    ...projectComparisonIfPresent(slice.weeklyHistory, latest),
  }
}

function projectHeader(result: WeeklyResult, state: TavernState): WeeklyOverviewHeader {
  return {
    weekKey: result.weekKey,
    weekNumber: result.weekNumber,
    monthNumber: result.monthNumber,
    yearNumber: result.yearNumber,
    endDay: result.endDay,
    daysSinceClose: Math.max(0, daysSinceClose(state, result)),
  }
}

function daysSinceClose(state: TavernState, result: WeeklyResult): number {
  // `endDay` is `state.calendar.day` (day-of-month) at endWeek time. To
  // measure elapsed days across month/year rollovers we need an absolute
  // anchor — `totalDaysElapsed`. Reconstruct the absolute end-day from
  // (year, month, week) + the position within the week:
  //   absoluteEndDay = (year-1) * 12 * 28 + (month-1) * 28 + endDay
  const absoluteEndDay =
    (result.yearNumber - 1) * 12 * 28 +
    (result.monthNumber - 1) * 28 +
    result.endDay
  return state.calendar.totalDaysElapsed - absoluteEndDay
}

function projectEconomy(result: WeeklyResult, state: TavernState): WeeklyOverviewEconomy {
  const economy: WeeklyOverviewEconomy = {
    sales: result.economy.sales,
    purchases: result.economy.purchases,
    wages: result.economy.wages,
    rent: result.economy.rent,
    repairs: result.economy.repairs,
    waste: result.economy.waste,
    other: result.economy.other,
    net: result.economy.net,
  }
  if (result.topRevenueSource) {
    economy.topRevenueSource = {
      id: result.topRevenueSource,
      label: state.stock[result.topRevenueSource]?.label ?? result.topRevenueSource,
    }
  }
  if (result.largestCost) {
    economy.largestCost = result.largestCost
  }
  return economy
}

function projectWages(result: WeeklyResult, state: TavernState): WeeklyOverviewWages {
  const unpaidStaff = result.wages.unpaidStaffIds.map((id) => ({
    id,
    name: state.staff[id]?.name?.display ?? id,
    roleLabel: resolveRoleLabel(state, id),
  }))
  return {
    totalDue: result.wages.totalDue,
    paidAmount: result.wages.paidAmount,
    paid: result.wages.paid,
    unpaidStaff,
  }
}

function resolveRoleLabel(state: TavernState, staffId: string): string {
  const role = state.staff[staffId]?.role
  if (!role) return ''
  return staffRegistry.get(role)?.label ?? role
}

function projectSignals(result: WeeklyResult): WeeklyOverviewSignals {
  const s: WeeklySignalTotals = result.signals
  return {
    cheap: s.cheap,
    filthy: s.filthy,
    dangerous: s.dangerous,
    tasty: s.tasty,
    reliable: s.reliable,
    notes: [...result.signalNotes],
  }
}

function projectCustomerGroups(
  result: WeeklyResult,
  state: TavernState,
): WeeklyOverviewCustomerGroups {
  const rows: CustomerGroupRow[] = result.customerTrend.map((entry: CustomerWeeklyTrendEntry) => ({
    id: entry.groupId,
    label: state.customerGroups[entry.groupId]?.label ?? entry.groupId,
    patronageDelta: entry.patronageDelta,
    loyaltyDelta: entry.loyaltyDelta,
    averageSatisfaction: entry.averageSatisfaction,
    totalTraffic: entry.totalTraffic,
    shortageCount: entry.shortageCount,
    isBest: entry.groupId === result.bestGroupId,
    isWorst: entry.groupId === result.worstGroupId,
    notes: [...entry.notes],
  }))
  const out: WeeklyOverviewCustomerGroups = { rows }
  if (result.bestGroupId) out.bestGroupId = result.bestGroupId
  if (result.worstGroupId) out.worstGroupId = result.worstGroupId
  return out
}

function projectStaff(result: WeeklyResult, state: TavernState): WeeklyOverviewStaff {
  const rows: StaffRow[] = result.staffTrend.map((entry: StaffWeeklyTrendEntry) => ({
    id: entry.staffId,
    name: state.staff[entry.staffId]?.name?.display ?? entry.staffId,
    roleLabel: resolveRoleLabel(state, entry.staffId),
    moraleDelta: entry.moraleDelta,
    stressDelta: entry.stressDelta,
    fatigueDelta: entry.fatigueDelta,
    loyaltyDelta: entry.loyaltyDelta,
    notes: [...entry.notes],
  }))
  return { rows }
}

function projectMaintenance(
  result: WeeklyResult,
  state: TavernState,
): WeeklyOverviewMaintenance {
  const rows: MaintenanceRow[] = result.maintenance.map((entry: MaintenanceBacklogEntry) => ({
    areaId: entry.areaId,
    areaLabel: state.areas[entry.areaId]?.label ?? entry.areaId,
    severity: entry.severity,
    reasons: [...entry.reasons],
  }))
  return { rows }
}

function projectSupplierInvoices(
  result: WeeklyResult,
  state: TavernState,
): WeeklyOverviewInvoices {
  const rows: InvoiceRow[] = result.supplierInvoices.map((entry: SupplierInvoice) => {
    const supplier = state.world.suppliers[entry.id]
    const supplierLabel = supplier?.name?.display ?? supplier?.label ?? entry.id
    return {
      id: entry.id,
      supplierLabel,
      amount: entry.amount,
      dueWeek: entry.dueWeek,
      paid: entry.paid,
      relatedStock: entry.relatedStockIds.map(
        (stockId) => state.stock[stockId]?.label ?? stockId,
      ),
    }
  })
  const paidCount = rows.filter((r) => r.paid).length
  const unpaidCount = rows.length - paidCount
  const totalUnpaid = rows.filter((r) => !r.paid).reduce((sum, r) => sum + r.amount, 0)
  return { paidCount, unpaidCount, totalUnpaid, rows }
}

function projectCommunityIfPresent(
  community: WeeklyCommunityResult,
): Pick<WeeklyOverviewData, 'community'> {
  const suppliersTouched = community.supplierTrend.length
  const regularsTouched = community.regularTrend.length
  const factionShifts = community.factionTrend.length
  const rumoursActive = community.rumours.length
  if (
    suppliersTouched === 0 &&
    regularsTouched === 0 &&
    factionShifts === 0 &&
    rumoursActive === 0
  ) {
    return {}
  }
  return {
    community: {
      suppliersTouched,
      regularsTouched,
      factionShifts,
      rumoursActive,
      notes: [...community.notes],
    },
  }
}

function projectComparisonIfPresent(
  history: readonly WeeklyResult[],
  latest: WeeklyResult,
): Pick<WeeklyOverviewData, 'comparison'> {
  // `weeklyHistory` is oldest-first and contains `latest` as its last
  // entry (endWeek appends before generateReports runs). The previous
  // week is the entry immediately before it; absent if this is the
  // first finalized week.
  if (history.length < 2) return {}
  const previous = history[history.length - 2]
  if (!previous || previous.weekKey === latest.weekKey) return {}

  return {
    comparison: {
      previousWeekKey: previous.weekKey,
      netDelta: latest.economy.net - previous.economy.net,
      salesDelta: latest.economy.sales - previous.economy.sales,
      wagesDelta: latest.economy.wages - previous.economy.wages,
      signalsDelta: {
        cheap: latest.signals.cheap - previous.signals.cheap,
        filthy: latest.signals.filthy - previous.signals.filthy,
        dangerous: latest.signals.dangerous - previous.signals.dangerous,
        tasty: latest.signals.tasty - previous.signals.tasty,
        reliable: latest.signals.reliable - previous.signals.reliable,
      },
      averageSatisfactionDelta:
        averageCustomerSatisfaction(latest) - averageCustomerSatisfaction(previous),
    },
  }
}

function averageCustomerSatisfaction(result: WeeklyResult): number {
  if (result.customerTrend.length === 0) return 0
  const sum = result.customerTrend.reduce((s, e) => s + e.averageSatisfaction, 0)
  return sum / result.customerTrend.length
}
