import type { SimContext } from '../../core/context'
import { recipeRegistry } from '../../registries/recipeRegistry'
import type { EntityRef, StockRarity } from '../../state/TavernState'
import { sellStockItem } from '../stock/sales'
import type { ShortageRecord } from '../stock/types'
import { applyRenownDrift } from './renown'

// Phase 67 / ISSUE-027 §6.6 — Renown drift on recipe serves.
//
// Serving an uncommon-tier or higher recipe nudges `culinary_renown`
// upward. The boost scales with the recipe's `demandTier` (the rarer
// the dish, the bigger the fame bump per serving). The increments are
// intentionally small per-serving so the loop accumulates renown
// across a stretch of consistent service rather than a single sale.
const RENOWN_DRIFT_PER_SERVING: Record<StockRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  legendary: 3,
}

// Phase 65 / ISSUE-025 §6.1 — Recipe-based sale helper.
//
// `sellRecipe` is the recipe-layer counterpart to `sellStockItem`.
// Customer baskets resolve to recipe ids; this helper looks up the
// recipe definition, consumes its `inputs` from stock via the existing
// `sellStockItem` path (which keeps the Phase 9 ledger as the single
// sanctioned mutation route), and updates the recipe's runtime state
// (`timesServed`, `lastServedDay`, `daysSinceLastServed`).
//
// For the six 1:1 starter recipes (one input × quantity 1), the
// observable state mutation is identical to the prior direct
// `sellStockItem` call. Phase 71 introduces a cook-skill multiplier on
// served quality; this helper is the integration point for that
// multiplier without rewriting the customers module.

export type SellRecipeResult = {
  /** Servings actually sold (capped by tightest input shortage). */
  sold: number
  /** Coin earned across all servings. */
  earned: number
  /** Aggregated shortages across all inputs. */
  shortages: ShortageRecord[]
  /** Per-stock breakdown of what was consumed. */
  itemsConsumed: Array<{ stockId: string; quantity: number }>
}

export type SellRecipeOptions = {
  buyerGroupId?: string
  source?: string
}

function noopResult(): SellRecipeResult {
  return { sold: 0, earned: 0, shortages: [], itemsConsumed: [] }
}

export function sellRecipe(
  ctx: SimContext,
  recipeId: string,
  servings: number,
  options?: SellRecipeOptions,
): SellRecipeResult {
  if (!Number.isFinite(servings) || servings < 0) {
    throw new Error(
      `sellRecipe: servings must be non-negative, got ${servings}`,
    )
  }
  if (servings === 0) return noopResult()

  const recipeState = ctx.state.recipes[recipeId]
  if (!recipeState) {
    throw new Error(`sellRecipe: unknown recipe id '${recipeId}'`)
  }
  if (!recipeRegistry.has(recipeId)) {
    throw new Error(`sellRecipe: recipe '${recipeId}' has no registry definition`)
  }
  const def = recipeRegistry.get(recipeId)

  // Compute how many servings the tightest input can actually back.
  // Each input contributes `servings * input.quantity` units; we
  // floor the bottleneck so we never half-consume an input.
  let maxServings = servings
  for (const input of def.inputs) {
    const available = ctx.state.stock[input.ingredientId]?.quantity ?? 0
    const capacity = Math.floor(available / input.quantity)
    if (capacity < maxServings) maxServings = capacity
  }
  const sold = Math.max(0, maxServings)

  const result: SellRecipeResult = noopResult()
  const seenShortageStockIds = new Set<string>()

  for (const input of def.inputs) {
    const requested = servings * input.quantity
    const toSell = sold * input.quantity
    if (requested <= 0) continue
    const sellOptions: { buyerGroupId?: string; source: string } = {
      source:
        options?.source ?? `recipe.${recipeId}.input.${input.ingredientId}`,
    }
    if (options?.buyerGroupId !== undefined) {
      sellOptions.buyerGroupId = options.buyerGroupId
    }
    const sale = sellStockItem(ctx, input.ingredientId, requested, sellOptions)
    result.earned += sale.earned
    if (sale.sold > 0) {
      result.itemsConsumed.push({
        stockId: input.ingredientId,
        quantity: sale.sold,
      })
    }
    if (
      sale.shortage &&
      !seenShortageStockIds.has(sale.shortage.stockId)
    ) {
      result.shortages.push(sale.shortage)
      seenShortageStockIds.add(sale.shortage.stockId)
    }
    // Cap warning: if `toSell` exceeded `sale.sold`, an input was
    // tighter than the bottleneck calculation expected (e.g.
    // mid-loop quantity change). The bottleneck floor protects
    // against this in steady state.
    void toSell
  }

  result.sold = sold

  if (sold > 0) {
    const today = ctx.state.calendar.totalDaysElapsed + 1
    const recipeActor: EntityRef = { kind: 'recipe', id: recipeId }
    const buyerActor: EntityRef | null = options?.buyerGroupId
      ? { kind: 'customer_group', id: options.buyerGroupId }
      : null
    const modifyActors: EntityRef[] = buyerActor ? [buyerActor] : []
    ctx.modifyRecipe(
      recipeId,
      {
        timesServed: recipeState.timesServed + sold,
        daysSinceLastServed: 0,
        lastServedDay: today,
      },
      {
        source: 'service.recipes',
        reason: 'recipe_served',
        readable: `${def.label} served ${sold}× to customers`,
        tags: ['recipe', 'service', recipeId],
        relatedActors: modifyActors,
      },
    )

    // Phase 67 / ISSUE-027 §6.6 — uncommon-tier or higher recipe
    // serving nudges culinary renown upward. The drift scales with
    // the recipe's demandTier; common dishes do not contribute.
    const perServing = RENOWN_DRIFT_PER_SERVING[def.demandTier]
    if (perServing > 0) {
      const delta = perServing * sold
      const renownActors: EntityRef[] = [recipeActor]
      if (buyerActor) renownActors.push(buyerActor)
      applyRenownDrift(ctx, delta, {
        source: 'service.renown',
        readable: `Serving ${def.label} (${def.demandTier}) lifted culinary renown by ${delta}.`,
        tags: ['renown', 'service', def.demandTier, recipeId],
        relatedActors: renownActors,
      })
    }
  }

  return result
}
