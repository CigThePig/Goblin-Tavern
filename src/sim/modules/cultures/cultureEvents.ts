import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { EntityRef } from '../../state/TavernState'
import { registerScheduledEvent } from '../../contracts/scheduledEvents/registry'
import {
  scheduleEvent,
  type ScheduledEventDefinition,
  type ScheduledEventResolution,
} from '../../contracts/scheduledEvents/index'
import { cultureRegistry } from '../../content/cultures/cultureRegistry'

import {
  CULTURES_MODULE_ID,
  bumpCultureTotal,
  cultureNet,
  frictionKey,
  getCultureModuleState,
  liveMisunderstandingFor,
  writeCultureSlice,
} from './cultureState'
import { noteEvidence, openMisunderstanding } from './standing'
import type { CultureFrictionState } from './types'

// Expansion Phase 8 §8.2 + Phase 1 §1.1 — the two culture hook families.
//
// Both are `OBL-02` instances the culture layer could not keep until §8.2
// gave it somewhere to put the answer:
//
//   HOOK-culture_walkout_risk_*       → culture_walkout
//   HOOK-culture_seating_backlash_*   → culture_seating_backlash
//
// The first is declared by the response profile where the player IGNORES a
// culture's complaint; the second by the one where they take that culture's
// SIDE on seating. Both promised the other shoe would drop, and neither did
// — the responses module drained the name into a zero-weight cause because
// no domain owned it.
//
// They are answered here rather than in `8.3` because both are about
// cultures, and because the machinery they need — misunderstandings with a
// named remedy, and friction earned by actually sharing a room — is the
// machinery §8.2 built. Landing them alongside §8.3 is a scheduling fact,
// not a design one.

export const CULTURE_WALKOUT_EVENT = 'culture_walkout'
export const CULTURE_SEATING_BACKLASH_EVENT = 'culture_seating_backlash'

const CulturePayloadSchema = z.object({ cultureId: z.string() })

function noOp(reason: string, readable: string): ScheduledEventResolution {
  return { status: 'no_op', reason, readable }
}

function cultureRef(cultureId: string): EntityRef {
  return { kind: 'culture', id: cultureId }
}

/** Pull `<prefix><cultureId>` apart, and only accept a culture that exists. */
function cultureFromHook(
  hookName: string,
  prefix: string,
  state: { world: { cultures: Record<string, unknown> } } | undefined,
): string | undefined {
  if (!state) return undefined
  if (!hookName.startsWith(prefix)) return undefined
  const cultureId = hookName.slice(prefix.length)
  if (!cultureId || !state.world.cultures[cultureId]) return undefined
  return cultureId
}

// ---------------------------------------------------------------------------
// culture_walkout — the group that was ignored stops coming
// ---------------------------------------------------------------------------

const walkoutEvent: ScheduledEventDefinition = {
  type: CULTURE_WALKOUT_EVENT,
  kind: 'mechanical',
  ownerModuleId: CULTURES_MODULE_ID,
  label: 'A culture is deciding whether to stop coming',
  payloadSchema: CulturePayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 6,
  warningWindowDays: 3,
  expiryDays: 5,
  missingTarget: 'cancel',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = CulturePayloadSchema.safeParse(payload)
    return `${type}:${parsed.success ? parsed.data.cultureId : 'unknown'}:${scheduledForDay}`
  },
  futureHookPrefixes: ['culture_walkout_risk_'],
  fromFutureHook: ({ hookName, state }) => {
    const cultureId = cultureFromHook(hookName, 'culture_walkout_risk_', state)
    if (!cultureId) return undefined
    return { payload: { cultureId }, target: cultureRef(cultureId) }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = CulturePayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload was not a culture', record.origin.readable)
    }
    const culture = ctx.state.world.cultures[parsed.data.cultureId]
    if (!culture) {
      return noOp('that culture is no longer in the world', record.origin.readable)
    }

    // The warning window is the counterplay, so a house that has since put
    // things right keeps its crowd. Read live rather than at scheduling time.
    const net = cultureNet(ctx.state, culture.id)
    const trust = culture.trust ?? 50
    if (net >= -10 && trust >= 40) {
      return noOp(
        `${culture.label} were won back before it came to anything`,
        record.origin.readable,
      )
    }

    const existing = liveMisunderstandingFor(ctx.state, culture.id)
    if (existing?.severity === 'walkout') {
      return noOp(
        `${culture.label} have already stopped coming`,
        record.origin.readable,
      )
    }

    // An ordinary slight ESCALATES into a walkout rather than sitting
    // alongside one — a culture has at most one thing outstanding, which is
    // what keeps "there is always exactly one thing to put right" true.
    if (existing) closeExisting(ctx, existing.id)

    const opened = openMisunderstanding(ctx, {
      cultureId: culture.id,
      cause: 'turned_away',
      severity: 'walkout',
      reason: `${culture.label} were ignored once too often and have stopped coming.`,
      remedy: 'make amends directly — nothing else will bring them back',
    })
    if (!opened) {
      return noOp(`${culture.label} thought better of it`, record.origin.readable)
    }
    bumpCultureTotal(ctx, 'walkouts')

    noteEvidence(ctx, {
      cultureId: culture.id,
      id: 'walked_out',
      kind: 'turned_away',
      weight: 26,
      readable: `${culture.label} have stopped coming to this house.`,
      tags: ['walkout', 'culture'],
    })

    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'culture',
          targetId: culture.id,
          field: 'misunderstanding',
          readable: `${culture.label} walked out.`,
        },
      ],
      readable: `${culture.label} have stopped coming to this house.`,
      memory: {
        id: `culture_walked_out_${culture.id}`,
        source: 'cultures.walkout',
        actors: [cultureRef(culture.id)],
        tags: ['culture', 'walkout', 'grudge', culture.id],
        durationDays: 21,
        metadata: { cultureId: culture.id },
      },
      history: {
        category: 'state_change',
        summary: `${culture.label} stopped coming to the tavern.`,
        tags: ['culture', 'walkout', culture.id],
        relatedActors: [cultureRef(culture.id)],
        relatedSystems: ['cultures'],
        mechanicalRefs: [culture.id, CULTURE_WALKOUT_EVENT],
      },
    }
  },
}

function closeExisting(ctx: SimContext, id: string): void {
  const today = ctx.state.calendar.totalDaysElapsed
  writeCultureSlice(
    ctx,
    (current) => {
      const record = current.misunderstandings[id]
      if (!record) return current
      return {
        ...current,
        misunderstandings: {
          ...current.misunderstandings,
          [id]: { ...record, status: 'faded', closedOnDay: today },
        },
      }
    },
    'misunderstanding_escalated',
  )
}

// ---------------------------------------------------------------------------
// culture_seating_backlash — taking one side is noticed by the other
// ---------------------------------------------------------------------------

const seatingBacklashEvent: ScheduledEventDefinition = {
  type: CULTURE_SEATING_BACKLASH_EVENT,
  kind: 'mechanical',
  ownerModuleId: CULTURES_MODULE_ID,
  label: 'The groups who were not favoured are taking it badly',
  payloadSchema: CulturePayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 5,
  warningWindowDays: 2,
  expiryDays: 5,
  missingTarget: 'cancel',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = CulturePayloadSchema.safeParse(payload)
    return `${type}:${parsed.success ? parsed.data.cultureId : 'unknown'}:${scheduledForDay}`
  },
  futureHookPrefixes: ['culture_seating_backlash_'],
  fromFutureHook: ({ hookName, state }) => {
    const cultureId = cultureFromHook(hookName, 'culture_seating_backlash_', state)
    if (!cultureId) return undefined
    return { payload: { cultureId }, target: cultureRef(cultureId) }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = CulturePayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload was not a culture', record.origin.readable)
    }
    const favoured = ctx.state.world.cultures[parsed.data.cultureId]
    if (!favoured) {
      return noOp('that culture is no longer in the world', record.origin.readable)
    }

    // Who minds? The cultures that rub against the favoured one — by their
    // own declared friction, not by a blanket penalty on everybody else.
    const resentful = Object.values(ctx.state.world.cultures)
      .filter((other) => {
        if (other.id === favoured.id) return false
        const def = cultureRegistry.get(other.id)
        return favoured.tags.some((tag) => def.frictionWith.includes(tag))
      })
      .sort((a, b) => a.id.localeCompare(b.id))

    if (resentful.length === 0) {
      return noOp(
        `nobody in the room minds ${favoured.label} being looked after`,
        record.origin.readable,
      )
    }

    const today = ctx.state.calendar.totalDaysElapsed
    for (const other of resentful) {
      const key = frictionKey(favoured.id, other.id)
      writeCultureSlice(
        ctx,
        (current) => {
          const existing = current.friction[key]
          const next: CultureFrictionState = existing
            ? { ...existing, level: Math.min(100, existing.level + 20) }
            : {
                id: key,
                cultureA: favoured.id < other.id ? favoured.id : other.id,
                cultureB: favoured.id < other.id ? other.id : favoured.id,
                level: 20,
                sharedDays: 0,
                lastSharedOnDay: today,
              }
          return { ...current, friction: { ...current.friction, [key]: next } }
        },
        'seating_backlash',
      )
      noteEvidence(ctx, {
        cultureId: other.id,
        id: `seating_backlash_${favoured.id}`,
        kind: 'seating_friction',
        weight: 12,
        readable: `${other.label} noticed the house taking ${favoured.label}'s side over the seating.`,
        tags: ['seating', 'backlash', favoured.id],
      })
    }
    bumpCultureTotal(ctx, 'seatingBacklashes')

    const names = resentful.map((other) => other.label).join(' and ')
    return {
      status: 'resolved',
      mutations: resentful.map((other) => ({
        targetKind: 'culture',
        targetId: other.id,
        field: 'friction',
        readable: `${other.label} resent the house siding with ${favoured.label}.`,
      })),
      readable: `${names} took it badly that the house sided with ${favoured.label} over the seating.`,
      history: {
        category: 'state_change',
        summary: `${names} resented the seating decision.`,
        tags: ['culture', 'seating', 'backlash', favoured.id],
        relatedActors: resentful.map((other) => cultureRef(other.id)),
        relatedSystems: ['cultures'],
        mechanicalRefs: [favoured.id, CULTURE_SEATING_BACKLASH_EVENT],
      },
    }
  },
}

/** Schedule a walkout risk. Used by the culture pass when neglect is severe. */
export function scheduleWalkoutRisk(
  ctx: SimContext,
  cultureId: string,
  input: { source: string; readable: string; offsetDays?: number },
): boolean {
  const culture = ctx.state.world.cultures[cultureId]
  if (!culture) return false
  const today = ctx.state.calendar.totalDaysElapsed
  const result = scheduleEvent(ctx, {
    type: CULTURE_WALKOUT_EVENT,
    target: cultureRef(cultureId),
    scheduledForDay: today + (input.offsetDays ?? 6),
    payload: { cultureId },
    origin: { source: input.source, readable: input.readable },
  })
  return result.status === 'scheduled'
}

export const CULTURE_SCHEDULED_EVENTS: ReadonlyArray<ScheduledEventDefinition> = [
  walkoutEvent,
  seatingBacklashEvent,
]

let registered = false

export function ensureCultureScheduledEventsRegistered(): void {
  if (registered) return
  for (const definition of CULTURE_SCHEDULED_EVENTS) {
    registerScheduledEvent(definition)
  }
  registered = true
}

ensureCultureScheduledEventsRegistered()

export const CULTURE_SCHEDULED_EVENT_TYPES = CULTURE_SCHEDULED_EVENTS.map(
  (definition) => definition.type,
)

export { getCultureModuleState }
