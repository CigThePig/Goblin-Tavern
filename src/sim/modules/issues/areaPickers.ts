// Phase 95 / ISSUE-055 — Shared area pickers for issue-seed generators.
//
// Phase 73 promoted a single `pickCustomerFacingArea` helper to
// un-pin `main_room` for customer-facing seeds. This file promotes
// the helper out of `issueSeedGenerators.ts` and adds sibling helpers
// for kitchen-adjacent and repairable contexts. The selection is
// deterministic (day-index + family-name hash) so seed rotation stays
// reproducible while new tagged areas get rotation time.
//
// Each picker:
//   - filters `state.areas` by the tags appropriate for its context,
//   - rotates by `(familyHash + totalDaysElapsed) % candidates.length`,
//   - falls back to `main_room` when no candidate qualifies.

import type { SimContext } from '../../core/context'
import type { EntityRef } from '../../state/TavernState'
import { areaRef } from './generatorHelpers'

function familyHash(family: string): number {
  let h = 0
  for (let i = 0; i < family.length; i += 1) {
    h = (h * 31 + family.charCodeAt(i)) >>> 0
  }
  return h
}

function pickByTag(
  ctx: SimContext,
  family: string,
  tag: string,
  fallback = 'main_room',
): EntityRef {
  const candidates = Object.values(ctx.state.areas)
    .filter((a) => a.tags.includes(tag))
    .map((a) => a.id)
    .sort()
  if (candidates.length === 0) return areaRef(fallback)
  const today = ctx.state.calendar.totalDaysElapsed
  const idx = (familyHash(family) + today) % candidates.length
  return areaRef(candidates[idx]!)
}

export function pickCustomerFacingArea(
  ctx: SimContext,
  family: string,
): EntityRef {
  return pickByTag(ctx, family, 'customer_facing')
}

// Kitchen-adjacent: kitchen + herb_garden + any area tagged
// `food`/`kitchen_adjacent`. Used by seeds whose narrative anchor is
// food production (food safety, supply, prep) rather than the public
// taproom. Falls back to `kitchen` rather than `main_room` because
// food-themed seeds should never resolve through the taproom.
export function pickKitchenAdjacentArea(
  ctx: SimContext,
  family: string,
): EntityRef {
  const candidates = Object.values(ctx.state.areas)
    .filter(
      (a) =>
        a.tags.includes('kitchen_adjacent') ||
        a.tags.includes('food') ||
        a.id === 'kitchen',
    )
    .map((a) => a.id)
    .sort()
  if (candidates.length === 0) return areaRef('kitchen')
  const today = ctx.state.calendar.totalDaysElapsed
  const idx = (familyHash(family) + today) % candidates.length
  return areaRef(candidates[idx]!)
}

// Repairable: prefers areas with non-zero damage when any qualify;
// otherwise falls back to inspection-relevant / structure-tagged areas
// in rotation. Used for damage/repair seeds where the player should
// see different areas across the 28-day rotation window.
export function pickRepairableArea(
  ctx: SimContext,
  family: string,
): EntityRef {
  const damaged = Object.values(ctx.state.areas)
    .filter((a) => a.damage > 0)
    .sort((a, b) => b.damage - a.damage)
    .map((a) => a.id)
  if (damaged.length > 0) {
    const today = ctx.state.calendar.totalDaysElapsed
    const idx = (familyHash(family) + today) % damaged.length
    return areaRef(damaged[idx]!)
  }
  const fallback = Object.values(ctx.state.areas)
    .filter(
      (a) =>
        a.tags.includes('inspection_relevant') ||
        a.tags.includes('structure'),
    )
    .map((a) => a.id)
    .sort()
  if (fallback.length === 0) return areaRef('main_room')
  const today = ctx.state.calendar.totalDaysElapsed
  const idx = (familyHash(family) + today) % fallback.length
  return areaRef(fallback[idx]!)
}
