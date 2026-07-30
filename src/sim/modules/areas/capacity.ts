import type { AreaState, TavernState } from '../../state/TavernState'
import { areaRegistry } from '../../registries/areaRegistry'
import {
  AREA_CAPACITY_KINDS,
  addCapacity,
  capacityOf,
  type AreaCapacity,
  type AreaCapacityKind,
} from '../../registries/areaCapacityTypes'
import { getAreaUpgradeDefinition } from '../../content/tavern/areaUpgradeRegistry'

// Expansion Phase 2 §2.1 / §2.3 — usable capacity, derived.
//
// Capacity is NOT stored on `AreaState`. It is computed from three facts
// that already live in state or the registry:
//
//   base        the room's own size, from `areaRegistry`
//   installed   what the fittings in `AreaState.upgrades` add
//   blocked     what is unusable right now, because a build is standing in
//               the middle of it or the room itself is falling apart
//
// Deriving it is the point, not a shortcut. A stored `usableSeats` field
// would be a second representation of the same truth that could disagree
// with the upgrade records — the exact duplication §2.2 forbids for
// upgrades, applied to the number they produce.

/**
 * Patrons one working privy stall can serve across an evening.
 *
 * Shared by the propagation edge (which puts the smell up) and the customer
 * satisfaction signal (which makes them mind), so the two can never disagree
 * about when the privy is short. Calibrated so an ordinary evening on the
 * reference route needs no more stalls than the privy has, and a payday crowd
 * does — which is what gives `stone_drainage` (+2 usable stalls) a purpose.
 */
export const PATRONS_PER_PRIVY_STALL = 60

/** The room's own size before any fitting. */
export function getBaseAreaCapacity(areaId: string): AreaCapacity {
  if (!areaRegistry.has(areaId)) return {}
  return areaRegistry.get(areaId).capacity ?? {}
}

/**
 * Base plus every installed fitting's contribution.
 *
 * A `damaged` or `disabled` fitting contributes nothing: broken shelving
 * holds no barrels. That is what makes the damage → repair loop matter to
 * something other than a meter.
 */
export function getInstalledAreaCapacity(area: AreaState): AreaCapacity {
  let total = getBaseAreaCapacity(area.id)
  for (const upgrade of Object.values(area.upgrades)) {
    if (upgrade.status !== 'installed') continue
    const def = getAreaUpgradeDefinition(upgrade.id)
    if (!def?.capacityEffects) continue
    total = addCapacity(total, def.capacityEffects)
  }
  return total
}

/**
 * The share of the area's capacity that is unusable today, 0–1.
 *
 * Two independent causes, both physical:
 *
 *   construction  a live build takes floor. Blockage from concurrent builds
 *                 adds, because two half-finished jobs really do take more
 *                 room than one — but it is capped below 1 so a room is
 *                 never entirely unreachable by construction alone.
 *   dereliction   a room in genuinely bad condition cannot be used to its
 *                 nominal size. Only bites below 35 condition, which is the
 *                 same cut-point `isAreaDamaged` already uses, so "damaged"
 *                 means one thing across the codebase.
 */
export function getAreaBlockedFraction(area: AreaState): number {
  let construction = 0
  for (const upgrade of Object.values(area.upgrades)) {
    if (upgrade.status !== 'in_progress') continue
    const def = getAreaUpgradeDefinition(upgrade.id)
    construction += def?.blocksCapacityWhileBuilding ?? 0
  }
  construction = Math.min(0.75, construction)

  const dereliction = area.condition < 35 ? (35 - area.condition) / 100 : 0

  return Math.min(0.9, construction + dereliction)
}

/** What the area can actually be used for today, after blockage. */
export function getUsableAreaCapacity(area: AreaState): AreaCapacity {
  const installed = getInstalledAreaCapacity(area)
  const blocked = getAreaBlockedFraction(area)
  if (blocked <= 0) return installed
  const usable: AreaCapacity = {}
  for (const kind of AREA_CAPACITY_KINDS) {
    const total = capacityOf(installed, kind)
    if (total === 0) continue
    // Floor, so a partially blocked room loses the fractional place rather
    // than rounding it back into service.
    usable[kind] = Math.max(0, Math.floor(total * (1 - blocked)))
  }
  return usable
}

/** One kind, after blockage. The common read. */
export function getUsableCapacity(
  area: AreaState,
  kind: AreaCapacityKind,
): number {
  return capacityOf(getUsableAreaCapacity(area), kind)
}

/**
 * Tavern-wide usable seating: every customer-facing area pooled.
 *
 * The pool is what patrons experience — nobody stands in the main room while
 * the booths sit empty — and it is why `private_booths` and `stage_corner`
 * matter to crowding at all (§2.4, "seating layout affecting … service
 * throughput").
 */
export function getCustomerFacingSeating(state: TavernState): {
  seats: number
  usableSeats: number
  blockedSeats: number
  byArea: Array<{ areaId: string; seats: number; usableSeats: number }>
} {
  let seats = 0
  let usableSeats = 0
  const byArea: Array<{ areaId: string; seats: number; usableSeats: number }> = []
  for (const area of Object.values(state.areas)) {
    if (!area.tags.includes('customer_facing')) continue
    const total = capacityOf(getInstalledAreaCapacity(area), 'seats')
    if (total === 0) continue
    const usable = getUsableCapacity(area, 'seats')
    seats += total
    usableSeats += usable
    byArea.push({ areaId: area.id, seats: total, usableSeats: usable })
  }
  byArea.sort((a, b) => a.areaId.localeCompare(b.areaId))
  return { seats, usableSeats, blockedSeats: seats - usableSeats, byArea }
}

/**
 * Workstations across the tavern that construction may claim.
 *
 * §2.3's concurrent-work limit is physical rather than arbitrary: a crew can
 * only run as many sites as it has places to work from. Areas under
 * construction still count their own workstations — you build the bench
 * standing where the bench will go.
 */
export function getTotalUsableWorkstations(state: TavernState): number {
  let total = 0
  for (const area of Object.values(state.areas)) {
    total += getUsableCapacity(area, 'workstations')
  }
  return total
}
