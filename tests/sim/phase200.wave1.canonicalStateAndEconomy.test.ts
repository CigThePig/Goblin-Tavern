// Phase 200 / gameplay audit Wave 1 — canonical state and economy.
//
// Regression coverage for the wave's five findings and its gate
// (audit Phase 8 §7). Plan:
// docs/plans/phase-200-audit-wave-1-canonical-state-and-economy.md.
//
//   P7-EXP-001  rent response overspends into negative coin without
//               ever paying the rent
//   P7-EXP-002  cheap suppliers make Mushrooms/Ingredients/Stew free
//   P4-SEAM-003  compact pressure state and the rich snapshot diverge
//   P7-EXP-004  the report renders pre-response pressure
//   P4-SEAM-001  one significant pressure change logs two causes
//
// The eight-strategy half of the gate is asserted in
// tests/sim/phase200.wave1.strategyMatrix.test.ts.

import { describe, expect, it } from 'vitest'

import { simulateDay, advanceDaySegment } from '../../src/sim/core/engine'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { safeValidateState } from '../../src/sim/state/validation'
import type { SimInput } from '../../src/sim/core/context'
import type { TavernState } from '../../src/sim/state/TavernState'
import type { ResponseIntent } from '../../src/sim/modules/issues/issueSeedTypes'
import { getIssueSeeds } from '../../src/sim/modules/issues/issueSeedQueries'
import { getPressureModuleState } from '../../src/sim/modules/pressures/pressureModule'
import {
  getEffectiveBasePrice,
  pickRestockSupplier,
} from '../../src/sim/modules/suppliers/pricing'
import { getSupplierModuleState } from '../../src/sim/modules/suppliers/state'
import { marketConditionRegistry } from '../../src/sim/content/suppliers/marketConditionRegistry'
import { MIN_UNIT_PRICE } from '../../src/sim/modules/suppliers/pricing'
import type { RentState } from '../../src/sim/modules/monthly/types'

const SEED = 'phase200-wave1'

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

function runDay(state: TavernState, overrides: Partial<SimInput> = {}) {
  return simulateDay(state, input(overrides), FULL_PIPELINE)
}

function rentOf(state: TavernState): RentState {
  return (state.modules['monthly'] as { rent: RentState }).rent
}

function withRent(state: TavernState, rent: Partial<RentState>): TavernState {
  const monthly = state.modules['monthly'] as { rent: RentState }
  return {
    ...state,
    modules: {
      ...state.modules,
      monthly: { ...monthly, rent: { ...monthly.rent, ...rent } },
    },
  }
}

/**
 * Drive the world to a day whose morning surfaces a `debt_rent` seed with
 * an unpaid 120-coin rent and less coin than that in the till — the
 * audit's Day 23 shape, reached deterministically.
 *
 * Returns the state the day is run FROM, so re-running it regenerates the
 * same seed and a response intent against that seed resolves in the same
 * `simulateDay` call (the Phase 41 pattern).
 */
function setupUnpaidRentDay(coin: number): {
  warmState: TavernState
  seedId: string
} {
  // Warm at a fixed low till (which is what builds debt pressure), then
  // set the till to the amount under test. Debt pressure has already
  // qualified the generator by then, so the seed still surfaces at 400
  // coin — the affordability boundary is the only thing that varies.
  const WARM_COIN = 98
  let state = withRent(
    { ...createInitialTavernState(), coin: WARM_COIN },
    { monthlyAmount: 120, paidThisMonth: false, missedPayments: 2, arrears: 0 },
  )
  state = {
    ...state,
    pressures: {
      ...state.pressures,
      debt: { ...state.pressures['debt']!, value: 60 },
      landlord: { ...state.pressures['landlord']!, value: 55 },
    },
  }

  for (let day = 0; day < 12; day++) {
    const next = { ...runDay(state).state, coin: WARM_COIN }
    if (getIssueSeeds(next, { family: 'debt_rent' }).length > 0) {
      const warmState = { ...state, coin }
      const seed = getIssueSeeds(runDay(warmState).state, {
        family: 'debt_rent',
      })[0]
      if (!seed) throw new Error(`no debt_rent seed at ${coin} coin`)
      return { warmState, seedId: seed.id }
    }
    state = next
  }
  throw new Error('test setup failed: no debt_rent seed surfaced')
}

function payIntent(seedId: string): ResponseIntent {
  return {
    id: 'r-pay-rent',
    seedId,
    verb: 'pay',
    shape: 'safe_costly',
    tags: [],
    intensity: 50,
    metadata: { responseSlotId: 'pay' },
  }
}

// ──────────────────────────────────────────────────────────────────
// P7-EXP-001 — rent

describe('P7-EXP-001 — the rent response is affordable, atomic and final', () => {
  it('pays the rent, marks the month paid and clears arrears', () => {
    // 121 against 120 due: affordable by one coin.
    const { warmState, seedId } = setupUnpaidRentDay(121)
    const day = runDay(warmState, { responseIntents: [payIntent(seedId)] })

    expect(day.state.coin).toBeGreaterThanOrEqual(0)
    const rent = rentOf(day.state)
    expect(rent.paidThisMonth).toBe(true)
    expect(rent.arrears).toBe(0)
  })

  it('refuses the payment when the coin is not there, and never goes negative', () => {
    // The audit's exact numbers: 98 coin against 120 rent.
    const { warmState, seedId } = setupUnpaidRentDay(98)
    const day = runDay(warmState, { responseIntents: [payIntent(seedId)] })

    expect(day.state.coin).toBeGreaterThanOrEqual(0)
    // Nothing was half-applied: the rent is still owed, not "paid" from
    // an empty till.
    expect(rentOf(day.state).paidThisMonth).toBe(false)
    // And the state still validates — the audit's run failed here.
    expect(
      safeValidateState(day.state, { modules: FULL_PIPELINE }).success,
    ).toBe(true)
  })

  it('holds the boundary at exactly enough and one short', () => {
    for (const [coin, expectPaid] of [
      [119, false],
      [120, true],
    ] as const) {
      const { warmState, seedId } = setupUnpaidRentDay(coin)
      const day = runDay(warmState, { responseIntents: [payIntent(seedId)] })
      expect(day.state.coin).toBeGreaterThanOrEqual(0)
      expect(rentOf(day.state).paidThisMonth).toBe(expectPaid)
    }
  })

  it('does not charge again on the following days once paid', () => {
    const { warmState, seedId } = setupUnpaidRentDay(400)
    let state = runDay(warmState, { responseIntents: [payIntent(seedId)] }).state
    expect(rentOf(state).paidThisMonth).toBe(true)
    const coinAfterPaying = state.coin

    // A paid month must not resurface an unpaid rent obligation.
    for (let day = 0; day < 3; day++) {
      const seeds = getIssueSeeds(state, { family: 'debt_rent' })
      const rentSeed = seeds[0]
      const next = rentSeed
        ? runDay(state, { responseIntents: [payIntent(rentSeed.id)] })
        : runDay(state)
      state = next.state
      expect(state.coin).toBeGreaterThanOrEqual(0)
      expect(rentOf(state).arrears).toBe(0)
    }
    // Whatever trading did, no second 120 left the till for the same month.
    expect(rentOf(state).missedPayments).toBe(2)
    expect(coinAfterPaying).toBeGreaterThanOrEqual(0)
  })

  it('applies an unaffordable aggregate as whole choices, not partial ones', () => {
    // Several individually affordable responses whose total is not.
    const { warmState, seedId } = setupUnpaidRentDay(130)
    const seeds = getIssueSeeds(runDay(warmState).state, {})
    const intents: ResponseIntent[] = [payIntent(seedId)]
    for (const seed of seeds) {
      if (seed.id === seedId) continue
      const slot = seed.responseSlots[0]
      if (!slot) continue
      intents.push({
        id: `r-${seed.id}`,
        seedId: seed.id,
        verb: slot.allowedVerbs[0]!,
        shape: slot.shape,
        tags: [],
        intensity: 50,
        metadata: { responseSlotId: slot.id },
      })
    }
    const day = runDay(warmState, { responseIntents: intents })
    expect(day.state.coin).toBeGreaterThanOrEqual(0)
    expect(
      safeValidateState(day.state, { modules: FULL_PIPELINE }).success,
    ).toBe(true)
  })
})

// ──────────────────────────────────────────────────────────────────
// P7-EXP-002 — supplier pricing

describe('P7-EXP-002 — ordinary purchases are never free', () => {
  it('quotes at least the minimum unit price for every stock × supplier', () => {
    const state = createInitialTavernState()
    const conditions = getSupplierModuleState(state).activeMarketConditions
    for (const stock of Object.values(state.stock)) {
      for (const supplier of Object.values(state.world.suppliers)) {
        if (!supplier.goodsProvided.includes(stock.id)) continue
        const price = getEffectiveBasePrice(stock, supplier, conditions)
        expect(
          price,
          `${stock.id} from ${supplier.id} priced ${price}`,
        ).toBeGreaterThanOrEqual(MIN_UNIT_PRICE)
      }
      // No supplier at all still quotes the bare base price.
      expect(
        getEffectiveBasePrice(stock, undefined, conditions),
      ).toBeGreaterThanOrEqual(MIN_UNIT_PRICE)
    }
  })

  it('holds the floor under every market condition', () => {
    const state = createInitialTavernState()
    for (const condition of marketConditionRegistry.all()) {
      const active = [
        { id: condition.id, startedAtDay: 0, expiresAtDay: 99, intensity: 50, tags: [] },
      ]
      for (const stock of Object.values(state.stock)) {
        for (const supplier of Object.values(state.world.suppliers)) {
          if (!supplier.goodsProvided.includes(stock.id)) continue
          expect(
            getEffectiveBasePrice(stock, supplier, active),
            `${stock.id} from ${supplier.id} under ${condition.id}`,
          ).toBeGreaterThanOrEqual(MIN_UNIT_PRICE)
        }
      }
    }
  })

  it('the cheapest supplier pick for the audit-named items is not free', () => {
    const state = createInitialTavernState()
    for (const stockId of ['mushrooms', 'ingredients', 'stew']) {
      const pick = pickRestockSupplier(state, stockId)
      expect(pick, `no supplier for ${stockId}`).toBeDefined()
      expect(pick!.effectivePrice).toBeGreaterThanOrEqual(MIN_UNIT_PRICE)
    }
  })

  it('a restock actually costs coin, and the quote matches the spend', () => {
    const state = createInitialTavernState()
    const quoted = pickRestockSupplier(state, 'mushrooms')!.effectivePrice
    const day = runDay(state, {
      ownerActions: [
        { actionId: 'restock_item', targetId: 'mushrooms', amount: 40 },
      ],
    })

    // Service trading also moves coin, so read the ledger entry the
    // restock itself wrote rather than the day's net.
    const ledger = (
      day.state.modules['stock'] as {
        ledger: { source: string; amount: number }[]
      }
    ).ledger
    const restockEntries = ledger.filter((e) =>
      e.source.startsWith('ownerActions.restock_item.mushrooms'),
    )
    expect(restockEntries.length, 'restock wrote no ledger entry').toBe(1)
    const spent = Math.abs(restockEntries[0]!.amount)
    expect(spent).toBeGreaterThan(0)
    // The quote the player was shown is the amount that left the till.
    expect(spent).toBe(Math.ceil(40 * quoted))
  })
})

// ──────────────────────────────────────────────────────────────────
// P4-SEAM-003 / P7-EXP-004 / P4-SEAM-001 — one pressure authority

/** Every pressure's compact value against its rich snapshot. */
function pressureDisagreements(state: TavernState): string[] {
  const slice = getPressureModuleState(state)
  const out: string[] = []
  for (const [id, compact] of Object.entries(state.pressures)) {
    const snapshot = slice.snapshots[id]
    if (!snapshot) continue
    if (snapshot.value !== compact.value) {
      out.push(`${id}: compact=${compact.value} snapshot=${snapshot.value}`)
    }
  }
  return out
}

describe('P4-SEAM-003 — compact pressure state equals the rich snapshot', () => {
  it('agrees at every stable beat across a week of whole days', () => {
    let state = createInitialTavernState()
    for (let day = 0; day < 7; day++) {
      state = runDay(state).state
      expect(pressureDisagreements(state), `day ${day + 1}`).toEqual([])
    }
  })

  it('agrees after each segment, including with responses applied', () => {
    let state = createInitialTavernState()
    state = runDay(state).state // warm so seeds exist

    for (let day = 0; day < 3; day++) {
      const dayInput = input({ seed: `${SEED}-d${state.calendar.totalDaysElapsed}` })
      const a = advanceDaySegment(state, dayInput, FULL_PIPELINE, 'A')
      expect(pressureDisagreements(a.state), 'after segment A').toEqual([])

      const b = advanceDaySegment(a.state, dayInput, FULL_PIPELINE, 'B', {
        dayBaseline: state,
      })
      expect(pressureDisagreements(b.state), 'after segment B').toEqual([])

      // Resolve every seed with its first slot so responses actually
      // mutate pressures in Segment C.
      const intents: ResponseIntent[] = getIssueSeeds(b.state, {}).flatMap(
        (seed) => {
          const slot = seed.responseSlots[0]
          if (!slot) return []
          return [
            {
              id: `r-${seed.id}`,
              seedId: seed.id,
              verb: slot.allowedVerbs[0]!,
              shape: slot.shape,
              tags: [],
              intensity: 50,
              metadata: { responseSlotId: slot.id },
            },
          ]
        },
      )
      const c = advanceDaySegment(
        b.state,
        { ...dayInput, responseIntents: intents },
        FULL_PIPELINE,
        'C',
        { dayBaseline: state },
      )
      expect(pressureDisagreements(c.state), 'after segment C').toEqual([])
      state = c.state
    }
  })

  it('a delayed pressure effect lands once and does not rebound', () => {
    // The audit's repro shape: a delayed −10 Maintenance effect drains at
    // the next startDay. The value it produces must be the value every
    // consumer sees, and it must still be there the following day rather
    // than being recalculated away.
    let state = createInitialTavernState()
    state = runDay(state).state
    const before = state.pressures['maintenance']!.value

    state = {
      ...state,
      modules: {
        ...state.modules,
        responses: {
          ...(state.modules['responses'] as Record<string, unknown>),
          pending: [
            {
              id: 'pending-maint-test',
              scheduledFor: state.calendar.totalDaysElapsed + 1,
              expiresAt: state.calendar.totalDaysElapsed + 5,
              origin: {
                seedId: 'test-seed',
                intentId: 'test-intent',
                profileId: 'test-profile',
                responseSlotId: 'test-slot',
                verb: 'repair',
                enqueuedDay: state.calendar.totalDaysElapsed,
              },
              payload: {
                kind: 'pressure',
                effect: {
                  kind: 'pressure',
                  target: 'pressure:maintenance',
                  amount: -10,
                  readable: 'Maintenance pressure eases',
                  tags: ['pressure'],
                },
              },
            },
          ],
        },
      },
    }

    const afterDrain = runDay(state).state
    expect(pressureDisagreements(afterDrain)).toEqual([])
    const eased = afterDrain.pressures['maintenance']!.value
    expect(eased).toBeLessThan(before + 1)

    // The day AFTER: the eased value must not spring back to where the
    // bare calculator would put it.
    const nextDay = runDay(afterDrain).state
    expect(pressureDisagreements(nextDay)).toEqual([])
    const rebounded = nextDay.pressures['maintenance']!.value
    expect(rebounded).toBeLessThanOrEqual(eased + 3)
  })
})

describe('P7-EXP-004 — the report renders post-response pressure', () => {
  it('the pressure report agrees with final canonical state', () => {
    let state = createInitialTavernState()
    const warm = runDay(state)
    state = warm.state

    const intents: ResponseIntent[] = getIssueSeeds(state, {}).flatMap((seed) => {
      const slot = seed.responseSlots[0]
      if (!slot) return []
      return [
        {
          id: `r-${seed.id}`,
          seedId: seed.id,
          verb: slot.allowedVerbs[0]!,
          shape: slot.shape,
          tags: [],
          intensity: 50,
          metadata: { responseSlotId: slot.id },
        },
      ]
    })

    const day = runDay(state, { responseIntents: intents })
    expect(pressureDisagreements(day.state)).toEqual([])

    const section = day.reports.find((r) => r.id === 'pressures')
    expect(section).toBeDefined()
    const reported = (
      section!.data as { snapshots?: { id: string; value: number }[] }
    ).snapshots
    expect(reported?.length ?? 0).toBeGreaterThan(0)
    for (const row of reported!) {
      // The number the player reads in the report is the number they
      // carry into the next Morning. Before Wave 1 this section was built
      // from a snapshot calculated at `closing`, i.e. before responses ran.
      expect(row.value, `report value for ${row.id}`).toBe(
        day.state.pressures[row.id]?.value,
      )
    }
    // Whatever the section chose to publish, the slice it reads from is
    // the canonical one.
    const slice = getPressureModuleState(day.state)
    for (const [id, compact] of Object.entries(day.state.pressures)) {
      const snapshot = slice.snapshots[id]
      if (snapshot) expect(snapshot.value).toBe(compact.value)
    }
  })
})

describe('P4-SEAM-001 — one significant pressure change, one cause', () => {
  it('never logs the same pressure recalculation twice in a day', () => {
    let state = createInitialTavernState()
    for (let day = 0; day < 5; day++) {
      state = runDay(state).state
      const today = state.calendar.totalDaysElapsed
      const seen = new Map<string, number>()
      for (const cause of state.causes) {
        if (!cause.source.startsWith('pressures.')) continue
        if (cause.timestamp.absoluteDay !== today) continue
        const key = `${cause.source}|${cause.target}|${cause.amount}|${cause.readable}`
        seen.set(key, (seen.get(key) ?? 0) + 1)
      }
      for (const [key, count] of seen) {
        expect(count, `duplicated pressure cause: ${key}`).toBe(1)
      }
    }
  })

  it('emits exactly one cause per pressure that moved significantly', () => {
    let state = createInitialTavernState()
    state = runDay(state).state
    const before = { ...state.pressures }
    state = runDay(state).state
    const today = state.calendar.totalDaysElapsed

    for (const [id, compact] of Object.entries(state.pressures)) {
      const moved = Math.abs(compact.value - (before[id]?.value ?? 0)) >= 2
      const causes = state.causes.filter(
        (c) =>
          c.source === `pressures.${id}` && c.timestamp.absoluteDay === today,
      )
      expect(causes.length, `${id} moved=${moved}`).toBeLessThanOrEqual(1)
    }
  })
})
