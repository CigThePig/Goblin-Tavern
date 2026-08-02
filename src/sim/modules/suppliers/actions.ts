import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'
import {
  TIME_COST_QUICK,
  TIME_COST_SHORT,
} from '../ownerActions/stateHelpers'
import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionApplied,
  OwnerActionDefinition,
  OwnerActionInput,
} from '../ownerActions/types'

import {
  negotiateSupplierTerms,
  requestSupplierCredit,
} from './credit'
import {
  creditNoteAgainstInvoice,
  outstandingSupplierInvoices,
  paySupplierInvoice,
} from './invoices'
import {
  amendOrder,
  cancelOrder,
  canAmendOrder,
  placeOrder,
  placeSplitOrder,
} from './orders'
import { creditEligibility, quoteSupplierOrder } from './quote'
import { scheduleSupplierPayment } from './supplierEvents'
import {
  findPurchaseOrder,
  getPurchaseOrder,
  getSupplierAccount,
  isOrderOpen,
  listAllPurchaseOrders,
  listPurchaseOrders,
  outstandingUnits,
  recordOrderDispute,
  writeSupplierAccount,
} from './state'

// Expansion Phase 6 — player capability.
//
// §5 fails a phase where "a player cannot discover what action is available
// and why", so every rejection below names the condition that would change
// the answer rather than saying no. And every one of these is a REAL
// owner action in the shared registry, which means they inherit the day's
// time budget, the planner, the quick-action strips on the supplier sheet
// and the generic action picker without a bespoke UI path.
//
// Target-id shapes, following the Phase 2 upgrade-action convention of
// composite ids for a two-level target:
//
//   place_supplier_order       "<supplierId>:<stockId>"
//   amend/cancel/dispute       "<orderId>"
//   credit/pay/schedule/negotiate  "<supplierId>"

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

const DEFAULT_ORDER_QUANTITY = 40

function readQuantity(input: OwnerActionInput, fallback: number): number {
  return input.amount !== undefined && input.amount > 0
    ? Math.floor(input.amount)
    : fallback
}

function readFlag(input: OwnerActionInput, key: string): boolean {
  return input.options?.[key] === true
}

function splitTarget(targetId: string): { supplierId: string; stockId: string } | undefined {
  const index = targetId.indexOf(':')
  if (index <= 0 || index === targetId.length - 1) return undefined
  return {
    supplierId: targetId.slice(0, index),
    stockId: targetId.slice(index + 1),
  }
}

// ---------- place_supplier_order ----------

/**
 * Every (supplier, good) pair the tavern could order today, each carrying
 * its own quote in the hint.
 *
 * The hint is the quote, not a description of one: price, lead time and
 * terms come from `quoteSupplierOrder`, so what the picker shows and what
 * the order charges cannot drift apart.
 */
function listOrderTargets(ctx: SimContext): ActionTarget[] {
  const targets: ActionTarget[] = []
  for (const supplier of Object.values(ctx.state.world.suppliers)) {
    for (const stockId of supplier.goodsProvided) {
      if (!ctx.state.stock[stockId]) continue
      const quote = quoteSupplierOrder(ctx.state, {
        supplierId: supplier.id,
        stockId,
        quantity: DEFAULT_ORDER_QUANTITY,
      })
      const label = `${supplier.label} — ${ctx.state.stock[stockId]?.label ?? stockId}`
      targets.push({
        id: `${supplier.id}:${stockId}`,
        label,
        hint: quote.refusal
          ? quote.refusal.reason
          : `${quote.quantity} @ ${quote.unitPrice} = ${quote.totalPrice}c · day ${quote.deliveryDay} · ${quote.paymentTerms} · quality ${quote.quality}`,
      })
    }
  }
  return targets.sort((a, b) => a.id.localeCompare(b.id))
}

const placeSupplierOrder: OwnerActionDefinition = {
  id: 'place_supplier_order',
  label: 'Place Supplier Order',
  category: 'immediate',
  tags: ['supply', 'stock', 'supplier', 'procurement'],
  effectsPreview: 'Orders goods for delivery on a promised day',
  pressureAffinity: ['stock_shortage', 'supplier_distrust'],
  targetType: 'supplier',
  timeCost: TIME_COST_SHORT,
  getValidTargets: listOrderTargets,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'Choose a supplier and a good.')
    }
    const parts = splitTarget(input.targetId)
    if (!parts) {
      return reject(
        'unknown_target',
        `Target must be '<supplier>:<stock>', got '${input.targetId}'`,
      )
    }
    const quote = quoteSupplierOrder(ctx.state, {
      supplierId: parts.supplierId,
      stockId: parts.stockId,
      quantity: readQuantity(input, DEFAULT_ORDER_QUANTITY),
      onCredit: readFlag(input, 'onCredit'),
      rush: readFlag(input, 'rush'),
      allowSubstitution: readFlag(input, 'allowSubstitution'),
    })
    if (quote.refusal) return reject(quote.refusal.code, quote.refusal.reason)
    if (quote.dueAtPlacement > ctx.state.coin) {
      return reject(
        'insufficient_coin',
        `${quote.supplierLabel} wants ${quote.dueAtPlacement} coin up front; the till holds ${ctx.state.coin}.`,
      )
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const parts = splitTarget(input.targetId!)!
    const request = {
      supplierId: parts.supplierId,
      stockId: parts.stockId,
      quantity: readQuantity(input, DEFAULT_ORDER_QUANTITY),
      onCredit: readFlag(input, 'onCredit'),
      rush: readFlag(input, 'rush'),
      allowSubstitution: readFlag(input, 'allowSubstitution'),
    }

    if (readFlag(input, 'split')) {
      const result = placeSplitOrder(ctx, request)
      const totalOrdered = result.orders.reduce(
        (sum, order) => sum + outstandingUnits(order),
        0,
      )
      return {
        actionId: placeSupplierOrder.id,
        label: `Split order: ${totalOrdered} ${ctx.state.stock[parts.stockId]?.label ?? parts.stockId}`,
        targetId: input.targetId!,
        targetLabel: parts.supplierId,
        timeCost: placeSupplierOrder.timeCost,
        effects: [
          ...result.orders.map(
            (order) =>
              `${ctx.state.world.suppliers[order.supplierId]?.label ?? order.supplierId}: ${outstandingUnits(order)} units for day ${order.promisedOnDay}`,
          ),
          ...(result.unfilled > 0 ? [`${result.unfilled} units unfilled`] : []),
        ],
        data: {
          orderIds: result.orders.map((order) => order.id),
          unfilled: result.unfilled,
          rejections: result.rejections,
        },
      }
    }

    const result = placeOrder(ctx, request)
    if (!result.ok) {
      // `canApply` already gated this; reaching here means the world moved
      // between validation and application, so report honestly rather than
      // pretending an order exists.
      return {
        actionId: placeSupplierOrder.id,
        label: 'Order refused',
        targetId: input.targetId!,
        timeCost: placeSupplierOrder.timeCost,
        effects: [result.reason],
        data: { placed: false, code: result.code, reason: result.reason },
      }
    }
    const { order, quote } = result
    return {
      actionId: placeSupplierOrder.id,
      label: `Ordered ${quote.quantity} ${quote.stockLabel}`,
      targetId: input.targetId!,
      targetLabel: quote.supplierLabel,
      timeCost: placeSupplierOrder.timeCost,
      effects: [
        `${quote.supplierLabel}: ${quote.quantity} ${quote.stockLabel} for day ${quote.deliveryDay}`,
        `${quote.paymentTerms} terms · ${quote.dueAtPlacement} coin now, ${quote.invoicedOnDelivery} on delivery`,
        ...(quote.missChance > 0
          ? [`${Math.round(quote.missChance * 100)}% risk of a short or missed delivery`]
          : []),
      ],
      data: {
        placed: true,
        orderId: order.id,
        supplierId: quote.supplierId,
        stockId: quote.stockId,
        quantity: quote.quantity,
        unitPrice: quote.unitPrice,
        totalPrice: quote.totalPrice,
        deliveryDay: quote.deliveryDay,
        paymentTerms: quote.paymentTerms,
        coin: { spent: quote.dueAtPlacement },
      },
    }
  },
}

// ---------- amend / cancel ----------

function listOpenOrders(ctx: SimContext): ActionTarget[] {
  return listPurchaseOrders(ctx.state, { open: true }).map((order) => ({
    id: order.id,
    label: order.readable,
    hint: `${outstandingUnits(order)} units outstanding · promised day ${order.promisedOnDay}`,
  }))
}

const amendSupplierOrder: OwnerActionDefinition = {
  id: 'amend_supplier_order',
  label: 'Amend Supplier Order',
  category: 'immediate',
  tags: ['supply', 'supplier', 'procurement'],
  effectsPreview: 'Changes the quantity on an order not yet loaded',
  targetType: 'supplier',
  timeCost: TIME_COST_QUICK,
  getValidTargets: listOpenOrders,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('missing_target', 'Choose an order.')
    const order = getPurchaseOrder(ctx.state, input.targetId)
    if (!order) return reject('unknown_target', `No open order '${input.targetId}'`)
    const gate = canAmendOrder(ctx.state, order)
    if (!gate.ok) return reject(gate.code, gate.reason)
    if (input.amount === undefined || Math.floor(input.amount) <= 0) {
      return reject('invalid_amount', 'Name the new quantity.')
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const result = amendOrder(ctx, input.targetId!, Math.floor(input.amount!))
    if (!result.ok) {
      return {
        actionId: amendSupplierOrder.id,
        label: 'Amendment refused',
        targetId: input.targetId!,
        timeCost: amendSupplierOrder.timeCost,
        effects: [result.reason],
        data: { amended: false, code: result.code },
      }
    }
    return {
      actionId: amendSupplierOrder.id,
      label: `Amended ${result.order.id}`,
      targetId: input.targetId!,
      targetLabel: result.order.readable,
      timeCost: amendSupplierOrder.timeCost,
      effects: [
        `now ${result.order.lines[0]?.quantity ?? 0} units`,
        ...(result.refund > 0 ? [`coin +${result.refund} refunded`] : []),
        ...(result.extraDue > 0 ? [`coin -${result.extraDue}`] : []),
      ],
      data: {
        amended: true,
        orderId: result.order.id,
        quantity: result.order.lines[0]?.quantity ?? 0,
        refund: result.refund,
        extraDue: result.extraDue,
      },
    }
  },
}

const cancelSupplierOrder: OwnerActionDefinition = {
  id: 'cancel_supplier_order',
  label: 'Cancel Supplier Order',
  category: 'immediate',
  tags: ['supply', 'supplier', 'procurement'],
  effectsPreview: 'Withdraws an order; a late cancellation forfeits the deposit',
  targetType: 'supplier',
  timeCost: TIME_COST_QUICK,
  getValidTargets: listOpenOrders,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('missing_target', 'Choose an order.')
    const order = getPurchaseOrder(ctx.state, input.targetId)
    if (!order) return reject('unknown_target', `No open order '${input.targetId}'`)
    if (!isOrderOpen(order)) {
      return reject('order_closed', 'That order is already finished.')
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const result = cancelOrder(ctx, input.targetId!)
    if (!result.ok) {
      return {
        actionId: cancelSupplierOrder.id,
        label: 'Cancellation refused',
        targetId: input.targetId!,
        timeCost: cancelSupplierOrder.timeCost,
        effects: [result.reason],
        data: { cancelled: false, code: result.code },
      }
    }
    return {
      actionId: cancelSupplierOrder.id,
      label: `Cancelled ${result.order.id}`,
      targetId: input.targetId!,
      targetLabel: result.order.readable,
      timeCost: cancelSupplierOrder.timeCost,
      effects: [
        'order withdrawn',
        ...(result.refund > 0 ? [`coin +${result.refund} refunded`] : []),
        ...(result.forfeited > 0 ? [`${result.forfeited} coin deposit forfeited`] : []),
      ],
      data: {
        cancelled: true,
        orderId: result.order.id,
        refund: result.refund,
        forfeited: result.forfeited,
      },
    }
  },
}

// ---------- dispute ----------

/**
 * Orders whose delivery record gives the player something to dispute.
 *
 * Reads the archive as well as the live map: the order most worth
 * disputing is usually the one that already failed outright, and that one
 * is terminal.
 */
function listDisputableOrders(ctx: SimContext): ActionTarget[] {
  return listAllPurchaseOrders(ctx.state)
    .filter(
      (order) =>
        order.dispute === undefined &&
        order.attempts.some((attempt) => attempt.outcome !== 'full'),
    )
    .map((order) => ({
      id: order.id,
      label: order.readable,
      hint: `${order.attempts.filter((a) => a.outcome !== 'full').length} failed attempt(s)`,
    }))
}

const disputeSupplierDelivery: OwnerActionDefinition = {
  id: 'dispute_supplier_delivery',
  label: 'Dispute a Delivery',
  category: 'immediate',
  tags: ['supply', 'supplier', 'procurement', 'dispute'],
  effectsPreview: 'Challenges a short or missed delivery for a credit note',
  pressureAffinity: ['supplier_distrust'],
  targetType: 'supplier',
  timeCost: TIME_COST_QUICK,
  getValidTargets: listDisputableOrders,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('missing_target', 'Choose an order to dispute.')
    const order = findPurchaseOrder(ctx.state, input.targetId)
    if (!order) return reject('unknown_target', `No order '${input.targetId}'`)
    if (order.dispute !== undefined) {
      return reject('already_disputed', 'That delivery has already been disputed.')
    }
    if (!order.attempts.some((attempt) => attempt.outcome !== 'full')) {
      return reject(
        'nothing_to_dispute',
        'That order has not been shorted or missed.',
      )
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const order = findPurchaseOrder(ctx.state, input.targetId!)!
    const today = ctx.state.calendar.totalDaysElapsed
    const supplier = ctx.state.world.suppliers[order.supplierId]
    const label = supplier?.label ?? order.supplierId
    const failures = order.attempts.filter((attempt) => attempt.outcome !== 'full')

    // The verdict is the evidence, not a roll: repeated failures on the
    // record uphold the complaint, a single slip against a reliable
    // supplier does not.
    const upheld =
      failures.length >= 2 || (supplier !== undefined && supplier.reliability < 50)

    let relief = 0
    if (upheld) {
      // A quarter of the outstanding bill per failed attempt, up to half.
      // Measured against what is still OWED rather than against what
      // arrived: a delivery that brought nothing is the strongest complaint
      // there is, and pricing the credit note off the delivered quantity
      // would have paid out exactly nothing for it.
      const share = Math.min(0.5, 0.25 * failures.length)
      for (const invoiceId of order.invoiceIds) {
        const invoice = outstandingSupplierInvoices(ctx.state, order.supplierId).find(
          (row) => row.id === invoiceId,
        )
        if (!invoice) continue
        relief += creditNoteAgainstInvoice(
          ctx,
          invoiceId,
          Math.max(1, Math.ceil(invoice.outstanding * share)),
          `dispute upheld over ${failures.length} failed deliver${failures.length === 1 ? 'y' : 'ies'}`,
        )
      }
    }

    recordOrderDispute(ctx, order.id, {
      onDay: today,
      reason: `${failures.length} failed delivery attempt(s)`,
      resolution: upheld
        ? `upheld; ${relief} coin credited`
        : 'not upheld; the supplier stands by the delivery',
      resolvedOnDay: today,
    })
    writeSupplierAccount(
      ctx,
      order.supplierId,
      (account) => ({
        ...account,
        history: {
          ...account.history,
          disputes: account.history.disputes + 1,
          disputesUpheld: account.history.disputesUpheld + (upheld ? 1 : 0),
        },
      }),
      'order_disputed',
    )

    if (supplier) {
      ctx.modifySupplier(
        order.supplierId,
        {
          relationship: Math.max(
            0,
            Math.min(100, supplier.relationship + (upheld ? -2 : -4)),
          ),
        },
        { source: 'suppliers', reason: 'delivery_disputed' },
      )
    }

    return {
      actionId: disputeSupplierDelivery.id,
      label: upheld ? `Dispute upheld against ${label}` : `Dispute rejected by ${label}`,
      targetId: input.targetId!,
      targetLabel: order.readable,
      timeCost: disputeSupplierDelivery.timeCost,
      effects: upheld
        ? [`${relief} coin credited against the invoice`, 'relationship -2']
        : ['the supplier stands by the delivery', 'relationship -4'],
      data: { upheld, relief, orderId: order.id },
    }
  },
}

// ---------- credit ----------

function listSuppliers(ctx: SimContext): ActionTarget[] {
  return Object.values(ctx.state.world.suppliers)
    .map((supplier) => {
      const account = getSupplierAccount(ctx.state, supplier.id)
      const owed = outstandingSupplierInvoices(ctx.state, supplier.id).reduce(
        (sum, invoice) => sum + invoice.outstanding,
        0,
      )
      return {
        id: supplier.id,
        label: supplier.label,
        hint: `credit ${account.creditStatus}${account.creditLimit > 0 ? ` (${account.creditLimit}c)` : ''}${owed > 0 ? ` · ${owed}c owed` : ''}`,
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

const requestCredit: OwnerActionDefinition = {
  id: 'request_supplier_credit',
  label: 'Ask for Credit',
  category: 'social',
  tags: ['supplier', 'credit', 'procurement'],
  effectsPreview: 'Asks a supplier to bill you instead of taking cash',
  targetType: 'supplier',
  timeCost: TIME_COST_QUICK,
  getValidTargets: listSuppliers,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('missing_target', 'Choose a supplier.')
    if (!ctx.state.world.suppliers[input.targetId]) {
      return reject('unknown_target', `No supplier '${input.targetId}'`)
    }
    const eligibility = creditEligibility(ctx.state, input.targetId)
    // A refusal is still a legitimate thing to spend the time on — but the
    // player should be told the answer before they spend it, not after.
    return eligibility.eligible ? OK : reject('credit_refused', eligibility.reason)
  },
  apply: (ctx, input): OwnerActionApplied => {
    const result = requestSupplierCredit(ctx, input.targetId!)
    const label = ctx.state.world.suppliers[input.targetId!]?.label ?? input.targetId!
    if (!result.ok) {
      return {
        actionId: requestCredit.id,
        label: `${label} refused credit`,
        targetId: input.targetId!,
        targetLabel: label,
        timeCost: requestCredit.timeCost,
        effects: [result.reason],
        data: { approved: false, reason: result.reason },
      }
    }
    return {
      actionId: requestCredit.id,
      label: `${label} opened a credit line`,
      targetId: input.targetId!,
      targetLabel: label,
      timeCost: requestCredit.timeCost,
      effects: [
        `credit limit ${result.decision.limit} coin`,
        `net ${result.decision.netTermDays} days`,
      ],
      data: {
        approved: true,
        limit: result.decision.limit,
        netTermDays: result.decision.netTermDays,
      },
    }
  },
}

// ---------- pay / schedule payment ----------

function listSuppliersOwed(ctx: SimContext): ActionTarget[] {
  const owedBySupplier = new Map<string, number>()
  for (const invoice of outstandingSupplierInvoices(ctx.state)) {
    owedBySupplier.set(
      invoice.supplierId,
      (owedBySupplier.get(invoice.supplierId) ?? 0) + invoice.outstanding,
    )
  }
  return [...owedBySupplier.entries()]
    .map(([supplierId, owed]) => ({
      id: supplierId,
      label: ctx.state.world.suppliers[supplierId]?.label ?? supplierId,
      hint: `${Math.ceil(owed)} coin outstanding`,
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

/** The invoice a payment should go to first: soonest due, then most escalated. */
function nextInvoiceFor(state: TavernState, supplierId: string) {
  return outstandingSupplierInvoices(state, supplierId).sort(
    (a, b) =>
      b.escalation - a.escalation || a.dueOnDay - b.dueOnDay || a.id.localeCompare(b.id),
  )[0]
}

const payInvoice: OwnerActionDefinition = {
  id: 'pay_supplier_invoice',
  label: 'Pay Supplier Invoice',
  category: 'immediate',
  tags: ['supplier', 'credit', 'invoice', 'procurement'],
  effectsPreview: 'Settles the most pressing invoice, in part or in full',
  pressureAffinity: ['debt', 'supplier_distrust'],
  targetType: 'supplier',
  timeCost: TIME_COST_QUICK,
  getValidTargets: listSuppliersOwed,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('missing_target', 'Choose a supplier.')
    const invoice = nextInvoiceFor(ctx.state, input.targetId)
    if (!invoice) {
      return reject('nothing_owed', 'Nothing is owed to that supplier.')
    }
    if (ctx.state.coin <= 0) return reject('insufficient_coin', 'The till is empty.')
    if (
      input.amount !== undefined &&
      (!Number.isFinite(input.amount) || Math.floor(input.amount) <= 0)
    ) {
      return reject('invalid_amount', 'A payment must be at least 1 whole coin.')
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const invoice = nextInvoiceFor(ctx.state, input.targetId!)!
    const label = ctx.state.world.suppliers[input.targetId!]?.label ?? input.targetId!
    const requested =
      input.amount !== undefined ? Math.floor(input.amount) : Math.ceil(invoice.outstanding)
    const result = paySupplierInvoice(ctx, invoice.id, requested)
    if (!result) {
      return {
        actionId: payInvoice.id,
        label: `Nothing paid to ${label}`,
        targetId: input.targetId!,
        targetLabel: label,
        timeCost: payInvoice.timeCost,
        effects: ['no coin was available for the payment'],
        data: { paid: 0 },
      }
    }
    return {
      actionId: payInvoice.id,
      label: result.settled ? `Settled ${label}'s invoice` : `Paid ${label} on account`,
      targetId: input.targetId!,
      targetLabel: label,
      timeCost: payInvoice.timeCost,
      effects: [
        `coin -${result.applied}`,
        result.settled
          ? 'invoice settled'
          : `${Math.ceil(result.outstandingAfter)} coin still owed`,
      ],
      data: {
        invoiceId: result.invoiceId,
        paid: result.applied,
        settled: result.settled,
        outstanding: result.outstandingAfter,
        coin: { spent: result.applied },
      },
    }
  },
}

/** How far ahead a promised payment may be scheduled. */
export const MAX_PAYMENT_SCHEDULE_DAYS = 7

const schedulePayment: OwnerActionDefinition = {
  id: 'schedule_supplier_payment',
  label: 'Promise a Payment',
  category: 'immediate',
  tags: ['supplier', 'credit', 'invoice', 'procurement'],
  effectsPreview: 'Promises to pay an invoice on a later day',
  pressureAffinity: ['debt', 'supplier_distrust'],
  targetType: 'supplier',
  timeCost: TIME_COST_QUICK,
  getValidTargets: listSuppliersOwed,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('missing_target', 'Choose a supplier.')
    const invoice = nextInvoiceFor(ctx.state, input.targetId)
    if (!invoice) return reject('nothing_owed', 'Nothing is owed to that supplier.')
    const days = readScheduleDays(input)
    if (days < 1 || days > MAX_PAYMENT_SCHEDULE_DAYS) {
      return reject(
        'invalid_schedule',
        `A payment can be promised 1 to ${MAX_PAYMENT_SCHEDULE_DAYS} days out.`,
      )
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const supplierId = input.targetId!
    const invoice = nextInvoiceFor(ctx.state, supplierId)!
    const label = ctx.state.world.suppliers[supplierId]?.label ?? supplierId
    const days = readScheduleDays(input)
    const onDay = ctx.state.calendar.totalDaysElapsed + days
    const amount =
      input.amount !== undefined && input.amount > 0
        ? Math.floor(input.amount)
        : Math.ceil(invoice.outstanding)
    const scheduled = scheduleSupplierPayment(ctx, {
      invoiceId: invoice.id,
      supplierId,
      amount,
      onDay,
    })
    return {
      actionId: schedulePayment.id,
      label: `Promised ${label} ${amount} coin`,
      targetId: supplierId,
      targetLabel: label,
      timeCost: schedulePayment.timeCost,
      effects:
        scheduled.status === 'scheduled'
          ? [`${amount} coin promised for day ${onDay}`]
          : ['that payment was already promised'],
      data: {
        invoiceId: invoice.id,
        amount,
        onDay,
        status: scheduled.status,
      },
    }
  },
}

function readScheduleDays(input: OwnerActionInput): number {
  const raw = input.options?.['inDays']
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.floor(raw)
  return 3
}

// ---------- negotiate ----------

const negotiateTerms: OwnerActionDefinition = {
  id: 'negotiate_supplier_terms',
  label: 'Negotiate Terms',
  category: 'social',
  tags: ['supplier', 'procurement', 'negotiation'],
  effectsPreview: 'Trades standing for a price break and a larger credit line',
  pressureAffinity: ['supplier_distrust', 'market_instability'],
  targetType: 'supplier',
  timeCost: TIME_COST_QUICK,
  getValidTargets: listSuppliers,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('missing_target', 'Choose a supplier.')
    const supplier = ctx.state.world.suppliers[input.targetId]
    if (!supplier) return reject('unknown_target', `No supplier '${input.targetId}'`)
    const account = getSupplierAccount(ctx.state, input.targetId)
    const today = ctx.state.calendar.totalDaysElapsed
    if (
      account.termsAdjustmentUntilDay !== undefined &&
      today < account.termsAdjustmentUntilDay
    ) {
      return reject(
        'terms_already_set',
        `Terms with ${supplier.label} are settled until day ${account.termsAdjustmentUntilDay}.`,
      )
    }
    if (
      outstandingSupplierInvoices(ctx.state, input.targetId).some((invoice) =>
        ['grace', 'defaulted', 'in_collections'].includes(invoice.status),
      )
    ) {
      return reject(
        'arrears_outstanding',
        `${supplier.label} will not discuss terms while an invoice is past due.`,
      )
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const label = ctx.state.world.suppliers[input.targetId!]?.label ?? input.targetId!
    const result = negotiateSupplierTerms(ctx, input.targetId!)
    if (!result.ok) {
      return {
        actionId: negotiateTerms.id,
        label: `${label} would not move`,
        targetId: input.targetId!,
        targetLabel: label,
        timeCost: negotiateTerms.timeCost,
        effects: [result.reason],
        data: { agreed: false, code: result.code },
      }
    }
    return {
      actionId: negotiateTerms.id,
      label: `${label} agreed new terms`,
      targetId: input.targetId!,
      targetLabel: label,
      timeCost: negotiateTerms.timeCost,
      effects: [
        `unit prices ×${result.termsAdjustment} until day ${result.untilDay}`,
        ...(result.creditLimit > 0 ? [`credit limit ${result.creditLimit} coin`] : []),
      ],
      data: {
        agreed: true,
        termsAdjustment: result.termsAdjustment,
        untilDay: result.untilDay,
        creditLimit: result.creditLimit,
      },
    }
  },
}

export const SUPPLIER_ACTIONS: OwnerActionDefinition[] = [
  placeSupplierOrder,
  amendSupplierOrder,
  cancelSupplierOrder,
  disputeSupplierDelivery,
  requestCredit,
  payInvoice,
  schedulePayment,
  negotiateTerms,
]
