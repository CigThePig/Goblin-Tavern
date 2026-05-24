// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).

import { describe, expect, it } from 'vitest'

import {
  pickYesterdayCoinVerb,
  pickYesterdayPressureVerb,
  pickYesterdayReputationVerb,
} from '../../../src/reports/compose/sections'
import { createInitialTavernState } from '../../../src/sim/state/defaults'

const STATE = createInitialTavernState()

describe('pickYesterdayReputationVerb', () => {
  it('picks a gain verb when delta > 0', () => {
    const v = pickYesterdayReputationVerb({
      state: STATE,
      closedDayOrdinal: 3,
      axis: 'cozy',
      delta: 4,
    })
    expect(['rose', 'climbed']).toContain(v)
  })

  it('picks a loss verb when delta < 0', () => {
    const v = pickYesterdayReputationVerb({
      state: STATE,
      closedDayOrdinal: 3,
      axis: 'cozy',
      delta: -4,
    })
    expect(['fell', 'slipped']).toContain(v)
  })

  it('picks the hold verb when delta == 0', () => {
    const v = pickYesterdayReputationVerb({
      state: STATE,
      closedDayOrdinal: 3,
      axis: 'cozy',
      delta: 0,
    })
    expect(v).toBe('held')
  })

  it('is deterministic per (closedDayOrdinal, axis)', () => {
    const args = {
      state: STATE,
      closedDayOrdinal: 7,
      axis: 'cozy',
      delta: 3,
    }
    expect(pickYesterdayReputationVerb(args)).toBe(
      pickYesterdayReputationVerb(args),
    )
  })
})

describe('pickYesterdayPressureVerb', () => {
  it('picks the creeping verb on small delta', () => {
    const v = pickYesterdayPressureVerb({
      state: STATE,
      closedDayOrdinal: 3,
      pressureId: 'food_safety',
      delta: 2,
    })
    expect(v).toBe('creeping')
  })

  it('picks the rising verb on mid delta', () => {
    const v = pickYesterdayPressureVerb({
      state: STATE,
      closedDayOrdinal: 3,
      pressureId: 'food_safety',
      delta: 5,
    })
    expect(v).toBe('rising')
  })

  it('picks the surging verb on large delta', () => {
    const v = pickYesterdayPressureVerb({
      state: STATE,
      closedDayOrdinal: 3,
      pressureId: 'food_safety',
      delta: 15,
    })
    expect(v).toBe('surging')
  })

  it('is deterministic', () => {
    const args = {
      state: STATE,
      closedDayOrdinal: 7,
      pressureId: 'food_safety',
      delta: 5,
    }
    expect(pickYesterdayPressureVerb(args)).toBe(
      pickYesterdayPressureVerb(args),
    )
  })
})

describe('pickYesterdayCoinVerb', () => {
  it('picks a gain verb for positive delta', () => {
    const v = pickYesterdayCoinVerb({
      state: STATE,
      closedDayOrdinal: 3,
      delta: 10,
    })
    expect(['climbed', 'gathered']).toContain(v)
  })

  it('picks a loss verb for negative delta', () => {
    const v = pickYesterdayCoinVerb({
      state: STATE,
      closedDayOrdinal: 3,
      delta: -10,
    })
    expect(['dropped', 'thinned']).toContain(v)
  })

  it('picks held for zero delta', () => {
    const v = pickYesterdayCoinVerb({
      state: STATE,
      closedDayOrdinal: 3,
      delta: 0,
    })
    expect(v).toBe('held')
  })
})
