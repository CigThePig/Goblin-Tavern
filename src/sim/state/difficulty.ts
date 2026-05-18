// Phase 98 — Difficulty presets for new-game starts.
//
// Difficulty is a START-TIME modification only. It alters the day-zero
// values produced by `createInitialTavernState` (coin, area cleanliness,
// a few pressure baselines) and is otherwise invisible to the
// simulation — there is no `difficulty` field on `TavernState`. A
// loaded save carries whatever values the player has played to.
//
// Three presets cover the design space from
// `docs/plans/game-loop-and-ux.md §2.1`: a forgiving start, the
// shipped baseline, and a tighter opening. Rent / landlord tuning is
// intentionally deferred — those modules ripple through monthly tests
// and a wrong knob would cascade.
//
// All numeric adjustments are clamped to [0, 100]. The helper is pure:
// it deep-clones the input before modifying so callers can never
// accidentally mutate a shared state.

import type { TavernState } from './TavernState'

export type DifficultyId = 'easy' | 'standard' | 'hard'

export type DifficultyConfig = {
  id: DifficultyId
  label: string
  description: string
  /** Replaces `coin` outright. */
  startingCoin: number
  /** Added to every area's `cleanliness` (negative allowed; clamped). */
  areaCleanlinessBonus: number
  /** Per-pressure additive delta on `value` (clamped). */
  pressureValueBonus: Record<string, number>
}

export const DIFFICULTY_PRESETS: Record<DifficultyId, DifficultyConfig> = {
  easy: {
    id: 'easy',
    label: 'Easy',
    description: 'Cleaner rooms, slower decay, extra coin to find your feet.',
    startingCoin: 150,
    areaCleanlinessBonus: 10,
    pressureValueBonus: {
      food_safety: -10,
      maintenance: -10,
      pests: -10,
    },
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    description: 'The Crooked Keg as designed — dirty, broke, and yours.',
    startingCoin: 100,
    areaCleanlinessBonus: 0,
    pressureValueBonus: {},
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    description: 'Thinner purse, stickier floors, more eyes on your kitchen.',
    startingCoin: 75,
    areaCleanlinessBonus: -10,
    pressureValueBonus: {
      food_safety: 5,
      maintenance: 5,
      pests: 5,
    },
  },
}

function clampMeter(value: number): number {
  return Math.max(0, Math.min(100, value))
}

/**
 * Apply a difficulty preset to a freshly-built `TavernState`. Returns
 * a NEW state object (deep-cloned via `structuredClone`) — the input
 * is never mutated. Bonuses are additive and clamped to [0, 100] so
 * accidental overflow can't break downstream validation.
 */
export function applyDifficultyToBase(
  base: TavernState,
  config: DifficultyConfig,
): TavernState {
  const next = structuredClone(base)

  next.coin = config.startingCoin

  if (config.areaCleanlinessBonus !== 0) {
    for (const area of Object.values(next.areas)) {
      area.cleanliness = clampMeter(area.cleanliness + config.areaCleanlinessBonus)
    }
  }

  for (const [pressureId, delta] of Object.entries(config.pressureValueBonus)) {
    if (delta === 0) continue
    const pressure = next.pressures[pressureId]
    if (!pressure) continue
    pressure.value = clampMeter(pressure.value + delta)
  }

  return next
}
