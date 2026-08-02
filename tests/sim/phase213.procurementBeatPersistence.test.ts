// Expansion Phase 6 (repo phase 213) / ISSUE-176 — §5.7, §5.9 and §5.10 for
// the procurement lifecycle.
//
// The work protocol makes three standing demands of every phase:
//
//   §5.7  a schema migration in the same phase as any persisted field
//   §5.9  full-day versus segmented equivalence for affected routes
//   §5.10 at least one save/reload at every day beat the new lifecycle crosses
//
// Phase 6's lifecycle crosses:
//
//   morning         the per-day reset, and `supplier_delivery_due`
//   applyOwnerActions  placing / amending / cancelling / paying
//   supplierUpdate  credit review, terms expiry, relationship drift
//   wrap_up         `supplier_scheduled_payment`
//
// On the engine's three segments those are `morning` + `applyOwnerActions` +
// `supplierUpdate` in A, and `wrap_up` in C. So a reload at each of the five
// player beats covers all four — and this file does it with a LIVE ORDER and
// a LIVE INVOICE in flight, because a reload with nothing on order proves
// nothing about orders.
//
// The route runs through the real persistence layer (`saveSession` /
// `loadSession`), so the migration chain and the schema are exercised on the
// way through.

import { describe, expect, it } from 'vitest'

import {
  SAVE_VERSION,
  loadSession,
  saveSession,
  setStorageForTesting,
  type PersistedSession,
  type StorageLike,
} from '../../web/src/lib/sim/persistence'
import type { Beat, DaySegment } from '../../web/src/lib/sim/daySession'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { advanceDaySegment, simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import { safeValidateState } from '../../src/sim/state/validation'
import {
  ensureModuleSlices,
  ensureSupplierProcurementFields,
} from '../../src/sim/state/migrations'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import {
  createInitialSupplierModuleState,
  getSupplierAccount,
  getSupplierModuleState,
  listPurchaseOrders,
} from '../../src/sim/modules/suppliers/index'
import {
  listSupplierInvoices,
  outstandingSupplierInvoices,
} from '../../src/sim/modules/suppliers/invoices'

class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>()
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v)
  }
  removeItem(k: string): void {
    this.map.delete(k)
  }
}

const SEED = 'phase213/procurement-beats'
const CART = 'brakka_mushroom_cart'
const CARAVAN = 'silken_road_caravan'

const BEATS: ReadonlyArray<{ beat: Beat; segment: DaySegment }> = [
  { beat: 'morning', segment: 'A' },
  { beat: 'plan', segment: 'A' },
  { beat: 'service', segment: 'B' },
  { beat: 'closing', segment: 'B' },
  { beat: 'report', segment: 'C' },
]

function input(day: number, actions?: SimInput['ownerActions']): SimInput {
  return {
    seed: `${SEED}-d${day}`,
    ...(actions && actions.length > 0 ? { ownerActions: [...actions] } : {}),
  }
}

function sessionAt(
  state: TavernState,
  beat: Beat,
  segment: DaySegment,
): PersistedSession {
  return {
    saveVersion: SAVE_VERSION,
    savedAt: '2026-08-02T00:00:00.000Z',
    simSeed: SEED,
    state,
    picks: [],
    staffPriorities: {},
    pendingBySeedId: {},
    daySession: {
      beat,
      segment,
      serviceComplete: segment !== 'A',
      closingComplete: segment === 'C',
    },
    route: 'day',
  }
}

function roundTrip(state: TavernState, beat: Beat, segment: DaySegment): TavernState {
  setStorageForTesting(new MemoryStorage())
  try {
    const saved = saveSession(sessionAt(state, beat, segment))
    expect(saved.ok, saved.ok ? '' : saved.reason).toBe(true)
    const outcome = loadSession()
    expect(outcome.kind).toBe('loaded')
    if (outcome.kind !== 'loaded') throw new Error('load failed')
    return outcome.save.state
  } finally {
    setStorageForTesting(undefined)
  }
}

function plain(state: TavernState): unknown {
  return JSON.parse(JSON.stringify(state))
}

/**
 * A tavern mid-procurement: an unpaid invoice from a delivered order, an
 * open credit line, and a long-lead order still in flight.
 */
function tavernMidProcurement(): TavernState {
  let state = withCoin(createInitialTavernState(), 3_000)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms', 'firewood', 'mugs']) {
    state = withStock(state, id, { quantity: 400, spoilage: 0 })
  }
  // Reliable suppliers: this file is about persistence, not about whether a
  // delivery happened to land.
  state = {
    ...state,
    world: {
      ...state.world,
      suppliers: Object.fromEntries(
        Object.entries(state.world.suppliers).map(([id, supplier]) => [
          id,
          { ...supplier, reliability: 100 },
        ]),
      ),
    },
  }

  // A cash order that completes, so credit becomes available.
  state = simulateDay(
    state,
    input(0, [
      { actionId: 'place_supplier_order', targetId: `${CART}:mushrooms`, amount: 20 },
    ]),
    FULL_PIPELINE,
  ).state
  for (let d = 1; d < 6; d += 1) {
    if (outstandingSupplierInvoices(state, CART).length > 0) {
      state = simulateDay(
        state,
        input(d, [{ actionId: 'pay_supplier_invoice', targetId: CART }]),
        FULL_PIPELINE,
      ).state
      break
    }
    state = simulateDay(state, input(d), FULL_PIPELINE).state
  }
  state = simulateDay(
    state,
    input(6, [{ actionId: 'request_supplier_credit', targetId: CART }]),
    FULL_PIPELINE,
  ).state
  expect(getSupplierAccount(state, CART).creditStatus).toBe('approved')

  // A credit order that delivers, leaving a live invoice…
  state = simulateDay(
    state,
    input(7, [
      {
        actionId: 'place_supplier_order',
        targetId: `${CART}:mushrooms`,
        amount: 20,
        options: { onCredit: true },
      },
    ]),
    FULL_PIPELINE,
  ).state
  state = simulateDay(state, input(8), FULL_PIPELINE).state
  state = simulateDay(state, input(9), FULL_PIPELINE).state
  expect(outstandingSupplierInvoices(state, CART).length).toBeGreaterThan(0)

  // …and a long-lead order still in flight.
  state = simulateDay(
    state,
    input(10, [
      {
        actionId: 'place_supplier_order',
        targetId: `${CARAVAN}:ingredients`,
        amount: 20,
      },
    ]),
    FULL_PIPELINE,
  ).state
  expect(listPurchaseOrders(state, { open: true }).length).toBeGreaterThan(0)
  return state
}

describe('Phase 213 §5.10 — reload at every beat the procurement lifecycle crosses', () => {
  it('round-trips a mid-procurement tavern unchanged at each of the five beats', () => {
    const start = tavernMidProcurement()
    const inp = input(11)
    const afterA = advanceDaySegment(start, inp, FULL_PIPELINE, 'A').state
    const afterB = advanceDaySegment(afterA, inp, FULL_PIPELINE, 'B', {
      dayBaseline: start,
    }).state
    const afterC = advanceDaySegment(afterB, inp, FULL_PIPELINE, 'C', {
      dayBaseline: start,
    }).state
    const stateFor: Record<DaySegment, TavernState> = {
      A: afterA,
      B: afterB,
      C: afterC,
    }

    for (const { beat, segment } of BEATS) {
      const restored = roundTrip(stateFor[segment], beat, segment)
      expect(plain(restored), `beat ${beat} did not round-trip`).toEqual(
        plain(stateFor[segment]),
      )
      // Spot-check the fields this phase added, so a future codec change
      // that drops one fails here rather than silently losing an order.
      const before = getSupplierModuleState(stateFor[segment])
      const after = getSupplierModuleState(restored)
      expect(Object.keys(after.orders)).toEqual(Object.keys(before.orders))
      expect(after.orderArchive.length).toBe(before.orderArchive.length)
      expect(after.accounts[CART]).toEqual(before.accounts[CART])
      expect(after.totals).toEqual(before.totals)
      expect(listSupplierInvoices(restored, CART)).toEqual(
        listSupplierInvoices(stateFor[segment], CART),
      )
    }
  })

  it('a reload at any beat leaves the rest of the day identical', () => {
    const start = tavernMidProcurement()
    const inp = input(12)

    const straight = advanceDaySegment(
      advanceDaySegment(
        advanceDaySegment(start, inp, FULL_PIPELINE, 'A').state,
        inp,
        FULL_PIPELINE,
        'B',
        { dayBaseline: start },
      ).state,
      inp,
      FULL_PIPELINE,
      'C',
      { dayBaseline: start },
    ).state

    const afterA = advanceDaySegment(start, inp, FULL_PIPELINE, 'A').state
    const reloadedA = roundTrip(afterA, 'plan', 'A')
    const viaReload = advanceDaySegment(
      advanceDaySegment(reloadedA, inp, FULL_PIPELINE, 'B', {
        dayBaseline: start,
      }).state,
      inp,
      FULL_PIPELINE,
      'C',
      { dayBaseline: start },
    ).state

    expect(plain(viaReload)).toEqual(plain(straight))
  })

  it('a delivery does not fire twice across a reload on its promised day', () => {
    // Save on the morning the caravan is due, reload, and finish the day.
    // The exact-once key is (order, promised day), so the reload must not be
    // able to buy the same goods twice or raise a second invoice for them.
    let state = tavernMidProcurement()
    const order = listPurchaseOrders(state, { open: true }).find(
      (o) => o.supplierId === CARAVAN,
    )!
    while (state.calendar.totalDaysElapsed < order.promisedOnDay) {
      state = simulateDay(
        state,
        input(state.calendar.totalDaysElapsed + 20),
        FULL_PIPELINE,
      ).state
    }

    const inp = input(40)
    const afterA = advanceDaySegment(state, inp, FULL_PIPELINE, 'A').state
    const deliveriesOnce = getSupplierModuleState(afterA).deliveriesToday.filter(
      (d) => d.supplierId === CARAVAN,
    )
    expect(deliveriesOnce.length).toBe(1)
    const unitsOnce = getSupplierModuleState(afterA).totals.unitsDelivered
    const invoicesOnce = listSupplierInvoices(afterA).length

    // Reload mid-day and finish. Nothing re-delivers.
    const reloaded = roundTrip(afterA, 'plan', 'A')
    const finished = advanceDaySegment(
      advanceDaySegment(reloaded, inp, FULL_PIPELINE, 'B', {
        dayBaseline: state,
      }).state,
      inp,
      FULL_PIPELINE,
      'C',
      { dayBaseline: state },
    ).state
    expect(getSupplierModuleState(finished).totals.unitsDelivered).toBe(unitsOnce)
    expect(
      getSupplierModuleState(finished).deliveriesToday.filter(
        (d) => d.supplierId === CARAVAN,
      ).length,
    ).toBe(1)
    expect(listSupplierInvoices(finished).length).toBe(invoicesOnce)

    // And re-running the next day from the reloaded state does not either.
    const nextDay = simulateDay(finished, input(41), FULL_PIPELINE).state
    expect(getSupplierModuleState(nextDay).totals.unitsDelivered).toBe(unitsOnce)
  })
})

describe('Phase 213 §5.9 — full-day and segmented routes agree', () => {
  it('placing, paying and receiving produce the same state either way', () => {
    const start = tavernMidProcurement()
    const actions: NonNullable<SimInput['ownerActions']> = [
      { actionId: 'pay_supplier_invoice', targetId: CART },
      {
        actionId: 'place_supplier_order',
        targetId: `${CART}:mushrooms`,
        amount: 12,
      },
    ]
    const inp = input(50, actions)

    const full = simulateDay(start, inp, FULL_PIPELINE).state
    const segmented = advanceDaySegment(
      advanceDaySegment(
        advanceDaySegment(start, inp, FULL_PIPELINE, 'A').state,
        inp,
        FULL_PIPELINE,
        'B',
        { dayBaseline: start },
      ).state,
      inp,
      FULL_PIPELINE,
      'C',
      { dayBaseline: start },
    ).state

    expect(plain(segmented)).toEqual(plain(full))
  })
})

describe('Phase 213 §5.7 — a pre-Phase-6 save migrates forward', () => {
  it('adds the procurement fields to an existing suppliers slice without inventing credit', () => {
    const current = createInitialTavernState()
    // A pre-Phase-6 save: the suppliers slice exists and holds only the four
    // Phase 29 per-day arrays.
    const legacy = {
      ...current,
      modules: {
        ...current.modules,
        suppliers: {
          activeMarketConditions: [],
          deliveriesToday: [],
          priceAdjustmentsToday: [],
          missedDeliveriesToday: [],
        },
      },
    } as unknown as TavernState

    // Untouched, it does not validate: the schema requires the new fields.
    expect(
      safeValidateState(legacy, { modules: FULL_PIPELINE }).success,
    ).toBe(false)

    const migrated = ensureModuleSlices(ensureSupplierProcurementFields(legacy))
    expect(safeValidateState(migrated, { modules: FULL_PIPELINE }).success).toBe(
      true,
    )

    const slice = getSupplierModuleState(migrated)
    const blank = createInitialSupplierModuleState()
    expect(slice.orders).toEqual({})
    expect(slice.orderArchive).toEqual([])
    expect(slice.accounts).toEqual({})
    expect(slice.spotPurchasesToday).toEqual({})
    expect(slice.nextOrderSuffix).toBe(0)
    expect(slice.totals).toEqual(blank.totals)

    // No save gains a credit line it never asked for.
    for (const supplierId of Object.keys(migrated.world.suppliers)) {
      expect(getSupplierAccount(migrated, supplierId).creditStatus).toBe('none')
      expect(getSupplierAccount(migrated, supplierId).creditLimit).toBe(0)
    }

    // Running the migrated save is ordinary: the module seeds blank accounts
    // and the player can start the procurement loop where a new one does.
    const played = simulateDay(migrated, input(60), FULL_PIPELINE).state
    expect(
      Object.keys(getSupplierModuleState(played).accounts).sort(),
    ).toEqual(Object.keys(played.world.suppliers).sort())
    expect(safeValidateState(played, { modules: FULL_PIPELINE }).success).toBe(true)
  })

  it('is a no-op on a save that already has the fields', () => {
    const current = createInitialTavernState()
    expect(ensureSupplierProcurementFields(current)).toBe(current)
  })
})
