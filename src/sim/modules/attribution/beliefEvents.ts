import { z } from 'zod'

import type { EntityRef } from '../../state/TavernState'
import { registerScheduledEvent } from '../../contracts/scheduledEvents/registry'
import type {
  ScheduledEventDefinition,
  ScheduledEventResolution,
} from '../../contracts/scheduledEvents/index'

import { ATTRIBUTION_MODULE_ID } from './attributionQueries'
import { beliefBetween, houseRef } from './beliefInputs'
import { recordAttribution } from './attributionModule'

// Expansion Phase 8 §8.5 + Phase 1 §1.1 — the last two Phase-8 hook families.
//
//   HOOK-rumour_blame_grudge_*_*    → belief_grudge_formed
//   HOOK-rumour_bribe_exposed_*_*   → belief_bribe_exposed
//
// Both are promises the game made about BELIEF, which is why they waited for
// this part rather than landing with the rumour network. The player deflected
// a rumour onto somebody, or paid a gossip to be quiet, and the response
// profile said it might come back on them. Until now "coming back on them"
// drained into a zero-weight cause.
//
// Now each one produces a real belief through `recordAttribution` — the same
// path a rule's draft takes — and belief is a thing six domains read. The
// grudge lands as ACCURATE, because the blamed party really was smeared:
// `address_grievance` cannot talk them out of something they are right about,
// which is the whole point of that action having a wrong way to play it.

export const BELIEF_GRUDGE_EVENT = 'belief_grudge_formed'
export const BELIEF_BRIBE_EXPOSED_EVENT = 'belief_bribe_exposed'

const HolderPayloadSchema = z.object({
  holderKind: z.string(),
  holderId: z.string(),
})

function noOp(reason: string, readable: string): ScheduledEventResolution {
  return { status: 'no_op', reason, readable }
}

/**
 * Read `<prefix><kind>_<id>` back into the entity the hook is about.
 *
 * Entity kinds contain underscores (`customer_group`, `notable_npc`), so the
 * split cannot be on the first one. The known kinds are tried longest-first
 * instead, and a suffix matching none of them is declined — a promise whose
 * subject cannot be identified is exactly the promise this arc stops making.
 */
const HOLDER_KINDS = [
  'customer_group',
  'tavern_identity',
  'notable_npc',
  'local_event',
  'supplier',
  'regular',
  'faction',
  'culture',
  'rumour',
  'staff',
  'area',
  'stock',
] as const

function holderFromHook(hookName: string, prefix: string): EntityRef | undefined {
  if (!hookName.startsWith(prefix)) return undefined
  const suffix = hookName.slice(prefix.length)
  for (const kind of [...HOLDER_KINDS].sort((a, b) => b.length - a.length)) {
    if (!suffix.startsWith(`${kind}_`)) continue
    const id = suffix.slice(kind.length + 1)
    if (!id) return undefined
    return { kind: kind as EntityRef['kind'], id }
  }
  return undefined
}

function adapterFor(prefix: string) {
  return ({ hookName }: { hookName: string }) => {
    const holder = holderFromHook(hookName, prefix)
    if (!holder) return undefined
    return {
      payload: { holderKind: holder.kind, holderId: holder.id },
      target: holder,
    }
  }
}

function holderOf(payload: unknown): EntityRef | undefined {
  const parsed = HolderPayloadSchema.safeParse(payload)
  if (!parsed.success) return undefined
  return { kind: parsed.data.holderKind as EntityRef['kind'], id: parsed.data.holderId }
}

// ---------------------------------------------------------------------------
// belief_grudge_formed — the party you blamed holds it against you
// ---------------------------------------------------------------------------

const grudgeEvent: ScheduledEventDefinition = {
  type: BELIEF_GRUDGE_EVENT,
  kind: 'mechanical',
  ownerModuleId: ATTRIBUTION_MODULE_ID,
  label: 'Somebody you blamed has not forgotten it',
  payloadSchema: HolderPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 14,
  warningWindowDays: 3,
  expiryDays: 7,
  missingTarget: 'cancel',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = HolderPayloadSchema.safeParse(payload)
    const who = parsed.success ? `${parsed.data.holderKind}:${parsed.data.holderId}` : 'unknown'
    return `${type}:${who}:${scheduledForDay}`
  },
  futureHookPrefixes: ['rumour_blame_grudge_'],
  fromFutureHook: adapterFor('rumour_blame_grudge_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const holder = holderOf(record.payload)
    if (!holder) {
      return noOp('the event did not name who was blamed', record.origin.readable)
    }
    const existing = beliefBetween(ctx.state, holder, houseRef(ctx.state))
    recordAttribution(ctx, {
      perceivedBy: holder,
      target: houseRef(ctx.state),
      attributionType: 'resentment',
      // TRUE, and that is the load-bearing part: the house really did put it
      // on them, so the grievance cannot be talked away.
      accuracy: 'true',
      strength: 70,
      confidence: 85,
      publicness: 55,
      volatility: 25,
      readable: 'The house put the blame on them, and they know it.',
      tags: ['grudge', 'blame', 'belief'],
      relatedSystems: ['attribution'],
    })
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: holder.kind,
          targetId: holder.id,
          readable: 'They hold the house responsible for what was said about them.',
        },
      ],
      readable: `${holder.id} has not forgotten being blamed, and it is affecting how they deal with the house.`,
      cause: {
        source: `${ATTRIBUTION_MODULE_ID}.grudge_formed`,
        sourceType: 'memory',
        target: `${holder.kind}:${holder.id}`,
        targetType: 'global',
        amount: existing ? 0 : 70,
        direction: 'increase',
        weight: 35,
        readable: 'A grudge the house earned by deflecting blame has hardened.',
        tags: ['attribution', 'belief', 'grudge', holder.id],
        relatedActors: [{ ...holder }],
        relatedSystems: ['attribution'],
      },
      history: {
        category: 'state_change',
        summary: `${holder.id} holds the house responsible for being blamed.`,
        tags: ['attribution', 'grudge', holder.id],
        relatedActors: [{ ...holder }],
        relatedSystems: ['attribution'],
        mechanicalRefs: [BELIEF_GRUDGE_EVENT, holder.id],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// belief_bribe_exposed — the money you paid to keep it quiet is now the story
// ---------------------------------------------------------------------------

const bribeExposedEvent: ScheduledEventDefinition = {
  type: BELIEF_BRIBE_EXPOSED_EVENT,
  kind: 'mechanical',
  ownerModuleId: ATTRIBUTION_MODULE_ID,
  label: 'A bribe the house paid has got out',
  payloadSchema: HolderPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 15,
  warningWindowDays: 3,
  expiryDays: 7,
  missingTarget: 'cancel',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = HolderPayloadSchema.safeParse(payload)
    const who = parsed.success ? `${parsed.data.holderKind}:${parsed.data.holderId}` : 'unknown'
    return `${type}:${who}:${scheduledForDay}`
  },
  futureHookPrefixes: ['rumour_bribe_exposed_'],
  fromFutureHook: adapterFor('rumour_bribe_exposed_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const holder = holderOf(record.payload)
    if (!holder) {
      return noOp('the event did not name what was hushed up', record.origin.readable)
    }
    // A bribe getting out is PUBLIC by definition, which is what makes this
    // one reach the watch and the landlord rather than only the person paid.
    recordAttribution(ctx, {
      perceivedBy: { kind: 'faction', id: 'town_watch' },
      target: houseRef(ctx.state),
      attributionType: 'distrust',
      accuracy: 'true',
      strength: 65,
      confidence: 80,
      publicness: 80,
      volatility: 20,
      readable: 'Word got round that the house paid somebody to keep quiet.',
      tags: ['bribe', 'corruption', 'belief'],
      relatedSystems: ['attribution', 'regulatory'],
    })
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'faction',
          targetId: 'town_watch',
          readable: 'The watch has heard the house pays people to stay quiet.',
        },
      ],
      readable: 'The bribe got out. The watch is reading the house harder than it was.',
      cause: {
        source: `${ATTRIBUTION_MODULE_ID}.bribe_exposed`,
        sourceType: 'memory',
        target: 'faction:town_watch',
        targetType: 'global',
        amount: 65,
        direction: 'increase',
        weight: 40,
        readable: 'A bribe the house paid became public, and the watch believes it.',
        tags: ['attribution', 'belief', 'bribe', 'town_watch'],
        relatedActors: [{ kind: 'faction', id: 'town_watch' }],
        relatedSystems: ['attribution', 'regulatory'],
      },
      history: {
        category: 'state_change',
        summary: 'A bribe the house paid to silence talk became public.',
        tags: ['attribution', 'bribe', 'town_watch'],
        relatedActors: [{ kind: 'faction', id: 'town_watch' }],
        relatedSystems: ['attribution', 'regulatory'],
        mechanicalRefs: [BELIEF_BRIBE_EXPOSED_EVENT, holder.id],
      },
    }
  },
}

export const BELIEF_SCHEDULED_EVENTS: ReadonlyArray<ScheduledEventDefinition> = [
  grudgeEvent,
  bribeExposedEvent,
]

export const BELIEF_SCHEDULED_EVENT_TYPES = BELIEF_SCHEDULED_EVENTS.map(
  (definition) => definition.type,
)

let registered = false

export function ensureBeliefScheduledEventsRegistered(): void {
  if (registered) return
  for (const definition of BELIEF_SCHEDULED_EVENTS) registerScheduledEvent(definition)
  registered = true
}

ensureBeliefScheduledEventsRegistered()
