// Phase 127 / ISSUE-096 — Voiced Surface arc, Phase 1.
//
// Parity between the signal-surface `pressureTrend` helper and the
// snippet DSL's `pressureRising` condition. Both surfaces must read the
// same data, so a "rising" pressure must satisfy `pressureRising` AND
// produce a 'rising' result from `pressureTrend`. The signal-surface
// pressure helper is intentionally a thin re-export of the existing
// condition logic so the two never drift.

import { describe, expect, it } from 'vitest'

import { evalCondition } from '../../src/cards/compose/conditions'
import { pressureIsRising, pressureTrend } from '../../src/sim/signals'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { makeSeed } from '../cards/cardFactories'
import type { TavernState } from '../../src/sim/state/TavernState'

function setOnStatePressure(
  state: TavernState,
  id: string,
  trend: number,
  value = 50,
): TavernState {
  return {
    ...state,
    pressures: {
      ...state.pressures,
      [id]: {
        id,
        label: id,
        value,
        trend,
        tags: [],
        topCauses: [],
      },
    },
  }
}

function setSnapshotPressure(
  state: TavernState,
  id: string,
  trend: 'rising' | 'stable' | 'falling',
): TavernState {
  const existingModules = (state.modules ?? {}) as Record<string, unknown>
  const existingPressures =
    (existingModules.pressures as
      | { snapshots?: Record<string, { trend?: string }> }
      | undefined) ?? {}
  return {
    ...state,
    modules: {
      ...existingModules,
      pressures: {
        ...existingPressures,
        snapshots: {
          ...(existingPressures.snapshots ?? {}),
          [id]: { trend },
        },
      },
    },
  }
}

describe('pressureTrend ↔ pressureRising parity', () => {
  const seed = makeSeed({ family: 'food_safety', type: 'crisis' })

  it('on-state positive trend ⇒ rising on both surfaces', () => {
    const state = setOnStatePressure(createInitialTavernState(), 'food_safety', 5)
    expect(pressureTrend(state, 'food_safety')).toBe('rising')
    expect(pressureIsRising(state, 'food_safety')).toBe(true)
    expect(
      evalCondition({ kind: 'pressureRising', pressureId: 'food_safety' }, seed, state),
    ).toBe(true)
  })

  it('on-state zero trend ⇒ stable, neither surface considers it rising', () => {
    const state = setOnStatePressure(createInitialTavernState(), 'food_safety', 0)
    expect(pressureTrend(state, 'food_safety')).toBe('stable')
    expect(pressureIsRising(state, 'food_safety')).toBe(false)
    expect(
      evalCondition({ kind: 'pressureRising', pressureId: 'food_safety' }, seed, state),
    ).toBe(false)
  })

  it('on-state negative trend ⇒ falling', () => {
    const state = setOnStatePressure(createInitialTavernState(), 'food_safety', -3)
    expect(pressureTrend(state, 'food_safety')).toBe('falling')
    expect(pressureIsRising(state, 'food_safety')).toBe(false)
  })

  it('snapshot rising overrides absent on-state entry', () => {
    const state = setSnapshotPressure(createInitialTavernState(), 'maintenance', 'rising')
    expect(pressureTrend(state, 'maintenance')).toBe('rising')
    expect(pressureIsRising(state, 'maintenance')).toBe(true)
    expect(
      evalCondition({ kind: 'pressureRising', pressureId: 'maintenance' }, seed, state),
    ).toBe(true)
  })

  it('unknown id ⇒ unknown trend, not rising', () => {
    const base = createInitialTavernState()
    expect(pressureTrend(base, 'no_such_pressure')).toBe('unknown')
    expect(pressureIsRising(base, 'no_such_pressure')).toBe(false)
    expect(
      evalCondition({ kind: 'pressureRising', pressureId: 'no_such_pressure' }, seed, base),
    ).toBe(false)
  })
})
