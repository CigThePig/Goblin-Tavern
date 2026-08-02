import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'
import {
  getObligation,
  listObligations,
  nextObligationId,
  openObligation,
  outstandingAmount,
  payObligation,
  readObligationsSlice,
  recordObligationPayment,
  scheduleObligationDueDate,
  upsertObligation,
  type ObligationRecord,
} from '../../contracts/obligations/index'
import { getRule } from '../../contracts/ruleset/index'
import { spendCoin } from '../stock/ledger'

import {
  SUPPLIERS_MODULE_ID,
  writeSupplierAccount,
  writeSupplierState,
} from './state'

// Expansion Phase 6 §6.3 — credit and invoices.
//
// An invoice is NOT a supplier-module record. It is an `ObligationRecord`
// in the shared ledger, `direction: 'payable'`, `ownerModuleId: 'suppliers'`.
// That is the whole reason Phase 1 built the ledger: the supplier module
// decides WHEN to bill and WHAT for, and inherits due date, grace, late
// charges, default and collections from machinery that six other domains
// share instead of reimplementing them with its own off-by-one bugs.
//
// It is also what makes two things that already existed become true rather
// than decorative:
//
//   - `weeklyModule.supplierInvoicesForWeek` reads payables tagged
//     `supplier` / `invoice` / `credit_purchase` out of that same ledger.
//     Before this phase it always found none.
//   - Phase 5's `accrualFacts` counts a payable opened today with those
//     tags as `creditPurchases`, and a `purchase`-category ledger entry
//     tagged `invoice_payment` as `invoicePayments`. Both tags are written
//     here, so daily/weekly/monthly accounting picks them up with no
//     further wiring.

/** Tags every supplier invoice carries. The weekly block filters on these. */
export const SUPPLIER_INVOICE_TAGS = ['supplier', 'invoice', 'credit_purchase'] as const

export type SupplierInvoiceView = {
  id: string
  supplierId: string
  orderId?: string
  stockIds: string[]
  principal: number
  paid: number
  accruedCharges: number
  outstanding: number
  dueOnDay: number
  status: ObligationRecord['status']
  escalation: number
  readable: string
}

function stockIdsFromTags(record: ObligationRecord): string[] {
  return record.tags
    .filter((tag) => tag.startsWith('stock:'))
    .map((tag) => tag.slice('stock:'.length))
}

function orderIdFromTags(record: ObligationRecord): string | undefined {
  const tag = record.tags.find((t) => t.startsWith('order:'))
  return tag ? tag.slice('order:'.length) : undefined
}

export function isSupplierInvoice(record: ObligationRecord): boolean {
  return (
    record.direction === 'payable' &&
    (record.ownerModuleId === SUPPLIERS_MODULE_ID ||
      record.counterparty.kind === 'supplier')
  )
}

export function toInvoiceView(record: ObligationRecord): SupplierInvoiceView {
  const orderId = orderIdFromTags(record)
  return {
    id: record.id,
    supplierId: record.counterparty.id,
    ...(orderId !== undefined ? { orderId } : {}),
    stockIds: stockIdsFromTags(record),
    principal: record.principal,
    paid: record.paid,
    accruedCharges: record.accruedCharges,
    outstanding: outstandingAmount(record),
    dueOnDay: record.dueOnDay ?? record.openedOnDay,
    status: record.status,
    escalation: record.escalation,
    readable: record.readable,
  }
}

/** Live supplier invoices, soonest due first. */
export function listSupplierInvoices(
  state: TavernState,
  supplierId?: string,
): SupplierInvoiceView[] {
  return listObligations(state, { direction: 'payable' })
    .filter(isSupplierInvoice)
    .filter((record) => !supplierId || record.counterparty.id === supplierId)
    .map(toInvoiceView)
}

export function outstandingSupplierInvoices(
  state: TavernState,
  supplierId?: string,
): SupplierInvoiceView[] {
  return listSupplierInvoices(state, supplierId).filter(
    (invoice) => invoice.outstanding > 0,
  )
}

/** Invoices that are past due — in grace, defaulted, or in collections. */
export function overdueSupplierInvoices(
  state: TavernState,
  supplierId?: string,
): SupplierInvoiceView[] {
  return outstandingSupplierInvoices(state, supplierId).filter((invoice) =>
    ['grace', 'defaulted', 'in_collections'].includes(invoice.status),
  )
}

export type OpenInvoiceInput = {
  supplierId: string
  supplierLabel: string
  orderId: string
  stockIds: string[]
  amount: number
  /** Days from today until the invoice is due. */
  netTermDays: number
}

/**
 * Bill the tavern for goods that ACTUALLY arrived.
 *
 * Called from the delivery resolver with the value of the units that
 * landed, never with the value of the units that were ordered — a supplier
 * who shorted the delivery is owed for what they brought.
 *
 * Returns the record so the caller can attach its id to the order.
 */
export function openSupplierInvoice(
  ctx: SimContext,
  input: OpenInvoiceInput,
): ObligationRecord | undefined {
  const amount = Math.round(input.amount)
  if (amount <= 0) return undefined
  const today = ctx.state.calendar.totalDaysElapsed
  const id = nextObligationId(ctx.state, SUPPLIERS_MODULE_ID)
  const record = openObligation({
    id,
    ownerModuleId: SUPPLIERS_MODULE_ID,
    counterparty: { kind: 'supplier', id: input.supplierId },
    direction: 'payable',
    principal: amount,
    openedOnDay: today,
    dueOnDay: today + Math.max(1, input.netTermDays),
    graceDays: getRule(ctx.state, 'obligationGraceDays'),
    lateChargeRate: getRule(ctx.state, 'obligationLateChargeRate'),
    readable: `${input.supplierLabel} invoice for ${input.stockIds.join(', ')} (${amount} coin)`,
    tags: [
      ...SUPPLIER_INVOICE_TAGS,
      `supplier:${input.supplierId}`,
      `order:${input.orderId}`,
      ...input.stockIds.map((stockId) => `stock:${stockId}`),
    ],
  })
  upsertObligation(ctx, record, 'supplier_invoice_opened')
  // §1.2 — creating the obligation schedules the event that collects it, so
  // an invoice nothing will ever come for cannot exist.
  scheduleObligationDueDate(ctx, record)

  writeSupplierState(
    ctx,
    (slice) => ({
      ...slice,
      totals: {
        ...slice.totals,
        invoicesOpened: slice.totals.invoicesOpened + 1,
        invoicedValue: slice.totals.invoicedValue + amount,
      },
    }),
    'invoice_opened',
  )

  ctx.addCause({
    source: `${SUPPLIERS_MODULE_ID}.invoice_opened`,
    sourceType: 'supplier',
    target: input.supplierId,
    targetType: 'supplier',
    amount,
    direction: 'increase',
    weight: amount,
    readable: `${input.supplierLabel} invoiced ${amount} coin, due day ${record.dueOnDay}.`,
    tags: ['supplier', 'invoice', input.supplierId, ...input.stockIds],
    relatedSystems: [SUPPLIERS_MODULE_ID, 'economy'],
  })
  return record
}

export type InvoicePaymentResult = {
  invoiceId: string
  applied: number
  settled: boolean
  onTime: boolean
  outstandingAfter: number
}

/**
 * Pay against a supplier invoice.
 *
 * Partial payment is the normal case, not an edge case (§6.3): the shared
 * `payObligation` keeps the debt live at a lower balance and pulls a
 * defaulted debt back into grace, and this wrapper does the two things the
 * shared ledger cannot know about — move the coin through the stock ledger
 * with the tags Phase 5's accounting reads, and update the supplier's
 * opinion of the tavern as a payer.
 */
export function paySupplierInvoice(
  ctx: SimContext,
  invoiceId: string,
  requested: number,
): InvoicePaymentResult | undefined {
  const record = getObligation(ctx.state, invoiceId)
  if (!record || !isSupplierInvoice(record)) return undefined
  const today = ctx.state.calendar.totalDaysElapsed
  const outstanding = outstandingAmount(record)
  if (outstanding <= 0) return undefined

  const applied = Math.min(
    Math.max(0, Math.floor(requested)),
    Math.ceil(outstanding),
    ctx.state.coin,
  )
  if (applied <= 0) return undefined

  const supplierId = record.counterparty.id
  const supplier = ctx.state.world.suppliers[supplierId]
  const label = supplier?.label ?? supplierId
  const onTime = record.status === 'active' || record.status === 'pending'

  const result = payObligation(record, applied, today, 'paid by the owner')
  upsertObligation(ctx, result.record, 'supplier_invoice_payment')
  recordObligationPayment(ctx, result.applied, 'supplier_invoice_payment')

  spendCoin(ctx, applied, {
    source: `${SUPPLIERS_MODULE_ID}.invoice_payment.${invoiceId}`,
    category: 'purchase',
    tags: [
      'invoice_payment',
      'supplier_invoice',
      'supplier',
      supplierId,
      invoiceId,
    ],
  })

  writeSupplierState(
    ctx,
    (slice) => ({
      ...slice,
      totals: {
        ...slice.totals,
        invoicePaid: slice.totals.invoicePaid + applied,
      },
    }),
    'invoice_paid',
  )

  if (result.settled) {
    writeSupplierAccount(
      ctx,
      supplierId,
      (account) => ({
        ...account,
        history: {
          ...account.history,
          onTimePayments: account.history.onTimePayments + (onTime ? 1 : 0),
          latePayments: account.history.latePayments + (onTime ? 0 : 1),
        },
        lastDecisionDay: today,
        lastDecisionReason: onTime
          ? 'an invoice was settled on time'
          : 'an invoice was settled late',
      }),
      'invoice_settled',
    )
    // Settling a bill is the cheapest relationship the game sells, and
    // settling one LATE still beats not settling it.
    if (supplier) {
      const delta = onTime ? 2 : 1
      ctx.modifySupplier(
        supplierId,
        { relationship: Math.min(100, supplier.relationship + delta) },
        { source: SUPPLIERS_MODULE_ID, reason: 'invoice_settled' },
      )
    }
  }

  ctx.addCause({
    source: `${SUPPLIERS_MODULE_ID}.invoice_payment`,
    sourceType: 'owner_action',
    target: supplierId,
    targetType: 'supplier',
    amount: applied,
    direction: 'decrease',
    weight: applied,
    readable: result.settled
      ? `Settled ${label}'s invoice with ${applied} coin.`
      : `Paid ${applied} coin against ${label}'s invoice; ${Math.max(0, outstanding - applied)} still owed.`,
    tags: ['supplier', 'invoice', 'payment', supplierId],
    relatedSystems: [SUPPLIERS_MODULE_ID, 'economy'],
  })

  return {
    invoiceId,
    applied,
    settled: result.settled,
    onTime,
    outstandingAfter: outstandingAmount(result.record),
  }
}

/**
 * Reduce an invoice because the goods were not what was billed.
 *
 * §6.4's "dispute and reconciliation". A credit note is a `forgiven`
 * amount, not a payment: the ledger has to record that the player did not
 * hand over the coin, or the write-off accounting Phase 5 built would
 * report cash that never moved.
 */
export function creditNoteAgainstInvoice(
  ctx: SimContext,
  invoiceId: string,
  amount: number,
  reason: string,
): number {
  const record = getObligation(ctx.state, invoiceId)
  if (!record || !isSupplierInvoice(record)) return 0
  const today = ctx.state.calendar.totalDaysElapsed
  const outstanding = outstandingAmount(record)
  const relief = Math.min(Math.round(amount), Math.ceil(outstanding))
  if (relief <= 0) return 0

  const credited: ObligationRecord = {
    ...record,
    forgiven: record.forgiven + relief,
    lastTransitionOnDay: today,
    history: [
      ...record.history,
      {
        onDay: today,
        from: record.status,
        to: record.status,
        // Phase 5 accounting recognizes this explicit non-cash write-off
        // marker even when the credit only reduces part of a live invoice.
        reason: `write-off: supplier credit note — ${reason}`,
        amount: relief,
      },
    ],
  }
  const settled = outstandingAmount(credited) <= 0
  upsertObligation(
    ctx,
    settled
      ? {
          ...credited,
          status: 'settled',
          closedOnDay: today,
          history: [
            ...credited.history,
            { onDay: today, from: credited.status, to: 'settled' as const, reason },
          ],
        }
      : credited,
    'supplier_invoice_credit_note',
  )
  return relief
}

/** Sum of every live supplier payable. Used by the credit report line. */
export function totalSupplierPayable(state: TavernState): number {
  return listSupplierInvoices(state).reduce(
    (sum, invoice) => sum + invoice.outstanding,
    0,
  )
}

/** Settled/forgiven supplier invoices in the bounded obligation archive. */
export function archivedSupplierInvoices(
  state: TavernState,
  supplierId?: string,
): SupplierInvoiceView[] {
  return readObligationsSlice(state)
    .closed.filter(isSupplierInvoice)
    .filter((record) => !supplierId || record.counterparty.id === supplierId)
    .map(toInvoiceView)
}

/** Lifetime supplier defaults still visible in the ledger or its archive. */
export function supplierDefaultCount(
  state: TavernState,
  supplierId: string,
): number {
  const live = listSupplierInvoices(state, supplierId).filter((invoice) =>
    ['defaulted', 'in_collections'].includes(invoice.status),
  ).length
  const archived = archivedSupplierInvoices(state, supplierId).filter(
    (invoice) => invoice.status === 'forgiven',
  ).length
  return live + archived
}

/** Convenience for the report: is anything owed to this supplier overdue? */
export function hasOverdueInvoice(state: TavernState, supplierId: string): boolean {
  return overdueSupplierInvoices(state, supplierId).length > 0
}
