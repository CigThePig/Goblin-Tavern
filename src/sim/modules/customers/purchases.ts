import type { SimContext } from '../../core/context'
import type { CustomerGroupState, RecipeState } from '../../state/TavernState'

import { recipeRegistry } from '../../registries/recipeRegistry'
import { sellRecipe } from '../service/recipes'
import type { ShortageRecord } from '../stock/types'
import type { ServiceQualityModifiers } from '../staff/types'

// Phase 10 §10.4 / Phase 12 §12.3 — Customer purchase behaviour.
//
// Each visitor buys a small basket of preferred dishes. Phase 65 /
// ISSUE-025 §6.1 routes the basket through recipes: each basket entry
// is a recipe id, `sellRecipe` consumes the recipe's `inputs` from
// stock via the Phase 9 ledger helpers, and the recipe state's
// per-day counters update so downstream calculators can see what was
// served. Shortages bubble up through the recipe sale and surface in
// the group's per-day turnout.
//
// For the six 1:1 starter recipes shipped in Phase 65, observable
// state mutations are identical to the prior direct `sellStockItem`
// flow — each `dish_<stockId>` consumes 1 unit of `<stockId>` per
// serving at the underlying stock's salePrice.
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

// Phase 188 — starter fairness. A visitor's basket is intent, not a
// guarantee that every patron buys every listed recipe. Scaling the basket
// keeps first-week stock pressure meaningful without draining all inherited
// ale/stew before the player gets a fair response window.
const STARTER_BASKET_FULFILLMENT = 0.5

// Per-visitor purchase intent expressed as recipe ids. The six starter
// recipes (`dish_ale`, `dish_stew`, `dish_mushrooms`) are 1:1 wrappers
// around the same stock items the pre-recipe basket used, so behaviour
// is preserved.
const DEFAULT_BASKET: Record<string, string[]> = {
  local_goblins: ['dish_ale', 'dish_stew', 'dish_mushrooms'],
  miners: ['dish_ale', 'dish_ale', 'dish_stew'],
  merchants: ['dish_stew', 'dish_ale'],
  ogres: ['dish_ale', 'dish_ale', 'dish_stew'],
  adventurers: ['dish_ale', 'dish_stew'],
}

function basketFor(groupId: string): string[] {
  return DEFAULT_BASKET[groupId] ?? ['dish_ale', 'dish_stew']
}

function recipeMatchesPreferences(
  recipe: RecipeState | undefined,
  group: CustomerGroupState,
): boolean {
  if (!recipe) return false
  if (group.dislikedTags.some((tag) => recipe.tags.includes(tag))) return false
  if (group.preferredStockTags.length === 0) return true
  return group.preferredStockTags.some((tag) => recipe.tags.includes(tag))
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

  for (const recipeId of basket) {
    const recipe = ctx.state.recipes[recipeId]
    if (!recipeMatchesPreferences(recipe, group)) continue
    if (!recipe?.onMenu) continue
    if (!recipeRegistry.has(recipeId)) continue

    // Each visitor buys 1 serving if all inputs are available. Bigger
    // spenders (high wealth + low price sensitivity) buy slightly more.
    const spendBoost = group.wealth >= 70 && group.priceSensitivity <= 40 ? 1 : 0
    const perVisitorBase = 1 + spendBoost + speedBoost
    const perVisitor = perVisitorBase * stretchFactor * STARTER_BASKET_FULFILLMENT
    const servings = Math.max(0, Math.round(visitors * perVisitor))
    if (servings <= 0) continue

    const sale = sellRecipe(ctx, recipeId, servings, {
      buyerGroupId: group.id,
      source: `customers.${group.id}.${recipeId}`,
    })
    result.coinEarned += sale.earned
    for (const consumed of sale.itemsConsumed) {
      result.itemsBought.push(consumed)
    }
    for (const shortage of sale.shortages) {
      if (!seenShortageStockIds.has(shortage.stockId)) {
        result.shortages.push(shortage)
        seenShortageStockIds.add(shortage.stockId)
      }
    }
  }

  return result
}
