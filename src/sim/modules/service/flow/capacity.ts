import type { SimContext } from '../../../core/context'
import type { TavernState } from '../../../state/TavernState'
import {
  getCustomerFacingSeating,
  getKitchenThroughputFactor,
} from '../../areas/capacity'
import type { StaffModuleState } from '../../staff/types'
import type {
  StaffRosterEntry,
  StaffWorkKind,
} from '../../staff/workforceTypes'

import { SERVICE_WAVES, type ServiceCapacitySnapshot } from './types'

// Expansion Phase 4 §4.1 — what the tavern can physically do per wave.
//
// Every number here is DERIVED from records another domain already owns:
// seats from the areas module's usable capacity, prep/delivery/reset from the
// staff module's roster rows. Nothing is stored, and nothing is invented — the
// same rule §2.1 applied to seating, applied to throughput.
//
// The three per-wave ceilings all take the same shape:
//
//     base × (floor + (1 − floor) × rosterContribution) × speed
//
// `floor` is what happens with NOBODY on that work — the owner is in the
// building, so a kitchen with no cook still gets a few plates out, badly. Making
// it zero would mean a single illness closed the tavern, which is a cliff rather
// than a consequence. The reference route's default crew (one cook on `speed`,
// one server on `keep_customers_happy`, one cleaner on `clean`) scores exactly
// 1 on all three, so a tavern that has changed nothing runs at the base rate.
//
// CALIBRATION. The bases are set so an ordinary evening on the reference route
// is never the binding constraint: ~95 patrons ordering ~2 servings each is
// ~190 servings against 360 of prep and 360 of delivery, in a room seating 110.
// Capacity binds when the PLAYER loses a role, blocks a room, lets the kitchen
// rot, or grows patronage past the room — which is §4.1's whole point. Losing
// the cook takes the kitchen to 126 servings a night against the same demand,
// which is a bottleneck the player caused and can undo.

/** Servings a fully-staffed kitchen puts out in one wave. */
export const BASE_PREP_PER_WAVE = 60
/** Servings a fully-staffed floor gets to tables in one wave. */
export const BASE_DELIVERY_PER_WAVE = 60
/** Seats a full cleaning effort turns round in one wave. */
export const BASE_RESET_PER_WAVE = 24

/** What each stage still manages with nobody assigned to it. */
const PREP_FLOOR = 0.35
const DELIVERY_FLOOR = 0.3
const RESET_FLOOR = 0.25

/** How far the crew's published `serviceSpeed` can move a per-wave ceiling. */
const SPEED_SWING = 0.15

function readRoster(state: TavernState): ReadonlyArray<StaffRosterEntry> {
  const slice = state.modules['staff'] as StaffModuleState | undefined
  return slice?.roster ?? []
}

/** Summed `contribution` of everybody actually doing this kind of work today. */
export function rosterContribution(
  state: TavernState,
  kind: StaffWorkKind,
): number {
  let total = 0
  for (const row of readRoster(state)) {
    if (row.workKind !== kind) continue
    if (!row.available) continue
    total += row.contribution
  }
  return Math.round(total * 100) / 100
}

function stageFactor(contribution: number, floor: number): number {
  // Capped at 2 so a crowded rota cannot produce unbounded throughput; the
  // roster's own `contribution` is already capped at 2 per person.
  const scaled = floor + (1 - floor) * contribution
  return Math.max(floor, Math.min(2, Math.round(scaled * 100) / 100))
}

function speedFactor(state: TavernState): number {
  const slice = state.modules['staff'] as StaffModuleState | undefined
  const speed = slice?.serviceQuality?.serviceSpeed ?? 0
  const bounded = Math.max(-1, Math.min(1, speed))
  return 1 + bounded * SPEED_SWING
}

/**
 * Today's per-stage ceilings.
 *
 * Pure: it reads state and returns numbers. The wave loop never recomputes
 * capacity mid-evening, so a party seated in wave 1 and a party seated in wave 5
 * are competing for the same declared resources.
 */
export function readServiceCapacity(ctx: SimContext): ServiceCapacitySnapshot {
  const state = ctx.state
  const seating = getCustomerFacingSeating(state)
  const kitchenThroughput = getKitchenThroughputFactor(state)
  const speed = speedFactor(state)

  const kitchen = rosterContribution(state, 'kitchen')
  const service = rosterContribution(state, 'service')
  const cleaning = rosterContribution(state, 'cleaning')
  const security = rosterContribution(state, 'security')

  const prepPerWave = Math.max(
    1,
    Math.round(
      BASE_PREP_PER_WAVE * stageFactor(kitchen, PREP_FLOOR) * kitchenThroughput * speed,
    ),
  )
  const deliveryPerWave = Math.max(
    1,
    Math.round(BASE_DELIVERY_PER_WAVE * stageFactor(service, DELIVERY_FLOOR) * speed),
  )
  const resetPerWave = Math.max(
    1,
    Math.round(BASE_RESET_PER_WAVE * stageFactor(cleaning, RESET_FLOOR)),
  )

  return {
    seats: seating.usableSeats,
    seatsByArea: seating.byArea
      .filter((row) => row.usableSeats > 0)
      .map((row) => ({ areaId: row.areaId, seats: row.usableSeats })),
    prepPerWave,
    deliveryPerWave,
    resetPerWave,
    securityCover: security,
    drivers: {
      kitchen,
      service,
      cleaning,
      security,
      kitchenThroughput,
    },
  }
}

/** Servings the kitchen could produce across the whole evening. */
export function dailyPrepCeiling(capacity: ServiceCapacitySnapshot): number {
  return capacity.prepPerWave * SERVICE_WAVES
}

/**
 * Phase 12 §12.3's `stretch_ingredients` rule, moved rather than dropped.
 *
 * A cook told to make the stores last serves smaller portions, so the same
 * crowd consumes less. It used to scale a fixed basket in
 * `customers/purchases.ts`; the basket is gone, so it scales the servings a
 * party's order turns into. Same rule, same magnitudes, applied one layer
 * further in — which is where the servings are now decided.
 */
export function cookStretchFactor(state: TavernState): number {
  let cook: { currentPriority?: string; skill: number; morale: number; stress: number; fatigue: number } | undefined
  for (const member of Object.values(state.staff)) {
    if (member.role === 'cook') {
      cook = member
      break
    }
  }
  if (!cook) return 1
  if (cook.currentPriority !== 'stretch_ingredients') return 1
  const effectiveness = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        cook.skill +
          Math.round(cook.morale * 0.2) -
          Math.round(cook.stress * 0.25) -
          Math.round(cook.fatigue * 0.25),
      ),
    ),
  )
  // ~20% reduction at average effectiveness; ~35% at very high; floor 50%.
  const reduction = 0.2 + 0.15 * (effectiveness / 100)
  return Math.max(0.5, 1 - reduction)
}
