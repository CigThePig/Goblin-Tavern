import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'
import type {
  PurchaseOrderRecord,
  SupplierAccountState,
  SupplierModuleState,
  SupplierProcurementTotals,
} from './types'
import {
  MAX_ARCHIVED_PURCHASE_ORDERS,
  MAX_OPEN_PURCHASE_ORDERS,
} from './types'

// Phase 29 §29.4 — Supplier module slice helpers, mirroring the Phase 9
// stock module pattern. `createInitialSupplierModuleState` seeds an
// empty slice on day zero. `getSupplierModuleState` is the typed
// read-through used by reports and other modules; it returns a
// fresh empty default when the slice has not been seeded so callers
// never receive `undefined`.
//
// Expansion Phase 6 — the read-through now merges the procurement fields
// field by field rather than only replacing a missing whole slice. A save
// written before this phase HAS a `modules.suppliers` object, so the
// whole-slice fallback would never fire for it; merging per field is what
// stops such a save reading `orders` as `undefined` in the window between
// load and `ensureSupplierProcurementFields`.

export const SUPPLIERS_MODULE_ID = 'suppliers'

export function emptyProcurementTotals(): SupplierProcurementTotals {
  return {
    ordersPlaced: 0,
    ordersDelivered: 0,
    ordersPartial: 0,
    ordersMissed: 0,
    ordersCancelled: 0,
    unitsDelivered: 0,
    coinPrepaid: 0,
    invoicesOpened: 0,
    invoicedValue: 0,
    invoicePaid: 0,
    spotPurchases: 0,
  }
}

export function createInitialSupplierModuleState(): SupplierModuleState {
  return {
    activeMarketConditions: [],
    deliveriesToday: [],
    priceAdjustmentsToday: [],
    missedDeliveriesToday: [],
    orders: {},
    orderArchive: [],
    accounts: {},
    spotPurchasesToday: {},
    nextOrderSuffix: 0,
    totals: emptyProcurementTotals(),
  }
}

export function getSupplierModuleState(state: TavernState): SupplierModuleState {
  const slice = state.modules[SUPPLIERS_MODULE_ID] as
    | Partial<SupplierModuleState>
    | undefined
  const defaults = createInitialSupplierModuleState()
  if (!slice) return defaults
  return {
    ...defaults,
    ...slice,
    totals: { ...defaults.totals, ...(slice.totals ?? {}) },
  }
}

export function writeSupplierState(
  ctx: SimContext,
  patch: (current: SupplierModuleState) => SupplierModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<SupplierModuleState>(
    SUPPLIERS_MODULE_ID,
    (current) => {
      const defaults = createInitialSupplierModuleState()
      const base: SupplierModuleState = current
        ? {
            ...defaults,
            ...current,
            totals: { ...defaults.totals, ...(current.totals ?? {}) },
          }
        : defaults
      return patch(base)
    },
    { source: `${SUPPLIERS_MODULE_ID}.${reason}`, reason },
  )
}

// ---------- Accounts ----------

/**
 * The terms a supplier offers before the tavern has traded with them.
 *
 * Credit is deliberately NOT granted here. `debtTolerance` describes how
 * much rope a supplier would extend to somebody they trust, not what they
 * hand a stranger, and a line the player never asked for cannot teach them
 * that asking is a move. `request_supplier_credit` is the move.
 */
export function createSupplierAccount(
  supplierId: string,
  openedOnDay: number,
): SupplierAccountState {
  return {
    supplierId,
    creditStatus: 'none',
    creditLimit: 0,
    netTermDays: 7,
    depositFraction: 0.5,
    history: {
      onTimePayments: 0,
      latePayments: 0,
      defaults: 0,
      ordersPlaced: 0,
      ordersDelivered: 0,
      ordersPartial: 0,
      ordersMissed: 0,
      ordersCancelled: 0,
      disputes: 0,
      disputesUpheld: 0,
    },
    termsAdjustment: 1,
    lastDecisionDay: openedOnDay,
    lastDecisionReason: 'no trading history yet',
  }
}

export function getSupplierAccount(
  state: TavernState,
  supplierId: string,
): SupplierAccountState {
  const blank = createSupplierAccount(
    supplierId,
    state.calendar.totalDaysElapsed,
  )
  const existing = getSupplierModuleState(state).accounts[supplierId]
  if (!existing) return blank
  return {
    ...blank,
    ...existing,
    history: { ...blank.history, ...existing.history },
  }
}

export function writeSupplierAccount(
  ctx: SimContext,
  supplierId: string,
  patch: (current: SupplierAccountState) => SupplierAccountState,
  reason: string,
): void {
  const next = patch(getSupplierAccount(ctx.state, supplierId))
  writeSupplierState(
    ctx,
    (slice) => ({
      ...slice,
      accounts: { ...slice.accounts, [supplierId]: next },
    }),
    reason,
  )
}

/**
 * §5.11 — drop accounts whose supplier no longer exists. Supplier rosters
 * are stable today, but a map keyed on a world entity still has to say what
 * happens when that entity goes.
 */
export function pruneSupplierAccounts(
  slice: SupplierModuleState,
  state: TavernState,
): SupplierModuleState {
  const live: Record<string, SupplierAccountState> = {}
  let changed = false
  for (const [id, account] of Object.entries(slice.accounts)) {
    if (state.world.suppliers[id]) live[id] = account
    else changed = true
  }
  return changed ? { ...slice, accounts: live } : slice
}

// ---------- Orders ----------

export function isOrderOpen(order: PurchaseOrderRecord): boolean {
  return order.status === 'pending' || order.status === 'active'
}

export function listPurchaseOrders(
  state: TavernState,
  filter?: { supplierId?: string; stockId?: string; open?: boolean },
): PurchaseOrderRecord[] {
  const slice = getSupplierModuleState(state)
  return Object.values(slice.orders)
    .filter((order) => {
      if (filter?.supplierId && order.supplierId !== filter.supplierId) return false
      if (
        filter?.stockId &&
        !order.lines.some((line) => line.stockId === filter.stockId)
      ) {
        return false
      }
      if (filter?.open && !isOrderOpen(order)) return false
      return true
    })
    // Soonest promised first, id as the tie-break: a report and a resolver
    // must walk the same list in the same order across a reload.
    .sort((a, b) => a.promisedOnDay - b.promisedOnDay || a.id.localeCompare(b.id))
}

export function getPurchaseOrder(
  state: TavernState,
  orderId: string,
): PurchaseOrderRecord | undefined {
  return getSupplierModuleState(state).orders[orderId]
}

/** Units still owed on this order, optionally for one stock id. */
export function outstandingUnits(
  order: PurchaseOrderRecord,
  stockId?: string,
): number {
  return order.lines.reduce((sum, line) => {
    if (stockId && line.stockId !== stockId) return sum
    return sum + Math.max(0, line.quantity - (order.delivered[line.stockId] ?? 0))
  }, 0)
}

/** Coin still owed on the undelivered part of an order. */
export function outstandingOrderValue(order: PurchaseOrderRecord): number {
  return order.lines.reduce((sum, line) => {
    const owed = Math.max(0, line.quantity - (order.delivered[line.stockId] ?? 0))
    return sum + owed * line.unitPrice
  }, 0)
}

/** What a supplier is already committed to deliver — real capacity pressure. */
export function committedUnitsForSupplier(
  state: TavernState,
  supplierId: string,
  stockId?: string,
): number {
  return listPurchaseOrders(state, { supplierId, open: true }).reduce(
    (sum, order) => sum + outstandingUnits(order, stockId),
    0,
  )
}

/**
 * Write an order into (or out of) the live map.
 *
 * A terminal order moves to the bounded archive rather than being deleted,
 * so "what happened to that delivery?" always has an answer — the same rule
 * the shared obligation ledger applies to a settled debt.
 */
export function upsertPurchaseOrder(
  ctx: SimContext,
  order: PurchaseOrderRecord,
  reason: string,
): void {
  const terminal = !isOrderOpen(order)
  writeSupplierState(
    ctx,
    (slice) => {
      const orders = { ...slice.orders }
      if (terminal) delete orders[order.id]
      else orders[order.id] = order
      const orderArchive = terminal
        ? capArchive([...slice.orderArchive, order])
        : slice.orderArchive
      return { ...slice, orders, orderArchive }
    },
    reason,
  )
}

/** Every order the run still remembers — live first, then the archive. */
export function listAllPurchaseOrders(state: TavernState): PurchaseOrderRecord[] {
  const slice = getSupplierModuleState(state)
  return [...Object.values(slice.orders), ...slice.orderArchive].sort(
    (a, b) => a.promisedOnDay - b.promisedOnDay || a.id.localeCompare(b.id),
  )
}

export function findPurchaseOrder(
  state: TavernState,
  orderId: string,
): PurchaseOrderRecord | undefined {
  const slice = getSupplierModuleState(state)
  return (
    slice.orders[orderId] ??
    slice.orderArchive.find((order) => order.id === orderId)
  )
}

/**
 * Attach a dispute to an order wherever it lives.
 *
 * A dispute is normally raised about a delivery that already failed, and a
 * failed order is in the ARCHIVE — so this patches in place rather than
 * going through `upsertPurchaseOrder`, which would append a second copy of
 * a terminal record to the archive it is already in.
 */
export function recordOrderDispute(
  ctx: SimContext,
  orderId: string,
  dispute: NonNullable<PurchaseOrderRecord['dispute']>,
): void {
  writeSupplierState(
    ctx,
    (slice) => {
      if (slice.orders[orderId]) {
        return {
          ...slice,
          orders: {
            ...slice.orders,
            [orderId]: { ...slice.orders[orderId]!, dispute },
          },
        }
      }
      return {
        ...slice,
        orderArchive: slice.orderArchive.map((order) =>
          order.id === orderId ? { ...order, dispute } : order,
        ),
      }
    },
    'order_disputed',
  )
}

function capArchive(archive: PurchaseOrderRecord[]): PurchaseOrderRecord[] {
  if (archive.length <= MAX_ARCHIVED_PURCHASE_ORDERS) return archive
  return archive.slice(archive.length - MAX_ARCHIVED_PURCHASE_ORDERS)
}

export function openOrderCount(state: TavernState): number {
  return Object.values(getSupplierModuleState(state).orders).filter(isOrderOpen)
    .length
}

export function atOpenOrderCap(state: TavernState): boolean {
  return openOrderCount(state) >= MAX_OPEN_PURCHASE_ORDERS
}
