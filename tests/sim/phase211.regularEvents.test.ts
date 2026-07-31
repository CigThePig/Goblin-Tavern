// Expansion Phase 4 (repo phase 211) / ISSUE-174 — the three regular-subject
// hook families.
//
// `regular_favour_owed_*`, `regular_grudge_*` and `regular_word_credibility_*`
// each named a specific person and promised something about them, and none of
// them could happen: a regular had no relationship to draw on, no memory to
// hold a grudge in, and no way to affect anybody else's opinion. §4.3 gives all
// three something real to move — `ownerStanding`, the bounded `serviceMemory`,
// and `wordOfMouth` plus the group's patronage.
//
// Held to the same §1.1 contract as every other mechanical event: a registered
// owner, a warning window, a resolver that re-reads live state, an
// authoritative mutation on `resolved`, an explained no-op when the player
// dealt with it, and exactly once.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { RegularWorldState, TavernState } from '../../src/sim/state/TavernState'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import {
  getScheduledEventDefinition,
  readScheduledEventsSlice,
} from '../../src/sim/contracts/scheduledEvents/index'
import {
  REGULAR_FAVOUR_OWED_EVENT,
  REGULAR_GRUDGE_EVENT,
  REGULAR_SCHEDULED_EVENTS,
  REGULAR_WORD_CREDIBILITY_EVENT,
  ensureRegularScheduledEventsRegistered,
} from '../../src/sim/modules/regulars/regularEvents'

const SEED = 'phase211/regular-events'

function input(day: number): SimInput {
  return { seed: `${SEED}-d${day}` }
}

function stocked(state: TavernState): TavernState {
  return withStock(
    withStock(withStock(state, 'ale', { quantity: 3000, quality: 90, spoilage: 0 }), 'stew', {
      quantity: 3000,
      quality: 90,
      spoilage: 0,
    }),
    'mushrooms',
    { quantity: 3000, quality: 90, spoilage: 0 },
  )
}

/** A tavern that has been trading long enough for regulars to have a history. */
function tradedFor(days: number): TavernState {
  let state = withCoin(stocked(createInitialTavernState()), 800)
  for (let day = 0; day < days; day += 1) {
    state = withCoin(stocked(simulateDay(state, input(day), FULL_PIPELINE).state), 800)
  }
  return state
}

function pickRegular(state: TavernState): RegularWorldState {
  const regular = Object.values(state.world.regulars).sort((a, b) =>
    a.id.localeCompare(b.id),
  )[0]
  expect(regular).toBeDefined()
  return regular!
}

/** Queue an event by the hook NAME a response profile would emit. */
function scheduleByHookName(
  state: TavernState,
  type: string,
  hookName: string,
  offsetDays: number,
): TavernState {
  ensureRegularScheduledEventsRegistered()
  const definition = getScheduledEventDefinition(type)
  expect(definition, `no registered definition for ${type}`).toBeDefined()
  const scheduledForDay = state.calendar.totalDaysElapsed + offsetDays
  const adapted = definition!.fromFutureHook?.({
    hookName,
    readable: `a promise about ${hookName}`,
    scheduledForDay,
  })
  expect(adapted, `${type} declined the hook name ${hookName}`).toBeDefined()

  const slice = readScheduledEventsSlice(state)
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

function outcomesFor(state: TavernState, type: string) {
  return readScheduledEventsSlice(state).archive.filter(
    (entry) => entry.type === type,
  )
}

function runUntilResolved(
  state: TavernState,
  type: string,
  maxDays = 10,
): { state: TavernState; outcome: ReturnType<typeof outcomesFor>[number] | undefined } {
  let current = state
  for (let day = 0; day < maxDays; day += 1) {
    current = withCoin(
      stocked(simulateDay(current, input(100 + day), FULL_PIPELINE).state),
      800,
    )
    const outcome = outcomesFor(current, type)[0]
    if (outcome) return { state: current, outcome }
  }
  return { state: current, outcome: undefined }
}

describe('Phase 211 §4.3 — the regular hook families are owned', () => {
  it('all three are registered by the regulars module with a warning window', () => {
    ensureRegularScheduledEventsRegistered()
    expect(REGULAR_SCHEDULED_EVENTS.length).toBe(3)
    for (const definition of REGULAR_SCHEDULED_EVENTS) {
      const registered = getScheduledEventDefinition(definition.type)
      expect(registered, definition.type).toBeDefined()
      expect(registered!.ownerModuleId).toBe('regulars')
      expect(registered!.kind).toBe('mechanical')
      expect(registered!.warningWindowDays).toBeGreaterThan(0)
      // A per-person family has to carry its subject in the hook name.
      expect(registered!.futureHookPrefixes?.[0]).toMatch(/_$/)
    }
  })

  it('each claims the per-person hook name and turns it into a payload', () => {
    ensureRegularScheduledEventsRegistered()
    const cases: ReadonlyArray<[string, string]> = [
      [REGULAR_FAVOUR_OWED_EVENT, 'regular_favour_owed_grulk'],
      [REGULAR_GRUDGE_EVENT, 'regular_grudge_grulk'],
      [REGULAR_WORD_CREDIBILITY_EVENT, 'regular_word_credibility_grulk'],
    ]
    for (const [type, hookName] of cases) {
      const definition = getScheduledEventDefinition(type)!
      const adapted = definition.fromFutureHook?.({
        hookName,
        readable: hookName,
        scheduledForDay: 5,
      })
      expect(adapted, type).toBeDefined()
      expect(adapted!.payload).toEqual({ regularId: 'grulk' })
      expect(adapted!.target).toEqual({ kind: 'regular', id: 'grulk' })
    }
  })
})

describe('Phase 211 §4.3 — regular_favour_owed_*', () => {
  it('is repaid by bringing their crowd in', () => {
    const traded = tradedFor(6)
    const regular = pickRegular(traded)
    const state = scheduleByHookName(
      traded,
      REGULAR_FAVOUR_OWED_EVENT,
      `regular_favour_owed_${regular.id}`,
      1,
    )
    const patronageBefore = state.customerGroups[regular.customerGroupId]!.patronage

    const { state: after, outcome } = runUntilResolved(state, REGULAR_FAVOUR_OWED_EVENT)
    expect(outcome).toBeDefined()
    if (outcome!.status === 'resolved') {
      expect(outcome!.mutations.length).toBeGreaterThan(0)
      expect(
        after.customerGroups[regular.customerGroupId]!.patronage,
      ).toBeGreaterThan(patronageBefore)
    } else {
      // The only other honest ending is an explained no-op.
      expect(outcome!.status).toBe('no_op')
      expect(outcome!.reason?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('is a no-op with a reason when their standing has been spent', () => {
    const traded = tradedFor(6)
    const regular = pickRegular(traded)
    // Somebody who thinks nothing of the owner does not feel they owe them.
    // Standing is what `collect_tab` spends, so this is a reachable state.
    const soured: TavernState = {
      ...traded,
      world: {
        ...traded.world,
        regulars: {
          ...traded.world.regulars,
          [regular.id]: { ...regular, ownerStanding: 20 },
        },
      },
    }
    const state = scheduleByHookName(
      soured,
      REGULAR_FAVOUR_OWED_EVENT,
      `regular_favour_owed_${regular.id}`,
      1,
    )
    const { outcome } = runUntilResolved(state, REGULAR_FAVOUR_OWED_EVENT)
    expect(outcome).toBeDefined()
    expect(outcome!.status).toBe('no_op')
    expect(outcome!.reason).toContain('owe')
    expect(outcome!.mutations.length).toBe(0)
  })
})

describe('Phase 211 §4.3 — regular_grudge_*', () => {
  it('ends with them staying away, with a reason on the record', () => {
    const traded = tradedFor(6)
    const regular = pickRegular(traded)
    // A grudge only lands if their memory of the place is still sour.
    const sour: TavernState = {
      ...traded,
      world: {
        ...traded.world,
        regulars: {
          ...traded.world.regulars,
          [regular.id]: {
            ...regular,
            irritation: 80,
            serviceMemory: [
              {
                onDay: traded.calendar.totalDaysElapsed,
                kind: 'abandoned' as const,
                weight: -5,
                readable: 'They walked out unserved.',
              },
            ],
          },
        },
      },
    }
    const state = scheduleByHookName(
      sour,
      REGULAR_GRUDGE_EVENT,
      `regular_grudge_${regular.id}`,
      1,
    )

    const { state: after, outcome } = runUntilResolved(state, REGULAR_GRUDGE_EVENT)
    expect(outcome).toBeDefined()
    expect(outcome!.status).toBe('resolved')
    expect(outcome!.mutations.length).toBeGreaterThan(0)
    const lapsed = after.world.regulars[regular.id]!
    expect(lapsed.stoppedVisiting).toBeDefined()
    expect(lapsed.stoppedVisiting!.reason.length).toBeGreaterThan(0)
  })

  it('is cancelled when the player squared up with them first', () => {
    const traded = tradedFor(6)
    const regular = pickRegular(traded)
    const mended: TavernState = {
      ...traded,
      world: {
        ...traded.world,
        regulars: {
          ...traded.world.regulars,
          [regular.id]: {
            ...regular,
            irritation: 80,
            // A wiped slate is exactly what `forgive_tab` records.
            serviceMemory: [
              {
                onDay: traded.calendar.totalDaysElapsed,
                kind: 'tab_forgiven' as const,
                weight: 6,
                readable: 'You wiped their slate.',
              },
            ],
          },
        },
      },
    }
    const state = scheduleByHookName(
      mended,
      REGULAR_GRUDGE_EVENT,
      `regular_grudge_${regular.id}`,
      1,
    )
    const { state: after, outcome } = runUntilResolved(state, REGULAR_GRUDGE_EVENT)
    expect(outcome).toBeDefined()
    expect(outcome!.status).toBe('cancelled')
    expect(outcome!.reason?.length ?? 0).toBeGreaterThan(0)
    expect(after.world.regulars[regular.id]!.stoppedVisiting).toBeUndefined()
  })
})

describe('Phase 211 §4.3 — regular_word_credibility_*', () => {
  it("carries in the direction their own record points", () => {
    const traded = tradedFor(6)
    const regular = pickRegular(traded)
    const bitter: TavernState = {
      ...traded,
      world: {
        ...traded.world,
        regulars: {
          ...traded.world.regulars,
          [regular.id]: {
            ...regular,
            ownerStanding: 20,
            serviceMemory: [
              {
                onDay: traded.calendar.totalDaysElapsed,
                kind: 'turned_away' as const,
                weight: -6,
                readable: 'They were turned away from a full room.',
              },
            ],
          },
        },
      },
    }
    const state = scheduleByHookName(
      bitter,
      REGULAR_WORD_CREDIBILITY_EVENT,
      `regular_word_credibility_${regular.id}`,
      1,
    )
    const before = state.customerGroups[regular.customerGroupId]!.patronage

    const { state: after, outcome } = runUntilResolved(
      state,
      REGULAR_WORD_CREDIBILITY_EVENT,
    )
    expect(outcome).toBeDefined()
    expect(outcome!.status).toBe('resolved')
    expect(outcome!.mutations.length).toBeGreaterThan(0)
    // Their word moved the crowd, downward, and the counter records it.
    expect(after.customerGroups[regular.customerGroupId]!.patronage).toBeLessThan(
      before,
    )
    expect(
      after.world.regulars[regular.id]!.wordOfMouth!.criticisms,
    ).toBeGreaterThan(regular.wordOfMouth?.criticisms ?? 0)
  })
})

describe('Phase 211 §1.1 — exactly once', () => {
  it('a resolved regular event never fires twice', () => {
    const traded = tradedFor(6)
    const regular = pickRegular(traded)
    const state = scheduleByHookName(
      traded,
      REGULAR_WORD_CREDIBILITY_EVENT,
      `regular_word_credibility_${regular.id}`,
      1,
    )
    const { state: resolved } = runUntilResolved(
      state,
      REGULAR_WORD_CREDIBILITY_EVENT,
    )

    let current = resolved
    for (let day = 0; day < 6; day += 1) {
      current = withCoin(
        stocked(simulateDay(current, input(200 + day), FULL_PIPELINE).state),
        800,
      )
    }
    const fired = outcomesFor(current, REGULAR_WORD_CREDIBILITY_EVENT)
    expect(fired.length).toBe(1)
  })
})
