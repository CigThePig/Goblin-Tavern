import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'

import {
  MAX_METER_DETAILS,
  METERS_MODULE_ID,
  MOMENTUM_DECAY,
  VELOCITY_SMOOTHING,
  createEmptyMeterDetail,
  meterDetailIsInteresting,
  type MeterDetail,
  type MeterTarget,
  type MetersModuleState,
} from './types'

// Expansion Phase 1 §1.5 — recording what the clamp threw away.
//
// The single entry point is `recordMeterMovement`. A domain that clamps a
// meter calls it with the UNCLAMPED value it wanted and the clamped value it
// wrote, and everything else — debt, excess, velocity, momentum, pinned-day
// counters — is derived here. That keeps the accounting in one place, so a
// new meter joining the scheme cannot get the bookkeeping subtly wrong.

export function createInitialMetersModuleState(): MetersModuleState {
  return { details: {}, latches: {} }
}

export function readMetersSlice(state: TavernState): MetersModuleState {
  const raw = (state.modules as Record<string, unknown> | undefined)?.[
    METERS_MODULE_ID
  ] as Partial<MetersModuleState> | undefined
  return {
    details: raw?.details ? { ...raw.details } : {},
    latches: raw?.latches ? { ...raw.latches } : {},
  }
}

export function writeMetersSlice(
  ctx: SimContext,
  patch: (current: MetersModuleState) => MetersModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<MetersModuleState>(
    METERS_MODULE_ID,
    (current) => patch(current ?? createInitialMetersModuleState()),
    { source: `${METERS_MODULE_ID}.${reason}`, reason },
  )
}

export function getMeterDetail(
  state: TavernState,
  target: MeterTarget,
): MeterDetail | undefined {
  return readMetersSlice(state).details[target]
}

/** Debt banked below the floor for this meter. 0 when there is none. */
export function meterDebt(state: TavernState, target: MeterTarget): number {
  return getMeterDetail(state, target)?.debt ?? 0
}

/** Pressure banked above the ceiling for this meter. 0 when there is none. */
export function meterExcess(state: TavernState, target: MeterTarget): number {
  return getMeterDetail(state, target)?.excess ?? 0
}

export type MeterMovement = {
  target: MeterTarget
  /** What the meter read before this change. */
  previousVisible: number
  /** What the domain WANTED to write, before clamping. */
  desired: number
  /** What it actually wrote, after clamping. */
  visible: number
  floor?: number
  ceiling?: number
}

/**
 * Record one day's movement of one meter.
 *
 * Debt and excess are the clamp's residue:
 *
 *   desired -40, floor 0, visible 0  → 40 of debt banked
 *   desired 118, ceiling 100, visible 100 → 18 of excess banked
 *
 * and they are paid down from the same side they were banked on: a desired
 * value that comes back INSIDE the range first works off the debt/excess,
 * and only then does the visible meter move. `applyDebtToRecovery` is what
 * a domain calls to get that behaviour; this function only does the
 * accounting.
 *
 * Nothing is written when the meter is unremarkable and has no existing
 * record, so a healthy tavern's save carries no meter details at all.
 */
export function recordMeterMovement(
  ctx: SimContext,
  movement: MeterMovement,
): MeterDetail {
  const today = ctx.state.calendar.totalDaysElapsed
  const floor = movement.floor ?? 0
  const ceiling = movement.ceiling ?? 100
  const existing = readMetersSlice(ctx.state).details[movement.target]
  const base =
    existing ??
    createEmptyMeterDetail(movement.target, movement.previousVisible, today)

  const belowFloor = Math.max(0, floor - movement.desired)
  const aboveCeiling = Math.max(0, movement.desired - ceiling)

  // Debt: grows while the meter is pinned below the floor, and is repaid by
  // headroom the meter gains once it is back inside range.
  const headroomUp = Math.max(0, movement.desired - floor)
  const debt =
    belowFloor > 0
      ? base.debt + belowFloor
      : Math.max(0, base.debt - headroomUp)

  const headroomDown = Math.max(0, ceiling - movement.desired)
  const excess =
    aboveCeiling > 0
      ? base.excess + aboveCeiling
      : Math.max(0, base.excess - headroomDown)

  // Velocity tracks the UNCLAMPED movement, which is the whole point: a
  // meter pinned at 0 that is still falling has a negative velocity even
  // though its visible value has not changed for a week.
  const rawDelta = movement.desired - movement.previousVisible
  const velocity =
    base.velocity * (1 - VELOCITY_SMOOTHING) + rawDelta * VELOCITY_SMOOTHING

  // Momentum is directionless credit for sustained improvement. "Improving"
  // means moving away from trouble, which for a meter with debt means
  // rising and for one with excess means falling.
  const improving =
    excess > 0 || aboveCeiling > 0 ? rawDelta < 0 : rawDelta > 0
  const recoveryMomentum = improving
    ? base.recoveryMomentum + Math.abs(rawDelta)
    : Math.max(0, base.recoveryMomentum * (1 - MOMENTUM_DECAY))

  const detail: MeterDetail = {
    target: movement.target,
    visible: movement.visible,
    debt: round2(debt),
    excess: round2(excess),
    velocity: round2(velocity),
    recoveryMomentum: round2(recoveryMomentum),
    daysAtCeiling:
      movement.visible >= ceiling ? base.daysAtCeiling + 1 : 0,
    daysAtFloor: movement.visible <= floor ? base.daysAtFloor + 1 : 0,
    lastUpdatedDay: today,
  }

  const keep = meterDetailIsInteresting(detail)
  if (!keep && !existing) return detail

  writeMetersSlice(
    ctx,
    (current) => {
      const details = { ...current.details }
      if (keep) details[movement.target] = detail
      else delete details[movement.target]
      return { ...current, details: pruneDetails(details) }
    },
    'record_movement',
  )

  return detail
}

/**
 * Spend an improvement against banked debt before it reaches the visible
 * meter.
 *
 * This is the behaviour half of §1.5: a domain that is about to raise a
 * meter calls this first, and gets back how much of the improvement is left
 * over for the visible value. Scrubbing a room that has been filthy for a
 * fortnight starts by working off the filth the clamp hid.
 *
 * Returns the improvement to apply visibly, and writes the reduced debt.
 */
export function applyDebtToRecovery(
  ctx: SimContext,
  target: MeterTarget,
  improvement: number,
  reason: string,
): { visibleImprovement: number; debtPaid: number; debtRemaining: number } {
  if (improvement <= 0) {
    return { visibleImprovement: improvement, debtPaid: 0, debtRemaining: meterDebt(ctx.state, target) }
  }
  const detail = getMeterDetail(ctx.state, target)
  const debt = detail?.debt ?? 0
  if (debt <= 0) {
    return { visibleImprovement: improvement, debtPaid: 0, debtRemaining: 0 }
  }
  const debtPaid = Math.min(debt, improvement)
  const remaining = round2(debt - debtPaid)
  const today = ctx.state.calendar.totalDaysElapsed

  writeMetersSlice(
    ctx,
    (current) => {
      const details = { ...current.details }
      const base = details[target]
      if (!base) return current
      const next: MeterDetail = {
        ...base,
        debt: remaining,
        // Paying down hidden debt IS recovery, so it earns momentum even
        // though the visible meter has not moved.
        recoveryMomentum: round2(base.recoveryMomentum + debtPaid),
        lastUpdatedDay: today,
      }
      if (meterDetailIsInteresting(next)) details[target] = next
      else delete details[target]
      return { ...current, details }
    },
    reason,
  )

  return {
    visibleImprovement: round2(improvement - debtPaid),
    debtPaid: round2(debtPaid),
    debtRemaining: remaining,
  }
}

/** Meters currently carrying hidden debt or excess. Feeds the report. */
export function troubledMeters(state: TavernState): MeterDetail[] {
  return Object.values(readMetersSlice(state).details)
    .filter((detail) => detail.debt > 0 || detail.excess > 0)
    .sort((a, b) => {
      const byMagnitude = b.debt + b.excess - (a.debt + a.excess)
      return byMagnitude !== 0 ? byMagnitude : a.target.localeCompare(b.target)
    })
}

function pruneDetails(
  details: Record<MeterTarget, MeterDetail>,
): Record<MeterTarget, MeterDetail> {
  const keys = Object.keys(details)
  if (keys.length <= MAX_METER_DETAILS) return details
  // Keep the meters in the most trouble; a meter with only a stale velocity
  // is the cheapest thing to forget.
  const ordered = keys.sort((a, b) => {
    const scoreA = details[a]!.debt + details[a]!.excess
    const scoreB = details[b]!.debt + details[b]!.excess
    return scoreB - scoreA || a.localeCompare(b)
  })
  const kept: Record<MeterTarget, MeterDetail> = {}
  for (const key of ordered.slice(0, MAX_METER_DETAILS)) kept[key] = details[key]!
  return kept
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
