import type { SimContext } from '../../core/context'
import { spendCoin } from '../stock/ledger'
import { expeditionEventRegistry } from '../../content/expeditions/expeditionEvents'
import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionApplied,
  OwnerActionDefinition,
} from '../ownerActions/types'
import { TIME_COST_QUICK, TIME_COST_SHORT } from '../ownerActions/stateHelpers'

import {
  affordableOptions,
  recallExpedition,
  resolveDecision,
  routeFor,
} from './journey'
import {
  bumpExpeditionTotal,
  getExpeditionRun,
  liveExpeditionRuns,
  writeExpeditionRun,
} from './runState'

// Expansion Phase 9 §9.3 — what the house can do while they are out there.
//
// Phase 70 had exactly one expedition decision, and it was made before
// anybody left. Once the party was on the road the player was a spectator
// waiting for a number. §9.3 lists recall, retreat, rescue and risk/reward
// decisions among the things an expedition must support, and all four need
// a move on this side of the road:
//
//   answer_expedition_dispatch  take the risk/reward decision they are
//                               waiting on — before they take it themselves
//   recall_expedition           order them home with whatever they have
//   send_relief_to_expedition   the rescue: coin and supplies to a party in
//                               trouble, which halves the chance of losing
//                               them outright
//
// All three are gated on WORD HAVING ARRIVED. A player cannot answer a
// question the house has not been asked, or send relief to a party whose
// trouble is still four days up the road. That is what makes the route's
// `wordDelayDays` a real cost rather than flavour on a report line.

const SOURCE = 'ownerActions'

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

function parseTarget(targetId: string): { expeditionId: string; optionId: string } | undefined {
  const split = targetId.lastIndexOf(':')
  if (split <= 0) return undefined
  return {
    expeditionId: targetId.slice(0, split),
    optionId: targetId.slice(split + 1),
  }
}

/** Questions the house has actually been asked, and can still answer. */
function openQuestions(ctx: SimContext): ActionTarget[] {
  const today = ctx.state.calendar.totalDaysElapsed
  const out: ActionTarget[] = []
  for (const run of liveExpeditionRuns(ctx.state)) {
    const pending = run.pendingDecision
    if (!pending) continue
    const route = routeFor(run.routeId)
    if (!route) continue
    // The question only exists for the house once the dispatch carrying it
    // has arrived — and an answer that cannot get back before the party
    // acts is not worth queueing.
    const asked = pending.askedOnDay + route.wordDelayDays
    if (today < asked) continue
    if (today + route.wordDelayDays > pending.deadlineDay) continue
    if (!expeditionEventRegistry.has(pending.eventId)) continue
    const definition = expeditionEventRegistry.get(pending.eventId)
    for (const option of affordableOptions(definition, run)) {
      if (!pending.optionIds.includes(option.id)) continue
      out.push({
        id: `${run.expeditionId}:${option.id}`,
        label: `${route.label}: ${option.label}`,
        hint: `${pending.prompt} They act on day ${pending.deadlineDay}.`,
      })
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

function recallable(ctx: SimContext): ActionTarget[] {
  return liveExpeditionRuns(ctx.state)
    .filter((run) => run.recalledOnDay === undefined && run.phase !== 'home')
    .map((run) => {
      const route = routeFor(run.routeId)
      return {
        id: run.expeditionId,
        label: route?.label ?? run.routeId,
        hint:
          run.phase === 'returning'
            ? 'already on their way back'
            : `${run.phase === 'at_site' ? 'at the site' : 'still walking out'} — a recall costs the trip, and takes ${route?.wordDelayDays ?? 0} day(s) to reach them`,
      }
    })
}

/** Parties the house knows to be in trouble. */
function inTrouble(ctx: SimContext): ActionTarget[] {
  const today = ctx.state.calendar.totalDaysElapsed
  return liveExpeditionRuns(ctx.state)
    .filter((run) => {
      if (run.reliefSentOnDay !== undefined) return false
      const route = routeFor(run.routeId)
      if (!route) return false
      // Only what word has actually brought home.
      const known = run.dispatches.filter(
        (dispatch) => dispatch.arrivesOnDay <= today,
      )
      // ONLY WHAT WORD HAS BROUGHT. The `|| run.injuredRunnerIds.length > 0`
      // fallback that used to sit here read the party's live injury list,
      // which is updated the moment somebody is hurt — so on every remote
      // route the house could send relief days before it could possibly have
      // heard, and the delayed-information gate this action is built around
      // did nothing on exactly the trips it exists for. Injuries now send a
      // `trouble` dispatch of their own, so the news arrives on the route's
      // own schedule like everything else.
      return known.some(
        (dispatch) => dispatch.kind === 'trouble' || dispatch.kind === 'terminal',
      )
    })
    .map((run) => {
      const route = routeFor(run.routeId)
      return {
        id: run.expeditionId,
        label: route?.label ?? run.routeId,
        hint:
          run.injuredRunnerIds.length > 0
            ? `${run.injuredRunnerIds.length} hurt — relief halves the chance of losing them`
            : 'word came back bad — relief halves the chance of losing them',
      }
    })
}

export const RELIEF_COST = 55

// ---------- answer_expedition_dispatch ----------

const answerDispatch: OwnerActionDefinition = {
  id: 'answer_expedition_dispatch',
  label: 'Send Word Back',
  category: 'immediate',
  tags: ['expedition', 'decision'],
  effectsPreview: 'Answers the question a party on the road is waiting on',
  targetType: 'composite',
  timeCost: TIME_COST_QUICK,
  getValidTargets: openQuestions,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'answer_expedition_dispatch requires targetId')
    }
    const parsed = parseTarget(input.targetId)
    if (!parsed) {
      return reject('bad_target', `'${input.targetId}' is not '<expeditionId>:<optionId>'`)
    }
    const available = openQuestions(ctx).some((entry) => entry.id === input.targetId)
    if (!available) {
      const run = getExpeditionRun(ctx.state, parsed.expeditionId)
      if (!run?.pendingDecision) {
        return reject('nothing_asked', 'Nobody is waiting on an answer.')
      }
      return reject(
        'cannot_reach_them',
        'Word could not get there before they act on it themselves.',
      )
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const parsed = parseTarget(input.targetId!)!
    const expedition = ctx.state.expeditions.active.find(
      (entry) => entry.id === parsed.expeditionId,
    )!
    const run = getExpeditionRun(ctx.state, parsed.expeditionId)!
    const route = routeFor(run.routeId)
    const prompt = run.pendingDecision?.prompt ?? ''
    const answered = resolveDecision(ctx, expedition, parsed.optionId, false)
    const after = getExpeditionRun(ctx.state, parsed.expeditionId)
    return {
      actionId: 'answer_expedition_dispatch',
      label: 'Send Word Back',
      targetId: input.targetId!,
      targetLabel: `${route?.label ?? run.routeId}: ${parsed.optionId.replace(/_/g, ' ')}`,
      timeCost: TIME_COST_QUICK,
      effects: answered
        ? [
            prompt,
            `Word went back: ${parsed.optionId.replace(/_/g, ' ')}.`,
            ...(after && after.injuredRunnerIds.length > run.injuredRunnerIds.length
              ? ['Somebody was hurt doing it.']
              : []),
          ]
        : ['The answer did not reach them.'],
      data: {
        expeditionId: parsed.expeditionId,
        optionId: parsed.optionId,
        answered,
      },
    }
  },
}

// ---------- recall_expedition ----------

const recall: OwnerActionDefinition = {
  id: 'recall_expedition',
  label: 'Call Them Home',
  category: 'immediate',
  tags: ['expedition', 'recall'],
  effectsPreview: 'Orders a party home with whatever they have',
  targetType: 'composite',
  timeCost: TIME_COST_QUICK,
  getValidTargets: recallable,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('missing_target', 'recall_expedition requires targetId')
    const run = getExpeditionRun(ctx.state, input.targetId)
    if (!run) return reject('unknown_expedition', 'There is no such expedition.')
    if (run.terminal !== undefined) return reject('already_over', 'That trip is already over.')
    if (run.recalledOnDay !== undefined) {
      return reject('already_recalled', 'They have already been called home.')
    }
    if (run.phase === 'home') return reject('already_home', 'They are already back.')
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const run = getExpeditionRun(ctx.state, input.targetId!)!
    const route = routeFor(run.routeId)
    const before = run.phase
    const recalled = recallExpedition(ctx, input.targetId!)
    bumpExpeditionTotal(ctx, 'recalled', 0)
    return {
      actionId: 'recall_expedition',
      label: 'Call Them Home',
      targetId: input.targetId!,
      targetLabel: route?.label ?? run.routeId,
      timeCost: TIME_COST_QUICK,
      effects: recalled
        ? [
            `Word went out to bring them home from ${route?.label ?? 'the road'}.`,
            // The cost of a recall is the walk back, which is why it is a
            // decision rather than an undo.
            `They were ${before === 'at_site' ? 'at the site' : 'still on the way out'} — the walk back will take days.`,
            ...(route && route.wordDelayDays > 0
              ? [`The order takes ${route.wordDelayDays} day(s) to reach them.`]
              : []),
          ]
        : ['They could not be reached.'],
      data: { expeditionId: input.targetId!, recalled, phaseWhenRecalled: before },
    }
  },
}

// ---------- send_relief_to_expedition ----------

const sendRelief: OwnerActionDefinition = {
  id: 'send_relief_to_expedition',
  label: 'Send Relief',
  category: 'immediate',
  tags: ['expedition', 'rescue'],
  effectsPreview: 'Sends supplies and hands to a party in trouble',
  targetType: 'composite',
  timeCost: TIME_COST_SHORT,
  getValidTargets: inTrouble,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'send_relief_to_expedition requires targetId')
    }
    const run = getExpeditionRun(ctx.state, input.targetId)
    if (!run) return reject('unknown_expedition', 'There is no such expedition.')
    if (run.terminal !== undefined) return reject('already_over', 'That trip is already over.')
    if (run.reliefSentOnDay !== undefined) {
      return reject('relief_already_sent', 'Relief has already gone out to them.')
    }
    const known = inTrouble(ctx).some((entry) => entry.id === input.targetId)
    if (!known) {
      return reject(
        'no_word_of_trouble',
        'No word has come back that anything is wrong.',
      )
    }
    if (ctx.state.coin < RELIEF_COST) {
      return reject(
        'insufficient_coin',
        `${RELIEF_COST} coin needed to put a relief party together; ${ctx.state.coin} in the till.`,
      )
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const run = getExpeditionRun(ctx.state, input.targetId!)!
    const route = routeFor(run.routeId)
    const today = ctx.state.calendar.totalDaysElapsed
    spendCoin(ctx, RELIEF_COST, {
      category: 'other',
      source: `${SOURCE}.send_relief`,
      sourceType: 'owner_action',
      target: 'coin',
      targetType: 'coin',
      amount: -RELIEF_COST,
      readable: `Sent relief after the party on ${route?.label ?? 'the road'}.`,
      tags: ['expedition', 'rescue'],
      relatedSystems: ['expeditions'],
    })
    writeExpeditionRun(
      ctx,
      input.targetId!,
      (current) => ({
        ...current,
        reliefSentOnDay: today,
        supplies: current.supplies + 6,
        medicine: current.medicine + 1,
        morale: Math.min(100, current.morale + 15),
        hazard: Math.max(0, current.hazard - 12),
      }),
      'relief',
    )
    bumpExpeditionTotal(ctx, 'reliefsSent')
    return {
      actionId: 'send_relief_to_expedition',
      label: 'Send Relief',
      targetId: input.targetId!,
      targetLabel: route?.label ?? run.routeId,
      timeCost: TIME_COST_SHORT,
      effects: [
        `Relief went out to ${route?.label ?? 'the road'} — provisions, medicine and hands.`,
        'It halves the chance of losing them outright.',
        `Spent ${RELIEF_COST} coin.`,
      ],
      data: { expeditionId: input.targetId!, coinSpent: RELIEF_COST },
    }
  },
}

export const EXPEDITION_ROAD_ACTIONS: ReadonlyArray<OwnerActionDefinition> = [
  answerDispatch,
  recall,
  sendRelief,
]
