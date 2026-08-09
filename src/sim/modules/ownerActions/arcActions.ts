import type { SimContext } from '../../core/context'
import { spendCoin } from '../stock/ledger'
import {
  SETTLEMENT_MARGIN,
  availableInterventions,
  canSettleArc,
  findIntervention,
  settleArc,
  takeArcIntervention,
} from '../localArcs/arcDay'
import { getArcRun, liveArcRuns } from '../localArcs/arcRuns'
import { progressionFor, stageFor, unmetConditions } from '../localArcs/arcProgress'
import { scheduleArcHook } from '../localArcs/arcEvents'

import { TIME_COST_STANDARD } from './stateHelpers'
import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionApplied,
  OwnerActionDefinition,
} from './types'

// Expansion Phase 9 §9.2 — the player's half of an arc.
//
// §9.2 lists "player interventions" between "explicit goals" and "opposing
// moves", and the order is the argument: an arc with a goal and an owner
// pushing against it is only a contest if the player has moves of their own.
// Before this phase they had none — an arc was a thing that happened near
// the tavern and then stopped happening.
//
// TWO ACTIONS, NOT TWELVE. The interventions themselves are declared per
// arc, because "scrub the cellar out" and "hear them both out" are not one
// verb in two costumes: they cost different things, they are available at
// different points, and they move the arc by different amounts. So the
// registry carries one action whose targets are `<arcId>:<interventionId>`
// — the same composite-target shape the area-upgrade actions use — and the
// hint on each target carries the cost and what it does.
//
//   intervene_in_arc   take one of the arc's own declared moves
//   settle_arc         end it where it stands, as a compromise
//
// `settle_arc` is deliberately narrow: it is only on the board while the
// contest is genuinely close. Settling from far behind would be a way to buy
// off any failure, and settling from far ahead throws away a win already
// earned.

const SOURCE = 'ownerActions'

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

function parseTarget(targetId: string): { arcId: string; interventionId: string } | undefined {
  const split = targetId.lastIndexOf(':')
  if (split <= 0) return undefined
  return {
    arcId: targetId.slice(0, split),
    interventionId: targetId.slice(split + 1),
  }
}

function interventionTargets(ctx: SimContext): ActionTarget[] {
  return availableInterventions(ctx.state)
    .filter((entry) => entry.blockedReason === undefined)
    .map((entry) => {
      const costs: string[] = []
      if (entry.intervention.coinCost) costs.push(`${entry.intervention.coinCost} coin`)
      const minutes = entry.intervention.minuteCost ?? TIME_COST_STANDARD
      costs.push(`${minutes} min`)
      if (entry.intervention.stockCost) {
        costs.push(
          `${entry.intervention.stockCost.quantity} ${entry.intervention.stockCost.id}`,
        )
      }
      const provokes =
        (entry.intervention.oppositionDelta ?? 0) > 0 ? ' — they will not like it' : ''
      return {
        id: `${entry.arcId}:${entry.intervention.id}`,
        label: `${entry.arcLabel}: ${entry.intervention.label}`,
        hint: `${costs.join(', ')}${provokes}`,
      }
    })
}

function settleableArcs(ctx: SimContext): ActionTarget[] {
  return liveArcRuns(ctx.state)
    .filter((run) => canSettleArc(ctx.state, run.arcId) === undefined)
    .map((run) => {
      const arc = ctx.state.world.localEvents[run.arcId]
      return {
        id: run.arcId,
        label: arc?.label ?? run.arcId,
        hint: `standing at ${run.goalProgress} against ${run.opposition} — close enough to settle`,
      }
    })
}

// ---------- intervene_in_arc ----------

const interveneInArc: OwnerActionDefinition = {
  id: 'intervene_in_arc',
  label: 'Do Something About It',
  category: 'social',
  tags: ['arc', 'local_event', 'intervention'],
  effectsPreview: 'Takes one of the moves this arc actually offers',
  pressureAffinity: ['arc_escalation'],
  targetType: 'composite',
  // The representative cost the picker shows. What the budget is actually
  // enforced against is `timeCostFor` below, because the interventions
  // declare anything from half an hour to half a day.
  timeCost: TIME_COST_STANDARD,
  timeCostFor: (state, input) => {
    if (!input.targetId) return TIME_COST_STANDARD
    const parsed = parseTarget(input.targetId)
    if (!parsed) return TIME_COST_STANDARD
    const entry = findIntervention(state, parsed.arcId, parsed.interventionId)
    return entry?.intervention.minuteCost ?? TIME_COST_STANDARD
  },
  getValidTargets: interventionTargets,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'intervene_in_arc requires targetId')
    }
    const parsed = parseTarget(input.targetId)
    if (!parsed) {
      return reject('bad_target', `'${input.targetId}' is not '<arcId>:<interventionId>'`)
    }
    const entry = findIntervention(ctx.state, parsed.arcId, parsed.interventionId)
    if (!entry) {
      return reject(
        'unknown_intervention',
        `Nothing called '${parsed.interventionId}' is on offer for that arc.`,
      )
    }
    if (entry.blockedReason) {
      return reject('unavailable', `${entry.intervention.label}: ${entry.blockedReason}.`)
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const parsed = parseTarget(input.targetId!)!
    const entry = findIntervention(ctx.state, parsed.arcId, parsed.interventionId)!
    const intervention = entry.intervention
    const effects: string[] = []

    if (intervention.coinCost) {
      spendCoin(ctx, intervention.coinCost, {
        category: 'other',
        source: `${SOURCE}.intervene_in_arc`,
        sourceType: 'owner_action',
        target: 'coin',
        targetType: 'coin',
        amount: -intervention.coinCost,
        readable: intervention.readable,
        tags: ['arc', 'intervention'],
        relatedSystems: ['local_arcs'],
      })
      effects.push(`Spent ${intervention.coinCost} coin.`)
    }
    if (intervention.stockCost) {
      const held = ctx.state.stock[intervention.stockCost.id]
      if (held) {
        ctx.modifyStock(
          intervention.stockCost.id,
          {
            quantity: Math.max(0, held.quantity - intervention.stockCost.quantity),
          },
          {
            source: `${SOURCE}.intervene_in_arc`,
            sourceType: 'owner_action',
            target: intervention.stockCost.id,
            targetType: 'stock',
            amount: -intervention.stockCost.quantity,
            readable: intervention.readable,
            tags: ['arc', 'intervention'],
            relatedSystems: ['local_arcs', 'stock'],
          },
        )
        effects.push(
          `Used ${intervention.stockCost.quantity} ${intervention.stockCost.id}.`,
        )
      }
    }

    const moved = takeArcIntervention(ctx, parsed.arcId, intervention)
    effects.unshift(intervention.readable)
    if (moved) {
      effects.push(
        `${entry.arcLabel}: progress ${moved.goalProgress}, opposition ${moved.opposition}.`,
      )
      // What is still in the way, so the player can see what to do next.
      const run = getArcRun(ctx.state, parsed.arcId)
      const progression = progressionFor(run?.definitionId ?? '')
      const stage = run && progression ? stageFor(progression, run.stageId) : undefined
      if (run && stage && stage.advanceWhen.length > 0) {
        const unmet = unmetConditions(ctx.state, run, stage.advanceWhen)
        if (unmet.length > 0) effects.push(`Still wants: ${unmet.join(', ')}.`)
      }
    }

    // A risky move stakes what it warned about. This is the producer side of
    // the four hook families the arc domain now owns: the promise is made
    // here, by the player choosing the risky option, and kept by the
    // resolver — which can still find nothing to do, and say so.
    if (intervention.stakesHook) {
      const staked = scheduleArcHook(ctx, {
        arcId: parsed.arcId,
        hook: intervention.stakesHook,
        source: `${SOURCE}.intervene_in_arc`,
        readable: `${entry.arcLabel}: ${intervention.readable}`,
      })
      if (staked) effects.push('That may come back on the house.')
    }

    return {
      actionId: 'intervene_in_arc',
      label: 'Do Something About It',
      targetId: input.targetId!,
      targetLabel: `${entry.arcLabel}: ${intervention.label}`,
      timeCost: intervention.minuteCost ?? TIME_COST_STANDARD,
      effects,
      data: {
        arcId: parsed.arcId,
        interventionId: intervention.id,
        goalProgress: moved?.goalProgress ?? 0,
        opposition: moved?.opposition ?? 0,
        stakedHook: intervention.stakesHook ?? null,
      },
    }
  },
}

// ---------- settle_arc ----------

const settleArcAction: OwnerActionDefinition = {
  id: 'settle_arc',
  label: 'Settle It Where It Stands',
  category: 'social',
  tags: ['arc', 'local_event', 'compromise'],
  effectsPreview: 'Ends a close-run arc as a compromise rather than gambling on it',
  pressureAffinity: ['arc_escalation'],
  targetType: 'composite',
  timeCost: TIME_COST_STANDARD,
  getValidTargets: settleableArcs,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('missing_target', 'settle_arc requires targetId')
    const blocked = canSettleArc(ctx.state, input.targetId)
    if (blocked) return reject('cannot_settle', blocked)
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const arcId = input.targetId!
    const run = getArcRun(ctx.state, arcId)!
    const label = ctx.state.world.localEvents[arcId]?.label ?? arcId
    const before = { goalProgress: run.goalProgress, opposition: run.opposition }
    const settled = settleArc(ctx, arcId)
    return {
      actionId: 'settle_arc',
      label: 'Settle It Where It Stands',
      targetId: arcId,
      targetLabel: label,
      timeCost: TIME_COST_STANDARD,
      effects: settled
        ? [
            `${label} was settled where it stood (${before.goalProgress} against ${before.opposition}).`,
            'Neither a win nor a loss, and nobody is owed anything.',
          ]
        : [`${label} could not be settled.`],
      data: {
        arcId,
        settled,
        ...before,
        marginAllowed: SETTLEMENT_MARGIN,
      },
    }
  },
}

export const ARC_ACTIONS: ReadonlyArray<OwnerActionDefinition> = [
  interveneInArc,
  settleArcAction,
]
