// Expansion Phase 9 §9.1 (repo phase 216) / ISSUE-179 — four hook families
// stop draining and start happening.
//
// The implementation ledger carries four `HOOK-*` rows that belong to the
// rival layer, and all four were the same `OBL-02` failure: a response
// profile told the player the rival would hit back for the poaching, that
// it would grow if it were left alone, that the word they put about might be
// traced back, or that the arrangement they struck would come up again —
// and the responses module drained the hook into a zero-weight cause,
// because no domain owned the string.
//
//   HOOK-rival_retaliation_*        → rival_retaliation
//   HOOK-rival_dominance_*          → rival_dominance_review
//   HOOK-rival_rumour_exposed_*     → rival_rumour_exposed
//   HOOK-rival_settlement_pact_*    → rival_pact_review
//
// These tests check both halves of keeping a promise: the bridge routes the
// name to an owner, AND the resolver produces an authoritative mutation
// rather than a cause. They also check the ways it is correct NOT to fire,
// because an explained no-op is right behaviour and an unexplained one is
// the bug this arc exists to stop.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { SocialRumourState, TavernState } from '../../src/sim/state/TavernState'
import { withArea, withCoin, withStock } from '../../src/sim/testing/stateFactories'
import { findScheduledEventDefinitionForHookName } from '../../src/sim/contracts/scheduledEvents/registry'
import {
  readScheduledEventsSlice,
  scheduleEvent,
} from '../../src/sim/contracts/scheduledEvents/state'
import {
  PRIMARY_RIVAL_ID,
  RIVAL_DOMINANCE_REVIEW_EVENT,
  RIVAL_PACT_REVIEW_EVENT,
  RIVAL_PRICE_WAR_EVENT,
  RIVAL_QUALITY_RACE_EVENT,
  RIVAL_RETALIATION_EVENT,
  RIVAL_RUMOUR_EXPOSED_EVENT,
  RIVAL_SCHEDULED_EVENT_TYPES,
  getPrimaryRival,
  getRivalModuleState,
  scheduleRivalPactReview,
  scheduleRivalRetaliation,
} from '../../src/sim/modules/rival/index'

const SEED = 'phase216/rival-events'

type Module = Parameters<typeof simulateDay>[2][number]
type SetupHook = (ctx: import('../../src/sim/core/context').SimContext) => void

function run(
  state: TavernState,
  day: number,
  ownerActions: NonNullable<SimInput['ownerActions']> = [],
): TavernState {
  return simulateDay(state, { seed: `${SEED}/${day}`, ownerActions }, FULL_PIPELINE).state
}

function runDays(state: TavernState, days: number, from = 0): TavernState {
  let current = state
  for (let day = 0; day < days; day += 1) current = run(current, from + day)
  return current
}

/** Run one day with the real pipeline plus a one-shot setup hook. */
function withSetup(state: TavernState, tag: string, setup: SetupHook): TavernState {
  return simulateDay(state, { seed: `${SEED}/${tag}` }, [
    ...FULL_PIPELINE,
    { id: `test_${tag}`, version: '1.0.0', hooks: { startDay: [setup] } } as Module,
  ]).state
}

function trading(coin = 2000): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 600, spoilage: 0 })
  }
  return state
}

function neglected(coin = 2000): TavernState {
  let state = trading(coin)
  state = withArea(state, 'main_room', { cleanliness: 5, damage: 70, smell: 90 })
  state = withArea(state, 'kitchen', { cleanliness: 5, damage: 40, smell: 95 })
  return state
}

function outcomesFor(state: TavernState, type: string) {
  const slice = readScheduledEventsSlice(state)
  return [...slice.resolvedToday, ...slice.archive].filter(
    (outcome) => outcome.type === type,
  )
}

describe('Phase 216 §9.1 — the bridge routes the rival hook families to an owner', () => {
  it('claims all four names for the rival module', () => {
    const claims: Array<[string, string]> = [
      ['rival_retaliation_rival_expansion_1', RIVAL_RETALIATION_EVENT],
      ['rival_dominance_rival_tavern', RIVAL_DOMINANCE_REVIEW_EVENT],
      ['rival_rumour_exposed_rival_tavern', RIVAL_RUMOUR_EXPOSED_EVENT],
      ['rival_settlement_pact_y1m3', RIVAL_PACT_REVIEW_EVENT],
    ]
    for (const [hookName, expected] of claims) {
      const definition = findScheduledEventDefinitionForHookName(hookName)
      expect(definition?.type, hookName).toBe(expected)
      expect(definition?.ownerModuleId, hookName).toBe('rival')
      expect(definition?.kind, hookName).toBe('mechanical')
    }
  })

  it('registers exactly the types it declares', () => {
    // Four from §9.1, plus the two competitive families the phase-9 tail
    // added: `rival_price_war` and `rival_quality_race`. They are separate
    // from `rival_retaliation` because they answer a COMMERCIAL move the
    // house made rather than a provocation, so each carries its own
    // counterplay — a house that has taken its margin back is not in a
    // price war, and a rival already a match on quality is not chasing one.
    // Their own coverage is in `phase216.hookClosure.test.ts`.
    expect([...RIVAL_SCHEDULED_EVENT_TYPES].sort()).toEqual([
      RIVAL_DOMINANCE_REVIEW_EVENT,
      RIVAL_PACT_REVIEW_EVENT,
      RIVAL_PRICE_WAR_EVENT,
      RIVAL_QUALITY_RACE_EVENT,
      RIVAL_RETALIATION_EVENT,
      RIVAL_RUMOUR_EXPOSED_EVENT,
    ].sort())
  })

  it('declines a hook when there is no rival to point it at', () => {
    // A state whose rival record has never been opened cannot be the subject
    // of a rival event. Declining is the correct answer; inventing a house
    // to punish would be the bug.
    const definition = findScheduledEventDefinitionForHookName('rival_dominance_rival_tavern')!
    const bare = createInitialTavernState()
    expect(
      definition.fromFutureHook?.({
        hookName: 'rival_dominance_rival_tavern',
        readable: 'Left to it.',
        scheduledForDay: 1,
        state: bare,
      }),
    ).toBeUndefined()
  })
})

describe('Phase 216 §9.1 — rival_retaliation hands the answer back to the rival', () => {
  it('resolves into a real move rather than a cause', () => {
    let state = runDays(neglected(), 10)
    state = withSetup(state, 'retaliate', (ctx) => {
      scheduleRivalRetaliation(ctx, {
        provocation: 'poached',
        source: 'test',
        readable: 'They know where their cook went.',
        offsetDays: 1,
      })
    })
    const movesBefore = getRivalModuleState(state).moveHistory.length
    state = runDays(state, 4, 20)

    const outcomes = outcomesFor(state, RIVAL_RETALIATION_EVENT)
    expect(outcomes.length, 'the retaliation never fired').toBeGreaterThan(0)
    const outcome = outcomes[0]!
    expect(['resolved', 'no_op']).toContain(outcome.status)
    if (outcome.status === 'resolved') {
      // An authoritative mutation, not a zero-weight cause.
      expect(outcome.mutations?.length ?? 0).toBeGreaterThan(0)
      expect(getRivalModuleState(state).moveHistory.length).toBeGreaterThan(movesBefore)
    } else {
      // And when it does nothing, it says why.
      expect(outcome.reason?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('lets an arrangement bought inside the window call it off', () => {
    let state = runDays(trading(4000), 10)
    state = withSetup(state, 'retaliate_truce', (ctx) => {
      scheduleRivalRetaliation(ctx, {
        provocation: 'poached',
        source: 'test',
        readable: 'They know where their cook went.',
        offsetDays: 3,
      })
    })
    state = run(state, 30, [{ actionId: 'settle_with_rival', targetId: PRIMARY_RIVAL_ID }])
    state = runDays(state, 4, 31)

    const outcomes = outcomesFor(state, RIVAL_RETALIATION_EVENT)
    expect(outcomes.length).toBeGreaterThan(0)
    expect(outcomes[0]!.status).toBe('no_op')
    expect(outcomes[0]!.reason).toMatch(/arrangement/)
  })

  it('will not stack a second answer while one is already coming', () => {
    let state = runDays(neglected(), 10)
    let secondAccepted = true
    state = withSetup(state, 'retaliate_twice', (ctx) => {
      scheduleRivalRetaliation(ctx, {
        provocation: 'poached',
        source: 'test',
        readable: 'first',
        offsetDays: 5,
      })
      secondAccepted = scheduleRivalRetaliation(ctx, {
        provocation: 'rumour',
        source: 'test',
        readable: 'second',
        offsetDays: 5,
      })
    })
    expect(secondAccepted).toBe(false)
    const queued = readScheduledEventsSlice(state).queue.filter(
      (event) => event.type === RIVAL_RETALIATION_EVENT,
    )
    expect(queued.length).toBe(1)
  })
})

describe('Phase 216 §9.1 — rival_dominance_review pays only if they were left ahead', () => {
  it('makes an unopposed rival materially better at it', () => {
    let state = runDays(neglected(), 30)
    const definition = findScheduledEventDefinitionForHookName('rival_dominance_rival_tavern')!
    expect(definition.type).toBe(RIVAL_DOMINANCE_REVIEW_EVENT)
    const reachBefore = getPrimaryRival(state)!.capability.reach

    state = withSetup(state, 'dominance', (ctx) => {
      const today = ctx.state.calendar.totalDaysElapsed
      // Routed through the definition's OWN bridge, so the test exercises
      // the same translation the responses module performs.
      const bridge = definition.fromFutureHook!({
        hookName: 'rival_dominance_rival_tavern',
        readable: 'Left to it for a fortnight.',
        scheduledForDay: today + 1,
        state: ctx.state,
      })!
      scheduleEvent(ctx, {
        type: RIVAL_DOMINANCE_REVIEW_EVENT,
        ...(bridge.target ? { target: bridge.target } : {}),
        scheduledForDay: today + 1,
        payload: bridge.payload,
        origin: { source: 'test', readable: 'Left to it for a fortnight.' },
      })
    })
    state = runDays(state, 3, 40)

    const outcomes = outcomesFor(state, RIVAL_DOMINANCE_REVIEW_EVENT)
    expect(outcomes.length, 'the review never fired').toBeGreaterThan(0)
    const outcome = outcomes[0]!
    if (outcome.status === 'resolved') {
      expect(outcome.mutations?.length ?? 0).toBeGreaterThan(0)
      expect(getPrimaryRival(state)!.capability.reach).toBeGreaterThan(reachBefore)
    } else {
      expect(outcome.status).toBe('no_op')
      expect(outcome.reason?.length ?? 0).toBeGreaterThan(0)
    }
  })
})

describe('Phase 216 §9.1 — rival_rumour_exposed brings the word home', () => {
  it('puts the tavern\'s own counter-rumour right, and they answer for it', () => {
    let state = runDays(trading(), 8)
    const rival = getPrimaryRival(state)!

    // The house has put a word about them. Both traces the real response
    // leaves: the MEMORY `spread_counter_rumour` writes — which is the
    // evidence the resolver keys on, because that profile creates no
    // rumour record of its own — and a rumour in the store, so the
    // correction half has something to correct.
    state = withSetup(state, 'counter_rumour', (ctx) => {
      const today = ctx.state.calendar.totalDaysElapsed
      ctx.addMemory({
        id: `rival_counter_rumour_${rival.id}`,
        label: 'The house put a story about the competition.',
        actors: [{ kind: 'system', id: rival.id }],
        tags: ['rival', 'rumour', 'counter'],
      })
      const rumour: SocialRumourState = {
        id: 'house_word_about_rival',
        label: `Somebody has been saying ${rival.name} waters the ale.`,
        strength: 55,
        accuracy: 'false',
        firstHeardDay: today,
        lastSpreadDay: today,
        tags: ['rival', 'competition', 'rumour'],
        reach: 'public',
        involvedRefs: [{ kind: 'system', id: rival.id }],
      }
      ctx.addSocialRumour(rumour, {
        source: 'test.counter_rumour',
        sourceType: 'system',
        target: rumour.id,
        targetType: 'rumour',
        amount: rumour.strength,
        readable: 'The house put a word about the competition.',
        tags: ['rival', 'rumour'],
      })
      scheduleEvent(ctx, {
        type: RIVAL_RUMOUR_EXPOSED_EVENT,
        target: { kind: 'system', id: rival.id },
        scheduledForDay: today + 1,
        payload: { rivalId: rival.id },
        origin: { source: 'test', readable: 'Counter-rumour may be exposed.' },
      })
    })
    state = runDays(state, 3, 30)

    const outcomes = outcomesFor(state, RIVAL_RUMOUR_EXPOSED_EVENT)
    expect(outcomes.length, 'the exposure never fired').toBeGreaterThan(0)
    const outcome = outcomes[0]!
    expect(outcome.status).toBe('resolved')
    expect(outcome.mutations?.length ?? 0).toBeGreaterThan(0)

    const rumour = state.world.socialRumours['house_word_about_rival']!
    expect(rumour.correctedOnDay).toBeDefined()
    expect(rumour.accuracy).toBe('false')
    expect(rumour.strength).toBeLessThan(55)

    // And it is not a punishment out of nowhere: they decide what to do.
    const queued = readScheduledEventsSlice(state).queue.filter(
      (event) => event.type === RIVAL_RETALIATION_EVENT,
    )
    const answered = outcomesFor(state, RIVAL_RETALIATION_EVENT)
    expect(queued.length + answered.length).toBeGreaterThan(0)
  })

  it('says so when there is no longer a word to be caught at', () => {
    let state = runDays(trading(), 8)
    const rival = getPrimaryRival(state)!
    state = withSetup(state, 'nothing_to_expose', (ctx) => {
      scheduleEvent(ctx, {
        type: RIVAL_RUMOUR_EXPOSED_EVENT,
        target: { kind: 'system', id: rival.id },
        scheduledForDay: ctx.state.calendar.totalDaysElapsed + 1,
        payload: { rivalId: rival.id },
        origin: { source: 'test', readable: 'Counter-rumour may be exposed.' },
      })
    })
    state = runDays(state, 3, 30)
    const outcomes = outcomesFor(state, RIVAL_RUMOUR_EXPOSED_EVENT)
    expect(outcomes.length).toBeGreaterThan(0)
    expect(outcomes[0]!.status).toBe('no_op')
    // The house never put any word about, so there is nothing to be caught
    // at — which is a different sentence from "it faded", and the honest one.
    expect(outcomes[0]!.reason).toMatch(/never put any word about/)
  })
})

describe('Phase 216 §9.1 — rival_pact_review reopens the arrangement', () => {
  it('is scheduled by settling, and decides on the head-to-head when it fires', () => {
    let state = runDays(trading(4000), 8)
    state = run(state, 20, [{ actionId: 'settle_with_rival', targetId: PRIMARY_RIVAL_ID }])
    const truceUntil = getPrimaryRival(state)!.truceUntilDay!
    expect(
      readScheduledEventsSlice(state).queue.some(
        (event) => event.type === RIVAL_PACT_REVIEW_EVENT,
      ),
    ).toBe(true)

    let current = state
    for (let day = 21; day < 50; day += 1) current = run(current, day)

    const outcomes = outcomesFor(current, RIVAL_PACT_REVIEW_EVENT)
    expect(outcomes.length, 'the arrangement never came up again').toBeGreaterThan(0)
    const outcome = outcomes[0]!
    expect(outcome.status).toBe('resolved')
    expect(outcome.mutations?.length ?? 0).toBeGreaterThan(0)

    const rival = getPrimaryRival(current)!
    // Either they renewed it (a later date) or they walked away (none).
    expect(
      rival.truceUntilDay === undefined || rival.truceUntilDay > truceUntil,
      'the review fired and left the arrangement exactly as it was',
    ).toBe(true)
  })

  it('will not queue two reviews for one arrangement', () => {
    let state = runDays(trading(4000), 8)
    let second = true
    state = withSetup(state, 'pact_twice', (ctx) => {
      scheduleRivalPactReview(ctx, { source: 'test', readable: 'first', offsetDays: 10 })
      second = scheduleRivalPactReview(ctx, {
        source: 'test',
        readable: 'second',
        offsetDays: 10,
      })
    })
    expect(second).toBe(false)
    expect(
      readScheduledEventsSlice(state).queue.filter(
        (event) => event.type === RIVAL_PACT_REVIEW_EVENT,
      ).length,
    ).toBe(1)
  })
})
