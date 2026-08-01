// Expansion Phase 5 (repo phase 212) / ISSUE-175 — every economy future
// hook promised by existing response content has an owned, warned, exact-once
// mechanical resolution with live counterplay.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import {
  getScheduledEventDefinition,
  readScheduledEventsSlice,
} from '../../src/sim/contracts/scheduledEvents/index'
import type { ScheduledEventRecord } from '../../src/sim/contracts/scheduledEvents/types'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { MemoryState, TavernState } from '../../src/sim/state/TavernState'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import {
  ECONOMY_SCHEDULED_EVENTS,
  HOUSE_RULE_FRICTION_EVENT,
  POLICY_HELD_UNREST_EVENT,
  POLICY_PUNISHMENT_GRUDGE_EVENT,
  POLICY_REVERSAL_REMEMBERED_EVENT,
  PRICE_COMPLAINT_EVENT,
  RESERVES_INTACT_EVENT,
  ensureEconomyScheduledEventsRegistered,
} from '../../src/sim/modules/economy/economyEvents'
import { getEconomyModuleState } from '../../src/sim/modules/economy/state'

const SEED = 'phase212/economy-events'

const HOOK_CASES: ReadonlyArray<[string, string]> = [
  [HOUSE_RULE_FRICTION_EVENT, 'house_rule_friction_merchants'],
  [POLICY_HELD_UNREST_EVENT, 'policy_held_unrest_cheap_payday_specials'],
  [
    POLICY_PUNISHMENT_GRUDGE_EVENT,
    'policy_punishment_grudge_cheap_payday_specials',
  ],
  [
    POLICY_REVERSAL_REMEMBERED_EVENT,
    'policy_reversal_remembered_serve_miners_discount',
  ],
  [PRICE_COMPLAINT_EVENT, 'price_complaint_possible'],
  [RESERVES_INTACT_EVENT, 'reserves_intact_Y1-M1'],
]

function input(day: number, ownerActions?: SimInput['ownerActions']): SimInput {
  return {
    seed: `${SEED}-${day}`,
    ...(ownerActions ? { ownerActions } : {}),
  }
}

function scheduleByHookName(
  state: TavernState,
  type: string,
  hookName: string,
  offsetDays = 1,
): TavernState {
  ensureEconomyScheduledEventsRegistered()
  const definition = getScheduledEventDefinition(type)
  expect(definition, `no registered definition for ${type}`).toBeDefined()
  const scheduledForDay = state.calendar.totalDaysElapsed + offsetDays
  const adapted = definition!.fromFutureHook?.({
    hookName,
    readable: `a promise about ${hookName}`,
    scheduledForDay,
  })
  expect(adapted, `${type} declined ${hookName}`).toBeDefined()
  const slice = readScheduledEventsSlice(state)
  const record: ScheduledEventRecord = {
    id: `test-${type}-${scheduledForDay}`,
    type,
    kind: 'mechanical',
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
    status: 'scheduled',
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

function reserveMemory(monthKey: string): MemoryState {
  return {
    id: `reserves_held_${monthKey}`,
    type: 'timed',
    strength: 80,
    ageDays: 0,
    durationDays: 30,
    createdAt: {
      year: 1,
      month: 1,
      week: 1,
      day: 1,
      absoluteDay: 0,
    },
    actors: [],
    locations: [],
    relatedSystems: ['economy'],
    tags: ['economy', 'reserves', monthKey],
    source: 'test.monthly_response',
  }
}

function outcomesFor(state: TavernState, type: string) {
  return readScheduledEventsSlice(state).archive.filter(
    (entry) => entry.type === type,
  )
}

describe('Phase 212 §5.6 — economy hook families are owned', () => {
  it('registers all six as warned mechanical events with payload schemas', () => {
    ensureEconomyScheduledEventsRegistered()
    expect(ECONOMY_SCHEDULED_EVENTS).toHaveLength(6)
    for (const definition of ECONOMY_SCHEDULED_EVENTS) {
      const registered = getScheduledEventDefinition(definition.type)
      expect(registered, definition.type).toBeDefined()
      expect(registered!.ownerModuleId).toBe('economy')
      expect(registered!.kind).toBe('mechanical')
      expect(registered!.payloadSchema).toBeDefined()
      expect(registered!.warningWindowDays).toBeGreaterThan(0)
    }
  })

  it('claims every exact or prefix hook name emitted by response content', () => {
    ensureEconomyScheduledEventsRegistered()
    for (const [type, hookName] of HOOK_CASES) {
      const definition = getScheduledEventDefinition(type)!
      const adapted = definition.fromFutureHook?.({
        hookName,
        readable: hookName,
        scheduledForDay: 5,
      })
      expect(adapted, `${type} should claim ${hookName}`).toBeDefined()
      expect(definition.payloadSchema.safeParse(adapted!.payload).success).toBe(
        true,
      )
    }
  })
})

describe('Phase 212 §5.6 — delayed economy promises have real outcomes', () => {
  it('resolves every family into an authoritative mutation exactly once', () => {
    let state = withCoin(createInitialTavernState(), 500)
    state = withStock(state, 'ale', { quantity: 200, salePrice: 20 })
    state = { ...state, memories: [...state.memories, reserveMemory('Y1-M1')] }
    for (const [type, hookName] of HOOK_CASES) {
      state = scheduleByHookName(state, type, hookName)
    }

    const merchantPatronage = state.customerGroups['merchants']!.patronage
    state = simulateDay(state, input(1), FULL_PIPELINE).state
    state = simulateDay(state, input(2), FULL_PIPELINE).state

    for (const [type] of HOOK_CASES) {
      const outcomes = outcomesFor(state, type)
      expect(outcomes, type).toHaveLength(1)
      expect(outcomes[0]!.status, type).toBe('resolved')
      expect(outcomes[0]!.mutations.length, type).toBeGreaterThan(0)
    }
    expect(state.customerGroups['merchants']!.patronage).toBeLessThan(
      merchantPatronage,
    )
    expect(getEconomyModuleState(state).reserveStreak).toBe(1)

    state = simulateDay(state, input(3), FULL_PIPELINE).state
    for (const [type] of HOOK_CASES) {
      expect(outcomesFor(state, type), type).toHaveLength(1)
    }
  })

  it('re-reads live prices and policy state so counterplay cancels harm', () => {
    let prices = withCoin(createInitialTavernState(), 500)
    prices = withStock(prices, 'ale', { quantity: 200, salePrice: 20 })
    prices = scheduleByHookName(
      prices,
      PRICE_COMPLAINT_EVENT,
      'price_complaint_possible',
    )
    for (const item of Object.values(prices.stock)) {
      prices = withStock(prices, item.id, { salePrice: item.basePrice })
    }
    prices = simulateDay(prices, input(3), FULL_PIPELINE).state
    prices = simulateDay(prices, input(4), FULL_PIPELINE).state
    expect(outcomesFor(prices, PRICE_COMPLAINT_EVENT)[0]?.status).toBe('no_op')
    expect(outcomesFor(prices, PRICE_COMPLAINT_EVENT)[0]?.reason).toContain(
      'rolled back',
    )

    let policy = scheduleByHookName(
      createInitialTavernState(),
      POLICY_HELD_UNREST_EVENT,
      'policy_held_unrest_cheap_payday_specials',
    )
    policy = simulateDay(policy, input(5), FULL_PIPELINE).state
    policy = simulateDay(
      policy,
      input(6, [{ actionId: 'disable_cheap_payday_specials' }]),
      FULL_PIPELINE,
    ).state
    expect(outcomesFor(policy, POLICY_HELD_UNREST_EVENT)[0]?.status).toBe(
      'no_op',
    )
    expect(outcomesFor(policy, POLICY_HELD_UNREST_EVENT)[0]?.reason).toContain(
      'repealed',
    )
  })
})
