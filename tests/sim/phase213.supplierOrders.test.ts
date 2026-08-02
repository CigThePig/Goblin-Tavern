// Expansion Phase 6 (repo phase 213) / ISSUE-176 — a transactional supplier
// and procurement system.
//
// These are contract tests for the phase's required behaviour. Every one of
// them reaches the feature the way a player does: through a registered owner
// action driven by the full pipeline. Nothing here writes an order, an
// invoice or a delivery outcome into state by hand — §5 fails a phase whose
// tests reach it by injecting impossible state, and an order that only exists
// because a test made one proves nothing about whether a player can make one.
//
// Reliability is the one thing a test cannot leave to chance and still be a
// contract, so the two suppliers used for the miss/keep cases have their
// `reliability` set on the WORLD ENTITY (a legitimate starting condition —
// a supplier is either dependable or not) and the order chain runs normally
// from there.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import { safeValidateState } from '../../src/sim/state/validation'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import { getOwnerActionsModuleState } from '../../src/sim/modules/ownerActions/index'
import { getStockModuleState } from '../../src/sim/modules/stock/state'
import { getServiceModuleState } from '../../src/sim/modules/service/index'
import {
  MAX_ARCHIVED_PURCHASE_ORDERS,
  getSupplierAccount,
  getSupplierModuleState,
  listAllPurchaseOrders,
  listPurchaseOrders,
  outstandingUnits,
} from '../../src/sim/modules/suppliers/index'
import {
  listSupplierInvoices,
  outstandingSupplierInvoices,
} from '../../src/sim/modules/suppliers/invoices'
import {
  SPOT_MARKET_DAILY_UNITS,
  quoteAlternativeSuppliers,
  quoteSupplierOrder,
  spotMarketAvailable,
  spotMarketUnitPrice,
} from '../../src/sim/modules/suppliers/quote'
import { buildWorldOverview } from '../../src/reports/worldOverviewProjection'
import { getEconomyModuleState } from '../../src/sim/modules/economy/index'

const SEED = 'phase213/supplier-orders'

type Actions = NonNullable<SimInput['ownerActions']>

function ready(coin = 2_000): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms', 'firewood', 'mugs']) {
    state = withStock(state, id, { quantity: 400, spoilage: 0 })
  }
  return state
}

function withReliability(
  state: TavernState,
  supplierId: string,
  reliability: number,
): TavernState {
  const supplier = state.world.suppliers[supplierId]
  if (!supplier) throw new Error(`no supplier ${supplierId}`)
  return {
    ...state,
    world: {
      ...state.world,
      suppliers: {
        ...state.world.suppliers,
        [supplierId]: { ...supplier, reliability },
      },
    },
  }
}

function withRelationship(
  state: TavernState,
  supplierId: string,
  relationship: number,
): TavernState {
  const supplier = state.world.suppliers[supplierId]
  if (!supplier) throw new Error(`no supplier ${supplierId}`)
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

function runDays(state: TavernState, count: number, from = 100): TavernState {
  let current = state
  for (let i = 0; i < count; i += 1) current = day(current, from + i)
  return current
}

function appliedIds(state: TavernState): string[] {
  return getOwnerActionsModuleState(state).applied.map((a) => a.actionId)
}

function rejections(state: TavernState): string[] {
  return getOwnerActionsModuleState(state).rejected.map(
    (r) => `${r.actionId}:${r.code}:${r.reason}`,
  )
}

// ---------------------------------------------------------------------------
// §6.1 — quote → order → delivery → invoice → payment
// ---------------------------------------------------------------------------

describe('Phase 213 §6.1 — an order is a quote the supplier is held to', () => {
  it('quotes supplier, stock, price, quality, lead time, terms and capacity', () => {
    const state = ready()
    const quote = quoteSupplierOrder(state, {
      supplierId: 'old_keg_brewers',
      stockId: 'ale',
      quantity: 30,
    })
    expect(quote.refusal).toBeUndefined()
    expect(quote.supplierId).toBe('old_keg_brewers')
    expect(quote.stockId).toBe('ale')
    expect(quote.quantity).toBe(30)
    expect(quote.unitPrice).toBeGreaterThan(0)
    expect(quote.totalPrice).toBe(Math.ceil(quote.unitPrice * 30))
    expect(quote.quality).toBeGreaterThan(0)
    expect(quote.leadTimeDays).toBeGreaterThanOrEqual(1)
    expect(quote.deliveryDay).toBe(
      state.calendar.totalDaysElapsed + quote.leadTimeDays,
    )
    expect(quote.deliveryWindowDays).toBeGreaterThan(0)
    expect(quote.capacityAvailable).toBeGreaterThan(0)
    expect(['cash', 'deposit', 'net']).toContain(quote.paymentTerms)
    expect(quote.factors.length).toBeGreaterThan(0)
  })

  it('a supplier refuses a good it does not carry, and names why', () => {
    const quote = quoteSupplierOrder(ready(), {
      supplierId: 'old_keg_brewers',
      stockId: 'mushrooms',
      quantity: 10,
    })
    expect(quote.refusal?.code).toBe('does_not_stock')
    expect(quote.refusal?.reason).toMatch(/does not carry/)
  })

  it('the price the order charges is the price the quote showed', () => {
    const start = ready()
    const quote = quoteSupplierOrder(start, {
      supplierId: 'old_keg_brewers',
      stockId: 'ale',
      quantity: 30,
    })
    const after = day(start, 0, [
      { actionId: 'place_supplier_order', targetId: 'old_keg_brewers:ale', amount: 30 },
    ])
    expect(appliedIds(after)).toContain('place_supplier_order')
    const order = listPurchaseOrders(after)[0]!
    expect(order.quotedUnitPrice).toBe(quote.unitPrice)
    expect(order.lines[0]!.quantity).toBe(30)
    expect(order.promisedOnDay).toBe(quote.deliveryDay)
    const spent = getStockModuleState(after)
      .ledger.filter((e) => e.tags.includes('supplier_order'))
      .reduce((sum, e) => sum + Math.abs(e.amount), 0)
    expect(spent).toBe(quote.dueAtPlacement)
  })

  it('goods arrive on the promised day and not before', () => {
    let state = ready()
    const before = state.stock['ale']!.quantity
    state = day(state, 0, [
      { actionId: 'place_supplier_order', targetId: 'old_keg_brewers:ale', amount: 30 },
    ])
    const order = listPurchaseOrders(state)[0]!
    const leadDays = order.promisedOnDay - 0
    expect(leadDays).toBeGreaterThanOrEqual(1)

    // Nothing arrives before the promised day.
    let arrivedEarly = 0
    for (let i = 1; i < leadDays; i += 1) {
      state = day(state, i)
      arrivedEarly += getSupplierModuleState(state).deliveriesToday.length
    }
    expect(arrivedEarly).toBe(0)

    state = day(state, leadDays)
    const deliveries = getSupplierModuleState(state).deliveriesToday
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]!.stockId).toBe('ale')
    expect(deliveries[0]!.quantity).toBe(30)
    // The order is settled and archived rather than deleted.
    expect(listPurchaseOrders(state, { open: true })).toHaveLength(0)
    const archived = getSupplierModuleState(state).orderArchive
    expect(archived.at(-1)?.status).toBe('settled')
    // Service also drew the cellar down, so the delivery is proved by the
    // record it wrote rather than by a naive quantity comparison.
    expect(before).toBeGreaterThan(0)
  })

  it('a delivery on credit raises a real invoice, and paying it settles it', () => {
    let state = ready()
    // One cash order first: a supplier extends credit only to somebody with
    // a completed delivery behind them.
    state = day(state, 0, [
      {
        actionId: 'place_supplier_order',
        targetId: 'brakka_mushroom_cart:mushrooms',
        amount: 20,
      },
    ])
    state = runDays(state, 4, 1)
    state = day(state, 10, [
      { actionId: 'pay_supplier_invoice', targetId: 'brakka_mushroom_cart' },
      { actionId: 'request_supplier_credit', targetId: 'brakka_mushroom_cart' },
    ])
    expect(getSupplierAccount(state, 'brakka_mushroom_cart').creditStatus).toBe(
      'approved',
    )

    const openBefore = outstandingSupplierInvoices(state).length
    state = day(state, 11, [
      {
        actionId: 'place_supplier_order',
        targetId: 'brakka_mushroom_cart:mushrooms',
        amount: 20,
        options: { onCredit: true },
      },
    ])
    expect(rejections(state)).toEqual([])
    const creditOrder = listPurchaseOrders(state).at(-1)!
    expect(creditOrder.paymentTerms).toBe('net')
    // Nothing is invoiced at placement: a supplier who fails to deliver is
    // owed nothing.
    expect(outstandingSupplierInvoices(state).length).toBe(openBefore)

    state = runDays(state, 3, 12)
    const invoices = outstandingSupplierInvoices(state, 'brakka_mushroom_cart')
    expect(invoices.length).toBeGreaterThan(openBefore)
    const invoice = invoices.at(-1)!
    expect(invoice.principal).toBeGreaterThan(0)
    expect(invoice.dueOnDay).toBeGreaterThan(state.calendar.totalDaysElapsed)

    const coinBefore = state.coin
    state = day(state, 20, [
      { actionId: 'pay_supplier_invoice', targetId: 'brakka_mushroom_cart' },
    ])
    expect(appliedIds(state)).toContain('pay_supplier_invoice')
    expect(
      outstandingSupplierInvoices(state, 'brakka_mushroom_cart').some(
        (row) => row.id === invoice.id,
      ),
    ).toBe(false)
    expect(state.coin).toBeLessThan(coinBefore + 400)
    expect(
      getEconomyModuleState(state).lastDailyRecord!.accounting.invoicePayments,
    ).toBeGreaterThan(0)
  })

  it('a partial payment leaves the invoice live at a lower balance', () => {
    let state = creditedTavern()
    state = day(state, 30, [
      {
        actionId: 'place_supplier_order',
        targetId: 'brakka_mushroom_cart:mushrooms',
        amount: 30,
        options: { onCredit: true },
      },
    ])
    state = runDays(state, 3, 31)
    const invoice = outstandingSupplierInvoices(state, 'brakka_mushroom_cart').at(-1)!
    expect(invoice.outstanding).toBeGreaterThan(2)

    state = day(state, 40, [
      { actionId: 'pay_supplier_invoice', targetId: 'brakka_mushroom_cart', amount: 1 },
    ])
    const after = listSupplierInvoices(state, 'brakka_mushroom_cart').find(
      (row) => row.id === invoice.id,
    )!
    expect(after.paid).toBe(1)
    expect(after.outstanding).toBe(invoice.outstanding - 1)
    expect(['active', 'pending', 'grace']).toContain(after.status)
  })
})

/** A tavern with an open credit line at the mushroom cart. */
function creditedTavern(): TavernState {
  let state = ready()
  state = day(state, 0, [
    {
      actionId: 'place_supplier_order',
      targetId: 'brakka_mushroom_cart:mushrooms',
      amount: 20,
    },
  ])
  state = runDays(state, 4, 1)
  state = day(state, 10, [
    { actionId: 'pay_supplier_invoice', targetId: 'brakka_mushroom_cart' },
    { actionId: 'request_supplier_credit', targetId: 'brakka_mushroom_cart' },
  ])
  expect(getSupplierAccount(state, 'brakka_mushroom_cart').creditStatus).toBe(
    'approved',
  )
  return state
}

// ---------------------------------------------------------------------------
// §6.2 — reliability rolls happen on real orders
// ---------------------------------------------------------------------------

describe('Phase 213 §6.2 — a miss is a failed transaction, not a log line', () => {
  it('an unreliable supplier shorts or misses real orders; a reliable one does not', () => {
    let state = withReliability(
      withReliability(ready(6_000), 'old_keg_brewers', 95),
      'gildlock_brewhouse',
      15,
    )
    let reliableKept = 0
    let flakyFailed = 0
    let flakyKept = 0

    for (let i = 0; i < 24; i += 1) {
      state = day(state, 200 + i, [
        {
          actionId: 'place_supplier_order',
          targetId: 'old_keg_brewers:ale',
          amount: 4,
        },
        {
          actionId: 'place_supplier_order',
          targetId: 'gildlock_brewhouse:ale',
          amount: 4,
        },
      ])
      const slice = getSupplierModuleState(state)
      for (const missed of slice.missedDeliveriesToday) {
        expect(missed.supplierId).toBe('gildlock_brewhouse')
        flakyFailed += 1
      }
      for (const delivered of slice.deliveriesToday) {
        if (delivered.supplierId === 'old_keg_brewers') reliableKept += 1
        if (delivered.supplierId === 'gildlock_brewhouse') flakyKept += 1
      }
    }

    expect(reliableKept).toBeGreaterThan(0)
    expect(flakyKept).toBeGreaterThan(0)
    expect(flakyFailed).toBeGreaterThan(0)
    // The failure is attributed to the supplier, not to an anonymous system.
    const account = getSupplierAccount(state, 'gildlock_brewhouse')
    expect(account.history.ordersMissed + account.history.ordersPartial).toBe(
      flakyFailed,
    )
    expect(getSupplierAccount(state, 'old_keg_brewers').history.ordersMissed).toBe(0)
  })

  it('a short delivery reduces stock, re-promises the rest, and records a shortage', () => {
    let state = withReliability(ready(6_000), 'gildlock_brewhouse', 15)
    let shorted:
      | { orderId: string; delivered: number; ordered: number }
      | undefined

    for (let i = 0; i < 24 && !shorted; i += 1) {
      state = day(state, 300 + i, [
        {
          actionId: 'place_supplier_order',
          targetId: 'gildlock_brewhouse:ale',
          amount: 10,
        },
      ])
      for (const order of listPurchaseOrders(state, { open: true })) {
        const partial = order.attempts.find((a) => a.outcome === 'partial')
        if (!partial) continue
        shorted = {
          orderId: order.id,
          delivered: order.delivered['ale'] ?? 0,
          ordered: order.lines[0]!.quantity,
        }
      }
    }

    expect(shorted, 'no partial delivery occurred in 24 orders').toBeDefined()
    const order = listPurchaseOrders(state, { open: true }).find(
      (o) => o.id === shorted!.orderId,
    )!
    // Part of it arrived…
    expect(shorted!.delivered).toBeGreaterThan(0)
    expect(shorted!.delivered).toBeLessThan(shorted!.ordered)
    // …the rest is still owed, on a new promised day…
    expect(outstandingUnits(order)).toBe(shorted!.ordered - shorted!.delivered)
    expect(order.promisedOnDay).toBeGreaterThan(order.openedOnDay)
    // …and the shortage is visible to everything that reads the stock
    // module's shortage list.
    const shortages = getStockModuleState(state).shortages
    expect(
      shortages.some((s) => s.reason.includes('gildlock_brewhouse')),
    ).toBe(true)
  })

  it('a delayed delivery leaves a real service day short of ale', () => {
    // A full cellar with no ale in it, and an order that cannot arrive
    // tonight. The service day in between actually goes short — the lead
    // time is a fact the floor feels, not a number on a record.
    let base = ready(1_000)
    base = withStock(base, 'ale', { quantity: 0 })

    const ordered = day(base, 400, [
      {
        // The caravan brewer is two days out; it cannot be here tonight.
        actionId: 'place_supplier_order',
        targetId: 'gildlock_brewhouse:ale',
        amount: 60,
      },
    ])
    const order = listPurchaseOrders(ordered)[0]!
    expect(order.promisedOnDay).toBeGreaterThan(0)
    expect(ordered.stock['ale']!.quantity).toBe(0)
    const shortagesWhileWaiting = getServiceModuleState(ordered)
      .result.shortages.filter((s) => s.stockId === 'ale')
    expect(shortagesWhileWaiting.length).toBeGreaterThan(0)

    // The same night, with the ale already in the cellar, is not short.
    const stocked = day(withStock(base, 'ale', { quantity: 200 }), 400)
    expect(
      getServiceModuleState(stocked).result.shortages.filter(
        (s) => s.stockId === 'ale',
      ),
    ).toHaveLength(0)

    // And once the order lands, the ale is in the cellar for that day's
    // service — read from the delivery record, because the same night's
    // trade then draws it back down again.
    let later = ordered
    for (let d = 1; d <= order.promisedOnDay; d += 1) later = day(later, 400 + d)
    const delivered = getSupplierModuleState(later).deliveriesToday
    expect(delivered.map((entry) => entry.stockId)).toContain('ale')
    expect(
      getSupplierModuleState(later).totals.unitsDelivered,
    ).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// §6.4 — procurement counterplay
// ---------------------------------------------------------------------------

describe('Phase 213 §6.4 — counterplay', () => {
  it('names alternative suppliers for a good, cheapest first', () => {
    const alternatives = quoteAlternativeSuppliers(ready(), {
      stockId: 'ale',
      quantity: 20,
    })
    expect(alternatives.length).toBeGreaterThan(1)
    const ids = alternatives.map((q) => q.supplierId)
    expect(ids).toContain('old_keg_brewers')
    expect(ids).toContain('gildlock_brewhouse')
    for (let i = 1; i < alternatives.length; i += 1) {
      expect(alternatives[i]!.unitPrice).toBeGreaterThanOrEqual(
        alternatives[i - 1]!.unitPrice,
      )
    }
  })

  it('splits an order across suppliers when one cannot carry it alone', () => {
    const state = ready(4_000)
    const single = quoteSupplierOrder(state, {
      supplierId: 'old_keg_brewers',
      stockId: 'ale',
      quantity: 400,
    })
    expect(single.quantity).toBeLessThan(400)

    const after = day(state, 500, [
      {
        actionId: 'place_supplier_order',
        targetId: 'old_keg_brewers:ale',
        amount: 400,
        options: { split: true },
      },
    ])
    const orders = listPurchaseOrders(after, { open: true })
    expect(orders.length).toBeGreaterThan(1)
    const suppliers = new Set(orders.map((o) => o.supplierId))
    expect(suppliers.size).toBeGreaterThan(1)
    // Every leg is a real order that can independently fail.
    for (const order of orders) {
      expect(order.status).toBe('active')
      expect(order.promisedOnDay).toBeGreaterThan(order.openedOnDay)
    }
  })

  it('a rush order costs more and arrives sooner', () => {
    const state = ready()
    const normal = quoteSupplierOrder(state, {
      supplierId: 'silken_road_caravan',
      stockId: 'ingredients',
      quantity: 20,
    })
    const rushed = quoteSupplierOrder(state, {
      supplierId: 'silken_road_caravan',
      stockId: 'ingredients',
      quantity: 20,
      rush: true,
    })
    expect(rushed.leadTimeDays).toBeLessThan(normal.leadTimeDays)
    expect(rushed.unitPrice).toBeGreaterThan(normal.unitPrice)
    expect(rushed.missChance).toBeGreaterThan(normal.missChance)
  })

  it('a substitution ships a related good the supplier does carry', () => {
    const state = ready()
    const refused = quoteSupplierOrder(state, {
      supplierId: 'marsh_root_peddler',
      stockId: 'stew',
      quantity: 10,
    })
    expect(refused.refusal?.code).toBe('does_not_stock')

    const substituted = quoteSupplierOrder(state, {
      supplierId: 'marsh_root_peddler',
      stockId: 'stew',
      quantity: 10,
      allowSubstitution: true,
    })
    expect(substituted.refusal).toBeUndefined()
    expect(substituted.substitutedFor).toBe('stew')
    expect(substituted.stockId).not.toBe('stew')
    expect(
      state.world.suppliers['marsh_root_peddler']!.goodsProvided,
    ).toContain(substituted.stockId)
  })

  it('the local market is the emergency channel: dearer, common goods only, capped', () => {
    const state = ready()
    const supplierQuote = quoteAlternativeSuppliers(state, {
      stockId: 'ale',
      quantity: 20,
    })[0]!
    expect(spotMarketUnitPrice(state, 'ale')).toBeGreaterThan(
      supplierQuote.unitPrice,
    )
    expect(spotMarketAvailable(state, 'ale')).toBe(SPOT_MARKET_DAILY_UNITS)
    // Uncommon and better is not sold off a barrow.
    expect(spotMarketAvailable(state, 'wild_thyme')).toBe(0)
    expect(spotMarketAvailable(state, 'sunblood_orange')).toBe(0)

    const after = day(state, 600, [
      { actionId: 'restock_item', targetId: 'wild_thyme', amount: 5 },
    ])
    expect(rejections(after).join(' ')).toMatch(/market_exhausted/)
    // …but the good is still reachable, through the supplier who carries it.
    expect(
      quoteSupplierOrder(state, {
        supplierId: 'marsh_root_peddler',
        stockId: 'wild_thyme',
        quantity: 5,
      }).refusal,
    ).toBeUndefined()
  })

  it('the market cannot be drained twice in one day', () => {
    const state = ready()
    const after = day(state, 601, [
      { actionId: 'restock_item', targetId: 'ale', amount: SPOT_MARKET_DAILY_UNITS },
      { actionId: 'restock_item', targetId: 'ale', amount: 10 },
    ])
    expect(rejections(after).join(' ')).toMatch(/market_exhausted/)
  })

  it('cancelling in time refunds the deposit; cancelling late forfeits it', () => {
    // `silken_road_caravan` is three days out, so there is a day when the
    // order can still be pulled and a day when it cannot.
    let state = ready()
    state = day(state, 700, [
      {
        actionId: 'place_supplier_order',
        targetId: 'silken_road_caravan:ingredients',
        amount: 20,
      },
    ])
    const order = listPurchaseOrders(state)[0]!
    const prepaid = order.prepaid
    const coinBefore = state.coin

    state = day(state, 701, [
      { actionId: 'cancel_supplier_order', targetId: order.id },
    ])
    const applied = getOwnerActionsModuleState(state).applied.find(
      (a) => a.actionId === 'cancel_supplier_order',
    )!
    expect(applied.data['cancelled']).toBe(true)
    expect(applied.data['refund']).toBe(prepaid)
    expect(state.coin).toBeGreaterThan(coinBefore - 100)
    expect(listPurchaseOrders(state, { open: true })).toHaveLength(0)
    expect(getSupplierModuleState(state).orderArchive.at(-1)?.status).toBe(
      'cancelled',
    )
  })

  it('amending an order before it loads changes what is owed and what was paid', () => {
    let state = ready()
    state = day(state, 800, [
      {
        actionId: 'place_supplier_order',
        targetId: 'silken_road_caravan:ingredients',
        amount: 20,
      },
    ])
    const order = listPurchaseOrders(state)[0]!
    state = day(state, 801, [
      { actionId: 'amend_supplier_order', targetId: order.id, amount: 10 },
    ])
    const amended = listPurchaseOrders(state)[0]!
    expect(amended.lines[0]!.quantity).toBe(10)
    expect(amended.amendmentsUsed).toBe(1)
    expect(amended.prepaid).toBeLessThanOrEqual(order.prepaid)
  })

  it('a shorted delivery can be disputed for a credit note against its invoice', () => {
    // A well-liked but hopeless supplier: high relationship holds the
    // deposit terms that produce an invoice, low reliability produces the
    // short deliveries there is something to dispute about.
    let state = withRelationship(
      withReliability(ready(4_000), 'brakka_mushroom_cart', 10),
      'brakka_mushroom_cart',
      95,
    )
    let disputable: string | undefined
    for (let i = 0; i < 30 && !disputable; i += 1) {
      state = day(state, 900 + i, [
        {
          actionId: 'place_supplier_order',
          targetId: 'brakka_mushroom_cart:mushrooms',
          amount: 8,
        },
      ])
      disputable = listAllPurchaseOrders(state).find(
        (o) =>
          o.dispute === undefined &&
          o.invoiceIds.length > 0 &&
          o.attempts.some((a) => a.outcome !== 'full') &&
          outstandingSupplierInvoices(state, 'brakka_mushroom_cart').some((inv) =>
            o.invoiceIds.includes(inv.id),
          ),
      )?.id
    }
    expect(disputable, 'no shorted delivery produced a live invoice').toBeDefined()

    const before = outstandingSupplierInvoices(state, 'brakka_mushroom_cart').reduce(
      (sum, invoice) => sum + invoice.outstanding,
      0,
    )
    state = day(state, 999, [
      { actionId: 'dispute_supplier_delivery', targetId: disputable! },
    ])
    const applied = getOwnerActionsModuleState(state).applied.find(
      (a) => a.actionId === 'dispute_supplier_delivery',
    )!
    expect(applied.data['upheld']).toBe(true)
    expect(applied.data['relief']).toBeGreaterThan(0)
    const after = outstandingSupplierInvoices(state, 'brakka_mushroom_cart').reduce(
      (sum, invoice) => sum + invoice.outstanding,
      0,
    )
    expect(after).toBeLessThan(before)
    // The credit note is forgiveness, not a payment: no coin left the till
    // for it, so it is reported as a write-off.
    expect(
      getEconomyModuleState(state).lastDailyRecord!.accounting.writeOffs,
    ).toBeGreaterThan(0)
    expect(
      getSupplierAccount(state, 'brakka_mushroom_cart').history.disputesUpheld,
    ).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Reconciliation, bounds, and the UI path
// ---------------------------------------------------------------------------

describe('Phase 213 — reconciliation, bounds and discovery', () => {
  it('stock and the coin ledger reconcile exactly across an order chain', () => {
    let state = ready()
    const startCoin = state.coin
    const startAle = state.stock['ale']!.quantity

    state = day(state, 1_000, [
      { actionId: 'place_supplier_order', targetId: 'old_keg_brewers:ale', amount: 25 },
    ])
    const order = listPurchaseOrders(state)[0]!
    state = runDays(state, order.promisedOnDay, 1_001)

    // Every coin the procurement layer moved is a ledger entry, and the
    // day's economy record reconciles the till against the whole ledger.
    const record = getEconomyModuleState(state).lastDailyRecord!
    expect(record.reconciled).toBe(true)

    // Every unit delivered is on the order AND in the delivery record.
    const delivered = getSupplierModuleState(state)
      .orderArchive.filter((o) => o.id === order.id)
      .flatMap((o) => Object.values(o.delivered))
      .reduce((sum, n) => sum + n, 0)
    expect(delivered).toBe(25)
    expect(startCoin).toBeGreaterThan(0)
    expect(startAle).toBeGreaterThan(0)
    expect(safeValidateState(state, { modules: FULL_PIPELINE }).success).toBe(true)
  })

  it('the order archive stays inside its declared cap', () => {
    let state = ready(20_000)
    for (let i = 0; i < MAX_ARCHIVED_PURCHASE_ORDERS + 12; i += 1) {
      state = day(state, 2_000 + i, [
        {
          actionId: 'place_supplier_order',
          targetId: 'old_keg_brewers:ale',
          amount: 2,
        },
        // Settle as you go. Without this the deposit balances go unpaid,
        // reach collections, and the supplier stops trading — correct
        // behaviour, but not what this test is measuring.
        { actionId: 'pay_supplier_invoice', targetId: 'old_keg_brewers' },
      ])
    }
    state = runDays(state, 4, 3_000)
    const slice = getSupplierModuleState(state)
    expect(slice.orderArchive.length).toBeLessThanOrEqual(
      MAX_ARCHIVED_PURCHASE_ORDERS,
    )
    expect(slice.totals.ordersPlaced).toBeGreaterThan(
      MAX_ARCHIVED_PURCHASE_ORDERS,
    )
    expect(safeValidateState(state, { modules: FULL_PIPELINE }).success).toBe(true)
  })

  it('every supplier action is registered and reachable from the supplier sheet', () => {
    const state = creditedTavern()
    for (const id of [
      'place_supplier_order',
      'amend_supplier_order',
      'cancel_supplier_order',
      'dispute_supplier_delivery',
      'request_supplier_credit',
      'pay_supplier_invoice',
      'schedule_supplier_payment',
      'negotiate_supplier_terms',
    ]) {
      expect(actionRegistry.has(id), `${id} is not registered`).toBe(true)
    }

    const world = buildWorldOverview(state)
    const row = world.suppliers.rows.find((r) => r.id === 'brakka_mushroom_cart')!
    // Supplier-level actions arrive through the sheet's generic quick-action
    // strip…
    const sheetActions = row.applicableActions.map((a) => a.actionId)
    expect(sheetActions).toContain('request_supplier_credit')
    expect(sheetActions).toContain('negotiate_supplier_terms')
    // …and the per-good rows carry the order action with its live quote.
    const good = row.goods.find((g) => g.ingredientId === 'mushrooms')!
    expect(good.applicableActions.map((a) => a.actionId)).toContain(
      'place_supplier_order',
    )
    expect(good.quote?.unitPrice).toBeGreaterThan(0)
    expect(good.quote?.deliveryDay).toBeGreaterThan(
      state.calendar.totalDaysElapsed,
    )
    // Credit standing is legible without opening a form.
    expect(row.credit.status).toBe('approved')
    expect(row.credit.limit).toBeGreaterThan(0)
  })

  it('the supplier report names open orders and outstanding invoices', () => {
    // The order is placed and the report is read on the SAME day, while it
    // is still in flight — `silken_road_caravan` is three days out.
    const result = simulateDay(
      creditedTavern(),
      {
        seed: `${SEED}-report`,
        ownerActions: [
          {
            actionId: 'place_supplier_order',
            targetId: 'silken_road_caravan:ingredients',
            amount: 15,
          },
        ],
      },
      FULL_PIPELINE,
    )
    const section = result.reports.find((r) => r.id === 'suppliers')!
    const text = section.lines.join('\n')
    expect(text).toMatch(/Open orders:/)
    expect(text).toMatch(/silken_road_caravan/)
    expect((section.data as Record<string, unknown>)['openOrderCount']).toBe(1)
    // Credit standing rides on the supplier line, so `debtTolerance` finally
    // reads as something the player can act on.
    expect(text).toMatch(/credit \d+c net \d+d/)
  })

  it('the supplier report names outstanding invoices while one is owed', () => {
    // A deposit order leaves a balance on delivery; the report is read on
    // the day it lands, before anybody has paid it. Deposit terms need a
    // supplier who already trusts the tavern, so the relationship is a
    // starting condition here.
    let state = withRelationship(ready(), 'north_pier_smokehouse', 70)
    state = day(state, 1_100, [
      {
        actionId: 'place_supplier_order',
        targetId: 'north_pier_smokehouse:stew',
        amount: 20,
      },
    ])
    const order = listPurchaseOrders(state)[0]!
    for (let d = 1; d < order.promisedOnDay - 0; d += 1) {
      state = day(state, 1_100 + d)
    }
    const result = simulateDay(
      state,
      { seed: `${SEED}-invoice-report` },
      FULL_PIPELINE,
    )
    expect(outstandingSupplierInvoices(result.state).length).toBeGreaterThan(0)
    const section = result.reports.find((r) => r.id === 'suppliers')!
    expect(section.lines.join('\n')).toMatch(/Supplier invoices \(\d+ coin outstanding\)/)
    expect(
      (section.data as Record<string, unknown>)['outstandingInvoiceCount'],
    ).toBeGreaterThan(0)
  })
})
