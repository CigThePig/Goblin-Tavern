import { z } from 'zod'

import type { SimulationModule, SimulationHook } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ValidationIssue } from '../../state/types'
import { marketConditionRegistry } from '../../content/suppliers/marketConditionRegistry'
import {
  SUPPLIERS_MODULE_ID,
  createInitialSupplierModuleState,
  createSupplierAccount,
  getSupplierModuleState,
  isOrderOpen,
  pruneSupplierAccounts,
  writeSupplierState,
} from './state'
import { expireNegotiatedTerms, reviewAllSupplierCredit } from './credit'
import { ensureSupplierEventsRegistered } from './supplierEvents'
import { buildSupplierReport } from './supplierReport'
import type { ActiveMarketCondition, SupplierModuleState } from './types'
import {
  MAX_ARCHIVED_PURCHASE_ORDERS,
  MAX_OPEN_PURCHASE_ORDERS,
} from './types'

// Phase 29 §29.5 — Supplier module.
//
// Expansion Phase 6 rebuilt the daily cycle around real transactions. The
// hook now:
//   1. Resets the per-day delivery / price / miss / spot-market records.
//   2. Advances and prunes active market conditions.
//   3. Seeds an account for any supplier that lacks one, and prunes accounts
//      whose supplier is gone (§5.11).
//   4. Lets negotiated terms lapse on their stated day.
//   5. Recomputes every supplier's credit standing from the live obligation
//      ledger — the suspension/revocation half of §6.3.
//   6. Applies relationship drift for unreliable suppliers and for arrears
//      the tavern is sitting on.
//   7. Surfaces pressure from active market conditions.
//
// What is GONE is the Phase 84 diagnostic: a daily reliability roll against
// no order, which recorded a "missed delivery" that missed nothing. Rolls
// now happen in `deliverOrder`, against a real promise, with real
// consequences (plan §6.2). `getMissedDeliveryProbability` survives in
// `pricing.ts` because the quote preview still shows the player a risk
// figure before they commit.

const SOURCE = 'suppliers'

ensureSupplierEventsRegistered()

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  // Reset the per-day arrays. Keep `activeMarketConditions` because a
  // condition that started yesterday should persist until its own
  // expiration logic in `supplierUpdate` prunes it, and keep orders,
  // accounts and totals because they are the persistent half of the slice.
  writeSupplierState(
    ctx,
    (current) => ({
      ...current,
      activeMarketConditions: [...current.activeMarketConditions],
      deliveriesToday: [],
      priceAdjustmentsToday: [],
      missedDeliveriesToday: [],
      spotPurchasesToday: {},
    }),
    'day_initialize',
  )
}

const supplierUpdateHook: SimulationHook = (ctx: SimContext): void => {
  const today = ctx.state.calendar.totalDaysElapsed
  const slice = getSupplierModuleState(ctx.state)

  // Prune expired market conditions.
  const survivingConditions: ActiveMarketCondition[] = []
  const expired: ActiveMarketCondition[] = []
  for (const active of slice.activeMarketConditions) {
    if (active.expiresAtDay !== undefined && active.expiresAtDay <= today) {
      expired.push(active)
    } else {
      survivingConditions.push(active)
    }
  }
  if (expired.length > 0) {
    writeSupplierState(
      ctx,
      (current) => ({ ...current, activeMarketConditions: survivingConditions }),
      'market_conditions_expire',
    )
  }

  // Seed an account for every supplier, and drop accounts for suppliers who
  // are gone. A supplier the player can order from must have somewhere for
  // their trading record to live.
  ensureSupplierAccounts(ctx)

  // Terms the player negotiated run out on the day they were told they
  // would; a concession that never expired would be a permanent discount
  // bought once.
  expireNegotiatedTerms(ctx)

  // §6.3 — credit standing is DERIVED from the live obligation ledger, so a
  // defaulted invoice suspends the line without a second bookkeeping map to
  // keep in step (see `credit.ts`).
  reviewAllSupplierCredit(ctx)

  // Relationship drift. Two sources, both real: a supplier the tavern
  // cannot rely on drifts away from it, and a supplier the tavern owes past
  // its due date cools toward it.
  applyRelationshipDrift(ctx)

  // Surface pressure nudges from active market conditions. Conditions
  // tag the pressure ids they care about; pressures live at
  // `state.pressures` and `ctx.modifyPressure` clamps them to 0–100.
  // Mirror the Phase 18 pattern: `modifyPressure` records the change,
  // `addCause` writes the matching cause so the diff/report layer sees
  // an attributed entry on `state.causes`.
  for (const active of survivingConditions) {
    if (!marketConditionRegistry.has(active.id)) continue
    const def = marketConditionRegistry.get(active.id)
    if (def.pressureTags.length === 0) continue
    for (const pressureId of def.pressureTags) {
      if (!ctx.state.pressures[pressureId]) continue
      const causeDraft = {
        source: `${SOURCE}.${active.id}`,
        sourceType: 'supplier' as const,
        target: pressureId,
        targetType: 'pressure' as const,
        amount: 1,
        readable: `${def.label} pressures ${pressureId}.`,
        tags: ['supplier', 'market_condition', active.id],
      }
      ctx.modifyPressure(pressureId, 1, causeDraft)
      ctx.addCause(causeDraft)
    }
  }
}

function ensureSupplierAccounts(ctx: SimContext): void {
  const slice = getSupplierModuleState(ctx.state)
  const today = ctx.state.calendar.totalDaysElapsed
  const missing = Object.keys(ctx.state.world.suppliers).filter(
    (id) => !slice.accounts[id],
  )
  const stale = Object.keys(slice.accounts).some(
    (id) => !ctx.state.world.suppliers[id],
  )
  if (missing.length === 0 && !stale) return
  writeSupplierState(
    ctx,
    (current) => {
      const accounts = { ...current.accounts }
      for (const id of missing) accounts[id] = createSupplierAccount(id, today)
      return pruneSupplierAccounts({ ...current, accounts }, ctx.state)
    },
    'accounts_seeded',
  )
}

/**
 * Daily relationship drift.
 *
 * Small, attributed, and always for a stated reason — the two reasons are
 * the two things a supplier actually notices: that the tavern cannot rely
 * on them (which cools the relationship from their side too, because
 * neither party is being served), and that the tavern owes them money past
 * its due date.
 */
function applyRelationshipDrift(ctx: SimContext): void {
  const slice = getSupplierModuleState(ctx.state)
  const overdueBySupplier = new Map<string, number>()
  for (const record of Object.values(
    (ctx.state.modules['obligations'] as
      | { records?: Record<string, {
          direction?: string
          counterparty?: { kind?: string; id?: string }
          status?: string
        }> }
      | undefined)?.records ?? {},
  )) {
    if (record.direction !== 'payable') continue
    if (record.counterparty?.kind !== 'supplier') continue
    if (!['grace', 'defaulted', 'in_collections'].includes(record.status ?? '')) {
      continue
    }
    const id = record.counterparty.id ?? ''
    overdueBySupplier.set(id, (overdueBySupplier.get(id) ?? 0) + 1)
  }

  for (const supplier of Object.values(ctx.state.world.suppliers)) {
    const overdue = overdueBySupplier.get(supplier.id) ?? 0
    const unreliable = supplier.reliability < 30
    if (!unreliable && overdue === 0) continue
    if (supplier.relationship <= 0) continue
    const drift = (unreliable ? 1 : 0) + (overdue > 0 ? 1 : 0)
    const nextRelationship = Math.max(0, supplier.relationship - drift)
    if (nextRelationship === supplier.relationship) continue
    ctx.modifySupplier(
      supplier.id,
      { relationship: nextRelationship },
      {
        source: `${SOURCE}.relationship_drift`,
        readable:
          overdue > 0
            ? `${supplier.label} cooled over ${overdue} unpaid invoice${overdue === 1 ? '' : 's'}.`
            : `${supplier.label} relationship slipped (reliability ${supplier.reliability}).`,
        amount: -drift,
        tags: ['supplier', 'relationship', ...(overdue > 0 ? ['arrears'] : [])],
      },
    )
  }
  void slice
}

function validateSupplierState(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const slice = getSupplierModuleState(ctx.state)
  for (let i = 0; i < slice.activeMarketConditions.length; i++) {
    const active = slice.activeMarketConditions[i]!
    if (!marketConditionRegistry.has(active.id)) {
      issues.push({
        path: `modules.suppliers.activeMarketConditions[${i}].id`,
        message: `Unknown market condition id '${active.id}'`,
        code: 'unknown_market_condition_id',
      })
    }
  }
  for (let i = 0; i < slice.deliveriesToday.length; i++) {
    const delivery = slice.deliveriesToday[i]!
    // `local_market` is the spot channel rather than a world entity, so it
    // is deliberately not required to exist in `world.suppliers`.
    if (
      delivery.supplierId !== 'local_market' &&
      !(delivery.supplierId in ctx.state.world.suppliers)
    ) {
      issues.push({
        path: `modules.suppliers.deliveriesToday[${i}].supplierId`,
        message: `Unknown supplier id '${delivery.supplierId}'`,
        code: 'unknown_supplier_ref',
      })
    }
    if (!(delivery.stockId in ctx.state.stock)) {
      issues.push({
        path: `modules.suppliers.deliveriesToday[${i}].stockId`,
        message: `Unknown stock id '${delivery.stockId}'`,
        code: 'unknown_stock_ref',
      })
    }
  }

  // Expansion Phase 6 §5.11 — the two new persistent collections stay inside
  // their declared caps, and a terminal order never lingers in the live map
  // (that would make it invisible to the archive answering "what happened to
  // that delivery?").
  const openOrders = Object.values(slice.orders)
  if (openOrders.length > MAX_OPEN_PURCHASE_ORDERS) {
    issues.push({
      path: 'modules.suppliers.orders',
      message: `${openOrders.length} open purchase orders, above the ${MAX_OPEN_PURCHASE_ORDERS} cap`,
      code: 'supplier_orders_over_cap',
    })
  }
  if (slice.orderArchive.length > MAX_ARCHIVED_PURCHASE_ORDERS) {
    issues.push({
      path: 'modules.suppliers.orderArchive',
      message: `${slice.orderArchive.length} archived orders, above the ${MAX_ARCHIVED_PURCHASE_ORDERS} cap`,
      code: 'supplier_order_archive_over_cap',
    })
  }
  for (const order of openOrders) {
    if (!isOrderOpen(order)) {
      issues.push({
        path: `modules.suppliers.orders.${order.id}`,
        message: `Order '${order.id}' is ${order.status} but still in the live map`,
        code: 'supplier_order_terminal_still_live',
      })
    }
    if (
      order.supplierId !== 'local_market' &&
      !(order.supplierId in ctx.state.world.suppliers)
    ) {
      issues.push({
        path: `modules.suppliers.orders.${order.id}.supplierId`,
        message: `Order '${order.id}' names unknown supplier '${order.supplierId}'`,
        code: 'unknown_supplier_ref',
      })
    }
    for (const line of order.lines) {
      const delivered = order.delivered[line.stockId] ?? 0
      if (delivered > line.quantity) {
        issues.push({
          path: `modules.suppliers.orders.${order.id}.delivered.${line.stockId}`,
          message: `Order '${order.id}' delivered ${delivered} of ${line.quantity} ordered`,
          code: 'supplier_order_over_delivered',
        })
      }
    }
  }
  for (const [id, account] of Object.entries(slice.accounts)) {
    if (!(id in ctx.state.world.suppliers)) {
      issues.push({
        path: `modules.suppliers.accounts.${id}`,
        message: `Credit account for unknown supplier '${id}'`,
        code: 'unknown_supplier_ref',
      })
    }
    if (account.creditStatus !== 'approved' && account.creditLimit > 0) {
      issues.push({
        path: `modules.suppliers.accounts.${id}.creditLimit`,
        message: `Supplier '${id}' has a ${account.creditLimit}-coin limit while credit is ${account.creditStatus}`,
        code: 'supplier_credit_limit_without_line',
      })
    }
  }
  return issues
}

// Phase 6 §6.1.1 — schema for `state.modules.suppliers`.
//
// Inferred Zod types are used directly (no `z.ZodType<X>` annotation) so
// the optional fields compose correctly under
// `exactOptionalPropertyTypes: true` — same pattern as
// `AreaUpgradeStateSchema` in `state/schemas.ts`.
const ActiveMarketConditionSchema = z.object({
  id: z.string(),
  startedAtDay: z.number().int().min(0),
  expiresAtDay: z.number().int().min(0).optional(),
  intensity: z.number().min(0).max(100),
  tags: z.array(z.string()),
})

const SupplierDeliveryRecordSchema = z.object({
  supplierId: z.string(),
  stockId: z.string(),
  quantity: z.number().min(0),
  quality: z.number().min(0).max(100),
  coinCost: z.number(),
  causeId: z.string().optional(),
  tags: z.array(z.string()),
})

const SupplierPriceAdjustmentSchema = z.object({
  supplierId: z.string(),
  stockId: z.string(),
  basePrice: z.number(),
  effectivePrice: z.number(),
  conditionIds: z.array(z.string()),
  tags: z.array(z.string()),
})

const SupplierMissedDeliverySchema = z.object({
  supplierId: z.string(),
  stockId: z.string(),
  reason: z.string(),
  tags: z.array(z.string()),
})

// Expansion Phase 6 §5.7 — every persisted procurement field, schema'd in
// the same phase that introduces it.
const ContractStatusEnum = z.enum([
  'pending',
  'active',
  'grace',
  'defaulted',
  'in_collections',
  'settled',
  'forgiven',
  'cancelled',
  'expired',
])

const PurchaseOrderRecordSchema = z.object({
  id: z.string(),
  family: z.literal('order'),
  ownerModuleId: z.string(),
  counterparty: z.object({ kind: z.string(), id: z.string() }),
  status: ContractStatusEnum,
  openedOnDay: z.number().int().min(0),
  dueOnDay: z.number().int().min(0).optional(),
  graceDays: z.number().int().min(0),
  closedOnDay: z.number().int().min(0).optional(),
  lastTransitionOnDay: z.number().int().min(0),
  history: z.array(
    z.object({
      onDay: z.number().int(),
      from: z.string(),
      to: z.string(),
      reason: z.string(),
      amount: z.number().optional(),
    }),
  ),
  escalation: z.number().int().min(0),
  readable: z.string(),
  tags: z.array(z.string()),
  lines: z.array(
    z.object({
      stockId: z.string(),
      quantity: z.number().min(0),
      unitPrice: z.number().min(0),
    }),
  ),
  delivered: z.record(z.string(), z.number().min(0)),
  promisedOnDay: z.number().int().min(0),
  supplierId: z.string(),
  quotedUnitPrice: z.number().min(0),
  quotedQuality: z.number().min(0).max(100),
  quotedMissChance: z.number().min(0).max(1),
  leadTimeDays: z.number().int().min(0),
  deliveryWindowDays: z.number().int().min(0),
  paymentTerms: z.enum(['cash', 'deposit', 'net']),
  prepaid: z.number().min(0),
  netTermDays: z.number().int().min(0),
  capacityCommitted: z.number().min(0),
  substitutionsAllowed: z.boolean(),
  rush: z.boolean(),
  amendmentsUsed: z.number().int().min(0),
  invoiceIds: z.array(z.string()),
  attempts: z.array(
    z.object({
      onDay: z.number().int().min(0),
      outcome: z.enum(['full', 'partial', 'missed']),
      quantity: z.number().min(0),
      quality: z.number().min(0).max(100),
      reason: z.string(),
    }),
  ),
  dispute: z
    .object({
      onDay: z.number().int().min(0),
      reason: z.string(),
      resolution: z.string().optional(),
      resolvedOnDay: z.number().int().min(0).optional(),
    })
    .optional(),
  splitFromRequestId: z.string().optional(),
})

const SupplierAccountStateSchema = z.object({
  supplierId: z.string(),
  creditStatus: z.enum(['none', 'approved', 'suspended', 'revoked']),
  creditLimit: z.number().min(0),
  netTermDays: z.number().int().min(0),
  depositFraction: z.number().min(0).max(1),
  reviewOnDay: z.number().int().min(0).optional(),
  history: z.object({
    onTimePayments: z.number().int().min(0),
    latePayments: z.number().int().min(0),
    defaults: z.number().int().min(0),
    ordersPlaced: z.number().int().min(0),
    ordersDelivered: z.number().int().min(0),
    ordersPartial: z.number().int().min(0),
    ordersMissed: z.number().int().min(0),
    ordersCancelled: z.number().int().min(0),
    disputes: z.number().int().min(0),
    disputesUpheld: z.number().int().min(0),
  }),
  termsAdjustment: z.number().min(0),
  termsAdjustmentUntilDay: z.number().int().min(0).optional(),
  refusingUntilDay: z.number().int().min(0).optional(),
  refusingReason: z.enum(['collections', 'retaliation']).optional(),
  lastDecisionDay: z.number().int().min(0),
  lastDecisionReason: z.string(),
  lastOrderDay: z.number().int().min(0).optional(),
})

const SupplierProcurementTotalsSchema = z.object({
  ordersPlaced: z.number().min(0),
  ordersDelivered: z.number().min(0),
  ordersPartial: z.number().min(0),
  ordersMissed: z.number().min(0),
  ordersCancelled: z.number().min(0),
  unitsDelivered: z.number().min(0),
  coinPrepaid: z.number().min(0),
  invoicesOpened: z.number().min(0),
  invoicedValue: z.number().min(0),
  invoicePaid: z.number().min(0),
  spotPurchases: z.number().min(0),
})

const SupplierModuleStateSchema = z.object({
  activeMarketConditions: z.array(ActiveMarketConditionSchema),
  deliveriesToday: z.array(SupplierDeliveryRecordSchema),
  priceAdjustmentsToday: z.array(SupplierPriceAdjustmentSchema),
  missedDeliveriesToday: z.array(SupplierMissedDeliverySchema),
  orders: z.record(z.string(), PurchaseOrderRecordSchema),
  orderArchive: z.array(PurchaseOrderRecordSchema),
  accounts: z.record(z.string(), SupplierAccountStateSchema),
  spotPurchasesToday: z.record(z.string(), z.number().min(0)),
  nextOrderSuffix: z.number().int().min(0),
  totals: SupplierProcurementTotalsSchema,
})

export const supplierModule: SimulationModule = {
  id: SUPPLIERS_MODULE_ID,
  version: '0.3.0',
  // Deliberately NO `dependsOn: ['scheduledEvents']`. `dependsOn` is a
  // same-phase ordering constraint, and declaring it would sort the
  // scheduler's `startDay` (which resolves the `morning` beat, including
  // deliveries) ahead of this module's `startDay` reset — which would then
  // wipe the very `deliveriesToday` the delivery just wrote. The pipeline
  // order in `canonicalPipeline.ts` already puts suppliers first, which is
  // the order the day needs.
  hooks: {
    startDay: [startDayHook],
    supplierUpdate: [supplierUpdateHook],
  },
  buildReport: buildSupplierReport,
  validate: validateSupplierState,
  stateSchema: SupplierModuleStateSchema,
}

export { createInitialSupplierModuleState }
export type { SupplierModuleState }
