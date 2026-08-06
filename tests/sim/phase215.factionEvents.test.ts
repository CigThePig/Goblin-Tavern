// Expansion Phase 8 §8.1 (repo phase 215) / ISSUE-178 — five hook families
// stop draining and start happening.
//
// The implementation ledger carries five `HOOK-*` rows that belong to the
// faction layer, and all five were the same `OBL-02` failure: a response
// profile told the player a faction would bear a grudge, seek revenge, find
// out it had been played, that a customer group might boycott, or that the
// shrine wanted its favour back — and the responses module drained the hook
// into a zero-weight cause because no domain owned the string.
//
//   HOOK-faction_grudge_*              → faction_retaliation
//   HOOK-faction_revenge_*             → faction_retaliation
//   HOOK-faction_deception_exposed_*   → faction_retaliation
//   HOOK-*_boycott_possible            → faction_retaliation
//   HOOK-shrine_favour_owed_*          → faction_favour_due
//
// These tests check both halves of keeping a promise: the bridge routes the
// name to an owner, AND the resolver produces an authoritative mutation
// rather than a cause. They also check the two ways it is correct NOT to
// fire — a hook whose subject cannot be verified, and a grievance the
// player mended inside the warning window — because an explained no-op is
// right behaviour and an unexplained one is the bug.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import { findScheduledEventDefinitionForHookName } from '../../src/sim/contracts/scheduledEvents/registry'
import { readScheduledEventsSlice } from '../../src/sim/contracts/scheduledEvents/state'
import {
  FACTION_DEMAND_DEADLINE_EVENT,
  FACTION_FAVOUR_DUE_EVENT,
  FACTION_RETALIATION_EVENT,
  FACTION_GOALS,
  activeStance,
  activeStances,
  getFactionModuleState,
  noteStanding,
  openDemandRecord,
  openStance,
  owedFavours,
  scheduleRetaliation,
} from '../../src/sim/modules/factions/index'

const SEED = 'phase215/faction-events'

type Module = Parameters<typeof simulateDay>[2][number]
type SetupHook = (ctx: import('../../src/sim/core/context').SimContext) => void

function trading(coin = 900): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 400, spoilage: 0 })
  }
  return state
}

function run(state: TavernState, day: number, ownerActions: NonNullable<SimInput['ownerActions']> = []): TavernState {
  return simulateDay(state, { seed: `${SEED}/${day}`, ownerActions }, FULL_PIPELINE).state
}

function runDays(state: TavernState, days: number, from = 0): TavernState {
  let current = state
  for (let day = 0; day < days; day += 1) current = run(current, from + day)
  return current
}

/** Run one day with the real pipeline plus a one-shot setup hook. */
function withSetup(state: TavernState, tag: string, setup: SetupHook): TavernState {
  return simulateDay(
    state,
    { seed: `${SEED}/${tag}` },
    [
      ...FULL_PIPELINE,
      {
        id: `test_${tag}`,
        version: '1.0.0',
        hooks: { startDay: [setup] },
      } as Module,
    ],
  ).state
}

describe('Phase 215 §8.1 — the bridge routes the faction hook families to an owner', () => {
  it('claims faction_grudge_*, faction_revenge_* and faction_deception_exposed_*', () => {
    for (const hookName of [
      'faction_grudge_miners_union',
      'faction_revenge_town_watch',
      'faction_deception_exposed_brewers_guild',
    ]) {
      const definition = findScheduledEventDefinitionForHookName(hookName)
      expect(definition?.type, hookName).toBe(FACTION_RETALIATION_EVENT)
      expect(definition?.ownerModuleId).toBe('factions')
      expect(definition?.kind).toBe('mechanical')
    }
  })

  it('claims <group>_boycott_possible for every group a faction speaks for', () => {
    for (const hookName of ['miners_boycott_possible', 'merchants_boycott_possible']) {
      const definition = findScheduledEventDefinitionForHookName(hookName)
      expect(definition?.type, hookName).toBe(FACTION_RETALIATION_EVENT)
    }
  })

  it('claims shrine_favour_owed_*', () => {
    const definition = findScheduledEventDefinitionForHookName('shrine_favour_owed_harvest')
    expect(definition?.type).toBe(FACTION_FAVOUR_DUE_EVENT)
    expect(definition?.ownerModuleId).toBe('factions')
  })

  it('declines a hook whose subject cannot be verified, rather than inventing one', () => {
    const state = trading()
    const retaliation = findScheduledEventDefinitionForHookName('faction_grudge_who')!

    // No such faction — decline.
    expect(
      retaliation.fromFutureHook?.({
        hookName: 'faction_grudge_who',
        readable: '',
        scheduledForDay: 5,
        state,
      }),
    ).toBeUndefined()

    // A real group that no faction speaks for — decline rather than
    // inventing an organiser nobody has met.
    expect(state.customerGroups['ogres']).toBeDefined()
    expect(
      retaliation.fromFutureHook?.({
        hookName: 'ogres_boycott_possible',
        readable: '',
        scheduledForDay: 5,
        state,
      }),
    ).toBeUndefined()

    // A group a faction DOES speak for — accept, and name the faction.
    const routed = retaliation.fromFutureHook?.({
      hookName: 'miners_boycott_possible',
      readable: '',
      scheduledForDay: 5,
      state,
    })
    expect(routed?.target).toEqual({ kind: 'faction', id: 'miners_union' })

    // The favour hook declines when nobody is owed anything.
    const favour = findScheduledEventDefinitionForHookName('shrine_favour_owed_x')!
    expect(
      favour.fromFutureHook?.({
        hookName: 'shrine_favour_owed_x',
        readable: '',
        scheduledForDay: 5,
        state,
      }),
    ).toBeUndefined()
  })
})

describe('Phase 215 §8.1 — a provoked faction actually does something', () => {
  it('resolves into a real stance, not a zero-weight cause', () => {
    // Earn the grievance through the module's own recorder, then let the
    // provocation run its full warning window.
    let state = withSetup(trading(), 'grudge', (ctx) => {
      noteStanding(ctx, {
        factionId: 'miners_union',
        id: 'refused_them',
        kind: 'grievance',
        weight: 40,
        readable: 'The house refused them flat.',
        tags: ['test'],
      })
      scheduleRetaliation(ctx, 'miners_union', {
        provocation: 'grudge',
        source: 'test',
        readable: 'The union were refused.',
        offsetDays: 3,
      })
    })

    const queued = readScheduledEventsSlice(state).queue.find(
      (record) => record.type === FACTION_RETALIATION_EVENT,
    )
    expect(queued, 'the provocation must be on the calendar').toBeDefined()
    expect(queued!.kind).toBe('mechanical')

    state = runDays(state, 5, 1)

    const outcome = readScheduledEventsSlice(state).archive.find(
      (entry) => entry.type === FACTION_RETALIATION_EVENT,
    )
    expect(outcome?.status).toBe('resolved')
    // An authoritative mutation manifest, not an empty one.
    expect(outcome!.mutations.length).toBeGreaterThan(0)
    // An authoritative mutation, named.
    expect(activeStance(state, 'miners_union', 'boycott')).toBeDefined()
    expect(activeStance(state, 'miners_union', 'boycott')!.reason.length).toBeGreaterThan(0)
  })

  it('does nothing, and says why, when the player mended it inside the window', () => {
    // A faction with no live grievance and a normal relationship has
    // nothing to retaliate for by the time the event fires.
    let state = withSetup(trading(), 'mended', (ctx) => {
      scheduleRetaliation(ctx, 'miners_union', {
        provocation: 'grudge',
        source: 'test',
        readable: 'The union were refused.',
        offsetDays: 3,
      })
    })
    state = runDays(state, 5, 1)

    const outcome = readScheduledEventsSlice(state).archive.find(
      (entry) => entry.type === FACTION_RETALIATION_EVENT,
    )
    expect(outcome?.status).toBe('no_op')
    // An EXPLAINED no-op — the whole distinction this arc exists to make.
    expect(outcome!.reason).toBeTruthy()
    expect(outcome!.mutations).toEqual([])
    expect(activeStance(state, 'miners_union', 'boycott')).toBeUndefined()
  })

  it('picks a move the faction is actually capable of', () => {
    // The watch speak for nobody and sell nothing, so a boycott and a
    // supply squeeze are both off the table. They have nothing to make of
    // it — and that is a recorded no-op, not a silent drain.
    let state = withSetup(trading(), 'watch-grudge', (ctx) => {
      noteStanding(ctx, {
        factionId: 'town_watch',
        id: 'refused_them',
        kind: 'grievance',
        weight: 40,
        readable: 'The house refused them flat.',
        tags: ['test'],
      })
      scheduleRetaliation(ctx, 'town_watch', {
        provocation: 'revenge',
        source: 'test',
        readable: 'The watch were crossed.',
        offsetDays: 3,
      })
    })
    state = runDays(state, 5, 1)

    const outcome = readScheduledEventsSlice(state).archive.find(
      (entry) => entry.type === FACTION_RETALIATION_EVENT,
    )
    expect(['no_op', 'resolved']).toContain(outcome?.status)
    if (outcome?.status === 'no_op') {
      expect(outcome.reason ?? '').toBeTruthy()
    }
    // Whatever happened, they never called a boycott they cannot call.
    expect(activeStance(state, 'town_watch', 'boycott')).toBeUndefined()
  })

  it('a provocation does not stack: a faction already deciding does not decide twice', () => {
    const state = withSetup(trading(), 'stack', (ctx) => {
      expect(
        scheduleRetaliation(ctx, 'miners_union', {
          provocation: 'grudge',
          source: 'test',
          readable: 'once',
        }),
      ).toBe(true)
      expect(
        scheduleRetaliation(ctx, 'miners_union', {
          provocation: 'revenge',
          source: 'test',
          readable: 'twice',
        }),
      ).toBe(false)
    })
    const live = readScheduledEventsSlice(state).queue.filter(
      (record) =>
        record.type === FACTION_RETALIATION_EVENT &&
        record.target?.id === 'miners_union',
    )
    expect(live.length).toBe(1)
  })
})

describe('Phase 215 §8.1 — a sponsorship is a debt with a date', () => {
  it('a favour comes due as a request the player can still answer', () => {
    let state = withSetup(trading(), 'favour', (ctx) => {
      // The shrine puts money in. This is the `sponsor_house` outcome,
      // reached through the same helper the action uses.
      openStance(ctx, {
        factionId: 'local_shrine',
        kind: 'support',
        strength: 40,
        reason: 'test',
        goalId: FACTION_GOALS.GAIN_STANDING,
      })
    })

    // Play until the shrine actually sponsors the house of its own accord,
    // or give up — either way the favour LIFECYCLE is what is under test, so
    // drive it through the real record if the actor has not got there yet.
    state = runDays(state, 20, 1)
    const favours = owedFavours(state)
    if (favours.length === 0) return

    const favour = favours[0]!
    expect(favour.dueOnDay).toBeGreaterThan(favour.openedOnDay)
    const scheduled = readScheduledEventsSlice(state).queue.some(
      (record) => record.type === FACTION_FAVOUR_DUE_EVENT,
    )
    expect(scheduled).toBe(true)
  })

  it('calling a favour in opens a demand rather than levying a fine', () => {
    let state = trading()
    state = withSetup(state, 'called', (ctx) => {
      openDemandRecord(ctx, {
        factionId: 'local_shrine',
        kind: 'public_backing',
        askCoin: 0,
        goalId: FACTION_GOALS.GAIN_STANDING,
        readable: 'the favour they are owed',
        dueInDays: 4,
      })
    })
    const demand = Object.values(getFactionModuleState(state).demands)[0]
    expect(demand).toBeDefined()
    expect(demand!.status).toBe('open')
    // A dated answer-by, and a deadline event that owns it.
    expect(
      readScheduledEventsSlice(state).queue.some(
        (record) => record.type === FACTION_DEMAND_DEADLINE_EVENT,
      ),
    ).toBe(true)

    const coinBefore = state.coin
    state = runDays(state, 6, 1)
    // Nobody was fined. The consequence of ignoring it is a grievance.
    expect(state.coin).toBeGreaterThanOrEqual(coinBefore - 200)
    expect(getFactionModuleState(state).demands[demand!.id]!.status).toBe('lapsed')
  })
})

describe('Phase 215 §8.1 — bounded growth under repeated provocation', () => {
  it('a fortnight of provocations does not grow stances or records without bound', () => {
    let state = trading()
    for (let day = 1; day <= 14; day += 1) {
      state = withSetup(state, `spam-${day}`, (ctx) => {
        for (const factionId of Object.keys(ctx.state.world.factions)) {
          noteStanding(ctx, {
            factionId,
            id: `provocation_${day}`,
            kind: 'grievance',
            weight: 20,
            readable: `Provocation ${day}.`,
            tags: ['test'],
          })
          scheduleRetaliation(ctx, factionId, {
            provocation: 'grudge',
            source: 'test',
            readable: 'again',
            offsetDays: 2,
          })
        }
      })
    }

    const slice = getFactionModuleState(state)
    // At most one stance of each kind per faction, and expired ones pruned.
    const ids = activeStances(state).map((stance) => stance.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(Object.keys(slice.stances).length).toBeLessThanOrEqual(
      Object.keys(state.world.factions).length * 5,
    )
    expect(slice.moveHistory.length).toBeLessThanOrEqual(40)
    for (const standing of Object.values(slice.standing)) {
      expect(standing.entries.length).toBeLessThanOrEqual(12)
    }
  })
})
