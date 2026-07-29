import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'

import { readMetersSlice, writeMetersSlice } from './detail'
import type { HysteresisLatch } from './types'

// Expansion Phase 1 §1.5 — hysteresis for categorical decisions.
//
// A tavern whose renown sits at 49.6 should not be "known as a dive" on
// Monday, "unremarkable" on Tuesday, and a dive again on Wednesday. Identity
// bands, actor stances, and supplier opinions are all categorical readings
// of a wobbling number, and reading them raw makes the world look like it
// has no memory.
//
// A latch holds the current answer and requires a challenger to persist for
// `requiredDays` before it takes over. `flips` counts how often it has
// changed hands, which is itself a useful signal: an identity that has
// flipped six times is genuinely unsettled, and Phase 10 uses that.

export type HysteresisEvaluation = {
  /** The value in force. This is what callers should act on. */
  held: string
  /** True on the day the latch changed hands. */
  changed: boolean
  /** A challenger that has not yet won, if any. */
  candidate?: string
  /** Consecutive days the challenger has held. 0 when there is none. */
  candidateDays: number
  /** Days remaining before the challenger takes over. */
  daysUntilChange: number
}

export const DEFAULT_HYSTERESIS_DAYS = 3

export function getHysteresisLatch(
  state: TavernState,
  key: string,
): HysteresisLatch | undefined {
  return readMetersSlice(state).latches[key]
}

/**
 * Offer today's raw reading to a latch and get back the value in force.
 *
 * The first call creates the latch and holds whatever was offered — there is
 * nothing to resist yet. After that, a differing reading becomes a
 * candidate; if it persists for `requiredDays` it wins, and if it
 * disappears the candidate is dropped and the incumbent keeps its
 * `heldSinceDay` (so "held since day 4" stays true through a wobble).
 */
export function evaluateHysteresis(
  ctx: SimContext,
  key: string,
  rawReading: string,
  requiredDays: number = DEFAULT_HYSTERESIS_DAYS,
): HysteresisEvaluation {
  const today = ctx.state.calendar.totalDaysElapsed
  const existing = getHysteresisLatch(ctx.state, key)

  if (!existing) {
    const latch: HysteresisLatch = {
      key,
      held: rawReading,
      heldSinceDay: today,
      requiredDays: Math.max(1, requiredDays),
      flips: 0,
    }
    writeLatch(ctx, latch, 'latch_open')
    return {
      held: rawReading,
      changed: false,
      candidateDays: 0,
      daysUntilChange: 0,
    }
  }

  // The incumbent is being confirmed. Drop any challenger.
  if (rawReading === existing.held) {
    if (existing.candidate !== undefined) {
      const { candidate: _c, candidateSinceDay: _d, ...rest } = existing
      writeLatch(ctx, { ...rest, requiredDays: existing.requiredDays }, 'latch_hold')
    }
    return {
      held: existing.held,
      changed: false,
      candidateDays: 0,
      daysUntilChange: 0,
    }
  }

  // A new challenger, or the same one continuing.
  const continuing = existing.candidate === rawReading
  const candidateSinceDay = continuing
    ? (existing.candidateSinceDay ?? today)
    : today
  const candidateDays = today - candidateSinceDay + 1

  if (candidateDays >= existing.requiredDays) {
    const latch: HysteresisLatch = {
      key,
      held: rawReading,
      heldSinceDay: today,
      requiredDays: existing.requiredDays,
      flips: existing.flips + 1,
    }
    writeLatch(ctx, latch, 'latch_flip')
    return {
      held: rawReading,
      changed: true,
      candidateDays,
      daysUntilChange: 0,
    }
  }

  writeLatch(
    ctx,
    {
      ...existing,
      candidate: rawReading,
      candidateSinceDay,
    },
    'latch_challenge',
  )
  return {
    held: existing.held,
    changed: false,
    candidate: rawReading,
    candidateDays,
    daysUntilChange: existing.requiredDays - candidateDays,
  }
}

/**
 * Read a latch without offering a reading. Use this from reports and from
 * any consumer that must not advance the latch — evaluating twice in one day
 * would double-count the candidate's tenure.
 */
export function peekHysteresis(
  state: TavernState,
  key: string,
  fallback: string,
): string {
  return getHysteresisLatch(state, key)?.held ?? fallback
}

function writeLatch(
  ctx: SimContext,
  latch: HysteresisLatch,
  reason: string,
): void {
  writeMetersSlice(
    ctx,
    (current) => ({
      ...current,
      latches: { ...current.latches, [latch.key]: latch },
    }),
    reason,
  )
}
