import type { TavernState } from '../state/TavernState'
import type { ReportSection } from '../core/reports'
import type { CardlessRunResult, CardlessRunDayRecord } from './simRunner'
import { getCalendarLabel } from '../modules/calendar/index'
import {
  getAllSeedsToday,
  getRejectedSeedsToday,
} from '../modules/issues/index'
import type { OwnerActionsModuleState } from '../modules/ownerActions/types'
import type { IssueSeed } from '../modules/issues/issueSeedTypes'

// Phase 20 §20.4 / §20.5 / §20.6 — Cardless playtest reports.
//
// These builders take a `CardlessRunResult` (a sequence of `SimResult`s
// captured by the runner) and produce the day/week/month summary tables
// that prove the cardless simulation is interesting.
//
// The reports are intentionally text-shaped: they exist for the
// readiness gate, not for any future card UI. The same machinery feeds
// the strategy-comparison and readiness reports.

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

function ownerActionsApplied(state: TavernState): OwnerActionsModuleState['applied'] {
  const slice = state.modules.ownerActions as
    | OwnerActionsModuleState
    | undefined
  return slice?.applied ?? []
}

function staffPrioritiesApplied(
  state: TavernState,
): Record<string, string> {
  const slice = state.modules.staff as
    | { appliedPriorities?: Record<string, string> }
    | undefined
  return slice?.appliedPriorities ?? {}
}

function pressureSummary(state: TavernState): Array<{
  id: string
  value: number
  trend: number
}> {
  return Object.values(state.pressures)
    .map((p) => ({ id: p.id, value: p.value, trend: p.trend }))
    .sort((a, b) => b.value - a.value)
}

// ----------------------------------------------------------------------
// One-day report
// ----------------------------------------------------------------------

export type OneDayReport = {
  index: number
  calendarLabel: string
  ownerActions: Array<{ actionId: string; label: string; effects: string[] }>
  staffPriorities: Record<string, string>
  topCauses: Array<{ readable: string; weight: number }>
  pressures: ReturnType<typeof pressureSummary>
  issueSeedsGenerated: number
  issueSeedsValid: number
  issueSeedsRejected: number
  issueSeedFamilies: string[]
  newMemoryIds: string[]
  significantDiffCount: number
  validationErrors: number
}

export function buildOneDayReport(day: CardlessRunDayRecord): OneDayReport {
  const state = day.result.state
  const before = day.stateBefore
  const seeds = getAllSeedsToday(state)
  const rejected = getRejectedSeedsToday(state)

  const dayDiff = day.result.diffs.find((d) => d.boundary === 'day')
  const significantDiffCount = dayDiff?.significantChanges.length ?? 0

  // Top causes from this day's causes (most recently added).
  const causesToday = state.causes.filter(
    (c) => c.timestamp.absoluteDay === before.calendar.totalDaysElapsed,
  )
  const topCauses = causesToday
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map((c) => ({ readable: c.readable, weight: c.weight }))

  const ownerActions = ownerActionsApplied(state).map((a) => ({
    actionId: a.actionId,
    label: a.label,
    effects: a.effects,
  }))

  const familySet = new Set<string>()
  for (const s of seeds) familySet.add(s.family)

  // Memory ids newly added today (createdAt absoluteDay == before's
  // totalDaysElapsed, the day we just simulated).
  const newMemoryIds = state.memories
    .filter((m) => m.createdAt.absoluteDay === before.calendar.totalDaysElapsed)
    .map((m) => m.id)

  return {
    index: day.index,
    calendarLabel: getCalendarLabel(before.calendar),
    ownerActions,
    staffPriorities: staffPrioritiesApplied(state),
    topCauses,
    pressures: pressureSummary(state),
    issueSeedsGenerated: seeds.length + rejected.length,
    issueSeedsValid: seeds.length,
    issueSeedsRejected: rejected.length,
    issueSeedFamilies: Array.from(familySet).sort(),
    newMemoryIds,
    significantDiffCount,
    validationErrors: day.result.validation.errors.length,
  }
}

export function buildOneDayReportSection(day: CardlessRunDayRecord): ReportSection {
  const report = buildOneDayReport(day)
  const lines: string[] = []
  lines.push(`DAY ${report.index} — ${report.calendarLabel}`)
  lines.push('')
  lines.push('Owner Actions:')
  if (report.ownerActions.length === 0) {
    lines.push('  (none)')
  } else {
    for (const a of report.ownerActions) {
      lines.push(`  - ${a.label}`)
    }
  }
  lines.push('')
  lines.push('Top Causes:')
  if (report.topCauses.length === 0) {
    lines.push('  (none)')
  } else {
    for (const c of report.topCauses) {
      lines.push(`  - ${c.readable} (weight ${c.weight})`)
    }
  }
  lines.push('')
  lines.push('Pressures:')
  for (const p of report.pressures.slice(0, 5)) {
    const trendLabel = p.trend > 0 ? 'rising' : p.trend < 0 ? 'falling' : 'stable'
    lines.push(`  - ${p.id}: ${p.value} (${trendLabel})`)
  }
  lines.push('')
  lines.push(
    `Issue Seeds: ${report.issueSeedsValid} valid / ${report.issueSeedsRejected} rejected`,
  )
  if (report.issueSeedFamilies.length > 0) {
    lines.push(`  families: ${report.issueSeedFamilies.join(', ')}`)
  }
  return {
    id: 'cardless_day_report',
    source: 'cardlessPlaytest',
    title: `CARDLESS DAY ${report.index}`,
    lines,
    data: report as unknown as Record<string, unknown>,
  }
}

// ----------------------------------------------------------------------
// One-week / one-month aggregates
// ----------------------------------------------------------------------

export type OneWeekReport = {
  daysCovered: number
  startCalendar: string
  endCalendar: string
  netCoinChange: number
  wagesPaidTotal: number
  customerSatisfactionTrend: Record<string, { start: number; end: number }>
  staffMoraleTrend: Record<string, { start: number; end: number }>
  maintenanceBacklog: number
  topPressures: Array<{ id: string; value: number; trend: number }>
  issueSeedFamilyCounts: Record<string, number>
  totalSeedsGenerated: number
  activeMemoryCount: number
  feedbackLoopsActive: number
}

function customerSatisfactions(state: TavernState): Record<string, number> {
  const out: Record<string, number> = {}
  for (const g of Object.values(state.customerGroups)) {
    out[g.id] = g.satisfaction
  }
  return out
}

function staffMorale(state: TavernState): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of Object.values(state.staff)) {
    out[s.id] = s.morale
  }
  return out
}

function maintenanceBacklog(state: TavernState): number {
  let backlog = 0
  for (const a of Object.values(state.areas)) {
    backlog += a.damage
    backlog += 100 - a.condition
  }
  return backlog
}

function feedbackLoopsActive(state: TavernState): number {
  const slice = state.modules.feedback as
    | { activeLoops?: Array<{ id: string; active?: boolean }> }
    | undefined
  return slice?.activeLoops?.filter((l) => l.active !== false).length ?? 0
}

export function buildOneWeekReport(
  days: ReadonlyArray<CardlessRunDayRecord>,
): OneWeekReport {
  if (days.length === 0) {
    throw new Error('buildOneWeekReport: no days provided')
  }
  const start = days[0]!.stateBefore
  const last = days[days.length - 1]!.result.state

  const startSat = customerSatisfactions(start)
  const endSat = customerSatisfactions(last)
  const customerSatisfactionTrend: OneWeekReport['customerSatisfactionTrend'] = {}
  for (const id of Object.keys(startSat)) {
    customerSatisfactionTrend[id] = {
      start: startSat[id] ?? 0,
      end: endSat[id] ?? 0,
    }
  }

  const startStaff = staffMorale(start)
  const endStaff = staffMorale(last)
  const staffMoraleTrend: OneWeekReport['staffMoraleTrend'] = {}
  for (const id of Object.keys(startStaff)) {
    staffMoraleTrend[id] = {
      start: startStaff[id] ?? 0,
      end: endStaff[id] ?? 0,
    }
  }

  let wages = 0
  let totalSeeds = 0
  const familyCounts: Record<string, number> = {}
  for (const d of days) {
    const weekly = d.result.state.modules.weekly as
      | { wages?: { totalPaidThisWeek?: number } }
      | undefined
    if (weekly?.wages?.totalPaidThisWeek !== undefined) {
      wages = Math.max(wages, weekly.wages.totalPaidThisWeek)
    }
    const seeds = getAllSeedsToday(d.result.state)
    totalSeeds += seeds.length
    for (const s of seeds) {
      familyCounts[s.family] = (familyCounts[s.family] ?? 0) + 1
    }
  }

  return {
    daysCovered: days.length,
    startCalendar: getCalendarLabel(start.calendar),
    endCalendar: getCalendarLabel(last.calendar),
    netCoinChange: last.coin - start.coin,
    wagesPaidTotal: wages,
    customerSatisfactionTrend,
    staffMoraleTrend,
    maintenanceBacklog: maintenanceBacklog(last),
    topPressures: pressureSummary(last).slice(0, 5),
    issueSeedFamilyCounts: familyCounts,
    totalSeedsGenerated: totalSeeds,
    activeMemoryCount: last.memories.length,
    feedbackLoopsActive: feedbackLoopsActive(last),
  }
}

export type OneMonthReport = OneWeekReport & {
  rentPaid: boolean
  rentArrears: number
  reputationShifts: Record<string, { start: number; end: number }>
  landlordPressureEnd: number
  inspectionPressureEnd: number
  customerPatronageEnd: Record<string, number>
  topMemoryIds: string[]
  topPressureIds: string[]
  topIssueSeedFamilies: string[]
}

export function buildOneMonthReport(
  days: ReadonlyArray<CardlessRunDayRecord>,
): OneMonthReport {
  if (days.length === 0) {
    throw new Error('buildOneMonthReport: no days provided')
  }
  const base = buildOneWeekReport(days)
  const start = days[0]!.stateBefore
  const last = days[days.length - 1]!.result.state

  const monthly = last.modules.monthly as
    | {
        rent?: { paidThisMonth?: boolean; arrears?: number }
        landlord?: { pressure?: number }
      }
    | undefined

  const reputationShifts: OneMonthReport['reputationShifts'] = {}
  for (const axis of Object.keys(start.reputation) as Array<
    keyof typeof start.reputation
  >) {
    reputationShifts[axis] = {
      start: start.reputation[axis] as number,
      end: last.reputation[axis] as number,
    }
  }

  const customerPatronageEnd: Record<string, number> = {}
  for (const g of Object.values(last.customerGroups)) {
    customerPatronageEnd[g.id] = g.patronage
  }

  // Top memories by strength.
  const topMemoryIds = last.memories
    .slice()
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 5)
    .map((m) => m.id)

  // Top pressures by value at month end.
  const topPressureIds = Object.values(last.pressures)
    .slice()
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((p) => p.id)

  // Top issue seed families by total generated.
  const topIssueSeedFamilies = Object.entries(base.issueSeedFamilyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([family]) => family)

  return {
    ...base,
    rentPaid: monthly?.rent?.paidThisMonth ?? false,
    rentArrears: monthly?.rent?.arrears ?? 0,
    reputationShifts,
    landlordPressureEnd: last.pressures.landlord?.value ?? 0,
    inspectionPressureEnd: last.pressures.inspection?.value ?? 0,
    customerPatronageEnd,
    topMemoryIds,
    topPressureIds,
    topIssueSeedFamilies,
  }
}

// ----------------------------------------------------------------------
// Run-wide rollups
// ----------------------------------------------------------------------

export type RunSummary = {
  days: number
  netCoinChange: number
  finalCoin: number
  validatedThroughout: boolean
  rentPaymentsMade: number
  rentPaymentsMissed: number
  totalSeedsGenerated: number
  totalSeedsRejected: number
  seedsPerDay: number
  feedbackLoopsObserved: string[]
  uniqueIssueSeedFamilies: string[]
  reputationIdentity: ReputationIdentity
  dominantCustomerGroup: string | undefined
  topMemoryIds: string[]
  topPressureIds: string[]
  staffMoraleEnd: Record<string, number>
}

export type ReputationIdentity = {
  /** Reputation axes ranked highest at end of run, top 3. */
  dominantAxes: string[]
  /** Compact identity label, e.g. "cheap+filthy" or "respectable+reliable". */
  identityKey: string
}

function rollupReputation(state: TavernState): ReputationIdentity {
  const entries = Object.entries(state.reputation) as [string, number][]
  entries.sort((a, b) => b[1] - a[1])
  const dominant = entries.slice(0, 3).map(([k]) => k)
  return {
    dominantAxes: dominant,
    identityKey: dominant.slice(0, 2).sort().join('+'),
  }
}

function dominantCustomerGroup(state: TavernState): string | undefined {
  let topId: string | undefined
  let topPatronage = -1
  for (const g of Object.values(state.customerGroups)) {
    if (g.patronage > topPatronage) {
      topPatronage = g.patronage
      topId = g.id
    }
  }
  return topId
}

export function summarizeRun(run: CardlessRunResult): RunSummary {
  const start = run.initialState
  const end = run.finalState

  let rentMade = 0
  let rentMissed = 0
  let totalSeeds = 0
  let totalRejected = 0
  const familySet = new Set<string>()
  const loopSet = new Set<string>()

  for (const day of run.days) {
    const monthly = day.result.state.modules.monthly as
      | {
          rent?: { paidThisMonth?: boolean; missedPayments?: number }
        }
      | undefined
    void monthly
    const seeds = getAllSeedsToday(day.result.state)
    totalSeeds += seeds.length
    for (const s of seeds) familySet.add(s.family)
    const rejected = getRejectedSeedsToday(day.result.state)
    totalRejected += rejected.length
    const feedback = day.result.state.modules.feedback as
      | { activeLoops?: Array<{ id: string; active?: boolean }> }
      | undefined
    for (const loop of feedback?.activeLoops ?? []) {
      if (loop.active !== false) loopSet.add(loop.id)
    }
  }

  // Look at the monthly module across all days to count rent pay/miss
  // transitions: each end-of-month resolves rent once.
  let lastRentPaid: boolean | undefined
  let lastMissed = 0
  for (const day of run.days) {
    const monthly = day.result.state.modules.monthly as
      | {
          rent?: {
            paidThisMonth?: boolean
            missedPayments?: number
          }
        }
      | undefined
    const paid = monthly?.rent?.paidThisMonth
    const missed = monthly?.rent?.missedPayments ?? 0
    if (paid !== undefined) {
      if (lastRentPaid !== undefined && lastRentPaid === false && paid === true) {
        rentMade += 1
      } else if (paid === true && lastRentPaid !== true) {
        rentMade += 1
      }
      lastRentPaid = paid
    }
    if (missed > lastMissed) {
      rentMissed += missed - lastMissed
      lastMissed = missed
    }
  }

  return {
    days: run.days.length,
    netCoinChange: end.coin - start.coin,
    finalCoin: end.coin,
    validatedThroughout: run.validatedThroughout,
    rentPaymentsMade: rentMade,
    rentPaymentsMissed: rentMissed,
    totalSeedsGenerated: totalSeeds,
    totalSeedsRejected: totalRejected,
    seedsPerDay: run.days.length === 0 ? 0 : totalSeeds / run.days.length,
    feedbackLoopsObserved: Array.from(loopSet).sort(),
    uniqueIssueSeedFamilies: Array.from(familySet).sort(),
    reputationIdentity: rollupReputation(end),
    dominantCustomerGroup: dominantCustomerGroup(end),
    topMemoryIds: end.memories
      .slice()
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 5)
      .map((m) => m.id),
    topPressureIds: Object.values(end.pressures)
      .slice()
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((p) => p.id),
    staffMoraleEnd: staffMorale(end),
  }
}

/** Collect every IssueSeed across all days of a run. */
export function collectAllSeeds(
  run: CardlessRunResult,
): IssueSeed[] {
  const out: IssueSeed[] = []
  for (const day of run.days) {
    for (const seed of getAllSeedsToday(day.result.state)) {
      out.push(seed)
    }
  }
  return out
}
