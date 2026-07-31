// Expansion Phase 4 (repo phase 211) / ISSUE-174 — the five service-subject
// hook families, and what each one now actually does.
//
// Each of these was an `OBL-02` row: a response profile declared the name, the
// responses module drained it on its day, and nothing happened. §1.1's contract
// for a mechanical event is what they are held to here:
//
//   * a registered owner and a payload schema;
//   * a warning the player can see coming;
//   * a resolver that RE-READS live state rather than the state at scheduling
//     time, so the counterplay is real;
//   * an authoritative mutation on `resolved` — a zero-weight cause does not
//     count;
//   * an explained `no_op` or `cancelled` when the player dealt with it;
//   * exactly once.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import {
  withCoin,
  withCustomerGroup,
  withStaff,
  withStock,
} from '../../src/sim/testing/stateFactories'
import {
  getScheduledEventDefinition,
  readScheduledEventsSlice,
} from '../../src/sim/contracts/scheduledEvents/index'
import {
  APOLOGY_EXPECTATION_EVENT,
  BANNED_GROUP_RETURNS_EVENT,
  BRAWL_POSSIBLE_EVENT,
  FOOD_POISONING_EVENT,
  SECURITY_ROUTINE_EVENT,
  SERVICE_SCHEDULED_EVENTS,
  ensureServiceScheduledEventsRegistered,
} from '../../src/sim/modules/service/serviceEvents'

const SEED = 'phase211/service-events'

/**
 * `staffPriorities` goes through the INPUT, not the state.
 *
 * `currentPriority` on a staff record is the applied result of a day's
 * assignment, and `assignStaffPriorities` rewrites it from the input every
 * morning — falling back to the role default when the input is silent. Setting
 * it on state and then running a day would have the engine overwrite it before
 * service, which is how the first draft of these tests "proved" that putting
 * somebody on the door changed nothing.
 */
function input(
  day: number,
  staffPriorities?: Record<string, string>,
): SimInput {
  return {
    seed: `${SEED}-d${day}`,
    ...(staffPriorities ? { staffPriorities } : {}),
  }
}

function stocked(state: TavernState): TavernState {
  return withStock(
    withStock(withStock(state, 'ale', { quantity: 2000 }), 'stew', {
      quantity: 2000,
    }),
    'mushrooms',
    { quantity: 2000 },
  )
}

/** A warning can become a fight only if tonight recreates the real flow risk. */
function packedAndRowdy(state: TavernState): TavernState {
  let next = state
  for (const groupId of Object.keys(state.customerGroups)) {
    next = withCustomerGroup(next, groupId, {
      patronage: 100,
      rowdiness: 100,
      loyalty: 100,
      satisfaction: 100,
    })
  }
  return next
}

/**
 * Queue an event the way the response bridge does — by NAME — and run days
 * until it resolves.
 *
 * Going through `fromFutureHook` rather than hand-building a payload is the
 * point: the hook families are strings a response profile emits, and the test
 * has to prove the string reaches a resolver.
 */
function scheduleByHookName(
  state: TavernState,
  type: string,
  hookName: string,
  offsetDays: number,
): TavernState {
  ensureServiceScheduledEventsRegistered()
  const definition = getScheduledEventDefinition(type)
  expect(definition, `no registered definition for ${type}`).toBeDefined()
  const adapted = definition!.fromFutureHook?.({
    hookName,
    readable: `a promise about ${hookName}`,
    scheduledForDay: state.calendar.totalDaysElapsed + offsetDays,
  })
  expect(adapted, `${type} declined the hook name ${hookName}`).toBeDefined()

  const slice = readScheduledEventsSlice(state)
  const scheduledForDay = state.calendar.totalDaysElapsed + offsetDays
  const record = {
    id: `test-${type}-${scheduledForDay}`,
    type,
    kind: 'mechanical' as const,
    ownerModuleId: definition!.ownerModuleId,
    exactOnceKey: definition!.exactOnceKey({
      type,
      ...(adapted!.target ? { target: adapted!.target } : {}),
      scheduledForDay,
      payload: adapted!.payload,
    }),
    ...(adapted!.target ? { target: adapted!.target } : {}),
    scheduledForDay,
    beat: definition!.beat,
    warnFromDay: scheduledForDay - definition!.warningWindowDays,
    expiresAfterDay: scheduledForDay + definition!.expiryDays,
    payload: adapted!.payload,
    status: 'scheduled' as const,
    occurrence: 1,
    createdOnDay: state.calendar.totalDaysElapsed,
    origin: {
      source: 'test.responses',
      readable: `a promise about ${hookName}`,
    },
  }
  return {
    ...state,
    modules: {
      ...state.modules,
      scheduledEvents: { ...slice, queue: [...slice.queue, record] },
    },
  }
}

/** Run days until the queued event of `type` produces an outcome. */
function runUntilResolved(
  state: TavernState,
  type: string,
  maxDays = 10,
  staffPriorities?: Record<string, string>,
): { state: TavernState; outcome: ReturnType<typeof outcomesFor>[number] | undefined } {
  let current = state
  for (let day = 0; day < maxDays; day += 1) {
    current = simulateDay(current, input(day, staffPriorities), FULL_PIPELINE).state
    const outcome = outcomesFor(current, type)[0]
    if (outcome) return { state: current, outcome }
  }
  return { state: current, outcome: undefined }
}

function outcomesFor(state: TavernState, type: string) {
  return readScheduledEventsSlice(state).archive.filter(
    (entry) => entry.type === type,
  )
}

describe('Phase 211 §4.4 — the service hook families are owned', () => {
  it('every one is registered by the service module with a payload schema', () => {
    ensureServiceScheduledEventsRegistered()
    expect(SERVICE_SCHEDULED_EVENTS.length).toBe(5)
    for (const definition of SERVICE_SCHEDULED_EVENTS) {
      const registered = getScheduledEventDefinition(definition.type)
      expect(registered, definition.type).toBeDefined()
      expect(registered!.ownerModuleId).toBe('service')
      expect(registered!.kind).toBe('mechanical')
      expect(registered!.payloadSchema).toBeDefined()
      // A warning the player can act on is the whole point of the window.
      expect(registered!.warningWindowDays).toBeGreaterThan(0)
      expect(registered!.futureHookPrefixes?.length).toBeGreaterThan(0)
    }
  })

  it('each claims the hook name its response profiles actually emit', () => {
    ensureServiceScheduledEventsRegistered()
    const cases: ReadonlyArray<[string, string]> = [
      [BRAWL_POSSIBLE_EVENT, 'brawl_possible'],
      [SECURITY_ROUTINE_EVENT, 'security_routine_possible'],
      [FOOD_POISONING_EVENT, 'food_poisoning_outbreak_miners'],
      [APOLOGY_EXPECTATION_EVENT, 'apology_expectation_merchants'],
      [BANNED_GROUP_RETURNS_EVENT, 'banned_group_returns_ogres'],
    ]
    for (const [type, hookName] of cases) {
      const definition = getScheduledEventDefinition(type)!
      const adapted = definition.fromFutureHook?.({
        hookName,
        readable: hookName,
        scheduledForDay: 5,
      })
      expect(adapted, `${type} should claim ${hookName}`).toBeDefined()
    }
  })
})

describe('Phase 211 §4.4 — brawl_possible', () => {
  it('fires into real damage when nobody is on the door', () => {
    let state = packedAndRowdy(stocked(withCoin(createInitialTavernState(), 400)))
    // Packed rowdy crowd, nobody on security: the promise has the same real
    // occupancy/rowdiness trigger as an immediate flow brawl.
    state = scheduleByHookName(state, BRAWL_POSSIBLE_EVENT, 'brawl_possible', 1)

    const damageBefore = state.areas['main_room']!.damage
    const { state: after, outcome } = runUntilResolved(state, BRAWL_POSSIBLE_EVENT)

    expect(outcome).toBeDefined()
    expect(outcome!.status).toBe('resolved')
    // §1.1 — a `resolved` outcome must name an authoritative mutation.
    expect(outcome!.mutations.length).toBeGreaterThan(0)
    expect(after.areas['main_room']!.damage).toBeGreaterThan(damageBefore)
  })

  it('is a no-op with a reason when somebody is on the door', () => {
    let state = stocked(withCoin(createInitialTavernState(), 400))
    state = withCustomerGroup(state, 'ogres', { patronage: 90, rowdiness: 95 })
    state = scheduleByHookName(state, BRAWL_POSSIBLE_EVENT, 'brawl_possible', 1)

    // The counterplay: one staff priority, given the way the player gives it.
    const { outcome } = runUntilResolved(state, BRAWL_POSSIBLE_EVENT, 10, {
      cleaner_bouncer: 'prevent_fights',
    })
    expect(outcome).toBeDefined()
    expect(outcome!.status).toBe('no_op')
    expect(outcome!.reason).toBeDefined()
    expect(outcome!.reason!.length).toBeGreaterThan(0)
    expect(outcome!.mutations.length).toBe(0)
  })

  it('is a no-op when a rowdy group never fills the room', () => {
    let state = stocked(withCoin(createInitialTavernState(), 400))
    for (const groupId of Object.keys(state.customerGroups)) {
      state = withCustomerGroup(state, groupId, {
        patronage: groupId === 'ogres' ? 1 : 0,
        rowdiness: groupId === 'ogres' ? 100 : 0,
      })
    }
    state = scheduleByHookName(state, BRAWL_POSSIBLE_EVENT, 'brawl_possible', 1)

    const { outcome } = runUntilResolved(state, BRAWL_POSSIBLE_EVENT)
    expect(outcome).toBeDefined()
    expect(outcome!.status).toBe('no_op')
    expect(outcome!.reason).toContain('rowdy and packed')
    expect(outcome!.mutations).toEqual([])
  })
})

describe('Phase 211 §4.4 — food_poisoning_outbreak_*', () => {
  it('makes the group that ate here ill', () => {
    let state = withCoin(createInitialTavernState(), 400)
    // A cellar the player let rot is what the promise was about.
    state = withStock(state, 'stew', { quantity: 200, quality: 5, spoilage: 90 })
    state = withStock(state, 'ale', { quantity: 200, quality: 10 })
    state = withStock(state, 'mushrooms', { quantity: 200, quality: 5, spoilage: 90 })
    state = scheduleByHookName(
      state,
      FOOD_POISONING_EVENT,
      'food_poisoning_outbreak_miners',
      1,
    )

    const before = state.customerGroups['miners']!.satisfaction
    const { state: after, outcome } = runUntilResolved(state, FOOD_POISONING_EVENT)

    expect(outcome).toBeDefined()
    expect(outcome!.status).toBe('resolved')
    expect(outcome!.mutations.length).toBeGreaterThan(0)
    expect(after.customerGroups['miners']!.satisfaction).toBeLessThan(before)
  })

  it('clearing the bad stock prevents it', () => {
    // Fresh, not merely plentiful: the resolver reads EFFECTIVE quality, so a
    // deep cellar of half-spoiled stew is still a cellar that will make people
    // ill. Clearing it is the counterplay, and this is what cleared looks like.
    let state = withCoin(createInitialTavernState(), 400)
    for (const stockId of ['ale', 'stew', 'mushrooms']) {
      state = withStock(state, stockId, {
        quantity: 2000,
        quality: 95,
        spoilage: 0,
      })
    }
    state = scheduleByHookName(
      state,
      FOOD_POISONING_EVENT,
      'food_poisoning_outbreak_miners',
      1,
    )
    const { outcome } = runUntilResolved(state, FOOD_POISONING_EVENT)
    expect(outcome).toBeDefined()
    expect(outcome!.status).toBe('no_op')
    expect(outcome!.reason).toContain('bad stock')
  })
})

describe('Phase 211 §4.4 — apology_expectation_*', () => {
  it('costs the group loyalty when the apology never comes', () => {
    let state = stocked(withCoin(createInitialTavernState(), 400))
    state = scheduleByHookName(
      state,
      APOLOGY_EXPECTATION_EVENT,
      'apology_expectation_merchants',
      1,
    )
    const before = state.customerGroups['merchants']!.loyalty
    const { state: after, outcome } = runUntilResolved(
      state,
      APOLOGY_EXPECTATION_EVENT,
    )

    expect(outcome).toBeDefined()
    expect(outcome!.status).toBe('resolved')
    expect(outcome!.mutations.length).toBeGreaterThan(0)
    expect(after.customerGroups['merchants']!.loyalty).toBeLessThan(before)
  })

  it('recognizes apologies that name the group or one of its regulars as actors', () => {
    const base = stocked(withCoin(createInitialTavernState(), 400))
    const regular = Object.values(base.world.regulars)[0]!
    const groupId = regular.customerGroupId
    const cases = [
      {
        id: `${groupId}_apology_all`,
        actors: [{ kind: 'customer_group' as const, id: groupId }],
        tags: ['customer', 'favorite_order', 'attribution'],
      },
      {
        id: 'regular_apologized_to_recently',
        actors: [{ kind: 'regular' as const, id: regular.id }],
        tags: ['owner_action', 'social'],
      },
    ]

    for (const apology of cases) {
      let state = scheduleByHookName(
        base,
        APOLOGY_EXPECTATION_EVENT,
        `apology_expectation_${groupId}`,
        1,
      )
      state = {
        ...state,
        memories: [
          ...state.memories,
          {
            id: apology.id,
            type: 'fact',
            strength: 80,
            ageDays: 0,
            createdAt: {
              year: state.calendar.year,
              month: state.calendar.month,
              week: state.calendar.week,
              day: state.calendar.day,
              absoluteDay: state.calendar.totalDaysElapsed,
            },
            actors: apology.actors,
            locations: [],
            relatedSystems: ['customers'],
            tags: apology.tags,
          },
        ],
      }
      const before = state.customerGroups[groupId]!.loyalty
      const { state: after, outcome } = runUntilResolved(
        state,
        APOLOGY_EXPECTATION_EVENT,
      )
      expect(outcome?.status, apology.id).toBe('cancelled')
      expect(after.customerGroups[groupId]!.loyalty, apology.id).toBe(before)
    }
  })
})

describe('Phase 211 §4.4 — banned_group_returns_* and security_routine', () => {
  it('a barred crowd drifts back, and patronage records it', () => {
    let state = stocked(withCoin(createInitialTavernState(), 400))
    state = withCustomerGroup(state, 'ogres', { patronage: 5 })
    state = scheduleByHookName(
      state,
      BANNED_GROUP_RETURNS_EVENT,
      'banned_group_returns_ogres',
      1,
    )
    const before = state.customerGroups['ogres']!.patronage
    const { state: after, outcome } = runUntilResolved(
      state,
      BANNED_GROUP_RETURNS_EVENT,
    )
    expect(outcome).toBeDefined()
    expect(outcome!.status).toBe('resolved')
    expect(after.customerGroups['ogres']!.patronage).toBeGreaterThan(before)
  })

  it('a door routine only settles in if somebody works it', () => {
    let worked = stocked(withCoin(createInitialTavernState(), 400))
    worked = scheduleByHookName(
      worked,
      SECURITY_ROUTINE_EVENT,
      'security_routine_possible',
      1,
    )
    const riskBefore = worked.areas['main_room']!.risk
    const workedRun = runUntilResolved(worked, SECURITY_ROUTINE_EVENT, 10, {
      cleaner_bouncer: 'prevent_fights',
    })
    expect(workedRun.outcome?.status).toBe('resolved')
    expect(workedRun.state.areas['main_room']!.risk).toBeLessThan(riskBefore)

    let unworked = stocked(withCoin(createInitialTavernState(), 400))
    unworked = scheduleByHookName(
      unworked,
      SECURITY_ROUTINE_EVENT,
      'security_routine_possible',
      1,
    )
    const unworkedRun = runUntilResolved(unworked, SECURITY_ROUTINE_EVENT)
    expect(unworkedRun.outcome?.status).toBe('no_op')
    expect(unworkedRun.outcome?.reason).toContain('door')
  })
})

describe('Phase 211 §1.1 — exactly once', () => {
  it('a resolved service event never fires twice', () => {
    let state = packedAndRowdy(stocked(withCoin(createInitialTavernState(), 400)))
    state = scheduleByHookName(state, BRAWL_POSSIBLE_EVENT, 'brawl_possible', 1)
    const { state: resolved } = runUntilResolved(state, BRAWL_POSSIBLE_EVENT)

    // Keep trading; the archive must not grow a second entry for it.
    let current = resolved
    for (let day = 0; day < 6; day += 1) {
      current = simulateDay(current, input(50 + day), FULL_PIPELINE).state
    }
    const fired = outcomesFor(current, BRAWL_POSSIBLE_EVENT).filter(
      (entry) => entry.status === 'resolved',
    )
    expect(fired.length).toBe(1)
  })
})
