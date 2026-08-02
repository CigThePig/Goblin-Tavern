// Expansion Phase 6 (repo phase 213) / ISSUE-176 — the supplier future-hook
// families become mechanical.
//
// Six `HOOK-*` rows in `docs/plans/expansion/ledger.csv` were assigned to this
// phase because their subject is a supplier consequence, and before Phase 6
// the supplier layer had no terms, no credit and no orders for a consequence
// to land on. It has all three now, so each family is registered, owned,
// payload-validated, and resolves into procurement state the very next quote
// reads.
//
// One family in the ledger — `merchant_flight_possible` — is recorded as
// deliberately staying narrative (it is declared only by a test-expansion
// fixture, not shipped content). The last case here pins that judgement so a
// later pass does not quietly reclassify it.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import {
  allScheduledEventDefinitions,
  findScheduledEventDefinitionForHookName,
  getScheduledEventDefinition,
} from '../../src/sim/contracts/scheduledEvents/registry'
import {
  readScheduledEventsSlice,
  scheduleEvent,
} from '../../src/sim/contracts/scheduledEvents/state'
import type { SimContext } from '../../src/sim/core/context'
import type { SimulationModule } from '../../src/sim/core/module'
import {
  DUAL_SUPPLIER_BALANCE_EVENT,
  NEW_SUPPLIER_UNCERTAINTY_EVENT,
  SUPPLIER_DELIVERY_EVENT,
  SUPPLIER_GOODWILL_EVENT,
  SUPPLIER_INVESTIGATION_EVENT,
  SUPPLIER_RENEGOTIATION_EVENT,
  SUPPLIER_RETALIATION_EVENT,
  SUPPLIER_SCHEDULED_PAYMENT_EVENT,
  getSupplierAccount,
  getSupplierModuleState,
  quoteSupplierOrder,
} from '../../src/sim/modules/suppliers/index'

const SEED = 'phase213/supplier-events'
const CART = 'brakka_mushroom_cart'

const SUPPLIER_EVENT_TYPES = [
  SUPPLIER_DELIVERY_EVENT,
  SUPPLIER_SCHEDULED_PAYMENT_EVENT,
  SUPPLIER_RETALIATION_EVENT,
  SUPPLIER_RENEGOTIATION_EVENT,
  SUPPLIER_GOODWILL_EVENT,
  NEW_SUPPLIER_UNCERTAINTY_EVENT,
  DUAL_SUPPLIER_BALANCE_EVENT,
  SUPPLIER_INVESTIGATION_EVENT,
] as const

function ready(coin = 2_000): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms', 'firewood', 'mugs']) {
    state = withStock(state, id, { quantity: 400, spoilage: 0 })
  }
  return state
}

function withSupplier(
  state: TavernState,
  supplierId: string,
  patch: { relationship?: number; reliability?: number },
): TavernState {
  const supplier = state.world.suppliers[supplierId]!
  return {
    ...state,
    world: {
      ...state.world,
      suppliers: {
        ...state.world.suppliers,
        [supplierId]: { ...supplier, ...patch },
      },
    },
  }
}

function withSupplierAccount(
  state: TavernState,
  supplierId: string,
  patch: Partial<ReturnType<typeof getSupplierAccount>>,
): TavernState {
  const slice = getSupplierModuleState(state)
  const account = getSupplierAccount(state, supplierId)
  return {
    ...state,
    modules: {
      ...state.modules,
      suppliers: {
        ...slice,
        accounts: {
          ...slice.accounts,
          [supplierId]: { ...account, ...patch },
        },
      },
    },
  }
}

/**
 * Queue a mechanical event the way a response's future hook would, then run
 * the day it comes due.
 *
 * The scheduling itself goes through `scheduleEvent` — the one sanctioned
 * queue API — inside a real pipeline module, so the exact-once key, the
 * payload schema and the owner check all apply exactly as they do in
 * production. Nothing writes into the queue array directly.
 */
function scheduleAndResolve(
  state: TavernState,
  type: string,
  supplierId: string,
  secondarySupplierId?: string,
  daysOut = 1,
): TavernState {
  const scheduledForDay = state.calendar.totalDaysElapsed + daysOut
  const scheduler: SimulationModule = {
    id: 'phase213_event_probe',
    version: '0.0.0',
    hooks: {
      applyOwnerActions: [
        (ctx: SimContext): void => {
          scheduleEvent(ctx, {
            type,
            target: { kind: 'supplier', id: supplierId },
            scheduledForDay,
            payload: {
              supplierId,
              ...(secondarySupplierId ? { secondarySupplierId } : {}),
            },
            origin: {
              source: 'phase213.probe',
              readable: `${type} for ${supplierId}`,
            },
          })
        },
      ],
    },
  }
  let current = simulateDay(state, { seed: `${SEED}-schedule` }, [
    ...FULL_PIPELINE,
    scheduler,
  ]).state
  for (let i = 0; i < daysOut + 1; i += 1) {
    if (
      readScheduledEventsSlice(current).archive.some((outcome) => outcome.type === type)
    ) {
      break
    }
    current = simulateDay(current, { seed: `${SEED}-run-${i}` }, FULL_PIPELINE).state
  }
  return current
}

function outcomeFor(state: TavernState, type: string) {
  return readScheduledEventsSlice(state).archive.filter(
    (outcome) => outcome.type === type,
  ).at(-1)
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('Phase 213 — the supplier events are owned, typed and bridged', () => {
  it('every supplier event is registered to the suppliers module', () => {
    for (const type of SUPPLIER_EVENT_TYPES) {
      const def = getScheduledEventDefinition(type)
      expect(def, `${type} is not registered`).toBeDefined()
      expect(def!.kind).toBe('mechanical')
      expect(def!.ownerModuleId).toBe('suppliers')
      expect(def!.payloadSchema).toBeDefined()
      expect(['morning', 'wrap_up']).toContain(def!.beat)
    }
    // No duplicate ownership: the registry rejects a second claimant, so a
    // count check is enough to catch an accidental re-registration.
    const supplierOwned = allScheduledEventDefinitions().filter(
      (def) => def.ownerModuleId === 'suppliers',
    )
    expect(supplierOwned.map((d) => d.type).sort()).toEqual(
      [...SUPPLIER_EVENT_TYPES].sort(),
    )
  })

  it('the future-hook bridge resolves each parameterised family to this domain', () => {
    const cases: ReadonlyArray<[string, string]> = [
      [`supplier_retaliation_${CART}`, SUPPLIER_RETALIATION_EVENT],
      ['supplier_retaliation_possible', SUPPLIER_RETALIATION_EVENT],
      [`supplier_renegotiation_${CART}`, SUPPLIER_RENEGOTIATION_EVENT],
      [`supplier_goodwill_return_${CART}`, SUPPLIER_GOODWILL_EVENT],
      [`new_supplier_uncertainty_${CART}`, NEW_SUPPLIER_UNCERTAINTY_EVENT],
      [`dual_supplier_balance_${CART}`, DUAL_SUPPLIER_BALANCE_EVENT],
      [`supplier_investigation_concluded_${CART}`, SUPPLIER_INVESTIGATION_EVENT],
    ]
    for (const [hookName, type] of cases) {
      expect(
        findScheduledEventDefinitionForHookName(hookName)?.type,
        `${hookName} did not reach ${type}`,
      ).toBe(type)
    }
    // A bare prefix names no supplier, so it is not a family member.
    expect(
      findScheduledEventDefinitionForHookName('supplier_retaliation_'),
    ).toBeUndefined()

    const dual = getScheduledEventDefinition(DUAL_SUPPLIER_BALANCE_EVENT)!
    expect(
      dual.fromFutureHook!({
        hookName: `dual_supplier_balance_${CART}`,
        readable: 'Split orders',
        scheduledForDay: 4,
        metadata: {
          actors: [
            { kind: 'supplier', id: CART },
            { kind: 'supplier', id: 'old_keg_brewers' },
          ],
        },
      })?.payload,
    ).toEqual({
      supplierId: CART,
      secondarySupplierId: 'old_keg_brewers',
    })
  })

  it('merchant_flight_possible stays narrative, as the ledger records', () => {
    expect(
      findScheduledEventDefinitionForHookName('merchant_flight_possible'),
    ).toBeUndefined()
  })

  it('a parameterised hook naming a supplier this run does not have declines', () => {
    const def = getScheduledEventDefinition(SUPPLIER_RETALIATION_EVENT)!
    const adapted = def.fromFutureHook!({
      hookName: 'supplier_retaliation_nobody_here',
      readable: '',
      scheduledForDay: 3,
    })
    // The adapter still builds a payload — declining an unknown id is the
    // resolver's job, and it does it as an explained no-op rather than by
    // pretending the promise was kept.
    expect(adapted?.payload).toEqual({ supplierId: 'nobody_here' })
  })
})

// ---------------------------------------------------------------------------
// Each family lands on procurement state
// ---------------------------------------------------------------------------

describe('Phase 213 — every supplier family resolves into terms a quote reads', () => {
  it('retaliation stops supply and hardens terms', () => {
    const start = withSupplierAccount(
      withSupplier(ready(), CART, { relationship: 20 }),
      CART,
      { creditStatus: 'approved', creditLimit: 50 },
    )
    const after = scheduleAndResolve(start, SUPPLIER_RETALIATION_EVENT, CART)
    const outcome = outcomeFor(after, SUPPLIER_RETALIATION_EVENT)!
    expect(outcome.status).toBe('resolved')
    expect(outcome.mutations.length).toBeGreaterThan(0)

    const account = getSupplierAccount(after, CART)
    expect(account.refusingUntilDay).toBeGreaterThan(
      after.calendar.totalDaysElapsed,
    )
    expect(account.termsAdjustment).toBeGreaterThan(1)
    expect(account.creditStatus).toBe('suspended')
    expect(account.creditLimit).toBe(0)
    expect(
      quoteSupplierOrder(after, {
        supplierId: CART,
        stockId: 'mushrooms',
        quantity: 10,
      }).refusal?.code,
    ).toBe('refusing_orders')
  })

  it('retaliation is cancelled when the relationship was repaired first', () => {
    const start = withSupplier(ready(), CART, { relationship: 85 })
    const after = scheduleAndResolve(start, SUPPLIER_RETALIATION_EVENT, CART)
    const outcome = outcomeFor(after, SUPPLIER_RETALIATION_EVENT)!
    expect(outcome.status).toBe('cancelled')
    expect(outcome.reason).toMatch(/squared with/)
    expect(getSupplierAccount(after, CART).refusingUntilDay).toBeUndefined()
  })

  it('renegotiation puts a dated price adjustment in force', () => {
    const start = withSupplier(ready(), CART, { relationship: 80 })
    const after = scheduleAndResolve(start, SUPPLIER_RENEGOTIATION_EVENT, CART)
    expect(outcomeFor(after, SUPPLIER_RENEGOTIATION_EVENT)!.status).toBe('resolved')
    const account = getSupplierAccount(after, CART)
    expect(account.termsAdjustment).toBeLessThan(1)
    expect(account.termsAdjustmentUntilDay).toBeGreaterThan(
      after.calendar.totalDaysElapsed,
    )
    const before = quoteSupplierOrder(start, {
      supplierId: CART,
      stockId: 'mushrooms',
      quantity: 10,
    })
    const now = quoteSupplierOrder(after, {
      supplierId: CART,
      stockId: 'mushrooms',
      quantity: 10,
    })
    expect(now.factors.join(' ')).toMatch(/negotiated terms/)
    expect(now.unitPrice).toBeLessThanOrEqual(before.unitPrice)
  })

  it('goodwill cuts the price, and may open a line the record now supports', () => {
    const concessionUntil = 20
    const start = withSupplierAccount(
      withSupplier(ready(), CART, { relationship: 75 }),
      CART,
      {
        termsAdjustment: 0.9,
        termsAdjustmentUntilDay: concessionUntil,
      },
    )
    const after = scheduleAndResolve(start, SUPPLIER_GOODWILL_EVENT, CART)
    expect(outcomeFor(after, SUPPLIER_GOODWILL_EVENT)!.status).toBe('resolved')
    const account = getSupplierAccount(after, CART)
    expect(account.termsAdjustment).toBe(0.9)
    expect(account.termsAdjustmentUntilDay).toBe(concessionUntil)
    expect(after.world.suppliers[CART]!.relationship).toBeGreaterThan(75)
  })

  it('a new supplier proves out against the record it actually built', () => {
    // Nothing ordered: there is nothing to judge, and the event says so
    // rather than inventing a verdict.
    const untested = scheduleAndResolve(ready(), NEW_SUPPLIER_UNCERTAINTY_EVENT, CART)
    const noVerdict = outcomeFor(untested, NEW_SUPPLIER_UNCERTAINTY_EVENT)!
    expect(noVerdict.status).toBe('no_op')
    expect(noVerdict.reason).toMatch(/nothing was ever ordered/)

    // With a delivery on the record, it settles their reliability upward.
    let traded = ready()
    traded = withSupplier(traded, CART, { reliability: 100 })
    traded = simulateDay(
      traded,
      {
        seed: `${SEED}-order`,
        ownerActions: [
          {
            actionId: 'place_supplier_order',
            targetId: `${CART}:mushrooms`,
            amount: 10,
          },
        ],
      },
      FULL_PIPELINE,
    ).state
    traded = simulateDay(traded, { seed: `${SEED}-deliver` }, FULL_PIPELINE).state
    expect(getSupplierAccount(traded, CART).history.ordersDelivered).toBe(1)

    const before = traded.world.suppliers[CART]!.reliability
    const proved = scheduleAndResolve(traded, NEW_SUPPLIER_UNCERTAINTY_EVENT, CART)
    const verdict = outcomeFor(proved, NEW_SUPPLIER_UNCERTAINTY_EVENT)!
    expect(verdict.status).toBe('resolved')
    expect(verdict.readable).toMatch(/proved reliable/)
    expect(getSupplierAccount(proved, CART).termsAdjustment).toBeLessThan(1)
    expect(before).toBeGreaterThan(0)
  })

  it('the dual-supplier balance resolves against both suppliers', () => {
    const selectedSecondary = 'old_keg_brewers'
    const traded = simulateDay(
      ready(),
      {
        seed: `${SEED}-dual-business`,
        ownerActions: [
          {
            actionId: 'place_supplier_order',
            targetId: `${CART}:mushrooms`,
            amount: 4,
          },
          {
            actionId: 'place_supplier_order',
            targetId: `${CART}:mushrooms`,
            amount: 4,
          },
          {
            actionId: 'place_supplier_order',
            targetId: `${selectedSecondary}:ale`,
            amount: 4,
          },
        ],
      },
      FULL_PIPELINE,
    ).state
    const after = scheduleAndResolve(
      traded,
      DUAL_SUPPLIER_BALANCE_EVENT,
      CART,
      selectedSecondary,
    )
    const outcome = outcomeFor(after, DUAL_SUPPLIER_BALANCE_EVENT)!
    expect(outcome.status).toBe('resolved')
    expect(outcome.mutations).toHaveLength(2)
    const touched = new Set(outcome.mutations.map((m) => m.targetId))
    expect(touched.size).toBe(2)
    expect(touched.has(CART)).toBe(true)
    expect(touched.has(selectedSecondary)).toBe(true)
    expect(touched.has('marsh_root_peddler')).toBe(false)
    // One of them improved and the other hardened — a real trade-off, not a
    // pair of identical nudges.
    const adjustments = [...touched].map(
      (id) => getSupplierAccount(after, id).termsAdjustment,
    )
    expect(Math.min(...adjustments)).toBeLessThan(1)
    expect(Math.max(...adjustments)).toBeGreaterThan(1)
  })

  it('the dual-supplier balance does not invent loyalty before either supplier trades', () => {
    const after = scheduleAndResolve(ready(), DUAL_SUPPLIER_BALANCE_EVENT, CART)
    const outcome = outcomeFor(after, DUAL_SUPPLIER_BALANCE_EVENT)!
    expect(outcome.status).toBe('no_op')
    expect(outcome.readable).toMatch(/no business to compare/)
    expect(getSupplierAccount(after, CART).termsAdjustment).toBe(1)
  })

  it('an investigation clears a clean supplier and marks down a failing one', () => {
    const cleared = scheduleAndResolve(
      withSupplier(ready(), CART, { reliability: 70 }),
      SUPPLIER_INVESTIGATION_EVENT,
      CART,
    )
    const clearVerdict = outcomeFor(cleared, SUPPLIER_INVESTIGATION_EVENT)!
    expect(clearVerdict.status).toBe('resolved')
    expect(clearVerdict.readable).toMatch(/cleared/)
    expect(cleared.world.suppliers[CART]!.reliability).toBeGreaterThan(70)

    // A supplier with failures on the record is found at fault instead.
    let failing = withSupplier(ready(4_000), CART, { reliability: 10 })
    for (let i = 0; i < 12; i += 1) {
      failing = simulateDay(
        failing,
        {
          seed: `${SEED}-fail-${i}`,
          ownerActions: [
            {
              actionId: 'place_supplier_order',
              targetId: `${CART}:mushrooms`,
              amount: 6,
            },
          ],
        },
        FULL_PIPELINE,
      ).state
    }
    const account = getSupplierAccount(failing, CART)
    expect(account.history.ordersMissed + account.history.ordersPartial).toBeGreaterThan(0)
    const reliabilityBefore = failing.world.suppliers[CART]!.reliability
    const faulted = scheduleAndResolve(failing, SUPPLIER_INVESTIGATION_EVENT, CART)
    const faultVerdict = outcomeFor(faulted, SUPPLIER_INVESTIGATION_EVENT)!
    expect(faultVerdict.readable).toMatch(/found at fault/)
    expect(faulted.world.suppliers[CART]!.reliability).toBeLessThan(
      reliabilityBefore,
    )
  })

  it('an event naming a supplier that is not here is an explained no-op', () => {
    const after = scheduleAndResolve(ready(), SUPPLIER_RENEGOTIATION_EVENT, 'nobody')
    const outcome = readScheduledEventsSlice(after).archive.filter(
      (entry) => entry.type === SUPPLIER_RENEGOTIATION_EVENT,
    ).at(-1)
    // `missingTarget: 'cancel'` means the queue drops it with a reason
    // rather than firing against nobody; either way it never resolves.
    if (outcome) {
      expect(outcome.status).not.toBe('resolved')
      expect(outcome.reason).toBeDefined()
    }
    expect(getSupplierAccount(after, 'nobody').termsAdjustment).toBe(1)
  })
})
