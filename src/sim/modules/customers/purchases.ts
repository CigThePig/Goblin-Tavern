import type { SimContext } from '../../core/context'
import type { CustomerGroupState, StockState } from '../../state/TavernState'

import { sellStockItem } from '../stock/sales'
import type { ShortageRecord } from '../stock/types'
import type { ServiceQualityModifiers } from '../staff/types'

// Phase 10 §10.4 / Phase 12 §12.3 — Customer purchase behaviour.
//
// Each visitor buys a small basket of preferred items via the Phase 9
// `sellStockItem` helper, which is the only sanctioned path to mutate
// stock and coin (Phase 9 §9.4 forward note: "Do not introduce a parallel
// sale path that writes to stock or coin without going through these
// helpers"). Shortages bubble up through the returned `SellResult` and
// are surfaced in the group's per-day turnout.
//
// Phase 12 §12.3 adds two optional knobs:
//   - `serviceQuality`: when present, `serviceSpeed` slightly boosts
//     per-visitor consumption (faster service → more rounds).
//   - `stretchFactor`: cook `stretch_ingredients` priority reduces
//     per-visitor consumption (≤ 1). Phase 12 §"Tests" guarantees
//     this knob exists ("cook stretch_ingredients reduces stock use").

export type GroupPurchaseResult = {
  coinEarned: number
  shortages: ShortageRecord[]
  itemsBought: Array<{ stockId: string; quantity: number }>
}

export type ResolvePurchaseOptions = {
  serviceQuality?: ServiceQualityModifiers
  /** Per-visitor consumption multiplier in (0, 1]; defaults to 1. */
  stretchFactor?: number
}

// Per-visitor purchase intent. Local goblins want cheap ale and stew,
// merchants prefer quality items, ogres drink ale heavily, etc. Items
// listed here are tried in order; only those matching `preferredStockTags`
// or carrying no preference filter are attempted.
const DEFAULT_BASKET: Record<string, string[]> = {
  local_goblins: ['ale', 'stew', 'mushrooms'],
  miners: ['ale', 'ale', 'stew'],
  merchants: ['stew', 'ale'],
  ogres: ['ale', 'ale', 'stew'],
  adventurers: ['ale', 'stew'],
}

function basketFor(groupId: string): string[] {
  return DEFAULT_BASKET[groupId] ?? ['ale', 'stew']
}

function itemMatchesPreferences(
  item: StockState | undefined,
  group: CustomerGroupState,
): boolean {
  if (!item) return false
  if (group.dislikedTags.some((tag) => item.tags.includes(tag))) return false
  if (group.preferredStockTags.length === 0) return true
  return group.preferredStockTags.some((tag) => item.tags.includes(tag))
}

export function resolveGroupPurchases(
  ctx: SimContext,
  group: CustomerGroupState,
  visitors: number,
  options: ResolvePurchaseOptions = {},
): GroupPurchaseResult {
  const result: GroupPurchaseResult = {
    coinEarned: 0,
    shortages: [],
    itemsBought: [],
  }
  if (visitors <= 0) return result

  const basket = basketFor(group.id)
  const seenShortageStockIds = new Set<string>()

  const quality = options.serviceQuality
  const stretchFactor = Math.max(0.5, options.stretchFactor ?? 1)
  // Phase 12 §12.3 — `serviceSpeed` slightly boosts per-visitor
  // consumption (faster service → more rounds), capped so a single
  // boosted day cannot drain a week's worth of stock.
  const speedBoost = quality
    ? Math.max(0, Math.min(0.5, quality.serviceSpeed / 4))
    : 0

  for (const stockId of basket) {
    const item = ctx.state.stock[stockId]
    if (!itemMatchesPreferences(item, group)) continue

    // Each visitor buys 1 of this item if available. Bigger spenders
    // (high wealth + low price sensitivity) buy slightly more.
    const spendBoost = group.wealth >= 70 && group.priceSensitivity <= 40 ? 1 : 0
    const perVisitorBase = 1 + spendBoost + speedBoost
    const perVisitor = perVisitorBase * stretchFactor
    const quantity = Math.max(0, Math.round(visitors * perVisitor))
    if (quantity <= 0) continue

    const sale = sellStockItem(ctx, stockId, quantity, {
      buyerGroupId: group.id,
      source: `customers.${group.id}.${stockId}`,
    })
    result.coinEarned += sale.earned
    if (sale.sold > 0) {
      result.itemsBought.push({ stockId, quantity: sale.sold })
    }
    if (sale.shortage && !seenShortageStockIds.has(sale.shortage.stockId)) {
      result.shortages.push(sale.shortage)
      seenShortageStockIds.add(sale.shortage.stockId)
    }
  }

  return result
}
