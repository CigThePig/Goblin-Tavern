import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'

import { CONDITIONS_MODULE_ID } from './moduleId'

// Expansion Phase 9 §9.4 — the run book for world conditions.
//
// WHERE THIS LIVES, AND WHY NOT ON THE MONTHLY SLICE. `modules.monthly`
// holds `currentModifier`, and it keeps holding it: the arc engine, the
// rent resolution and the monthly report all read it, and widening a
// month-shaped field into a process with a start day, an end day, a burden,
// a counter log and an aftermath would have meant rewriting all three to
// find out what month it is. So the monthly slice keeps the SUMMARY — which
// condition is the month's headline — and this slice carries the process.
//
// THE FOUR COLLECTIONS ARE FOUR DIFFERENT LIFETIMES. Forecasts are things
// that have not happened yet and expire when they do. Active conditions are
// things happening now. History is what happened, kept for the report.
// Scars are the part §9.4 calls "accumulated consequences": what a condition
// left behind that outlived it, and which is still acting on the tavern
// after the condition itself is over. Each has its own cap and its own
// pruning rule (§5.11), because they grow at different rates.

/** What the house has heard is coming. */
export type ConditionForecast = {
  conditionId: string
  /** The day it is expected to start. */
  startsOnDay: number
  /** The day it is expected to end. Both move as confidence firms up. */
  endsOnDay: number
  /** 0..100. Rises as the day nears; a distant forecast is a rumour. */
  confidence: number
  heardOnDay: number
  sourceActor: string
  readable: string
  /**
   * Preparation already bought against this forecast, 0..100.
   *
   * Held on the FORECAST rather than on the condition, because that is
   * where the decision was made: preparing is the reward for having been
   * warned, and it has to be spendable before the thing exists.
   */
  prepared: number
  preparedBy: string[]
}

/** Something happening now. */
export type ActiveCondition = {
  conditionId: string
  startedOnDay: number
  endsOnDay: number
  /**
   * 0..100. What the condition has built up that nobody has dealt with.
   *
   * This is the §9.4 headline: a condition's consequence is not the daily
   * nudge, it is what the daily nudges ADD UP TO by the time it stops.
   */
  burden: number
  peakBurden: number
  /** 0..100, carried over from preparation. Slows the burden rate. */
  preparedness: number
  daysActive: number
  counteredDays: number
  /**
   * Counterplay ids already spent on this run.
   *
   * `prepare` and `exploit` are once each and live here for good. A
   * `counter` is repeatable on a cooldown, so it is NOT recorded here —
   * `lastCounterDay` is what gates it.
   */
  counteredBy: string[]
  /** The day somebody last worked at it. Gates the repeatable counter. */
  lastCounterDay?: number
  exploited: boolean
  /** Gains banked by exploiting it rather than only surviving it. */
  exploitGain: number
  sourceActor: string
  /** Did this one arise from the tavern's own state rather than the month? */
  arose: boolean
}

/** What a condition left behind. */
export type ConditionScar = {
  id: string
  conditionId: string
  label: string
  readable: string
  createdOnDay: number
  /** Scars fade. A permanent consequence would outgrow any cap. */
  expiresOnDay: number
  severity: number
}

export type ConditionRecord = {
  conditionId: string
  startedOnDay: number
  endedOnDay: number
  peakBurden: number
  finalBurden: number
  counteredDays: number
  preparedness: number
  exploited: boolean
  exploitGain: number
  /** What the aftermath actually did, or why it did nothing. */
  outcome: 'clean' | 'scarred' | 'exploited'
  readable: string
}

export type ConditionTotals = {
  forecast: number
  started: number
  ended: number
  arisen: number
  prepared: number
  countered: number
  exploited: number
  cleanEndings: number
  scarsLeft: number
}

export type ConditionsModuleState = {
  forecasts: ConditionForecast[]
  active: ActiveCondition[]
  history: ConditionRecord[]
  scars: ConditionScar[]
  totals: ConditionTotals
}

// ---------------------------------------------------------------------------
// Bounds — §5.11
// ---------------------------------------------------------------------------

/**
 * The most conditions that can run at once.
 *
 * Two, not one and not five. One would mean a cellar that grew mould could
 * not also be rained on, which is the situation a tavern is most obviously
 * in; five would mean the player never has a legible reason for anything.
 */
export const MAX_ACTIVE_CONDITIONS = 2
export const MAX_FORECASTS = 3
export const MAX_CONDITION_HISTORY = 16
export const MAX_SCARS = 6
/** Scars fade after this long, which is what keeps the collection bounded. */
export const SCAR_LIFETIME_DAYS = 60

export function createInitialConditionTotals(): ConditionTotals {
  return {
    forecast: 0,
    started: 0,
    ended: 0,
    arisen: 0,
    prepared: 0,
    countered: 0,
    exploited: 0,
    cleanEndings: 0,
    scarsLeft: 0,
  }
}

export function createInitialConditionsModuleState(): ConditionsModuleState {
  return {
    forecasts: [],
    active: [],
    history: [],
    scars: [],
    totals: createInitialConditionTotals(),
  }
}

export function normalizeConditionsSlice(
  slice: Partial<ConditionsModuleState> | undefined,
): ConditionsModuleState {
  const base = createInitialConditionsModuleState()
  if (!slice) return base
  return {
    forecasts: slice.forecasts ?? base.forecasts,
    active: slice.active ?? base.active,
    history: slice.history ?? base.history,
    scars: slice.scars ?? base.scars,
    totals: { ...base.totals, ...(slice.totals ?? {}) },
  }
}

export function getConditionsModuleState(state: {
  modules: Record<string, unknown>
}): ConditionsModuleState {
  return normalizeConditionsSlice(
    state.modules[CONDITIONS_MODULE_ID] as
      | Partial<ConditionsModuleState>
      | undefined,
  )
}

export function activeCondition(
  state: TavernState,
  conditionId: string,
): ActiveCondition | undefined {
  return getConditionsModuleState(state).active.find(
    (entry) => entry.conditionId === conditionId,
  )
}

export function forecastFor(
  state: TavernState,
  conditionId: string,
): ConditionForecast | undefined {
  return getConditionsModuleState(state).forecasts.find(
    (entry) => entry.conditionId === conditionId,
  )
}

/** Scars still in force today, which is what downstream readers care about. */
export function liveScars(state: TavernState): ConditionScar[] {
  const today = state.calendar.totalDaysElapsed
  return getConditionsModuleState(state)
    .scars.filter((scar) => scar.expiresOnDay > today)
    .sort((a, b) => b.severity - a.severity || a.id.localeCompare(b.id))
}

export function writeConditionsSlice(
  ctx: SimContext,
  updater: (current: ConditionsModuleState) => ConditionsModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<ConditionsModuleState>(
    CONDITIONS_MODULE_ID,
    (current) => updater(normalizeConditionsSlice(current)),
    { source: `${CONDITIONS_MODULE_ID}.${reason}`, reason },
  )
}

export function writeActiveCondition(
  ctx: SimContext,
  conditionId: string,
  updater: (current: ActiveCondition) => ActiveCondition,
  reason: string,
): void {
  writeConditionsSlice(
    ctx,
    (current) => ({
      ...current,
      active: current.active.map((entry) =>
        entry.conditionId === conditionId ? updater(entry) : entry,
      ),
    }),
    reason,
  )
}

export function writeForecast(
  ctx: SimContext,
  conditionId: string,
  updater: (current: ConditionForecast) => ConditionForecast,
  reason: string,
): void {
  writeConditionsSlice(
    ctx,
    (current) => ({
      ...current,
      forecasts: current.forecasts.map((entry) =>
        entry.conditionId === conditionId ? updater(entry) : entry,
      ),
    }),
    reason,
  )
}

export function bumpConditionTotal(
  ctx: SimContext,
  key: keyof ConditionTotals,
  by = 1,
): void {
  if (by === 0) return
  writeConditionsSlice(
    ctx,
    (current) => ({
      ...current,
      totals: {
        ...createInitialConditionTotals(),
        ...current.totals,
        [key]: (current.totals[key] ?? 0) + by,
      },
    }),
    'totals',
  )
}

/**
 * §5.11 — the pruning rule for all four collections in one place.
 *
 * History and scars are the two that grow without bound in a long game:
 * one record per condition forever, and one scar per condition that was
 * ignored. History is capped by count because it is a report tail; scars
 * are capped by EXPIRY first, because a scar that has faded should stop
 * acting on the tavern whether or not the cap has been reached.
 */
export function pruneConditionsSlice(
  slice: ConditionsModuleState,
  today: number,
): ConditionsModuleState {
  const scars = slice.scars
    .filter((scar) => scar.expiresOnDay > today)
    .sort((a, b) => b.createdOnDay - a.createdOnDay)
    .slice(0, MAX_SCARS)
  const history =
    slice.history.length > MAX_CONDITION_HISTORY
      ? slice.history.slice(slice.history.length - MAX_CONDITION_HISTORY)
      : slice.history
  // A forecast whose day has come and gone without it starting was wrong.
  // Dropping it is what stops the board filling with weather that never
  // arrived, and it is deliberately silent — a forecast is a claim, not a
  // promise, and §9.4 asks for a forecast rather than an oracle.
  const forecasts = slice.forecasts.filter((entry) => entry.startsOnDay >= today)
  return { ...slice, scars, history, forecasts }
}

// ---------------------------------------------------------------------------
// Schema — §5.7
// ---------------------------------------------------------------------------

const ForecastSchema = z.object({
  conditionId: z.string(),
  startsOnDay: z.number().int(),
  endsOnDay: z.number().int(),
  confidence: z.number(),
  heardOnDay: z.number().int(),
  sourceActor: z.string(),
  readable: z.string(),
  prepared: z.number(),
  preparedBy: z.array(z.string()),
})

const ActiveConditionSchema = z.object({
  conditionId: z.string(),
  startedOnDay: z.number().int(),
  endsOnDay: z.number().int(),
  burden: z.number(),
  peakBurden: z.number(),
  preparedness: z.number(),
  daysActive: z.number().int(),
  counteredDays: z.number().int(),
  counteredBy: z.array(z.string()),
  lastCounterDay: z.number().int().optional(),
  exploited: z.boolean(),
  exploitGain: z.number(),
  sourceActor: z.string(),
  arose: z.boolean(),
})

const ScarSchema = z.object({
  id: z.string(),
  conditionId: z.string(),
  label: z.string(),
  readable: z.string(),
  createdOnDay: z.number().int(),
  expiresOnDay: z.number().int(),
  severity: z.number(),
})

const RecordSchema = z.object({
  conditionId: z.string(),
  startedOnDay: z.number().int(),
  endedOnDay: z.number().int(),
  peakBurden: z.number(),
  finalBurden: z.number(),
  counteredDays: z.number().int(),
  preparedness: z.number(),
  exploited: z.boolean(),
  exploitGain: z.number(),
  outcome: z.enum(['clean', 'scarred', 'exploited']),
  readable: z.string(),
})

export const ConditionsModuleStateSchema = z.object({
  forecasts: z.array(ForecastSchema),
  active: z.array(ActiveConditionSchema),
  history: z.array(RecordSchema),
  scars: z.array(ScarSchema),
  totals: z.object({
    forecast: z.number(),
    started: z.number(),
    ended: z.number(),
    arisen: z.number(),
    prepared: z.number(),
    countered: z.number(),
    exploited: z.number(),
    cleanEndings: z.number(),
    scarsLeft: z.number(),
  }),
})
