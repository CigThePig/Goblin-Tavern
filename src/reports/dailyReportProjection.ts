// Phase 89 — Daily Report projection.
//
// `buildDailyReport(result, state)` is the single function the
// `<DailyReport>` Svelte component renders against. It is pure: same
// inputs → same DailyReportData. No DOM, no globals, no Math.random().
//
// All facts come from the sim. We never invent labels, deltas, or
// causes; we project what `simulateDay` already returned. See
// `cards-contract.md §1`: the simulation is the source of truth.

import type { SimResult } from '../sim/core/result'
import type {
  CauseEntry,
  MemoryState,
  ReputationState,
  TavernState,
} from '../sim/state/TavernState'
import type { CalendarState } from '../sim/modules/calendar/types'
import type { StateChange } from '../sim/core/diff'
import type {
  PressureCategory,
  PressureSnapshot,
} from '../sim/modules/pressures/pressureTypes'
import type { ResolvedIntentRecord } from '../sim/modules/responses/types'
import type { OwnerActionApplied } from '../sim/modules/ownerActions/types'
import type { DailyServiceResult } from '../sim/modules/service/types'

import { closedDayAbsolute } from './causeLookup'
import { composeEmpty } from '../cards/voice/index'
import type {
  DailyReportData,
  ReportCalendarHeader,
  ReportDiffLine,
  ReportDirection,
  ReportHookLine,
  ReportOwnerActionLine,
  ReportPressureLine,
  ReportReputationDelta,
  ReportResolvedIntent,
  ReportServiceLine,
  ReportDigest,
} from './types'

const REPUTATION_AXIS_LABELS: Record<keyof ReputationState, string> = {
  cheap: 'Cheap',
  tasty: 'Tasty',
  filthy: 'Filthy',
  dangerous: 'Dangerous',
  cozy: 'Cozy',
  strange: 'Strange',
  reliable: 'Reliable',
  goblinAuthentic: 'Goblin-authentic',
  respectable: 'Respectable',
  culinary_renown: 'Culinary renown',
}

const TOP_DIFFS_CAP = 8
const RISING_PRESSURE_CAP = 5
const RISING_PRESSURE_MIN_VALUE = 25
const HOOK_CAP = 5
const SERVICE_LINE_CAP = 6

export type BuildDailyReportOptions = {
  /**
   * The calendar BEFORE `simulateDay` ran. The engine advances the
   * calendar in its final phase, so the post-day `state.calendar` is
   * "tomorrow"; we need yesterday's calendar to render an accurate
   * "Day N closed" header and to detect end-of-week / end-of-month
   * boundaries. Optional — when omitted, the projection falls back to
   * the post-day calendar, which is correct for the closed-day
   * ordinal but loses week/month-boundary accuracy.
   */
  previousCalendar?: CalendarState
}

export function buildDailyReport(
  result: SimResult,
  state: TavernState,
  options: BuildDailyReportOptions = {},
): DailyReportData {
  const dayDiff = result.diffs.find((d) => d.boundary === 'day')
  const significant = dayDiff?.significantChanges ?? []
  const allChanges = dayDiff?.changes ?? []
  const closedDay = closedDayAbsolute(state)

  const header = buildHeader(state, allChanges, options.previousCalendar)
  const { coinBefore, coinAfter, coinDelta } = coinBeforeAfter(allChanges, state)
  const reputationDeltas = projectReputationDeltas(significant)
  const topDiffs = projectTopDiffs(significant)
  const ownerActionsApplied = projectOwnerActions(result)
  const resolvedIntents = projectResolvedIntents(state)
  const serviceLines = projectServiceLines(result)
  const risingPressures = projectRisingPressures(result, state)
  const futureHooks = projectFutureHooks(state, closedDay)
  const weeklyDigest = projectDigest(result, 'weekly')
  const monthlyDigest = projectDigest(result, 'monthly')

  const isQuiet =
    topDiffs.length === 0 &&
    ownerActionsApplied.length === 0 &&
    resolvedIntents.length === 0 &&
    serviceLines.length === 0 &&
    risingPressures.length === 0 &&
    futureHooks.length === 0 &&
    coinDelta === 0 &&
    reputationDeltas.length === 0

  const voiceKey = `${state.meta.tavernId}.d${closedDay}`
  const quietLine = isQuiet ? composeEmpty('quiet', voiceKey) : undefined

  return {
    header,
    coinBefore,
    coinAfter,
    coinDelta,
    reputationDeltas,
    topDiffs,
    ownerActionsApplied,
    resolvedIntents,
    serviceLines,
    risingPressures,
    futureHooks,
    ...(weeklyDigest ? { weeklyDigest } : {}),
    ...(monthlyDigest ? { monthlyDigest } : {}),
    ...(quietLine ? { quietLine } : {}),
    isQuiet,
  }
}

// ---------- Header ----------

function buildHeader(
  state: TavernState,
  _changes: StateChange[],
  previousCalendar: CalendarState | undefined,
): ReportCalendarHeader {
  const totalElapsed = state.calendar.totalDaysElapsed
  // The calendar diff is filtered out of the day-boundary diff (the
  // engine treats calendar fields as bookkeeping, not significant
  // state). Prefer the `previousCalendar` snapshot passed by the
  // caller; fall back to the post-day calendar with -1 ordinal
  // semantics, which keeps the closed-day number right even when
  // week/month accuracy is lost.
  const cal = previousCalendar ?? state.calendar
  const closedCalendarDay = previousCalendar ? cal.day : Math.max(1, cal.day - 1)
  const closedWeek = cal.week
  const closedMonth = cal.month
  const closedDayType = cal.dayType
  const closedDayOfWeek = previousCalendar ? cal.dayOfWeek : 0

  const isEndOfWeek = closedDayOfWeek === 7
  const isEndOfMonth = previousCalendar ? cal.day === 28 : false

  const voiceKey = `${state.meta.tavernId}.d${totalElapsed}`
  const headerVoice = composeEmpty('header', voiceKey)

  return {
    closedDayOrdinal: totalElapsed,
    dayLabel: `Day ${closedCalendarDay} · Week ${closedWeek} · Month ${closedMonth} · ${formatDayType(closedDayType)}`,
    isEndOfWeek,
    isEndOfMonth,
    ...(headerVoice ? { headerVoice } : {}),
  }
}

function formatDayType(value: string): string {
  return value
    .split('_')
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(' ')
}

// ---------- Coin / reputation ----------

function coinBeforeAfter(
  changes: StateChange[],
  state: TavernState,
): { coinBefore: number; coinAfter: number; coinDelta: number } {
  const change = changes.find((c) => c.path === 'coin')
  if (!change) return { coinBefore: state.coin, coinAfter: state.coin, coinDelta: 0 }
  const before = Number(change.before ?? state.coin)
  const after = Number(change.after ?? state.coin)
  const delta = Number.isFinite(change.delta) ? (change.delta as number) : after - before
  return { coinBefore: before, coinAfter: after, coinDelta: delta }
}

function projectReputationDeltas(significant: StateChange[]): ReportReputationDelta[] {
  return significant
    .filter((c) => c.path.startsWith('reputation.'))
    .map((c) => {
      const axis = c.path.slice('reputation.'.length)
      const before = Number(c.before ?? 0)
      const after = Number(c.after ?? 0)
      const delta = Number.isFinite(c.delta) ? (c.delta as number) : after - before
      return {
        axis,
        label: REPUTATION_AXIS_LABELS[axis as keyof ReputationState] ?? axis,
        before,
        after,
        delta,
      }
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

// ---------- Diffs ----------

function projectTopDiffs(significant: StateChange[]): ReportDiffLine[] {
  return [...significant]
    .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))
    .slice(0, TOP_DIFFS_CAP)
    .map((c) => ({
      path: c.path,
      readable: c.readable,
      direction: changeDirection(c),
      delta: Number(c.delta ?? 0),
      before: c.before,
      after: c.after,
      tags: c.tags,
    }))
}

function changeDirection(change: StateChange): ReportDirection {
  if (change.delta === undefined) return 'neutral'
  if (change.delta > 0) return 'gain'
  if (change.delta < 0) return 'loss'
  return 'neutral'
}

// ---------- Owner actions ----------

function projectOwnerActions(result: SimResult): ReportOwnerActionLine[] {
  const section = result.reports.find((r) => r.id === 'ownerActions')
  const applied = (section?.data?.['applied'] as OwnerActionApplied[] | undefined) ?? []
  return applied.map((a) => ({
    actionId: a.actionId,
    label: a.label,
    ...(a.targetId !== undefined ? { targetId: a.targetId } : {}),
    actionPointCost: a.actionPointCost,
    effects: [...a.effects],
  }))
}

// ---------- Resolved intents ----------

function projectResolvedIntents(state: TavernState): ReportResolvedIntent[] {
  const slice = state.modules['responses'] as
    | { resolvedToday?: ResolvedIntentRecord[] }
    | undefined
  const resolved = slice?.resolvedToday ?? []
  // Seeds for "today" still live on `seedsToday` between runDay calls
  // because startDay (which clears them) only runs on the NEXT day.
  const seedsToday =
    ((state.modules['issueSeeds'] as { seedsToday?: Array<{ id: string; textIngredients?: { subject?: string } }> } | undefined)
      ?.seedsToday) ?? []
  const subjectsById = new Map<string, string>()
  for (const seed of seedsToday) {
    const subject = seed.textIngredients?.subject
    if (typeof subject === 'string' && subject.length > 0) {
      subjectsById.set(seed.id, subject)
    }
  }
  return resolved.map((r) => ({
    intentId: r.intentId,
    seedId: r.seedId,
    verb: r.verb,
    subject: subjectsById.get(r.seedId) ?? r.seedId,
    responseSlotId: r.responseSlotId,
  }))
}

// ---------- Service lines ----------

function projectServiceLines(result: SimResult): ReportServiceLine[] {
  const section = result.reports.find((r) => r.id === 'service')
  if (!section?.data) return []
  const serviceResult = section.data['result'] as DailyServiceResult | undefined
  if (!serviceResult) return []
  const lines: ReportServiceLine[] = []
  const trafficTotal = Object.values(serviceResult.trafficByGroup ?? {}).reduce(
    (sum, n) => sum + (typeof n === 'number' ? n : 0),
    0,
  )
  if (trafficTotal > 0) {
    lines.push({
      readable: `Traffic: ${trafficTotal} patrons across ${Object.keys(serviceResult.trafficByGroup ?? {}).length} groups`,
      category: 'traffic',
    })
  }
  if (serviceResult.netCoinEarned !== undefined && serviceResult.netCoinEarned !== 0) {
    lines.push({
      readable: `Service earned ${serviceResult.netCoinEarned} coin (${serviceResult.unpaidTabs ?? 0} unpaid tabs)`,
      category: 'traffic',
    })
  }
  for (const incident of serviceResult.incidents ?? []) {
    if (lines.length >= SERVICE_LINE_CAP) break
    const readable = (incident as { readable?: string; kind?: string; type?: string }).readable
    lines.push({
      readable: readable ?? `Incident: ${(incident as { kind?: string; type?: string }).kind ?? (incident as { type?: string }).type ?? 'event'}`,
      category: 'incident',
    })
  }
  const drivers = section.data['drivers'] as
    | { positive?: string; negative?: string }
    | undefined
  if (drivers?.positive && lines.length < SERVICE_LINE_CAP) {
    lines.push({ readable: `Positive driver: ${drivers.positive}`, category: 'driver' })
  }
  if (drivers?.negative && lines.length < SERVICE_LINE_CAP) {
    lines.push({ readable: `Negative driver: ${drivers.negative}`, category: 'driver' })
  }
  return lines.slice(0, SERVICE_LINE_CAP)
}

// ---------- Pressures ----------

function projectRisingPressures(
  result: SimResult,
  state: TavernState,
): ReportPressureLine[] {
  const section = result.reports.find((r) => r.id === 'pressures')
  const snapshots = (section?.data?.['snapshots'] as
    | Array<Pick<
        PressureSnapshot,
        'id' | 'label' | 'value' | 'previousValue' | 'delta' | 'trend' | 'severity'
      > & { category?: PressureCategory; dominantCauseIds?: string[] }>
    | undefined) ?? []
  const lines: ReportPressureLine[] = []
  for (const s of snapshots) {
    if (s.delta <= 0) continue
    if (s.value < RISING_PRESSURE_MIN_VALUE) continue
    lines.push({
      id: s.id,
      label: s.label,
      value: s.value,
      previousValue: s.previousValue,
      delta: s.delta,
      trend: s.trend,
      severity: s.severity,
      category: s.category ?? inferCategory(s.id, state),
      dominantCauseIds: Array.isArray(s.dominantCauseIds) ? [...s.dominantCauseIds] : [],
    })
  }
  lines.sort((a, b) => b.severity * b.delta - a.severity * a.delta)
  return lines.slice(0, RISING_PRESSURE_CAP)
}

function inferCategory(_id: string, _state: TavernState): PressureCategory {
  return 'core'
}

// ---------- Future hooks ----------

function projectFutureHooks(state: TavernState, closedDay: number): ReportHookLine[] {
  if (closedDay < 0) return []
  const hooks = state.memories.filter(
    (m: MemoryState) =>
      m.type === 'future_hook' && m.createdAt.absoluteDay === closedDay,
  )
  return hooks.slice(0, HOOK_CAP).map((m) => ({
    memoryId: m.id,
    label: m.label ?? m.definitionId ?? m.id,
    readable: humanizeHook(m),
    actors: m.actors.map((a) => ({ kind: a.kind, id: a.id })),
    locations: m.locations.map((l) => ({ kind: l.kind, id: l.id })),
    ageDays: m.ageDays,
  }))
}

function humanizeHook(memory: MemoryState): string {
  const subject = memory.label ?? memory.definitionId ?? 'a future development'
  const actors = memory.actors.length > 0
    ? ` (${memory.actors.map((a) => a.id).join(', ')})`
    : ''
  const tag = memory.tags.length > 0 ? ` — ${memory.tags[0]}` : ''
  return `${subject}${actors}${tag}`
}

// ---------- Digests ----------

function projectDigest(result: SimResult, id: 'weekly' | 'monthly'): ReportDigest | undefined {
  const section = result.reports.find((r) => r.id === id)
  if (!section) return undefined
  return {
    id,
    title: section.title,
    lines: [...section.lines],
  }
}

// ---------- Cause readable helper ----------

/**
 * Stable readable label for an arbitrary diff path, used by the
 * drilldown sheet when state lookups are unhelpful (e.g. coin).
 */
export function formatDiffPathTitle(path: string): string {
  if (path === 'coin') return 'Coin'
  if (path.startsWith('reputation.')) {
    const axis = path.slice('reputation.'.length)
    const label =
      REPUTATION_AXIS_LABELS[axis as keyof ReputationState] ?? axis
    return `Reputation · ${label}`
  }
  if (path.startsWith('pressures.')) {
    const id = path.slice('pressures.'.length).split('.')[0] ?? path
    return `Pressure · ${id}`
  }
  return path
}

export { type CauseEntry }
