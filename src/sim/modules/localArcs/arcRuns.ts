import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { EntityRef, TavernState } from '../../state/TavernState'
import {
  CLOSED_ARC_RUN_RETENTION_DAYS,
  MAX_ARC_RUNS_KEPT,
  MAX_ARC_RUN_HISTORY,
  type ArcOutcomeKind,
} from '../../content/events/localArcTypes'

import { LOCAL_ARCS_MODULE_ID, type LocalArcsModuleState } from './types'
import { createInitialLocalArcsModuleState, getLocalArcsModuleState } from './state'

// Expansion Phase 9 §9.2 — the run record.
//
// WHERE THIS LIVES, AND WHY NOT ON THE ARC. `world.localEvents` already
// holds an arc: its label, its legacy stage, its intensity and its history.
// That record is the world's summary of the thing, and plenty of code reads
// it — the monthly overview, the report section, four issue-seed generators,
// two pressure calculators. Widening it with a goal meter, an opposition
// meter, an intervention ledger and a resolved outcome would have meant a
// schema change in the shared world branch and a migration for every reader.
//
// So the run lives in the module slice, exactly as a faction's actor lives
// in the factions slice and an NPC's dealings live in the NPCs slice: the
// world record is the identity and the summary, the module slice is the
// domain's own bookkeeping. `arcId` is the join, and the two are written in
// the same pass so they cannot drift.
//
// GOAL AND OPPOSITION ARE THE WHOLE MODEL. `goalProgress` is how close the
// HOUSE is to what it wants; `opposition` is how hard the arc's owner is
// pushing the other way. Every §9.2 requirement lands on one of those two:
// an intervention raises the first, an opposing move raises the second,
// a stage advances when one of them crosses a line, a timeout resolves on
// whichever is ahead, and the outcome — success, compromise, failure — is
// the comparison between them.

export type ArcInterventionRecord = {
  interventionId: string
  takenOnDay: number
  goalProgress: number
  readable: string
}

export type ArcRunHistoryEntry = {
  day: number
  stageId: string
  note: string
}

export type ArcRun = {
  arcId: string
  definitionId: string
  /** Current stage id from the definition's `stages`. */
  stageId: string
  stageEnteredDay: number
  startedOnDay: number
  /** 0..100 — how close the house is to what it wants. */
  goalProgress: number
  /** 0..100 — how hard the owner is pushing back. */
  opposition: number
  /** Resolved once at seed time so every later read gets the same actor. */
  ownerRef?: EntityRef
  /** Readable name of the owner at the time it was resolved. */
  ownerLabel?: string
  /** The day the current stage times out, when it has one. */
  deadlineDay?: number
  /** `moveId` → the day it may next be made. */
  opposingCooldowns: Record<string, number>
  interventions: ArcInterventionRecord[]
  history: ArcRunHistoryEntry[]
  /** Set when the arc has closed. */
  outcome?: ArcOutcomeKind
  closedOnDay?: number
  /** Permanent changes this run actually applied, for the report and §5.11. */
  permanentChanges: string[]
}

export type ArcRunTotals = {
  runsOpened: number
  runsSucceeded: number
  runsCompromised: number
  runsFailed: number
  interventionsTaken: number
  opposingMovesMade: number
  timeoutsHit: number
  permanentChangesApplied: number
  settlementsAgreed: number
}

export function createInitialArcRunTotals(): ArcRunTotals {
  return {
    runsOpened: 0,
    runsSucceeded: 0,
    runsCompromised: 0,
    runsFailed: 0,
    interventionsTaken: 0,
    opposingMovesMade: 0,
    timeoutsHit: 0,
    permanentChangesApplied: 0,
    settlementsAgreed: 0,
  }
}

// ---------------------------------------------------------------------------
// Reading and writing
// ---------------------------------------------------------------------------

export function getArcRuns(state: TavernState): Record<string, ArcRun> {
  return getLocalArcsModuleState(state).runs ?? {}
}

export function getArcRun(state: TavernState, arcId: string): ArcRun | undefined {
  return getArcRuns(state)[arcId]
}

export function getArcRunTotals(state: TavernState): ArcRunTotals {
  return {
    ...createInitialArcRunTotals(),
    ...(getLocalArcsModuleState(state).runTotals ?? {}),
  }
}

/** Runs that are still being played out, oldest first. */
export function liveArcRuns(state: TavernState): ArcRun[] {
  return Object.values(getArcRuns(state))
    .filter((run) => run.outcome === undefined)
    .sort((a, b) => a.startedOnDay - b.startedOnDay || a.arcId.localeCompare(b.arcId))
}

export function writeArcSlice(
  ctx: SimContext,
  updater: (current: LocalArcsModuleState) => LocalArcsModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<LocalArcsModuleState>(
    LOCAL_ARCS_MODULE_ID,
    (current) => updater({ ...createInitialLocalArcsModuleState(), ...(current ?? {}) }),
    { source: `${LOCAL_ARCS_MODULE_ID}.${reason}`, reason },
  )
}

export function writeArcRun(
  ctx: SimContext,
  arcId: string,
  updater: (current: ArcRun) => ArcRun,
  reason: string,
): void {
  writeArcSlice(
    ctx,
    (current) => {
      const run = (current.runs ?? {})[arcId]
      if (!run) return current
      return { ...current, runs: { ...current.runs, [arcId]: updater(run) } }
    },
    reason,
  )
}

export function openArcRun(ctx: SimContext, run: ArcRun): void {
  writeArcSlice(
    ctx,
    (current) => ({
      ...current,
      runs: { ...(current.runs ?? {}), [run.arcId]: run },
      runTotals: {
        ...createInitialArcRunTotals(),
        ...(current.runTotals ?? {}),
        runsOpened: (current.runTotals?.runsOpened ?? 0) + 1,
      },
    }),
    'open_run',
  )
}

export function bumpArcRunTotal(
  ctx: SimContext,
  key: keyof ArcRunTotals,
  by = 1,
): void {
  if (by === 0) return
  writeArcSlice(
    ctx,
    (current) => ({
      ...current,
      runTotals: {
        ...createInitialArcRunTotals(),
        ...(current.runTotals ?? {}),
        [key]: (current.runTotals?.[key] ?? 0) + by,
      },
    }),
    'run_totals',
  )
}

/** Append a line to a run's history, bounded. */
export function noteArcRun(
  ctx: SimContext,
  arcId: string,
  note: string,
): void {
  const today = ctx.state.calendar.totalDaysElapsed
  writeArcRun(
    ctx,
    arcId,
    (run) => {
      const history = [...run.history, { day: today, stageId: run.stageId, note }]
      return {
        ...run,
        history:
          history.length > MAX_ARC_RUN_HISTORY
            ? history.slice(history.length - MAX_ARC_RUN_HISTORY)
            : history,
      }
    },
    'note',
  )
}

// ---------------------------------------------------------------------------
// §5.11 bounded growth
// ---------------------------------------------------------------------------

/**
 * Closed runs are kept for a season and then dropped, and the whole book is
 * capped regardless.
 *
 * A run is worth keeping after it closes because the report says how the
 * last blight went and the recurrence rule reads whether this definition has
 * already run once. Neither needs it forever, and a long game would
 * otherwise accumulate one record per arc per season without limit.
 */
export function pruneArcRuns(
  runs: Record<string, ArcRun>,
  today: number,
): Record<string, ArcRun> {
  const kept: ArcRun[] = []
  for (const run of Object.values(runs)) {
    if (
      run.closedOnDay !== undefined &&
      today - run.closedOnDay > CLOSED_ARC_RUN_RETENTION_DAYS
    ) {
      continue
    }
    kept.push(run)
  }
  // Live runs are never dropped by the cap — they are bounded already by
  // `MAX_ACTIVE_LOCAL_ARCS`. Only the closed tail is trimmed.
  const live = kept.filter((run) => run.outcome === undefined)
  const closed = kept
    .filter((run) => run.outcome !== undefined)
    .sort((a, b) => (a.closedOnDay ?? 0) - (b.closedOnDay ?? 0))
  const room = Math.max(0, MAX_ARC_RUNS_KEPT - live.length)
  const trimmedClosed = closed.slice(Math.max(0, closed.length - room))

  const out: Record<string, ArcRun> = {}
  for (const run of [...live, ...trimmedClosed].sort((a, b) =>
    a.arcId.localeCompare(b.arcId),
  )) {
    out[run.arcId] = run
  }
  return out
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const EntityRefSchema = z.object({ kind: z.string(), id: z.string() })

export const ArcRunSchema = z.object({
  arcId: z.string(),
  definitionId: z.string(),
  stageId: z.string(),
  stageEnteredDay: z.number().int(),
  startedOnDay: z.number().int(),
  goalProgress: z.number(),
  opposition: z.number(),
  ownerRef: EntityRefSchema.optional(),
  ownerLabel: z.string().optional(),
  deadlineDay: z.number().int().optional(),
  opposingCooldowns: z.record(z.string(), z.number().int()),
  interventions: z.array(
    z.object({
      interventionId: z.string(),
      takenOnDay: z.number().int(),
      goalProgress: z.number(),
      readable: z.string(),
    }),
  ),
  history: z.array(
    z.object({
      day: z.number().int(),
      stageId: z.string(),
      note: z.string(),
    }),
  ),
  outcome: z.enum(['success', 'compromise', 'failure']).optional(),
  closedOnDay: z.number().int().optional(),
  permanentChanges: z.array(z.string()),
})

export const ArcRunTotalsSchema = z.object({
  runsOpened: z.number(),
  runsSucceeded: z.number(),
  runsCompromised: z.number(),
  runsFailed: z.number(),
  interventionsTaken: z.number(),
  opposingMovesMade: z.number(),
  timeoutsHit: z.number(),
  permanentChangesApplied: z.number(),
  settlementsAgreed: z.number(),
})
