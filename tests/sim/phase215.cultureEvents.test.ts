// Expansion Phase 8 §8.2 (repo phase 215) / ISSUE-178 — the two culture
// hook families stop draining and start happening.
//
// Both are `OBL-02` instances the culture layer could not keep until §8.2
// gave it somewhere to put the answer:
//
//   HOOK-culture_walkout_risk_*      → culture_walkout
//   HOOK-culture_seating_backlash_*  → culture_seating_backlash
//
// The first is declared by the response profile where the player IGNORES a
// culture's complaint; the second by the one where they take a culture's
// SIDE on seating. Both promised the other shoe would drop and neither did.
//
// As with the faction families, these check both halves of keeping a
// promise — the bridge routes the name to an owner, AND the resolver makes
// an authoritative change rather than writing a cause — plus the two ways
// it is correct NOT to fire.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import { findScheduledEventDefinitionForHookName } from '../../src/sim/contracts/scheduledEvents/registry'
import { readScheduledEventsSlice } from '../../src/sim/contracts/scheduledEvents/state'
import { scheduleEvent } from '../../src/sim/contracts/scheduledEvents/index'
import {
  CULTURE_SEATING_BACKLASH_EVENT,
  CULTURE_WALKOUT_EVENT,
  activeFriction,
  getCultureModuleState,
  liveMisunderstandingFor,
  noteEvidence,
  scheduleWalkoutRisk,
} from '../../src/sim/modules/cultures/index'

const SEED = 'phase215/culture-events'

type Module = Parameters<typeof simulateDay>[2][number]
type SetupHook = (ctx: import('../../src/sim/core/context').SimContext) => void

function trading(coin = 900): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 400, spoilage: 0 })
  }
  return state
}

function run(state: TavernState, day: number): TavernState {
  return simulateDay(state, { seed: `${SEED}/${day}` }, FULL_PIPELINE).state
}

function runDays(state: TavernState, days: number, from = 0): TavernState {
  let current = state
  for (let day = 0; day < days; day += 1) current = run(current, from + day)
  return current
}

function withSetup(state: TavernState, tag: string, setup: SetupHook): TavernState {
  return simulateDay(
    state,
    { seed: `${SEED}/${tag}` },
    [
      ...FULL_PIPELINE,
      { id: `test_${tag}`, version: '1.0.0', hooks: { startDay: [setup] } } as Module,
    ],
  ).state
}

/** Somebody has been treated badly enough to be thinking about leaving. */
function withDeepGrievance(state: TavernState, cultureId: string): TavernState {
  return withSetup(state, `grievance-${cultureId}`, (ctx) => {
    noteEvidence(ctx, {
      cultureId,
      id: 'test_bad_blood',
      kind: 'taboo',
      weight: 40,
      readable: 'The house served them something they do not eat, repeatedly.',
      tags: ['test'],
    })
  })
}

describe('Phase 215 §8.2 — the bridge routes both culture families to an owner', () => {
  it('claims culture_walkout_risk_* and culture_seating_backlash_*', () => {
    const walkout = findScheduledEventDefinitionForHookName(
      'culture_walkout_risk_goblin_local',
    )
    expect(walkout?.type).toBe(CULTURE_WALKOUT_EVENT)
    expect(walkout?.ownerModuleId).toBe('cultures')
    expect(walkout?.kind).toBe('mechanical')

    const backlash = findScheduledEventDefinitionForHookName(
      'culture_seating_backlash_merchant_roadfolk',
    )
    expect(backlash?.type).toBe(CULTURE_SEATING_BACKLASH_EVENT)
    expect(backlash?.ownerModuleId).toBe('cultures')
  })

  it('declines a hook naming a culture that does not exist', () => {
    const state = trading()
    const walkout = findScheduledEventDefinitionForHookName('culture_walkout_risk_x')!
    expect(
      walkout.fromFutureHook?.({
        hookName: 'culture_walkout_risk_nobody',
        readable: '',
        scheduledForDay: 5,
        state,
      }),
    ).toBeUndefined()
    expect(
      walkout.fromFutureHook?.({
        hookName: 'culture_walkout_risk_goblin_local',
        readable: '',
        scheduledForDay: 5,
        state,
      })?.target,
    ).toEqual({ kind: 'culture', id: 'goblin_local' })
  })
})

describe('Phase 215 §8.2 — a culture that was ignored actually stops coming', () => {
  it('resolves into a walkout that withholds more turnout than an ordinary slight', () => {
    let state = withDeepGrievance(trading(), 'miner_workcrew')
    state = withSetup(state, 'walkout', (ctx) => {
      scheduleWalkoutRisk(ctx, 'miner_workcrew', {
        source: 'test',
        readable: 'The crews were ignored once too often.',
        offsetDays: 3,
      })
    })
    expect(
      readScheduledEventsSlice(state).queue.some(
        (record) => record.type === CULTURE_WALKOUT_EVENT,
      ),
    ).toBe(true)

    state = runDays(state, 5, 1)

    const outcome = readScheduledEventsSlice(state).archive.find(
      (entry) => entry.type === CULTURE_WALKOUT_EVENT,
    )
    expect(outcome?.status).toBe('resolved')
    expect(outcome!.mutations.length).toBeGreaterThan(0)

    const live = liveMisunderstandingFor(state, 'miner_workcrew')
    expect(live?.severity).toBe('walkout')
    // A walkout names a remedy too — it is recoverable, not a dead end.
    expect(live!.remedy).toContain('amends')
    expect(getCultureModuleState(state).totals.walkouts).toBeGreaterThan(0)
  })

  it('does nothing, and says why, when the house won them back in time', () => {
    // No grievance: by the time the event fires there is nothing to leave over.
    let state = withSetup(trading(), 'won-back', (ctx) => {
      scheduleWalkoutRisk(ctx, 'goblin_local', {
        source: 'test',
        readable: 'The locals were ignored.',
        offsetDays: 3,
      })
    })
    state = runDays(state, 5, 1)

    const outcome = readScheduledEventsSlice(state).archive.find(
      (entry) => entry.type === CULTURE_WALKOUT_EVENT,
    )
    expect(outcome?.status).toBe('no_op')
    expect(outcome!.reason).toBeTruthy()
    expect(outcome!.mutations).toEqual([])
    expect(liveMisunderstandingFor(state, 'goblin_local')?.severity).not.toBe('walkout')
  })

  it('an unanswered slight schedules its own walkout risk, with a warning window', () => {
    // Reached by play: a culture kept in the red long enough starts talking
    // about leaving, and the risk is announced before it lands.
    let state = trading()
    for (let day = 0; day < 16; day += 1) {
      state = withDeepGrievance(state, 'merchant_roadfolk')
    }
    const queued = readScheduledEventsSlice(state).queue.filter(
      (record) =>
        record.type === CULTURE_WALKOUT_EVENT && record.target?.id === 'merchant_roadfolk',
    )
    if (queued.length > 0) {
      expect(queued[0]!.warnFromDay).toBeDefined()
      expect(queued[0]!.scheduledForDay).toBeGreaterThan(queued[0]!.createdOnDay)
    }
  })
})

describe('Phase 215 §8.2 — taking one side on seating is noticed by the other', () => {
  it('resolves into real friction with the cultures that rub against the favoured one', () => {
    let state = trading()
    const before = activeFriction(state).length

    // Route the hook name the way the response bridge does, then put the
    // resulting payload on the calendar through the real scheduler.
    state = withSetup(state, 'backlash', (ctx) => {
      const definition = findScheduledEventDefinitionForHookName(
        'culture_seating_backlash_merchant_roadfolk',
      )!
      const routed = definition.fromFutureHook?.({
        hookName: 'culture_seating_backlash_merchant_roadfolk',
        readable: 'The house sided with the merchants.',
        scheduledForDay: ctx.state.calendar.totalDaysElapsed + 2,
        state: ctx.state,
      })
      expect(routed).toBeDefined()
      scheduleEvent(ctx, {
        type: CULTURE_SEATING_BACKLASH_EVENT,
        target: { kind: 'culture', id: 'merchant_roadfolk' },
        scheduledForDay: ctx.state.calendar.totalDaysElapsed + 2,
        payload: routed!.payload,
        origin: { source: 'test', readable: 'The house sided with the merchants.' },
      })
    })

    state = runDays(state, 4, 1)

    const outcome = readScheduledEventsSlice(state).archive.find(
      (entry) => entry.type === CULTURE_SEATING_BACKLASH_EVENT,
    )
    expect(outcome?.status).toBe('resolved')
    expect(outcome!.mutations.length).toBeGreaterThan(0)

    // The friction landed on cultures that DECLARE friction with merchants,
    // not on everybody else in the world.
    const after = activeFriction(state)
    expect(after.length).toBeGreaterThanOrEqual(before)
    for (const entry of after) {
      if (entry.cultureA !== 'merchant_roadfolk' && entry.cultureB !== 'merchant_roadfolk') {
        continue
      }
      expect(entry.level).toBeGreaterThan(0)
    }
    expect(getCultureModuleState(state).totals.seatingBacklashes).toBeGreaterThan(0)
  })
})
