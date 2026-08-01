import { marketConditionRegistry } from '../../content/suppliers/marketConditionRegistry'
import type {
  StockState,
  SupplierWorldState,
  TavernState,
} from '../../state/TavernState'
import type { ActiveMarketCondition } from './types'
import { getEconomyModuleState } from '../economy/state'
import { getSupplierModuleState } from './state'

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

/**
 * Phase 200 / audit Wave 1 (`P7-EXP-002`) — the floor under every
 * ordinary purchase.
 *
 * `priceBias` is additive, and Mushrooms and Ingredients have base price 1
 * against a −1 bias while Stew has 2 against −2 — so all three reached
 * exactly 0, and `pickRestockSupplier` preferred precisely those
 * suppliers because it sorts by cheapest. The audit bought 240 units in a
 * day for nothing, which removes coin (the central procurement
 * constraint) from shortage recovery, supplier tradeoffs and sale margins
 * alike.
 *
 * The floor lives here rather than in the callers so the quote, the
 * application, the daily report and the supplier screen cannot disagree
 * about it. A deliberate free-price rule — a promotion, a gift, barter —
 * would be modelled as its own effect, not as a bias that happens to
 * reach zero.
 */
export const MIN_UNIT_PRICE = 1

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
  // Phase 84 / ISSUE-044 — supplier relationship modulates the
  // effective price. The legacy `getEffectiveBasePrice` ignored
  // `supplier.relationship` entirely, leaving it decorative on the
  // supplier report. A relationship of 50 is neutral; higher relations
  // earn a small discount, lower relations a surcharge, bounded ±5%.
  if (supplier) {
    price *= getRelationshipPriceMultiplier(supplier)
  }
  return Math.max(MIN_UNIT_PRICE, price)
}

// Exported for the supplier report so the player can see how
// relationship shifts the headline number. Pure helper — no
// side-effects, no rng.
export function getRelationshipPriceMultiplier(
  supplier: SupplierWorldState,
): number {
  const raw = (supplier.relationship - 50) * 0.001
  const bounded = Math.max(-0.05, Math.min(0.05, raw))
  // Subtract: relationship 80 (raw 0.03) → multiplier 0.97 (3% off).
  return 1 - bounded
}

// Phase 84 / ISSUE-044 — supplier reliability translates to a daily
// missed-delivery probability. A 90-reliability supplier never misses
// (probability 0); a 40-reliability supplier misses 10% of attempts;
// a 20-reliability supplier misses 20%. The simulation uses a named
// RNG stream so a missed delivery is deterministic per (seed, day,
// supplier, stock) tuple.
export function getMissedDeliveryProbability(
  supplier: SupplierWorldState,
): number {
  const raw = (60 - supplier.reliability) * 0.005
  return Math.max(0, Math.min(0.5, raw))
}

// Phase 94 / ISSUE-054 — Best-supplier pick for the restock action.
// Walks every supplier providing `stockId`, scores them by effective
// price first (cheaper wins), reliability as tie-break. Returns the
// chosen supplier plus its effective unit price so the action can
// emit a cause that records both the cost and the chosen partner.
// Falls back to `undefined` when no supplier exists; the caller is
// responsible for using the raw `stock.basePrice` in that case.
export type RestockSupplierPick = {
  supplier: SupplierWorldState
  effectivePrice: number
}

export function pickRestockSupplier(
  state: TavernState,
  stockId: string,
): RestockSupplierPick | undefined {
  const stock = state.stock[stockId]
  if (!stock) return undefined
  const moduleState = getSupplierModuleState(state)
  const supplierTermsFactor = getEconomyModuleState(state).modifiers.supplierTermsFactor
  const activeConditions = moduleState.activeMarketConditions
  let best: RestockSupplierPick | undefined
  for (const supplier of Object.values(state.world.suppliers)) {
    if (!supplier.goodsProvided.includes(stockId)) continue
    // `getEffectiveBasePrice` already applies the MIN_UNIT_PRICE floor
    // (Phase 200 / audit Wave 1); the old `Math.max(0, …)` here was what
    // let a zero price through as a legitimate "cheapest" pick.
    const effectivePrice = Math.max(
      MIN_UNIT_PRICE,
      getEffectiveBasePrice(stock, supplier, activeConditions) * supplierTermsFactor,
    )
    if (!best) {
      best = { supplier, effectivePrice }
      continue
    }
    if (effectivePrice < best.effectivePrice) {
      best = { supplier, effectivePrice }
      continue
    }
    if (
      effectivePrice === best.effectivePrice &&
      supplier.reliability > best.supplier.reliability
    ) {
      best = { supplier, effectivePrice }
    }
  }
  return best
}
