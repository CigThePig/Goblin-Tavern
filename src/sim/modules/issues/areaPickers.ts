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

/** How bad a room is, as a customer would experience it. */
function complaintScore(area: {
  cleanliness?: number
  mess?: number
  damage?: number
  smell?: number
}): number {
  return (
    100 -
    (area.cleanliness ?? 50) +
    (area.mess ?? 0) +
    (area.damage ?? 0) +
    (area.smell ?? 0)
  )
}

/**
 * Phase 201 / audit Wave 2 (`P5-PLAY-004`) — the room a complaint is
 * actually about.
 *
 * `pickCustomerFacingArea` rotates by day so every room gets narrative
 * time (Phase 95 / ISSUE-055), which is right for flavour but wrong as
 * the anchor for a complaint the player can pay to fix: the audit's Fix
 * Root spent 10 coin cleaning the Private Booth while the Main Room the
 * card cited fell 18 → 0 the same day. The repair, the evidence and the
 * card have to name one room, and that room has to be a room with a
 * problem.
 *
 * So: the worst customer-facing room wins. Rotation survives as the
 * tie-break among rooms that are equally bad, and as the whole answer
 * when no room stands out — a complaint about nothing in particular can
 * anchor anywhere.
 */
export function pickComplaintArea(ctx: SimContext, family: string): EntityRef {
  const candidates = Object.values(ctx.state.areas).filter((a) =>
    a.tags.includes('customer_facing'),
  )
  if (candidates.length === 0) return pickCustomerFacingArea(ctx, family)

  let worst = candidates[0]!
  let worstScore = complaintScore(worst)
  for (const area of candidates.slice(1)) {
    const score = complaintScore(area)
    if (score > worstScore) {
      worstScore = score
      worst = area
    }
  }

  // Nothing is meaningfully wrong anywhere — keep the rotation.
  const rotating = pickCustomerFacingArea(ctx, family)
  const rotatingArea = ctx.state.areas[rotating.id]
  if (rotatingArea && worstScore - complaintScore(rotatingArea) < 15) {
    return rotating
  }
  return areaRef(worst.id)
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

// Repairable: when any area is damaged, prefers the area with the
// highest damage. This matches player expectations — "repair the
// damage" should target what's worst, not rotate. When several areas
// are tied at the top, rotation breaks the tie deterministically so
// content still varies across the 28-day rotation window. With no
// damage anywhere, falls back to inspection-relevant / structure
// areas in rotation.
export function pickRepairableArea(
  ctx: SimContext,
  family: string,
): EntityRef {
  const damaged = Object.values(ctx.state.areas).filter((a) => a.damage > 0)
  if (damaged.length > 0) {
    const maxDamage = Math.max(...damaged.map((a) => a.damage))
    const topTier = damaged
      .filter((a) => a.damage === maxDamage)
      .map((a) => a.id)
      .sort()
    if (topTier.length === 1) return areaRef(topTier[0]!)
    const today = ctx.state.calendar.totalDaysElapsed
    const idx = (familyHash(family) + today) % topTier.length
    return areaRef(topTier[idx]!)
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
