import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { EntityRef, SupplierWorldState, TavernState } from '../../state/TavernState'
import { registerScheduledEvent } from '../../contracts/scheduledEvents/registry'
import { scheduleEvent } from '../../contracts/scheduledEvents/state'
import type {
  ScheduledEventDefinition,
  ScheduledEventResolution,
} from '../../contracts/scheduledEvents/index'

import { creditEligibility, netTermsFor } from './quote'
import { deliverOrder, setDeliveryScheduler } from './orders'
import { paySupplierInvoice, outstandingSupplierInvoices } from './invoices'
import {
  SUPPLIERS_MODULE_ID,
  getPurchaseOrder,
  getSupplierAccount,
  writeSupplierAccount,
} from './state'
import { NEGOTIATION_TERM_DAYS } from './credit'
import type { PurchaseOrderRecord } from './types'

// Expansion Phase 6 §1.1 applied to procurement.
//
// Two kinds of scheduled event live here.
//
// 1. THE DELIVERY PROMISE. `supplier_delivery_due` is what makes a lead
//    time real: an order placed today for day+2 puts a dated promise on the
//    calendar, and the promise is TESTED on that day against the supplier's
//    reliability. It fires on the `morning` beat, so goods that arrive are
//    in the cellar before the player plans and before service runs — and
//    goods that do not arrive are visibly absent on the day they were
//    needed, which is the "delayed delivery affecting a real service day"
//    requirement.
//
//    Exact-once is keyed on (order, promised day). That is what stops a
//    reload re-delivering: the same order on the same promised day is the
//    same promise, and a re-promise after a miss moves the day, so the
//    retry is correctly a different key.
//
// 2. THE SUPPLIER'S OWN MOVES. Six `HOOK-*` families in the implementation
//    ledger name a supplier consequence that no domain could deliver on
//    before this phase, because the supplier layer had no terms, no credit
//    and no orders to change. It has all three now, so each one becomes
//    mechanical: retaliation stops supply and hardens terms, renegotiation
//    re-prices the account, goodwill grants a real concession, a new
//    supplier's uncertainty resolves into their actual terms, splitting
//    business between two suppliers resolves against both of them, and a
//    quality investigation concludes into the supplier's delivered quality.
//
//    Every one of them mutates procurement state the next quote reads. None
//    of them is a pressure nudge, which §5 lists as a fail condition.

export const SUPPLIER_DELIVERY_EVENT = 'supplier_delivery_due'
export const SUPPLIER_SCHEDULED_PAYMENT_EVENT = 'supplier_scheduled_payment'
export const SUPPLIER_RETALIATION_EVENT = 'supplier_retaliation'
export const SUPPLIER_RENEGOTIATION_EVENT = 'supplier_renegotiation'
export const SUPPLIER_GOODWILL_EVENT = 'supplier_goodwill_return'
export const NEW_SUPPLIER_UNCERTAINTY_EVENT = 'new_supplier_uncertainty'
export const DUAL_SUPPLIER_BALANCE_EVENT = 'dual_supplier_balance'
export const SUPPLIER_INVESTIGATION_EVENT = 'supplier_investigation_concluded'

const DeliveryPayloadSchema = z.object({
  orderId: z.string(),
  promisedOnDay: z.number().int().min(0),
})

const ScheduledPaymentPayloadSchema = z.object({
  invoiceId: z.string(),
  amount: z.number().min(1),
})

const SupplierPayloadSchema = z.object({ supplierId: z.string() })
const DualSupplierPayloadSchema = SupplierPayloadSchema.extend({
  secondarySupplierId: z.string().optional(),
})

function noOp(reason: string, readable: string): ScheduledEventResolution {
  return { status: 'no_op', reason, readable }
}

function supplierOf(
  state: TavernState,
  payload: unknown,
): SupplierWorldState | undefined {
  const parsed = SupplierPayloadSchema.safeParse(payload)
  if (!parsed.success) return undefined
  return state.world.suppliers[parsed.data.supplierId]
}

function supplierRef(supplierId: string): EntityRef {
  return { kind: 'supplier', id: supplierId }
}

/**
 * Turn `<prefix><supplierId>` into a payload, declining when the suffix is
 * not a supplier this run knows about.
 *
 * Declining is not a failure: the bridge then keeps the hook as a narrative
 * expectation rather than queueing a mechanical promise against nobody.
 */
function supplierHookAdapter(prefix: string) {
  return ({ hookName }: { hookName: string }) => {
    if (!hookName.startsWith(prefix)) return undefined
    const supplierId = hookName.slice(prefix.length)
    if (!supplierId) return undefined
    return {
      payload: { supplierId },
      target: supplierRef(supplierId),
    }
  }
}

function supplierExactOnceKey({
  type,
  payload,
  scheduledForDay,
}: {
  type: string
  payload: unknown
  scheduledForDay: number
}): string {
  const parsed = SupplierPayloadSchema.safeParse(payload)
  return `${type}|${parsed.success ? parsed.data.supplierId : 'unknown'}|${scheduledForDay}`
}

function dualSupplierExactOnceKey({
  type,
  payload,
  scheduledForDay,
}: {
  type: string
  payload: unknown
  scheduledForDay: number
}): string {
  const parsed = DualSupplierPayloadSchema.safeParse(payload)
  return parsed.success
    ? `${type}|${parsed.data.supplierId}|${parsed.data.secondarySupplierId ?? 'auto'}|${scheduledForDay}`
    : `${type}|unknown|${scheduledForDay}`
}

// ---------------------------------------------------------------------------
// supplier_delivery_due
// ---------------------------------------------------------------------------

const deliveryEvent: ScheduledEventDefinition = {
  type: SUPPLIER_DELIVERY_EVENT,
  kind: 'mechanical',
  ownerModuleId: SUPPLIERS_MODULE_ID,
  label: 'A supplier delivery is due',
  payloadSchema: DeliveryPayloadSchema,
  beat: 'morning',
  defaultOffsetDays: 2,
  // One day of warning: enough for the player to line up a fallback if the
  // supplier is one they do not trust, not so much that it removes the risk.
  warningWindowDays: 1,
  // The order's own delivery window is what actually decides how long a
  // late supplier has; this is the backstop that stops a queued event
  // outliving the order it belongs to.
  expiryDays: 6,
  // A delivery outlives an absent supplier: the goods were paid for.
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, payload }) => {
    const parsed = DeliveryPayloadSchema.safeParse(payload)
    return parsed.success
      ? `${type}|${parsed.data.orderId}|${parsed.data.promisedOnDay}`
      : `${type}|unknown`
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = DeliveryPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('the event did not name an order', record.origin.readable)
    }
    const order = getPurchaseOrder(ctx.state, parsed.data.orderId)
    if (!order) {
      return noOp(
        `order '${parsed.data.orderId}' is no longer open`,
        record.origin.readable,
      )
    }
    // A retry moved the promised day; this event belongs to the old one.
    if (order.promisedOnDay !== parsed.data.promisedOnDay) {
      return noOp(
        `the delivery was re-promised for day ${order.promisedOnDay}`,
        record.origin.readable,
      )
    }
    const result = deliverOrder(ctx, order.id)
    if (!result) {
      return noOp('there was nothing left to deliver', record.origin.readable)
    }
    const supplierLabel =
      ctx.state.world.suppliers[order.supplierId]?.label ?? order.supplierId
    return {
      status: 'resolved',
      readable: result.readable,
      mutations: [
        {
          targetKind: 'purchase_order',
          targetId: order.id,
          field: 'delivered',
          readable:
            result.quantity > 0
              ? `${result.quantity} units arrived (quality ${result.quality}).`
              : `Nothing arrived; ${result.failed ? 'the order failed' : `re-promised for day ${result.order.promisedOnDay}`}.`,
        },
        ...(result.quantity > 0
          ? [
              {
                targetKind: 'stock',
                targetId: order.lines[0]?.stockId ?? 'unknown',
                field: 'quantity',
                readable: `Cellar took ${result.quantity} units from ${supplierLabel}.`,
              },
            ]
          : [
              {
                targetKind: 'supplier',
                targetId: order.supplierId,
                field: 'relationship',
                readable: `${supplierLabel} lost standing over a failed delivery.`,
              },
            ]),
        ...(result.invoiceId
          ? [
              {
                targetKind: 'obligation',
                targetId: result.invoiceId,
                field: 'principal',
                readable: `${supplierLabel} invoiced ${result.invoiced} coin for what arrived.`,
              },
            ]
          : []),
      ],
      history: {
        category: 'state_change',
        summary: result.readable,
        tags: ['supplier', 'delivery', result.outcome],
        relatedActors: [supplierRef(order.supplierId)],
        relatedSystems: [SUPPLIERS_MODULE_ID, 'stock'],
        mechanicalRefs: [SUPPLIER_DELIVERY_EVENT],
      },
    }
  },
}

/** Put an order's next delivery attempt on the calendar. */
export function scheduleSupplierDelivery(
  ctx: SimContext,
  order: PurchaseOrderRecord,
): void {
  const supplierLabel =
    ctx.state.world.suppliers[order.supplierId]?.label ?? order.supplierId
  scheduleEvent(ctx, {
    type: SUPPLIER_DELIVERY_EVENT,
    target: supplierRef(order.supplierId),
    scheduledForDay: order.promisedOnDay,
    payload: { orderId: order.id, promisedOnDay: order.promisedOnDay },
    origin: {
      source: `${SUPPLIERS_MODULE_ID}.order`,
      readable: `${supplierLabel} is due to deliver order ${order.id} on day ${order.promisedOnDay}.`,
    },
  })
}

// ---------------------------------------------------------------------------
// supplier_scheduled_payment
// ---------------------------------------------------------------------------

/**
 * A payment the player promised to make on a named day.
 *
 * §6.3's "scheduled payment capability". It fires on `wrap_up` so it sees
 * the day's takings — the whole point of promising to pay on market day is
 * that market day pays for it. If the till cannot cover the promise it pays
 * what it can and says so; it never overdraws, and it never silently does
 * nothing.
 */
const scheduledPaymentEvent: ScheduledEventDefinition = {
  type: SUPPLIER_SCHEDULED_PAYMENT_EVENT,
  kind: 'mechanical',
  ownerModuleId: SUPPLIERS_MODULE_ID,
  label: 'A promised supplier payment falls due',
  payloadSchema: ScheduledPaymentPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 3,
  warningWindowDays: 1,
  expiryDays: 3,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = ScheduledPaymentPayloadSchema.safeParse(payload)
    return `${type}|${parsed.success ? parsed.data.invoiceId : 'unknown'}|${scheduledForDay}`
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = ScheduledPaymentPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('the event did not name an invoice', record.origin.readable)
    }
    const result = paySupplierInvoice(ctx, parsed.data.invoiceId, parsed.data.amount)
    if (!result) {
      return noOp(
        ctx.state.coin <= 0
          ? 'the till was empty on the day the payment was promised'
          : 'the invoice was already settled',
        record.origin.readable,
      )
    }
    return {
      status: 'resolved',
      readable: result.settled
        ? `The promised payment settled the invoice (${result.applied} coin).`
        : `The promised payment covered ${result.applied} coin; ${result.outstandingAfter} still owed.`,
      mutations: [
        {
          targetKind: 'obligation',
          targetId: result.invoiceId,
          field: 'paid',
          readable: `${result.applied} coin paid against the invoice.`,
        },
      ],
    }
  },
}

/** Promise to pay an invoice on a future day. */
export function scheduleSupplierPayment(
  ctx: SimContext,
  input: { invoiceId: string; supplierId: string; amount: number; onDay: number },
): ReturnType<typeof scheduleEvent> {
  const label =
    ctx.state.world.suppliers[input.supplierId]?.label ?? input.supplierId
  return scheduleEvent(ctx, {
    type: SUPPLIER_SCHEDULED_PAYMENT_EVENT,
    target: supplierRef(input.supplierId),
    scheduledForDay: input.onDay,
    payload: { invoiceId: input.invoiceId, amount: input.amount },
    origin: {
      source: `${SUPPLIERS_MODULE_ID}.scheduled_payment`,
      readable: `${input.amount} coin promised to ${label} on day ${input.onDay}.`,
    },
  })
}

// ---------------------------------------------------------------------------
// supplier_retaliation_*  (HOOK-supplier_retaliation_*, -_possible)
// ---------------------------------------------------------------------------

/** Days a retaliating supplier stops taking orders. */
const RETALIATION_REFUSAL_DAYS = 5
/** How much a retaliating supplier marks the tavern up. */
const RETALIATION_MARKUP = 1.2

/**
 * A supplier acts on a grievance.
 *
 * Re-reads the relationship on the due day rather than the day the promise
 * was made: a player who spent the intervening days paying invoices and
 * placing orders has genuinely repaired it, and the event has to be able to
 * say so. What retaliation actually does is stop supply and harden terms —
 * two facts the very next quote reads.
 */
const retaliationEvent: ScheduledEventDefinition = {
  type: SUPPLIER_RETALIATION_EVENT,
  kind: 'mechanical',
  ownerModuleId: SUPPLIERS_MODULE_ID,
  label: 'A supplier retaliates',
  payloadSchema: SupplierPayloadSchema,
  beat: 'morning',
  defaultOffsetDays: 4,
  warningWindowDays: 2,
  expiryDays: 6,
  missingTarget: 'cancel',
  exactOnceKey: supplierExactOnceKey,
  futureHookPrefixes: ['supplier_retaliation_'],
  fromFutureHook: ({ hookName, metadata }) => {
    // The unparameterised `supplier_retaliation_possible` names no supplier,
    // so the producer's actor metadata is the only honest source for one.
    if (hookName === 'supplier_retaliation_possible') {
      const actors = Array.isArray(metadata?.['actors']) ? metadata['actors'] : []
      const actor = actors.find(
        (entry): entry is { kind: string; id: string } =>
          typeof entry === 'object' &&
          entry !== null &&
          (entry as { kind?: unknown }).kind === 'supplier' &&
          typeof (entry as { id?: unknown }).id === 'string',
      )
      if (!actor) return undefined
      return { payload: { supplierId: actor.id }, target: supplierRef(actor.id) }
    }
    return supplierHookAdapter('supplier_retaliation_')({ hookName })
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const supplier = supplierOf(ctx.state, record.payload)
    if (!supplier) return noOp('that supplier no longer trades here', record.origin.readable)
    const today = ctx.state.calendar.totalDaysElapsed
    const account = getSupplierAccount(ctx.state, supplier.id)
    if (supplier.relationship >= 55 && account.history.defaults === 0) {
      return {
        status: 'cancelled',
        reason: `${supplier.label} was squared with before it came to anything (relationship ${supplier.relationship})`,
        readable: `${supplier.label} decided to let it go.`,
      }
    }
    const refusingUntilDay = today + RETALIATION_REFUSAL_DAYS
    writeSupplierAccount(
      ctx,
      supplier.id,
      (current) => ({
        ...current,
        refusingUntilDay,
        refusingReason: 'retaliation' as const,
        termsAdjustment: Math.max(current.termsAdjustment, RETALIATION_MARKUP),
        termsAdjustmentUntilDay: today + NEGOTIATION_TERM_DAYS,
        creditStatus: current.creditStatus === 'approved' ? 'suspended' : current.creditStatus,
        creditLimit: 0,
        lastDecisionDay: today,
        lastDecisionReason: 'the supplier retaliated',
      }),
      'retaliation',
    )
    ctx.modifySupplier(
      supplier.id,
      { relationship: Math.max(0, supplier.relationship - 6) },
      { source: SUPPLIERS_MODULE_ID, reason: 'retaliation' },
    )
    return {
      status: 'resolved',
      readable: `${supplier.label} stopped taking orders until day ${refusingUntilDay} and marked the tavern up.`,
      mutations: [
        {
          targetKind: 'supplier_account',
          targetId: supplier.id,
          field: 'refusingUntilDay',
          readable: `${supplier.label} refuses orders until day ${refusingUntilDay}.`,
        },
        {
          targetKind: 'supplier_account',
          targetId: supplier.id,
          field: 'termsAdjustment',
          readable: `Terms hardened to ×${RETALIATION_MARKUP}.`,
        },
      ],
      history: {
        category: 'state_change',
        summary: `${supplier.label} retaliated: no orders until day ${refusingUntilDay}.`,
        tags: ['supplier', 'retaliation'],
        relatedActors: [supplierRef(supplier.id)],
        relatedSystems: [SUPPLIERS_MODULE_ID],
        mechanicalRefs: [SUPPLIER_RETALIATION_EVENT],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// supplier_renegotiation_*
// ---------------------------------------------------------------------------

/**
 * Terms agreed in principle become terms in force.
 *
 * The seed's promise is that a negotiation the player opened lands later.
 * It lands as the account's actual price adjustment and credit line, priced
 * off the relationship at the moment it comes due — so a negotiation the
 * player then undermined lands smaller, and one they backed up lands
 * bigger.
 */
const renegotiationEvent: ScheduledEventDefinition = {
  type: SUPPLIER_RENEGOTIATION_EVENT,
  kind: 'mechanical',
  ownerModuleId: SUPPLIERS_MODULE_ID,
  label: 'Renegotiated supplier terms take effect',
  payloadSchema: SupplierPayloadSchema,
  beat: 'morning',
  defaultOffsetDays: 5,
  warningWindowDays: 2,
  expiryDays: 6,
  missingTarget: 'cancel',
  exactOnceKey: supplierExactOnceKey,
  futureHookPrefixes: ['supplier_renegotiation_'],
  fromFutureHook: supplierHookAdapter('supplier_renegotiation_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const supplier = supplierOf(ctx.state, record.payload)
    if (!supplier) return noOp('that supplier no longer trades here', record.origin.readable)
    const today = ctx.state.calendar.totalDaysElapsed
    const account = getSupplierAccount(ctx.state, supplier.id)
    if (outstandingSupplierInvoices(ctx.state, supplier.id).some((invoice) =>
      ['grace', 'defaulted', 'in_collections'].includes(invoice.status),
    )) {
      return noOp(
        `${supplier.label} shelved the new terms while an invoice is past due`,
        `${supplier.label} put the renegotiated terms on hold.`,
      )
    }
    const discount = Math.min(0.1, Math.max(0.02, (supplier.relationship - 40) / 500))
    const termsAdjustment = Math.round((1 - discount) * 100) / 100
    const untilDay = today + NEGOTIATION_TERM_DAYS
    const netTermDays = netTermsFor(supplier, account)
    writeSupplierAccount(
      ctx,
      supplier.id,
      (current) => ({
        ...current,
        termsAdjustment,
        termsAdjustmentUntilDay: untilDay,
        netTermDays,
        lastDecisionDay: today,
        lastDecisionReason: `renegotiated terms took effect (×${termsAdjustment})`,
      }),
      'renegotiation',
    )
    return {
      status: 'resolved',
      readable: `${supplier.label} put the new terms in force: ×${termsAdjustment} through day ${untilDay}.`,
      mutations: [
        {
          targetKind: 'supplier_account',
          targetId: supplier.id,
          field: 'termsAdjustment',
          readable: `Unit prices now ×${termsAdjustment} until day ${untilDay}.`,
        },
        {
          targetKind: 'supplier_account',
          targetId: supplier.id,
          field: 'netTermDays',
          readable: `Net terms set to ${netTermDays} days.`,
        },
      ],
    }
  },
}

// ---------------------------------------------------------------------------
// supplier_goodwill_return_*
// ---------------------------------------------------------------------------

/** Days a goodwill concession lasts. Shorter than a negotiated one. */
const GOODWILL_TERM_DAYS = 8

/**
 * Paying on time comes back.
 *
 * The seed promises that settling with a supplier earns something later.
 * What it earns is a real concession — a price break, and an opened or
 * enlarged credit line if the trading record now supports one. It requires
 * the goodwill to have survived: a tavern that has defaulted since gets the
 * explained no-op, not the discount.
 */
const goodwillEvent: ScheduledEventDefinition = {
  type: SUPPLIER_GOODWILL_EVENT,
  kind: 'mechanical',
  ownerModuleId: SUPPLIERS_MODULE_ID,
  label: 'A supplier returns a favour',
  payloadSchema: SupplierPayloadSchema,
  beat: 'morning',
  defaultOffsetDays: 6,
  warningWindowDays: 2,
  expiryDays: 8,
  missingTarget: 'cancel',
  exactOnceKey: supplierExactOnceKey,
  futureHookPrefixes: ['supplier_goodwill_return_'],
  fromFutureHook: supplierHookAdapter('supplier_goodwill_return_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const supplier = supplierOf(ctx.state, record.payload)
    if (!supplier) return noOp('that supplier no longer trades here', record.origin.readable)
    const today = ctx.state.calendar.totalDaysElapsed
    const account = getSupplierAccount(ctx.state, supplier.id)
    const overdue = outstandingSupplierInvoices(ctx.state, supplier.id).filter(
      (invoice) => ['grace', 'defaulted', 'in_collections'].includes(invoice.status),
    )
    if (overdue.length > 0 || account.creditStatus === 'revoked') {
      return noOp(
        `${supplier.label}'s goodwill did not survive the arrears since`,
        `${supplier.label} had thought better of it.`,
      )
    }
    const untilDay = today + GOODWILL_TERM_DAYS
    const eligibility = creditEligibility(ctx.state, supplier.id)
    const grantsCredit = eligibility.eligible && account.creditStatus !== 'approved'
    writeSupplierAccount(
      ctx,
      supplier.id,
      (current) => {
        const preservesExistingConcession = current.termsAdjustment <= 0.93
        const adjustmentExpiry = preservesExistingConcession
          ? Math.max(current.termsAdjustmentUntilDay ?? untilDay, untilDay)
          : untilDay
        return {
          ...current,
          termsAdjustment: Math.min(current.termsAdjustment, 0.93),
          termsAdjustmentUntilDay: adjustmentExpiry,
          ...(grantsCredit
            ? {
                creditStatus: 'approved' as const,
                creditLimit: eligibility.limit,
                netTermDays: eligibility.netTermDays,
              }
            : {}),
          lastDecisionDay: today,
          lastDecisionReason: 'goodwill from a bill paid on time',
        }
      },
      'goodwill_return',
    )
    ctx.modifySupplier(
      supplier.id,
      { relationship: Math.min(100, supplier.relationship + 3) },
      { source: SUPPLIERS_MODULE_ID, reason: 'goodwill_return' },
    )
    return {
      status: 'resolved',
      readable: grantsCredit
        ? `${supplier.label} cut their price and opened a ${eligibility.limit}-coin line.`
        : `${supplier.label} cut their price through day ${untilDay}.`,
      mutations: [
        {
          targetKind: 'supplier_account',
          targetId: supplier.id,
          field: 'termsAdjustment',
          readable: `Unit prices ×0.93 until day ${untilDay}.`,
        },
        ...(grantsCredit
          ? [
              {
                targetKind: 'supplier_account',
                targetId: supplier.id,
                field: 'creditLimit',
                readable: `Credit line opened at ${eligibility.limit} coin.`,
              },
            ]
          : []),
      ],
    }
  },
}

// ---------------------------------------------------------------------------
// new_supplier_uncertainty_*
// ---------------------------------------------------------------------------

/**
 * A new supplier turns out to be what they turn out to be.
 *
 * The seed promises that taking on an untried supplier is a gamble that
 * resolves. It resolves against the trading record they have ACTUALLY built
 * since: deliveries kept versus deliveries missed. A supplier who came
 * through gets a settled reputation (their reliability firms up and their
 * terms improve); one who shorted the tavern is marked down. Nothing is
 * rolled — the answer is the record.
 */
const newSupplierEvent: ScheduledEventDefinition = {
  type: NEW_SUPPLIER_UNCERTAINTY_EVENT,
  kind: 'mechanical',
  ownerModuleId: SUPPLIERS_MODULE_ID,
  label: 'A new supplier proves out',
  payloadSchema: SupplierPayloadSchema,
  beat: 'morning',
  defaultOffsetDays: 7,
  warningWindowDays: 2,
  expiryDays: 8,
  missingTarget: 'cancel',
  exactOnceKey: supplierExactOnceKey,
  futureHookPrefixes: ['new_supplier_uncertainty_'],
  fromFutureHook: supplierHookAdapter('new_supplier_uncertainty_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const supplier = supplierOf(ctx.state, record.payload)
    if (!supplier) return noOp('that supplier no longer trades here', record.origin.readable)
    const today = ctx.state.calendar.totalDaysElapsed
    const account = getSupplierAccount(ctx.state, supplier.id)
    const kept = account.history.ordersDelivered
    const failed = account.history.ordersMissed + account.history.ordersPartial
    if (kept + failed === 0) {
      return noOp(
        `nothing was ever ordered from ${supplier.label}, so there is nothing to judge`,
        `${supplier.label} is still an unknown quantity.`,
      )
    }
    const goodRecord = kept > failed
    const reliability = Math.max(
      5,
      Math.min(95, supplier.reliability + (goodRecord ? 6 : -8)),
    )
    ctx.modifySupplier(
      supplier.id,
      { reliability },
      { source: SUPPLIERS_MODULE_ID, reason: 'new_supplier_proved_out' },
    )
    writeSupplierAccount(
      ctx,
      supplier.id,
      (current) => ({
        ...current,
        termsAdjustment: goodRecord ? 0.95 : 1.08,
        termsAdjustmentUntilDay: today + NEGOTIATION_TERM_DAYS,
        lastDecisionDay: today,
        lastDecisionReason: goodRecord
          ? `${kept} deliveries kept against ${failed} missed`
          : `${failed} deliveries missed against ${kept} kept`,
      }),
      'new_supplier_proved_out',
    )
    return {
      status: 'resolved',
      readable: goodRecord
        ? `${supplier.label} proved reliable (${kept} kept, ${failed} missed) — reliability ${reliability}.`
        : `${supplier.label} proved unreliable (${failed} missed, ${kept} kept) — reliability ${reliability}.`,
      mutations: [
        {
          targetKind: 'supplier',
          targetId: supplier.id,
          field: 'reliability',
          readable: `Reliability settled at ${reliability}.`,
        },
        {
          targetKind: 'supplier_account',
          targetId: supplier.id,
          field: 'termsAdjustment',
          readable: goodRecord ? 'Terms improved to ×0.95.' : 'Terms hardened to ×1.08.',
        },
      ],
    }
  },
}

// ---------------------------------------------------------------------------
// dual_supplier_balance_*
// ---------------------------------------------------------------------------

/**
 * Splitting the business between two suppliers comes to a head.
 *
 * Both of them find out. The one that has carried more of the tavern's real
 * orders reads it as loyalty and improves terms; the other reads it as
 * being kept on a string and hardens. With no trade — or an exactly even
 * split — there is no honest basis for favouring one of them arbitrarily.
 */
const dualSupplierEvent: ScheduledEventDefinition = {
  type: DUAL_SUPPLIER_BALANCE_EVENT,
  kind: 'mechanical',
  ownerModuleId: SUPPLIERS_MODULE_ID,
  label: 'Two suppliers compare notes',
  payloadSchema: DualSupplierPayloadSchema,
  beat: 'morning',
  defaultOffsetDays: 6,
  warningWindowDays: 2,
  expiryDays: 7,
  missingTarget: 'cancel',
  exactOnceKey: dualSupplierExactOnceKey,
  futureHookPrefixes: ['dual_supplier_balance_'],
  fromFutureHook: ({ hookName, metadata }) => {
    const adapted = supplierHookAdapter('dual_supplier_balance_')({ hookName })
    if (!adapted) return undefined
    const parsed = SupplierPayloadSchema.parse(adapted.payload)
    const actors = Array.isArray(metadata?.['actors']) ? metadata['actors'] : []
    const secondary = actors.find(
      (entry): entry is { kind: string; id: string } =>
        typeof entry === 'object' &&
        entry !== null &&
        (entry as { kind?: unknown }).kind === 'supplier' &&
        typeof (entry as { id?: unknown }).id === 'string' &&
        (entry as { id: string }).id !== parsed.supplierId,
    )
    return {
      payload: {
        supplierId: parsed.supplierId,
        ...(secondary ? { secondarySupplierId: secondary.id } : {}),
      },
      target: supplierRef(parsed.supplierId),
    }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = DualSupplierPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('the event did not name its suppliers', record.origin.readable)
    }
    const supplier = ctx.state.world.suppliers[parsed.data.supplierId]
    if (!supplier) return noOp('that supplier no longer trades here', record.origin.readable)
    const today = ctx.state.calendar.totalDaysElapsed
    const namedRival = parsed.data.secondarySupplierId
    const rival = namedRival
      ? ctx.state.world.suppliers[namedRival]
      : findRivalSupplier(ctx.state, supplier)
    if (!rival) {
      return noOp(
        namedRival
          ? `the selected second supplier '${namedRival}' no longer trades here`
          : `nobody else carries what ${supplier.label} carries`,
        namedRival
          ? `${supplier.label}'s selected counterpart was no longer available.`
          : `${supplier.label} has no rival to compare notes with.`,
      )
    }
    if (rival.id === supplier.id) {
      return noOp(
        'the event named the same supplier twice',
        `${supplier.label} had no second supplier to compare with.`,
      )
    }
    const mine = getSupplierAccount(ctx.state, supplier.id).history.ordersPlaced
    const theirs = getSupplierAccount(ctx.state, rival.id).history.ordersPlaced
    if (mine + theirs === 0) {
      return noOp(
        `the tavern has not ordered from either ${supplier.label} or ${rival.label}`,
        `${supplier.label} and ${rival.label} had no business to compare.`,
      )
    }
    if (mine === theirs) {
      return noOp(
        `the tavern split ${mine + theirs} orders evenly`,
        `${supplier.label} and ${rival.label} found the business evenly split.`,
      )
    }
    const favoured = mine > theirs ? supplier : rival
    const slighted = favoured.id === supplier.id ? rival : supplier

    for (const [entity, adjustment, delta] of [
      [favoured, 0.95, 2],
      [slighted, 1.06, -2],
    ] as const) {
      writeSupplierAccount(
        ctx,
        entity.id,
        (current) => ({
          ...current,
          termsAdjustment: adjustment,
          termsAdjustmentUntilDay: today + GOODWILL_TERM_DAYS,
          lastDecisionDay: today,
          lastDecisionReason:
            entity.id === favoured.id
              ? 'carried the larger share of the tavern’s orders'
              : 'carried the smaller share of the tavern’s orders',
        }),
        'dual_supplier_balance',
      )
      ctx.modifySupplier(
        entity.id,
        {
          relationship: Math.max(
            0,
            Math.min(100, entity.relationship + delta),
          ),
        },
        { source: SUPPLIERS_MODULE_ID, reason: 'dual_supplier_balance' },
      )
    }

    return {
      status: 'resolved',
      readable: `${favoured.label} took the larger share (${Math.max(mine, theirs)} orders) and improved terms; ${slighted.label} hardened.`,
      mutations: [
        {
          targetKind: 'supplier_account',
          targetId: favoured.id,
          field: 'termsAdjustment',
          readable: `${favoured.label} cut their price to ×0.95.`,
        },
        {
          targetKind: 'supplier_account',
          targetId: slighted.id,
          field: 'termsAdjustment',
          readable: `${slighted.label} raised their price to ×1.06.`,
        },
      ],
    }
  },
}

/** The other supplier who carries the most of what this one carries. */
function findRivalSupplier(
  state: TavernState,
  supplier: SupplierWorldState,
): SupplierWorldState | undefined {
  let best: { supplier: SupplierWorldState; overlap: number } | undefined
  for (const other of Object.values(state.world.suppliers)) {
    if (other.id === supplier.id) continue
    const overlap = other.goodsProvided.filter((id) =>
      supplier.goodsProvided.includes(id),
    ).length
    if (overlap === 0) continue
    if (
      !best ||
      overlap > best.overlap ||
      (overlap === best.overlap && other.id.localeCompare(best.supplier.id) < 0)
    ) {
      best = { supplier: other, overlap }
    }
  }
  return best?.supplier
}

// ---------------------------------------------------------------------------
// supplier_investigation_concluded_*
// ---------------------------------------------------------------------------

/**
 * A quality investigation reaches a verdict.
 *
 * The evidence is the delivery record the tavern actually has: short and
 * missed deliveries, and disputes the supplier lost. A supplier found at
 * fault has their reliability marked down and their credit-worthiness with
 * it; one cleared is compensated for the accusation. Either way the verdict
 * is written where the next quote reads it.
 */
const investigationEvent: ScheduledEventDefinition = {
  type: SUPPLIER_INVESTIGATION_EVENT,
  kind: 'mechanical',
  ownerModuleId: SUPPLIERS_MODULE_ID,
  label: 'A supplier investigation concludes',
  payloadSchema: SupplierPayloadSchema,
  beat: 'morning',
  defaultOffsetDays: 6,
  warningWindowDays: 2,
  expiryDays: 8,
  missingTarget: 'cancel',
  exactOnceKey: supplierExactOnceKey,
  futureHookPrefixes: ['supplier_investigation_concluded_'],
  fromFutureHook: supplierHookAdapter('supplier_investigation_concluded_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const supplier = supplierOf(ctx.state, record.payload)
    if (!supplier) return noOp('that supplier no longer trades here', record.origin.readable)
    const today = ctx.state.calendar.totalDaysElapsed
    const account = getSupplierAccount(ctx.state, supplier.id)
    const faults =
      account.history.ordersMissed +
      account.history.ordersPartial +
      account.history.disputesUpheld
    const atFault = faults > 0
    const reliability = Math.max(
      5,
      Math.min(95, supplier.reliability + (atFault ? -10 : 5)),
    )
    ctx.modifySupplier(
      supplier.id,
      {
        reliability,
        relationship: Math.max(
          0,
          Math.min(100, supplier.relationship + (atFault ? -3 : 4)),
        ),
      },
      { source: SUPPLIERS_MODULE_ID, reason: 'investigation_concluded' },
    )
    writeSupplierAccount(
      ctx,
      supplier.id,
      (current) => ({
        ...current,
        termsAdjustment: atFault ? 1 : 0.94,
        termsAdjustmentUntilDay: today + GOODWILL_TERM_DAYS,
        ...(atFault ? { creditLimit: Math.round(current.creditLimit * 0.6) } : {}),
        lastDecisionDay: today,
        lastDecisionReason: atFault
          ? `found at fault over ${faults} failed or disputed deliveries`
          : 'cleared — the deliveries were sound',
      }),
      'investigation_concluded',
    )
    return {
      status: 'resolved',
      readable: atFault
        ? `${supplier.label} was found at fault over ${faults} failed deliveries — reliability ${reliability}.`
        : `${supplier.label} was cleared; their record is clean — reliability ${reliability}.`,
      mutations: [
        {
          targetKind: 'supplier',
          targetId: supplier.id,
          field: 'reliability',
          readable: `Reliability now ${reliability}.`,
        },
        {
          targetKind: 'supplier_account',
          targetId: supplier.id,
          field: 'termsAdjustment',
          readable: atFault
            ? 'Credit line cut on the finding.'
            : 'Terms improved by way of apology.',
        },
      ],
      history: {
        category: 'state_change',
        summary: atFault
          ? `${supplier.label} was found at fault over their deliveries.`
          : `${supplier.label} was cleared over their deliveries.`,
        tags: ['supplier', 'investigation'],
        relatedActors: [supplierRef(supplier.id)],
        relatedSystems: [SUPPLIERS_MODULE_ID],
        mechanicalRefs: [SUPPLIER_INVESTIGATION_EVENT],
      },
    }
  },
}

let registered = false

export function ensureSupplierEventsRegistered(): void {
  if (registered) return
  registerScheduledEvent(deliveryEvent)
  registerScheduledEvent(scheduledPaymentEvent)
  registerScheduledEvent(retaliationEvent)
  registerScheduledEvent(renegotiationEvent)
  registerScheduledEvent(goodwillEvent)
  registerScheduledEvent(newSupplierEvent)
  registerScheduledEvent(dualSupplierEvent)
  registerScheduledEvent(investigationEvent)
  setDeliveryScheduler(scheduleSupplierDelivery)
  registered = true
}

// Registered at import time so any pipeline containing the supplier module
// can schedule a delivery before its first day runs — and so a pipeline
// built WITHOUT it rejects those schedules as unowned rather than quietly
// queueing a promise nothing will keep.
ensureSupplierEventsRegistered()
