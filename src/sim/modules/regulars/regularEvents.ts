import { z } from 'zod'

import type { RegularWorldState, TavernState } from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import { registerScheduledEvent } from '../../contracts/scheduledEvents/registry'
import type {
  ScheduledEventDefinition,
  ScheduledEventResolution,
} from '../../contracts/scheduledEvents/index'
import { outstandingAmount } from '../../contracts/obligations/index'
import { listPatronTabs } from '../service/tabs'

import { REGULARS_MODULE_ID } from './state'
import { hasRecentMemory, rememberService, serviceMemoryScore } from './regularMemory'

// Expansion Phase 4 §4.3 + Phase 1 §1.1 — the three regular-subject hook
// families move from narrative to mechanical.
//
// WHAT WAS BROKEN. `regular_favour_owed_<id>`, `regular_grudge_<id>` and
// `regular_word_credibility_<id>` each named a specific person and promised
// something about them — a favour that would be called in, a grudge that would
// be acted on, a word that would carry or fail to. None of them could happen,
// because a regular had no relationship to draw on, no memory to hold a grudge
// in, and no way to affect anybody else's opinion.
//
// PHASE 4 GIVES ALL THREE SOMETHING REAL TO MOVE: `ownerStanding` (what they
// think of you personally), the bounded `serviceMemory` (what they remember
// about the place), and `wordOfMouth` plus the group's patronage (whether
// anybody listens to them). Each resolver re-reads live state and has a branch
// for the player having put it right — which is what makes the warning worth
// having.

export const REGULAR_FAVOUR_OWED_EVENT = 'regulars.favour_owed'
export const REGULAR_GRUDGE_EVENT = 'regulars.grudge'
export const REGULAR_WORD_CREDIBILITY_EVENT = 'regulars.word_credibility'

const RegularPayloadSchema = z.object({ regularId: z.string() })

function noOp(reason: string, readable: string): ScheduledEventResolution {
  return { status: 'no_op', reason, readable }
}

function regularOf(
  state: TavernState,
  payload: unknown,
): RegularWorldState | undefined {
  const parsed = RegularPayloadSchema.safeParse(payload)
  if (!parsed.success) return undefined
  return state.world.regulars[parsed.data.regularId]
}

function regularPayloadAdapter(prefix: string) {
  return ({ hookName }: { hookName: string }) => {
    if (!hookName.startsWith(prefix)) return undefined
    const regularId = hookName.slice(prefix.length)
    if (regularId.length === 0) return undefined
    return {
      payload: { regularId },
      target: { kind: 'regular' as const, id: regularId },
    }
  }
}

function regularExactOnceKey({
  type,
  payload,
  scheduledForDay,
}: {
  type: string
  payload: unknown
  scheduledForDay: number
}): string {
  const parsed = RegularPayloadSchema.safeParse(payload)
  const regularId = parsed.success ? parsed.data.regularId : 'unknown'
  return `${type}:${regularId}:${scheduledForDay}`
}

/** What this regular owes the house across every live slate. */
function slateFor(state: TavernState, regularId: string): number {
  return listPatronTabs(state)
    .filter((record) => record.counterparty.id === regularId)
    .reduce((sum, record) => sum + outstandingAmount(record), 0)
}

// ---------------------------------------------------------------------------
// regular_favour_owed_*
// ---------------------------------------------------------------------------

/**
 * A favour called in.
 *
 * The house did this person a good turn and the promise was that they would
 * return it. They do — by bringing their crowd in, which is the only thing a
 * regular actually has to give: their group's patronage rises and their own
 * standing settles back to level. Requires the standing that was earned to
 * still be there when it comes due; being chased for a slate in the meantime is
 * exactly what spends it.
 */
const favourOwedEvent: ScheduledEventDefinition = {
  type: REGULAR_FAVOUR_OWED_EVENT,
  kind: 'mechanical',
  ownerModuleId: REGULARS_MODULE_ID,
  label: 'A regular owes you one',
  payloadSchema: RegularPayloadSchema,
  beat: 'morning',
  defaultOffsetDays: 5,
  warningWindowDays: 2,
  expiryDays: 8,
  missingTarget: 'cancel',
  exactOnceKey: regularExactOnceKey,
  futureHookPrefixes: ['regular_favour_owed_'],
  fromFutureHook: regularPayloadAdapter('regular_favour_owed_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const regular = regularOf(ctx.state, record.payload)
    if (!regular) {
      return noOp('they no longer drink here', record.origin.readable)
    }
    const standing = regular.ownerStanding ?? 50
    if (standing < 45) {
      return noOp(
        `${regular.name.display} does not feel they owe you anything any more (standing ${standing})`,
        `${regular.name.display} decided the favour was cancelled out.`,
      )
    }
    const group = ctx.state.customerGroups[regular.customerGroupId]
    if (!group) {
      return noOp('their crowd is gone', record.origin.readable)
    }
    const patronage = clampPercent(group.patronage + 6)
    ctx.modifyCustomerGroup(
      group.id,
      { patronage },
      {
        source: 'regulars.favour_owed',
        sourceType: 'regular',
        direction: 'increase',
        amount: patronage - group.patronage,
        readable: `${regular.name.display} brought the ${group.label} in to repay a favour.`,
        tags: ['regular', 'favour', group.id, regular.id],
        relatedActors: [
          { kind: 'regular', id: regular.id },
          { kind: 'customer_group', id: group.id },
        ],
        relatedSystems: ['regulars', 'customers'],
      },
    )
    rememberService(ctx, regular, {
      kind: 'good_service',
      readable: `${regular.name.display} squared up the favour they owed you.`,
      weight: 1,
      standingDelta: -3,
    })
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'customer_group',
          targetId: group.id,
          field: 'patronage',
          readable: `${group.label} patronage rose to ${patronage}.`,
        },
      ],
      readable: `${regular.name.display} repaid the favour — they brought people in.`,
      history: {
        category: 'service',
        summary: `${regular.name.display} repaid a favour by bringing the ${group.label} in.`,
        tags: ['regular', 'favour'],
        relatedActors: [{ kind: 'regular', id: regular.id }],
        relatedSystems: ['regulars'],
        mechanicalRefs: [REGULAR_FAVOUR_OWED_EVENT],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// regular_grudge_*
// ---------------------------------------------------------------------------

/**
 * A grudge acted on.
 *
 * Re-reads the person: the grudge only lands if their memory of the place is
 * still sour when it comes due, so anything that mends it in the meantime — a
 * word, a wiped slate, a run of good nights — is a real answer. What it does is
 * make them stop coming, which is a fact with a stated reason and a named
 * return condition rather than a meter nudge.
 */
const grudgeEvent: ScheduledEventDefinition = {
  type: REGULAR_GRUDGE_EVENT,
  kind: 'mechanical',
  ownerModuleId: REGULARS_MODULE_ID,
  label: 'A regular is nursing a grudge',
  payloadSchema: RegularPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 4,
  warningWindowDays: 3,
  expiryDays: 7,
  missingTarget: 'cancel',
  exactOnceKey: regularExactOnceKey,
  futureHookPrefixes: ['regular_grudge_'],
  fromFutureHook: regularPayloadAdapter('regular_grudge_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const regular = regularOf(ctx.state, record.payload)
    if (!regular) {
      return noOp('they no longer drink here', record.origin.readable)
    }
    const today = ctx.state.calendar.totalDaysElapsed
    const mended =
      hasRecentMemory(regular, 'tab_forgiven', today, 7) ||
      hasRecentMemory(regular, 'request_granted', today, 7)
    if (mended) {
      return {
        status: 'cancelled',
        reason: `${regular.name.display} was squared up with before it came due`,
        readable: `${regular.name.display} let it go — you made it right.`,
      }
    }
    const feeling = serviceMemoryScore(regular, today)
    if (feeling >= 0 && regular.irritation < 50) {
      return noOp(
        `${regular.name.display} has had a good run since (feeling ${feeling})`,
        `${regular.name.display} stopped brooding about it.`,
      )
    }
    if (regular.stoppedVisiting) {
      return noOp(
        `${regular.name.display} had already stopped coming in`,
        `${regular.name.display} was already staying away.`,
      )
    }
    const reason = 'has a grudge against the house'
    ctx.modifyRegular(
      regular.id,
      {
        stoppedVisiting: { sinceDay: today, reason },
        irritation: clampPercent(regular.irritation + 10),
      },
      {
        source: 'regulars.grudge',
        sourceType: 'regular',
        target: regular.id,
        targetType: 'regular',
        amount: -1,
        direction: 'decrease',
        readable: `${regular.name.display} has stopped coming in — ${reason}.`,
        tags: ['regular', 'grudge', 'lapsed', regular.customerGroupId],
        relatedActors: [{ kind: 'regular', id: regular.id }],
        relatedSystems: ['regulars'],
      },
    )
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'regular',
          targetId: regular.id,
          field: 'stoppedVisiting',
          readable: `${regular.name.display} has stopped drinking here.`,
        },
      ],
      readable: `${regular.name.display} acted on the grudge — they are not coming back for now.`,
      memory: {
        id: 'regular_stopped_visiting',
        source: 'regulars.grudge',
        actors: [
          { kind: 'regular', id: regular.id },
          { kind: 'customer_group', id: regular.customerGroupId },
        ],
        tags: ['regular', 'grudge', regular.customerGroupId],
        metadata: { regularId: regular.id, reason },
      },
      history: {
        category: 'service',
        summary: `${regular.name.display} acted on a grudge and stopped coming in.`,
        tags: ['regular', 'grudge', 'lapsed'],
        relatedActors: [{ kind: 'regular', id: regular.id }],
        relatedSystems: ['regulars'],
        mechanicalRefs: [REGULAR_GRUDGE_EVENT],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// regular_word_credibility_*
// ---------------------------------------------------------------------------

/**
 * Whether anybody believes them.
 *
 * The promise is that this person's word about the house will carry. It does,
 * in the direction their own record points: a regular who has been treated well
 * talks the place up and their group's patronage rises; one who has been chased
 * for a slate or left standing talks it down. The `wordOfMouth` counters make it
 * cumulative rather than a one-off nudge, and they are what Phase 8's rumour
 * channels will read.
 */
const wordCredibilityEvent: ScheduledEventDefinition = {
  type: REGULAR_WORD_CREDIBILITY_EVENT,
  kind: 'mechanical',
  ownerModuleId: REGULARS_MODULE_ID,
  label: "A regular's word is going round",
  payloadSchema: RegularPayloadSchema,
  beat: 'morning',
  defaultOffsetDays: 4,
  warningWindowDays: 2,
  expiryDays: 7,
  missingTarget: 'cancel',
  exactOnceKey: regularExactOnceKey,
  futureHookPrefixes: ['regular_word_credibility_'],
  fromFutureHook: regularPayloadAdapter('regular_word_credibility_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const regular = regularOf(ctx.state, record.payload)
    if (!regular) {
      return noOp('they no longer drink here', record.origin.readable)
    }
    const group = ctx.state.customerGroups[regular.customerGroupId]
    if (!group) {
      return noOp('their crowd is gone', record.origin.readable)
    }
    const today = ctx.state.calendar.totalDaysElapsed
    const feeling = serviceMemoryScore(regular, today)
    const standing = regular.ownerStanding ?? 50
    const owed = slateFor(ctx.state, regular.id)

    // How much weight their word carries: a regular nobody knows is not worth
    // listening to, and one who has been here for months is.
    const credibility = Math.min(3, 1 + Math.floor(regular.visits / 15))
    const positive = feeling > 0 && standing >= 50 && owed <= 0
    const delta = positive ? credibility : -credibility
    const patronage = clampPercent(group.patronage + delta)
    if (patronage === group.patronage) {
      return noOp(
        `nobody's mind was changed (${group.label} patronage is at its limit)`,
        `${regular.name.display} said their piece and nothing moved.`,
      )
    }

    const counts = regular.wordOfMouth ?? { recommendations: 0, criticisms: 0 }
    ctx.modifyRegular(
      regular.id,
      {
        wordOfMouth: positive
          ? { ...counts, recommendations: counts.recommendations + 1 }
          : { ...counts, criticisms: counts.criticisms + 1 },
      },
      {
        source: 'regulars.word_credibility',
        sourceType: 'regular',
        target: regular.id,
        targetType: 'regular',
        amount: delta,
        readable: positive
          ? `${regular.name.display} spoke well of the place, and it carried.`
          : `${regular.name.display} spoke against the place, and it carried.`,
        tags: ['regular', 'word_of_mouth', regular.customerGroupId],
        relatedActors: [{ kind: 'regular', id: regular.id }],
        relatedSystems: ['regulars'],
      },
    )
    ctx.modifyCustomerGroup(
      group.id,
      { patronage },
      {
        source: 'regulars.word_credibility',
        sourceType: 'regular',
        direction: positive ? 'increase' : 'decrease',
        amount: delta,
        readable: positive
          ? `${regular.name.display}'s word brought the ${group.label} in.`
          : `${regular.name.display}'s word kept the ${group.label} away.`,
        tags: ['regular', 'word_of_mouth', group.id],
        relatedActors: [
          { kind: 'regular', id: regular.id },
          { kind: 'customer_group', id: group.id },
        ],
        relatedSystems: ['regulars', 'customers'],
      },
    )
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'customer_group',
          targetId: group.id,
          field: 'patronage',
          readable: `${group.label} patronage moved to ${patronage}.`,
        },
        {
          targetKind: 'regular',
          targetId: regular.id,
          field: 'wordOfMouth',
          readable: positive
            ? `${regular.name.display} has spoken well of the place ${counts.recommendations + 1}×.`
            : `${regular.name.display} has spoken against it ${counts.criticisms + 1}×.`,
        },
      ],
      readable: positive
        ? `${regular.name.display} talked the place up, and people listened.`
        : `${regular.name.display} talked the place down, and people listened.`,
      history: {
        category: 'service',
        summary: positive
          ? `${regular.name.display}'s good word reached the ${group.label}.`
          : `${regular.name.display}'s bad word reached the ${group.label}.`,
        tags: ['regular', 'word_of_mouth'],
        relatedActors: [{ kind: 'regular', id: regular.id }],
        relatedSystems: ['regulars'],
        mechanicalRefs: [REGULAR_WORD_CREDIBILITY_EVENT],
      },
    }
  },
}

export const REGULAR_SCHEDULED_EVENTS: ScheduledEventDefinition[] = [
  favourOwedEvent,
  grudgeEvent,
  wordCredibilityEvent,
]

let registered = false

/** Register the regulars module's mechanical event types. Idempotent. */
export function ensureRegularScheduledEventsRegistered(): void {
  if (registered) return
  for (const definition of REGULAR_SCHEDULED_EVENTS) {
    registerScheduledEvent(definition)
  }
  registered = true
}
