import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'
import {
  cancelContract,
  expireContract,
  transitionContract,
} from '../../contracts/obligations/index'
import { spendCoin } from '../stock/ledger'
import { STOCK_MODULE_ID } from '../stock/state'
import type { StockModuleState } from '../stock/types'

import { openSupplierInvoice } from './invoices'
import {
  SPOT_MARKET_QUALITY,
  quoteAlternativeSuppliers,
  quoteSupplierOrder,
  spotMarketAvailable,
  spotMarketUnitPrice,
  supplierCreditExposure,
  type QuoteRequest,
  type SupplierQuote,
} from './quote'
import {
  SUPPLIERS_MODULE_ID,
  atOpenOrderCap,
  getSupplierAccount,
  getSupplierModuleState,
  isOrderOpen,
  outstandingUnits,
  upsertPurchaseOrder,
  writeSupplierAccount,
  writeSupplierState,
} from './state'
import {
  MAX_ORDER_ATTEMPTS,
  type DeliveryOutcome,
  type PurchaseOrderRecord,
  type SupplierDeliveryRecord,
  type SupplierMissedDelivery,
  type SupplierModuleState,
} from './types'

// Expansion Phase 6 §6.1 / §6.2 — the order and delivery engine.
//
// THE ONE RULE THIS FILE EXISTS FOR: a reliability roll happens against a
// real order, and its result changes stock, coin and the relationship. The
// Phase 84 behaviour it replaces rolled every supplier every day against
// nothing, wrote a diagnostic line, and — in `restock_item` — cancelled the
// purchase without cancelling anything, because there was no purchase to
// cancel.
//
// The chain is:
//
//   placeOrder      snapshots the accepted quote, takes the deposit or the
//                   cash price, and schedules the delivery event.
//   deliverOrder    (from the scheduled event) rolls reliability, moves the
//                   goods, blends their quality into the cellar, invoices
//                   what actually arrived, and reschedules or fails what
//                   did not.
//   cancel/amend    the player's side of the same contract.
//
// Ownership: this module writes the order record and the stock quantity for
// a delivery. Coin always moves through the stock ledger, and the invoice
// always goes to the shared obligation ledger.

/** How much of an order a "partial" delivery brings, as a fraction. */
const PARTIAL_MIN = 0.35
const PARTIAL_MAX = 0.75
/** Chance that a failed roll is a short delivery rather than nothing at all. */
const PARTIAL_SHARE_OF_MISSES = 0.5
/** Days a missed delivery slips by before the supplier tries again. */
const RETRY_DELAY_DAYS = 2
/** Days after delivery that a deposit order's balance falls due. */
const DEPOSIT_BALANCE_DAYS = 3
/** Quality lost when the player authorises a lower-grade fallback. */
const LOWER_GRADE_QUALITY_PENALTY = 20

export type PlaceOrderInput = QuoteRequest & {
  /** Recorded on split orders so the report can group them. */
  splitFromRequestId?: string
}

export type PlaceOrderResult =
  | { ok: true; order: PurchaseOrderRecord; quote: SupplierQuote }
  | { ok: false; code: string; reason: string }

function mintOrderId(state: TavernState): string {
  const slice = getSupplierModuleState(state)
  return `po-${slice.nextOrderSuffix}`
}

/**
 * Place a purchase order.
 *
 * Everything the supplier agreed to is copied onto the record here and
 * never recomputed: the price the player saw is the price they pay, the
 * lead time they were promised is the day they are owed goods, and a later
 * market condition cannot retroactively change either.
 */
export function placeOrder(
  ctx: SimContext,
  input: PlaceOrderInput,
): PlaceOrderResult {
  if (atOpenOrderCap(ctx.state)) {
    return {
      ok: false,
      code: 'order_cap',
      reason: 'You already have as many orders running as you can keep track of.',
    }
  }
  const quote = quoteSupplierOrder(ctx.state, input)
  if (quote.refusal) {
    return { ok: false, code: quote.refusal.code, reason: quote.refusal.reason }
  }
  if (quote.dueAtPlacement > ctx.state.coin) {
    return {
      ok: false,
      code: 'insufficient_coin',
      reason: `${quote.supplierLabel} wants ${quote.dueAtPlacement} coin up front; the till holds ${ctx.state.coin}.`,
    }
  }

  const today = ctx.state.calendar.totalDaysElapsed
  const id = mintOrderId(ctx.state)
  const supplier = ctx.state.world.suppliers[quote.supplierId]
  const account = getSupplierAccount(ctx.state, quote.supplierId)

  const order: PurchaseOrderRecord = {
    id,
    family: 'order',
    ownerModuleId: SUPPLIERS_MODULE_ID,
    counterparty: { kind: 'supplier', id: quote.supplierId },
    status: 'active',
    openedOnDay: today,
    dueOnDay: quote.deliveryDay,
    graceDays: quote.deliveryWindowDays,
    lastTransitionOnDay: today,
    history: [
      {
        onDay: today,
        from: 'pending',
        to: 'active',
        reason: `ordered ${quote.quantity} ${quote.stockLabel} at ${quote.unitPrice} each`,
        amount: quote.totalPrice,
      },
    ],
    escalation: 0,
    readable: `${quote.supplierLabel}: ${quote.quantity} ${quote.stockLabel} for day ${quote.deliveryDay}`,
    tags: [
      'supplier',
      'order',
      quote.supplierId,
      `stock:${quote.stockId}`,
      ...(quote.rush ? ['rush'] : []),
      ...(quote.substitutedFor ? ['substituted'] : []),
    ],
    lines: [
      {
        stockId: quote.stockId,
        quantity: quote.quantity,
        unitPrice: quote.unitPrice,
      },
    ],
    delivered: {},
    promisedOnDay: quote.deliveryDay,
    supplierId: quote.supplierId,
    quotedUnitPrice: quote.unitPrice,
    quotedQuality: quote.quality,
    quotedMissChance: quote.missChance,
    leadTimeDays: quote.leadTimeDays,
    deliveryWindowDays: quote.deliveryWindowDays,
    paymentTerms: quote.paymentTerms,
    prepaid: quote.dueAtPlacement,
    // A `net` order runs on the line's agreed terms. A `deposit` order's
    // balance is "settle it shortly after the barrow leaves" —
    // DEPOSIT_BALANCE_DAYS plus the ruleset's grace, which is enough for a
    // player without a credit line to pay out of the night's takings. One
    // day was not: the balance fell due the morning after delivery, went
    // straight into grace, and suspended a line the player had just been
    // granted for a bill nobody had had a chance to pay.
    netTermDays:
      quote.paymentTerms === 'net' ? account.netTermDays : DEPOSIT_BALANCE_DAYS,
    capacityCommitted: quote.quantity,
    substitutionsAllowed: quote.substitutionsAllowed,
    rush: quote.rush,
    amendmentsUsed: 0,
    invoiceIds: [],
    attempts: [],
    ...(input.splitFromRequestId !== undefined
      ? { splitFromRequestId: input.splitFromRequestId }
      : {}),
  }

  if (quote.dueAtPlacement > 0) {
    spendCoin(ctx, quote.dueAtPlacement, {
      source: `${SUPPLIERS_MODULE_ID}.order_placement.${id}`,
      category: 'purchase',
      tags: [
        'supplier_order',
        quote.paymentTerms === 'cash' ? 'order_cash' : 'order_deposit',
        quote.supplierId,
        quote.stockId,
      ],
    })
  }

  writeSupplierState(
    ctx,
    (slice) => ({
      ...slice,
      orders: { ...slice.orders, [id]: order },
      nextOrderSuffix: slice.nextOrderSuffix + 1,
      totals: {
        ...slice.totals,
        ordersPlaced: slice.totals.ordersPlaced + 1,
        coinPrepaid: slice.totals.coinPrepaid + quote.dueAtPlacement,
      },
    }),
    'order_placed',
  )
  writeSupplierAccount(
    ctx,
    quote.supplierId,
    (current) => ({
      ...current,
      history: {
        ...current.history,
        ordersPlaced: current.history.ordersPlaced + 1,
      },
      lastOrderDay: today,
    }),
    'order_placed',
  )

  scheduleDelivery(ctx, order)

  ctx.addCause({
    source: `${SUPPLIERS_MODULE_ID}.order_placed`,
    sourceType: 'owner_action',
    target: quote.supplierId,
    targetType: 'supplier',
    amount: quote.totalPrice,
    direction: 'neutral',
    weight: quote.totalPrice,
    readable: `Ordered ${quote.quantity} ${quote.stockLabel} from ${quote.supplierLabel} for day ${quote.deliveryDay} (${quote.paymentTerms}).`,
    tags: ['supplier', 'order', quote.supplierId, quote.stockId],
    relatedSystems: [SUPPLIERS_MODULE_ID, 'stock', 'economy'],
  })
  if (supplier) {
    // Business is business: placing an order is a small, real warming.
    ctx.modifySupplier(
      quote.supplierId,
      { relationship: Math.min(100, supplier.relationship + 1) },
      { source: SUPPLIERS_MODULE_ID, reason: 'order_placed' },
    )
  }

  return { ok: true, order, quote }
}

/**
 * Place an order across more than one supplier when no single one can
 * cover it.
 *
 * §6.4 "order splitting" and "alternative suppliers" are the same
 * capability seen from two sides: the player names a quantity, and the
 * procurement layer finds who can actually deliver it. Each leg is a real,
 * separately-tracked order — splitting is not a discount on the truth that
 * two suppliers can each miss.
 */
export function placeSplitOrder(
  ctx: SimContext,
  input: PlaceOrderInput,
): { orders: PurchaseOrderRecord[]; unfilled: number; rejections: string[] } {
  const rejections: string[] = []
  const orders: PurchaseOrderRecord[] = []
  let remaining = Math.floor(input.quantity)
  const requestId =
    input.splitFromRequestId ??
    `split-${ctx.state.calendar.totalDaysElapsed}-${getSupplierModuleState(ctx.state).nextOrderSuffix}`

  const first = placeOrder(ctx, {
    ...input,
    quantity: remaining,
    splitFromRequestId: requestId,
  })
  if (first.ok) {
    orders.push(first.order)
    remaining -= first.quote.quantity
  } else {
    rejections.push(first.reason)
  }

  const tried = new Set<string>([input.supplierId])
  while (remaining > 0) {
    const alternatives = quoteAlternativeSuppliers(ctx.state, {
      stockId: input.stockId,
      quantity: remaining,
      ...(input.onCredit !== undefined ? { onCredit: input.onCredit } : {}),
      ...(input.rush !== undefined ? { rush: input.rush } : {}),
      ...(input.allowSubstitution !== undefined
        ? { allowSubstitution: input.allowSubstitution }
        : {}),
    }).filter((quote) => !tried.has(quote.supplierId))
    const next = alternatives[0]
    if (!next) break
    tried.add(next.supplierId)
    const placed = placeOrder(ctx, {
      ...input,
      supplierId: next.supplierId,
      quantity: remaining,
      splitFromRequestId: requestId,
    })
    if (!placed.ok) {
      rejections.push(placed.reason)
      continue
    }
    orders.push(placed.order)
    remaining -= placed.quote.quantity
  }

  return { orders, unfilled: Math.max(0, remaining), rejections }
}

/**
 * Set by `supplierEvents.ts` at import time.
 *
 * The delivery event's resolver lives in `supplierEvents.ts` — that is
 * where scheduled-event definitions belong — and it calls `deliverOrder`
 * here. Injecting the scheduler back the other way keeps the two files
 * acyclic without either reaching into the other's internals.
 */
let scheduleDeliveryEvent: (ctx: SimContext, order: PurchaseOrderRecord) => void =
  () => {
    throw new Error(
      'suppliers: delivery scheduling was used before supplierEvents registered it',
    )
  }

export function setDeliveryScheduler(
  scheduler: (ctx: SimContext, order: PurchaseOrderRecord) => void,
): void {
  scheduleDeliveryEvent = scheduler
}

/** Put (or move) an order's delivery attempt on the calendar. */
function scheduleDelivery(ctx: SimContext, order: PurchaseOrderRecord): void {
  scheduleDeliveryEvent(ctx, order)
}

export type DeliveryResult = {
  outcome: DeliveryOutcome
  order: PurchaseOrderRecord
  /** Units that arrived on this attempt. */
  quantity: number
  quality: number
  /** Coin invoiced for what arrived. Zero on a cash order or a miss. */
  invoiced: number
  invoiceId?: string
  /** True when the order is finished, one way or the other. */
  closed: boolean
  readable: string
  reason: string
  /** Set when the order failed for good and the goods will never come. */
  failed: boolean
}

/**
 * Test the supplier's promise.
 *
 * The roll is drawn from the named `supplier_delivery` stream so the result
 * is deterministic per (seed, day, order) and survives a reload — the
 * "no double delivery after reload" requirement is enforced above this, by
 * the scheduled event's exact-once key, but a stable roll is what makes the
 * two halves agree.
 */
export function deliverOrder(
  ctx: SimContext,
  orderId: string,
): DeliveryResult | undefined {
  const order = getSupplierModuleState(ctx.state).orders[orderId]
  if (!order || !isOrderOpen(order)) return undefined

  const today = ctx.state.calendar.totalDaysElapsed
  const line = order.lines[0]
  if (!line) return undefined
  const owed = outstandingUnits(order, line.stockId)
  if (owed <= 0) return undefined

  const supplier = ctx.state.world.suppliers[order.supplierId]
  const supplierLabel = supplier?.label ?? order.supplierId
  const stockLabel = ctx.state.stock[line.stockId]?.label ?? line.stockId

  const rng = ctx.getRngStream('supplier_delivery')
  // The risk shown in the accepted quote includes load and rush pressure.
  // Snapshotting it on the order keeps the displayed decision and the
  // later fulfilment roll identical even if the market moves in between.
  const missChance = order.quotedMissChance
  const failedRoll = missChance > 0 && rng.chance(missChance)
  const partial =
    failedRoll &&
    !order.substitutionsAllowed &&
    owed > 1 &&
    rng.chance(PARTIAL_SHARE_OF_MISSES)

  let quantity = owed
  let quality = order.quotedQuality
  let outcome: DeliveryOutcome = 'full'
  let reason = 'delivered in full'
  if (failedRoll && order.substitutionsAllowed) {
    quality = Math.max(5, order.quotedQuality - LOWER_GRADE_QUALITY_PENALTY)
    reason = `${supplierLabel} filled the order with lower-grade substitute stock`
  } else if (failedRoll && partial) {
    const share = PARTIAL_MIN + rng.float() * (PARTIAL_MAX - PARTIAL_MIN)
    quantity = Math.max(1, Math.floor(owed * share))
    outcome = 'partial'
    reason = `${supplierLabel} could only fill ${quantity} of ${owed} units`
  } else if (failedRoll) {
    quantity = 0
    outcome = 'missed'
    reason = `${supplierLabel} did not turn up`
  }

  const attempts = [
    ...order.attempts,
    {
      onDay: today,
      outcome,
      quantity,
      quality: quantity > 0 ? quality : 0,
      reason,
    },
  ].slice(-MAX_ORDER_ATTEMPTS)

  let next: PurchaseOrderRecord = { ...order, attempts }
  let invoiced = 0
  let invoiceId: string | undefined

  if (quantity > 0) {
    const deliveredBefore = order.delivered[line.stockId] ?? 0
    const deliveredAfter = deliveredBefore + quantity
    receiveGoods(ctx, {
      stockId: line.stockId,
      quantity,
      quality,
      supplierId: order.supplierId,
      coinCost: Math.round(quantity * line.unitPrice),
      orderId: order.id,
    })
    next = {
      ...next,
      delivered: {
        ...next.delivered,
        [line.stockId]: (next.delivered[line.stockId] ?? 0) + quantity,
      },
    }
    // Only what ARRIVED is billable, and only the part not already prepaid.
    if (order.paymentTerms !== 'cash') {
      // Cumulative deltas make every partial delivery add up to the exact
      // accepted quote despite integer-coin rounding at each attempt.
      const valueBefore = Math.ceil(line.unitPrice * deliveredBefore)
      const valueAfter = Math.ceil(line.unitPrice * deliveredAfter)
      const prepaidBefore = Math.round(
        order.prepaid * (deliveredBefore / Math.max(1, line.quantity)),
      )
      const prepaidAfter = Math.round(
        order.prepaid * (deliveredAfter / Math.max(1, line.quantity)),
      )
      const billable = Math.max(
        0,
        valueAfter - valueBefore - (prepaidAfter - prepaidBefore),
      )
      const invoice = openSupplierInvoice(ctx, {
        supplierId: order.supplierId,
        supplierLabel,
        orderId: order.id,
        stockIds: [line.stockId],
        amount: billable,
        netTermDays: order.netTermDays,
      })
      if (invoice) {
        invoiced = invoice.principal
        invoiceId = invoice.id
        next = { ...next, invoiceIds: [...next.invoiceIds, invoice.id] }
      }
    }
  }

  const stillOwed = outstandingUnits(next, line.stockId)
  const exhausted = attempts.length >= MAX_ORDER_ATTEMPTS
  const originalDue = order.dueOnDay ?? order.promisedOnDay
  const pastWindow = today >= originalDue + order.deliveryWindowDays

  let closed = false
  let failed = false
  if (stillOwed <= 0) {
    next = transitionContract(next, 'settled', today, reason, quantity)
    closed = true
  } else if (exhausted || pastWindow) {
    // The supplier has run out of chances. Refund the prepaid share of what
    // never arrived — a deposit buys goods, not the promise of goods.
    const deliveredUnits = Math.max(0, line.quantity - stillOwed)
    const retainedPrepayment =
      order.paymentTerms === 'cash'
        ? Math.ceil(line.unitPrice * deliveredUnits)
        : Math.round(
            order.prepaid * (deliveredUnits / Math.max(1, line.quantity)),
          )
    const refund = Math.max(0, order.prepaid - retainedPrepayment)
    if (refund > 0) {
      refundCoin(
        ctx,
        refund,
        order.supplierId,
        line.stockId,
        'supplier failed to deliver the prepaid balance',
      )
    }
    next = expireContract(
      next,
      today,
      `${stillOwed} units never arrived${refund > 0 ? `; ${refund} coin refunded` : ''}`,
    )
    closed = true
    failed = true
  } else {
    next = {
      ...next,
      promisedOnDay: today + RETRY_DELAY_DAYS,
      lastTransitionOnDay: today,
      escalation: next.escalation + 1,
      history: [
        ...next.history,
        {
          onDay: today,
          from: next.status,
          to: next.status,
          reason: `${reason}; re-promised for day ${today + RETRY_DELAY_DAYS}`,
          amount: quantity,
        },
      ],
    }
  }

  upsertPurchaseOrder(ctx, next, `order_delivery_${outcome}`)
  if (!closed) scheduleDelivery(ctx, next)

  recordDeliveryOutcome(ctx, {
    order: next,
    outcome,
    quantity,
    stockId: line.stockId,
    reason,
    failed,
    supplierLabel,
    stockLabel,
    coinCost: Math.round(quantity * line.unitPrice),
  })

  return {
    outcome,
    order: next,
    quantity,
    quality: quantity > 0 ? quality : 0,
    invoiced,
    ...(invoiceId !== undefined ? { invoiceId } : {}),
    closed,
    failed,
    reason,
    readable:
      outcome === 'full'
        ? `${supplierLabel} delivered ${quantity} ${stockLabel}.`
        : outcome === 'partial'
          ? `${supplierLabel} delivered only ${quantity} of ${owed} ${stockLabel}.`
          : `${supplierLabel} missed the ${stockLabel} delivery.`,
  }
}

/**
 * Move goods into the cellar.
 *
 * Distinct from `restockItem` because a delivery carries a QUALITY, and a
 * quoted quality that never reached the stock record would be exactly the
 * decorative number §6.1 asks to make real. Quality is a quantity-weighted
 * average — a premium supplier's batch genuinely lifts the cellar and a
 * suspicious one's drags it down.
 *
 * SPOILAGE IS NOT AVERAGED, and the asymmetry is deliberate. Spoilage is a
 * clock on the oldest goods in the slot, and averaging it would let a
 * player launder a rotting barrel clean by tipping fresh stock on top —
 * cheaper than the emergency premium and mechanically absurd. So a
 * delivery into stock that still has goods in it never lowers spoilage,
 * and a delivery into an EMPTY slot starts the clock at zero, because
 * there is nothing left in there to be rotten (`inventorySpoilageSnapshot`
 * opens an empty slot at zero for the same reason).
 */
export function receiveGoods(
  ctx: SimContext,
  input: {
    stockId: string
    quantity: number
    quality: number
    supplierId: string
    coinCost: number
    orderId?: string
  },
): void {
  const item = ctx.state.stock[input.stockId]
  if (!item || input.quantity <= 0) return
  const before = item.quantity
  const after = before + input.quantity
  const blendedQuality = Math.round(
    (before * item.quality + input.quantity * input.quality) / Math.max(1, after),
  )
  const nextSpoilage = before > 0 ? item.spoilage : 0
  ctx.modifyStock(
    input.stockId,
    {
      quantity: after,
      quality: Math.max(0, Math.min(100, blendedQuality)),
      spoilage: Math.max(0, Math.min(100, nextSpoilage)),
    },
    { source: SUPPLIERS_MODULE_ID, reason: 'supplier_delivery' },
  )
  const supplier = ctx.state.world.suppliers[input.supplierId]
  if (supplier) {
    ctx.modifySupplier(
      input.supplierId,
      { lastDeliveryDay: ctx.state.calendar.totalDaysElapsed },
      { source: SUPPLIERS_MODULE_ID, reason: 'delivery_recorded' },
    )
  }
  const delivery: SupplierDeliveryRecord = {
    supplierId: input.supplierId,
    stockId: input.stockId,
    quantity: input.quantity,
    quality: input.quality,
    coinCost: input.coinCost,
    tags: [
      'delivery',
      input.supplierId,
      input.stockId,
      ...(input.orderId ? [`order:${input.orderId}`] : []),
    ],
  }
  writeSupplierState(
    ctx,
    (slice) => ({
      ...slice,
      deliveriesToday: [...slice.deliveriesToday, delivery],
      totals: {
        ...slice.totals,
        unitsDelivered: slice.totals.unitsDelivered + input.quantity,
      },
    }),
    'delivery_recorded',
  )
}

function recordDeliveryOutcome(
  ctx: SimContext,
  input: {
    order: PurchaseOrderRecord
    outcome: DeliveryOutcome
    quantity: number
    stockId: string
    reason: string
    failed: boolean
    supplierLabel: string
    stockLabel: string
    coinCost: number
  },
): void {
  const { order, outcome } = input
  const supplier = ctx.state.world.suppliers[order.supplierId]

  writeSupplierState(
    ctx,
    (slice: SupplierModuleState) => ({
      ...slice,
      totals: {
        ...slice.totals,
        ordersDelivered:
          outcome === 'full'
            ? slice.totals.ordersDelivered + 1
            : slice.totals.ordersDelivered,
        ordersPartial:
          outcome === 'partial'
            ? slice.totals.ordersPartial + 1
            : slice.totals.ordersPartial,
        ordersMissed:
          outcome === 'missed'
            ? slice.totals.ordersMissed + 1
            : slice.totals.ordersMissed,
      },
    }),
    `delivery_${outcome}`,
  )
  writeSupplierAccount(
    ctx,
    order.supplierId,
    (account) => ({
      ...account,
      history: {
        ...account.history,
        ordersDelivered:
          outcome === 'full'
            ? account.history.ordersDelivered + 1
            : account.history.ordersDelivered,
        ordersPartial:
          outcome === 'partial'
            ? account.history.ordersPartial + 1
            : account.history.ordersPartial,
        ordersMissed:
          outcome === 'missed'
            ? account.history.ordersMissed + 1
            : account.history.ordersMissed,
      },
      lastDecisionDay: ctx.state.calendar.totalDaysElapsed,
      lastDecisionReason: input.reason,
    }),
    `delivery_${outcome}`,
  )

  if (outcome !== 'full') {
    const missed: SupplierMissedDelivery = {
      supplierId: order.supplierId,
      stockId: input.stockId,
      reason: input.reason,
      tags: ['supplier', outcome, order.id],
    }
    writeSupplierState(
      ctx,
      (slice) => ({
        ...slice,
        missedDeliveriesToday: [...slice.missedDeliveriesToday, missed],
      }),
      'missed_delivery_record',
    )
    // A short delivery is a shortage the rest of the sim can see: the stock
    // module's shortage list is what the repeated-shortage memory pattern,
    // the issue seeds and the feedback detectors already read.
    appendShortage(ctx, {
      stockId: input.stockId,
      requested: outstandingUnits(order, input.stockId) + input.quantity,
      available: input.quantity,
      day: ctx.state.calendar.totalDaysElapsed + 1,
      reason: `supplier ${order.supplierId} ${outcome === 'missed' ? 'missed' : 'shorted'} order ${order.id}`,
    })
    if (supplier) {
      const damage = outcome === 'missed' ? 3 : 1
      ctx.modifySupplier(
        order.supplierId,
        {
          relationship: Math.max(0, supplier.relationship - damage),
        },
        { source: SUPPLIERS_MODULE_ID, reason: `delivery_${outcome}` },
      )
    }
  }

  ctx.addCause({
    source: `${SUPPLIERS_MODULE_ID}.delivery_${outcome}`,
    sourceType: 'supplier',
    target: order.supplierId,
    targetType: 'supplier',
    amount: input.quantity,
    direction: outcome === 'full' ? 'increase' : 'decrease',
    weight: Math.max(1, input.quantity),
    readable:
      outcome === 'full'
        ? `${input.supplierLabel} delivered ${input.quantity} ${input.stockLabel} against order ${order.id}.`
        : `${input.supplierLabel} ${outcome === 'missed' ? 'missed' : 'shorted'} order ${order.id}: ${input.reason}.`,
    tags: ['supplier', 'delivery', outcome, order.supplierId, input.stockId],
    relatedSystems: [SUPPLIERS_MODULE_ID, 'stock'],
  })

  if (input.failed) {
    ctx.addHistory({
      category: 'state_change',
      summary: `${input.supplierLabel} failed to deliver order ${order.id} (${input.stockLabel}).`,
      tags: ['supplier', 'order', 'failed'],
      relatedActors: [{ kind: 'supplier', id: order.supplierId }],
      relatedSystems: [SUPPLIERS_MODULE_ID],
    })
  }
}

function appendShortage(
  ctx: SimContext,
  shortage: {
    stockId: string
    requested: number
    available: number
    day: number
    reason: string
  },
): void {
  ctx.modifyModuleState<StockModuleState>(
    STOCK_MODULE_ID,
    (current) => {
      const base = current ?? { ledger: [], shortages: [] }
      return { ...base, shortages: [...base.shortages, shortage] }
    },
    { source: SUPPLIERS_MODULE_ID, reason: 'delivery_shortage' },
  )
}

// ---------- Player-side amendments ----------

export type AmendResult =
  | { ok: true; order: PurchaseOrderRecord; refund: number; extraDue: number }
  | { ok: false; code: string; reason: string }

/** Amendments are free until the day before delivery, and capped. */
export const MAX_ORDER_AMENDMENTS = 2

export function canAmendOrder(
  state: TavernState,
  order: PurchaseOrderRecord,
): { ok: true } | { ok: false; code: string; reason: string } {
  if (!isOrderOpen(order)) {
    return { ok: false, code: 'order_closed', reason: 'That order is already finished.' }
  }
  if (order.attempts.length > 0) {
    return {
      ok: false,
      code: 'already_attempted',
      reason: 'The supplier has already tried to deliver this order.',
    }
  }
  if (order.amendmentsUsed >= MAX_ORDER_AMENDMENTS) {
    return {
      ok: false,
      code: 'amendment_limit',
      reason: `An order may be amended ${MAX_ORDER_AMENDMENTS} times.`,
    }
  }
  if (state.calendar.totalDaysElapsed >= order.promisedOnDay) {
    return {
      ok: false,
      code: 'too_late',
      reason: 'The delivery is already loaded; it cannot be amended today.',
    }
  }
  return { ok: true }
}

/**
 * Change the quantity on an open order.
 *
 * Reducing refunds the prepaid share; increasing charges it, and is capped
 * by the same capacity the original quote respected — an amendment is not a
 * back door around what the supplier can actually carry.
 */
export function amendOrder(
  ctx: SimContext,
  orderId: string,
  newQuantity: number,
): AmendResult {
  const order = getSupplierModuleState(ctx.state).orders[orderId]
  if (!order) return { ok: false, code: 'unknown_order', reason: `No order '${orderId}'` }
  const gate = canAmendOrder(ctx.state, order)
  if (!gate.ok) return gate
  const line = order.lines[0]
  if (!line) return { ok: false, code: 'no_lines', reason: 'That order has no lines.' }

  const target = Math.floor(newQuantity)
  if (!Number.isFinite(target) || target <= 0) {
    return { ok: false, code: 'invalid_quantity', reason: 'An order needs at least one unit.' }
  }
  if (target === line.quantity) {
    return { ok: false, code: 'no_change', reason: 'That is already the order quantity.' }
  }

  if (target > line.quantity) {
    const headroom = quoteSupplierOrder(ctx.state, {
      supplierId: order.supplierId,
      stockId: line.stockId,
      quantity: target - line.quantity,
      rush: order.rush,
    })
    if (headroom.refusal) {
      return { ok: false, code: headroom.refusal.code, reason: headroom.refusal.reason }
    }
    if (order.paymentTerms === 'net') {
      const account = getSupplierAccount(ctx.state, order.supplierId)
      const addedValue =
        Math.ceil(line.unitPrice * target) -
        Math.ceil(line.unitPrice * line.quantity)
      const available = Math.max(
        0,
        account.creditLimit - supplierCreditExposure(ctx.state, order.supplierId),
      )
      if (addedValue > available) {
        return {
          ok: false,
          code: 'credit_limit_reached',
          reason: `${ctx.state.world.suppliers[order.supplierId]?.label ?? order.supplierId} will carry ${available} more coin; this amendment adds ${addedValue}.`,
        }
      }
    }
  }

  const today = ctx.state.calendar.totalDaysElapsed
  const prepaidPerUnit = order.prepaid / Math.max(1, line.quantity)
  const newPrepaid =
    order.paymentTerms === 'cash'
      ? Math.ceil(line.unitPrice * target)
      : Math.round(prepaidPerUnit * target)
  const delta = newPrepaid - order.prepaid
  let refund = 0
  let extraDue = 0
  if (delta > 0) {
    if (delta > ctx.state.coin) {
      return {
        ok: false,
        code: 'insufficient_coin',
        reason: `Increasing the order needs ${delta} more coin up front.`,
      }
    }
    extraDue = delta
    spendCoin(ctx, delta, {
      source: `${SUPPLIERS_MODULE_ID}.order_amendment.${orderId}`,
      category: 'purchase',
      tags: ['supplier_order', 'order_deposit', order.supplierId, line.stockId],
    })
  } else if (delta < 0) {
    refund = -delta
    refundCoin(ctx, refund, order.supplierId, line.stockId, 'order amended down')
  }

  const amended: PurchaseOrderRecord = {
    ...order,
    lines: [{ ...line, quantity: target }],
    capacityCommitted: target,
    prepaid: newPrepaid,
    amendmentsUsed: order.amendmentsUsed + 1,
    lastTransitionOnDay: today,
    readable: `${ctx.state.world.suppliers[order.supplierId]?.label ?? order.supplierId}: ${target} ${
      ctx.state.stock[line.stockId]?.label ?? line.stockId
    } for day ${order.promisedOnDay}`,
    history: [
      ...order.history,
      {
        onDay: today,
        from: order.status,
        to: order.status,
        reason: `amended from ${line.quantity} to ${target} units`,
        amount: target,
      },
    ],
  }
  upsertPurchaseOrder(ctx, amended, 'order_amended')
  return { ok: true, order: amended, refund, extraDue }
}

export type CancelResult =
  | { ok: true; order: PurchaseOrderRecord; refund: number; forfeited: number }
  | { ok: false; code: string; reason: string }

/**
 * Withdraw an order.
 *
 * The cancellation rule is the one the player was quoted: a deposit is
 * returned in full while the supplier still has time to resell the goods,
 * and forfeited once they are loaded. That the rule has teeth is what makes
 * committing to a rush order a decision.
 */
export function cancelOrder(
  ctx: SimContext,
  orderId: string,
  reason = 'cancelled by the owner',
): CancelResult {
  const order = getSupplierModuleState(ctx.state).orders[orderId]
  if (!order) return { ok: false, code: 'unknown_order', reason: `No order '${orderId}'` }
  if (!isOrderOpen(order)) {
    return { ok: false, code: 'order_closed', reason: 'That order is already finished.' }
  }
  const today = ctx.state.calendar.totalDaysElapsed
  const line = order.lines[0]
  const owed = outstandingUnits(order)
  const prepaidOnOwed = Math.round(
    order.prepaid * (owed / Math.max(1, order.lines[0]?.quantity ?? 1)),
  )
  const lateNotice = today >= order.promisedOnDay - 1
  const refund = lateNotice ? 0 : prepaidOnOwed
  const forfeited = prepaidOnOwed - refund

  if (refund > 0 && line) {
    refundCoin(ctx, refund, order.supplierId, line.stockId, 'order cancelled in time')
  }

  const cancelled = cancelContract(
    order,
    today,
    forfeited > 0 ? `${reason}; ${forfeited} coin deposit forfeited` : reason,
  )
  upsertPurchaseOrder(ctx, cancelled, 'order_cancelled')
  writeSupplierState(
    ctx,
    (slice) => ({
      ...slice,
      totals: {
        ...slice.totals,
        ordersCancelled: slice.totals.ordersCancelled + 1,
      },
    }),
    'order_cancelled',
  )
  writeSupplierAccount(
    ctx,
    order.supplierId,
    (account) => ({
      ...account,
      history: {
        ...account.history,
        ordersCancelled: account.history.ordersCancelled + 1,
      },
      lastDecisionDay: today,
      lastDecisionReason: reason,
    }),
    'order_cancelled',
  )
  const supplier = ctx.state.world.suppliers[order.supplierId]
  if (supplier && lateNotice) {
    ctx.modifySupplier(
      order.supplierId,
      { relationship: Math.max(0, supplier.relationship - 2) },
      { source: SUPPLIERS_MODULE_ID, reason: 'late_cancellation' },
    )
  }
  return { ok: true, order: cancelled, refund, forfeited }
}

function refundCoin(
  ctx: SimContext,
  amount: number,
  supplierId: string,
  stockId: string,
  reason: string,
): void {
  if (amount <= 0) return
  // A refund is a negative purchase, not income: booking it as `purchase`
  // keeps Phase 5's `stockPurchases` bucket honest instead of inflating
  // `otherIncome` with money that was never earned.
  ctx.modifyCoin(amount, { source: SUPPLIERS_MODULE_ID, reason })
  ctx.modifyModuleState<StockModuleState>(
    STOCK_MODULE_ID,
    (current) => {
      const base = current ?? { ledger: [], shortages: [] }
      return {
        ...base,
        ledger: [
          ...base.ledger,
          {
            source: `${SUPPLIERS_MODULE_ID}.order_refund`,
            amount,
            category: 'purchase' as const,
            tags: ['supplier_order', 'order_refund', supplierId, stockId],
          },
        ],
      }
    },
    { source: SUPPLIERS_MODULE_ID, reason },
  )
}

// ---------- Local spot market ----------

export type SpotPurchaseResult =
  | { ok: true; quantity: number; unitPrice: number; cost: number }
  | { ok: false; code: string; reason: string }

/**
 * Buy immediately from the local market.
 *
 * §6.1 keeps an emergency channel, "with distinct cost and availability" —
 * so this pays a premium over the supplier price and can only absorb so
 * many units of one good in a day. It does not roll reliability (the goods
 * are in front of you) and it earns no supplier relationship (you did not
 * buy from a supplier).
 */
export function buyOnSpotMarket(
  ctx: SimContext,
  stockId: string,
  requested: number,
  /** Ledger source. The calling owner action names itself so the daily
   *  ledger keeps attributing the spend to the button the player pressed. */
  source = `${SUPPLIERS_MODULE_ID}.spot_market.${stockId}`,
): SpotPurchaseResult {
  const item = ctx.state.stock[stockId]
  if (!item) {
    return { ok: false, code: 'unknown_stock', reason: `No stock item '${stockId}'` }
  }
  const available = spotMarketAvailable(ctx.state, stockId)
  if (available <= 0) {
    return {
      ok: false,
      code: 'market_exhausted',
      reason: `The market has no more ${item.label} today.`,
    }
  }
  const quantity = Math.min(Math.floor(requested), available)
  if (quantity <= 0) {
    return { ok: false, code: 'invalid_quantity', reason: 'Buy at least one unit.' }
  }
  const unitPrice = spotMarketUnitPrice(ctx.state, stockId)
  const cost = Math.ceil(unitPrice * quantity)
  if (cost > ctx.state.coin) {
    return {
      ok: false,
      code: 'insufficient_coin',
      reason: `${quantity} ${item.label} costs ${cost} coin at market; the till holds ${ctx.state.coin}.`,
    }
  }

  spendCoin(ctx, cost, {
    source,
    category: 'purchase',
    tags: ['spot_market', 'restock', stockId],
  })
  // Market goods are ordinary: middling quality, no supplier standard.
  receiveGoods(ctx, {
    stockId,
    quantity,
    quality: SPOT_MARKET_QUALITY,
    supplierId: 'local_market',
    coinCost: cost,
  })
  writeSupplierState(
    ctx,
    (slice) => ({
      ...slice,
      spotPurchasesToday: {
        ...slice.spotPurchasesToday,
        [stockId]: (slice.spotPurchasesToday[stockId] ?? 0) + quantity,
      },
      totals: { ...slice.totals, spotPurchases: slice.totals.spotPurchases + 1 },
    }),
    'spot_purchase',
  )
  return { ok: true, quantity, unitPrice, cost }
}
