import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { EntityRef, SocialRumourState } from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import { registerScheduledEvent } from '../../contracts/scheduledEvents/registry'
import {
  getLiveScheduledEvents,
  scheduleEvent,
  type ScheduledEventDefinition,
  type ScheduledEventResolution,
} from '../../contracts/scheduledEvents/index'

import {
  MAX_RUMOUR_HOPS,
  RUMOURS_MODULE_ID,
  audiencesOf,
  bumpRumourTotal,
  liveRumours,
} from './rumourState'
import { correctRumour } from './belief'

// Expansion Phase 8 §8.4 + Phase 1 §1.1 — five hook families about talk.
//
// Every one is a response profile telling the player that what they just did
// about a rumour might come back on them, and every one drained into a
// zero-weight cause because no domain owned talk:
//
//   HOOK-rumour_escalation_*          → rumour_escalation
//   HOOK-rumour_escalation_*_*        → rumour_escalation
//   HOOK-rumour_denial_backfire_*     → rumour_denial_backfire
//   HOOK-rumour_denial_backfire_*_*   → rumour_denial_backfire
//   HOOK-counter_rumour_runaway_*     → counter_rumour_runaway
//
// They are the three ways answering a rumour can go wrong, and each now
// resolves against the LIVE record rather than against what was true when
// the player chose:
//
//   escalation — you said nothing, and it got louder and travelled further
//   denial backfire — you denied something that turns out to be true
//   counter runaway — the story you put about got away from you
//
// All three re-read the rumour on the day they fire, so a player who settled
// the matter in between gets an explained no-op rather than a punishment for
// a decision they already reversed.

export const RUMOUR_ESCALATION_EVENT = 'rumour_escalation'
export const RUMOUR_DENIAL_BACKFIRE_EVENT = 'rumour_denial_backfire'
export const COUNTER_RUMOUR_RUNAWAY_EVENT = 'counter_rumour_runaway'

const RumourPayloadSchema = z.object({ rumourId: z.string() })

function noOp(reason: string, readable: string): ScheduledEventResolution {
  return { status: 'no_op', reason, readable }
}

function rumourRef(id: string): EntityRef {
  return { kind: 'rumour', id }
}

/**
 * Find the rumour a hook name is about.
 *
 * The families come in two shapes — `rumour_escalation_<rumourId>` and
 * `rumour_escalation_<kind>_<id>`, the second naming the SUBJECT rather than
 * the rumour — so the adapter tries the id first and then looks for a live
 * rumour about that subject. When neither resolves it declines, because a
 * promise whose subject cannot be verified is the promise this arc exists to
 * stop making.
 */
function rumourFromHook(
  hookName: string,
  prefix: string,
  state: { world: { socialRumours: Record<string, SocialRumourState> } } | undefined,
): string | undefined {
  if (!state) return undefined
  if (!hookName.startsWith(prefix)) return undefined
  const suffix = hookName.slice(prefix.length)
  if (!suffix) return undefined

  if (state.world.socialRumours[suffix]) return suffix

  // `<kind>_<id>` — a subject rather than a rumour.
  const underscore = suffix.indexOf('_')
  if (underscore <= 0) return undefined
  const kind = suffix.slice(0, underscore)
  const id = suffix.slice(underscore + 1)
  const match = Object.values(state.world.socialRumours)
    .filter(
      (rumour) =>
        rumour.correctedOnDay === undefined &&
        ((rumour.subject?.kind === kind && rumour.subject.id === id) ||
          rumour.targetEntityId === id),
    )
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0]
  return match?.id
}

function adapterFor(prefix: string) {
  return ({ hookName, state }: { hookName: string; state?: unknown }) => {
    const rumourId = rumourFromHook(
      hookName,
      prefix,
      state as Parameters<typeof rumourFromHook>[2],
    )
    if (!rumourId) return undefined
    return { payload: { rumourId }, target: rumourRef(rumourId) }
  }
}

// ---------------------------------------------------------------------------
// rumour_escalation — silence lets it grow
// ---------------------------------------------------------------------------

const escalationEvent: ScheduledEventDefinition = {
  type: RUMOUR_ESCALATION_EVENT,
  kind: 'mechanical',
  ownerModuleId: RUMOURS_MODULE_ID,
  label: 'A rumour nobody answered is getting louder',
  payloadSchema: RumourPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 6,
  warningWindowDays: 3,
  expiryDays: 5,
  missingTarget: 'cancel',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = RumourPayloadSchema.safeParse(payload)
    return `${type}:${parsed.success ? parsed.data.rumourId : 'unknown'}:${scheduledForDay}`
  },
  futureHookPrefixes: ['rumour_escalation_'],
  fromFutureHook: adapterFor('rumour_escalation_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = RumourPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload was not a rumour', record.origin.readable)
    }
    const rumour = ctx.state.world.socialRumours[parsed.data.rumourId]
    if (!rumour) {
      return noOp('that story is no longer going round', record.origin.readable)
    }
    if (rumour.correctedOnDay !== undefined) {
      return noOp(
        `"${rumour.label}" was settled before it came to anything`,
        record.origin.readable,
      )
    }
    if (rumour.counterRumourId) {
      return noOp(
        `"${rumour.label}" is being contradicted, so it is not running unopposed`,
        record.origin.readable,
      )
    }

    // Louder, more believed, and — the part that matters — it gets its
    // travelling allowance back, so silence genuinely costs reach.
    const nextStrength = clampPercent(rumour.strength + 18)
    const nextCredibility = clampPercent((rumour.credibility ?? 50) + 12)
    ctx.modifySocialRumour(
      rumour.id,
      {
        strength: nextStrength,
        credibility: nextCredibility,
        hops: Math.max(0, (rumour.hops ?? 0) - 2),
        reach: 'public',
      },
      {
        source: `${RUMOURS_MODULE_ID}.escalation`,
        sourceType: 'rumour',
        target: rumour.id,
        targetType: 'rumour',
        amount: nextStrength - rumour.strength,
        readable: `Nobody answered "${rumour.label}", and it has grown.`,
        tags: ['rumour', 'escalation', rumour.id],
        relatedActors: [rumourRef(rumour.id)],
        relatedSystems: ['rumours'],
      },
    )

    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'rumour',
          targetId: rumour.id,
          field: 'strength',
          readable: `"${rumour.label}" got louder (${Math.round(rumour.strength)} → ${nextStrength}).`,
        },
      ],
      readable: `"${rumour.label}" went unanswered and is now all over town.`,
      memory: {
        id: `rumour_escalated_${rumour.id}`,
        source: 'rumours.escalation',
        actors: [rumourRef(rumour.id)],
        tags: ['rumour', 'escalation', rumour.id],
        durationDays: 21,
        metadata: { rumourId: rumour.id },
      },
      history: {
        category: 'state_change',
        summary: `"${rumour.label}" escalated.`,
        tags: ['rumour', 'escalation', rumour.id],
        relatedActors: [rumourRef(rumour.id)],
        relatedSystems: ['rumours'],
        mechanicalRefs: [rumour.id, RUMOUR_ESCALATION_EVENT],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// rumour_denial_backfire — you denied something true
// ---------------------------------------------------------------------------

const denialBackfireEvent: ScheduledEventDefinition = {
  type: RUMOUR_DENIAL_BACKFIRE_EVENT,
  kind: 'mechanical',
  ownerModuleId: RUMOURS_MODULE_ID,
  label: 'A denial is being tested',
  payloadSchema: RumourPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 12,
  warningWindowDays: 3,
  expiryDays: 6,
  missingTarget: 'cancel',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = RumourPayloadSchema.safeParse(payload)
    return `${type}:${parsed.success ? parsed.data.rumourId : 'unknown'}:${scheduledForDay}`
  },
  futureHookPrefixes: ['rumour_denial_backfire_'],
  fromFutureHook: adapterFor('rumour_denial_backfire_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = RumourPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload was not a rumour', record.origin.readable)
    }
    const rumour = ctx.state.world.socialRumours[parsed.data.rumourId]
    if (!rumour) {
      return noOp('that story is no longer going round', record.origin.readable)
    }

    // A denial only backfires if the thing was TRUE. This is the first place
    // in the game where `accuracy` decides anything — it has been carried on
    // the record since Phase 25 and read only by a pressure meter.
    if (rumour.accuracy !== 'true' && rumour.accuracy !== 'partial') {
      return noOp(
        `there was nothing in "${rumour.label}" for the denial to trip over`,
        record.origin.readable,
      )
    }

    const nextCredibility = clampPercent((rumour.credibility ?? 50) + 25)
    ctx.modifySocialRumour(
      rumour.id,
      { credibility: nextCredibility, strength: clampPercent(rumour.strength + 10) },
      {
        source: `${RUMOURS_MODULE_ID}.denial_backfire`,
        sourceType: 'rumour',
        target: rumour.id,
        targetType: 'rumour',
        amount: nextCredibility - (rumour.credibility ?? 50),
        readable: `The denial of "${rumour.label}" did not hold — there was something in it.`,
        tags: ['rumour', 'denial', 'backfire', rumour.id],
        relatedActors: [rumourRef(rumour.id)],
        relatedSystems: ['rumours'],
      },
    )
    // Everybody who heard it now credits it more: being caught denying
    // something true is worse than never having spoken.
    const believedHarder = audiencesOf(rumour).map((audience) => ({
      ...audience,
      belief: clampPercent(audience.belief + 20),
    }))
    if (believedHarder.length > 0) {
      ctx.modifySocialRumour(
        rumour.id,
        { audiences: believedHarder },
        {
          source: `${RUMOURS_MODULE_ID}.denial_backfire`,
          sourceType: 'rumour',
          target: rumour.id,
          targetType: 'rumour',
          readable: `Everybody who heard "${rumour.label}" believes it more now.`,
          tags: ['rumour', 'belief', rumour.id],
          relatedActors: [rumourRef(rumour.id)],
          relatedSystems: ['rumours'],
        },
      )
    }
    ctx.modifyReputation(
      { ...ctx.state.reputation, reliable: clampPercent(ctx.state.reputation.reliable - 8) },
      {
        source: `${RUMOURS_MODULE_ID}.denial_backfire`,
        sourceType: 'rumour',
        target: 'reputation.reliable',
        targetType: 'reputation',
        amount: -8,
        direction: 'decrease',
        readable: 'The house was caught denying something true.',
        tags: ['rumour', 'denial', 'backfire'],
        relatedSystems: ['rumours', 'reputation'],
      },
    )

    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'rumour',
          targetId: rumour.id,
          field: 'credibility',
          readable: `"${rumour.label}" is believed far more now.`,
        },
      ],
      readable: `The house's denial of "${rumour.label}" came apart — there was something in it after all.`,
      memory: {
        id: `rumour_denial_backfired_${rumour.id}`,
        source: 'rumours.denial_backfire',
        actors: [rumourRef(rumour.id)],
        tags: ['rumour', 'denial', 'backfire', rumour.id],
        durationDays: 28,
        metadata: { rumourId: rumour.id },
      },
      history: {
        category: 'state_change',
        summary: `A denial backfired: "${rumour.label}".`,
        tags: ['rumour', 'denial', 'backfire', rumour.id],
        relatedActors: [rumourRef(rumour.id)],
        relatedSystems: ['rumours'],
        mechanicalRefs: [rumour.id, RUMOUR_DENIAL_BACKFIRE_EVENT],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// counter_rumour_runaway — the story you put about got away from you
// ---------------------------------------------------------------------------

const counterRunawayEvent: ScheduledEventDefinition = {
  type: COUNTER_RUMOUR_RUNAWAY_EVENT,
  kind: 'mechanical',
  ownerModuleId: RUMOURS_MODULE_ID,
  label: 'A counter-story is getting out of hand',
  payloadSchema: RumourPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 8,
  warningWindowDays: 3,
  expiryDays: 5,
  missingTarget: 'cancel',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = RumourPayloadSchema.safeParse(payload)
    return `${type}:${parsed.success ? parsed.data.rumourId : 'unknown'}:${scheduledForDay}`
  },
  futureHookPrefixes: ['counter_rumour_runaway_'],
  fromFutureHook: adapterFor('counter_rumour_runaway_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = RumourPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload was not a rumour', record.origin.readable)
    }
    const original = ctx.state.world.socialRumours[parsed.data.rumourId]
    const counterId = original?.counterRumourId
    const counter = counterId ? ctx.state.world.socialRumours[counterId] : undefined
    if (!counter) {
      return noOp('no counter-story was ever put about', record.origin.readable)
    }
    if (counter.correctedOnDay !== undefined) {
      return noOp(
        `the counter-story about "${original?.label}" was settled`,
        record.origin.readable,
      )
    }

    // Running away means DISTORTING, not merely getting louder — the story
    // the house started is no longer the story being told, which is the
    // specific thing the hook warned about.
    const nextDistortion = clampPercent((counter.distortion ?? 0) + 35)
    ctx.modifySocialRumour(
      counter.id,
      {
        distortion: nextDistortion,
        label: `${counter.originalLabel ?? counter.label} — though what people are repeating now is barely the same story`,
        strength: clampPercent(counter.strength + 15),
        accuracy: 'false',
      },
      {
        source: `${RUMOURS_MODULE_ID}.counter_runaway`,
        sourceType: 'rumour',
        target: counter.id,
        targetType: 'rumour',
        amount: nextDistortion - (counter.distortion ?? 0),
        readable: `The story the house put about has run away from it.`,
        tags: ['rumour', 'counter', 'runaway', counter.id],
        relatedActors: [rumourRef(counter.id)],
        relatedSystems: ['rumours'],
      },
    )

    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'rumour',
          targetId: counter.id,
          field: 'distortion',
          readable: `The counter-story has become something else (${nextDistortion}).`,
        },
      ],
      readable: `The story the house put about to answer "${original?.label}" has got away from it.`,
      memory: {
        id: `counter_rumour_ran_away_${counter.id}`,
        source: 'rumours.counter_runaway',
        actors: [rumourRef(counter.id)],
        tags: ['rumour', 'counter', 'runaway', counter.id],
        durationDays: 21,
        metadata: { rumourId: counter.id },
      },
      history: {
        category: 'state_change',
        summary: 'A counter-story ran away from the house.',
        tags: ['rumour', 'counter', 'runaway', counter.id],
        relatedActors: [rumourRef(counter.id)],
        relatedSystems: ['rumours'],
        mechanicalRefs: [counter.id, COUNTER_RUMOUR_RUNAWAY_EVENT],
      },
    }
  },
}

/** Schedule one of the three, guarded against stacking on the same rumour. */
export function scheduleRumourConsequence(
  ctx: SimContext,
  type: string,
  rumourId: string,
  input: { source: string; readable: string; offsetDays?: number },
): boolean {
  if (!ctx.state.world.socialRumours[rumourId]) return false
  const alreadyLive = getLiveScheduledEvents(ctx.state).some(
    (event) => event.type === type && event.target?.id === rumourId,
  )
  if (alreadyLive) return false
  const today = ctx.state.calendar.totalDaysElapsed
  const result = scheduleEvent(ctx, {
    type,
    target: rumourRef(rumourId),
    scheduledForDay: today + (input.offsetDays ?? 6),
    payload: { rumourId },
    origin: { source: input.source, readable: input.readable },
  })
  return result.status === 'scheduled'
}

/**
 * Talk nobody has answered starts to escalate on its own.
 *
 * The autonomous trigger, so the escalation family is not reachable only
 * through a response the player happened to be offered.
 */
export function reviewEscalations(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  for (const rumour of liveRumours(ctx.state)) {
    if (rumour.counterRumourId) continue
    if (rumour.strength < 45) continue
    if (audiencesOf(rumour).length < 2) continue
    if (today - rumour.firstHeardDay < 5) continue
    if ((rumour.hops ?? 0) >= MAX_RUMOUR_HOPS) continue
    scheduleRumourConsequence(ctx, RUMOUR_ESCALATION_EVENT, rumour.id, {
      source: 'rumours.review',
      readable: `"${rumour.label}" is going round unanswered.`,
    })
  }
}

/** Settle a rumour outright. Used by the player's actions and by corrections. */
export function settleRumour(
  ctx: SimContext,
  rumourId: string,
  readable: string,
): boolean {
  const settled = correctRumour(ctx, rumourId, readable)
  if (settled) bumpRumourTotal(ctx, 'corrected', 0)
  return settled
}

export const RUMOUR_SCHEDULED_EVENTS: ReadonlyArray<ScheduledEventDefinition> = [
  escalationEvent,
  denialBackfireEvent,
  counterRunawayEvent,
]

let registered = false

export function ensureRumourScheduledEventsRegistered(): void {
  if (registered) return
  for (const definition of RUMOUR_SCHEDULED_EVENTS) registerScheduledEvent(definition)
  registered = true
}

ensureRumourScheduledEventsRegistered()

export const RUMOUR_SCHEDULED_EVENT_TYPES = RUMOUR_SCHEDULED_EVENTS.map((d) => d.type)
