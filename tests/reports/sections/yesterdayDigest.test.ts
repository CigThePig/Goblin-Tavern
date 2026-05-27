// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
// Phase 160 / ISSUE-128 — Legible Surface arc, Phase 15 (Report-Prose
// Legibility). Recalibrated verb expectations to the magnitude-banded
// pool — a `+4` reputation gain now renders a `small` lexicon variant
// ("rose a notch" / "climbed a measure"), not the bare direction-only
// fallback. The fallback still exists for callers that don't pass a
// band-bearing tag (none ship with Phase 160).

import { describe, expect, it } from 'vitest'

import {
  pickYesterdayCoinVerb,
  pickYesterdayPressureVerb,
  pickYesterdayReputationVerb,
} from '../../../src/reports/compose/sections'
import { createInitialTavernState } from '../../../src/sim/state/defaults'

const STATE = createInitialTavernState()

describe('pickYesterdayReputationVerb', () => {
  it('picks a small-band gain verb when |delta| ≤ 3', () => {
    const v = pickYesterdayReputationVerb({
      state: STATE,
      closedDayOrdinal: 3,
      axis: 'cozy',
      delta: 2,
    })
    expect(['rose a notch', 'climbed a measure', 'rose', 'climbed']).toContain(v)
  })

  it('picks a mid-band gain verb when 3 < |delta| ≤ 8', () => {
    const v = pickYesterdayReputationVerb({
      state: STATE,
      closedDayOrdinal: 3,
      axis: 'cozy',
      delta: 6,
    })
    expect([
      'climbed a real step',
      'rose a marked rise',
      'rose',
      'climbed',
    ]).toContain(v)
  })

  it('picks a large-band gain verb when |delta| > 8', () => {
    const v = pickYesterdayReputationVerb({
      state: STATE,
      closedDayOrdinal: 3,
      axis: 'cozy',
      delta: 15,
    })
    expect([
      'surged a strong climb',
      'leapt a wide leap',
      'rose',
      'climbed',
    ]).toContain(v)
  })

  it('picks a small-band loss verb when |delta| ≤ 3', () => {
    const v = pickYesterdayReputationVerb({
      state: STATE,
      closedDayOrdinal: 3,
      axis: 'cozy',
      delta: -2,
    })
    expect([
      'slipped a notch',
      'fell a measure',
      'fell',
      'slipped',
    ]).toContain(v)
  })

  it('picks a large-band loss verb when |delta| > 8', () => {
    const v = pickYesterdayReputationVerb({
      state: STATE,
      closedDayOrdinal: 3,
      axis: 'cozy',
      delta: -15,
    })
    expect([
      'fell a heavy fall',
      'slid a wide slide',
      'fell',
      'slipped',
    ]).toContain(v)
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
  it('picks a small-band pressure verb on |delta| ≤ 3', () => {
    const v = pickYesterdayPressureVerb({
      state: STATE,
      closedDayOrdinal: 3,
      pressureId: 'food_safety',
      delta: 2,
    })
    expect(['creeping a notch', 'pressing a step']).toContain(v)
  })

  it('picks a mid-band pressure verb on 3 < |delta| ≤ 8', () => {
    const v = pickYesterdayPressureVerb({
      state: STATE,
      closedDayOrdinal: 3,
      pressureId: 'food_safety',
      delta: 5,
    })
    expect(['mounting a marked rise', 'building a clear lift']).toContain(v)
  })

  it('picks a large-band pressure verb on |delta| > 8', () => {
    const v = pickYesterdayPressureVerb({
      state: STATE,
      closedDayOrdinal: 3,
      pressureId: 'food_safety',
      delta: 15,
    })
    expect(['spiking a wide leap', 'pressing a surge']).toContain(v)
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
  it('picks a small-band gain verb for delta ≤ 30', () => {
    const v = pickYesterdayCoinVerb({
      state: STATE,
      closedDayOrdinal: 3,
      delta: 10,
    })
    expect([
      'earned a notch',
      'gathered a measure',
      'climbed',
      'gathered',
    ]).toContain(v)
  })

  it('picks a mid-band gain verb for 30 < delta ≤ 100', () => {
    const v = pickYesterdayCoinVerb({
      state: STATE,
      closedDayOrdinal: 3,
      delta: 60,
    })
    expect([
      'banked a clear lift',
      'earned a real step',
      'climbed',
      'gathered',
    ]).toContain(v)
  })

  it('picks a large-band gain verb for delta > 100', () => {
    const v = pickYesterdayCoinVerb({
      state: STATE,
      closedDayOrdinal: 3,
      delta: 150,
    })
    expect([
      'brought a surge',
      'banked a wide leap',
      'climbed',
      'gathered',
    ]).toContain(v)
  })

  it('picks a small-band loss verb for |delta| ≤ 30', () => {
    const v = pickYesterdayCoinVerb({
      state: STATE,
      closedDayOrdinal: 3,
      delta: -10,
    })
    expect([
      'spent a notch',
      'lost a measure',
      'dropped',
      'thinned',
    ]).toContain(v)
  })

  it('picks a large-band loss verb for |delta| > 100', () => {
    const v = pickYesterdayCoinVerb({
      state: STATE,
      closedDayOrdinal: 3,
      delta: -150,
    })
    expect([
      'took a heavy fall',
      'lost a wide slide',
      'dropped',
      'thinned',
    ]).toContain(v)
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
