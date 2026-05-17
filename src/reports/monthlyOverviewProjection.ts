// Phase 91 — Monthly Overview projection.
//
// `buildMonthlyOverview(state)` is the single function the
// `<MonthlyOverview>` Svelte component renders against. It is pure:
// same inputs → same MonthlyOverviewData. No DOM, no globals, no
// Math.random(). Cards-contract §1 — the simulation is the source of
// truth; this projection resolves entity references to display labels,
// computes month-over-month deltas from `monthlyHistory`, and surfaces
// active arcs from `state.world.localEvents`, but never invents data
// not already in state.

import {
  getMonthlyModuleState,
  getReputationTier,
} from '../sim/modules/monthly/monthlyModule'
import { REPUTATION_AXIS_IDS } from '../sim/modules/monthly/types'
import type {
  LocalArcStageId,
  LocalEventWorldState,
  TavernState,
} from '../sim/state/TavernState'
import type {
  MonthlyEconomyTotals,
  MonthlyResult,
  ReputationAxisId,
  ReputationAxisShift,
  ReputationTier,
} from '../sim/modules/monthly/types'

export type MonthlyOverviewEmptyReason = 'no_month_yet'

export type MonthlyOverviewHeader = {
  monthKey: string
  monthNumber: number
  yearNumber: number
  endDay: number
  /**
   * Days elapsed since this month closed. 0 means today is day 28;
   * >0 means the player has run more days since then. The component
   * uses this to surface a "(closed N days ago)" note.
   */
  daysSinceClose: number
  endingCoin: number
}

export type MonthlyOverviewRent = {
  amountDue: number
  paid: boolean
  paidAmount: number
  arrears: number
  missedPayments: number
}

export type MonthlyOverviewLandlord = {
  opinionBefore: number
  opinionAfter: number
  pressureBefore: number
  pressureAfter: number
  notes: string[]
}

export type MonthlyOverviewInspection = {
  suspicionBefore: number
  suspicionAfter: number
  warningIssuedThisMonth: boolean
  warningCount: number
  notes: string[]
}

export type MonthlyOverviewRival = {
  pressureBefore: number
  pressureAfter: number
  appealBefore: number
  appealAfter: number
  strategy: string
  notes: string[]
}

export type MonthlyOverviewReputationRow = {
  axisId: ReputationAxisId
  label: string
  before: number
  after: number
  delta: number
  tierBefore: ReputationTier
  tierAfter: ReputationTier
  tierChanged: boolean
  reasons: string[]
  /** Present when at least one prior month exists with the same axis. */
  monthOverMonthDelta?: number
}

export type MonthlyOverviewReputation = {
  rows: MonthlyOverviewReputationRow[]
  hasMonthOverMonth: boolean
}

export type MonthlyOverviewPressureRow = {
  id: string
  label: string
  value: number
  trend: number
  topCauses: string[]
}

export type MonthlyOverviewPressures = {
  top: MonthlyOverviewPressureRow[]
  totalActive: number
}

export type MonthlyOverviewArc = {
  id: string
  label: string
  stage: LocalArcStageId
  intensity: number
  startedDay: number
  ageDays: number
  relatedFactionLabels: string[]
  relatedCultureLabels: string[]
  recentHistory: { day: number; stage: LocalArcStageId; note: string }[]
}

export type MonthlyOverviewUpgradeRow = {
  id: string
  label: string
  rationale: string
  relevance: number
}

export type MonthlyOverviewModifier = {
  id: string
  label: string
  description: string
  tags: string[]
}

export type MonthlyOverviewCustomers = {
  bestGroupId?: string
  bestGroupLabel?: string
  worstGroupId?: string
  worstGroupLabel?: string
}

export type MonthlyOverviewEconomy = MonthlyEconomyTotals

export type MonthlyComparison = {
  previousMonthKey: string
  endingCoinDelta: number
  netDelta: number
  landlordPressureDelta: number
  inspectionSuspicionDelta: number
  rivalPressureDelta: number
}

export type MonthlyOverviewData = {
  hasResult: boolean
  /** Present when hasResult === false. */
  empty?: { reason: MonthlyOverviewEmptyReason; message: string }

  header?: MonthlyOverviewHeader
  rent?: MonthlyOverviewRent
  landlord?: MonthlyOverviewLandlord
  inspection?: MonthlyOverviewInspection
  reputation?: MonthlyOverviewReputation
  pressures?: MonthlyOverviewPressures
  arcs?: MonthlyOverviewArc[]
  rival?: MonthlyOverviewRival
  customers?: MonthlyOverviewCustomers
  economy?: MonthlyOverviewEconomy
  upgrades?: MonthlyOverviewUpgradeRow[]
  activeModifier?: MonthlyOverviewModifier
  nextMonthModifier?: MonthlyOverviewModifier
  strategicSummary?: string[]

  /** Present when at least one prior month exists in monthlyHistory. */
  comparison?: MonthlyComparison
}

const EMPTY_MESSAGE = 'Your first monthly summary appears after day 28.'

// Human-readable labels for the 9 monthly reputation axes. Mirrors the
// labels in `src/reports/glossary.ts:152–213` so the projection and the
// glossary chips agree on the same display strings.
const REPUTATION_AXIS_LABELS: Record<ReputationAxisId, string> = {
  cheap: 'Cheap',
  tasty: 'Tasty',
  filthy: 'Filthy',
  dangerous: 'Dangerous',
  cozy: 'Cozy',
  reliable: 'Reliable',
  goblinAuthentic: 'Goblin-Authentic',
  respectable: 'Respectable',
  strange: 'Strange',
}

const TOP_PRESSURE_COUNT = 5
const ACTIVE_PRESSURE_THRESHOLD = 20
const MAX_ARC_RECENT_HISTORY = 2

export function buildMonthlyOverview(state: TavernState): MonthlyOverviewData {
  const slice = getMonthlyModuleState(state)
  const latest = slice.lastMonthlyResult
  if (!latest) {
    return {
      hasResult: false,
      empty: { reason: 'no_month_yet', message: EMPTY_MESSAGE },
    }
  }

  const previous = pickPreviousResult(slice.monthlyHistory, latest)

  const data: MonthlyOverviewData = {
    hasResult: true,
    header: projectHeader(latest, state),
    rent: projectRent(latest),
    landlord: projectLandlord(latest),
    inspection: projectInspection(latest),
    reputation: projectReputation(latest, previous),
    pressures: projectPressures(state),
    rival: projectRival(latest),
    economy: projectEconomy(latest),
    upgrades: projectUpgrades(latest),
    activeModifier: projectModifier(latest.activeModifier),
    nextMonthModifier: projectModifier(latest.nextMonthModifier),
  }

  const arcs = projectActiveArcs(state)
  if (arcs.length > 0) data.arcs = arcs

  const customers = projectCustomers(latest, state)
  if (customers) data.customers = customers

  if (latest.strategicSummary.length > 0) {
    data.strategicSummary = [...latest.strategicSummary]
  }

  if (previous) {
    data.comparison = projectComparison(latest, previous)
  }

  return data
}

function pickPreviousResult(
  history: readonly MonthlyResult[],
  latest: MonthlyResult,
): MonthlyResult | undefined {
  // `monthlyHistory` is oldest-first and contains `latest` as its last
  // entry (endMonth appends before generateReports runs). The previous
  // month is the entry immediately before it; absent if this is the
  // first finalized month.
  if (history.length < 2) return undefined
  const candidate = history[history.length - 2]
  if (!candidate || candidate.monthKey === latest.monthKey) return undefined
  return candidate
}

function projectHeader(
  result: MonthlyResult,
  state: TavernState,
): MonthlyOverviewHeader {
  return {
    monthKey: result.monthKey,
    monthNumber: result.monthNumber,
    yearNumber: result.yearNumber,
    endDay: result.endDay,
    daysSinceClose: Math.max(0, daysSinceClose(state, result)),
    endingCoin: result.endingCoin,
  }
}

function daysSinceClose(state: TavernState, result: MonthlyResult): number {
  // `endDay` is `state.calendar.day` (day-of-month) at endMonth time. To
  // measure elapsed days across month/year rollovers we need an
  // absolute anchor — `totalDaysElapsed`. Reconstruct the absolute
  // end-day from (year, month, day-of-month):
  //   absoluteEndDay = (year-1) * 12 * 28 + (month-1) * 28 + endDay
  const absoluteEndDay =
    (result.yearNumber - 1) * 12 * 28 +
    (result.monthNumber - 1) * 28 +
    result.endDay
  return state.calendar.totalDaysElapsed - absoluteEndDay
}

function projectRent(result: MonthlyResult): MonthlyOverviewRent {
  return {
    amountDue: result.rent.amountDue,
    paid: result.rent.paid,
    paidAmount: result.rent.paidAmount,
    arrears: result.rent.arrears,
    missedPayments: result.rent.missedPayments,
  }
}

function projectLandlord(result: MonthlyResult): MonthlyOverviewLandlord {
  return {
    opinionBefore: result.landlord.opinionBefore,
    opinionAfter: result.landlord.opinionAfter,
    pressureBefore: result.landlord.pressureBefore,
    pressureAfter: result.landlord.pressureAfter,
    notes: [...result.landlord.notes],
  }
}

function projectInspection(result: MonthlyResult): MonthlyOverviewInspection {
  return {
    suspicionBefore: result.inspection.suspicionBefore,
    suspicionAfter: result.inspection.suspicionAfter,
    warningIssuedThisMonth: result.inspection.warningIssuedThisMonth,
    warningCount: result.inspection.warningCount,
    notes: [...result.inspection.notes],
  }
}

function projectRival(result: MonthlyResult): MonthlyOverviewRival {
  // `rivalTavernResolution` does not carry the strategy id; surface the
  // module-state strategy by reading `lastMonthlyResult.rivalTavern`
  // pressure/appeal alongside the strategic-summary notes for context.
  // The strategy itself stays on the live module slice, so the closest
  // honest value here is "unknown" — render the resolution shape only.
  return {
    pressureBefore: result.rivalTavern.pressureBefore,
    pressureAfter: result.rivalTavern.pressureAfter,
    appealBefore: result.rivalTavern.appealBefore,
    appealAfter: result.rivalTavern.appealAfter,
    strategy: 'unknown',
    notes: [...result.rivalTavern.notes],
  }
}

function projectReputation(
  result: MonthlyResult,
  previous: MonthlyResult | undefined,
): MonthlyOverviewReputation {
  // `computeReputationShifts` always returns one entry per axis in
  // `ALL_AXES` (`reputation.ts:189–199`), including zero-delta rows.
  // Iterate `REPUTATION_AXIS_IDS` so the projected order is canonical
  // even if the engine ever reorders its workbook.
  const shiftsByAxis = new Map<ReputationAxisId, ReputationAxisShift>()
  for (const shift of result.reputationShifts) {
    shiftsByAxis.set(shift.axisId, shift)
  }
  const previousByAxis = new Map<ReputationAxisId, ReputationAxisShift>()
  if (previous) {
    for (const shift of previous.reputationShifts) {
      previousByAxis.set(shift.axisId, shift)
    }
  }

  const rows: MonthlyOverviewReputationRow[] = REPUTATION_AXIS_IDS.map(
    (axisId) => {
      const shift = shiftsByAxis.get(axisId)
      if (!shift) {
        // Should not happen — defensive synthetic row.
        return {
          axisId,
          label: REPUTATION_AXIS_LABELS[axisId],
          before: 0,
          after: 0,
          delta: 0,
          tierBefore: getReputationTier(0),
          tierAfter: getReputationTier(0),
          tierChanged: false,
          reasons: [],
        }
      }
      const row: MonthlyOverviewReputationRow = {
        axisId,
        label: REPUTATION_AXIS_LABELS[axisId],
        before: shift.before,
        after: shift.after,
        delta: shift.delta,
        tierBefore: shift.tierBefore,
        tierAfter: shift.tierAfter,
        tierChanged: shift.tierBefore !== shift.tierAfter,
        reasons: [...shift.reasons],
      }
      const prev = previousByAxis.get(axisId)
      if (prev) {
        row.monthOverMonthDelta = shift.after - prev.after
      }
      return row
    },
  )

  return {
    rows,
    hasMonthOverMonth: previous !== undefined,
  }
}

function projectPressures(state: TavernState): MonthlyOverviewPressures {
  const all = Object.values(state.pressures)
  const sorted = [...all].sort((a, b) => b.value - a.value)
  const top = sorted.slice(0, TOP_PRESSURE_COUNT).map((p) => ({
    id: p.id,
    label: p.label,
    value: p.value,
    trend: p.trend,
    topCauses: [...p.topCauses],
  }))
  const totalActive = all.filter((p) => p.value >= ACTIVE_PRESSURE_THRESHOLD).length
  return { top, totalActive }
}

function projectActiveArcs(state: TavernState): MonthlyOverviewArc[] {
  const events = Object.values(state.world.localEvents)
  const active = events.filter((event) => isActiveArc(event))
  // Most-recently-updated arcs first; fall back to startedDay desc.
  active.sort((a, b) => {
    const aLast = a.lastUpdatedDay ?? a.startedDay
    const bLast = b.lastUpdatedDay ?? b.startedDay
    if (bLast !== aLast) return bLast - aLast
    return b.startedDay - a.startedDay
  })

  return active.map((event) => projectArc(event, state))
}

function isActiveArc(event: LocalEventWorldState): boolean {
  if (!event.stage) return false
  return event.stage !== 'resolved' && event.stage !== 'failed'
}

function projectArc(
  event: LocalEventWorldState,
  state: TavernState,
): MonthlyOverviewArc {
  const ageDays = Math.max(
    0,
    state.calendar.totalDaysElapsed - event.startedDay,
  )
  const relatedFactionLabels = event.relatedFactionIds.map(
    (id) => state.world.factions[id]?.label ?? id,
  )
  const relatedCultureLabels = event.relatedCultureIds.map(
    (id) => state.world.cultures[id]?.label ?? id,
  )
  const history = event.arcHistory ?? []
  const recent = history.slice(-MAX_ARC_RECENT_HISTORY).map((entry) => ({
    day: entry.day,
    stage: entry.stage,
    note: entry.note,
  }))
  return {
    id: event.id,
    label: event.label,
    // Filtered by `isActiveArc` — `stage` is guaranteed defined here.
    stage: event.stage as LocalArcStageId,
    intensity: event.intensity,
    startedDay: event.startedDay,
    ageDays,
    relatedFactionLabels,
    relatedCultureLabels,
    recentHistory: recent,
  }
}

function projectCustomers(
  result: MonthlyResult,
  state: TavernState,
): MonthlyOverviewCustomers | undefined {
  if (!result.bestGroupId && !result.worstGroupId) return undefined
  const out: MonthlyOverviewCustomers = {}
  if (result.bestGroupId) {
    out.bestGroupId = result.bestGroupId
    out.bestGroupLabel =
      state.customerGroups[result.bestGroupId]?.label ?? result.bestGroupId
  }
  if (result.worstGroupId) {
    out.worstGroupId = result.worstGroupId
    out.worstGroupLabel =
      state.customerGroups[result.worstGroupId]?.label ?? result.worstGroupId
  }
  return out
}

function projectEconomy(result: MonthlyResult): MonthlyOverviewEconomy {
  return { ...result.economy }
}

function projectUpgrades(result: MonthlyResult): MonthlyOverviewUpgradeRow[] {
  // Already sorted most-relevant-first by `computeUpgradeReadiness`.
  return result.upgradeReadiness.map((entry) => ({
    id: entry.id,
    label: entry.label,
    rationale: entry.rationale,
    relevance: entry.relevance,
  }))
}

function projectModifier(modifier: MonthlyResult['activeModifier']): MonthlyOverviewModifier {
  return {
    id: modifier.id,
    label: modifier.label,
    description: modifier.description,
    tags: [...modifier.tags],
  }
}

function projectComparison(
  current: MonthlyResult,
  previous: MonthlyResult,
): MonthlyComparison {
  return {
    previousMonthKey: previous.monthKey,
    endingCoinDelta: current.endingCoin - previous.endingCoin,
    netDelta: current.economy.net - previous.economy.net,
    landlordPressureDelta:
      current.landlord.pressureAfter - previous.landlord.pressureAfter,
    inspectionSuspicionDelta:
      current.inspection.suspicionAfter - previous.inspection.suspicionAfter,
    rivalPressureDelta:
      current.rivalTavern.pressureAfter - previous.rivalTavern.pressureAfter,
  }
}
