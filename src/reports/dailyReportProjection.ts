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
import {
  composeDailyHeaderLine,
  composeDailyQuietLine,
  composeDayArcLine,
  composeDriverLine,
  composeServiceLine,
  composeTrafficLine,
} from './compose/sections'
import { projectMissedOpportunities } from './missedOpportunityProjection'
import { humanizeDiff, humanizePath } from './labels/humanizePath'
import { idLabel, humanizeId } from './labels/idLabel'
import { actionRegistry } from '../sim/registries/actionRegistry'
import type {
  DailyReportData,
  DayArcMovement,
  GroupedDiffs,
  MissedOpportunityLine,
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
const TOP_DIFFS_PER_GROUP_CAP = 4
const TOP_DIFFS_OVERALL_CAP = 12
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
  /**
   * Phase 97 — Per-day dismissed missed-opportunity ids. Filtered out
   * of the projection so once a player dismisses a hint it stays gone
   * for that closed day.
   */
  dismissedMissedOpportunityIds?: ReadonlySet<string>
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

  const { coinBefore, coinAfter, coinDelta } = coinBeforeAfter(allChanges, state)
  const reputationDeltas = projectReputationDeltas(significant)
  const topDiffs = projectTopDiffs(significant)
  const groupedDiffs = projectGroupedDiffs(significant)
  const ownerActionsApplied = projectOwnerActions(result, state)
  const resolvedIntents = projectResolvedIntents(state)
  const serviceLines = projectServiceLines(result, state, closedDay)
  // Phase 186 / Cluster 6 — the day's story, ordered by the engine's
  // real segments. Built from the rich lines above, so it carries no
  // facts the projection didn't already derive from the sim.
  const dayArc = projectDayArc(
    { ownerActionsApplied, serviceLines, resolvedIntents },
    state,
    closedDay,
  )
  // A "heavy" day — lots of moves, decisions, or threshold-crossing
  // changes — lets the header voice reach for its busier lines. Computed
  // from the same projected pieces the arc reads.
  const isHeavyDay =
    ownerActionsApplied.length + resolvedIntents.length >= 3 ||
    topDiffs.length >= 6
  const header = buildHeader(
    state,
    allChanges,
    options.previousCalendar,
    isHeavyDay,
  )
  const risingPressures = projectRisingPressures(result, state)
  const futureHooks = projectFutureHooks(state, closedDay)
  const missedOpportunities: MissedOpportunityLine[] = projectMissedOpportunities(
    result,
    state,
    {
      closedDay,
      ...(options.dismissedMissedOpportunityIds
        ? { dismissedIds: options.dismissedMissedOpportunityIds }
        : {}),
    },
  )
  const weeklyDigest = projectDigest(result, 'weekly')
  const monthlyDigest = projectDigest(result, 'monthly')

  const isQuiet =
    topDiffs.length === 0 &&
    ownerActionsApplied.length === 0 &&
    resolvedIntents.length === 0 &&
    serviceLines.length === 0 &&
    risingPressures.length === 0 &&
    futureHooks.length === 0 &&
    missedOpportunities.length === 0 &&
    coinDelta === 0 &&
    reputationDeltas.length === 0

  const quietLine = isQuiet
    ? composeDailyQuietLine({
        state,
        closedDayOrdinal: closedDay,
        isEndOfWeek: header.isEndOfWeek,
      })
    : undefined

  return {
    header,
    coinBefore,
    coinAfter,
    coinDelta,
    reputationDeltas,
    topDiffs,
    groupedDiffs,
    ownerActionsApplied,
    resolvedIntents,
    serviceLines,
    dayArc,
    risingPressures,
    futureHooks,
    ...(missedOpportunities.length > 0 ? { missedOpportunities } : {}),
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
  isHeavyDay: boolean,
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

  const headerVoice = composeDailyHeaderLine({
    state,
    closedDayOrdinal: totalElapsed,
    calendar: cal,
    isEndOfWeek,
    isEndOfMonth,
    isHeavyDay,
  })

  return {
    closedDayOrdinal: totalElapsed,
    dayLabel: `Day ${closedCalendarDay} · Week ${closedWeek} · Month ${closedMonth} · ${idLabel('dayType', closedDayType)}`,
    isEndOfWeek,
    isEndOfMonth,
    ...(headerVoice ? { headerVoice } : {}),
  }
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
    .map((c) => {
      const line: ReportDiffLine = {
        path: c.path,
        readable: c.readable,
        humanReadable: '',
        direction: changeDirection(c),
        delta: Number(c.delta ?? 0),
        before: c.before,
        after: c.after,
        tags: c.tags,
      }
      line.humanReadable = humanizeDiff(line)
      return line
    })
}

/**
 * Phase 118 — Group `significant` changes into the buckets the Daily
 * Report view renders. Every line still flows through `humanizeDiff()`
 * so labels match the flat `topDiffs` list.
 *
 * Process:
 *   1. Classify by path prefix into coin&reputation / stock /
 *      pressures / areas. Anything else (staff, customers, recipes,
 *      world-relationship slices, …) lands in `other` so significant
 *      diffs are never silently dropped.
 *   2. Sort each group by `|delta|` desc.
 *   3. Apply per-group cap (4).
 *   4. Enforce overall ceiling (12) by trimming the smallest-delta
 *      tails across all groups until the total fits.
 */
function projectGroupedDiffs(significant: StateChange[]): GroupedDiffs {
  const groups: GroupedDiffs = {
    coinAndReputation: [],
    stock: [],
    pressures: [],
    areas: [],
    other: [],
  }
  for (const c of significant) {
    const bucket = classifyDiffPath(c.path)
    const line: ReportDiffLine = {
      path: c.path,
      readable: c.readable,
      humanReadable: '',
      direction: changeDirection(c),
      delta: Number(c.delta ?? 0),
      before: c.before,
      after: c.after,
      tags: c.tags,
    }
    line.humanReadable = humanizeDiff(line)
    groups[bucket].push(line)
  }
  for (const key of Object.keys(groups) as Array<keyof GroupedDiffs>) {
    groups[key] = groups[key]
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, TOP_DIFFS_PER_GROUP_CAP)
  }
  enforceOverallCap(groups, TOP_DIFFS_OVERALL_CAP)
  return groups
}

function classifyDiffPath(path: string): keyof GroupedDiffs {
  if (path === 'coin') return 'coinAndReputation'
  if (path.startsWith('reputation.')) return 'coinAndReputation'
  if (path.startsWith('stock.')) return 'stock'
  if (path.startsWith('pressures.') && path.endsWith('.value')) return 'pressures'
  if (path.startsWith('areas.')) return 'areas'
  return 'other'
}

function enforceOverallCap(groups: GroupedDiffs, cap: number): void {
  const keys = Object.keys(groups) as Array<keyof GroupedDiffs>
  let total = keys.reduce((n, k) => n + groups[k].length, 0)
  while (total > cap) {
    let weakestKey: keyof GroupedDiffs | undefined
    let weakestDelta = Infinity
    for (const k of keys) {
      const last = groups[k].at(-1)
      if (!last) continue
      const d = Math.abs(last.delta)
      if (d < weakestDelta) {
        weakestDelta = d
        weakestKey = k
      }
    }
    if (!weakestKey) break
    groups[weakestKey].pop()
    total--
  }
}

function changeDirection(change: StateChange): ReportDirection {
  if (change.delta === undefined) return 'neutral'
  if (change.delta > 0) return 'gain'
  if (change.delta < 0) return 'loss'
  return 'neutral'
}

// ---------- Owner actions ----------

function projectOwnerActions(
  result: SimResult,
  state: TavernState,
): ReportOwnerActionLine[] {
  const section = result.reports.find((r) => r.id === 'ownerActions')
  const applied = (section?.data?.['applied'] as OwnerActionApplied[] | undefined) ?? []
  return applied.map((a) => {
    const line: ReportOwnerActionLine = {
      actionId: a.actionId,
      label: a.label,
      timeCost: a.timeCost,
      effects: [...a.effects],
    }
    if (a.targetId !== undefined) {
      line.targetId = a.targetId
      const targetLabel = resolveActionTargetLabel(a.actionId, a.targetId, state)
      if (targetLabel) line.targetLabel = targetLabel
    }
    return line
  })
}

/**
 * Phase 117 — Resolve a player-facing label for an owner-action
 * target. Reads the action definition's `targetType` (via the action
 * registry) and dispatches to the matching id source:
 * registry-backed lookups for area / stock / recipe / policy, and
 * state-backed lookups for staff / regular / supplier / faction.
 * Falls back to `humanizeId(targetId)` when no source resolves.
 */
function resolveActionTargetLabel(
  actionId: string,
  targetId: string,
  state: TavernState,
): string | undefined {
  if (!actionRegistry.has(actionId)) return humanizeId(targetId)
  const def = actionRegistry.get(actionId)
  switch (def.targetType) {
    case 'area':
      return idLabel('area', targetId)
    case 'stock':
      return idLabel('stock', targetId)
    case 'recipe':
      return idLabel('recipe', targetId)
    case 'policy':
      return idLabel('policy', targetId)
    case 'staff':
      return state.staff[targetId]?.name.display ?? humanizeId(targetId)
    case 'regular': {
      const reg = state.world?.regulars?.[targetId]
      return reg?.name?.display ?? humanizeId(targetId)
    }
    case 'supplier': {
      const sup = state.world?.suppliers?.[targetId]
      return sup?.name?.display ?? sup?.label ?? humanizeId(targetId)
    }
    case 'faction': {
      const fac = state.world?.factions?.[targetId]
      return fac?.label ?? humanizeId(targetId)
    }
    case 'customer_group': {
      const cg = state.customerGroups?.[targetId]
      return cg?.label ?? humanizeId(targetId)
    }
    case 'project': {
      const projects =
        (state.modules['ownerActions'] as { projects?: Record<string, { label?: string }> } | undefined)
          ?.projects ?? {}
      return projects[targetId]?.label ?? humanizeId(targetId)
    }
    case 'global':
      return undefined
    default:
      return humanizeId(targetId)
  }
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

function projectServiceLines(
  result: SimResult,
  state: TavernState,
  closedDay: number,
): ReportServiceLine[] {
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
    const groupCount = Object.keys(serviceResult.trafficByGroup ?? {}).length
    lines.push({
      readable: composeTrafficLine({
        state,
        closedDay,
        trafficTotal,
        groupCount,
      }),
      category: 'traffic',
    })
  }
  if (serviceResult.netCoinEarned !== undefined && serviceResult.netCoinEarned !== 0) {
    lines.push({
      readable: composeServiceLine({
        state,
        closedDay,
        netCoin: serviceResult.netCoinEarned,
        unpaidTabs: serviceResult.unpaidTabs ?? 0,
      }),
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
    lines.push({
      readable: composeDriverLine({
        state,
        closedDay,
        driverName: drivers.positive,
        direction: 'positive',
      }),
      category: 'driver',
    })
  }
  if (drivers?.negative && lines.length < SERVICE_LINE_CAP) {
    lines.push({
      readable: composeDriverLine({
        state,
        closedDay,
        driverName: drivers.negative,
        direction: 'negative',
      }),
      category: 'driver',
    })
  }
  return lines.slice(0, SERVICE_LINE_CAP)
}

// ---------- Day arc (Phase 186 / Cluster 6) ----------

/**
 * Order the day's already-projected rich lines into the three movements
 * the engine's segments actually produce, so the report reads as the
 * day's story rather than a flat category dump:
 *
 *   opening   — the owner actions you committed at the morning plan
 *               (Segment B `applyOwnerActions`), the day's first moves.
 *   service   — the service outcome (Segment B service resolution),
 *               the day playing out.
 *   reckoning — the cards you answered at the service-react pause
 *               (Segment C `applyResponses`), the calls you made.
 *
 * No new facts are invented — each movement re-homes lines the
 * projection already derived. Empty movements are omitted so a quiet
 * day shows a short arc (or none) rather than empty headings. The
 * per-movement connective is composed deterministically per
 * (closedDay, movementId).
 */
function projectDayArc(
  pieces: {
    ownerActionsApplied: ReportOwnerActionLine[]
    serviceLines: ReportServiceLine[]
    resolvedIntents: ReportResolvedIntent[]
  },
  state: TavernState,
  closedDay: number,
): DayArcMovement[] {
  const movements: DayArcMovement[] = []

  if (pieces.ownerActionsApplied.length > 0) {
    movements.push({
      id: 'opening',
      title: 'You set the day in motion',
      ...arcVoice(state, closedDay, 'opening'),
      entries: pieces.ownerActionsApplied.map((action) => ({
        kind: 'owner_action' as const,
        action,
      })),
    })
  }

  if (pieces.serviceLines.length > 0) {
    movements.push({
      id: 'service',
      title: 'Service ran',
      ...arcVoice(state, closedDay, 'service'),
      entries: pieces.serviceLines.map((line) => ({
        kind: 'service' as const,
        line,
      })),
    })
  }

  if (pieces.resolvedIntents.length > 0) {
    movements.push({
      id: 'reckoning',
      title: 'You answered the day',
      ...arcVoice(state, closedDay, 'reckoning'),
      entries: pieces.resolvedIntents.map((intent) => ({
        kind: 'resolved_intent' as const,
        intent,
      })),
    })
  }

  return movements
}

function arcVoice(
  state: TavernState,
  closedDay: number,
  movementId: 'opening' | 'service' | 'reckoning',
): { voice?: string } {
  const voice = composeDayArcLine({ state, closedDayOrdinal: closedDay, movementId })
  return voice ? { voice } : {}
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
 *
 * Phase 117 — delegates to the shared `humanizePath()` so the
 * drilldown title matches the row text in the daily report.
 */
export function formatDiffPathTitle(path: string): string {
  return humanizePath(path)
}

export { type CauseEntry }
