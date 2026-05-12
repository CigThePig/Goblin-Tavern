import { marketConditionRegistry } from '../../content/suppliers/marketConditionRegistry'
import type {
  StockState,
  SupplierWorldState,
} from '../../state/TavernState'
import type { ActiveMarketCondition } from './types'

// Phase 29 §29.6 — Effective base price helper.
//
// Pure, deterministic, and side-effect-free. Combines:
//   - the stock's recorded `basePrice`,
//   - the supplier's `priceBias` (additive coin shift; may be negative),
//   - every active market condition that targets this stock (multipliers
//     are multiplicative).
//
// A condition targets a stock id if:
//   - it has no filters (applies to every supplier good), or
//   - its `affectedStockIds` includes the id, or
//   - any of its `affectedStockTags` matches a tag on the stock item.
//
// The helper does not clamp. Callers that store the result on state
// should clamp to a sensible floor (`Math.max(0, …)`); pricing-only
// reports can show the raw value.

function conditionAppliesTo(
  conditionId: string,
  stock: StockState,
): boolean {
  if (!marketConditionRegistry.has(conditionId)) return false
  const def = marketConditionRegistry.get(conditionId)
  const noFilters =
    (!def.affectedStockIds || def.affectedStockIds.length === 0) &&
    (!def.affectedStockTags || def.affectedStockTags.length === 0)
  if (noFilters) return true
  if (def.affectedStockIds?.includes(stock.id)) return true
  if (
    def.affectedStockTags &&
    def.affectedStockTags.some((tag) => stock.tags.includes(tag))
  ) {
    return true
  }
  return false
}

export function getEffectiveBasePrice(
  stock: StockState,
  supplier: SupplierWorldState | undefined,
  activeConditions: ReadonlyArray<ActiveMarketCondition>,
): number {
  let price = stock.basePrice
  if (supplier) price += supplier.priceBias
  for (const active of activeConditions) {
    if (!conditionAppliesTo(active.id, stock)) continue
    const def = marketConditionRegistry.has(active.id)
      ? marketConditionRegistry.get(active.id)
      : undefined
    const multiplier = def?.priceMultiplier ?? 1
    price *= multiplier
  }
  return price
}
