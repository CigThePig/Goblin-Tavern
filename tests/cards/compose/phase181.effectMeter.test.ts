// Phase 181 / ISSUE-149 — Choice-Preview Legibility arc, Phase 1.
//
// Card-layer half of the meter contract: the `effectMeter` snippet condition
// (reads `ctx.currentEffect.meterId`) and the meter-aware within-choice de-dup
// key (`previewCellKey`). The cell-key test is the one the arc names: two
// distinct meters in the same coarse cell (loyalty +10 and stress −8, both
// `staff|positive|medium`) must receive DISTINCT keys so the second no longer
// silently reuses the first's line.

import { describe, expect, it } from 'vitest'

import { evalCondition } from '../../../src/cards/compose/conditions'
import { previewCellKey } from '../../../src/cards/cardHelpers'
import type { ConditionContext } from '../../../src/cards/compose/types'
import type { EffectPreview } from '../../../src/sim/core/effect'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import { effect } from '../../../src/sim/modules/issues/generatorHelpers'
import { makeSeed } from '../cardFactories'

const seed = makeSeed({ id: 'phase181-effect-meter' })
const state = createInitialTavernState()

const loyalty = effect('state_change', 'staff.mira.loyalty', 10, 'Loyalty rises', ['staff'])
const stress = effect('state_change', 'staff.mira.stress', -8, 'Stress drops', ['staff'])

// A preview shaped like a pre-Phase-181 serialized seed: no meterId.
const legacyPreview: EffectPreview = {
  kind: 'state_change',
  target: 'staff.mira.loyalty',
  amount: 10,
  readable: 'Loyalty rises',
  tags: ['staff'],
}

describe('Phase 181 — effectMeter condition', () => {
  it('matches when the current effect carries a meterId in anyOf', () => {
    const ctx: ConditionContext = { currentEffect: loyalty }
    expect(
      evalCondition({ kind: 'effectMeter', anyOf: ['loyalty'] }, seed, state, ctx),
    ).toBe(true)
  })

  it('matches against multiple acceptable meters', () => {
    const ctx: ConditionContext = { currentEffect: stress }
    expect(
      evalCondition(
        { kind: 'effectMeter', anyOf: ['loyalty', 'stress', 'morale'] },
        seed,
        state,
        ctx,
      ),
    ).toBe(true)
  })

  it('does not match when the meter is outside anyOf', () => {
    const ctx: ConditionContext = { currentEffect: loyalty }
    expect(
      evalCondition({ kind: 'effectMeter', anyOf: ['stress', 'morale'] }, seed, state, ctx),
    ).toBe(false)
  })

  it('returns false when no currentEffect is in context (body / title slots)', () => {
    expect(
      evalCondition({ kind: 'effectMeter', anyOf: ['loyalty'] }, seed, state, {}),
    ).toBe(false)
  })

  it('returns false when currentEffect lacks meterId (legacy seed)', () => {
    expect(
      evalCondition(
        { kind: 'effectMeter', anyOf: ['loyalty'] },
        seed,
        state,
        { currentEffect: legacyPreview },
      ),
    ).toBe(false)
  })
})

describe('Phase 181 — previewCellKey is meter-aware', () => {
  it('gives two distinct meters in the same coarse cell distinct keys', () => {
    // Both classify staff / positive / medium; only the meter differs.
    expect(loyalty.targetKind).toBe(stress.targetKind)
    expect(loyalty.direction).toBe(stress.direction)
    expect(loyalty.magnitudeBand).toBe(stress.magnitudeBand)

    const loyaltyKey = previewCellKey(loyalty)
    const stressKey = previewCellKey(stress)
    expect(loyaltyKey).toBeDefined()
    expect(stressKey).toBeDefined()
    expect(loyaltyKey).not.toBe(stressKey)
  })

  it('keeps two effects on the SAME meter / direction / band in one cell', () => {
    const loyaltyA = effect('state_change', 'staff.mira.loyalty', 10, 'Loyalty rises', ['staff'])
    const loyaltyB = effect('state_change', 'staff.bram.loyalty', 12, 'Loyalty rises', ['staff'])
    expect(previewCellKey(loyaltyA)).toBe(previewCellKey(loyaltyB))
  })

  it('returns undefined for an un-bandable cause effect', () => {
    const cause = effect('cause', 'staff:cook_1', 0, 'Mark gratitude', ['staff'])
    expect(previewCellKey(cause)).toBeUndefined()
  })
})
