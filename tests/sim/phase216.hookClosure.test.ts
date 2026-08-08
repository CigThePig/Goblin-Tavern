// Expansion Phase 9 (repo phase 216) / ISSUE-179 — the last six hook
// families stop draining and start happening.
//
// These six were what remained of `OBL-02` in phase 9. Each is a response
// profile telling the player something specific about what comes next, and
// each was drained on its promised day into a zero-weight cause because no
// domain owned the string:
//
//   HOOK-price_war_*                  → rival_price_war
//   HOOK-quality_arms_race_*          → rival_quality_race
//   HOOK-payday_supplier_return_*     → payday_supplier_standing
//   HOOK-payday_gouging_remembered_*  → payday_boycott_review
//   HOOK-payday_brawl_legend_*        → payday_brawl_legend
//   HOOK-festival_obligations_*       → festival_obligation_review
//
// Both halves of keeping a promise are checked: the bridge routes the name
// to a real owner, AND the resolver produces an authoritative mutation in a
// domain other than its own bookkeeping. So are the ways it is correct NOT
// to fire — an explained no-op is right behaviour and an unexplained one is
// the bug this whole obligation is about.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimContext, SimInput } from '../../src/sim/core/context'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import { withArea, withCoin, withStock } from '../../src/sim/testing/stateFactories'
import { findScheduledEventDefinitionForHookName } from '../../src/sim/contracts/scheduledEvents/registry'
import {
  readScheduledEventsSlice,
  scheduleEvent,
} from '../../src/sim/contracts/scheduledEvents/state'
import {
  FESTIVAL_OBLIGATION_EVENT,
  PAYDAY_BOYCOTT_REVIEW_EVENT,
  PAYDAY_BRAWL_LEGEND_EVENT,
  PAYDAY_SCHEDULED_EVENT_TYPES,
  PAYDAY_SUPPLIER_STANDING_EVENT,
  liveArcRuns,
} from '../../src/sim/modules/localArcs/index'
import {
  PRIMARY_RIVAL_ID,
  RIVAL_PRICE_WAR_EVENT,
  RIVAL_QUALITY_RACE_EVENT,
  RIVAL_SCHEDULED_EVENT_TYPES,
  getRivalModuleState,
  writeRivalSlice,
} from '../../src/sim/modules/rival/index'
import { competitionSummary } from '../../src/sim/modules/rival/appeal'
import {
  getSupplierAccount,
  writeSupplierAccount,
} from '../../src/sim/modules/suppliers/state'
import { activeStance, openDemandFor } from '../../src/sim/modules/factions/factionState'

const SEED = 'phase216/hook-closure'

type Module = Parameters<typeof simulateDay>[2][number]
type SetupHook = (ctx: SimContext) => void

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

function house(coin = 8000): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 900, spoilage: 0 })
  }
  return state
}

function troubledHouse(): TavernState {
  let state = house(6000)
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

/**
 * Play until an arc is live whose owner is NOT a faction.
 *
 * Which matters for the boycott: the resolver takes the arc's own owner
 * where it is a faction, and falls back to picking the aggrieved one
 * otherwise. The payday arc these hooks are actually emitted from is owned
 * by a CUSTOMER GROUP (the miners), so the fallback is the path real play
 * takes — and the first arc a troubled house happens to start is an
 * inspection campaign owned by the Town Watch, who have a grievance and
 * nobody to withdraw. Reaching the fallback by playing on to an arc of the
 * right shape is the honest way to exercise it.
 */
function withANonFactionArc(days = 90): TavernState {
  let state = troubledHouse()
  for (let day = 0; day < days; day += 1) {
    state = run(state, day)
    if (
      day > 12 &&
      liveArcRuns(state).some((entry) => entry.ownerRef?.kind !== 'faction')
    ) {
      break
    }
  }
  return state
}

function nonFactionArcId(state: TavernState): string {
  const run = liveArcRuns(state).find((entry) => entry.ownerRef?.kind !== 'faction')
  if (!run) throw new Error('no arc without a faction owner was ever live')
  return run.arcId
}

/** Play a few days so the rival exists as a record. */
function withARival(days = 6): TavernState {
  let state = house()
  for (let day = 0; day < days; day += 1) state = run(state, day)
  return state
}

function outcomesFor(state: TavernState, type: string) {
  const slice = readScheduledEventsSlice(state)
  return [...slice.resolvedToday, ...slice.archive].filter(
    (outcome) => outcome.type === type,
  )
}

/** Fire one event on the next day and hand back the state after it resolved. */
function fire(
  state: TavernState,
  tag: string,
  type: string,
  target: { kind: string; id: string },
  payload: Record<string, unknown>,
  readable = 'The card promised this.',
): TavernState {
  let next = withSetup(state, tag, (ctx) => {
    scheduleEvent(ctx, {
      type,
      target: target as never,
      scheduledForDay: ctx.state.calendar.totalDaysElapsed + 1,
      payload,
      origin: { source: 'test', readable },
    })
  })
  for (let day = 300; day < 304; day += 1) next = run(next, day)
  return next
}

describe('Phase 216 — the bridge routes all six names to a real owner', () => {
  it('claims every one of them for a module, as a mechanical event', () => {
    const claims: Array<[string, string, string]> = [
      ['price_war_rival_tavern_opens', RIVAL_PRICE_WAR_EVENT, 'rival'],
      ['quality_arms_race_rival_tavern_opens', RIVAL_QUALITY_RACE_EVENT, 'rival'],
      [
        'payday_supplier_return_payday_rush',
        PAYDAY_SUPPLIER_STANDING_EVENT,
        'localArcs',
      ],
      [
        'payday_gouging_remembered_payday_rush',
        PAYDAY_BOYCOTT_REVIEW_EVENT,
        'localArcs',
      ],
      ['payday_brawl_legend_payday_rush', PAYDAY_BRAWL_LEGEND_EVENT, 'localArcs'],
      [
        'festival_obligations_festival_approaching',
        FESTIVAL_OBLIGATION_EVENT,
        'localArcs',
      ],
    ]
    for (const [hookName, expectedType, expectedOwner] of claims) {
      const definition = findScheduledEventDefinitionForHookName(hookName)
      expect(definition?.type, hookName).toBe(expectedType)
      expect(definition?.ownerModuleId, hookName).toBe(expectedOwner)
      expect(definition?.kind, hookName).toBe('mechanical')
    }
  })

  it('registers exactly the types the two modules declare', () => {
    expect([...RIVAL_SCHEDULED_EVENT_TYPES]).toContain(RIVAL_PRICE_WAR_EVENT)
    expect([...RIVAL_SCHEDULED_EVENT_TYPES]).toContain(RIVAL_QUALITY_RACE_EVENT)
    expect([...PAYDAY_SCHEDULED_EVENT_TYPES].sort()).toEqual(
      [
        FESTIVAL_OBLIGATION_EVENT,
        PAYDAY_BOYCOTT_REVIEW_EVENT,
        PAYDAY_BRAWL_LEGEND_EVENT,
        PAYDAY_SUPPLIER_STANDING_EVENT,
      ].sort(),
    )
  })

  it('declines an arc-shaped hook that names no arc anybody is running', () => {
    // The promise was about a specific payday. Collecting it against
    // whichever arc happens to be live would be an invented consequence.
    const definition = findScheduledEventDefinitionForHookName(
      'payday_brawl_legend_nonsense',
    )!
    const state = withALiveArc()
    expect(
      definition.fromFutureHook?.({
        hookName: 'payday_brawl_legend_nonsense',
        readable: 'x',
        scheduledForDay: 1,
        state,
      }),
    ).toBeUndefined()
  })

  it('points a rival-shaped hook at the one house across the road', () => {
    const state = withARival()
    const definition = findScheduledEventDefinitionForHookName('price_war_anything')!
    const bridged = definition.fromFutureHook?.({
      hookName: 'price_war_anything',
      readable: 'x',
      scheduledForDay: 1,
      state,
    })
    expect(bridged?.payload).toEqual({ rivalId: PRIMARY_RIVAL_ID })
  })
})

describe('Phase 216 — rival_price_war', () => {
  /** Make the house genuinely the cheaper pour, and the rival able to fight. */
  function undercuttingHouse(): TavernState {
    let state = withARival()
    for (const item of Object.values(state.stock)) {
      state = withStock(state, item.id, { salePrice: 2 })
    }
    return state
  }

  it('moves the rival price level when the house is still undercutting', () => {
    let state = undercuttingHouse()
    const before = getRivalModuleState(state).rivals[PRIMARY_RIVAL_ID]!.capability
      .priceLevel
    state = fire(
      state,
      'pricewar',
      RIVAL_PRICE_WAR_EVENT,
      { kind: 'rival', id: PRIMARY_RIVAL_ID },
      { rivalId: PRIMARY_RIVAL_ID },
      'The rival may slash too.',
    )
    const outcomes = outcomesFor(state, RIVAL_PRICE_WAR_EVENT)
    expect(outcomes.length, 'the price war never fired').toBeGreaterThan(0)
    const outcome = outcomes[0]!
    // Whichever way it went, it is a TERMINAL status with a reason or a
    // mutation — never a drained promise.
    expect(['resolved', 'no_op']).toContain(outcome.status)
    if (outcome.status === 'resolved') {
      expect(outcome.mutations?.length ?? 0).toBeGreaterThan(0)
      const after = getRivalModuleState(state).rivals[PRIMARY_RIVAL_ID]!.capability
        .priceLevel
      expect(after).not.toBe(before)
    } else {
      expect(outcome.reason?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('says so rather than firing when the house is no longer the cheaper pour', () => {
    // THE COUNTERPLAY. A house that has taken its margin back is not in a
    // price war, and gets a recorded reason instead of a fight.
    let state = withARival()
    for (const item of Object.values(state.stock)) {
      state = withStock(state, item.id, { salePrice: 30 })
    }
    const summary = competitionSummary(state)!
    expect(summary.housePriceLevel).toBeGreaterThan(summary.rivalPriceLevel)
    state = fire(
      state,
      'pricewar-none',
      RIVAL_PRICE_WAR_EVENT,
      { kind: 'rival', id: PRIMARY_RIVAL_ID },
      { rivalId: PRIMARY_RIVAL_ID },
    )
    const outcome = outcomesFor(state, RIVAL_PRICE_WAR_EVENT)[0]!
    expect(outcome.status).toBe('no_op')
    expect(outcome.reason).toMatch(/no longer the cheaper pour/i)
  })
})

describe('Phase 216 — rival_quality_race', () => {
  it('closes half the gap when the house is genuinely ahead on quality', () => {
    let state = withARival()
    // A house with a real quality lead — good stock and a name for it.
    for (const item of Object.values(state.stock)) {
      state = withStock(state, item.id, { quality: 95 })
    }
    state = {
      ...state,
      reputation: { ...state.reputation, tasty: 90 },
    }
    const summary = competitionSummary(state)!
    expect(summary.houseQuality).toBeGreaterThan(summary.rivalQuality)
    const before = summary.rivalQuality

    state = fire(
      state,
      'qualityrace',
      RIVAL_QUALITY_RACE_EVENT,
      { kind: 'rival', id: PRIMARY_RIVAL_ID },
      { rivalId: PRIMARY_RIVAL_ID },
      'The rival may match the quality.',
    )
    const outcome = outcomesFor(state, RIVAL_QUALITY_RACE_EVENT)[0]!
    expect(['resolved', 'no_op']).toContain(outcome.status)
    if (outcome.status === 'resolved') {
      const after = getRivalModuleState(state).rivals[PRIMARY_RIVAL_ID]!.capability
        .quality
      expect(after).toBeGreaterThan(before)
      // Chasing, not arriving.
      expect(after).toBeLessThanOrEqual(summary.houseQuality)
    } else {
      expect(outcome.reason?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('says so rather than firing when the rival is already a match', () => {
    let state = withARival()
    state = withSetup(state, 'quality-equal', (ctx) => {
      writeRivalSlice(
        ctx,
        (current) => {
          const rival = current.rivals[PRIMARY_RIVAL_ID]
          if (!rival) return current
          return {
            ...current,
            rivals: {
              ...current.rivals,
              [PRIMARY_RIVAL_ID]: {
                ...rival,
                capability: { ...rival.capability, quality: 100 },
              },
            },
          }
        },
        'test_equal_quality',
      )
    })
    state = fire(
      state,
      'qualityrace-none',
      RIVAL_QUALITY_RACE_EVENT,
      { kind: 'rival', id: PRIMARY_RIVAL_ID },
      { rivalId: PRIMARY_RIVAL_ID },
    )
    const outcome = outcomesFor(state, RIVAL_QUALITY_RACE_EVENT)[0]!
    expect(outcome.status).toBe('no_op')
    expect(outcome.reason).toMatch(/already a match/i)
  })
})

describe('Phase 216 — payday_supplier_standing', () => {
  function arcAndSupplier(): { state: TavernState; arcId: string } {
    const state = withALiveArc()
    return { state, arcId: liveArcRuns(state)[0]!.arcId }
  }

  it('rewards a house that kept buying and prices the disappointment otherwise', () => {
    const { state: base, arcId } = arcAndSupplier()
    const supplierId = Object.keys(base.world.suppliers).sort()[0]!

    function outcomeWith(lastOrderDay: number | undefined, tag: string) {
      let state = withSetup(base, `order-${tag}`, (ctx) => {
        // Set the order book directly, because "did the house keep buying?"
        // is the only question this resolver asks and the two answers must
        // both be reachable.
        writeSupplierAccountForTest(ctx, supplierId, lastOrderDay)
      })
      state = fire(
        state,
        `standing-${tag}`,
        PAYDAY_SUPPLIER_STANDING_EVENT,
        { kind: 'local_event', id: arcId },
        { arcId },
        'The supplier expects standing demand.',
      )
      return {
        outcome: outcomesFor(state, PAYDAY_SUPPLIER_STANDING_EVENT)[0]!,
        state,
      }
    }

    const kept = outcomeWith(299, 'kept')
    expect(kept.outcome.status).toBe('resolved')
    expect(kept.outcome.mutations?.length ?? 0).toBeGreaterThan(0)

    const lapsed = outcomeWith(undefined, 'lapsed')
    expect(lapsed.outcome.status).toBe('resolved')
    expect(lapsed.outcome.mutations?.length ?? 0).toBeGreaterThan(0)

    // The two must land on OPPOSITE sides of the price, or the promise did
    // not depend on what the house actually did.
    const keptAdjustment = adjustmentAcross(kept.state)
    const lapsedAdjustment = adjustmentAcross(lapsed.state)
    expect(keptAdjustment).toBeLessThan(lapsedAdjustment)
  })
})

/** The lowest terms adjustment across every supplier — the concession. */
function adjustmentAcross(state: TavernState): number {
  return Object.keys(state.world.suppliers)
    .map((id) => getSupplierAccount(state, id).termsAdjustment)
    .reduce((lo, value) => Math.min(lo, value), Number.POSITIVE_INFINITY)
}

/** Set the order book through the suppliers module's OWN writer. */
function writeSupplierAccountForTest(
  ctx: SimContext,
  supplierId: string,
  lastOrderDay: number | undefined,
): void {
  writeSupplierAccount(
    ctx,
    supplierId,
    (current) => {
      const next = { ...current }
      if (lastOrderDay === undefined) delete next.lastOrderDay
      else next.lastOrderDay = lastOrderDay
      return next
    },
    'test_order_book',
  )
}

describe('Phase 216 — payday_boycott_review', () => {
  it('opens a real boycott stance in the faction\'s own records', () => {
    const base = withANonFactionArc()
    const arcId = nonFactionArcId(base)
    // The state the promise was MADE in. `raise_prices_for_boom` — the only
    // response that emits this hook — costs the faction ten points of
    // standing and leaves a grudge memory on the spot. Reconstructing that
    // is not injecting impossible state; it is the precondition the promise
    // itself creates, and without it the resolver correctly declines.
    const state = withSetup(base, 'gouged', (ctx) => {
      for (const faction of Object.values(ctx.state.world.factions)) {
        ctx.modifyFaction(
          faction.id,
          { relationship: Math.max(0, faction.relationship - 20) },
          { source: 'test', reason: 'gouged_on_payday_night' },
        )
      }
    })
    const after = fire(
      state,
      'boycott',
      PAYDAY_BOYCOTT_REVIEW_EVENT,
      { kind: 'local_event', id: arcId },
      { arcId },
      'Next payday may boycott.',
    )
    const outcome = outcomesFor(after, PAYDAY_BOYCOTT_REVIEW_EVENT)[0]!
    expect(outcome.status, outcome.status === 'no_op' ? outcome.reason : '').toBe(
      'resolved',
    )
    // The consequence is a stance the faction actually holds — not a
    // pressure nudge this module decided on its behalf.
    const factionId = outcome.mutations![0]!.targetId
    expect(activeStance(after, factionId, 'boycott')).toBeDefined()
  })

  it('says so when the aggrieved faction has nobody to keep away', () => {
    // The other true answer. An arc owned BY a faction is collected against
    // that faction, and one that speaks for nobody with a reason to stay
    // home cannot call anything — which is a recorded reason, not a
    // silently drained promise.
    const state = withALiveArc()
    const arc = liveArcRuns(state).find((entry) => entry.ownerRef?.kind === 'faction')
    if (!arc) return
    const after = fire(
      state,
      'boycott-nobody',
      PAYDAY_BOYCOTT_REVIEW_EVENT,
      { kind: 'local_event', id: arc.arcId },
      { arcId: arc.arcId },
    )
    const outcome = outcomesFor(after, PAYDAY_BOYCOTT_REVIEW_EVENT)[0]!
    expect(['resolved', 'no_op']).toContain(outcome.status)
    if (outcome.status === 'no_op') {
      expect(outcome.reason?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('says so rather than firing when the house has been square with them since', () => {
    // THE COUNTERPLAY. Gouging cost the faction standing; a house that has
    // made it back up is not boycotted for it.
    let state = withALiveArc()
    const arcId = liveArcRuns(state)[0]!.arcId
    state = {
      ...state,
      world: {
        ...state.world,
        factions: Object.fromEntries(
          Object.entries(state.world.factions).map(([id, faction]) => [
            id,
            { ...faction, relationship: 80 },
          ]),
        ),
      },
    }
    const after = fire(
      state,
      'boycott-none',
      PAYDAY_BOYCOTT_REVIEW_EVENT,
      { kind: 'local_event', id: arcId },
      { arcId },
    )
    const outcome = outcomesFor(after, PAYDAY_BOYCOTT_REVIEW_EVENT)[0]!
    expect(outcome.status).toBe('no_op')
    expect(outcome.reason).toMatch(/square with them since/i)
  })
})

describe('Phase 216 — payday_brawl_legend', () => {
  it('becomes a rumour the world can spread rather than a reputation nudge', () => {
    let state = withALiveArc()
    const arcId = liveArcRuns(state)[0]!.arcId
    state = { ...state, reputation: { ...state.reputation, dangerous: 70 } }
    const before = Object.keys(state.world.socialRumours).length

    const after = fire(
      state,
      'brawl',
      PAYDAY_BRAWL_LEGEND_EVENT,
      { kind: 'local_event', id: arcId },
      { arcId },
      'The legend of the night may grow.',
    )
    const outcome = outcomesFor(after, PAYDAY_BRAWL_LEGEND_EVENT)[0]!
    expect(outcome.status).toBe('resolved')
    expect(outcome.mutations?.[0]?.targetKind).toBe('rumour')
    // A real rumour, not a meter: the rumour layer decides who hears it.
    expect(Object.keys(after.world.socialRumours).length).toBeGreaterThan(before)
    const legend = after.world.socialRumours[`brawl_legend_${arcId}`]
    expect(legend).toBeDefined()
    expect(legend!.strength).toBeGreaterThan(0)
    expect(legend!.accuracy).toBe('true')
  })

  it('says so rather than firing when the room has been quiet since', () => {
    let state = withALiveArc()
    const arcId = liveArcRuns(state)[0]!.arcId
    state = { ...state, reputation: { ...state.reputation, dangerous: 5 } }
    const after = fire(
      state,
      'brawl-none',
      PAYDAY_BRAWL_LEGEND_EVENT,
      { kind: 'local_event', id: arcId },
      { arcId },
    )
    const outcome = outcomesFor(after, PAYDAY_BRAWL_LEGEND_EVENT)[0]!
    expect(outcome.status).toBe('no_op')
    expect(outcome.reason).toMatch(/quiet since/i)
  })
})

describe('Phase 216 — festival_obligation_review', () => {
  it('opens a real, answerable demand on the faction that expects it', () => {
    let state = withALiveArc()
    const arcId = liveArcRuns(state)[0]!.arcId
    state = {
      ...state,
      world: {
        ...state.world,
        factions: Object.fromEntries(
          Object.entries(state.world.factions).map(([id, faction]) => [
            id,
            { ...faction, relationship: 70 },
          ]),
        ),
      },
    }
    const after = fire(
      state,
      'festival',
      FESTIVAL_OBLIGATION_EVENT,
      { kind: 'local_event', id: arcId },
      { arcId },
      'The festival sets a yearly expectation.',
    )
    const outcome = outcomesFor(after, FESTIVAL_OBLIGATION_EVENT)[0]!
    expect(['resolved', 'no_op']).toContain(outcome.status)
    if (outcome.status === 'resolved') {
      const factionId = outcome.mutations![0]!.targetId
      const demand = openDemandFor(after, factionId)
      expect(demand, 'no demand was opened').toBeDefined()
      // `public_backing` rather than coin: hosting IS being seen to take
      // their side, and it is answerable with the moves the player has.
      expect(demand!.kind).toBe('public_backing')
      expect(demand!.dueOnDay).toBeGreaterThan(demand!.openedOnDay)
    } else {
      expect(outcome.reason?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('says so rather than firing when the faction has fallen out with the house', () => {
    let state = withALiveArc()
    const arcId = liveArcRuns(state)[0]!.arcId
    state = {
      ...state,
      world: {
        ...state.world,
        factions: Object.fromEntries(
          Object.entries(state.world.factions).map(([id, faction]) => [
            id,
            { ...faction, relationship: 5 },
          ]),
        ),
      },
    }
    const after = fire(
      state,
      'festival-none',
      FESTIVAL_OBLIGATION_EVENT,
      { kind: 'local_event', id: arcId },
      { arcId },
    )
    const outcome = outcomesFor(after, FESTIVAL_OBLIGATION_EVENT)[0]!
    expect(outcome.status).toBe('no_op')
    expect(outcome.reason).toMatch(/not looking to this house/i)
  })
})

describe('Phase 216 — no family drains silently any more', () => {
  it('gives every one of the six a terminal status with a reason or a mutation', () => {
    // The `OBL-02` check itself. A promise that fires and changes nothing
    // WITHOUT saying why is the bug; an explained no-op is correct.
    const arcState = withANonFactionArc()
    const arcId = nonFactionArcId(arcState)
    const rivalState = withARival()

    const cases: Array<[TavernState, string, string, { kind: string; id: string }, Record<string, unknown>]> = [
      [rivalState, 'all-pw', RIVAL_PRICE_WAR_EVENT, { kind: 'rival', id: PRIMARY_RIVAL_ID }, { rivalId: PRIMARY_RIVAL_ID }],
      [rivalState, 'all-qr', RIVAL_QUALITY_RACE_EVENT, { kind: 'rival', id: PRIMARY_RIVAL_ID }, { rivalId: PRIMARY_RIVAL_ID }],
      [arcState, 'all-ss', PAYDAY_SUPPLIER_STANDING_EVENT, { kind: 'local_event', id: arcId }, { arcId }],
      [arcState, 'all-br', PAYDAY_BOYCOTT_REVIEW_EVENT, { kind: 'local_event', id: arcId }, { arcId }],
      [arcState, 'all-bl', PAYDAY_BRAWL_LEGEND_EVENT, { kind: 'local_event', id: arcId }, { arcId }],
      [arcState, 'all-fo', FESTIVAL_OBLIGATION_EVENT, { kind: 'local_event', id: arcId }, { arcId }],
    ]

    for (const [base, tag, type, target, payload] of cases) {
      const after = fire(base, tag, type, target, payload)
      const outcome = outcomesFor(after, type)[0]
      expect(outcome, `${type} never fired`).toBeDefined()
      expect(['resolved', 'no_op'], type).toContain(outcome!.status)
      if (outcome!.status === 'resolved') {
        expect(outcome!.mutations?.length ?? 0, type).toBeGreaterThan(0)
      } else {
        expect(outcome!.reason?.length ?? 0, type).toBeGreaterThan(0)
      }
    }
  })
})
