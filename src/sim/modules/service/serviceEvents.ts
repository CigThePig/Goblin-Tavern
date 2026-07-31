import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { CustomerGroupState, TavernState } from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import { registerScheduledEvent } from '../../contracts/scheduledEvents/registry'
import type {
  ScheduledEventDefinition,
  ScheduledEventMutation,
  ScheduledEventResolution,
} from '../../contracts/scheduledEvents/index'
import { effectiveQuality, isPerishable } from '../stock/spoilage'

import { SERVICE_MODULE_ID_FOR_TABS, listPatronTabs } from './tabs'
import type { DailyServiceResult, ServiceModuleState } from './types'
import { assessBrawlRisk } from './flow/flowIncidents'

// The owning module id, read from the leaf that also owns the tab records
// rather than from `serviceModule.ts`. The module file imports THIS one (to
// register these types on `startDay`), so importing it back would be a cycle —
// and under a plain ESM loader that is a temporal-dead-zone crash rather than a
// tidiness question.
const SERVICE_MODULE_ID = SERVICE_MODULE_ID_FOR_TABS

/**
 * Today's service result, read straight off the slice.
 *
 * Same reason as above: the accessor lives in the module file this one is
 * imported by. Reading the slice is what the accessor does anyway.
 */
function readServiceResult(state: TavernState): DailyServiceResult | undefined {
  const slice = state.modules[SERVICE_MODULE_ID] as ServiceModuleState | undefined
  return slice?.result
}

// Expansion Phase 4 §4.4 + Phase 1 §1.1 — six hook families move from
// narrative to mechanical, closing the service half of this phase's `OBL-02`
// rows.
//
// WHAT WAS BROKEN. Each of these names was declared by a response profile as a
// `future_hook`, queued, drained on its day, and resolved into a zero-weight
// cause. `brawl_possible` told the player a fight might break out; nothing in
// the codebase could make one happen. `food_poisoning_outbreak_*` promised an
// outbreak; nothing owned the word. `apology_expectation_*` said a crowd was
// waiting for an apology, and no apology could be given or withheld.
//
// WHY PHASE 4 CAN KEEP THEM. This phase finally owns the records they are about:
// a room with a crowd in it, a dish that was actually served, a slate somebody
// actually ran up, and a named regular who actually came in or did not. Each
// resolver below re-reads live state when it fires, has a branch for "the player
// fixed it", and mutates something an owning domain is the authority on.
//
// THE ONE THAT STAYS NARRATIVE. `merchant_flight_possible` is declared only by
// `src/sim/testing/expansions/candleShortage.ts`, a test-expansion fixture that
// is not shipped content, and its subject is a supplier relationship Phase 6
// owns. Its ledger row is annotated rather than answered here by something that
// only looks like a resolver.

export const BRAWL_POSSIBLE_EVENT = 'service.brawl_possible'
export const SECURITY_ROUTINE_EVENT = 'service.security_routine'
export const FOOD_POISONING_EVENT = 'service.food_poisoning_outbreak'
export const APOLOGY_EXPECTATION_EVENT = 'service.apology_expectation'
export const BANNED_GROUP_RETURNS_EVENT = 'service.banned_group_returns'

const GroupPayloadSchema = z.object({ groupId: z.string() })
const EmptyPayloadSchema = z.object({}).passthrough()

function noOp(reason: string, readable: string): ScheduledEventResolution {
  return { status: 'no_op', reason, readable }
}

function groupOf(
  state: TavernState,
  payload: unknown,
): CustomerGroupState | undefined {
  const parsed = GroupPayloadSchema.safeParse(payload)
  if (!parsed.success) return undefined
  return state.customerGroups[parsed.data.groupId]
}

/** `<prefix><groupId>` → a validated group payload. */
function groupPayloadAdapter(prefix: string) {
  return ({ hookName }: { hookName: string }) => {
    if (!hookName.startsWith(prefix)) return undefined
    const groupId = hookName.slice(prefix.length)
    if (groupId.length === 0) return undefined
    return {
      payload: { groupId },
      target: { kind: 'customer_group' as const, id: groupId },
    }
  }
}

function groupExactOnceKey({
  type,
  payload,
  scheduledForDay,
}: {
  type: string
  payload: unknown
  scheduledForDay: number
}): string {
  const parsed = GroupPayloadSchema.safeParse(payload)
  const groupId = parsed.success ? parsed.data.groupId : 'unknown'
  return `${type}:${groupId}:${scheduledForDay}`
}

function tavernExactOnceKey({
  type,
  scheduledForDay,
}: {
  type: string
  scheduledForDay: number
}): string {
  return `${type}:${scheduledForDay}`
}

/** Did the owner apologise to this crowd since the promise was made? */
function apologisedSince(
  state: TavernState,
  groupId: string,
  sinceDay: number,
): boolean {
  return state.memories.some(
    (memory) =>
      memory.strength > 0 &&
      (memory.createdAt?.absoluteDay ?? -1) >= sinceDay &&
      memory.tags.includes(groupId) &&
      (memory.id.includes('apolog') ||
        memory.tags.includes('apology') ||
        memory.id === 'owner_made_amends'),
  )
}

// ---------------------------------------------------------------------------
// brawl_possible
// ---------------------------------------------------------------------------

/**
 * A fight the player was warned about.
 *
 * Re-reads the room when it fires: the promise was made about a rowdy, packed,
 * unpoliced house, and putting somebody on the door, thinning the crowd or
 * calming the regulars are all real answers. The mutation is area damage and a
 * risk bump — the areas module owns both, and both feed tomorrow's capacity
 * through `getAreaBlockedFraction`, so a brawl the player ignored costs seats.
 */
const brawlPossibleEvent: ScheduledEventDefinition = {
  type: BRAWL_POSSIBLE_EVENT,
  kind: 'mechanical',
  ownerModuleId: SERVICE_MODULE_ID,
  label: 'A fight is brewing',
  payloadSchema: EmptyPayloadSchema,
  // A brawl is a consequence OF the evening, so it fires after the day's
  // choices have been counted.
  beat: 'wrap_up',
  defaultOffsetDays: 2,
  warningWindowDays: 2,
  expiryDays: 5,
  missingTarget: 'resolve_anyway',
  exactOnceKey: tavernExactOnceKey,
  futureHookPrefixes: ['brawl_possible'],
  fromFutureHook: ({ hookName }) =>
    hookName === 'brawl_possible' ? { payload: {} } : undefined,
  resolve: (ctx, record): ScheduledEventResolution => {
    const result = readServiceResult(ctx.state)
    const flow = result?.flow
    if (!result || !flow) {
      return noOp('no service ran today', record.origin.readable)
    }
    const security = flow.capacity.securityCover
    if (security >= 1) {
      return noOp(
        `somebody was on the door (security cover ${security})`,
        'The trouble went nowhere — there was somebody on the door.',
      )
    }
    const brawlRisk = assessBrawlRisk(
      ctx,
      {
        flow,
        quality: result.serviceQuality,
        regularsById: ctx.state.world.regulars,
        dayType: ctx.getDayType(),
      },
      'main_room',
    )
    if (!brawlRisk?.actorGroup) {
      return noOp(
        'the room never became both rowdy and packed enough',
        'The warned trouble found no packed, rowdy room to ignite.',
      )
    }
    const rowdy = ctx.state.customerGroups[brawlRisk.actorGroup]
    if (!rowdy) {
      return noOp('the rowdy crowd is no longer present', record.origin.readable)
    }
    const room = ctx.state.areas['main_room']
    if (!room) {
      return noOp('there is no main room to fight in', record.origin.readable)
    }
    // The immediate flow incident already applies one point of physical
    // damage. When this warned fight lands on the same night, add only the
    // remaining five so one fight does not become a seven-point consequence
    // merely because both the incident and delayed-event layers observed it.
    const immediateBrawl = result.incidents.some(
      (incident) =>
        incident.id === 'minor_brawl' && incident.areaId === 'main_room',
    )
    const damage = clampPercent(room.damage + (immediateBrawl ? 5 : 6))
    const risk = clampPercent(room.risk + 4)
    ctx.modifyArea(
      'main_room',
      { damage, risk },
      {
        source: 'service.brawl',
        reason: 'brawl_possible_resolved',
        relatedActors: [{ kind: 'customer_group', id: rowdy.id }],
        relatedLocations: [{ kind: 'area', id: 'main_room' }],
      },
    )
    const mutations: ScheduledEventMutation[] = [
      {
        targetKind: 'area',
        targetId: 'main_room',
        field: 'damage',
        readable: `The main room took ${damage - room.damage} damage in the fight.`,
      },
    ]
    return {
      status: 'resolved',
      mutations,
      readable: `The ${rowdy.label} started the fight you were warned about.`,
      cause: {
        source: 'service.brawl',
        sourceType: 'service',
        target: 'area:main_room.damage',
        targetType: 'area',
        amount: damage - room.damage,
        direction: 'increase',
        readable: `A brawl the house was warned about wrecked part of the main room.`,
        tags: ['service', 'brawl', 'incident', rowdy.id],
        relatedActors: [{ kind: 'customer_group', id: rowdy.id }],
        relatedLocations: [{ kind: 'area', id: 'main_room' }],
        relatedSystems: ['service', 'areas'],
      },
      memory: {
        id: 'recent_brawl',
        source: 'service.brawl',
        actors: [{ kind: 'customer_group', id: rowdy.id }],
        locations: [{ kind: 'area', id: 'main_room' }],
        tags: ['service', 'brawl', rowdy.id],
        metadata: { groupId: rowdy.id, warned: true },
      },
      history: {
        category: 'service',
        summary: `A brawl the house was warned about broke out (${rowdy.label}).`,
        tags: ['service', 'brawl', 'warned'],
        relatedActors: [{ kind: 'customer_group', id: rowdy.id }],
        relatedLocations: [{ kind: 'area', id: 'main_room' }],
        relatedSystems: ['service'],
        mechanicalRefs: [BRAWL_POSSIBLE_EVENT],
      },
      pressures: [
        {
          id: 'violence',
          change: 8,
          cause: {
            source: 'service.brawl',
            sourceType: 'service',
            target: 'pressure:violence',
            targetType: 'global',
            amount: 8,
            direction: 'increase',
            readable: 'A brawl the house was warned about went ahead.',
            tags: ['service', 'brawl', 'violence'],
            relatedSystems: ['service', 'pressures'],
          },
        },
      ],
    }
  },
}

// ---------------------------------------------------------------------------
// security_routine_possible
// ---------------------------------------------------------------------------

/**
 * The door staff settle into a routine.
 *
 * The promised consequence is that security stops being ad hoc: the tavern's
 * `risk` falls and stays lower. Only pays out if somebody was actually on
 * security work when it comes due, which is the counterplay — a routine nobody
 * works is not a routine.
 */
const securityRoutineEvent: ScheduledEventDefinition = {
  type: SECURITY_ROUTINE_EVENT,
  kind: 'mechanical',
  ownerModuleId: SERVICE_MODULE_ID,
  label: 'A door routine settles in',
  payloadSchema: EmptyPayloadSchema,
  // `wrap_up`, not `morning`. A routine settling in is a fact about the day
  // that has just been worked, and at `morning` the service slice has already
  // been reset and the roster not yet built — so a morning resolver would read
  // an empty evening and conclude nobody had been on the door, whoever had.
  beat: 'wrap_up',
  defaultOffsetDays: 5,
  warningWindowDays: 2,
  expiryDays: 6,
  missingTarget: 'resolve_anyway',
  exactOnceKey: tavernExactOnceKey,
  futureHookPrefixes: ['security_routine_possible'],
  fromFutureHook: ({ hookName }) =>
    hookName === 'security_routine_possible' ? { payload: {} } : undefined,
  resolve: (ctx): ScheduledEventResolution => {
    const flow = readServiceResult(ctx.state)?.flow
    if (!flow || flow.capacity.securityCover <= 0) {
      return noOp(
        'nobody has been working the door',
        'The door routine never took — nobody has been on it.',
      )
    }
    const room = ctx.state.areas['main_room']
    if (!room) {
      return noOp('there is no main room to police', 'No room to keep order in.')
    }
    const risk = clampPercent(room.risk - 8)
    if (risk === room.risk) {
      return noOp(
        'the room was already as orderly as it gets',
        'The room was already in good order.',
      )
    }
    ctx.modifyArea(
      'main_room',
      { risk },
      { source: 'service.security_routine', reason: 'security_routine_settled' },
    )
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'area',
          targetId: 'main_room',
          field: 'risk',
          readable: `Steady door work brought main-room risk down to ${risk}.`,
        },
      ],
      readable: 'The door routine settled in — the room is calmer for it.',
      cause: {
        source: 'service.security_routine',
        sourceType: 'service',
        target: 'area:main_room.risk',
        targetType: 'area',
        amount: risk - room.risk,
        direction: 'decrease',
        readable: 'Steady work on the door made the main room calmer.',
        tags: ['service', 'security', 'routine'],
        relatedLocations: [{ kind: 'area', id: 'main_room' }],
        relatedSystems: ['service', 'areas'],
      },
      history: {
        category: 'service',
        summary: 'A door routine settled in; main-room risk fell.',
        tags: ['service', 'security'],
        relatedLocations: [{ kind: 'area', id: 'main_room' }],
        relatedSystems: ['service'],
        mechanicalRefs: [SECURITY_ROUTINE_EVENT],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// food_poisoning_outbreak_*
// ---------------------------------------------------------------------------

/**
 * An outbreak among the people who ate the bad batch.
 *
 * Re-reads the cellar when it fires — throwing out the spoiled stock is the
 * counterplay, and it works — and lands on the group that was actually served,
 * as satisfaction and patronage, plus the food-safety pressure.
 */
const foodPoisoningEvent: ScheduledEventDefinition = {
  type: FOOD_POISONING_EVENT,
  kind: 'mechanical',
  ownerModuleId: SERVICE_MODULE_ID,
  label: 'People are falling ill',
  payloadSchema: GroupPayloadSchema,
  beat: 'morning',
  defaultOffsetDays: 3,
  warningWindowDays: 2,
  expiryDays: 5,
  missingTarget: 'cancel',
  exactOnceKey: groupExactOnceKey,
  futureHookPrefixes: ['food_poisoning_outbreak_'],
  fromFutureHook: groupPayloadAdapter('food_poisoning_outbreak_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const group = groupOf(ctx.state, record.payload)
    if (!group) {
      return noOp('that crowd no longer exists', record.origin.readable)
    }
    // Did the player clear out what was going to make people ill?
    const worstQuality = Object.values(ctx.state.stock).reduce((worst, item) => {
      if (item.quantity <= 0) return worst
      const quality = isPerishable(item) ? effectiveQuality(item) : item.quality
      return Math.min(worst, quality)
    }, 100)
    if (worstQuality >= 35) {
      return noOp(
        `the bad stock was dealt with (worst effective quality ${worstQuality})`,
        'Nobody fell ill — the bad stock had already gone.',
      )
    }
    const satisfaction = clampPercent(group.satisfaction - 12)
    const patronage = clampPercent(group.patronage - 8)
    ctx.modifyCustomerGroup(
      group.id,
      { satisfaction, patronage },
      {
        source: 'service.food_poisoning',
        sourceType: 'customer',
        direction: 'decrease',
        amount: satisfaction - group.satisfaction,
        readable: `${group.label} fell ill after eating here.`,
        tags: ['service', 'food_safety', 'outbreak', group.id],
        relatedActors: [{ kind: 'customer_group', id: group.id }],
        relatedSystems: ['service', 'customers'],
      },
    )
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'customer_group',
          targetId: group.id,
          field: 'satisfaction',
          readable: `${group.label} satisfaction fell to ${satisfaction} after the outbreak.`,
        },
        {
          targetKind: 'customer_group',
          targetId: group.id,
          field: 'patronage',
          readable: `${group.label} patronage fell to ${patronage}.`,
        },
      ],
      readable: `${group.label} fell ill after eating here — word is going round.`,
      memory: {
        id: 'food_poisoning_outbreak',
        source: 'service.food_poisoning',
        actors: [{ kind: 'customer_group', id: group.id }],
        tags: ['service', 'food_safety', group.id],
        metadata: { groupId: group.id, worstQuality },
      },
      history: {
        category: 'service',
        summary: `An outbreak hit the ${group.label} after eating here.`,
        tags: ['service', 'food_safety', 'outbreak'],
        relatedActors: [{ kind: 'customer_group', id: group.id }],
        relatedSystems: ['service'],
        mechanicalRefs: [FOOD_POISONING_EVENT],
      },
      pressures: [
        {
          id: 'food_safety',
          change: 14,
          cause: {
            source: 'service.food_poisoning',
            sourceType: 'service',
            target: 'pressure:food_safety',
            targetType: 'global',
            amount: 14,
            direction: 'increase',
            readable: `People fell ill after eating here.`,
            tags: ['service', 'food_safety', group.id],
            relatedActors: [{ kind: 'customer_group', id: group.id }],
            relatedSystems: ['service', 'pressures'],
          },
        },
      ],
    }
  },
}

// ---------------------------------------------------------------------------
// apology_expectation_*
// ---------------------------------------------------------------------------

/**
 * A crowd waiting for an apology that never came.
 *
 * This is the family Phase 3 handed to Phase 4 because its subject is a
 * customer group. The counterplay is a genuine one — anything that records
 * making amends with the group before the day it comes due cancels it — and the
 * consequence lands on loyalty rather than satisfaction, because an unanswered
 * apology is about whether they come back, not about how tonight went.
 */
const apologyExpectationEvent: ScheduledEventDefinition = {
  type: APOLOGY_EXPECTATION_EVENT,
  kind: 'mechanical',
  ownerModuleId: SERVICE_MODULE_ID,
  label: 'An apology is expected',
  payloadSchema: GroupPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 4,
  warningWindowDays: 3,
  expiryDays: 6,
  missingTarget: 'cancel',
  exactOnceKey: groupExactOnceKey,
  futureHookPrefixes: ['apology_expectation_'],
  fromFutureHook: groupPayloadAdapter('apology_expectation_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const group = groupOf(ctx.state, record.payload)
    if (!group) {
      return noOp('that crowd no longer exists', record.origin.readable)
    }
    if (apologisedSince(ctx.state, group.id, record.createdOnDay)) {
      return {
        status: 'cancelled',
        reason: `the owner made amends with the ${group.label}`,
        readable: `You made it right with the ${group.label}.`,
      }
    }
    const loyalty = clampPercent(group.loyalty - 8)
    if (loyalty === group.loyalty) {
      return noOp(
        `${group.label} loyalty is already at the floor`,
        `The ${group.label} could not think less of the place.`,
      )
    }
    ctx.modifyCustomerGroup(
      group.id,
      { loyalty },
      {
        source: 'service.apology_expectation',
        sourceType: 'customer',
        direction: 'decrease',
        amount: loyalty - group.loyalty,
        readable: `The ${group.label} waited for an apology that never came.`,
        tags: ['service', 'apology', 'unanswered', group.id],
        relatedActors: [{ kind: 'customer_group', id: group.id }],
        relatedSystems: ['service', 'customers'],
      },
    )
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'customer_group',
          targetId: group.id,
          field: 'loyalty',
          readable: `${group.label} loyalty fell to ${loyalty}.`,
        },
      ],
      readable: `The ${group.label} gave up waiting for an apology.`,
      memory: {
        id: 'apology_never_came',
        source: 'service.apology_expectation',
        actors: [{ kind: 'customer_group', id: group.id }],
        tags: ['service', 'apology', group.id],
        metadata: { groupId: group.id },
      },
      history: {
        category: 'service',
        summary: `The ${group.label} gave up waiting for an apology.`,
        tags: ['service', 'apology'],
        relatedActors: [{ kind: 'customer_group', id: group.id }],
        relatedSystems: ['service'],
        mechanicalRefs: [APOLOGY_EXPECTATION_EVENT],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// banned_group_returns_*
// ---------------------------------------------------------------------------

/**
 * A banned crowd tests whether the ban still holds.
 *
 * The ban is real state (`ban_customer_group` drops patronage and tags the
 * group), so this reads it: a group that has been left alone drifts back on its
 * own terms, and one whose slate is still outstanding comes back angrier. Either
 * way patronage moves, which is what makes a ban a decision with a horizon
 * rather than a permanent deletion.
 */
const bannedGroupReturnsEvent: ScheduledEventDefinition = {
  type: BANNED_GROUP_RETURNS_EVENT,
  kind: 'mechanical',
  ownerModuleId: SERVICE_MODULE_ID,
  label: 'A barred crowd tries the door',
  payloadSchema: GroupPayloadSchema,
  beat: 'morning',
  defaultOffsetDays: 7,
  warningWindowDays: 2,
  expiryDays: 8,
  missingTarget: 'cancel',
  exactOnceKey: groupExactOnceKey,
  futureHookPrefixes: ['banned_group_returns_'],
  fromFutureHook: groupPayloadAdapter('banned_group_returns_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const group = groupOf(ctx.state, record.payload)
    if (!group) {
      return noOp('that crowd no longer exists', record.origin.readable)
    }
    const owes = listPatronTabs(ctx.state).some(
      (tab) => tab.tags.includes(group.id),
    )
    // A crowd with an unpaid slate does not slink back in quietly.
    const returning = owes ? 4 : 10
    const patronage = clampPercent(group.patronage + returning)
    if (patronage === group.patronage) {
      return noOp(
        `${group.label} patronage cannot rise any further`,
        `The ${group.label} were already back in force.`,
      )
    }
    ctx.modifyCustomerGroup(
      group.id,
      { patronage },
      {
        source: 'service.banned_group_returns',
        sourceType: 'customer',
        direction: 'increase',
        amount: returning,
        readable: `The ${group.label} started coming back.`,
        tags: ['service', 'ban', 'return', group.id],
        relatedActors: [{ kind: 'customer_group', id: group.id }],
        relatedSystems: ['service', 'customers'],
      },
    )
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
      readable: owes
        ? `The ${group.label} are back, and they still owe you.`
        : `The ${group.label} are drifting back in.`,
      memory: {
        id: 'banned_group_returned',
        source: 'service.banned_group_returns',
        actors: [{ kind: 'customer_group', id: group.id }],
        tags: ['service', 'ban', group.id],
        metadata: { groupId: group.id, stillOwes: owes },
      },
      history: {
        category: 'service',
        summary: `The ${group.label} came back after being barred.`,
        tags: ['service', 'ban', 'return'],
        relatedActors: [{ kind: 'customer_group', id: group.id }],
        relatedSystems: ['service'],
        mechanicalRefs: [BANNED_GROUP_RETURNS_EVENT],
      },
    }
  },
}

export const SERVICE_SCHEDULED_EVENTS: ScheduledEventDefinition[] = [
  brawlPossibleEvent,
  securityRoutineEvent,
  foodPoisoningEvent,
  apologyExpectationEvent,
  bannedGroupReturnsEvent,
]

let registered = false

/**
 * Register the service module's mechanical event types.
 *
 * Idempotent and called at import, like the staff and area equivalents, because
 * the response bridge has to find these types the first time a hook is routed —
 * which can happen before any service code runs.
 */
export function ensureServiceScheduledEventsRegistered(): void {
  if (registered) return
  for (const definition of SERVICE_SCHEDULED_EVENTS) {
    registerScheduledEvent(definition)
  }
  registered = true
}

// A saved game may resume directly in segment B or C, without running the
// service module's start-day hook in this process. Register at import so queued
// typed events and response hooks already have an owner during that resume.
ensureServiceScheduledEventsRegistered()
