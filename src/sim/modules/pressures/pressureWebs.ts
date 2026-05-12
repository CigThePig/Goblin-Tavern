import type { SimContext } from '../../core/context'
import type { PressureCauseRef } from './pressureTypes'
import { getPressureModuleState } from './pressureModule'

// Phase 38 §38.14 — Shared helpers for the expanded pressure webs.
//
// These do not replace any individual calculator; they are small,
// composable utilities that calculators can call to fold related
// pressure values into their own causes (the "web" effect).
//
// Two read modes are exposed:
//   - `pressureValue`: read the on-state `state.pressures[id].value` —
//     stable at module-hook-start time, matches the value other modules
//     observe today.
//   - `pressureSnapshotValue`: read the rich snapshot value from the
//     module slice (if it has been recalculated already this day).

export function pressureValue(ctx: SimContext, id: string): number {
  return ctx.state.pressures[id]?.value ?? 0
}

export function pressureSnapshotValue(ctx: SimContext, id: string): number {
  const slice = getPressureModuleState(ctx.state)
  return slice.snapshots[id]?.value ?? pressureValue(ctx, id)
}

/**
 * Build a `PressureCauseRef` that folds a fraction of another pressure's
 * value into the caller's calculation. Returns `null` when the contribution
 * rounds to zero so callers can splat-with-filter without bookkeeping.
 */
export function relatedPressureContribution(
  ctx: SimContext,
  id: string,
  multiplier: number,
  readable: string,
  tags: string[],
): PressureCauseRef | null {
  const value = pressureValue(ctx, id)
  if (value <= 0) return null
  const amount = Math.round(value * multiplier)
  if (amount === 0) return null
  return {
    id: `web_${id}`,
    readable,
    amount,
    weight: Math.abs(amount),
    direction: amount > 0 ? 'increase' : amount < 0 ? 'decrease' : 'neutral',
    tags: [...tags, 'web'],
    relatedSystems: ['pressures'],
  }
}

// Phase 38 §38.14 — Documented webs.
//
// Supplier spiral:
//   supplier_distrust → stock_shortage → market_instability → customer
//   complaint seeds → reputation_drift
//
// Social backlash spiral:
//   policy_backlash → faction_anger → cultural_tension → violence →
//   reputation_drift
//
// Staff collapse spiral:
//   staff_loyalty_risk → staff_burnout → service failures →
//   regular_customer_loss → debt
export const PRESSURE_WEBS = {
  supplierSpiral: [
    'supplier_distrust',
    'stock_shortage',
    'market_instability',
    'reputation_drift',
  ],
  socialBacklashSpiral: [
    'policy_backlash',
    'faction_anger',
    'cultural_tension',
    'violence',
    'reputation_drift',
  ],
  staffCollapseSpiral: [
    'staff_loyalty_risk',
    'staff_burnout',
    'regular_customer_loss',
    'debt',
  ],
} as const
