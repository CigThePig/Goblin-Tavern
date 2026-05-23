// Phase 132 / ISSUE-101 — Voiced Surface arc, Phase 6.
//
// Unit tests for the four new condition primitives that read the
// iteration context the choice helper (`composeChoicesFromSeed`) threads
// in: `responseVerb`, `responseShape`, `effectKind`, `effectTag`. Each
// arm gets:
//   - positive case (context present, condition matches)
//   - negative case (context present, condition mismatches)
//   - "no-context" case (context omitted → returns false; this is the
//     graceful-degradation behaviour that lets body / title slot
//     evaluation ignore these primitives entirely)

import { describe, expect, it } from 'vitest'

import { evalCondition } from '../../../src/cards/compose/conditions'
import type { ConditionContext } from '../../../src/cards/compose/types'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type {
  IssueSeedFamilyId,
  ResponseIntentShape,
  ResponseIntentVerb,
  ResponseSlot,
} from '../../../src/sim/modules/issues/issueSeedTypes'
import type { EffectPreview } from '../../../src/sim/core/effect'
import { makeSeed } from '../cardFactories'

const seed = makeSeed({ id: 'phase132-conditions' })
const state = createInitialTavernState()

function appeaseSlot(): ResponseSlot {
  return {
    id: 'phase132-conditions-appease',
    labelHint: 'Smooth it over',
    allowedVerbs: ['appease'] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: [],
  }
}

function ignoreSlot(): ResponseSlot {
  return {
    id: 'phase132-conditions-ignore',
    labelHint: 'Let it ride',
    allowedVerbs: ['ignore'] as ResponseIntentVerb[],
    shape: 'ignore' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: [],
  }
}

function regularsEffect(): EffectPreview {
  return {
    kind: 'state_change',
    target: 'world.regulars.irritation',
    amount: -5,
    readable: 'the regular settles',
    tags: ['regulars'],
  }
}

function pressureEffect(): EffectPreview {
  return {
    kind: 'pressure',
    target: 'pressure.maintenance',
    amount: 2,
    readable: 'maintenance pressure climbs',
    tags: ['maintenance'],
  }
}

describe('Phase 132 / ISSUE-101 — responseVerb condition', () => {
  it('matches when the current response slot lists the verb in allowedVerbs', () => {
    const ctx: ConditionContext = { currentResponseSlot: appeaseSlot() }
    expect(
      evalCondition(
        { kind: 'responseVerb', anyOf: ['appease'] },
        seed,
        state,
        ctx,
      ),
    ).toBe(true)
  })

  it('does not match when the verb is absent from allowedVerbs', () => {
    const ctx: ConditionContext = { currentResponseSlot: ignoreSlot() }
    expect(
      evalCondition(
        { kind: 'responseVerb', anyOf: ['appease', 'pay'] },
        seed,
        state,
        ctx,
      ),
    ).toBe(false)
  })

  it('returns false when no currentResponseSlot context is provided', () => {
    // Body / title slot evaluation passes no context — the condition
    // must degrade silently so a less-specific snippet wins.
    expect(
      evalCondition(
        { kind: 'responseVerb', anyOf: ['appease'] },
        seed,
        state,
      ),
    ).toBe(false)
  })
})

describe('Phase 132 / ISSUE-101 — responseShape condition', () => {
  it('matches when the current response slot has a listed shape', () => {
    const ctx: ConditionContext = { currentResponseSlot: appeaseSlot() }
    expect(
      evalCondition(
        { kind: 'responseShape', anyOf: ['safe_costly', 'compromise'] },
        seed,
        state,
        ctx,
      ),
    ).toBe(true)
  })

  it('does not match when the current shape is not in the list', () => {
    const ctx: ConditionContext = { currentResponseSlot: ignoreSlot() }
    expect(
      evalCondition(
        { kind: 'responseShape', anyOf: ['safe_costly'] },
        seed,
        state,
        ctx,
      ),
    ).toBe(false)
  })

  it('returns false when no currentResponseSlot context is provided', () => {
    expect(
      evalCondition(
        { kind: 'responseShape', anyOf: ['safe_costly'] },
        seed,
        state,
      ),
    ).toBe(false)
  })
})

describe('Phase 132 / ISSUE-101 — effectKind condition', () => {
  it('matches when the current effect kind is in the list', () => {
    const ctx: ConditionContext = { currentEffect: regularsEffect() }
    expect(
      evalCondition(
        { kind: 'effectKind', anyOf: ['state_change'] },
        seed,
        state,
        ctx,
      ),
    ).toBe(true)
  })

  it('does not match when the effect kind is excluded', () => {
    const ctx: ConditionContext = { currentEffect: regularsEffect() }
    expect(
      evalCondition(
        { kind: 'effectKind', anyOf: ['memory', 'cause'] },
        seed,
        state,
        ctx,
      ),
    ).toBe(false)
  })

  it('returns false when no currentEffect context is provided', () => {
    expect(
      evalCondition(
        { kind: 'effectKind', anyOf: ['state_change'] },
        seed,
        state,
      ),
    ).toBe(false)
  })
})

describe('Phase 132 / ISSUE-101 — effectTag condition', () => {
  it('matches when the current effect carries the tag', () => {
    const ctx: ConditionContext = { currentEffect: regularsEffect() }
    expect(
      evalCondition(
        { kind: 'effectTag', tag: 'regulars' },
        seed,
        state,
        ctx,
      ),
    ).toBe(true)
  })

  it('does not match when the current effect lacks the tag', () => {
    const ctx: ConditionContext = { currentEffect: pressureEffect() }
    expect(
      evalCondition(
        { kind: 'effectTag', tag: 'regulars' },
        seed,
        state,
        ctx,
      ),
    ).toBe(false)
  })

  it('returns false when no currentEffect context is provided', () => {
    expect(
      evalCondition(
        { kind: 'effectTag', tag: 'regulars' },
        seed,
        state,
      ),
    ).toBe(false)
  })
})

describe('Phase 132 / ISSUE-101 — existing condition arms ignore ctx', () => {
  // Spot-check: the four new arms must not regress the existing 14
  // primitives' behaviour when a context is passed but unused. Pick a
  // representative existing condition; it must evaluate identically with
  // or without context.
  it('seedFamily evaluates the same with or without ConditionContext', () => {
    const ctx: ConditionContext = { currentResponseSlot: appeaseSlot() }
    const withoutCtx = evalCondition(
      { kind: 'seedFamily', anyOf: [seed.family as IssueSeedFamilyId] },
      seed,
      state,
    )
    const withCtx = evalCondition(
      { kind: 'seedFamily', anyOf: [seed.family as IssueSeedFamilyId] },
      seed,
      state,
      ctx,
    )
    expect(withCtx).toBe(withoutCtx)
    expect(withCtx).toBe(true)
  })
})
