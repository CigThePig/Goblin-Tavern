import { z } from 'zod'

import type { SimulationModule, SimulationHook } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ValidationIssue } from '../../state/types'
import { marketConditionRegistry } from '../../content/suppliers/marketConditionRegistry'
import { getMissedDeliveryProbability } from './pricing'
import {
  SUPPLIERS_MODULE_ID,
  createInitialSupplierModuleState,
  getSupplierModuleState,
} from './state'
import { buildSupplierReport } from './supplierReport'
import type {
  ActiveMarketCondition,
  SupplierMissedDelivery,
  SupplierModuleState,
} from './types'

// Phase 29 §29.5 — Supplier module.
//
// Hooks into `supplierUpdate` (Phase 27 §27.1) and runs a deliberately
// modest daily cycle:
//   1. Reset the per-day delivery / price-adjustment / missed-delivery
//      arrays so the supplier report only reflects today's activity.
//   2. Advance and prune active market conditions: conditions whose
//      `expiresAtDay` has passed are dropped, the rest carry over.
//   3. Apply lightweight relationship drift for suppliers whose
//      reliability is low — drift is small (-1 every day), capped at 0,
//      and attributed through `ctx.modifySupplier` so the cause
//      contract holds.
//
// Phase 29 does not yet schedule deliveries automatically — the existing
// stock/ledger logic still owns restocking. Future phases (32+) can
// drive deliveries by reading `state.world.suppliers` and
// `state.modules.suppliers.activeMarketConditions`.

const SOURCE = 'suppliers'

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  // Reset the per-day arrays. Keep `activeMarketConditions` because a
  // condition that started yesterday should persist until its own
  // expiration logic in `supplierUpdate` prunes it.
  ctx.modifyModuleState<SupplierModuleState>(
    SUPPLIERS_MODULE_ID,
    (current) => {
      const next = current ?? createInitialSupplierModuleState()
      return {
        activeMarketConditions: [...next.activeMarketConditions],
        deliveriesToday: [],
        priceAdjustmentsToday: [],
        missedDeliveriesToday: [],
      }
    },
    { source: `${SOURCE}.day_initialize` },
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
    ctx.modifyModuleState<SupplierModuleState>(
      SUPPLIERS_MODULE_ID,
      (current) => {
        const base = current ?? createInitialSupplierModuleState()
        return { ...base, activeMarketConditions: survivingConditions }
      },
      { source: `${SOURCE}.market_conditions_expire` },
    )
  }

  // Lightweight relationship drift. Suppliers with very low reliability
  // drift relationship down a touch each day; the cause contract is
  // satisfied via `modifySupplier`.
  for (const supplier of Object.values(ctx.state.world.suppliers)) {
    if (supplier.reliability >= 30 || supplier.relationship <= 0) continue
    const nextRelationship = Math.max(0, supplier.relationship - 1)
    if (nextRelationship === supplier.relationship) continue
    ctx.modifySupplier(
      supplier.id,
      { relationship: nextRelationship },
      {
        source: `${SOURCE}.relationship_drift`,
        readable: `${supplier.label} relationship slipped (reliability ${supplier.reliability}).`,
        amount: -1,
        tags: ['supplier', 'relationship'],
      },
    )
  }

  // Phase 84 / ISSUE-044 — per-supplier missed-delivery roll.
  // Suppliers with reliability < 60 occasionally miss a delivery on
  // one of their `goodsProvided` ingredients. The roll uses the
  // `supplier_delivery` named RNG stream so the result is
  // deterministic per (seed, day, supplier, stock) tuple. The
  // observation is purely diagnostic for now — it records the missed
  // attempt on `state.modules.suppliers.missedDeliveriesToday` and
  // emits a cause. Future phases that schedule automatic deliveries
  // can plug in here to skip the actual stock write.
  const rng = ctx.getRngStream('supplier_delivery')
  const newlyMissed: SupplierMissedDelivery[] = []
  for (const supplier of Object.values(ctx.state.world.suppliers)) {
    const probability = getMissedDeliveryProbability(supplier)
    if (probability === 0) continue
    if (supplier.goodsProvided.length === 0) continue
    if (!rng.chance(probability)) continue
    const stockId = rng.pick([...supplier.goodsProvided])
    newlyMissed.push({
      supplierId: supplier.id,
      stockId,
      reason: 'low_reliability',
      tags: ['supplier', 'missed', 'low_reliability'],
    })
    ctx.addCause({
      source: `${SOURCE}.missed_delivery`,
      sourceType: 'supplier',
      target: supplier.id,
      targetType: 'supplier',
      amount: 0,
      direction: 'neutral',
      readable: `${supplier.label} missed today's delivery of ${stockId} (reliability ${supplier.reliability}).`,
      tags: ['supplier', 'missed_delivery', supplier.id, stockId],
      relatedSystems: [SOURCE, 'stock'],
    })
  }
  if (newlyMissed.length > 0) {
    ctx.modifyModuleState<SupplierModuleState>(
      SUPPLIERS_MODULE_ID,
      (current) => {
        const base = current ?? createInitialSupplierModuleState()
        return {
          ...base,
          missedDeliveriesToday: [
            ...base.missedDeliveriesToday,
            ...newlyMissed,
          ],
        }
      },
      { source: `${SOURCE}.missed_delivery_record` },
    )
  }

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
    if (!(delivery.supplierId in ctx.state.world.suppliers)) {
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

const SupplierModuleStateSchema = z.object({
  activeMarketConditions: z.array(ActiveMarketConditionSchema),
  deliveriesToday: z.array(SupplierDeliveryRecordSchema),
  priceAdjustmentsToday: z.array(SupplierPriceAdjustmentSchema),
  missedDeliveriesToday: z.array(SupplierMissedDeliverySchema),
})

export const supplierModule: SimulationModule = {
  id: SUPPLIERS_MODULE_ID,
  version: '0.2.0',
  hooks: {
    startDay: [startDayHook],
    supplierUpdate: [supplierUpdateHook],
  },
  buildReport: buildSupplierReport,
  validate: validateSupplierState,
  stateSchema: SupplierModuleStateSchema,
}
