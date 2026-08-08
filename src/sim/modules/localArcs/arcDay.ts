import type { SimContext } from '../../core/context'
import type { LocalEventWorldState, TavernState } from '../../state/TavernState'
import {
  isTerminalArcStage,
  type ArcInterventionDefinition,
  type LocalArcProgression,
  type LocalArcStage,
} from '../../content/events/localArcTypes'
import { localArcRegistry } from '../../content/events/localArcRegistry'

import {
  bumpArcRunTotal,
  getArcRun,
  getArcRuns,
  liveArcRuns,
  noteArcRun,
  openArcRun,
  writeArcRun,
  type ArcRun,
} from './arcRuns'
import {
  computeOutcome,
  computeStageTransition,
  enterStage,
  progressionFor,
  resolveArcOwner,
  runOpposingMoves,
  stageFor,
} from './arcProgress'
import { closeArcRun } from './arcOutcomes'
import { applyArcEffect } from './arcEffects'
import { localArcRegistry as arcDefinitions } from '../../content/events/localArcRegistry'
import { LOCAL_ARCS_MODULE_ID } from './types'

// Expansion Phase 9 §9.2 — the daily pass.
//
// This is the file that answers "why is this arc different today than it
// was yesterday", and the answer is never "because a day went by". It is
// because the owner made a move, because the player did something about it,
// or because live state crossed a line the definition names.
//
// It runs at `localEventUpdate`, alongside the existing tag refresh, which
// puts it after the faction, culture, NPC and rumour passes (so an arc can
// read what they did this morning) and before `forecastTraffic` (so an arc
// that closed today is felt in tonight's turnout).

const SOURCE = LOCAL_ARCS_MODULE_ID

/** The most an arc's loudness may move in a day. */
export const INTENSITY_STEP_PER_DAY = 5

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

/** The legacy stage an arc should be showing, from its §9.2 stage. */
function legacyStageFor(
  progression: LocalArcProgression,
  stageId: string,
): LocalArcStage {
  return stageFor(progression, stageId)?.legacyStage ?? 'active'
}

/**
 * Open a run for any arc record that has a progression and no run yet.
 *
 * Runs are created here rather than inside `createArcInstance` because the
 * arc record is created by the pure engine (which has no `ctx` and cannot
 * resolve an owner or read the world), and because an arc that predates
 * this phase — sitting in an old save mid-lifecycle — needs a run opened
 * for it on the first day it is played. Both cases land in the same place.
 */
export function ensureArcRuns(ctx: SimContext): void {
  const runs = getArcRuns(ctx.state)
  const today = ctx.state.calendar.totalDaysElapsed

  for (const arc of Object.values(ctx.state.world.localEvents)) {
    if (arc.stage === undefined) continue
    if (isTerminalArcStage(arc.stage)) continue
    if (runs[arc.id]) continue
    const progression = progressionFor(arc.definitionId)
    if (!progression) continue

    const entry = progression.stages[0]
    if (!entry) continue
    const owner = resolveArcOwner(ctx.state, progression.owner)

    // An arc resumed mid-life from an old save starts at whichever stage
    // matches the legacy one it was already showing, so a blight halfway
    // through does not restart. A brand-new arc is at the entry stage
    // anyway, so the same lookup serves both.
    const matching =
      progression.stages.find((stage) => stage.legacyStage === arc.stage) ?? entry

    const run: ArcRun = {
      arcId: arc.id,
      definitionId: arc.definitionId,
      stageId: matching.id,
      stageEnteredDay: today,
      startedOnDay: arc.startedDay,
      goalProgress: 0,
      opposition: 0,
      ...(owner ? { ownerRef: owner.ref, ownerLabel: owner.label } : {}),
      ...(matching.timeoutDays !== undefined
        ? { deadlineDay: today + matching.timeoutDays }
        : {}),
      opposingCooldowns: {},
      interventions: [],
      history: [
        {
          day: today,
          stageId: matching.id,
          note: owner
            ? `${arc.label} began. ${owner.label} are driving it.`
            : `${arc.label} began.`,
        },
      ],
      permanentChanges: [],
    }
    openArcRun(ctx, run)
    ctx.addLog(
      {
        message: owner
          ? `${arc.label} is under way — ${owner.label} are behind it.`
          : `${arc.label} is under way.`,
        level: 'info',
        data: { arcId: arc.id, definitionId: arc.definitionId },
      },
      'localArcs',
    )
  }
}

/** Keep the world record's legible summary in step with the run. */
function syncArcRecord(
  ctx: SimContext,
  run: ArcRun,
  arc: LocalEventWorldState,
  progression: LocalArcProgression,
  note: string,
): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const stage = legacyStageFor(progression, run.stageId)
  // Intensity is the arc's loudness, and the honest reading of it is how far
  // the owner is ahead: an arc the house is winning is quieter than one it
  // is losing, whatever stage it is at.
  //
  // MOVED TOWARD, not snapped to. Two reasons, and the second is the one
  // that bit: an arc's loudness is a thing the quarter notices changing
  // rather than a number that jumps, and a run opened for an arc that was
  // ALREADY under way — a save resumed mid-blight, or a fixture built at
  // full intensity — would otherwise have its intensity collapse to the
  // opening value on the first day, throwing away everything the arc had
  // already built up. A bounded step preserves both.
  const target = clamp100(20 + run.opposition * 0.7 - run.goalProgress * 0.3)
  const drift = Math.max(-INTENSITY_STEP_PER_DAY, Math.min(INTENSITY_STEP_PER_DAY, target - arc.intensity))
  const intensity = clamp100(arc.intensity + drift)
  const history = [
    ...(arc.arcHistory ?? []),
    { day: today, stage, note },
  ]
  ctx.modifyLocalEvent(
    run.arcId,
    {
      stage,
      intensity,
      lastUpdatedDay: today,
      ageDays: today - run.startedOnDay,
      arcHistory: history.slice(Math.max(0, history.length - 24)),
    },
    {
      source: `${SOURCE}.progress`,
      sourceType: 'local_event',
      target: run.arcId,
      targetType: 'local_event',
      amount: 0,
      readable: note,
      tags: ['local_arc', 'progress', run.definitionId],
      relatedSystems: ['local_arcs'],
    },
  )
}

/**
 * The day's arc pass.
 *
 * One live run at a time, in a stable order, so a reload cannot change who
 * moves first. Each run gets: the owner's push, then at most one stage
 * transition, then — if that transition landed on a terminal stage — the
 * outcome and whatever the world keeps.
 *
 * At most ONE transition per run per day on purpose. An arc that could
 * cascade through four stages in a morning would give the player no turn to
 * respond, which is the same fairness argument the actor contract's
 * commitment window makes.
 */
export function runArcDailyPass(ctx: SimContext): void {
  ensureArcRuns(ctx)

  for (const snapshot of liveArcRuns(ctx.state)) {
    const progression = progressionFor(snapshot.definitionId)
    if (!progression) continue

    // 1. The owner pushes.
    runOpposingMoves(ctx, snapshot)

    // Re-read: the push wrote to the slice.
    const afterPush = getArcRun(ctx.state, snapshot.arcId)
    if (!afterPush) continue

    // 2. At most one stage transition.
    const transition = computeStageTransition(ctx.state, afterPush)
    const arc = ctx.state.world.localEvents[afterPush.arcId]
    if (!transition) {
      if (arc) syncArcRecord(ctx, afterPush, arc, progression, 'Nothing moved today.')
      continue
    }

    const nextStage = stageFor(progression, transition.toStageId)
    if (!nextStage) continue

    if (transition.timedOut) bumpArcRunTotal(ctx, 'timeoutsHit')
    enterStage(
      ctx,
      afterPush.arcId,
      transition.toStageId,
      transition.timedOut
        ? `Time ran out: ${nextStage.readable}`
        : `${nextStage.readable}`,
    )

    const entered = getArcRun(ctx.state, afterPush.arcId)
    if (!entered) continue
    const arcAfter = ctx.state.world.localEvents[entered.arcId]
    if (arcAfter) {
      syncArcRecord(ctx, entered, arcAfter, progression, nextStage.readable)
      // The stage's own effects, applied once on entry. This is the shove
      // that comes with the situation escalating, as distinct from the
      // arc's ambient monthly weight.
      if (nextStage.effects && arcDefinitions.has(entered.definitionId)) {
        const definition = arcDefinitions.get(entered.definitionId)
        for (const effect of nextStage.effects) {
          applyArcEffect({ ctx, arc: arcAfter, definition, effect })
        }
      }
    }

    // 3. Terminal stage? Close it.
    if (nextStage.outcome !== undefined || isTerminalStage(progression, nextStage.id)) {
      const outcome = computeOutcome(entered, nextStage)
      const closure = closeArcRun(ctx, entered, outcome)
      const closedArc = ctx.state.world.localEvents[entered.arcId]
      if (closedArc) {
        ctx.modifyLocalEvent(
          entered.arcId,
          {
            stage: outcome === 'failure' ? 'failed' : 'resolved',
            lastUpdatedDay: ctx.state.calendar.totalDaysElapsed,
            intensity: clamp100(closedArc.intensity - 25),
          },
          {
            source: `${SOURCE}.close`,
            sourceType: 'local_event',
            target: entered.arcId,
            targetType: 'local_event',
            amount: 0,
            readable: closure?.readable ?? `${closedArc.label} ended.`,
            tags: ['local_arc', 'outcome', outcome],
            relatedSystems: ['local_arcs'],
          },
        )
      }
      if (closure) {
        ctx.addLog(
          {
            message: closure.readable,
            level: outcome === 'failure' ? 'warn' : 'info',
            data: { arcId: entered.arcId, outcome },
          },
          'localArcs',
        )
      }
    }
  }
}

function isTerminalStage(progression: LocalArcProgression, stageId: string): boolean {
  const stage = stageFor(progression, stageId)
  if (!stage) return false
  return stage.outcome !== undefined || (stage.next === undefined && !stage.branches?.length)
}

// ---------------------------------------------------------------------------
// Player interventions
// ---------------------------------------------------------------------------

export type InterventionAvailability = {
  arcId: string
  arcLabel: string
  intervention: ArcInterventionDefinition
  /** Why it cannot be taken right now, when it cannot. */
  blockedReason?: string
}

/** Everything the player could do about an arc today. */
export function availableInterventions(
  state: TavernState,
): InterventionAvailability[] {
  const out: InterventionAvailability[] = []
  const today = state.calendar.totalDaysElapsed
  for (const run of liveArcRuns(state)) {
    const progression = progressionFor(run.definitionId)
    if (!progression) continue
    const arc = state.world.localEvents[run.arcId]
    if (!arc) continue
    for (const intervention of progression.interventions) {
      const stages = intervention.availableInStages ?? []
      if (stages.length > 0 && !stages.includes(run.stageId)) continue

      const taken = run.interventions.filter(
        (entry) => entry.interventionId === intervention.id,
      )
      let blockedReason: string | undefined
      if (intervention.maxUses !== undefined && taken.length >= intervention.maxUses) {
        blockedReason = 'already done as often as it can be'
      } else if (intervention.cooldownDays !== undefined && taken.length > 0) {
        const last = taken[taken.length - 1]!
        if (today - last.takenOnDay < intervention.cooldownDays) {
          blockedReason = `not again until day ${last.takenOnDay + intervention.cooldownDays}`
        }
      }
      if (blockedReason === undefined && (intervention.coinCost ?? 0) > state.coin) {
        blockedReason = `needs ${intervention.coinCost} coin`
      }
      if (blockedReason === undefined && intervention.stockCost) {
        const held = state.stock[intervention.stockCost.id]?.quantity ?? 0
        if (held < intervention.stockCost.quantity) {
          blockedReason = `needs ${intervention.stockCost.quantity} ${intervention.stockCost.id}`
        }
      }

      out.push({
        arcId: run.arcId,
        arcLabel: arc.label,
        intervention,
        ...(blockedReason ? { blockedReason } : {}),
      })
    }
  }
  return out.sort(
    (a, b) =>
      a.arcId.localeCompare(b.arcId) ||
      a.intervention.id.localeCompare(b.intervention.id),
  )
}

export function findIntervention(
  state: TavernState,
  arcId: string,
  interventionId: string,
): InterventionAvailability | undefined {
  return availableInterventions(state).find(
    (entry) => entry.arcId === arcId && entry.intervention.id === interventionId,
  )
}

/**
 * Take an intervention.
 *
 * The coin and stock are spent by the owner action that calls this — the
 * ledger is the stock module's business — so what happens here is only what
 * belongs to the arc: the goal moves, the opposition moves, and the run
 * remembers it was done. `oppositionDelta` is signed on purpose: some moves
 * calm the owner down, and some are exactly the sort of thing that makes
 * them dig in.
 */
export function takeArcIntervention(
  ctx: SimContext,
  arcId: string,
  intervention: ArcInterventionDefinition,
): { goalProgress: number; opposition: number } | undefined {
  const run = getArcRun(ctx.state, arcId)
  if (!run || run.outcome !== undefined) return undefined
  const today = ctx.state.calendar.totalDaysElapsed

  writeArcRun(
    ctx,
    arcId,
    (current) => ({
      ...current,
      goalProgress: clamp100(current.goalProgress + intervention.goalProgress),
      opposition: clamp100(current.opposition + (intervention.oppositionDelta ?? 0)),
      interventions: [
        ...current.interventions,
        {
          interventionId: intervention.id,
          takenOnDay: today,
          goalProgress: intervention.goalProgress,
          readable: intervention.readable,
        },
      ],
    }),
    `intervention_${intervention.id}`,
  )
  noteArcRun(ctx, arcId, intervention.readable)
  bumpArcRunTotal(ctx, 'interventionsTaken')

  const after = getArcRun(ctx.state, arcId)
  return after
    ? { goalProgress: after.goalProgress, opposition: after.opposition }
    : undefined
}

/**
 * Settle an arc where it stands.
 *
 * The player's route to §9.2's `compromise` outcome without waiting for the
 * clock. It is only on the board while the contest is genuinely close —
 * settling from far behind would be a way to buy off any failure, and
 * settling from far ahead throws away a win the player has already earned.
 */
export const SETTLEMENT_MARGIN = 25

export function canSettleArc(state: TavernState, arcId: string): string | undefined {
  const run = getArcRun(state, arcId)
  if (!run) return 'there is no such arc'
  if (run.outcome !== undefined) return 'that is already over'
  const progression = progressionFor(run.definitionId)
  if (!progression) return 'there is nothing to settle'
  if (Math.abs(run.goalProgress - run.opposition) > SETTLEMENT_MARGIN) {
    return run.goalProgress > run.opposition
      ? 'the house is already winning this — there is nothing to settle for'
      : 'it has gone too far for anybody to settle'
  }
  return undefined
}

export function settleArc(ctx: SimContext, arcId: string): boolean {
  const run = getArcRun(ctx.state, arcId)
  if (!run || canSettleArc(ctx.state, arcId) !== undefined) return false
  const progression = progressionFor(run.definitionId)
  if (!progression) return false

  noteArcRun(ctx, arcId, 'Settled where it stood.')
  bumpArcRunTotal(ctx, 'settlementsAgreed')
  const closure = closeArcRun(ctx, run, 'compromise')
  const arc = ctx.state.world.localEvents[arcId]
  if (arc) {
    ctx.modifyLocalEvent(
      arcId,
      {
        stage: 'resolved',
        lastUpdatedDay: ctx.state.calendar.totalDaysElapsed,
        intensity: clamp100(arc.intensity - 25),
      },
      {
        source: `${SOURCE}.settled`,
        sourceType: 'local_event',
        target: arcId,
        targetType: 'local_event',
        amount: 0,
        readable: closure?.readable ?? `${arc.label} was settled.`,
        tags: ['local_arc', 'outcome', 'compromise'],
        relatedSystems: ['local_arcs'],
      },
    )
  }
  return true
}

export function arcLabel(state: TavernState, arcId: string): string {
  return state.world.localEvents[arcId]?.label ?? arcId
}

export function definitionLabel(definitionId: string): string {
  return localArcRegistry.has(definitionId)
    ? localArcRegistry.get(definitionId).label
    : definitionId
}
