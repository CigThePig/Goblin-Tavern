import type { OrderRecord } from '../../contracts/obligations/index'

// Phase 29 §29.4 — Supplier module state shape.
//
// The supplier module owns a slice at `state.modules.suppliers`. The
// slice tracks runtime market conditions and the per-day delivery /
// price / missed-delivery summaries the supplier report consumes.
//
// Phase 27 reserved an empty slice; Phase 29 widens it. Module schema
// composition (Phase 6 §6.1.1) handles validation: `supplierModule`
// registers `SupplierModuleStateSchema` and the engine wires it into
// the full state schema for every module in the running pipeline.

export type ActiveMarketCondition = {
  /** Definition id from `marketConditionRegistry`. */
  id: string
  startedAtDay: number
  expiresAtDay?: number
  intensity: number
  tags: string[]
}

export type SupplierDeliveryRecord = {
  supplierId: string
  stockId: string
  quantity: number
  quality: number
  coinCost: number
  causeId?: string
  tags: string[]
}

export type SupplierPriceAdjustment = {
  supplierId: string
  stockId: string
  basePrice: number
  effectivePrice: number
  conditionIds: string[]
  tags: string[]
}

export type SupplierMissedDelivery = {
  supplierId: string
  stockId: string
  reason: string
  tags: string[]
}

// Expansion Phase 6 §6.1–6.4 — the transactional procurement layer.
//
// Before this phase a supplier was four display numbers and a daily
// diagnostic: `restock_item` bought at once from whichever supplier was
// cheapest, the reliability roll happened against no order and skipped the
// purchase, `debtTolerance` backed no credit, and the weekly invoice block
// rendered an empty list because nothing ever produced an invoice. That is
// obligation `OBL-04`.
//
// What replaces it is a chain the player can act on at every link:
//
//   quote → order → (lead time) → delivery attempt → goods + invoice →
//   payment → credit standing → the next quote.
//
// OWNERSHIP (§5.4). The supplier module owns purchase orders, delivery
// outcomes, credit decisions and supplier standing. It does NOT own the
// money obligation: an invoice is an `ObligationRecord` in the shared
// ledger (`src/sim/contracts/obligations`), which is what gives it the
// due → grace → default → collections timekeeping every other Phase 7
// obligation gets, and what makes Phase 5's `creditPurchases` /
// `invoicePayments` accounting and the weekly invoice block real rather
// than placeholder. Stock quantities still belong to the stock module and
// coin still moves through its ledger.

/**
 * How an order is paid for.
 *
 * `cash` settles at placement, so it never becomes an invoice — that is
 * the honest reading of "paid up front" and it keeps a cash-only player
 * out of the obligation ledger entirely. `deposit` and `net` both invoice
 * on DELIVERY, never on placement: a supplier that fails to deliver is
 * owed nothing, which is the whole point of making the miss a failed
 * transaction rather than a diagnostic line.
 */
export type SupplierPaymentTerms = 'cash' | 'deposit' | 'net'

export type PurchaseOrderLine = {
  stockId: string
  quantity: number
  unitPrice: number
}

export type DeliveryOutcome = 'full' | 'partial' | 'missed'

export type PurchaseOrderAttempt = {
  onDay: number
  outcome: DeliveryOutcome
  /** Units that actually arrived on this attempt. */
  quantity: number
  /** Quality of the units that arrived. Zero on a miss. */
  quality: number
  reason: string
}

/** §5.11 — an order cannot accumulate attempts forever. */
export const MAX_ORDER_ATTEMPTS = 6

/**
 * A purchase order.
 *
 * Extends the shared `OrderRecord` contract vocabulary (family `order`) so
 * its status machine, history and escalation mean the same thing they mean
 * on a loan or an inspection case. The supplier-specific half is the
 * ACCEPTED QUOTE: the terms are snapshotted at placement and never re-read,
 * because a price that moved under the player after they agreed to it is
 * the same broken promise this phase exists to remove.
 */
export type PurchaseOrderRecord = OrderRecord & {
  supplierId: string
  /** The quote the player accepted. Never recomputed. */
  quotedUnitPrice: number
  quotedQuality: number
  /** Fulfilment risk shown when the order was accepted. Never recomputed. */
  quotedMissChance: number
  leadTimeDays: number
  /** Days after `promisedOnDay` the supplier may still deliver in. */
  deliveryWindowDays: number
  paymentTerms: SupplierPaymentTerms
  /** Coin already handed over (a deposit, or the whole cash price). */
  prepaid: number
  netTermDays: number
  /** Units the supplier committed capacity for. */
  capacityCommitted: number
  substitutionsAllowed: boolean
  rush: boolean
  amendmentsUsed: number
  /** Invoice obligation ids raised against this order. */
  invoiceIds: string[]
  attempts: PurchaseOrderAttempt[]
  /** Set when the player disputes a short or missed delivery. */
  dispute?: {
    onDay: number
    reason: string
    resolution?: string
    resolvedOnDay?: number
  }
  /** Set when the order was created by splitting a larger request. */
  splitFromRequestId?: string
}

export type SupplierCreditStatus =
  /** Never asked for, or asked for and refused. Cash and deposit only. */
  | 'none'
  | 'approved'
  /** Frozen by an overdue invoice. Recoverable by paying it. */
  | 'suspended'
  /** Withdrawn after a default. Needs relationship repair before a new request. */
  | 'revoked'

export type SupplierPaymentHistory = {
  onTimePayments: number
  latePayments: number
  defaults: number
  ordersPlaced: number
  ordersDelivered: number
  ordersPartial: number
  ordersMissed: number
  ordersCancelled: number
  disputes: number
  disputesUpheld: number
}

/**
 * Everything the tavern's relationship with one supplier carries beyond the
 * four world-state meters: the credit line, the trading record it was
 * granted on, and any standing concession or refusal a resolved event left
 * behind.
 *
 * Bounded by construction — one entry per supplier in `world.suppliers`,
 * and `pruneSupplierAccounts` drops entries whose supplier is gone.
 */
export type SupplierAccountState = {
  supplierId: string
  creditStatus: SupplierCreditStatus
  /** Maximum outstanding invoice value the supplier will carry. */
  creditLimit: number
  /** Days from delivery to the invoice due day, on `net` terms. */
  netTermDays: number
  /** Fraction of the price required up front on `deposit` terms. */
  depositFraction: number
  /** Day a suspended or revoked line may be asked about again. */
  reviewOnDay?: number
  history: SupplierPaymentHistory
  /**
   * Multiplicative price concession (<1) or penalty (>1) granted by a
   * negotiation or a resolved supplier event. Expires on
   * `termsAdjustmentUntilDay`.
   */
  termsAdjustment: number
  termsAdjustmentUntilDay?: number
  /** The supplier will accept no new orders before this day. */
  refusingUntilDay?: number
  /**
   * Who stopped the supply, so the right system can start it again.
   *
   * `collections` is leverage to collect a debt and lifts the moment the
   * debt is settled; `retaliation` is a grudge and runs its stated course.
   * Without the distinction the daily credit review — which sees no arrears
   * during a grudge — would clear a retaliation the day it landed.
   */
  refusingReason?: 'collections' | 'retaliation'
  lastDecisionDay: number
  lastDecisionReason: string
  lastOrderDay?: number
}

export type SupplierProcurementTotals = {
  ordersPlaced: number
  ordersDelivered: number
  ordersPartial: number
  ordersMissed: number
  ordersCancelled: number
  unitsDelivered: number
  coinPrepaid: number
  invoicesOpened: number
  invoicedValue: number
  invoicePaid: number
  spotPurchases: number
}

/** §5.11 bounded growth for the two new persistent collections. */
export const MAX_OPEN_PURCHASE_ORDERS = 40
export const MAX_ARCHIVED_PURCHASE_ORDERS = 60

export type SupplierModuleState = {
  activeMarketConditions: ActiveMarketCondition[]
  deliveriesToday: SupplierDeliveryRecord[]
  priceAdjustmentsToday: SupplierPriceAdjustment[]
  missedDeliveriesToday: SupplierMissedDelivery[]

  // Expansion Phase 6.
  /** Live purchase orders, keyed by id. */
  orders: Record<string, PurchaseOrderRecord>
  /** Terminal orders, oldest first. Bounded archive. */
  orderArchive: PurchaseOrderRecord[]
  /** Per-supplier credit line and trading record. */
  accounts: Record<string, SupplierAccountState>
  /** Units bought on the local spot market today, per stock id. */
  spotPurchasesToday: Record<string, number>
  nextOrderSuffix: number
  totals: SupplierProcurementTotals
}
