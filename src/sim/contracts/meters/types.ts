import { z } from 'zod'

// Expansion Phase 1 §1.5 — informative meters.
//
// THE PROBLEM. Almost every meter in this simulation is a `[0, 100]`
// integer, and almost every write clamps. Clamping is right for the number
// the player sees; it is wrong as the only place the number lives, because
// it destroys information the simulation needs:
//
//   - A room neglected for twenty days floors at cleanliness 0 and is then
//     indistinguishable from a room neglected for three. One scrub restores
//     both to the same place, so sustained neglect has no memory and
//     recovery is free.
//   - A pressure whose contributors add up to 130 shows 100, and so does
//     one at 101. The player fixes something, the total drops to 118, and
//     the meter does not move — so the game looks broken precisely when the
//     player is doing the right thing.
//   - Nothing anywhere records how FAST a meter is moving, or how long it
//     has been pinned, so no system can distinguish "bad and getting
//     better" from "bad and getting worse".
//
// THE FIX. Visible meters keep their `[0, 100]` clamp. Alongside them, a
// `MeterDetail` record banks what the clamp threw away: the debt below the
// floor, the excess above the ceiling, a smoothed velocity, and how many
// consecutive days the meter has been pinned. Downstream systems read the
// detail when the answer depends on it; the UI can keep showing one number.

/**
 * A meter's target string, in the same colon convention as cause targets:
 * `area:kitchen.cleanliness`, `pressure:pests`, `reputation:renown`.
 * Using one convention means a meter detail, a cause and a UI drilldown all
 * key off the same string.
 */
export type MeterTarget = string

export type MeterDetail = {
  target: MeterTarget
  /** The clamped value the player sees, as of `lastUpdatedDay`. */
  visible: number
  /**
   * Harm accumulated while the meter was pinned at its FLOOR. Positive.
   * Must be paid down before the visible value can rise again — that is
   * what gives sustained neglect a memory.
   */
  debt: number
  /**
   * Pressure accumulated above the CEILING. Positive. A capped meter with
   * excess is still worsening, and reducing the excess is real progress
   * even though the visible number does not move.
   */
  excess: number
  /**
   * Exponentially smoothed day-over-day change of the UNCLAMPED value.
   * Signed: negative means falling. Smoothed rather than raw so one noisy
   * day does not read as a trend.
   */
  velocity: number
  /**
   * Sustained improvement, banked. Rises while the unclamped value is
   * improving and decays when it is not, so a system can tell a tavern
   * that has been recovering for a week from one that improved once.
   */
  recoveryMomentum: number
  /** Consecutive days pinned at the ceiling. */
  daysAtCeiling: number
  /** Consecutive days pinned at the floor. */
  daysAtFloor: number
  lastUpdatedDay: number
}

export const METERS_MODULE_ID = 'meters'

/**
 * §5.11 bounded growth. One entry per meter that has actually left its
 * comfortable range — a handful of areas and pressures, not one per meter
 * in the game. Entries that settle back to a plain, unpinned, zero-velocity
 * state are pruned, so a healthy tavern carries no detail records at all.
 */
export const MAX_METER_DETAILS = 200

/** How strongly the newest day's change moves the smoothed velocity. */
export const VELOCITY_SMOOTHING = 0.4
/** How much unbanked momentum decays per day when improvement stops. */
export const MOMENTUM_DECAY = 0.25

export type MetersModuleState = {
  details: Record<MeterTarget, MeterDetail>
  /** Hysteresis latches, keyed by decision. See `hysteresis.ts`. */
  latches: Record<string, HysteresisLatch>
}

/**
 * A held decision that resists flapping.
 *
 * §1.5 asks for "hysteresis state for identity and actor decisions". The
 * shape is deliberately generic — an identity band, a faction's stance, a
 * supplier's opinion of the player are all "a categorical choice that
 * should not flip the moment the underlying number crosses a line".
 */
export type HysteresisLatch = {
  key: string
  /** The value currently in force. */
  held: string
  heldSinceDay: number
  /** A different value that has been indicated, and since when. */
  candidate?: string
  candidateSinceDay?: number
  /** How many consecutive days the candidate must hold to take over. */
  requiredDays: number
  /** Times this latch has flipped. Bounded signal for "this is unstable". */
  flips: number
}

export const MeterDetailSchema = z.object({
  target: z.string(),
  visible: z.number(),
  debt: z.number().min(0),
  excess: z.number().min(0),
  velocity: z.number(),
  recoveryMomentum: z.number().min(0),
  daysAtCeiling: z.number().int().min(0),
  daysAtFloor: z.number().int().min(0),
  lastUpdatedDay: z.number().int(),
})

export const HysteresisLatchSchema = z.object({
  key: z.string(),
  held: z.string(),
  heldSinceDay: z.number().int(),
  candidate: z.string().optional(),
  candidateSinceDay: z.number().int().optional(),
  requiredDays: z.number().int().min(1),
  flips: z.number().int().min(0),
})

export const MetersModuleStateSchema = z.object({
  details: z.record(z.string(), MeterDetailSchema),
  latches: z.record(z.string(), HysteresisLatchSchema),
})

export function createEmptyMeterDetail(
  target: MeterTarget,
  visible: number,
  day: number,
): MeterDetail {
  return {
    target,
    visible,
    debt: 0,
    excess: 0,
    velocity: 0,
    recoveryMomentum: 0,
    daysAtCeiling: 0,
    daysAtFloor: 0,
    lastUpdatedDay: day,
  }
}

/**
 * Is this detail record worth keeping?
 *
 * A meter sitting comfortably mid-range with no debt, no excess, no
 * momentum and no movement tells us nothing, so it is pruned. This is what
 * keeps `details` proportional to the number of meters actually in trouble.
 */
export function meterDetailIsInteresting(detail: MeterDetail): boolean {
  return (
    detail.debt > 0 ||
    detail.excess > 0 ||
    detail.daysAtFloor > 0 ||
    detail.daysAtCeiling > 0 ||
    Math.abs(detail.velocity) >= 0.05 ||
    detail.recoveryMomentum > 0
  )
}
