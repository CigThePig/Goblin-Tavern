// Phase 98 — Difficulty preset tests.
//
// Verifies each preset produces the documented day-zero values, the
// `standard` preset is a no-op against `createInitialTavernState()`,
// and the clamping helper holds at the [0, 100] boundaries.
//
// The presets touch coin (replaced), area cleanliness (additive +
// clamped), and a few pressure baselines (additive + clamped). No
// other state should be affected by `applyDifficultyToBase` — a
// regression here would risk breaking the (validated) zod schema.

import { describe, expect, it } from 'vitest'

import {
  DIFFICULTY_PRESETS,
  applyDifficultyToBase,
  type DifficultyConfig,
} from '../../src/sim/state/difficulty'
import { createInitialTavernState } from '../../src/sim/state/defaults'

describe('DIFFICULTY_PRESETS', () => {
  it('easy preset bumps coin to 150 and softens decay pressures', () => {
    const state = createInitialTavernState(undefined, DIFFICULTY_PRESETS.easy)
    expect(state.coin).toBe(150)
    // food_safety / maintenance / pests all seed at 35 in defaults.ts.
    // easy pushes them to 25.
    expect(state.pressures['food_safety']!.value).toBe(25)
    expect(state.pressures['maintenance']!.value).toBe(25)
    expect(state.pressures['pests']!.value).toBe(25)
    // Sanity: a pressure not in the bonus map is unchanged.
    expect(state.pressures['inspection']!.value).toBe(25)
  })

  it('standard preset matches the parameterless createInitialTavernState exactly', () => {
    const without = createInitialTavernState()
    const withStd = createInitialTavernState(undefined, DIFFICULTY_PRESETS.standard)
    expect(JSON.parse(JSON.stringify(withStd))).toEqual(
      JSON.parse(JSON.stringify(without)),
    )
  })

  it('hard preset drops coin to 75 and nudges decay pressures up', () => {
    const state = createInitialTavernState(undefined, DIFFICULTY_PRESETS.hard)
    expect(state.coin).toBe(75)
    expect(state.pressures['food_safety']!.value).toBe(40)
    expect(state.pressures['maintenance']!.value).toBe(40)
    expect(state.pressures['pests']!.value).toBe(40)
  })

  it('easy preset increases area cleanliness; hard preset decreases it', () => {
    const base = createInitialTavernState()
    const easy = createInitialTavernState(undefined, DIFFICULTY_PRESETS.easy)
    const hard = createInitialTavernState(undefined, DIFFICULTY_PRESETS.hard)
    for (const id of Object.keys(base.areas)) {
      const baseClean = base.areas[id]!.cleanliness
      const easyClean = easy.areas[id]!.cleanliness
      const hardClean = hard.areas[id]!.cleanliness
      expect(easyClean).toBeGreaterThanOrEqual(baseClean)
      expect(hardClean).toBeLessThanOrEqual(baseClean)
    }
  })
})

describe('applyDifficultyToBase — clamping', () => {
  it('clamps cleanliness above 100', () => {
    const base = createInitialTavernState()
    // Force a high baseline so the +10 would overflow without clamping.
    for (const area of Object.values(base.areas)) {
      area.cleanliness = 95
    }
    const out = applyDifficultyToBase(base, {
      id: 'easy',
      label: 'Easy',
      description: 'test',
      startingCoin: 200,
      areaCleanlinessBonus: 50,
      pressureValueBonus: {},
    })
    for (const area of Object.values(out.areas)) {
      expect(area.cleanliness).toBeLessThanOrEqual(100)
      expect(area.cleanliness).toBe(100)
    }
  })

  it('clamps cleanliness below 0', () => {
    const base = createInitialTavernState()
    for (const area of Object.values(base.areas)) {
      area.cleanliness = 5
    }
    const out = applyDifficultyToBase(base, {
      id: 'hard',
      label: 'Hard',
      description: 'test',
      startingCoin: 0,
      areaCleanlinessBonus: -50,
      pressureValueBonus: {},
    })
    for (const area of Object.values(out.areas)) {
      expect(area.cleanliness).toBeGreaterThanOrEqual(0)
      expect(area.cleanliness).toBe(0)
    }
  })

  it('clamps pressure values to [0, 100]', () => {
    const base = createInitialTavernState()
    base.pressures['debt']!.value = 95
    base.pressures['violence']!.value = 5
    const out = applyDifficultyToBase(base, {
      id: 'hard',
      label: 'Hard',
      description: 'test',
      startingCoin: 50,
      areaCleanlinessBonus: 0,
      pressureValueBonus: { debt: 50, violence: -50 },
    })
    expect(out.pressures['debt']!.value).toBe(100)
    expect(out.pressures['violence']!.value).toBe(0)
  })

  it('does not mutate the input state', () => {
    const base = createInitialTavernState()
    const beforeCoin = base.coin
    const beforeClean = base.areas[Object.keys(base.areas)[0]!]!.cleanliness
    const beforeFood = base.pressures['food_safety']!.value
    applyDifficultyToBase(base, DIFFICULTY_PRESETS.hard)
    expect(base.coin).toBe(beforeCoin)
    expect(base.areas[Object.keys(base.areas)[0]!]!.cleanliness).toBe(beforeClean)
    expect(base.pressures['food_safety']!.value).toBe(beforeFood)
  })

  it('skips unknown pressure ids in the bonus map silently', () => {
    const base = createInitialTavernState()
    const cfg: DifficultyConfig = {
      id: 'easy',
      label: 'Easy',
      description: 'test',
      startingCoin: 100,
      areaCleanlinessBonus: 0,
      pressureValueBonus: { not_a_real_pressure: 50 },
    }
    expect(() => applyDifficultyToBase(base, cfg)).not.toThrow()
  })
})

describe('createInitialTavernState — overrides + difficulty interaction', () => {
  it('overrides still win when both are supplied', () => {
    const overrides = { coin: 999 }
    const state = createInitialTavernState(overrides, DIFFICULTY_PRESETS.hard)
    expect(state.coin).toBe(999)
  })

  it('difficulty applies even when overrides do not include coin', () => {
    const state = createInitialTavernState(
      { meta: { tavernId: 'test', tavernName: 'Test', simVersion: '0.0.0', createdAtDay: 0 } },
      DIFFICULTY_PRESETS.hard,
    )
    expect(state.coin).toBe(75)
  })
})
