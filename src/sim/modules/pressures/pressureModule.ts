import { z } from 'zod'

import type { SimulationHook, SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'
import type { CalendarStamp, EntityRef, TavernState } from '../../state/TavernState'

import {
  ensureRequiredPressuresRegistered,
  pressureRegistry,
} from './pressureRegistry'
import type { PressureDefinition } from './pressureRegistry'
import {
  PRESSURE_IDS,
  TREND_STABLE_EPSILON,
  type PressureCalculationResult,
  type PressureSnapshot,
  type PressureTrend,
} from './pressureTypes'
import { buildPressureReport } from './pressureReport'

// Phase 18 — Pressure module.
//
// Responsibilities:
//   - Ensure the canonical pressure registry is loaded.
//   - On `endDay` (after service / weekly / monthly have run), iterate
//     every registered pressure, run `calculate(ctx)`, and produce a
//     `PressureSnapshot` (severity, urgency, trend, causes...) in the
//     module slice. Significant value changes flow through
//     `ctx.modifyPressure` so the cause/diff pipelines see them.
//   - Emit the PRESSURE REPORT on `generateReports`.
//   - Validate that the module slice carries snapshots for the canonical
//     ids and that meter fields stay in 0–100.
//
// The pressure module deliberately runs after service/weekly/monthly so
// the pressures it computes reflect the day's full mechanical movement.

export const PRESSURES_MODULE_ID = 'pressures'

const SOURCE = PRESSURES_MODULE_ID
const TREND_HISTORY_LIMIT = 7
const SIGNIFICANT_DELTA = 2

export type PressureModuleState = {
  snapshots: Record<string, PressureSnapshot>
  /** Rolling history of recent values, oldest first, up to TREND_HISTORY_LIMIT. */
  history: Record<string, number[]>
  lastCalculatedDay: number
}

export function createInitialPressureModuleState(): PressureModuleState {
  return {
    snapshots: {},
    history: {},
    lastCalculatedDay: -1,
  }
}

export function getPressureModuleState(state: {
  modules: Record<string, unknown>
}): PressureModuleState {
  const slice = state.modules[PRESSURES_MODULE_ID] as
    | PressureModuleState
    | undefined
  if (!slice) return createInitialPressureModuleState()
  return slice
}

function stampFromState(state: TavernState): CalendarStamp {
  return {
    year: state.calendar.year,
    month: state.calendar.month,
    week: state.calendar.week,
    day: state.calendar.day,
    absoluteDay: state.calendar.totalDaysElapsed,
  }
}

function computeTrend(previousValue: number, nextValue: number): PressureTrend {
  const delta = nextValue - previousValue
  if (Math.abs(delta) < TREND_STABLE_EPSILON) return 'stable'
  return delta > 0 ? 'rising' : 'falling'
}

function trendFromHistory(
  history: ReadonlyArray<number>,
  currentValue: number,
): PressureTrend {
  if (history.length === 0) return computeTrend(currentValue, currentValue)
  // Use the oldest recent sample as the anchor for the multi-day trend.
  // This makes "rising" mean "rising over the recent window", not just
  // "moved this single day". `previousValue` in the snapshot keeps the
  // strict day-over-day delta.
  const anchor = history[0] ?? currentValue
  return computeTrend(anchor, currentValue)
}

function dedupeEntityRefs(refs: ReadonlyArray<EntityRef>): EntityRef[] {
  const out: EntityRef[] = []
  const seen = new Set<string>()
  for (const ref of refs) {
    const key = `${ref.kind}:${ref.id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ...ref })
  }
  return out
}

function dedupeStrings(values: ReadonlyArray<string>): string[] {
  const out: string[] = []
  for (const v of values) {
    if (!out.includes(v)) out.push(v)
  }
  return out
}

function buildSnapshot(
  ctx: SimContext,
  definition: PressureDefinition,
  result: PressureCalculationResult,
  previousValue: number,
): PressureSnapshot {
  const value = Math.max(0, Math.min(100, Math.round(result.value)))
  const delta = value - previousValue
  const trend = computeTrend(previousValue, value)
  const volatility =
    result.volatility !== undefined
      ? Math.max(0, Math.min(100, Math.round(result.volatility)))
      : Math.max(0, Math.min(100, Math.round(Math.abs(delta) * 8)))
  const actors = dedupeEntityRefs(result.relatedActors ?? [])
  const locations = dedupeEntityRefs(result.relatedLocations ?? [])
  const systems = dedupeStrings([
    ...(definition.relatedSystems ?? []),
    ...(result.relatedSystems ?? []),
  ])
  const tags = dedupeStrings([...(definition.tags ?? []), ...(result.tags ?? [])])
  return {
    id: definition.id,
    label: definition.label,
    value,
    previousValue,
    delta,
    trend,
    severity: Math.max(0, Math.min(100, Math.round(result.severity))),
    urgency: Math.max(0, Math.min(100, Math.round(result.urgency))),
    volatility,
    causes: result.causes.map((c) => ({
      ...c,
      tags: [...c.tags],
      ...(c.relatedActors ? { relatedActors: c.relatedActors.map((a) => ({ ...a })) } : {}),
      ...(c.relatedLocations
        ? { relatedLocations: c.relatedLocations.map((l) => ({ ...l })) }
        : {}),
      ...(c.relatedSystems ? { relatedSystems: [...c.relatedSystems] } : {}),
    })),
    relatedActors: actors,
    relatedLocations: locations,
    relatedSystems: systems,
    tags,
    consequences: [...(result.consequences ?? [])],
    lastUpdated: stampFromState(ctx.state),
  }
}

function writeSlice(
  ctx: SimContext,
  patch: Partial<PressureModuleState>,
  reason: string,
): void {
  ctx.modifyModuleState<PressureModuleState>(
    PRESSURES_MODULE_ID,
    (current) => {
      const base = current ?? createInitialPressureModuleState()
      return { ...base, ...patch }
    },
    { source: SOURCE, reason },
  )
}

function buildSummaryReadable(
  definition: PressureDefinition,
  snapshot: PressureSnapshot,
): string {
  const delta = snapshot.delta
  const sign = delta > 0 ? '+' : ''
  const trendLabel = snapshot.trend
  return `${definition.label} pressure ${snapshot.previousValue} → ${snapshot.value} (${sign}${delta}, ${trendLabel}).`
}

const calculatePressuresHook: SimulationHook = (ctx: SimContext): void => {
  ensureRequiredPressuresRegistered()
  const slice = getPressureModuleState(ctx.state)
  const nextSnapshots: Record<string, PressureSnapshot> = { ...slice.snapshots }
  const nextHistory: Record<string, number[]> = {}
  for (const [id, samples] of Object.entries(slice.history)) {
    nextHistory[id] = [...samples]
  }

  for (const definition of pressureRegistry.all()) {
    const onState = ctx.state.pressures[definition.id]
    const previousValue =
      slice.snapshots[definition.id]?.value ?? onState?.value ?? 0
    const result = definition.calculate(ctx)
    const snapshot = buildSnapshot(ctx, definition, result, previousValue)

    // Apply the multi-day trend on top of the day-over-day snapshot so
    // reports can distinguish a long climb from a single-day blip.
    const history = nextHistory[definition.id] ?? []
    snapshot.trend = trendFromHistory(history, snapshot.value)
    history.push(snapshot.value)
    if (history.length > TREND_HISTORY_LIMIT) history.shift()
    nextHistory[definition.id] = history

    nextSnapshots[definition.id] = snapshot

    if (!onState) continue
    if (Math.abs(snapshot.delta) >= SIGNIFICANT_DELTA) {
      const dominant = snapshot.causes
        .slice()
        .sort((a, b) => b.weight - a.weight)[0]
      const direction: 'increase' | 'decrease' | 'neutral' =
        snapshot.delta > 0 ? 'increase' : snapshot.delta < 0 ? 'decrease' : 'neutral'
      const causeDraft = {
        source: `pressures.${definition.id}`,
        sourceType: 'pressure' as const,
        target: `pressure:${definition.id}`,
        targetType: 'pressure' as const,
        amount: snapshot.delta,
        direction,
        weight: Math.abs(snapshot.delta),
        readable:
          dominant?.readable ?? buildSummaryReadable(definition, snapshot),
        tags: ['pressure', definition.id, ...(definition.tags ?? [])],
        relatedSystems: snapshot.relatedSystems,
        relatedActors: snapshot.relatedActors,
        relatedLocations: snapshot.relatedLocations,
        expiresAfterDays: 7,
      }
      ctx.modifyPressure(definition.id, snapshot.delta, causeDraft)
      // Phase 17 §17.2.1 — modifyPressure carries the contract, but the
      // engine does not auto-log the draft on `state.causes` (mirrors
      // how Phase 17 modules — e.g. monthly rent — call `addCause`
      // alongside the mutation helper). Log the cause explicitly so the
      // diff/report layer sees a matched entry.
      ctx.addCause(causeDraft)
    }

    if (Math.abs(snapshot.delta) >= SIGNIFICANT_DELTA) {
      ctx.addHistory({
        category: 'pressure',
        summary: buildSummaryReadable(definition, snapshot),
        tags: ['pressure', definition.id, snapshot.trend],
        relatedActors: snapshot.relatedActors,
        relatedLocations: snapshot.relatedLocations,
        relatedSystems: snapshot.relatedSystems,
        mechanicalRefs: [`pressure:${definition.id}`],
      })
    }
  }

  // Persist the day's snapshots and the multi-day trend history. The
  // rich Phase 18 PressureSnapshot lives in this module slice; the
  // on-state `state.pressures[id]` keeps the compact value/trend pair
  // that the diff/cause pipelines need.
  writeSlice(
    ctx,
    {
      snapshots: nextSnapshots,
      history: nextHistory,
      lastCalculatedDay: ctx.state.calendar.totalDaysElapsed,
    },
    'recalculate',
  )
}

function buildReport(ctx: SimContext): ReportSection {
  return buildPressureReport(ctx)
}

function validatePressures(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const slice = getPressureModuleState(ctx.state)
  for (const id of PRESSURE_IDS) {
    if (!ctx.state.pressures[id]) {
      issues.push({
        path: `pressures.${id}`,
        message: `Required pressure '${id}' missing from state`,
        code: 'pressure_missing',
      })
    }
  }
  for (const [id, snapshot] of Object.entries(slice.snapshots)) {
    if (snapshot.value < 0 || snapshot.value > 100) {
      issues.push({
        path: `modules.pressures.snapshots.${id}.value`,
        message: `Pressure '${id}' value out of range (${snapshot.value})`,
        code: 'pressure_value_oor',
      })
    }
    if (snapshot.severity < 0 || snapshot.severity > 100) {
      issues.push({
        path: `modules.pressures.snapshots.${id}.severity`,
        message: `Pressure '${id}' severity out of range (${snapshot.severity})`,
        code: 'pressure_severity_oor',
      })
    }
    if (snapshot.urgency < 0 || snapshot.urgency > 100) {
      issues.push({
        path: `modules.pressures.snapshots.${id}.urgency`,
        message: `Pressure '${id}' urgency out of range (${snapshot.urgency})`,
        code: 'pressure_urgency_oor',
      })
    }
  }
  return issues
}

// Phase 6 §6.1.1 — schema for `state.modules.pressures`.
const EntityRefSchema = z.object({
  kind: z.enum(['staff', 'customer_group', 'area', 'stock', 'role', 'system', 'other']),
  id: z.string(),
})

const PressureCauseRefSchema = z.object({
  id: z.string(),
  readable: z.string(),
  amount: z.number(),
  weight: z.number().min(0),
  direction: z.enum(['increase', 'decrease', 'neutral']),
  tags: z.array(z.string()),
  relatedActors: z.array(EntityRefSchema).optional(),
  relatedLocations: z.array(EntityRefSchema).optional(),
  relatedSystems: z.array(z.string()).optional(),
})

const CalendarStampSchema = z.object({
  year: z.number().int().min(1),
  month: z.number().int().min(1).max(12),
  week: z.number().int().min(1).max(4),
  day: z.number().int().min(1).max(28),
  absoluteDay: z.number().int().min(0),
})

const PressureSnapshotSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.number().min(0).max(100),
  previousValue: z.number(),
  delta: z.number(),
  trend: z.enum(['rising', 'stable', 'falling']),
  severity: z.number().min(0).max(100),
  urgency: z.number().min(0).max(100),
  volatility: z.number().min(0).max(100),
  causes: z.array(PressureCauseRefSchema),
  relatedActors: z.array(EntityRefSchema),
  relatedLocations: z.array(EntityRefSchema),
  relatedSystems: z.array(z.string()),
  tags: z.array(z.string()),
  consequences: z.array(z.string()),
  lastUpdated: CalendarStampSchema,
})

const PressureModuleStateSchema = z.object({
  snapshots: z.record(z.string(), PressureSnapshotSchema),
  history: z.record(z.string(), z.array(z.number())),
  lastCalculatedDay: z.number().int(),
})

export const pressuresModule: SimulationModule = {
  id: PRESSURES_MODULE_ID,
  version: '0.1.0',
  // Pressures consume causes/memories/history, so they depend on the
  // modules that maintain those slices.
  dependsOn: ['causes', 'memories'],
  hooks: {
    // Run during `closing` (after service, before endDay/Week/Month
    // hooks decide their finalisation) so the pressure values reflect
    // the full day's mechanical movement and so any pressure-driven
    // history entries land before generateReports.
    closing: [calculatePressuresHook],
  },
  buildReport: buildReport,
  validate: validatePressures,
  stateSchema: PressureModuleStateSchema,
}

export {
  ensureRequiredPressuresRegistered,
  pressureRegistry,
}
