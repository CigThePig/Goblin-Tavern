// Expansion Phase 6 (repo phase 213) / ISSUE-176 — §6.3 credit and invoices,
// and the §6.2 factors that decide a supplier's terms.
//
// `OBL-04` is the obligation these close: supplier credit and a weekly
// invoice list were surfaced while nothing produced an invoice or paid one.
// So the cases below walk the whole credit lifecycle — denial, approval,
// use, lateness, default, supply suspension, recovery and renegotiation —
// through registered owner actions on the real pipeline, and check the two
// places the old surface lied: the shared obligation ledger and the weekly
// invoice block.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import { getOwnerActionsModuleState } from '../../src/sim/modules/ownerActions/index'
import { getWeeklyModuleState } from '../../src/sim/modules/weekly/state'
import { getEconomyModuleState } from '../../src/sim/modules/economy/index'
import {
  creditEligibility,
  creditLimitFor,
  getSupplierAccount,
  listPurchaseOrders,
  quoteSupplierOrder,
  supplierGrievance,
} from '../../src/sim/modules/suppliers/index'
import {
  listSupplierInvoices,
  outstandingSupplierInvoices,
  overdueSupplierInvoices,
} from '../../src/sim/modules/suppliers/invoices'
import {
  ATTRIBUTION_MODULE_ID,
  createInitialAttributionModuleState,
} from '../../src/sim/modules/attribution/attributionModule'
import type { AttributionState } from '../../src/sim/modules/attribution/attributionTypes'

const SEED = 'phase213/supplier-credit'
const CART = 'brakka_mushroom_cart'

type Actions = NonNullable<SimInput['ownerActions']>

/**
 * A solvent, stocked tavern whose suppliers all keep their promises.
 *
 * Reliability is pinned at 100 on purpose: this file is about CREDIT, and a
 * 15% chance of a missed delivery would make every case here a coin-flip on
 * whether an invoice existed to test. Delivery reliability has its own
 * contract tests in `phase213.supplierOrders.test.ts`, where the roll is the
 * subject rather than the weather.
 */
function ready(coin = 2_000): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms', 'firewood', 'mugs']) {
    state = withStock(state, id, { quantity: 400, spoilage: 0 })
  }
  return {
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
}

function day(state: TavernState, n: number, actions?: Actions): TavernState {
  return simulateDay(
    state,
    {
      seed: `${SEED}-d${n}`,
      ...(actions && actions.length > 0 ? { ownerActions: [...actions] } : {}),
    },
    FULL_PIPELINE,
  ).state
}

function runDays(state: TavernState, count: number, from: number): TavernState {
  let current = state
  for (let i = 0; i < count; i += 1) current = day(current, from + i)
  return current
}

/** Run until the calendar has passed `targetDay`. `n` is only a seed suffix. */
function runThroughDay(
  state: TavernState,
  targetDay: number,
  from: number,
): TavernState {
  let current = state
  let i = 0
  while (current.calendar.totalDaysElapsed <= targetDay && i < 40) {
    current = day(current, from + i)
    i += 1
  }
  return current
}

function rejectionFor(state: TavernState, actionId: string): string | undefined {
  return getOwnerActionsModuleState(state).rejected.find(
    (r) => r.actionId === actionId,
  )?.reason
}

/**
 * A tavern that has traded once and settled the bill ON TIME.
 *
 * Paying promptly is the thing credit is granted on, so the helper waits for
 * the invoice to appear and pays it the same day rather than letting it slip
 * — a late settlement is a different starting position and gets its own
 * cases below.
 */
function tradedOnce(): TavernState {
  let state = ready()
  state = day(state, 0, [
    { actionId: 'place_supplier_order', targetId: `${CART}:mushrooms`, amount: 20 },
  ])
  for (let i = 1; i < 8; i += 1) {
    if (outstandingSupplierInvoices(state, CART).length > 0) {
      state = day(state, i, [
        { actionId: 'pay_supplier_invoice', targetId: CART },
      ])
      break
    }
    state = day(state, i)
  }
  expect(outstandingSupplierInvoices(state, CART)).toHaveLength(0)
  expect(getSupplierAccount(state, CART).history.onTimePayments).toBe(1)
  return state
}

function withCredit(): TavernState {
  const state = day(tradedOnce(), 10, [
    { actionId: 'request_supplier_credit', targetId: CART },
  ])
  expect(getSupplierAccount(state, CART).creditStatus).toBe('approved')
  return state
}

// ---------------------------------------------------------------------------
// §6.3 — eligibility, approval, use
// ---------------------------------------------------------------------------

describe('Phase 213 §6.3 — credit is asked for, granted, and earned', () => {
  it('a stranger is refused, and told exactly what is missing', () => {
    const state = ready()
    const eligibility = creditEligibility(state, CART)
    expect(eligibility.eligible).toBe(false)
    expect(eligibility.reason).toMatch(/completed delivery/)

    const after = day(state, 0, [
      { actionId: 'request_supplier_credit', targetId: CART },
    ])
    // The action is refused BEFORE the player spends the day on it, and the
    // reason names the condition that would change the answer.
    expect(rejectionFor(after, 'request_supplier_credit')).toMatch(
      /completed delivery/,
    )
    expect(getSupplierAccount(after, CART).creditStatus).toBe('none')
  })

  it('a supplier with a poor relationship will not extend credit at all', () => {
    // Crystalspine start at relationship 30, below the line.
    const eligibility = creditEligibility(ready(), 'crystalspine_traders')
    expect(eligibility.eligible).toBe(false)
    expect(eligibility.reason).toMatch(/relationship 40 or better/)
  })

  it('a completed delivery earns a line, sized by relationship and record', () => {
    const state = withCredit()
    const account = getSupplierAccount(state, CART)
    expect(account.creditStatus).toBe('approved')
    expect(account.creditLimit).toBeGreaterThan(0)
    expect(account.netTermDays).toBeGreaterThanOrEqual(3)
    // The line is real: an order can now be placed with nothing up front.
    const quote = quoteSupplierOrder(state, {
      supplierId: CART,
      stockId: 'mushrooms',
      quantity: 10,
      onCredit: true,
    })
    expect(quote.paymentTerms).toBe('net')
    expect(quote.dueAtPlacement).toBe(0)
    expect(quote.invoicedOnDelivery).toBe(quote.totalPrice)
  })

  it('the limit is a limit: an order above the free balance is refused', () => {
    // Fill most of the line with a real credit purchase, then ask for more
    // than what is left. Capacity caps a single order's size, so exhausting
    // the line takes an invoice sitting against it rather than one giant ask.
    let state = withCredit()
    state = day(state, 11, [
      {
        actionId: 'place_supplier_order',
        targetId: `${CART}:mushrooms`,
        amount: 30,
        options: { onCredit: true },
      },
    ])
    state = runDays(state, 3, 12)
    const used = outstandingSupplierInvoices(state, CART).reduce(
      (sum, invoice) => sum + invoice.outstanding,
      0,
    )
    expect(used).toBeGreaterThan(0)

    const account = getSupplierAccount(state, CART)
    const free = account.creditLimit - used
    const oversized = quoteSupplierOrder(state, {
      supplierId: CART,
      stockId: 'mushrooms',
      quantity: Math.max(5, Math.ceil(free) + 40),
      onCredit: true,
    })
    expect(oversized.refusal?.code).toBe('credit_limit_reached')
    expect(oversized.refusal?.reason).toMatch(/will carry \d+ more coin/)
  })

  it('a credit purchase appears in the day’s accounting and the weekly invoice block', () => {
    let state = withCredit()
    state = day(state, 11, [
      {
        actionId: 'place_supplier_order',
        targetId: `${CART}:mushrooms`,
        amount: 20,
        options: { onCredit: true },
      },
    ])
    const order = listPurchaseOrders(state)[0]!
    state = runThroughDay(state, order.promisedOnDay, 12)

    // The invoice exists in the shared ledger…
    const invoice = outstandingSupplierInvoices(state, CART).at(-1)!
    expect(invoice.principal).toBeGreaterThan(0)
    // …Phase 5's accrual bucket sees it as credit extended…
    const record = getEconomyModuleState(state).dailyHistory.find(
      (entry) => entry.accounting.creditPurchases > 0,
    )
    expect(record, 'no day reported a credit purchase').toBeDefined()
    // …and the weekly block is derived from those records rather than empty.
    state = runDays(state, 8, 30)
    const weekly = getWeeklyModuleState(state).lastWeeklyResult
    expect(weekly).toBeDefined()
    expect(
      getWeeklyModuleState(state).supplierInvoices.length +
        (weekly?.supplierInvoices.length ?? 0),
    ).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// §6.3 — lateness, default, supply suspension, recovery
// ---------------------------------------------------------------------------

describe('Phase 213 §6.3 — an unpaid invoice has consequences that end', () => {
  it('an unpaid invoice goes overdue, suspends the line, and then defaults it', () => {
    let state = withCredit()
    state = day(state, 11, [
      {
        actionId: 'place_supplier_order',
        targetId: `${CART}:mushrooms`,
        amount: 20,
        options: { onCredit: true },
      },
    ])
    state = runDays(state, 30, 12)

    const overdue = overdueSupplierInvoices(state, CART)
    expect(overdue.length).toBeGreaterThan(0)
    const account = getSupplierAccount(state, CART)
    expect(['suspended', 'revoked']).toContain(account.creditStatus)
    expect(account.creditLimit).toBe(0)
    expect(account.lastDecisionReason).toMatch(/past due|defaulted/)

    // Late charges accrued through the SHARED obligation machinery, not a
    // supplier-local reimplementation of it.
    const invoice = listSupplierInvoices(state, CART).at(-1)!
    expect(invoice.accruedCharges).toBeGreaterThanOrEqual(0)
    expect(invoice.escalation).toBeGreaterThan(0)
  })

  it('a debt in collections stops supply, and settling it starts supply again', () => {
    let state = withCredit()
    state = day(state, 11, [
      {
        actionId: 'place_supplier_order',
        targetId: `${CART}:mushrooms`,
        amount: 25,
        options: { onCredit: true },
      },
    ])
    state = runDays(state, 40, 12)

    const stopped = getSupplierAccount(state, CART)
    expect(stopped.refusingUntilDay).toBeDefined()
    const refused = quoteSupplierOrder(state, {
      supplierId: CART,
      stockId: 'mushrooms',
      quantity: 5,
    })
    expect(refused.refusal?.code).toBe('refusing_orders')

    // Pay everything off. The suspension is leverage to collect, not a
    // punishment that outlives the debt.
    for (let i = 0; i < 4; i += 1) {
      state = day(state, 100 + i, [
        { actionId: 'pay_supplier_invoice', targetId: CART },
      ])
    }
    expect(outstandingSupplierInvoices(state, CART)).toHaveLength(0)
    state = day(state, 110)
    const recovered = getSupplierAccount(state, CART)
    expect(recovered.refusingUntilDay).toBeUndefined()
    expect(
      quoteSupplierOrder(state, {
        supplierId: CART,
        stockId: 'mushrooms',
        quantity: 5,
      }).refusal,
    ).toBeUndefined()
  })

  it('a promised payment fires on its day and settles the invoice', () => {
    let state = withCredit()
    state = day(state, 11, [
      {
        actionId: 'place_supplier_order',
        targetId: `${CART}:mushrooms`,
        amount: 15,
        options: { onCredit: true },
      },
    ])
    const order = listPurchaseOrders(state)[0]!
    state = runThroughDay(state, order.promisedOnDay, 12)
    const invoice = outstandingSupplierInvoices(state, CART).at(-1)!

    state = day(state, 20, [
      {
        actionId: 'schedule_supplier_payment',
        targetId: CART,
        options: { inDays: 2 },
      },
    ])
    const applied = getOwnerActionsModuleState(state).applied.find(
      (a) => a.actionId === 'schedule_supplier_payment',
    )!
    expect(applied.data['status']).toBe('scheduled')
    // Nothing has moved yet — the promise is for a later day.
    expect(
      outstandingSupplierInvoices(state, CART).some((row) => row.id === invoice.id),
    ).toBe(true)

    state = runDays(state, 3, 21)
    expect(
      outstandingSupplierInvoices(state, CART).some((row) => row.id === invoice.id),
    ).toBe(false)
  })

  it('a promise made against the whole balance pays every invoice it names', () => {
    // The promise is offered as "what you owe this supplier", so two open
    // invoices have to be two invoices the promise clears. Attaching the
    // aggregate to the first invoice capped the payment at that invoice and
    // dropped the remainder on the day it came due.
    let state = withCredit()
    for (const [index, amount] of [12, 9].entries()) {
      state = day(state, 30 + index, [
        {
          actionId: 'place_supplier_order',
          targetId: `${CART}:mushrooms`,
          amount,
          options: { onCredit: true },
        },
      ])
      const placed = listPurchaseOrders(state).at(-1)!
      state = runThroughDay(state, placed.promisedOnDay, 40 + index * 10)
    }
    const open = outstandingSupplierInvoices(state, CART)
    expect(open.length).toBeGreaterThanOrEqual(2)
    const owed = open.reduce((sum, invoice) => sum + invoice.outstanding, 0)

    state = day(state, 60, [
      {
        actionId: 'schedule_supplier_payment',
        targetId: CART,
        amount: Math.ceil(owed),
        options: { inDays: 1 },
      },
    ])
    const applied = getOwnerActionsModuleState(state).applied.find(
      (a) => a.actionId === 'schedule_supplier_payment',
    )!
    expect(applied.data['amount']).toBe(Math.ceil(owed))

    state = runDays(state, 2, 61)
    expect(outstandingSupplierInvoices(state, CART)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// §6.2 — relationship and belief change the terms
// ---------------------------------------------------------------------------

describe('Phase 213 §6.2 — relationship and belief price the quote', () => {
  it('a warm supplier quotes cheaper than a cold one for the same good', () => {
    const state = ready()
    const warm = withRelationship(state, 'old_keg_brewers', 95)
    const cold = withRelationship(state, 'old_keg_brewers', 5)
    const warmQuote = quoteSupplierOrder(warm, {
      supplierId: 'old_keg_brewers',
      stockId: 'ale',
      quantity: 20,
    })
    const coldQuote = quoteSupplierOrder(cold, {
      supplierId: 'old_keg_brewers',
      stockId: 'ale',
      quantity: 20,
    })
    expect(warmQuote.unitPrice).toBeLessThan(coldQuote.unitPrice)
    // …and commits more capacity.
    expect(warmQuote.capacityAvailable).toBeGreaterThan(
      coldQuote.capacityAvailable,
    )
  })

  it('a supplier who blames the tavern charges it more', () => {
    const base = ready()
    const before = quoteSupplierOrder(base, {
      supplierId: 'old_keg_brewers',
      stockId: 'ale',
      quantity: 20,
    })
    // A held belief is ordinary state — the attribution rules mint these
    // from real causes all the time — so seeding one is a starting
    // condition, not impossible state. What is under test is that the quote
    // READS it, which is the §6.2 "beliefs and attribution" requirement.
    const resentful = withSupplierGrievance(base, 'old_keg_brewers')
    expect(supplierGrievance(resentful, 'old_keg_brewers')).toBeGreaterThan(0)
    const after = quoteSupplierOrder(resentful, {
      supplierId: 'old_keg_brewers',
      stockId: 'ale',
      quantity: 20,
    })
    expect(after.unitPrice).toBeGreaterThan(before.unitPrice)
    expect(after.factors.join(' ')).toMatch(/grievance/)
  })

  it('committed units eat into what a supplier can promise next', () => {
    let state = ready(4_000)
    const first = quoteSupplierOrder(state, {
      supplierId: 'old_keg_brewers',
      stockId: 'ale',
      quantity: 20,
    })
    state = day(state, 200, [
      { actionId: 'place_supplier_order', targetId: 'old_keg_brewers:ale', amount: 20 },
    ])
    const second = quoteSupplierOrder(state, {
      supplierId: 'old_keg_brewers',
      stockId: 'ale',
      quantity: 20,
    })
    expect(second.capacityAvailable).toBe(first.capacityAvailable - 20)
    expect(second.factors.join(' ')).toMatch(/20 units already on order/)
  })

  it('negotiation trades standing for a price break, and the break expires', () => {
    let state = withCredit()
    const before = quoteSupplierOrder(state, {
      supplierId: CART,
      stockId: 'mushrooms',
      quantity: 20,
    }).unitPrice

    state = day(state, 11, [
      { actionId: 'negotiate_supplier_terms', targetId: CART },
    ])
    const applied = getOwnerActionsModuleState(state).applied.find(
      (a) => a.actionId === 'negotiate_supplier_terms',
    )!
    expect(applied.data['agreed']).toBe(true)
    const account = getSupplierAccount(state, CART)
    expect(account.termsAdjustment).toBeLessThan(1)
    expect(account.termsAdjustmentUntilDay).toBeGreaterThan(
      state.calendar.totalDaysElapsed,
    )
    expect(
      quoteSupplierOrder(state, {
        supplierId: CART,
        stockId: 'mushrooms',
        quantity: 20,
      }).unitPrice,
    ).toBeLessThanOrEqual(before)

    // The concession is temporary; the terms revert on the stated day.
    const untilDay = account.termsAdjustmentUntilDay!
    state = runDays(state, untilDay - state.calendar.totalDaysElapsed + 1, 20)
    expect(getSupplierAccount(state, CART).termsAdjustment).toBe(1)

    // Repeating the negotiation is bounded by the supplier's live base
    // appetite; it cannot compound the previously negotiated line forever.
    const beforeRepeat = getSupplierAccount(state, CART)
    const boundedLimit = Math.round(
      creditLimitFor(state, state.world.suppliers[CART]!, beforeRepeat) * 1.4,
    )
    state = day(state, 80, [
      { actionId: 'negotiate_supplier_terms', targetId: CART },
    ])
    expect(getSupplierAccount(state, CART).creditLimit).toBeLessThanOrEqual(
      boundedLimit,
    )
  })

  it('a supplier will not discuss terms while an invoice is past due', () => {
    let state = withCredit()
    state = day(state, 11, [
      {
        actionId: 'place_supplier_order',
        targetId: `${CART}:mushrooms`,
        amount: 20,
        options: { onCredit: true },
      },
    ])
    state = runDays(state, 25, 12)
    expect(overdueSupplierInvoices(state, CART).length).toBeGreaterThan(0)
    const after = day(state, 100, [
      { actionId: 'negotiate_supplier_terms', targetId: CART },
    ])
    expect(rejectionFor(after, 'negotiate_supplier_terms')).toMatch(/past due/)
  })
})

function withRelationship(
  state: TavernState,
  supplierId: string,
  relationship: number,
): TavernState {
  const supplier = state.world.suppliers[supplierId]!
  return {
    ...state,
    world: {
      ...state.world,
      suppliers: {
        ...state.world.suppliers,
        [supplierId]: { ...supplier, relationship },
      },
    },
  }
}

function withSupplierGrievance(
  state: TavernState,
  supplierId: string,
): TavernState {
  const slice =
    (state.modules[ATTRIBUTION_MODULE_ID] as
      | { attributions: AttributionState[] }
      | undefined) ?? createInitialAttributionModuleState()
  const grievance: AttributionState = {
    id: `test-grievance-${supplierId}`,
    timestamp: {
      year: state.calendar.year,
      month: state.calendar.month,
      week: state.calendar.week,
      day: state.calendar.day,
      absoluteDay: state.calendar.totalDaysElapsed,
    },
    sourceCauseIds: [],
    sourceMemoryIds: [],
    sourceSceneIds: [],
    perceivedBy: { kind: 'supplier', id: supplierId },
    target: { kind: 'tavern_identity', id: 'the_crooked_keg' },
    attributionType: 'resentment',
    accuracy: 'true',
    strength: 90,
    confidence: 90,
    publicness: 40,
    volatility: 20,
    readable: 'They think the tavern shorted them.',
    tags: ['supplier'],
    relatedSystems: ['suppliers'],
    ageDays: 0,
  }
  return {
    ...state,
    modules: {
      ...state.modules,
      [ATTRIBUTION_MODULE_ID]: {
        ...slice,
        attributions: [...slice.attributions, grievance],
      },
    },
  }
}
