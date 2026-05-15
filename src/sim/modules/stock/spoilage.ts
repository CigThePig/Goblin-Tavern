import type { SimContext } from '../../core/context'
import type { AreaState, StockRarity, StockState } from '../../state/TavernState'

import { clampPercent } from '../../state/normalize'

// Phase 9 §9.5 — Spoilage.
//
// Perishable items gain spoilage every day. Storage area cleanliness and
// condition modulate the rate: a filthy or low-condition cellar spoils
// mushrooms faster than a clean one. Numbers are intentionally small —
// Phase 9 is about believable movement, not balance (mirrors the §8.3
// "intentionally imperfect" note).
//
// `effectiveQuality(stock) = quality - spoilage * 0.5`, per Phase 9 §9.5.
//
// Phase 66 / ISSUE-026 §4.1 — Rarity tiers carry a base spoilage
// multiplier so rare and legendary ingredients decay roughly twice as
// fast as common ones. The cold-cellar storage area introduced in
// phase 73 (ISSUE-033) will halve this rate via a per-area
// spoilageModifier.

export const PERISHABLE_TAG = 'perishable'

export function isPerishable(item: StockState): boolean {
  return item.tags.includes(PERISHABLE_TAG)
}

export function effectiveQuality(item: StockState): number {
  return Math.max(0, item.quality - item.spoilage * 0.5)
}

export function rarityMultiplier(rarity: StockRarity): number {
  switch (rarity) {
    case 'common':
      return 1
    case 'uncommon':
      return 1.5
    case 'rare':
      return 2
    case 'legendary':
      return 2.5
  }
}

function storageMultiplier(area: AreaState | undefined): number {
  if (!area) return 1
  // Below ~40 cleanliness, spoilage accelerates; above ~70 it slows.
  let multiplier = 1
  if (area.cleanliness < 40) {
    multiplier += (40 - area.cleanliness) / 40 // up to +1.0
  } else if (area.cleanliness > 70) {
    multiplier -= (area.cleanliness - 70) / 100 // up to -0.3
  }
  if (area.condition < 40) {
    multiplier += (40 - area.condition) / 80 // up to +0.5
  }
  return Math.max(0.25, multiplier)
}

export function applyDailySpoilage(ctx: SimContext): void {
  for (const item of Object.values(ctx.state.stock)) {
    if (!isPerishable(item)) continue
    // Phase 66 / ISSUE-026 — skip zero-quantity stock so the daily
    // spoilage pass doesn't emit causes for ingredient types that
    // exist in the registry but the tavern doesn't currently hold.
    if (item.quantity <= 0) continue
    const storage = item.storageAreaId ? ctx.state.areas[item.storageAreaId] : undefined
    const multiplier = storageMultiplier(storage)
    const rarityFactor = rarityMultiplier(item.rarity)

    // Base daily spoilage gain for any perishable. Slight randomness keeps
    // runs interesting without making the test seed-fragile (chance below).
    const baseDelta = 1
    const extra = ctx.rng.chance(0.5) ? 1 : 0
    const delta = (baseDelta + extra) * multiplier * rarityFactor

    const nextSpoilage = clampPercent(item.spoilage + delta)
    if (nextSpoilage !== item.spoilage) {
      ctx.modifyStock(
        item.id,
        { spoilage: nextSpoilage },
        { source: 'stock', reason: 'daily_spoilage' },
      )
    }
  }
}
