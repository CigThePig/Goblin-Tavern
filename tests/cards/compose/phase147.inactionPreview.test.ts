// Phase 147 / ISSUE-115 — Legible Surface arc, Phase 2.
//
// Unit coverage for the `inactionPreview` condition primitive and the
// inaction routing in `composeChoicesFromSeed`. Mirrors the
// `phase132.responseConditions.test.ts` shape: one block per concern
// (primitive returns, ctx threading, end-to-end through the helper).

import { describe, expect, it } from 'vitest'

import { evalCondition } from '../../../src/cards/compose/conditions'
import { composeChoicesFromSeed } from '../../../src/cards/cardHelpers'
import type {
  ConditionContext,
  SnippetCondition,
  SnippetPool,
} from '../../../src/cards/compose/types'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type {
  ConsequenceProfile,
  IssueSeed,
  ResponseSlot,
} from '../../../src/sim/modules/issues/issueSeedTypes'
import { effect } from '../../../src/sim/modules/issues/generatorHelpers'
import { makeSeed } from '../cardFactories'

// ---- evalCondition('inactionPreview') ----

describe('inactionPreview condition primitive', () => {
  const seed: IssueSeed = makeSeed({
    id: 'inaction-primitive-test',
    family: 'area_atmosphere',
    type: 'warning',
    timing: 'morning_prep',
    severity: 40,
    domain: ['areas'],
  })
  const state = createInitialTavernState()

  const valueTrue: SnippetCondition = { kind: 'inactionPreview', value: true }
  const valueFalse: SnippetCondition = { kind: 'inactionPreview', value: false }

  it('returns true when ctx.inactionPreview is true and value matches', () => {
    const ctx: ConditionContext = { inactionPreview: true }
    expect(evalCondition(valueTrue, seed, state, ctx)).toBe(true)
  })

  it('returns false when ctx.inactionPreview is true but value is false', () => {
    const ctx: ConditionContext = { inactionPreview: true }
    expect(evalCondition(valueFalse, seed, state, ctx)).toBe(false)
  })

  it('returns true when ctx.inactionPreview is false and value matches', () => {
    const ctx: ConditionContext = { inactionPreview: false }
    expect(evalCondition(valueFalse, seed, state, ctx)).toBe(true)
  })

  it('returns false when ctx.inactionPreview is absent (graceful degradation)', () => {
    expect(evalCondition(valueTrue, seed, state, {})).toBe(false)
    expect(evalCondition(valueFalse, seed, state, {})).toBe(false)
  })

  it('returns false when ctx is omitted entirely (legacy callers)', () => {
    expect(evalCondition(valueTrue, seed, state)).toBe(false)
    expect(evalCondition(valueFalse, seed, state)).toBe(false)
  })
})

// ---- composeChoicesFromSeed inaction wiring ----

function buildSeed(profiles: ConsequenceProfile[]): IssueSeed {
  const slots: ResponseSlot[] = profiles.map((p) => ({
    id: p.responseSlotId,
    labelHint: `Slot ${p.responseSlotId}`,
    allowedVerbs: [p.responseSlotId.startsWith('ignore') ? 'ignore' : 'appease'],
    shape: p.responseSlotId.startsWith('ignore') ? 'ignore' : 'safe_costly',
    targetOptions: [],
    expectedEffects: [],
  }))
  return makeSeed({
    id: 'inaction-wiring-seed',
    family: 'area_atmosphere',
    type: 'warning',
    timing: 'morning_prep',
    severity: 40,
    domain: ['areas'],
    responseSlots: slots,
    consequenceProfiles: profiles,
  })
}

const EMPTY_LABEL_POOL: SnippetPool = {
  slotId: 'choice_label',
  snippets: [],
}

/** A preview pool with an unconditional inaction-only snippet (fires only
 *  when ctx.inactionPreview === true) plus a generic acting-path snippet
 *  gated on inactionPreview === false. Lets us assert routing across
 *  the two paths without false positives. */
const PREVIEW_POOL: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    {
      id: 'inaction_marker',
      text: 'INACTION_PATH_LINE',
      conditions: [{ kind: 'inactionPreview', value: true }],
    },
    {
      id: 'acting_marker',
      text: 'ACTING_PATH_LINE',
      conditions: [{ kind: 'inactionPreview', value: false }],
    },
  ],
}

describe('composeChoicesFromSeed — inaction wiring', () => {
  const state = createInitialTavernState()

  it('routes through delayedEffects when immediateEffects is empty', () => {
    const profiles: ConsequenceProfile[] = [
      {
        id: 'p_ignore',
        responseSlotId: 'ignore_slot',
        immediateEffects: [],
        delayedEffects: [
          effect('pressure', 'pressure:maintenance', 10, 'pressure rises', [
            'pressure',
          ]),
          effect('state_change', 'areas.main.condition', -8, 'condition drops', [
            'area',
          ]),
        ],
        memories: [],
        futureHooks: [],
        impactScore: 0,
      },
    ]
    const seed = buildSeed(profiles)
    const choices = composeChoicesFromSeed(seed, state, {
      labelPool: EMPTY_LABEL_POOL,
      previewPool: PREVIEW_POOL,
    })
    expect(choices).toHaveLength(1)
    const ignore = choices[0]!
    // Two delayed effects → two preview lines, both via the inaction path
    // → both fire the inaction-gated snippet.
    expect(ignore.previewEffects).toHaveLength(2)
    for (const line of ignore.previewEffects) {
      expect(line).toBe('INACTION_PATH_LINE')
    }
  })

  it('uses immediateEffects when present, ignoring delayedEffects', () => {
    const profiles: ConsequenceProfile[] = [
      {
        id: 'p_act',
        responseSlotId: 'act_slot',
        immediateEffects: [
          effect('state_change', 'areas.main.cleanliness', 20, 'clean', [
            'area',
          ]),
        ],
        delayedEffects: [
          effect('pressure', 'pressure:maintenance', -10, 'pressure eases', [
            'pressure',
          ]),
        ],
        memories: [],
        futureHooks: [],
        impactScore: 0,
      },
    ]
    const seed = buildSeed(profiles)
    const choices = composeChoicesFromSeed(seed, state, {
      labelPool: EMPTY_LABEL_POOL,
      previewPool: PREVIEW_POOL,
    })
    expect(choices).toHaveLength(1)
    expect(choices[0]!.previewEffects).toHaveLength(1)
    expect(choices[0]!.previewEffects[0]).toBe('ACTING_PATH_LINE')
  })

  it('renders zero lines when both immediate and delayed are empty (no route to source)', () => {
    const profiles: ConsequenceProfile[] = [
      {
        id: 'p_void',
        responseSlotId: 'void_slot',
        immediateEffects: [],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 0,
      },
    ]
    const seed = buildSeed(profiles)
    const choices = composeChoicesFromSeed(seed, state, {
      labelPool: EMPTY_LABEL_POOL,
      previewPool: PREVIEW_POOL,
    })
    expect(choices).toHaveLength(1)
    expect(choices[0]!.previewEffects).toEqual([])
  })

  it('respects maxPreview on the inaction path', () => {
    const profiles: ConsequenceProfile[] = [
      {
        id: 'p_cap',
        responseSlotId: 'cap_slot',
        immediateEffects: [],
        delayedEffects: [
          effect('pressure', 'pressure:maintenance', 10, 'rise', ['pressure']),
          effect('state_change', 'areas.main.condition', -8, 'drop', ['area']),
          effect('state_change', 'areas.main.damage', 6, 'damage', ['area']),
          effect('state_change', 'areas.main.cleanliness', -5, 'dirty', ['area']),
        ],
        memories: [],
        futureHooks: [],
        impactScore: 0,
      },
    ]
    const seed = buildSeed(profiles)
    const choices = composeChoicesFromSeed(seed, state, {
      labelPool: EMPTY_LABEL_POOL,
      previewPool: PREVIEW_POOL,
      maxPreview: 2,
    })
    expect(choices[0]!.previewEffects).toHaveLength(2)
  })

  it('preserves mechanical truth: choice verb / shape / slotId unchanged regardless of routing', () => {
    const profiles: ConsequenceProfile[] = [
      {
        id: 'p_act',
        responseSlotId: 'act_slot',
        immediateEffects: [
          effect('state_change', 'coin', -10, 'pay', ['coin']),
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 0,
      },
      {
        id: 'p_ignore',
        responseSlotId: 'ignore_slot',
        immediateEffects: [],
        delayedEffects: [
          effect('pressure', 'pressure:maintenance', 10, 'rise', ['pressure']),
        ],
        memories: [],
        futureHooks: [],
        impactScore: 0,
      },
    ]
    const seed = buildSeed(profiles)
    const choices = composeChoicesFromSeed(seed, state, {
      labelPool: EMPTY_LABEL_POOL,
      previewPool: PREVIEW_POOL,
    })
    expect(choices).toHaveLength(2)
    expect(choices[0]!.slotId).toBe('act_slot')
    expect(choices[0]!.verb).toBe('appease')
    expect(choices[0]!.shape).toBe('safe_costly')
    expect(choices[1]!.slotId).toBe('ignore_slot')
    expect(choices[1]!.verb).toBe('ignore')
    expect(choices[1]!.shape).toBe('ignore')
  })

  it('is deterministic across re-renders on the inaction path', () => {
    const profiles: ConsequenceProfile[] = [
      {
        id: 'p_ignore',
        responseSlotId: 'ignore_slot',
        immediateEffects: [],
        delayedEffects: [
          effect('pressure', 'pressure:maintenance', 10, 'rise', ['pressure']),
          effect('state_change', 'areas.main.condition', -8, 'drop', ['area']),
        ],
        memories: [],
        futureHooks: [],
        impactScore: 0,
      },
    ]
    const seed = buildSeed(profiles)
    const a = composeChoicesFromSeed(seed, state, {
      labelPool: EMPTY_LABEL_POOL,
      previewPool: PREVIEW_POOL,
    })
    const b = composeChoicesFromSeed(seed, state, {
      labelPool: EMPTY_LABEL_POOL,
      previewPool: PREVIEW_POOL,
    })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
