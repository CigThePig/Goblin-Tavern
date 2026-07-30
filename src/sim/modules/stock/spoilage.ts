import type { SimContext } from '../../core/context'
import type {
  AreaState,
  StockRarity,
  StockState,
  TavernState,
} from '../../state/TavernState'

import { clampPercent } from '../../state/normalize'
import { areaRegistry } from '../../registries/areaRegistry'
import { getUsableCapacity } from '../areas/capacity'
import { applyRenownDrift } from '../service/renown'
import {
  getRule,
  scaleOngoingContinuous,
} from '../../contracts/ruleset/index'

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

// Phase 73 / ISSUE-033 §5.7 — Area `spoilageModifier` reduces (or
// expands) the daily spoilage delta for stored items of the listed
// rarities. The cold_cellar uses this to halve spoilage on
// rare/legendary ingredients.
function areaSpoilageModifier(
  storageAreaId: string | undefined,
  rarity: StockRarity,
): number {
  if (!storageAreaId) return 1
  if (!areaRegistry.has(storageAreaId)) return 1
  const def = areaRegistry.get(storageAreaId)
  if (!def.spoilageModifier) return 1
  if (rarity === 'common') return 1
  if (!def.spoilageModifier.appliesToRarities.includes(rarity)) return 1
  return def.spoilageModifier.multiplier
}

/**
 * Expansion Phase 2 §2.1 — the storage-capacity consumer.
 *
 * `storage` capacity has to mean something or it is a number in a report. An
 * overstuffed store keeps badly: crates jammed against each other, nothing
 * turned, no air. So stock held in an area beyond its USABLE storage — base
 * size plus its installed fittings, minus whatever a live build has closed off
 * — spoils faster, in proportion to how far over it is.
 *
 * This is what makes `rat_proof_barrels` (+6) and `cold_stone_shelves` (+8)
 * worth building, and what makes a cellar build's blockage cost something
 * while it runs.
 */
function overstuffedStorageMultiplier(
  state: TavernState,
  storageAreaId: string | undefined,
): number {
  if (!storageAreaId) return 1
  const area = state.areas[storageAreaId]
  if (!area) return 1
  const usable = getUsableCapacity(area, 'storage')
  if (usable <= 0) return 1
  let held = 0
  for (const item of Object.values(state.stock)) {
    if (item.storageAreaId !== storageAreaId) continue
    held += item.quantity
  }
  // One storage slot holds ten units — the same abstraction the capacity
  // numbers were picked against (a 24-slot cellar holds ~240 units).
  const slotsUsed = held / 10
  if (slotsUsed <= usable) return 1
  const over = (slotsUsed - usable) / usable
  return 1 + Math.min(1, over)
}

// Phase 67 / ISSUE-027 §6.6 — Spoilage-driven renown drift threshold.
// A rare-tier+ item that crosses the saturated-spoilage threshold this
// day is considered "spoiled unsold" and shaves a small amount off
// `culinary_renown` with a `rare_ingredient_spoiled` memory write.
const RARE_SPOILAGE_THRESHOLD = 80

function shouldEmitRareSpoilage(
  rarity: StockRarity,
  beforeSpoilage: number,
  afterSpoilage: number,
): boolean {
  if (rarity !== 'rare' && rarity !== 'legendary') return false
  if (beforeSpoilage >= RARE_SPOILAGE_THRESHOLD) return false
  return afterSpoilage >= RARE_SPOILAGE_THRESHOLD
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
    // Phase 73 / ISSUE-033 §5.7 — area-level spoilage modifier (e.g.
    // cold_cellar halves rare/legendary spoilage).
    const areaModifier = areaSpoilageModifier(
      item.storageAreaId,
      item.rarity,
    )
    // Expansion Phase 1 §1.3 — the ruleset's ongoing spoilage knob. Spoilage
    // is already a continuous quantity, so no fractional banking is needed:
    // the multiplier survives in the value itself. `standard` is exactly 1.
    // Expansion Phase 2 §2.1 — an over-capacity store keeps badly.
    const crowdedStore = overstuffedStorageMultiplier(
      ctx.state,
      item.storageAreaId,
    )
    const delta = scaleOngoingContinuous(
      (baseDelta + extra) * multiplier * rarityFactor * areaModifier * crowdedStore,
      getRule(ctx.state, 'spoilageMultiplier'),
    )

    const beforeSpoilage = item.spoilage
    const nextSpoilage = clampPercent(beforeSpoilage + delta)
    if (nextSpoilage !== beforeSpoilage) {
      ctx.modifyStock(
        item.id,
        { spoilage: nextSpoilage },
        { source: 'stock', reason: 'daily_spoilage' },
      )

      if (shouldEmitRareSpoilage(item.rarity, beforeSpoilage, nextSpoilage)) {
        // Phase 67 / ISSUE-027 §6.6 — record the spoiled-rare event
        // and apply a negative renown drift. Magnitude differs by
        // rarity: legendary spoilage stings harder.
        const drop = item.rarity === 'legendary' ? -3 : -2
        const relatedActors = [
          { kind: 'stock' as const, id: item.id },
        ]
        const relatedLocations = item.storageAreaId
          ? [{ kind: 'area' as const, id: item.storageAreaId }]
          : []
        ctx.addMemory({
          id: 'rare_ingredient_spoiled',
          source: 'stock.spoilage',
          actors: relatedActors,
          locations: relatedLocations,
          tags: ['stock', 'spoilage', item.rarity, item.id],
          metadata: {
            ingredientId: item.id,
            rarity: item.rarity,
            spoilage: nextSpoilage,
          },
        })
        applyRenownDrift(ctx, drop, {
          source: 'stock.renown_decay',
          readable: `${item.label} spoiled unsold — culinary renown took a hit.`,
          tags: ['renown', 'stock_spoilage', item.rarity, item.id],
          relatedActors,
          relatedLocations,
        })
      }
    }
  }
}
