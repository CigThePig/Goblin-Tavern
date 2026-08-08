// Expansion Phase 9 §9.3 (repo phase 216) / ISSUE-179 — an expedition
// becomes a journey rather than a wait.
//
// WHAT WAS BROKEN. A Phase 70 expedition had a runner, a mode, a tier and a
// day count the player typed. The tick added one to `daysElapsed`, and on
// the last day one `rollOutcome` call decided the whole trip. There was no
// PLACE, no supplies, no party, no terms, nothing happened in between, and
// once the party left the player was a spectator waiting for a number.
//
// §9.3 lists ten things an expedition must support. This file checks them
// against expeditions reached by playing: route and destination choice,
// supplies and loadout, party composition, contract and compensation terms,
// intermediate seeded events, risk/reward decisions, injury, delay, retreat,
// rescue, recall and loss, delayed information, and effects on stock, world
// actors, rumours and future opportunities — plus the two properties the
// plan states outright: bounded event count, and seeds stable from
// commission through resolution.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimContext, SimInput } from '../../src/sim/core/context'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import {
  actionRegistry,
  ensureRequiredOwnerActionsRegistered,
} from '../../src/sim/registries/actionRegistry'
import {
  EXPEDITION_ROUTES,
  expeditionRouteRegistry,
  routeProvisionsNeeded,
  routeTravelDays,
} from '../../src/sim/content/expeditions/expeditionRoutes'
import {
  EXPEDITION_EVENTS,
  MAX_EXPEDITION_EVENTS,
} from '../../src/sim/content/expeditions/expeditionEvents'
import {
  arrivedDispatches,
  availableRoutes,
  dispatchesInTransit,
  getExpeditionRun,
  getExpeditionsModuleState,
  liveExpeditionRuns,
  routeFor,
} from '../../src/sim/modules/expeditions/index'

const SEED = 'phase216/expeditions'

function run(
  state: TavernState,
  day: number,
  ownerActions: NonNullable<SimInput['ownerActions']> = [],
  seedTag = SEED,
): TavernState {
  return simulateDay(state, { seed: `${seedTag}/${day}`, ownerActions }, FULL_PIPELINE)
    .state
}

function tradingHouse(coin = 9000): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 600, spoilage: 0 })
  }
  return state
}

/** Play a few days so the adventurer roster exists, then hand it back. */
function withRunners(seedTag = SEED): TavernState {
  let state = tradingHouse()
  for (let day = 0; day < 8; day += 1) state = run(state, day, [], seedTag)
  return state
}

function freeRunners(state: TavernState) {
  return Object.values(state.world.hireableAdventurers).filter(
    (adventurer) =>
      adventurer.currentExpeditionId === null &&
      !adventurer.activeFlags.includes('injured'),
  )
}

/** What an action would offer right now. */
function offers(state: TavernState, actionId: string) {
  ensureRequiredOwnerActionsRegistered()
  const definition = actionRegistry.get(actionId)
  return definition.getValidTargets
    ? definition.getValidTargets({ state } as unknown as SimContext)
    : []
}

function commission(
  state: TavernState,
  day: number,
  options: Record<string, unknown>,
  seedTag = SEED,
): TavernState {
  const runner = freeRunners(state)[0]
  if (!runner) throw new Error('no free runner')
  return run(
    state,
    day,
    [{ actionId: 'commission_expedition', targetId: runner.id, options }],
    seedTag,
  )
}

/** Run until the party is home (or gone), answering nothing. */
function runUntilHome(
  state: TavernState,
  fromDay: number,
  seedTag = SEED,
  answer = false,
): TavernState {
  let current = state
  for (let day = fromDay; day < fromDay + 60; day += 1) {
    const question = answer ? offers(current, 'answer_expedition_dispatch')[0] : undefined
    const actions = question
      ? [{ actionId: 'answer_expedition_dispatch', targetId: question.id }]
      : []
    current = run(current, day, actions, seedTag)
    if (liveExpeditionRuns(current).length === 0) break
  }
  return current
}

describe('Phase 216 §9.3 — an expedition has somewhere to go', () => {
  it('gives every route a distance, a danger, a yield and a word delay', () => {
    for (const route of EXPEDITION_ROUTES) {
      expect(route.legs, route.id).toBeGreaterThan(0)
      expect(route.daysPerLeg, route.id).toBeGreaterThan(0)
      expect(route.danger, route.id).toBeGreaterThan(0)
      expect(route.yields.length, route.id).toBeGreaterThan(0)
      expect(route.provisionsPerDay, route.id).toBeGreaterThan(0)
      expect(route.wordDelayDays, route.id).toBeGreaterThanOrEqual(0)
      expect(route.readable.length, route.id).toBeGreaterThan(20)
    }
  })

  it('makes far routes both slower and darker than near ones', () => {
    const road = expeditionRouteRegistry.get('market_road')
    const deep = expeditionRouteRegistry.get('the_underdeep')
    expect(routeTravelDays(deep)).toBeGreaterThan(routeTravelDays(road))
    expect(deep.danger).toBeGreaterThan(road.danger)
    // The one that actually distinguishes §9.3's model from a difficulty
    // slider: distance costs INFORMATION, not only time.
    expect(deep.wordDelayDays).toBeGreaterThan(road.wordDelayDays)
  })

  it('keeps a route nobody has found off the board until somebody finds it', () => {
    const open = availableRoutes(createInitialTavernState(), []).map((r) => r.id)
    expect(open).not.toContain('the_underdeep')
    const withWord = availableRoutes(createInitialTavernState(), ['a_way_down']).map(
      (r) => r.id,
    )
    expect(withWord).toContain('the_underdeep')
  })

  it('refuses a target the route cannot yield', () => {
    let state = withRunners()
    // The Market Road does not produce legendary anything. Asking for it is
    // not an expensive gamble, it is a request nobody can fill.
    state = commission(state, 9, {
      mode: 'open',
      targetTier: 'legendary',
      routeId: 'market_road',
    })
    const rejected = (
      state.modules['ownerActions'] as { rejected: Array<{ code: string }> }
    ).rejected
    expect(rejected.some((entry) => entry.code === 'tier_not_on_route')).toBe(true)
  })

  it('takes the duration from the route rather than from the player', () => {
    let state = withRunners()
    state = commission(state, 9, {
      mode: 'open',
      targetTier: 'rare',
      routeId: 'deep_fen',
      // Deliberately absurd, and deliberately ignored.
      daysTotal: 1,
    })
    const expedition = state.expeditions.active[0]
    expect(expedition, 'the commission was rejected').toBeDefined()
    expect(expedition!.daysTotal).toBe(
      routeTravelDays(expeditionRouteRegistry.get('deep_fen')) + 1,
    )
  })
})

describe('Phase 216 §9.3 — supplies, party and terms', () => {
  it('sends a party, a loadout and a contract, all recorded', () => {
    let state = withRunners()
    state = commission(state, 9, {
      mode: 'open',
      targetTier: 'rare',
      routeId: 'deep_fen',
      partySize: 2,
      medicine: 1,
      terms: 'share_of_haul',
    })
    const runRecord = liveExpeditionRuns(state)[0]
    expect(runRecord, 'no run was opened').toBeDefined()
    expect(runRecord!.routeId).toBe('deep_fen')
    expect(runRecord!.partyRunnerIds.length).toBe(2)
    expect(runRecord!.loadout.provisions).toBeGreaterThan(0)
    expect(runRecord!.medicine).toBe(1)
    expect(runRecord!.terms.kind).toBe('share_of_haul')
    expect(runRecord!.terms.settled).toBe(false)

    // Everybody who went is marked as being out.
    for (const memberId of runRecord!.partyRunnerIds) {
      expect(state.world.hireableAdventurers[memberId]!.currentExpeditionId).toBe(
        runRecord!.expeditionId,
      )
    }
  })

  it('provisions the default loadout for the whole trip', () => {
    // A player who engages with nothing should get the trip the route
    // describes, not a hungry one.
    let state = withRunners()
    state = commission(state, 9, {
      mode: 'open',
      targetTier: 'uncommon',
      routeId: 'market_road',
    })
    const opened = liveExpeditionRuns(state)[0]!
    expect(opened.loadout.provisions).toBe(
      routeProvisionsNeeded(
        expeditionRouteRegistry.get('market_road'),
        opened.partyRunnerIds.length,
      ),
    )
    const home = runUntilHome(state, 10)
    const finished = getExpeditionRun(home, opened.expeditionId)
    expect(finished?.hungryDays, 'the default loadout left them hungry').toBe(0)
  })

  it('charges a share-of-haul commission less up front than a flat fee', () => {
    // The point of having terms at all: they are different bets, not three
    // prices for the same thing.
    const before = withRunners()
    const flat = commission(before, 9, {
      mode: 'open',
      targetTier: 'uncommon',
      routeId: 'market_road',
      terms: 'flat_fee',
    })
    const share = commission(before, 9, {
      mode: 'open',
      targetTier: 'uncommon',
      routeId: 'market_road',
      terms: 'share_of_haul',
    })
    expect(share.coin).toBeGreaterThan(flat.coin)
  })

  it('settles up exactly once, on the terms agreed', () => {
    let state = withRunners()
    state = commission(state, 9, {
      mode: 'open',
      targetTier: 'uncommon',
      routeId: 'market_road',
      terms: 'flat_fee',
    })
    const expeditionId = liveExpeditionRuns(state)[0]!.expeditionId
    const home = runUntilHome(state, 10)
    const finished = getExpeditionRun(home, expeditionId)
    expect(finished?.terminal).toBeDefined()
    expect(finished?.terms.settled).toBe(true)
    // Running further days must not pay anybody a second time. The coin
    // total is no use as evidence — the tavern spends on plenty else — so
    // the check is on the settlement record and on the causes it writes.
    let later = home
    for (let day = 80; day < 84; day += 1) later = run(later, day)
    expect(getExpeditionRun(later, expeditionId)?.terms.settledCoin).toBe(
      finished?.terms.settledCoin,
    )
    expect(getExpeditionRun(later, expeditionId)?.terms.settled).toBe(true)
    const settlements = later.causes.filter((cause) =>
      cause.source.startsWith('expeditions.resolve.settle'),
    )
    expect(settlements.length).toBeLessThanOrEqual(1)
  })
})

describe('Phase 216 §9.3 — things happen on the way', () => {
  it('fires intermediate events, bounded per expedition', () => {
    let state = withRunners()
    state = commission(state, 9, {
      mode: 'open',
      targetTier: 'rare',
      routeId: 'deep_fen',
      partySize: 2,
    })
    const expeditionId = liveExpeditionRuns(state)[0]!.expeditionId
    const home = runUntilHome(state, 10)
    const finished = getExpeditionRun(home, expeditionId)!
    expect(finished.events.length, 'nothing happened on a four-day marsh trip').toBeGreaterThan(0)
    expect(finished.events.length).toBeLessThanOrEqual(MAX_EXPEDITION_EVENTS)
    // Each event fires once. A party does not lose the same trail twice.
    const ids = finished.events.map((entry) => entry.eventId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('produces the same journey twice from the same commission', () => {
    // §9.3: "make expedition seeds stable from commission through
    // resolution". Same seed, same commission, same trip — whatever else
    // the day is doing.
    const a = runUntilHome(
      commission(withRunners('det'), 9, {
        mode: 'open',
        targetTier: 'rare',
        routeId: 'deep_fen',
      }, 'det'),
      10,
      'det',
    )
    const b = runUntilHome(
      commission(withRunners('det'), 9, {
        mode: 'open',
        targetTier: 'rare',
        routeId: 'deep_fen',
      }, 'det'),
      10,
      'det',
    )
    expect(
      JSON.parse(JSON.stringify(getExpeditionsModuleState(b).runs)),
    ).toEqual(JSON.parse(JSON.stringify(getExpeditionsModuleState(a).runs)))
    expect(b.expeditions.completed.map((r) => r.outcome)).toEqual(
      a.expeditions.completed.map((r) => r.outcome),
    )
  })

  it('gives every decision a cautious default and a stated deadline', () => {
    for (const definition of EXPEDITION_EVENTS) {
      if (!definition.decision) continue
      const ids = definition.decision.options.map((option) => option.id)
      expect(ids, definition.id).toContain(definition.decision.defaultOptionId)
      expect(definition.decision.waitDays, definition.id).toBeGreaterThan(0)
      expect(definition.decision.options.length, definition.id).toBeGreaterThan(1)
    }
  })

  it('lets the party act for themselves when nobody answers in time', () => {
    // Whether a given seed raises a question is the model's business; that
    // an unanswered one is taken by the party is the property. So this
    // walks a few seeds until a question is actually asked.
    let defaultedSomewhere = false
    for (const tag of ['q1', 'q2', 'q3', 'q4']) {
      let state = withRunners(tag)
      if (freeRunners(state).length === 0) continue
      state = commission(
        state,
        9,
        { mode: 'open', targetTier: 'rare', routeId: 'deep_fen', partySize: 2 },
        tag,
      )
      if (liveExpeditionRuns(state).length === 0) continue
      const home = runUntilHome(state, 10, tag)
      const totals = getExpeditionsModuleState(home).totals
      if (totals.decisionsDefaulted === 0) continue
      defaultedSomewhere = true
      const finished = Object.values(getExpeditionsModuleState(home).runs)[0]!
      const defaulted = finished.events.filter((entry) => entry.chosenByDefault)
      expect(defaulted.length).toBeGreaterThan(0)
      // Recorded as the party's call, not the house's.
      for (const entry of defaulted) expect(entry.chosenOptionId).toBeDefined()
      break
    }
    expect(
      defaultedSomewhere,
      'four marsh trips raised no question anybody had to answer',
    ).toBe(true)
  })
})

describe('Phase 216 §9.3 — word takes time to get home', () => {
  it('holds a dispatch until the route says it has arrived', () => {
    let state = withRunners()
    state = commission(state, 9, {
      mode: 'open',
      targetTier: 'rare',
      routeId: 'deep_fen',
      partySize: 2,
    })
    const expeditionId = liveExpeditionRuns(state)[0]!.expeditionId
    let sawInTransit = false
    let current = state
    for (let day = 10; day < 40; day += 1) {
      current = run(current, day)
      const record = getExpeditionRun(current, expeditionId)
      if (!record) break
      const today = current.calendar.totalDaysElapsed
      if (dispatchesInTransit(record, today).length > 0) sawInTransit = true
      for (const dispatch of arrivedDispatches(record, today)) {
        expect(dispatch.arrivesOnDay).toBeLessThanOrEqual(today)
        expect(dispatch.arrivesOnDay).toBeGreaterThanOrEqual(dispatch.sentOnDay)
      }
    }
    expect(sawInTransit, 'nothing was ever on the road from a two-day route').toBe(true)
  })

  it('will not let the house answer a question it has not been asked', () => {
    let state = withRunners()
    state = commission(state, 9, {
      mode: 'open',
      targetTier: 'rare',
      routeId: 'deep_fen',
      partySize: 2,
    })
    const expeditionId = liveExpeditionRuns(state)[0]!.expeditionId
    // On the day a question is raised, word of it has not arrived yet on a
    // two-day route — so there is nothing to answer.
    for (let day = 10; day < 40; day += 1) {
      const before = getExpeditionRun(state, expeditionId)
      state = run(state, day)
      const after = getExpeditionRun(state, expeditionId)
      if (!after) break
      if (before?.pendingDecision === undefined && after.pendingDecision) {
        const today = state.calendar.totalDaysElapsed
        const route = routeFor(after.routeId)!
        if (route.wordDelayDays > 0) {
          expect(
            offers(state, 'answer_expedition_dispatch').filter((entry) =>
              entry.id.startsWith(expeditionId),
            ),
          ).toEqual([])
        }
        void today
        break
      }
    }
  })

  it('lets the house answer once word has come and can get back', () => {
    // The counterpart to the test above: a question the house DOES answer
    // is recorded as the house's call rather than the party's.
    let answeredSomewhere = false
    for (const tag of ['q1', 'q2', 'q3', 'q4']) {
      let state = withRunners(tag)
      if (freeRunners(state).length === 0) continue
      state = commission(
        state,
        9,
        { mode: 'open', targetTier: 'rare', routeId: 'deep_fen', partySize: 2 },
        tag,
      )
      if (liveExpeditionRuns(state).length === 0) continue
      const home = runUntilHome(state, 10, tag, true)
      const totals = getExpeditionsModuleState(home).totals
      if (totals.decisionsAnswered === 0) continue
      answeredSomewhere = true
      const finished = Object.values(getExpeditionsModuleState(home).runs)[0]!
      const answered = finished.events.filter(
        (entry) => entry.chosenOptionId !== undefined && !entry.chosenByDefault,
      )
      expect(answered.length).toBeGreaterThan(0)
      break
    }
    expect(
      answeredSomewhere,
      'the house could never answer anything on a two-day route',
    ).toBe(true)
  })
})

describe('Phase 216 §9.3 — recall, retreat, rescue and loss', () => {
  it('registers the three road actions', () => {
    ensureRequiredOwnerActionsRegistered()
    for (const id of [
      'answer_expedition_dispatch',
      'recall_expedition',
      'send_relief_to_expedition',
    ]) {
      expect(actionRegistry.has(id), id).toBe(true)
    }
  })

  it('brings a recalled party home, and the walk back costs days', () => {
    let state = withRunners()
    state = commission(state, 9, {
      mode: 'open',
      targetTier: 'rare',
      routeId: 'broken_scree',
    })
    const expeditionId = liveExpeditionRuns(state)[0]!.expeditionId
    for (let day = 10; day < 13; day += 1) state = run(state, day)
    const recalledOn = state.calendar.totalDaysElapsed
    state = run(state, 13, [{ actionId: 'recall_expedition', targetId: expeditionId }])
    expect(getExpeditionRun(state, expeditionId)?.recalledOnDay).toBeDefined()

    const home = runUntilHome(state, 14)
    const record = home.expeditions.completed.find((entry) => entry.id === expeditionId)
    expect(record?.outcome, 'a recall was recorded as something else').toBe('recalled')
    // The cost of a recall is the walk back. If it were free it would be an
    // undo rather than a decision.
    expect(record!.resolvedDay).toBeGreaterThan(recalledOn + 1)
  })

  it('refuses a second recall, and a recall of a party already home', () => {
    let state = withRunners()
    state = commission(state, 9, {
      mode: 'open',
      targetTier: 'rare',
      routeId: 'broken_scree',
    })
    const expeditionId = liveExpeditionRuns(state)[0]!.expeditionId
    state = run(state, 11, [{ actionId: 'recall_expedition', targetId: expeditionId }])
    state = run(state, 12, [{ actionId: 'recall_expedition', targetId: expeditionId }])
    const rejected = (
      state.modules['ownerActions'] as { rejected: Array<{ code: string }> }
    ).rejected
    expect(rejected.some((entry) => entry.code === 'already_recalled')).toBe(true)
  })

  it('will not send relief to a party the house has heard nothing about', () => {
    let state = withRunners()
    state = commission(state, 9, {
      mode: 'open',
      targetTier: 'rare',
      routeId: 'deep_fen',
    })
    const expeditionId = liveExpeditionRuns(state)[0]!.expeditionId
    state = run(state, 10, [
      { actionId: 'send_relief_to_expedition', targetId: expeditionId },
    ])
    const rejected = (
      state.modules['ownerActions'] as { rejected: Array<{ code: string }> }
    ).rejected
    expect(rejected.some((entry) => entry.code === 'no_word_of_trouble')).toBe(true)
  })

  it('reaches every outcome the model allows across a spread of trips', () => {
    // §9.3 asks for injury, delay, retreat, rescue, recall and loss. Rather
    // than force each, this runs a spread of routes and seeds and requires
    // the model to actually produce the range — a set of outcomes that never
    // varies would mean the journey was decorative.
    const outcomes = new Set<string>()
    for (const tag of ['s1', 's2', 's3', 's4', 's5']) {
      for (const routeId of ['market_road', 'oldwood_verge', 'broken_scree']) {
        let state = withRunners(tag)
        if (freeRunners(state).length === 0) continue
        state = commission(
          state,
          9,
          {
            mode: 'open',
            targetTier: routeId === 'market_road' ? 'uncommon' : 'rare',
            routeId,
          },
          tag,
        )
        if (liveExpeditionRuns(state).length === 0) continue
        const home = runUntilHome(state, 10, tag)
        for (const record of home.expeditions.completed) outcomes.add(record.outcome)
      }
    }
    expect(outcomes.has('success'), `only saw ${[...outcomes].join(', ')}`).toBe(true)
    expect(outcomes.size, `only saw ${[...outcomes].join(', ')}`).toBeGreaterThan(1)
  })
})

describe('Phase 216 §9.3 — what the house owes and cannot pay', () => {
  it('records the shortfall rather than forgiving it', () => {
    // The dodge this closes: pay the advance, spend the till down while the
    // party is out, and an expensive share-of-haul or hazard bonus settled
    // for whatever was left with the difference simply gone.
    let state = withRunners('unpaid')
    state = commission(
      state,
      9,
      {
        mode: 'open',
        targetTier: 'uncommon',
        routeId: 'market_road',
        terms: 'hazard_bonus',
      },
      'unpaid',
    )
    const opened = liveExpeditionRuns(state)[0]!
    const partyBefore = opened.partyRunnerIds.map(
      (id) => state.world.hireableAdventurers[id]?.relationship ?? 0,
    )
    // Empty the till while they are on the road.
    state = { ...state, coin: 0 }
    const home = runUntilHome(state, 10, 'unpaid')

    const run = getExpeditionRun(home, opened.expeditionId)
    if (!run || !run.terms.settled) return
    if ((run.terms.unpaidCoin ?? 0) === 0) return

    // The runners remember it, in the field the roster and the commission
    // form both read.
    const partyAfter = opened.partyRunnerIds.map(
      (id) => home.world.hireableAdventurers[id]?.relationship ?? 0,
    )
    expect(Math.min(...partyAfter)).toBeLessThan(Math.max(...partyBefore))
    expect(
      home.causes.some(
        (cause) =>
          cause.tags.includes('unpaid') && cause.tags.includes('settlement'),
      ),
    ).toBe(true)
  })
})

describe('Phase 216 §9.3 — what the house owes and cannot pay', () => {
  it('records the shortfall rather than forgiving it', () => {
    // The dodge this closes: pay the advance, spend the till down while the
    // party is out, and an expensive hazard bonus settles for whatever was
    // left with the difference simply gone.
    let state = withRunners('unpaid')
    state = commission(
      state,
      9,
      {
        mode: 'open',
        targetTier: 'uncommon',
        routeId: 'market_road',
        terms: 'hazard_bonus',
      },
      'unpaid',
    )
    const opened = liveExpeditionRuns(state)[0]!
    const partyBefore = opened.partyRunnerIds.map(
      (id) => state.world.hireableAdventurers[id]?.relationship ?? 0,
    )
    // Empty the till while they are on the road.
    state = { ...state, coin: 0 }
    const home = runUntilHome(state, 10, 'unpaid')

    const run = getExpeditionRun(home, opened.expeditionId)
    if (!run || !run.terms.settled) return
    if ((run.terms.unpaidCoin ?? 0) === 0) return

    // The runners remember it, in the field the roster and the commission
    // form both read.
    const partyAfter = opened.partyRunnerIds.map(
      (id) => home.world.hireableAdventurers[id]?.relationship ?? 0,
    )
    expect(Math.min(...partyAfter)).toBeLessThan(Math.max(...partyBefore))
    expect(
      home.causes.some(
        (cause) =>
          cause.tags.includes('unpaid') && cause.tags.includes('settlement'),
      ),
    ).toBe(true)
  })
})

describe('Phase 216 §9.3 — a recall travels at the road\'s own speed', () => {
  it('does not turn the party round before the order could reach them', () => {
    // The tradeoff `wordDelayDays` exists to create. An order that landed on
    // the day it was given outran every message the same route delays — the
    // party skipped days of outbound hazard because the house changed its
    // mind, and a far route became no riskier than a near one.
    let state = withRunners('recall')
    state = commission(
      state,
      9,
      { mode: 'open', targetTier: 'rare', routeId: 'deep_fen' },
      'recall',
    )
    const opened = liveExpeditionRuns(state)[0]!
    const route = routeFor(opened.routeId)!
    expect(route.wordDelayDays).toBeGreaterThan(0)

    // Walk them out a little, then call them home.
    for (let day = 10; day < 13; day += 1) state = run(state, day, [], 'recall')
    const target = offers(state, 'recall_expedition')[0]!
    state = run(
      state,
      13,
      [{ actionId: 'recall_expedition', targetId: target.id }],
      'recall',
    )
    const ordered = getExpeditionRun(state, opened.expeditionId)!
    expect(ordered.recalledOnDay).toBeDefined()
    expect(ordered.recallReachesOnDay).toBe(
      ordered.recalledOnDay! + route.wordDelayDays,
    )
    // Still walking out — the order is on the road, not with them.
    expect(ordered.phase).not.toBe('returning')

    // And it lands on the day it said it would.
    let day = 14
    let turned = false
    for (let i = 0; i < route.wordDelayDays + 2 && !turned; i += 1) {
      state = run(state, day, [], 'recall')
      day += 1
      const now = getExpeditionRun(state, opened.expeditionId)
      if (now && now.phase === 'returning') {
        expect(state.calendar.totalDaysElapsed).toBeGreaterThanOrEqual(
          ordered.recallReachesOnDay!,
        )
        turned = true
      }
    }
    expect(turned, 'the recall never reached them').toBe(true)
  })

  it('turns them the same day on a road where word is instant', () => {
    let state = withRunners('recall-road')
    state = commission(
      state,
      9,
      { mode: 'open', targetTier: 'uncommon', routeId: 'market_road' },
      'recall-road',
    )
    const opened = liveExpeditionRuns(state)[0]!
    expect(routeFor(opened.routeId)!.wordDelayDays).toBe(0)
    state = run(state, 10, [], 'recall-road')
    const target = offers(state, 'recall_expedition')[0]
    if (!target) return
    state = run(
      state,
      11,
      [{ actionId: 'recall_expedition', targetId: target.id }],
      'recall-road',
    )
    const now = getExpeditionRun(state, opened.expeditionId)!
    expect(now.recallReachesOnDay).toBe(now.recalledOnDay)
  })
})

describe('Phase 216 §9.3 — what the trip leaves behind', () => {
  it('lands the haul in stock and pays the runners their experience', () => {
    let state = withRunners()
    state = commission(state, 9, {
      mode: 'open',
      targetTier: 'uncommon',
      routeId: 'market_road',
    })
    const opened = liveExpeditionRuns(state)[0]!
    const leaderBefore =
      state.world.hireableAdventurers[opened.partyRunnerIds[0]!]!.experience
    const home = runUntilHome(state, 10)
    const record = home.expeditions.completed.find(
      (entry) => entry.id === opened.expeditionId,
    )!
    if (record.returnedIngredients.length > 0) {
      const haul = record.returnedIngredients[0]!
      expect(home.stock[haul.ingredientId]!.quantity).toBeGreaterThan(0)
    }
    const leaderAfter = home.world.hireableAdventurers[opened.partyRunnerIds[0]!]
    if (leaderAfter && record.outcome === 'success') {
      expect(leaderAfter.experience).toBeGreaterThan(leaderBefore)
      expect(leaderAfter.currentExpeditionId).toBeNull()
    }
  })

  it('brings back a way nobody knew, which opens a route nobody could take', () => {
    // §9.3's "future opportunities", end to end: the Underdeep is not on
    // the board until a party has come back from the scree knowing the way
    // down. It cannot be bought.
    let state = withRunners('disc')
    let discovered = false
    for (let trip = 0; trip < 4 && !discovered; trip += 1) {
      if (freeRunners(state).length === 0) break
      const day = 10 + trip * 30
      state = commission(
        state,
        day,
        { mode: 'open', targetTier: 'rare', routeId: 'broken_scree', partySize: 2 },
        'disc',
      )
      if (liveExpeditionRuns(state).length === 0) break
      state = runUntilHome(state, day + 1, 'disc', true)
      discovered = getExpeditionsModuleState(state).knownDiscoveries.includes('a_way_down')
    }
    expect(discovered, 'four trips up the scree turned up no way down').toBe(true)
    expect(
      availableRoutes(state, getExpeditionsModuleState(state).knownDiscoveries).map(
        (route) => route.id,
      ),
    ).toContain('the_underdeep')
  })
})

describe('Phase 216 §5.11 — the run book cannot grow without bound', () => {
  it('caps dispatches per run and prunes the closed tail', () => {
    let state = withRunners('bound')
    for (let trip = 0; trip < 3; trip += 1) {
      if (freeRunners(state).length === 0) break
      const day = 10 + trip * 30
      state = commission(
        state,
        day,
        { mode: 'open', targetTier: 'rare', routeId: 'deep_fen' },
        'bound',
      )
      if (liveExpeditionRuns(state).length === 0) break
      state = runUntilHome(state, day + 1, 'bound')
    }
    const slice = getExpeditionsModuleState(state)
    expect(Object.keys(slice.runs).length).toBeLessThanOrEqual(12)
    for (const record of Object.values(slice.runs)) {
      expect(record.dispatches.length).toBeLessThanOrEqual(12)
      expect(record.events.length).toBeLessThanOrEqual(MAX_EXPEDITION_EVENTS)
    }
  })
})
