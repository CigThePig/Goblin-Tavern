import { z } from 'zod'

import type { SimContext } from '../../core/context'
import { registerScheduledEvent } from '../../contracts/scheduledEvents/registry'
import {
  getLiveScheduledEvents,
  scheduleEvent,
  type ScheduledEventDefinition,
  type ScheduledEventResolution,
} from '../../contracts/scheduledEvents/index'
import { actorCanPerform, performActorAction } from '../../contracts/actors/index'

import { competitionSummary } from './appeal'
import {
  PRIMARY_RIVAL_ID,
  RIVAL_MODULE_ID,
  bumpRivalTotal,
  getRivalModuleState,
  liveSetbacks,
  recordRivalMove,
  rivalRef,
  underTruce,
  writeRivalSlice,
} from './rivalState'
import {
  HOSTILE_RIVAL_ACTIONS,
  buildRivalPerception,
  deriveRivalGoals,
  persistRivalActor,
  rivalActionById,
} from './rivalActors'

// Expansion Phase 9 §9.1 + Phase 1 §1.1 — four hook families stop being
// promises and start being rival moves.
//
// WHAT WAS BROKEN. Four `HOOK-*` rows in the implementation ledger belong
// to the rival layer, and all four were the same `OBL-02` failure: a
// response profile told the player, in so many words, that the rival would
// hit back for the poaching, that it would grow if left alone, that the
// counter-rumour they put about might be exposed, or that the pact they
// struck would reopen. On the promised day the responses module drained the
// hook and wrote a zero-weight cause, because no domain owned the string.
//
// This phase can keep all four, because the rival is finally a record with
// a position, a purse, a courting book and an action set. So none of these
// resolvers invents a consequence — each hands the decision back to the
// rival and lets it take the move its own goals and scoring support, or
// says plainly why nothing happened.
//
// EVERY ONE CAN COME TO NOTHING, AND SAY SO. That is the whole difference
// between an explained no-op and a drained promise: a house that has won
// its crowd back before the retaliation lands, or closed the appeal gap
// before the dominance review fires, gets a recorded reason rather than a
// consequence it no longer deserves.

export const RIVAL_RETALIATION_EVENT = 'rival_retaliation'
export const RIVAL_DOMINANCE_REVIEW_EVENT = 'rival_dominance_review'
export const RIVAL_RUMOUR_EXPOSED_EVENT = 'rival_rumour_exposed'
export const RIVAL_PACT_REVIEW_EVENT = 'rival_pact_review'
export const RIVAL_PRICE_WAR_EVENT = 'rival_price_war'
/** How far a matched cut takes their price level down. */
const PRICE_WAR_CUT = 12
export const RIVAL_QUALITY_RACE_EVENT = 'rival_quality_race'

const RivalPayloadSchema = z.object({ rivalId: z.string() })
const RetaliationPayloadSchema = z.object({
  rivalId: z.string(),
  provocation: z.enum(['poached', 'undercut', 'rumour', 'other']),
})

function noOp(reason: string, readable: string): ScheduledEventResolution {
  return { status: 'no_op', reason, readable }
}

function rivalOrNothing(ctx: SimContext, rivalId: string) {
  return getRivalModuleState(ctx.state).rivals[rivalId]
}

// ---------------------------------------------------------------------------
// rival_retaliation — they answer for it
// ---------------------------------------------------------------------------

/**
 * Pick the hostile move this rival can actually make right now.
 *
 * WHICH move is not fixed by the provocation. It comes from the rival's own
 * action list, scored against what it currently perceives, in the declared
 * hostility order — so a rival with an empty purse answers with talk rather
 * than a campaign it cannot pay for, and one with nothing to talk about
 * moves on price instead.
 */
function chooseHostileMove(
  ctx: SimContext,
  rivalId: string,
): { actionId: string; targetKind: string; targetId: string } | undefined {
  const rival = rivalOrNothing(ctx, rivalId)
  if (!rival) return undefined
  const perception = buildRivalPerception(ctx.state, rival)
  const today = ctx.state.calendar.totalDaysElapsed
  const goal = {
    id: 'exploit_weakness',
    weight: 1,
    readable: 'Answer for it.',
  }
  for (const actionId of HOSTILE_RIVAL_ACTIONS) {
    const action = rivalActionById(actionId)
    if (!action) continue
    // Budget, cooldown and commitment, which `decideActorAction` would have
    // enforced and `performActorAction` does not. Skipping the check let a
    // retaliation act mid-commitment, or on a move still cooling down, and
    // spend a budget it did not have.
    if (!actorCanPerform(rival.actor, action, today).ok) continue
    const targets = action.eligibleTargets(perception, ctx.state)
    let best: { target: (typeof targets)[number]; score: number } | undefined
    for (const target of targets) {
      const score = action.score({ target, goal, perception, state: ctx.state })
      if (!(score > 0)) continue
      if (best && score <= best.score) continue
      best = { target, score }
    }
    if (!best) continue
    return {
      actionId,
      targetKind: best.target.kind,
      targetId: best.target.id,
    }
  }
  return undefined
}

const retaliationEvent: ScheduledEventDefinition = {
  type: RIVAL_RETALIATION_EVENT,
  kind: 'mechanical',
  ownerModuleId: RIVAL_MODULE_ID,
  label: 'The other house is deciding what to do about it',
  payloadSchema: RetaliationPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 6,
  warningWindowDays: 4,
  expiryDays: 5,
  missingTarget: 'cancel',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = RetaliationPayloadSchema.safeParse(payload)
    const rivalId = parsed.success ? parsed.data.rivalId : 'unknown'
    const provocation = parsed.success ? parsed.data.provocation : 'other'
    return `${type}:${rivalId}:${provocation}:${scheduledForDay}`
  },
  futureHookPrefixes: ['rival_retaliation_'],
  fromFutureHook: ({ state }) => {
    if (!state) return undefined
    // Every `rival_retaliation_<arcKey>` names the same house — there is one
    // competitor, and the arc key is which quarrel it came out of.
    const rival = getRivalModuleState(state).rivals[PRIMARY_RIVAL_ID]
    if (!rival) return undefined
    return {
      payload: { rivalId: rival.id, provocation: 'poached' as const },
      target: rivalRef(rival.id),
    }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = RetaliationPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload was not a rival provocation', record.origin.readable)
    }
    const rival = rivalOrNothing(ctx, parsed.data.rivalId)
    if (!rival) return noOp('there is no such house any more', record.origin.readable)
    const today = ctx.state.calendar.totalDaysElapsed

    // A pact struck in the meantime is exactly what the counterplay window
    // is for.
    if (underTruce(rival, today)) {
      return noOp(
        `${rival.name} let it go — there is an arrangement`,
        record.origin.readable,
      )
    }
    // A house digging out of its own hole has other things to worry about.
    if (liveSetbacks(rival).reduce((sum, s) => sum + s.severity, 0) >= 60) {
      return noOp(
        `${rival.name} have troubles enough of their own`,
        record.origin.readable,
      )
    }

    const chosen = chooseHostileMove(ctx, rival.id)
    if (!chosen) {
      return noOp(
        `${rival.name} could find no way to make anything of it`,
        record.origin.readable,
      )
    }
    const action = rivalActionById(chosen.actionId)!
    // Through `performActorAction`, not `action.perform` — hitting back is
    // still one of their moves. It spends the budget, sets the action's
    // cooldown and takes the commitment window, so an answer costs them the
    // tempo it would have cost to plan it, and they cannot answer twice with
    // the same move on consecutive days.
    const performed = performActorAction(ctx, {
      actor: { ...rival.actor, goals: deriveRivalGoals(ctx.state, rival) },
      action,
      target: { kind: chosen.targetKind, id: chosen.targetId } as never,
      goalId: 'exploit_weakness',
    })
    const outcome = performed.outcome
    persistRivalActor(ctx, rival.id, performed.actor)
    recordRivalMove(ctx, {
      onDay: today,
      rivalId: rival.id,
      actionId: action.id,
      goalId: 'exploit_weakness',
      targetId: chosen.targetId,
      result: outcome.result,
      readable: outcome.readable,
    })
    if (outcome.result === 'failed') {
      return noOp(`${outcome.readable}`, record.origin.readable)
    }
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'system',
          targetId: rival.id,
          field: chosen.actionId,
          readable: outcome.readable,
        },
      ],
      readable: outcome.readable,
      cause: {
        source: `${RIVAL_MODULE_ID}.retaliation`,
        sourceType: 'system',
        target: rival.id,
        targetType: 'global',
        amount: 0,
        readable: outcome.readable,
        tags: ['rival', 'retaliation'],
        relatedActors: [rivalRef(rival.id)],
        relatedSystems: ['rival'],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// rival_dominance_review — what being ignored buys them
// ---------------------------------------------------------------------------

const dominanceEvent: ScheduledEventDefinition = {
  type: RIVAL_DOMINANCE_REVIEW_EVENT,
  kind: 'mechanical',
  ownerModuleId: RIVAL_MODULE_ID,
  label: 'The other house has been left to it',
  payloadSchema: RivalPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 10,
  warningWindowDays: 5,
  expiryDays: 5,
  missingTarget: 'cancel',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = RivalPayloadSchema.safeParse(payload)
    return `${type}:${parsed.success ? parsed.data.rivalId : 'unknown'}:${scheduledForDay}`
  },
  futureHookPrefixes: ['rival_dominance_'],
  fromFutureHook: ({ state }) => {
    if (!state) return undefined
    const rival = getRivalModuleState(state).rivals[PRIMARY_RIVAL_ID]
    if (!rival) return undefined
    return { payload: { rivalId: rival.id }, target: rivalRef(rival.id) }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = RivalPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload named no house', record.origin.readable)
    }
    const rival = rivalOrNothing(ctx, parsed.data.rivalId)
    if (!rival) return noOp('there is no such house any more', record.origin.readable)
    const summary = competitionSummary(ctx.state)
    if (!summary) return noOp('there is nobody to compare them with', record.origin.readable)

    // THE COUNTERPLAY. Being ignored only pays if they were actually left
    // ahead. A house that has closed the gap in the meantime gets a recorded
    // reason rather than a punishment for a state it has already fixed.
    if (summary.meanAdvantage <= 0) {
      return noOp(
        `${rival.name} were left to it and got nowhere — this house is still ahead`,
        record.origin.readable,
      )
    }

    const gain = Math.min(14, 6 + Math.round(summary.meanAdvantage * 40))
    writeRivalSlice(
      ctx,
      (current) => {
        const held = current.rivals[rival.id]
        if (!held) return current
        return {
          ...current,
          rivals: {
            ...current.rivals,
            [rival.id]: {
              ...held,
              capability: {
                ...held.capability,
                reach: Math.min(100, held.capability.reach + gain),
                quality: Math.min(100, held.capability.quality + Math.round(gain / 2)),
              },
              purse: held.purse + gain * 3,
            },
          },
        }
      },
      'dominance',
    )
    const readable = `${rival.name} spent an unopposed fortnight getting better at it (reach +${gain}).`
    ctx.addLog({ message: readable, level: 'info', data: { rivalId: rival.id } }, 'rival')
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'system',
          targetId: rival.id,
          field: 'capability.reach',
          readable,
        },
      ],
      readable,
      cause: {
        source: `${RIVAL_MODULE_ID}.dominance`,
        sourceType: 'system',
        target: rival.id,
        targetType: 'global',
        amount: gain,
        readable,
        tags: ['rival', 'dominance'],
        relatedActors: [rivalRef(rival.id)],
        relatedSystems: ['rival'],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// rival_rumour_exposed — the counter-rumour comes home
// ---------------------------------------------------------------------------

const rumourExposedEvent: ScheduledEventDefinition = {
  type: RIVAL_RUMOUR_EXPOSED_EVENT,
  kind: 'mechanical',
  ownerModuleId: RIVAL_MODULE_ID,
  label: 'The word this house put about is coming home',
  payloadSchema: RivalPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 8,
  warningWindowDays: 4,
  expiryDays: 5,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = RivalPayloadSchema.safeParse(payload)
    return `${type}:${parsed.success ? parsed.data.rivalId : 'unknown'}:${scheduledForDay}`
  },
  futureHookPrefixes: ['rival_rumour_exposed_'],
  fromFutureHook: ({ state }) => {
    if (!state) return undefined
    const rival = getRivalModuleState(state).rivals[PRIMARY_RIVAL_ID]
    if (!rival) return undefined
    return { payload: { rivalId: rival.id }, target: rivalRef(rival.id) }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = RivalPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload named no house', record.origin.readable)
    }
    const rival = rivalOrNothing(ctx, parsed.data.rivalId)
    if (!rival) return noOp('there is no such house any more', record.origin.readable)

    // DID THIS HOUSE ACTUALLY PUT ANY WORD ABOUT?
    //
    // The response that promises this — `spread_counter_rumour` — leaves a
    // MEMORY (`rival_counter_rumour_<rivalId>`) and some pressure. It does
    // not create a `SocialRumourState`, so there is no rumour record of the
    // house's own to find. An earlier draft searched for one anyway, taking
    // any sufficiently strong untrue rumour touching the rival that the
    // rival had not started itself — which meant it either no-opped because
    // the house's word was never in the store, or corrected and blamed the
    // house for a third party's story it had nothing to do with.
    //
    // The memory is the evidence, and it is the evidence the profile
    // actually writes. No memory, no word put about, nothing to be caught
    // at — and the no-op says exactly that.
    const spreadIt = ctx.state.memories.some(
      (memory) =>
        memory.id === `rival_counter_rumour_${rival.id}` ||
        memory.id.startsWith(`rival_counter_rumour_${rival.id}`),
    )
    if (!spreadIt) {
      return noOp(
        'this house never put any word about them',
        record.origin.readable,
      )
    }

    const today = ctx.state.calendar.totalDaysElapsed
    // If a matching story IS in the store — the house put one about by some
    // other route since — it is corrected too. Optional, because being
    // caught at it does not depend on a rumour record existing.
    const theirs = Object.values(ctx.state.world.socialRumours)
      .filter(
        (rumour) =>
          rumour.correctedOnDay === undefined &&
          rumour.strength > 8 &&
          rumour.accuracy !== 'true' &&
          rumour.originRef?.id !== rival.id &&
          (rumour.subject?.id === rival.id ||
            rumour.targetEntityId === rival.id ||
            (rumour.involvedRefs ?? []).some((ref) => ref.id === rival.id)),
      )
      .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0]
    if (theirs) {
      ctx.modifySocialRumour(
        theirs.id,
        {
          correctedOnDay: today,
          credibility: 0,
          strength: Math.max(1, Math.round(theirs.strength / 4)),
          accuracy: 'false',
        },
        {
          source: `${RIVAL_MODULE_ID}.rumour_exposed`,
          sourceType: 'system',
          target: theirs.id,
          targetType: 'rumour',
          amount: -theirs.strength,
          direction: 'decrease',
          readable: `The word about ${rival.name} was traced back to this house.`,
          tags: ['rival', 'rumour', 'exposed'],
          relatedActors: [rivalRef(rival.id)],
          relatedSystems: ['rumours', 'rival'],
        },
      )
    }
    // Being caught at it is a grievance they carry, not a meter: it becomes
    // a reason for the next hostile move rather than a number.
    const scheduled = scheduleRivalRetaliation(ctx, {
      provocation: 'rumour',
      source: `${RIVAL_MODULE_ID}.rumour_exposed`,
      readable: `${rival.name} know who started it.`,
      offsetDays: 4,
    })
    const readable = `The word this house put about ${rival.name} was traced back here.`
    if (!scheduled && !theirs) {
      // Nothing was corrected and they are not answering it — there is no
      // authoritative change to claim, so say so rather than report one.
      return noOp(
        `${rival.name} knew who started it but let it lie`,
        record.origin.readable,
      )
    }
    return {
      status: 'resolved',
      mutations: [
        ...(theirs
          ? [
              {
                targetKind: 'rumour',
                targetId: theirs.id,
                field: 'accuracy',
                readable,
              },
            ]
          : []),
        ...(scheduled
          ? [
              {
                targetKind: 'system',
                targetId: rival.id,
                field: 'retaliation',
                readable: `${rival.name} know who started it.`,
              },
            ]
          : []),
      ],
      readable: scheduled ? `${readable} They are deciding what to do about it.` : readable,
      cause: {
        source: `${RIVAL_MODULE_ID}.rumour_exposed`,
        sourceType: 'system',
        target: theirs?.id ?? rival.id,
        targetType: theirs ? 'rumour' : 'global',
        amount: theirs ? -theirs.strength : 0,
        direction: theirs ? 'decrease' : 'neutral',
        readable,
        tags: ['rival', 'rumour', 'exposed'],
        relatedActors: [
          rivalRef(rival.id),
          ...(theirs ? [{ kind: 'rumour' as const, id: theirs.id }] : []),
        ],
        relatedSystems: ['rumours', 'rival'],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// rival_pact_review — the arrangement comes up again
// ---------------------------------------------------------------------------

const pactReviewEvent: ScheduledEventDefinition = {
  type: RIVAL_PACT_REVIEW_EVENT,
  kind: 'mechanical',
  ownerModuleId: RIVAL_MODULE_ID,
  label: 'The arrangement with the other house is up',
  payloadSchema: RivalPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 21,
  warningWindowDays: 5,
  expiryDays: 5,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = RivalPayloadSchema.safeParse(payload)
    return `${type}:${parsed.success ? parsed.data.rivalId : 'unknown'}:${scheduledForDay}`
  },
  futureHookPrefixes: ['rival_settlement_pact_'],
  fromFutureHook: ({ state }) => {
    if (!state) return undefined
    const rival = getRivalModuleState(state).rivals[PRIMARY_RIVAL_ID]
    if (!rival) return undefined
    return { payload: { rivalId: rival.id }, target: rivalRef(rival.id) }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = RivalPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload named no house', record.origin.readable)
    }
    const rival = rivalOrNothing(ctx, parsed.data.rivalId)
    if (!rival) return noOp('there is no such house any more', record.origin.readable)
    const summary = competitionSummary(ctx.state)
    if (!summary) return noOp('there is nobody to compare them with', record.origin.readable)
    const today = ctx.state.calendar.totalDaysElapsed

    // A pact is kept while it is worth keeping. Whether it is depends on
    // the same head-to-head everything else reads: a rival that has fallen
    // behind renews gladly; one that has pulled ahead has no reason to.
    const worthKeeping = summary.meanAdvantage < 0.05
    if (worthKeeping) {
      writeRivalSlice(
        ctx,
        (current) => {
          const held = current.rivals[rival.id]
          if (!held) return current
          return {
            ...current,
            rivals: {
              ...current.rivals,
              [rival.id]: { ...held, truceUntilDay: today + 21 },
            },
          }
        },
        'pact_renewed',
      )
      const readable = `${rival.name} were glad to keep to the arrangement for another three weeks.`
      return {
        status: 'resolved',
        mutations: [
          {
            targetKind: 'system',
            targetId: rival.id,
            field: 'truceUntilDay',
            readable,
          },
        ],
        readable,
        cause: {
          source: `${RIVAL_MODULE_ID}.pact_renewed`,
          sourceType: 'system',
          target: rival.id,
          targetType: 'global',
          amount: 21,
          readable,
          tags: ['rival', 'pact'],
          relatedActors: [rivalRef(rival.id)],
          relatedSystems: ['rival'],
        },
      }
    }

    writeRivalSlice(
      ctx,
      (current) => {
        const held = current.rivals[rival.id]
        if (!held) return current
        const { truceUntilDay: _dropped, ...rest } = held
        return { ...current, rivals: { ...current.rivals, [rival.id]: rest } }
      },
      'pact_broken',
    )
    bumpRivalTotal(ctx, 'trucesBroken')
    const readable = `${rival.name} have walked away from the arrangement — they think they are winning.`
    ctx.addLog({ message: readable, level: 'warn', data: { rivalId: rival.id } }, 'rival')
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'system',
          targetId: rival.id,
          field: 'truceUntilDay',
          readable,
        },
      ],
      readable,
      cause: {
        source: `${RIVAL_MODULE_ID}.pact_broken`,
        sourceType: 'system',
        target: rival.id,
        targetType: 'global',
        amount: 0,
        readable,
        tags: ['rival', 'pact', 'broken'],
        relatedActors: [rivalRef(rival.id)],
        relatedSystems: ['rival'],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// Producers
// ---------------------------------------------------------------------------

export function scheduleRivalRetaliation(
  ctx: SimContext,
  input: {
    rivalId?: string
    provocation: 'poached' | 'undercut' | 'rumour' | 'other'
    source: string
    readable: string
    offsetDays?: number
  },
): boolean {
  const rivalId = input.rivalId ?? PRIMARY_RIVAL_ID
  const rival = rivalOrNothing(ctx, rivalId)
  if (!rival) return false
  const alreadyLive = getLiveScheduledEvents(ctx.state).some(
    (event) => event.type === RIVAL_RETALIATION_EVENT && event.target?.id === rivalId,
  )
  if (alreadyLive) return false
  const today = ctx.state.calendar.totalDaysElapsed
  const result = scheduleEvent(ctx, {
    type: RIVAL_RETALIATION_EVENT,
    target: rivalRef(rivalId),
    scheduledForDay: today + (input.offsetDays ?? 6),
    payload: { rivalId, provocation: input.provocation },
    origin: { source: input.source, readable: input.readable },
  })
  return result.status === 'scheduled'
}

// ---------------------------------------------------------------------------
// rival_price_war / rival_quality_race — they answer the move the house made
// ---------------------------------------------------------------------------
//
// Expansion Phase 9 — the last two rival hook families.
//
// These two are DIFFERENT from `rival_retaliation`, and the difference is
// worth keeping rather than folding them into it. Retaliation is provoked:
// somebody was poached, something was said, and the rival picks whichever
// hostile move it can afford. These two are COMPETITIVE: the house made a
// specific commercial move — it cut its price, or it put money into quality —
// and the promise on the card was that the other house might match it. So the
// move is named rather than chosen, and the counterplay is the one that
// belongs to that move: a house that has since put its prices back up is not
// in a price war, and a house whose quality edge has already gone has nothing
// left for the rival to chase.

/**
 * Is the house still undercutting them?
 *
 * Read from the rival's own recorded price level against the house's, which
 * is the same comparison the appeal model runs — so the answer here and the
 * answer the customers are acting on cannot disagree.
 */
function houseStillUndercutting(ctx: SimContext): boolean {
  const summary = competitionSummary(ctx.state)
  if (!summary) return false
  // The house is cheaper than they are, on the one scale both are read on.
  return summary.housePriceLevel < summary.rivalPriceLevel
}

const priceWarEvent: ScheduledEventDefinition = {
  type: RIVAL_PRICE_WAR_EVENT,
  kind: 'mechanical',
  ownerModuleId: RIVAL_MODULE_ID,
  label: 'The other house may slash too',
  payloadSchema: RivalPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 10,
  warningWindowDays: 4,
  expiryDays: 5,
  missingTarget: 'cancel',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = RivalPayloadSchema.safeParse(payload)
    return `${type}:${parsed.success ? parsed.data.rivalId : 'unknown'}:${scheduledForDay}`
  },
  futureHookPrefixes: ['price_war_'],
  fromFutureHook: ({ state }) => {
    if (!state) return undefined
    const rival = getRivalModuleState(state).rivals[PRIMARY_RIVAL_ID]
    if (!rival) return undefined
    return { payload: { rivalId: rival.id }, target: rivalRef(rival.id) }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = RivalPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload named no house', record.origin.readable)
    }
    const rival = rivalOrNothing(ctx, parsed.data.rivalId)
    if (!rival) return noOp('there is no such house any more', record.origin.readable)
    const today = ctx.state.calendar.totalDaysElapsed

    if (underTruce(rival, today)) {
      return noOp(
        `${rival.name} held their prices — there is an arrangement`,
        record.origin.readable,
      )
    }
    // THE COUNTERPLAY. A price war needs somebody still undercutting. A
    // house that has taken its margin back in the meantime gets a recorded
    // reason rather than a fight it walked away from.
    if (!houseStillUndercutting(ctx)) {
      return noOp(
        `${rival.name} saw no need — this house is no longer the cheaper pour`,
        record.origin.readable,
      )
    }
    // Cutting on an empty purse is how a house closes, and they know it.
    if (rival.purse < 40) {
      return noOp(
        `${rival.name} could not afford to fight on price`,
        record.origin.readable,
      )
    }

    const action = rivalActionById('shift_prices')
    if (!action) return noOp('they have no such move', record.origin.readable)
    const available = actorCanPerform(rival.actor, action, today)
    if (!available.ok) return noOp(available.reason, record.origin.readable)
    const before = rival.capability.priceLevel
    const performed = performActorAction(ctx, {
      actor: { ...rival.actor, goals: deriveRivalGoals(ctx.state, rival) },
      action,
      target: { kind: 'self', id: rival.id } as never,
      goalId: 'win_the_trade',
    })
    persistRivalActor(ctx, rival.id, performed.actor)
    recordRivalMove(ctx, {
      onDay: today,
      rivalId: rival.id,
      actionId: action.id,
      goalId: 'win_the_trade',
      targetId: rival.id,
      result: performed.outcome.result,
      readable: performed.outcome.readable,
    })
    if (performed.outcome.result === 'failed') {
      return noOp(performed.outcome.readable, record.origin.readable)
    }
    // THE MOVE HAS TO BE A CUT. `shift_prices` picks its own direction from
    // the overall appeal gap, so a rival who is ahead on quality or reach
    // takes its margin back UP — and the resolution would then report a
    // matched cut while the price had gone the other way. The action is
    // still performed, because that is what spends their purse and takes
    // their cooldown and commitment; the direction is this event's to
    // insist on, exactly as `rival_quality_race` writes the quality gain
    // rather than trusting `recruit_staff` to have produced one.
    const afterMove =
      getRivalModuleState(ctx.state).rivals[rival.id]?.capability.priceLevel ?? before
    const cut = Math.max(0, Math.min(100, before - PRICE_WAR_CUT))
    if (afterMove > cut) {
      writeRivalSlice(
        ctx,
        (current) => {
          const entry = current.rivals[rival.id]
          if (!entry) return current
          return {
            ...current,
            rivals: {
              ...current.rivals,
              [rival.id]: {
                ...entry,
                capability: { ...entry.capability, priceLevel: cut },
              },
            },
          }
        },
        'price_war_cut',
      )
    }
    const landed = Math.min(afterMove, cut)
    const readable = `${rival.name} matched the cut. It is a price war now.`
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'system',
          targetId: rival.id,
          field: 'capability.priceLevel',
          readable: `Their price level ${before} → ${landed}.`,
        },
      ],
      readable,
      cause: {
        source: `${RIVAL_MODULE_ID}.price_war`,
        sourceType: 'system',
        target: rival.id,
        targetType: 'global',
        amount: 0,
        readable,
        tags: ['rival', 'price_war'],
        relatedActors: [rivalRef(rival.id)],
        relatedSystems: ['rival'],
      },
    }
  },
}

const qualityRaceEvent: ScheduledEventDefinition = {
  type: RIVAL_QUALITY_RACE_EVENT,
  kind: 'mechanical',
  ownerModuleId: RIVAL_MODULE_ID,
  label: 'The other house may match the quality',
  payloadSchema: RivalPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 12,
  warningWindowDays: 4,
  expiryDays: 6,
  missingTarget: 'cancel',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = RivalPayloadSchema.safeParse(payload)
    return `${type}:${parsed.success ? parsed.data.rivalId : 'unknown'}:${scheduledForDay}`
  },
  futureHookPrefixes: ['quality_arms_race_'],
  fromFutureHook: ({ state }) => {
    if (!state) return undefined
    const rival = getRivalModuleState(state).rivals[PRIMARY_RIVAL_ID]
    if (!rival) return undefined
    return { payload: { rivalId: rival.id }, target: rivalRef(rival.id) }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = RivalPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload named no house', record.origin.readable)
    }
    const rival = rivalOrNothing(ctx, parsed.data.rivalId)
    if (!rival) return noOp('there is no such house any more', record.origin.readable)
    const today = ctx.state.calendar.totalDaysElapsed
    const summary = competitionSummary(ctx.state)
    if (!summary) return noOp('there is nobody to compare them with', record.origin.readable)

    if (underTruce(rival, today)) {
      return noOp(
        `${rival.name} let the quality question lie — there is an arrangement`,
        record.origin.readable,
      )
    }
    // THE COUNTERPLAY, and it is the uncomfortable kind: an arms race only
    // starts if the house is still visibly ahead on quality. A house that
    // let its own standard slip since is not being chased — which is a
    // recorded reason rather than a reward.
    if (summary.rivalQuality >= summary.houseQuality) {
      return noOp(
        `${rival.name} were already a match for this house on quality`,
        record.origin.readable,
      )
    }
    if (rival.purse < 30) {
      return noOp(
        `${rival.name} had nothing to spend on catching up`,
        record.origin.readable,
      )
    }

    // Through their own hiring move: matching a quality push means paying
    // for hands who can do the work, which is what `recruit_staff` IS. It
    // spends their purse and takes their commitment window like any other
    // move, so a race costs them the tempo it would have cost to plan.
    const action = rivalActionById('recruit_staff')
    if (!action) return noOp('they have no such move', record.origin.readable)
    const available = actorCanPerform(rival.actor, action, today)
    if (!available.ok) return noOp(available.reason, record.origin.readable)
    const performed = performActorAction(ctx, {
      actor: { ...rival.actor, goals: deriveRivalGoals(ctx.state, rival) },
      action,
      target: { kind: 'self', id: rival.id } as never,
      goalId: 'win_the_trade',
    })
    persistRivalActor(ctx, rival.id, performed.actor)
    if (performed.outcome.result === 'failed') {
      recordRivalMove(ctx, {
        onDay: today,
        rivalId: rival.id,
        actionId: action.id,
        goalId: 'win_the_trade',
        targetId: rival.id,
        result: performed.outcome.result,
        readable: performed.outcome.readable,
      })
      return noOp(performed.outcome.readable, record.origin.readable)
    }
    // And the quality itself, which is the thing the card said they might
    // match. Half the gap, not all of it: they are chasing, not arriving.
    const gap = summary.houseQuality - summary.rivalQuality
    const gained = Math.max(2, Math.round(gap / 2))
    writeRivalSlice(
      ctx,
      (current) => {
        const entry = current.rivals[rival.id]
        if (!entry) return current
        return {
          ...current,
          rivals: {
            ...current.rivals,
            [rival.id]: {
              ...entry,
              capability: {
                ...entry.capability,
                quality: Math.min(100, entry.capability.quality + gained),
              },
            },
          },
        }
      },
      'quality_race',
    )
    recordRivalMove(ctx, {
      onDay: today,
      rivalId: rival.id,
      actionId: action.id,
      goalId: 'win_the_trade',
      targetId: rival.id,
      result: performed.outcome.result,
      readable: performed.outcome.readable,
    })
    const readable = `${rival.name} put money into their own kitchen to close the gap.`
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'system',
          targetId: rival.id,
          field: 'capability.quality',
          readable: `Quality +${gained}.`,
        },
      ],
      readable,
      cause: {
        source: `${RIVAL_MODULE_ID}.quality_race`,
        sourceType: 'system',
        target: rival.id,
        targetType: 'global',
        amount: gained,
        readable,
        tags: ['rival', 'quality_arms_race'],
        relatedActors: [rivalRef(rival.id)],
        relatedSystems: ['rival'],
      },
    }
  },
}

export function scheduleRivalPactReview(
  ctx: SimContext,
  input: { rivalId?: string; source: string; readable: string; offsetDays?: number },
): boolean {
  const rivalId = input.rivalId ?? PRIMARY_RIVAL_ID
  if (!rivalOrNothing(ctx, rivalId)) return false
  const alreadyLive = getLiveScheduledEvents(ctx.state).some(
    (event) => event.type === RIVAL_PACT_REVIEW_EVENT && event.target?.id === rivalId,
  )
  if (alreadyLive) return false
  const today = ctx.state.calendar.totalDaysElapsed
  const result = scheduleEvent(ctx, {
    type: RIVAL_PACT_REVIEW_EVENT,
    target: rivalRef(rivalId),
    scheduledForDay: today + (input.offsetDays ?? 21),
    payload: { rivalId },
    origin: { source: input.source, readable: input.readable },
  })
  return result.status === 'scheduled'
}

export const RIVAL_SCHEDULED_EVENTS: ReadonlyArray<ScheduledEventDefinition> = [
  retaliationEvent,
  dominanceEvent,
  rumourExposedEvent,
  pactReviewEvent,
  priceWarEvent,
  qualityRaceEvent,
]

export const RIVAL_SCHEDULED_EVENT_TYPES: ReadonlyArray<string> =
  RIVAL_SCHEDULED_EVENTS.map((definition) => definition.type)

let registered = false

export function ensureRivalScheduledEventsRegistered(): void {
  if (registered) return
  for (const definition of RIVAL_SCHEDULED_EVENTS) registerScheduledEvent(definition)
  registered = true
}

ensureRivalScheduledEventsRegistered()
