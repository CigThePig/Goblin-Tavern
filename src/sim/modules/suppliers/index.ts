export { supplierModule } from './supplierModule'
export {
  SUPPLIERS_MODULE_ID,
  atOpenOrderCap,
  committedUnitsForSupplier,
  createInitialSupplierModuleState,
  createSupplierAccount,
  findPurchaseOrder,
  getPurchaseOrder,
  getSupplierAccount,
  getSupplierModuleState,
  isOrderOpen,
  listAllPurchaseOrders,
  listPurchaseOrders,
  openOrderCount,
  outstandingOrderValue,
  outstandingUnits,
  recordOrderDispute,
  upsertPurchaseOrder,
  writeSupplierAccount,
  writeSupplierState,
} from './state'
export { buildSupplierReport } from './supplierReport'
export { getEffectiveBasePrice } from './pricing'

// Expansion Phase 6 — the procurement surface.
export {
  DELIVERY_WINDOW_DAYS,
  SPOT_MARKET_DAILY_UNITS,
  SPOT_MARKET_PREMIUM,
  SPOT_MARKET_QUALITY,
  creditEligibility,
  creditLimitFor,
  netTermsFor,
  orderMissChance,
  quoteAlternativeSuppliers,
  quoteSupplierOrder,
  quotedQuality,
  spotMarketAvailable,
  spotMarketUnitPrice,
  supplierBaseCapacity,
  supplierBaseLeadDays,
  supplierCreditExposure,
  supplierGrievance,
  supplierOutstanding,
  type QuoteRequest,
  type SupplierQuote,
} from './quote'
export {
  MAX_ORDER_AMENDMENTS,
  amendOrder,
  buyOnSpotMarket,
  canAmendOrder,
  cancelOrder,
  deliverOrder,
  placeOrder,
  placeSplitOrder,
  receiveGoods,
  setDeliveryScheduler,
  type DeliveryResult,
  type PlaceOrderResult,
} from './orders'
export {
  SUPPLIER_INVOICE_TAGS,
  archivedSupplierInvoices,
  creditNoteAgainstInvoice,
  hasOverdueInvoice,
  listSupplierInvoices,
  openSupplierInvoice,
  outstandingSupplierInvoices,
  overdueSupplierInvoices,
  paySupplierInvoice,
  totalSupplierPayable,
  type SupplierInvoiceView,
} from './invoices'
export {
  NEGOTIATION_TERM_DAYS,
  expireNegotiatedTerms,
  isRefusingOrders,
  negotiateSupplierTerms,
  requestSupplierCredit,
  reviewAllSupplierCredit,
  reviewSupplierCredit,
  type CreditDecision,
} from './credit'
export {
  DUAL_SUPPLIER_BALANCE_EVENT,
  NEW_SUPPLIER_UNCERTAINTY_EVENT,
  SUPPLIER_DELIVERY_EVENT,
  SUPPLIER_GOODWILL_EVENT,
  SUPPLIER_INVESTIGATION_EVENT,
  SUPPLIER_RENEGOTIATION_EVENT,
  SUPPLIER_RETALIATION_EVENT,
  SUPPLIER_SCHEDULED_PAYMENT_EVENT,
  ensureSupplierEventsRegistered,
  scheduleSupplierDelivery,
  scheduleSupplierPayment,
} from './supplierEvents'
export { SUPPLIER_ACTIONS } from './actions'

export type {
  ActiveMarketCondition,
  PurchaseOrderRecord,
  SupplierAccountState,
  SupplierCreditStatus,
  SupplierDeliveryRecord,
  SupplierMissedDelivery,
  SupplierModuleState,
  SupplierPaymentTerms,
  SupplierPriceAdjustment,
} from './types'
export {
  MAX_ARCHIVED_PURCHASE_ORDERS,
  MAX_OPEN_PURCHASE_ORDERS,
  MAX_ORDER_ATTEMPTS,
} from './types'
