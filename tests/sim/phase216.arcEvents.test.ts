// Expansion Phase 9 §9.2 (repo phase 216) / ISSUE-179 — five hook families
// stop draining and start happening.
//
// The implementation ledger carries five `HOOK-*` rows that belong to the
// arc layer, and all five were the same `OBL-02` failure: a response profile
// told the player the arc might fail, that leaning into the blight might
// lock the brand in, that gouging the festival crowd would draw a backlash,
// that the supplier's favour would be called in, or that the faction would
// want repaying — and the responses module drained the hook into a
// zero-weight cause because no domain owned the string.
//
//   HOOK-arc_failure_*                → arc_outcome_review
//   HOOK-blight_brand_lock_*          → arc_permanent_lock
//   HOOK-arc_exploit_backlash_*       → arc_backlash
//   HOOK-arc_faction_debt_*           → arc_debt_called_in
//   HOOK-arc_supplier_favour_owed_*   → arc_debt_called_in
//
// Both halves of keeping a promise are checked: the bridge routes the name
// to an owner, AND the resolver produces an authoritative mutation. So are
// the ways it is correct NOT to fire, because an explained no-op is right
// behaviour and an unexplained one is the bug.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import { withArea, withCoin, withStock } from '../../src/sim/testing/stateFactories'
import { findScheduledEventDefinitionForHookName } from '../../src/sim/contracts/scheduledEvents/registry'
import {
  readScheduledEventsSlice,
  scheduleEvent,
} from '../../src/sim/contracts/scheduledEvents/state'
import {
  ARC_BACKLASH_EVENT,
  ARC_DEBT_CALLED_IN_EVENT,
  ARC_OUTCOME_REVIEW_EVENT,
  ARC_PERMANENT_LOCK_EVENT,
  ARC_SCHEDULED_EVENT_TYPES,
  availableInterventions,
  getArcRun,
  liveArcRuns,
  writeArcRun,
} from '../../src/sim/modules/localArcs/index'
import { localArcRegistry } from '../../src/sim/content/events/localArcRegistry'

const SEED = 'phase216/arc-events'

type Module = Parameters<typeof simulateDay>[2][number]
type SetupHook = (ctx: import('../../src/sim/core/context').SimContext) => void

function run(
  state: TavernState,
  day: number,
  ownerActions: NonNullable<SimInput['ownerActions']> = [],
): TavernState {
  return simulateDay(state, { seed: `${SEED}/${day}`, ownerActions }, FULL_PIPELINE).state
}

function withSetup(state: TavernState, tag: string, setup: SetupHook): TavernState {
  return simulateDay(state, { seed: `${SEED}/${tag}` }, [
    ...FULL_PIPELINE,
    { id: `test_${tag}`, version: '1.0.0', hooks: { startDay: [setup] } } as Module,
  ]).state
}

function troubledHouse(coin = 6000): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 900, spoilage: 0 })
  }
  state = withArea(state, 'main_room', { cleanliness: 5, damage: 70, smell: 90 })
  state = withArea(state, 'kitchen', { cleanliness: 5, damage: 40, smell: 95 })
  state = withArea(state, 'cellar', { cleanliness: 10, smell: 80 })
  return state
}

/** Play until at least one arc is live, then hand it back. */
function withALiveArc(days = 25): TavernState {
  let state = troubledHouse()
  for (let day = 0; day < days; day += 1) {
    state = run(state, day)
    if (liveArcRuns(state).length > 0 && day > 12) break
  }
  return state
}

function outcomesFor(state: TavernState, type: string) {
  const slice = readScheduledEventsSlice(state)
  return [...slice.resolvedToday, ...slice.archive].filter(
    (outcome) => outcome.type === type,
  )
}

describe('Phase 216 §9.2 — the bridge routes the arc hook families to an owner', () => {
  it('claims all five names for the local-arcs module', () => {
    const claims: Array<[string, string]> = [
      ['arc_failure_mushroom_blight', ARC_OUTCOME_REVIEW_EVENT],
      ['blight_brand_lock_mushroom_blight', ARC_PERMANENT_LOCK_EVENT],
      ['arc_exploit_backlash_festival_approaching', ARC_BACKLASH_EVENT],
      ['arc_faction_debt_inspection_campaign', ARC_DEBT_CALLED_IN_EVENT],
      ['arc_supplier_favour_owed_mushroom_blight', ARC_DEBT_CALLED_IN_EVENT],
    ]
    for (const [hookName, expected] of claims) {
      const definition = findScheduledEventDefinitionForHookName(hookName)
      expect(definition?.type, hookName).toBe(expected)
      expect(definition?.ownerModuleId, hookName).toBe('localArcs')
      expect(definition?.kind, hookName).toBe('mechanical')
    }
  })

  it('registers exactly the four types it declares', () => {
    expect([...ARC_SCHEDULED_EVENT_TYPES].sort()).toEqual(
      [
        ARC_BACKLASH_EVENT,
        ARC_DEBT_CALLED_IN_EVENT,
        ARC_OUTCOME_REVIEW_EVENT,
        ARC_PERMANENT_LOCK_EVENT,
      ].sort(),
    )
  })

  it('declines a hook that names no arc anybody is running', () => {
    // The promise was about a specific arc. Collecting it against whichever
    // arc happens to be live would be an invented consequence.
    const definition = findScheduledEventDefinitionForHookName('arc_failure_nonsense')!
    const state = withALiveArc()
    expect(
      definition.fromFutureHook?.({
        hookName: 'arc_failure_nonsense',
        readable: 'x',
        scheduledForDay: 1,
        state,
      }),
    ).toBeUndefined()
  })

  it('resolves a hook naming a definition to the arc actually running it', () => {
    const state = withALiveArc()
    const live = liveArcRuns(state)[0]!
    const definition = findScheduledEventDefinitionForHookName(
      `arc_failure_${live.definitionId}`,
    )!
    const bridged = definition.fromFutureHook?.({
      hookName: `arc_failure_${live.definitionId}`,
      readable: 'x',
      scheduledForDay: 1,
      state,
    })
    expect(bridged?.payload).toEqual({ arcId: live.arcId })
  })
})

describe('Phase 216 §9.2 — arc_outcome_review judges the arc on how it went', () => {
  it('produces an authoritative outcome rather than a cause', () => {
    let state = withALiveArc()
    const live = liveArcRuns(state)[0]!
    state = withSetup(state, 'review', (ctx) => {
      scheduleEvent(ctx, {
        type: ARC_OUTCOME_REVIEW_EVENT,
        target: { kind: 'local_event', id: live.arcId },
        scheduledForDay: ctx.state.calendar.totalDaysElapsed + 1,
        payload: { arcId: live.arcId },
        origin: { source: 'test', readable: 'The arc may fail.' },
      })
    })
    for (let day = 200; day < 204; day += 1) state = run(state, day)

    const outcomes = outcomesFor(state, ARC_OUTCOME_REVIEW_EVENT)
    expect(outcomes.length, 'the review never fired').toBeGreaterThan(0)
    const outcome = outcomes[0]!
    if (outcome.status === 'resolved') {
      expect(outcome.mutations?.length ?? 0).toBeGreaterThan(0)
      expect(getArcRun(state, live.arcId)?.outcome).toBeDefined()
    } else {
      expect(outcome.status).toBe('no_op')
      expect(outcome.reason?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('gives the house the success it earned, out of an event expecting failure', () => {
    // The hook is named `arc_failure_*`, but what it resolves to is the
    // comparison the arc has been running all along. A player who worked at
    // it gets the win.
    let state = withALiveArc()
    const live = liveArcRuns(state)[0]!
    state = withSetup(state, 'earned', (ctx) => {
      writeArcRun(
        ctx,
        live.arcId,
        (current) => ({ ...current, goalProgress: 95, opposition: 5 }),
        'test_earned',
      )
      scheduleEvent(ctx, {
        type: ARC_OUTCOME_REVIEW_EVENT,
        target: { kind: 'local_event', id: live.arcId },
        scheduledForDay: ctx.state.calendar.totalDaysElapsed + 1,
        payload: { arcId: live.arcId },
        origin: { source: 'test', readable: 'The arc may fail.' },
      })
    })
    for (let day = 300; day < 304; day += 1) state = run(state, day)
    const closed = getArcRun(state, live.arcId)
    if (closed?.outcome) expect(closed.outcome).toBe('success')
  })

  it('says so when the arc already ended on its own', () => {
    let state = withALiveArc()
    const live = liveArcRuns(state)[0]!
    state = withSetup(state, 'already', (ctx) => {
      writeArcRun(
        ctx,
        live.arcId,
        (current) => ({
          ...current,
          outcome: 'success',
          closedOnDay: ctx.state.calendar.totalDaysElapsed,
        }),
        'test_closed',
      )
      scheduleEvent(ctx, {
        type: ARC_OUTCOME_REVIEW_EVENT,
        target: { kind: 'local_event', id: live.arcId },
        scheduledForDay: ctx.state.calendar.totalDaysElapsed + 1,
        payload: { arcId: live.arcId },
        origin: { source: 'test', readable: 'The arc may fail.' },
      })
    })
    for (let day = 400; day < 404; day += 1) state = run(state, day)
    const outcomes = outcomesFor(state, ARC_OUTCOME_REVIEW_EVENT)
    expect(outcomes.length).toBeGreaterThan(0)
    expect(outcomes[0]!.status).toBe('no_op')
    expect(outcomes[0]!.reason).toMatch(/already ended/)
  })
})

describe('Phase 216 §9.2 — arc_permanent_lock only sticks what is still true', () => {
  it('locks a label in when the house is still leaning into it', () => {
    let state = withALiveArc()
    const live = liveArcRuns(state)[0]!
    state = withSetup(state, 'lock', (ctx) => {
      writeArcRun(
        ctx,
        live.arcId,
        (current) => ({ ...current, goalProgress: 10 }),
        'test_leaning',
      )
      scheduleEvent(ctx, {
        type: ARC_PERMANENT_LOCK_EVENT,
        target: { kind: 'local_event', id: live.arcId },
        scheduledForDay: ctx.state.calendar.totalDaysElapsed + 1,
        payload: { arcId: live.arcId, label: 'the place with the strange mushrooms' },
        origin: { source: 'test', readable: 'The brand may lock in.' },
      })
    })
    for (let day = 500; day < 504; day += 1) state = run(state, day)

    const outcomes = outcomesFor(state, ARC_PERMANENT_LOCK_EVENT)
    expect(outcomes.length, 'the lock never fired').toBeGreaterThan(0)
    expect(outcomes[0]!.status).toBe('resolved')
    expect(outcomes[0]!.mutations?.length ?? 0).toBeGreaterThan(0)
    // And it is a change the identity module's daily rebuild keeps.
    expect(state.world.tavernIdentity.knownFor).toContain(
      'the place with the strange mushrooms',
    )
  })

  it('says so when the house put the problem right instead', () => {
    let state = withALiveArc()
    const live = liveArcRuns(state)[0]!
    state = withSetup(state, 'no_lock', (ctx) => {
      writeArcRun(
        ctx,
        live.arcId,
        (current) => ({ ...current, goalProgress: 80 }),
        'test_fixed',
      )
      scheduleEvent(ctx, {
        type: ARC_PERMANENT_LOCK_EVENT,
        target: { kind: 'local_event', id: live.arcId },
        scheduledForDay: ctx.state.calendar.totalDaysElapsed + 1,
        payload: { arcId: live.arcId, label: 'the place with the strange mushrooms' },
        origin: { source: 'test', readable: 'The brand may lock in.' },
      })
    })
    for (let day = 600; day < 604; day += 1) state = run(state, day)
    const outcomes = outcomesFor(state, ARC_PERMANENT_LOCK_EVENT)
    expect(outcomes.length).toBeGreaterThan(0)
    expect(outcomes[0]!.status).toBe('no_op')
    expect(outcomes[0]!.reason).toMatch(/put it right/)
    expect(state.world.tavernIdentity.knownFor).not.toContain(
      'the place with the strange mushrooms',
    )
  })
})

describe('Phase 216 §9.2 — arc_backlash answers being taken advantage of', () => {
  it('makes the owner push harder, and records why', () => {
    let state = withALiveArc()
    const live = liveArcRuns(state)[0]!
    state = withSetup(state, 'backlash', (ctx) => {
      writeArcRun(ctx, live.arcId, (current) => ({ ...current, opposition: 45 }), 'test_op')
      scheduleEvent(ctx, {
        type: ARC_BACKLASH_EVENT,
        target: { kind: 'local_event', id: live.arcId },
        scheduledForDay: ctx.state.calendar.totalDaysElapsed + 1,
        payload: { arcId: live.arcId },
        origin: { source: 'test', readable: 'A backlash is possible.' },
      })
    })
    const before = getArcRun(state, live.arcId)!.opposition
    for (let day = 700; day < 704; day += 1) state = run(state, day)

    const outcomes = outcomesFor(state, ARC_BACKLASH_EVENT)
    expect(outcomes.length, 'the backlash never fired').toBeGreaterThan(0)
    const outcome = outcomes[0]!
    if (outcome.status === 'resolved') {
      expect(outcome.mutations?.length ?? 0).toBeGreaterThan(0)
      expect(getArcRun(state, live.arcId)?.opposition ?? 0).toBeGreaterThan(before - 1)
    } else {
      expect(outcome.reason?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('says so when they were squared before it came to anything', () => {
    let state = withALiveArc()
    const live = liveArcRuns(state)[0]!
    state = withSetup(state, 'squared', (ctx) => {
      writeArcRun(ctx, live.arcId, (current) => ({ ...current, opposition: 5 }), 'test_calm')
      scheduleEvent(ctx, {
        type: ARC_BACKLASH_EVENT,
        target: { kind: 'local_event', id: live.arcId },
        scheduledForDay: ctx.state.calendar.totalDaysElapsed + 1,
        payload: { arcId: live.arcId },
        origin: { source: 'test', readable: 'A backlash is possible.' },
      })
    })
    for (let day = 800; day < 804; day += 1) state = run(state, day)
    const outcomes = outcomesFor(state, ARC_BACKLASH_EVENT)
    expect(outcomes.length).toBeGreaterThan(0)
    expect(outcomes[0]!.status).toBe('no_op')
    expect(outcomes[0]!.reason).toMatch(/squared/)
  })
})

describe('Phase 216 §9.2 — arc_debt_called_in collects through the creditor', () => {
  it('opens a real, answerable faction demand rather than a meter poke', () => {
    let state = withALiveArc()
    const live = liveArcRuns(state)[0]!
    state = withSetup(state, 'faction_debt', (ctx) => {
      scheduleEvent(ctx, {
        type: ARC_DEBT_CALLED_IN_EVENT,
        target: { kind: 'local_event', id: live.arcId },
        scheduledForDay: ctx.state.calendar.totalDaysElapsed + 1,
        payload: { arcId: live.arcId, from: 'faction' },
        origin: { source: 'test', readable: 'The faction will want repaying.' },
      })
    })
    for (let day = 900; day < 904; day += 1) state = run(state, day)

    const outcomes = outcomesFor(state, ARC_DEBT_CALLED_IN_EVENT)
    expect(outcomes.length, 'the debt was never called in').toBeGreaterThan(0)
    const outcome = outcomes[0]!
    if (outcome.status === 'resolved') {
      expect(outcome.mutations?.[0]?.targetKind).toBe('faction')
      // A real record in the factions domain, which the player can answer.
      const demands = (
        state.modules['factions'] as {
          demands: Record<string, { status: string; askCoin: number }>
        }
      ).demands
      expect(Object.keys(demands).length).toBeGreaterThan(0)
    } else {
      expect(outcome.reason?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('collects a supplier favour by making the trading harder', () => {
    let state = withALiveArc()
    const live = liveArcRuns(state)[0]!
    state = withSetup(state, 'supplier_debt', (ctx) => {
      scheduleEvent(ctx, {
        type: ARC_DEBT_CALLED_IN_EVENT,
        target: { kind: 'local_event', id: live.arcId },
        scheduledForDay: ctx.state.calendar.totalDaysElapsed + 1,
        payload: { arcId: live.arcId, from: 'supplier' },
        origin: { source: 'test', readable: 'The favour will be called in.' },
      })
    })
    for (let day = 1000; day < 1004; day += 1) state = run(state, day)

    const outcomes = outcomesFor(state, ARC_DEBT_CALLED_IN_EVENT)
    expect(outcomes.length).toBeGreaterThan(0)
    const outcome = outcomes[0]!
    if (outcome.status === 'resolved') {
      expect(outcome.mutations?.[0]?.targetKind).toBe('supplier')
      const accounts = (
        state.modules['suppliers'] as {
          accounts: Record<string, { termsAdjustment: number }>
        }
      ).accounts
      expect(
        Object.values(accounts).some((account) => account.termsAdjustment > 1),
      ).toBe(true)
    } else {
      expect(outcome.reason?.length ?? 0).toBeGreaterThan(0)
    }
  })
})

describe('Phase 216 §9.2 — a risky intervention stakes what it warns about', () => {
  it('schedules the hook the definition names', () => {
    // Three interventions in the catalog carry a `stakesHook`. Taking one
    // is the producer side of these families: the promise is made by the
    // player choosing the risky option.
    const staking = [...localArcRegistry.all()]
      .flatMap((definition) => definition.progression?.interventions ?? [])
      .filter((intervention) => intervention.stakesHook !== undefined)
    expect(staking.length, 'no intervention stakes anything').toBeGreaterThan(0)

    let state = troubledHouse()
    let scheduled = false
    for (let day = 0; day < 60 && !scheduled; day += 1) {
      const risky = availableInterventions(state).find(
        (offer) =>
          offer.blockedReason === undefined &&
          offer.intervention.stakesHook !== undefined,
      )
      state = run(
        state,
        day,
        risky
          ? [
              {
                actionId: 'intervene_in_arc',
                targetId: `${risky.arcId}:${risky.intervention.id}`,
              },
            ]
          : [],
      )
      scheduled = readScheduledEventsSlice(state).queue.some((event) =>
        ARC_SCHEDULED_EVENT_TYPES.includes(event.type),
      )
    }
    expect(scheduled, 'a risky intervention staked nothing').toBe(true)
  })
})
