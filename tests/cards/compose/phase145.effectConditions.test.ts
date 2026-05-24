// Phase 145 / ISSUE-113 — Voiced Surface arc, Phase 18 (iteration 2).
//
// Unit tests for the three new per-effect condition primitives that read
// the structural meter facts that `effect()` writes onto every
// EffectPreview: `effectTargetKind`, `effectDirection`,
// `effectMagnitudeBand`. Each arm gets:
//   - positive case (context present, classification matches)
//   - negative case (context present, classification mismatches)
//   - missing-context case (returns false — graceful degradation for
//     body / title slot evaluation)
//   - missing-field case (currentEffect present but the classified field
//     is undefined, e.g. a pre-Phase-145 serialized seed; condition must
//     not throw and must return false)

import { describe, expect, it } from 'vitest'

import { evalCondition } from '../../../src/cards/compose/conditions'
import type { ConditionContext } from '../../../src/cards/compose/types'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type { EffectPreview } from '../../../src/sim/core/effect'
import { effect } from '../../../src/sim/modules/issues/generatorHelpers'
import { makeSeed } from '../cardFactories'

const seed = makeSeed({ id: 'phase145-effect-conditions' })
const state = createInitialTavernState()

const coinLoss = effect('state_change', 'coin', -25, 'Pay landlord', ['coin'])
const coinGain = effect('state_change', 'coin', 15, 'Earn coin', ['coin'])
const pressureUp = effect(
  'pressure',
  'pressure:food_safety',
  8,
  'Food safety risk rises',
  ['pressure'],
)
const causeZero = effect('cause', 'staff:cook_1', 0, 'Mark gratitude', [
  'staff',
])

// A preview shaped the way pre-Phase-145 serialized seeds would have
// stored it: no targetKind / direction / magnitudeBand fields.
const legacyPreview: EffectPreview = {
  kind: 'state_change',
  target: 'coin',
  amount: -25,
  readable: 'Pay landlord',
  tags: ['coin'],
}

describe('Phase 145 — effectTargetKind condition', () => {
  it('matches when the current effect classifies into anyOf', () => {
    const ctx: ConditionContext = { currentEffect: coinLoss }
    expect(
      evalCondition(
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        seed,
        state,
        ctx,
      ),
    ).toBe(true)
  })

  it('matches against multiple acceptable targetKinds', () => {
    const ctx: ConditionContext = { currentEffect: pressureUp }
    expect(
      evalCondition(
        { kind: 'effectTargetKind', anyOf: ['coin', 'pressure'] },
        seed,
        state,
        ctx,
      ),
    ).toBe(true)
  })

  it('does not match when the targetKind is outside anyOf', () => {
    const ctx: ConditionContext = { currentEffect: coinLoss }
    expect(
      evalCondition(
        { kind: 'effectTargetKind', anyOf: ['stock', 'pressure'] },
        seed,
        state,
        ctx,
      ),
    ).toBe(false)
  })

  it('returns false when no currentEffect is in context', () => {
    expect(
      evalCondition(
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        seed,
        state,
        {},
      ),
    ).toBe(false)
  })

  it('returns false when currentEffect lacks targetKind (legacy seed)', () => {
    expect(
      evalCondition(
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        seed,
        state,
        { currentEffect: legacyPreview },
      ),
    ).toBe(false)
  })
})

describe('Phase 145 — effectDirection condition', () => {
  it('matches when sign agrees with the classified direction', () => {
    expect(
      evalCondition(
        { kind: 'effectDirection', sign: 'negative' },
        seed,
        state,
        { currentEffect: coinLoss },
      ),
    ).toBe(true)
    expect(
      evalCondition(
        { kind: 'effectDirection', sign: 'positive' },
        seed,
        state,
        { currentEffect: coinGain },
      ),
    ).toBe(true)
    expect(
      evalCondition(
        { kind: 'effectDirection', sign: 'neutral' },
        seed,
        state,
        { currentEffect: causeZero },
      ),
    ).toBe(true)
  })

  it('does not match when sign disagrees', () => {
    expect(
      evalCondition(
        { kind: 'effectDirection', sign: 'positive' },
        seed,
        state,
        { currentEffect: coinLoss },
      ),
    ).toBe(false)
  })

  it('returns false with no context', () => {
    expect(
      evalCondition(
        { kind: 'effectDirection', sign: 'positive' },
        seed,
        state,
        {},
      ),
    ).toBe(false)
  })

  it('returns false when currentEffect lacks direction (legacy seed)', () => {
    expect(
      evalCondition(
        { kind: 'effectDirection', sign: 'negative' },
        seed,
        state,
        { currentEffect: legacyPreview },
      ),
    ).toBe(false)
  })
})

describe('Phase 145 — effectMagnitudeBand condition', () => {
  it('matches when the band is in anyOf', () => {
    // coin -25 → cutoffs 5/20/50 → 'medium'
    expect(
      evalCondition(
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
        seed,
        state,
        { currentEffect: coinLoss },
      ),
    ).toBe(true)
  })

  it('matches when anyOf spans multiple bands', () => {
    // coin +15 → 'small'
    expect(
      evalCondition(
        { kind: 'effectMagnitudeBand', anyOf: ['small', 'medium', 'large'] },
        seed,
        state,
        { currentEffect: coinGain },
      ),
    ).toBe(true)
  })

  it('does not match when the band is outside anyOf', () => {
    expect(
      evalCondition(
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
        seed,
        state,
        { currentEffect: coinLoss },
      ),
    ).toBe(false)
  })

  it('returns false for zero-amount cause effects (no band)', () => {
    expect(
      evalCondition(
        { kind: 'effectMagnitudeBand', anyOf: ['tiny', 'small'] },
        seed,
        state,
        { currentEffect: causeZero },
      ),
    ).toBe(false)
  })

  it('returns false with no context', () => {
    expect(
      evalCondition(
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
        seed,
        state,
        {},
      ),
    ).toBe(false)
  })
})
