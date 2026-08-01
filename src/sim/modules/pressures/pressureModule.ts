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
import {
  getRule,
  scaleOngoingDays,
} from '../../contracts/ruleset/index'
import { recordMeterMovement } from '../../contracts/meters/index'

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

/**
 * Phase 200 / audit Wave 1 (`P4-SEAM-003`) — how long a response's direct
 * pressure effect keeps mattering.
 *
 * A response that eases Maintenance by 10 does not change any of the
 * state the maintenance calculator reads, so without this the calculator
 * would put the pressure straight back the next morning and the card's
 * own preview would have been a lie by breakfast. The delta is recorded
 * as an adjustment the calculated value is combined with, at full weight
 * on the day it lands and fading linearly to nothing across this window.
 */
export const PRESSURE_ADJUSTMENT_DECAY_DAYS = 5

/**
 * A direct pressure delta applied by a response, still in effect.
 * Written by the response applier, consumed (and pruned) here.
 */
export type PressureAdjustment = {
  amount: number
  appliedDay: number
  /** Days from `appliedDay` over which the amount fades to zero. */
  decayDays: number
  source: string
}

export type PressureModuleState = {
  snapshots: Record<string, PressureSnapshot>
  /** Rolling history of recent values, oldest first, up to TREND_HISTORY_LIMIT. */
  history: Record<string, number[]>
  lastCalculatedDay: number
  /**
   * Phase 200 / audit Wave 1 — the value each pressure closed the
   * previous day at. `previousValue` (and so the day-over-day delta and
   * the day's single cause) is measured from here rather than from the
   * last snapshot written, because the day now calculates twice: once at
   * `closing` and once at `endDay` after responses have run. Measuring
   * from the last snapshot would make the second pass report only the
   * response's share of the move.
   */
  openingValues?: Record<string, number>
  /** Live direct-response adjustments per pressure id. */
  adjustments?: Record<string, PressureAdjustment[]>
}

export function createInitialPressureModuleState(): PressureModuleState {
  return {
    snapshots: {},
    history: {},
    lastCalculatedDay: -1,
    openingValues: {},
    adjustments: {},
  }
}

/**
 * Total adjustment still in effect for `id` on `today`, and the entries
 * worth keeping. An entry at or past its decay window contributes
 * nothing and is dropped.
 */
export function activeAdjustment(
  entries: ReadonlyArray<PressureAdjustment> | undefined,
  today: number,
): { total: number; live: PressureAdjustment[] } {
  if (!entries || entries.length === 0) return { total: 0, live: [] }
  let total = 0
  const live: PressureAdjustment[] = []
  for (const entry of entries) {
    const age = today - entry.appliedDay
    if (age < 0) {
      // Scheduled ahead of today (shouldn't happen) — keep, ignore for now.
      live.push(entry)
      continue
    }
    const span = Math.max(1, entry.decayDays)
    if (age >= span) continue
    const weight = 1 - age / span
    total += entry.amount * weight
    live.push(entry)
  }
  return { total, live }
}

/**
 * Record a direct pressure delta so it survives the next recalculation.
 * Called by the response applier — the single path through which both
 * immediate and drained-pending response effects reach a pressure.
 */
export function recordPressureAdjustment(
  ctx: SimContext,
  id: string,
  amount: number,
  source: string,
): void {
  if (amount === 0) return
  const today = ctx.state.calendar.totalDaysElapsed
  ctx.modifyModuleState<PressureModuleState>(
    PRESSURES_MODULE_ID,
    (current) => {
      const base = current ?? createInitialPressureModuleState()
      const existing = base.adjustments?.[id] ?? []
      return {
        ...base,
        adjustments: {
          ...(base.adjustments ?? {}),
          [id]: [
            ...existing,
            {
              amount,
              appliedDay: today,
              // Expansion Phase 1 §1.3 — how long the credit for fixing
              // something lasts is a ruleset knob. On `easy` a repair keeps
              // its weight ~40% longer; on `hard` it fades faster, so
              // holding a pressure down takes sustained work rather than one
              // good day. The window is captured at record time so a
              // re-tuning cannot retroactively shorten adjustments the
              // player already earned.
              decayDays: scaleOngoingDays(
                PRESSURE_ADJUSTMENT_DECAY_DAYS,
                getRule(ctx.state, 'pressureAdjustmentDecayMultiplier'),
              ),
              source,
            },
          ],
        },
      }
    },
    { source: SOURCE, reason: 'record_adjustment' },
  )
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
  /**
   * Expansion Phase 1 §1.5 — only the authoritative pass records meter
   * detail. `runPressurePass` runs twice a day (calculate, then finalize),
   * and recording from both would double-count the excess and the velocity.
   */
  recordDetail = false,
): PressureSnapshot {
  const value = Math.max(0, Math.min(100, Math.round(result.value)))
  const delta = value - previousValue

  // Expansion Phase 1 §1.5 — a pressure whose contributors add up to 130
  // shows 100, and so does one at 101. Banking the excess is what makes
  // progress visible in the report while the player fixes their way back
  // down to the cap, instead of the meter looking stuck and the game looking
  // broken exactly when they are doing the right thing.
  if (recordDetail) {
    recordMeterMovement(ctx, {
      target: `pressure:${definition.id}`,
      previousVisible: previousValue,
      desired: Math.round(result.value),
      visible: value,
    })
  }
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

// Phase 200 / audit Wave 1 — one pressure authority.
//
// `state.pressures[id].value` is THE pressure value. The rich snapshot in
// this slice records how it got there and always carries the same number;
// `compact.value === snapshot.value` at every stable beat.
//
// Before this, `previousValue` was read from the rich snapshot while the
// compact value was written only when `|delta| >= 2`, so a sub-threshold
// move left the two stores permanently apart, and a delayed response that
// moved compact at `startDay` made the calculator measure against a stale
// previous value, compute a delta of 0, decline to write compact, and
// leave the two 10 apart (`P4-SEAM-003`).
//
// The day now calculates twice:
//
//   `closing` — values + compact sync, so closing-time seed generation
//               reads today's pressure. No cause, no history.
//   `endDay`  — recalculated against post-response state (it runs right
//               after `applyResponses`), compact synced again, and the
//               ONLY place the day's pressure causes and history entries
//               are emitted.
//
// That makes the report and the next morning read post-response truth
// (`P7-EXP-004`) and gives one significant change exactly one cause
// (`P4-SEAM-001`) — where the old code emitted two, once through
// `modifyPressure`'s cause metadata and once through an explicit
// `addCause` written against a stale comment claiming the engine did not
// log. Compact is now synced by a `modifyPressure` call carrying NO cause
// metadata, and the single cause is raised explicitly with the
// day-over-day amount.
function runPressurePass(ctx: SimContext, emitCauses: boolean): void {
  ensureRequiredPressuresRegistered()
  const slice = getPressureModuleState(ctx.state)
  const today = ctx.state.calendar.totalDaysElapsed
  const nextSnapshots: Record<string, PressureSnapshot> = { ...slice.snapshots }
  const nextHistory: Record<string, number[]> = {}
  for (const [id, samples] of Object.entries(slice.history)) {
    nextHistory[id] = [...samples]
  }
  const nextOpeningValues: Record<string, number> = { ...(slice.openingValues ?? {}) }
  const nextAdjustments: Record<string, PressureAdjustment[]> = {}

  for (const definition of pressureRegistry.all()) {
    const onState = ctx.state.pressures[definition.id]
    // Day-over-day is measured from yesterday's close, not from whatever
    // the earlier pass of today happened to write. `openingValues` is the
    // authority for that; the snapshot/compact fallbacks only cover the
    // very first pass of the very first day, before any opening value
    // has been recorded. (Reading the snapshot unconditionally is what
    // made the second pass measure against the FIRST pass of the same
    // day and report a delta of ~0 for every pressure.)
    const previousValue =
      slice.openingValues?.[definition.id] ??
      slice.snapshots[definition.id]?.value ??
      onState?.value ??
      0

    const result = definition.calculate(ctx)
    const { total: adjustment, live } = activeAdjustment(
      slice.adjustments?.[definition.id],
      today,
    )
    if (live.length > 0) nextAdjustments[definition.id] = live

    const snapshot = buildSnapshot(
      ctx,
      definition,
      adjustment === 0 ? result : { ...result, value: result.value + adjustment },
      previousValue,
      // `emitCauses` marks the authoritative pass of the day — the same
      // reason it gates the trend sample gates the meter-detail record.
      emitCauses,
    )

    // Apply the multi-day trend on top of the day-over-day snapshot so
    // reports can distinguish a long climb from a single-day blip. Only
    // the cause-emitting pass appends a sample, so a day contributes one
    // point to the trend window rather than two.
    const history = nextHistory[definition.id] ?? []
    snapshot.trend = trendFromHistory(history, snapshot.value)
    if (emitCauses) {
      history.push(snapshot.value)
      if (history.length > TREND_HISTORY_LIMIT) history.shift()
    }
    nextHistory[definition.id] = history

    nextSnapshots[definition.id] = snapshot

    if (!onState) continue

    // Sync the canonical compact value to the snapshot — always, not only
    // on a significant move. No cause metadata: this is bookkeeping, and
    // the day's single cause is raised below with the real amount.
    const syncDelta = snapshot.value - onState.value
    if (syncDelta !== 0) ctx.modifyPressure(definition.id, syncDelta)

    if (emitCauses) {
      // Today's final value is tomorrow's opening value.
      nextOpeningValues[definition.id] = snapshot.value
    } else if (nextOpeningValues[definition.id] === undefined) {
      // First pass of the first day: record where the day opened so the
      // finalizing pass has a real anchor to measure against.
      nextOpeningValues[definition.id] = previousValue
    }

    if (!emitCauses) continue
    if (Math.abs(snapshot.delta) < SIGNIFICANT_DELTA) continue

    const dominant = snapshot.causes
      .slice()
      .sort((a, b) => b.weight - a.weight)[0]
    const direction: 'increase' | 'decrease' | 'neutral' =
      snapshot.delta > 0 ? 'increase' : snapshot.delta < 0 ? 'decrease' : 'neutral'
    ctx.addCause({
      source: `pressures.${definition.id}`,
      sourceType: 'pressure',
      target: `pressure:${definition.id}`,
      targetType: 'pressure',
      amount: snapshot.delta,
      direction,
      weight: Math.abs(snapshot.delta),
      readable: dominant?.readable ?? buildSummaryReadable(definition, snapshot),
      tags: ['pressure', definition.id, ...(definition.tags ?? [])],
      relatedSystems: snapshot.relatedSystems,
      // Phase 201 / audit Wave 2 (`P5-PLAY-003`) — when the cause borrows
      // the DOMINANT breakdown line's words ("Nash is publicly blamed"),
      // it must borrow that line's actors too. Attaching the snapshot's
      // aggregate actor list instead made one staff member's blame read
      // as evidence about every staff member, and seeds scoped by actor
      // picked it up accordingly.
      relatedActors: dominant?.relatedActors ?? snapshot.relatedActors,
      relatedLocations: dominant?.relatedLocations ?? snapshot.relatedLocations,
      expiresAfterDays: 7,
    })
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

  // Persist the day's snapshots and the multi-day trend history. The
  // rich Phase 18 PressureSnapshot lives in this module slice; the
  // on-state `state.pressures[id]` keeps the compact value/trend pair
  // that the diff/cause pipelines need.
  writeSlice(
    ctx,
    {
      snapshots: nextSnapshots,
      history: nextHistory,
      lastCalculatedDay: today,
      openingValues: nextOpeningValues,
      adjustments: nextAdjustments,
    },
    emitCauses ? 'finalize' : 'recalculate',
  )
}

const calculatePressuresHook: SimulationHook = (ctx: SimContext): void => {
  runPressurePass(ctx, false)
}

const finalizePressuresHook: SimulationHook = (ctx: SimContext): void => {
  runPressurePass(ctx, true)
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
//
// Phase 38 §38.2 widens the EntityRef kinds to match the canonical
// `EntityRef` type so expanded pressures can reference world entities
// (supplier, regular, faction, culture, local_event, …) without
// stringifying ids.
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
  origin: z.enum([
    'inherited',
    'discovered',
    'warned',
    'player_caused',
    'neglected',
    'decay',
    'external',
    'memory',
    'unknown',
  ]).optional(),
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

const PressureAdjustmentSchema = z.object({
  amount: z.number(),
  appliedDay: z.number().int(),
  decayDays: z.number().int().positive(),
  source: z.string(),
})

const PressureModuleStateSchema = z.object({
  snapshots: z.record(z.string(), PressureSnapshotSchema),
  history: z.record(z.string(), z.array(z.number())),
  lastCalculatedDay: z.number().int(),
  // Phase 200 / audit Wave 1. Optional so a save written before the wave
  // still validates; the migration fills them in.
  openingValues: z.record(z.string(), z.number()).optional(),
  adjustments: z.record(z.string(), z.array(PressureAdjustmentSchema)).optional(),
})

// Phase 206 / audit Wave 7 — reconcile the snapshots with the canonical
// compact values at the END of Segment A, after every Morning-phase
// writer has moved them.
//
// The Phase 8 §8.2 invariant (`snapshot.value === compact.value`) is a
// stable-beat contract, and the Morning pause is a stable beat. The two
// recalculation passes below run at `closing` (end of Segment B) and
// `endDay` (Segment C, after responses), so a compact write during
// Segment A — a local-arc effect on `localEventUpdate`, a supplier event
// on `supplierUpdate`, both of which go through `ctx.modifyPressure` —
// left the Morning pause showing two different numbers for one pressure.
// The Wave 7 balance harness's per-segment invariant check surfaced it
// on every managed 28-day route (the end-of-day checks had always
// passed, because the divergence healed at the next recalculation).
//
// The sync folds the compact delta into the snapshot and says why, so
// causality survives: the writer's own cause entry is already in
// `state.causes` with full attribution, and the snapshot gains a line
// noting the morning adjustment rather than silently teleporting.
function syncSnapshotsToCompact(
  ctx: SimContext,
  timing: 'morning' | 'settlement',
): void {
  const slice = getPressureModuleState(ctx.state)
  let changed = false
  const nextSnapshots: Record<string, PressureSnapshot> = {}
  for (const [id, snapshot] of Object.entries(slice.snapshots)) {
    const compact = ctx.state.pressures[id]
    if (!compact || compact.value === snapshot.value) {
      nextSnapshots[id] = snapshot
      continue
    }
    const delta = compact.value - snapshot.value
    changed = true
    nextSnapshots[id] = {
      ...snapshot,
      value: compact.value,
      delta: compact.value - snapshot.previousValue,
      trend: computeTrend(snapshot.previousValue, compact.value),
      causes: [
        ...snapshot.causes,
        {
          id: `${id}_${timing}_adjustment`,
          readable:
            timing === 'morning'
              ? `Adjusted ${delta > 0 ? '+' : ''}${delta} by a morning event (arc, supplier or delayed effect) after yesterday's calculation.`
              : `Adjusted ${delta > 0 ? '+' : ''}${delta} by a weekly or monthly settlement after today's calculation.`,
          amount: delta,
          weight: Math.abs(delta),
          direction: delta > 0 ? 'increase' : 'decrease',
          tags: ['pressure', id, `${timing}_adjustment`],
        },
      ],
      lastUpdated: stampFromState(ctx.state),
    }
  }
  if (changed) writeSlice(ctx, { snapshots: nextSnapshots }, `${timing}_sync`)
}

const syncMorningSnapshotsHook: SimulationHook = (ctx: SimContext): void => {
  syncSnapshotsToCompact(ctx, 'morning')
}

// `endDay` owns the final calculation, but weekly payroll/employment and
// month-end local-arc effects run later in Segment C. They may legitimately
// nudge compact pressure values, so each settlement boundary closes by
// restoring the same compact === rich-snapshot invariant as the morning
// pause. On day 28, the endMonth call includes any endWeek movement too.
const syncSettlementSnapshotsHook: SimulationHook = (ctx: SimContext): void => {
  syncSnapshotsToCompact(ctx, 'settlement')
}

export const pressuresModule: SimulationModule = {
  id: PRESSURES_MODULE_ID,
  version: '0.1.0',
  // Pressures consume causes/memories/history, so they depend on the
  // modules that maintain those slices.
  dependsOn: ['causes', 'memories'],
  hooks: {
    // Phase 206 / audit Wave 7 — reconcile snapshots with compact values
    // before the Morning pause; `forecastTraffic` is the last Segment A
    // phase, after every Morning writer has run.
    forecastTraffic: [syncMorningSnapshotsHook],
    // Run during `closing` (after service, before endDay/Week/Month
    // hooks decide their finalisation) so the pressure values reflect
    // the full day's mechanical movement and closing-time seed
    // generation reads today's numbers.
    closing: [calculatePressuresHook],
    // Phase 200 / audit Wave 1 — and again on `endDay`, immediately after
    // `applyResponses`, so the report, the ribbon and the next morning
    // read the same post-response value the player carries forward. This
    // is the pass that owns the day's pressure causes and history.
    endDay: [finalizePressuresHook],
    endWeek: [syncSettlementSnapshotsHook],
    endMonth: [syncSettlementSnapshotsHook],
  },
  buildReport: buildReport,
  validate: validatePressures,
  stateSchema: PressureModuleStateSchema,
}

export {
  ensureRequiredPressuresRegistered,
  pressureRegistry,
}
