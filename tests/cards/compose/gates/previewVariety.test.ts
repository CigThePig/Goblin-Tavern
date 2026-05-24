// Phase 144 / ISSUE-113 — Voiced Surface arc, Phase 18.
//
// Two fixture-driven tests prove the new 8th gate fires on the two
// failure modes the screenshot pattern produces, and stays silent on a
// healthy pool that follows the specificity-gradient repair pattern
// (unconditional base rung per effect kind).

import { describe, expect, it } from 'vitest'

import {
  PREVIEW_VARIETY_DEFAULTS,
  PREVIEW_VARIETY_REASONS,
  checkPreviewVariety,
  type PreviewVarietyChoice,
  type PreviewVarietySample,
  type PreviewVarietySampler,
} from '../../../../src/cards/compose/gates'
import type {
  SnippetPool,
} from '../../../../src/cards/compose/types'
import type {
  IssueSeed,
  ResponseSlot,
} from '../../../../src/sim/modules/issues/issueSeedTypes'
import type { EffectPreview } from '../../../../src/sim/core/effect'
import { createInitialTavernState } from '../../../../src/sim/state/defaults'
import { makeSeed } from '../../cardFactories'

// ---- minimal render-shape fixtures ----

const RESPONSE_SLOTS: readonly ResponseSlot[] = [
  {
    id: 'slot_a',
    labelHint: 'Appease',
    allowedVerbs: ['appease'],
    shape: 'safe_costly',
    targetOptions: [],
    expectedEffects: [],
  },
  {
    id: 'slot_b',
    labelHint: 'Ignore',
    allowedVerbs: ['ignore'],
    shape: 'ignore',
    targetOptions: [],
    expectedEffects: [],
  },
  {
    id: 'slot_c',
    labelHint: 'Negotiate',
    allowedVerbs: ['negotiate'],
    shape: 'compromise',
    targetOptions: [],
    expectedEffects: [],
  },
]

const STATE_CHANGE_EFFECT: EffectPreview = {
  kind: 'state_change',
  target: 'noop',
  amount: 0,
  readable: 'nothing changes',
  tags: [],
}

const PRESSURE_EFFECT: EffectPreview = {
  kind: 'pressure',
  target: 'reputation_drift',
  amount: 1,
  readable: 'pressure ticks up',
  tags: [],
}

const SEED: IssueSeed = makeSeed({
  id: 'preview-variety-fixture-seed',
  family: 'regular_customer',
  type: 'relationship_test',
  timing: 'during_service',
  severity: 30,
  domain: ['regulars'],
})

const STATE = createInitialTavernState()

// ---- the BAD pool: single snippet matches every state_change effect ----
//
// This pool reproduces the screenshot defect. One `state_change`-gated
// snippet, no unconditional fallback. Every effect on every choice
// resolves to the same text — `pickSnippet` finds one match, the FNV
// tie-break has nothing to vary across.

const COLLAPSED_POOL: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    {
      id: 'only_state_change',
      text: 'the room steadies its footing',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
  ],
}

// ---- the HEALTHY pool: three unconditional `state_change` snippets ----
//
// The specificity-gradient repair pattern from the Phase 18 plan: a
// base rung of unconditional snippets per kind. The FNV tie-break on
// the per-effect synthetic slot id `effect_preview::${slotId}::${idx}`
// resolves to different snippets across effects on the same card.

const HEALTHY_POOL: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    {
      id: 'base_state_change_a',
      text: 'the room steadies a beat',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'base_state_change_b',
      text: 'the floor catches the change',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'base_state_change_c',
      text: 'a quiet shift threads through',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'base_pressure_a',
      text: 'the meter inches its way',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'base_pressure_b',
      text: 'pressure lifts another notch',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
  ],
}

function makeSampler(
  pool: SnippetPool,
  choices: readonly PreviewVarietyChoice[],
  count = 6,
): PreviewVarietySampler {
  return (i) => {
    void i
    const sample: PreviewVarietySample = {
      seed: SEED,
      state: STATE,
      previewPool: pool,
      choices,
      maxPreview: 4,
    }
    void count
    return sample
  }
}

// The screenshot card render shape: three response slots, each with two
// state_change effects. The collapsed pool returns the same text for
// all six lines — both the run-length rule AND the unique-ratio rule
// should bite.

const SCREENSHOT_CHOICES: readonly PreviewVarietyChoice[] = RESPONSE_SLOTS.map(
  (slot) => ({
    slot,
    effects: [STATE_CHANGE_EFFECT, STATE_CHANGE_EFFECT],
  }),
)

// A mixed render that should fire `card_render_low_diversity` but not
// `within_card_preview_collapse` — alternates state_change with the
// pressure-pool fallback so no run reaches 3, yet 8 of 12 lines share
// the same snippet text. Ratio = 4 unique (3 readable variants + the
// collapsed snippet) / 12 = 0.33; with `minUniqueRatio: 0.6` forced in
// the test config, the rule fires.

const PRESSURE_EFFECT_2: EffectPreview = {
  ...PRESSURE_EFFECT,
  readable: 'pressure ticks again',
}
const PRESSURE_EFFECT_3: EffectPreview = {
  ...PRESSURE_EFFECT,
  readable: 'pressure carries forward',
}

const MIXED_CHOICES: readonly PreviewVarietyChoice[] = [
  {
    slot: RESPONSE_SLOTS[0]!,
    effects: [
      STATE_CHANGE_EFFECT,
      STATE_CHANGE_EFFECT,
      STATE_CHANGE_EFFECT,
      PRESSURE_EFFECT,
    ],
  },
  {
    slot: RESPONSE_SLOTS[1]!,
    effects: [
      STATE_CHANGE_EFFECT,
      STATE_CHANGE_EFFECT,
      STATE_CHANGE_EFFECT,
      PRESSURE_EFFECT_2,
    ],
  },
  {
    slot: RESPONSE_SLOTS[2]!,
    effects: [
      STATE_CHANGE_EFFECT,
      STATE_CHANGE_EFFECT,
      STATE_CHANGE_EFFECT,
      PRESSURE_EFFECT_3,
    ],
  },
]

describe('previewVariety gate — failure fixtures', () => {
  it('flags within_card_preview_collapse when ≥3 identical preview lines render in a row', () => {
    const sampler = makeSampler(COLLAPSED_POOL, SCREENSHOT_CHOICES)
    const report = checkPreviewVariety(sampler, { sampleSize: 5 })
    expect(report.pass).toBe(false)
    const reasons = report.violations.map((v) => v.reason)
    expect(reasons).toContain('within_card_preview_collapse')
    expect(report.observed.maxIdenticalRun).toBeGreaterThanOrEqual(3)
  })

  it('flags card_render_low_diversity when unique-ratio falls below the threshold', () => {
    // Mixed effects break the run but most lines still duplicate. With
    // a strict 0.6 threshold the unique-ratio rule fires even though
    // the default 0.15 wouldn't.
    const sampler = makeSampler(COLLAPSED_POOL, MIXED_CHOICES)
    const report = checkPreviewVariety(sampler, {
      sampleSize: 5,
      // Force the ratio rule to bite even if the run rule didn't.
      maxIdenticalRun: 10,
      minUniqueRatio: 0.6,
    })
    expect(report.pass).toBe(false)
    const reasons = report.violations.map((v) => v.reason)
    expect(reasons).toContain('card_render_low_diversity')
    expect(report.observed.minUniqueRatio).toBeLessThan(0.6)
  })
})

describe('previewVariety gate — happy path', () => {
  it('passes when the pool has multiple unconditional snippets per effect kind', () => {
    const sampler = makeSampler(HEALTHY_POOL, SCREENSHOT_CHOICES)
    const report = checkPreviewVariety(sampler, { sampleSize: 5 })
    expect(report.pass).toBe(true)
    expect(report.violations).toEqual([])
    expect(report.observed.maxIdenticalRun).toBeLessThanOrEqual(2)
    expect(report.observed.minUniqueRatio).toBeGreaterThanOrEqual(
      PREVIEW_VARIETY_DEFAULTS.minUniqueRatio,
    )
  })

  it('passes silently when sampler produces no preview lines', () => {
    const noEffectSampler: PreviewVarietySampler = () => ({
      seed: SEED,
      state: STATE,
      previewPool: HEALTHY_POOL,
      choices: [],
    })
    const report = checkPreviewVariety(noEffectSampler, { sampleSize: 3 })
    expect(report.pass).toBe(true)
    expect(report.violations).toEqual([])
    expect(report.observed.sampleSize).toBe(0)
  })
})

// ---- Phase 145 / ISSUE-113 (iteration 2) — specificity rule ----

const COIN_LOSS_EFFECT: EffectPreview = {
  kind: 'state_change',
  target: 'coin',
  amount: -25,
  readable: 'Pay landlord',
  tags: ['coin'],
  targetKind: 'coin',
  direction: 'negative',
  magnitudeBand: 'medium',
}

const STOCK_LOSS_EFFECT: EffectPreview = {
  kind: 'state_change',
  target: 'stock.ale.quantity',
  amount: -20,
  readable: 'Pour out the bad ale',
  tags: ['stock'],
  targetKind: 'stock',
  direction: 'negative',
  magnitudeBand: 'small',
}

const PRESSURE_EFFECT_TYPED: EffectPreview = {
  kind: 'pressure',
  target: 'pressure:food_safety',
  amount: -10,
  readable: 'Lower food safety risk',
  tags: ['pressure'],
  targetKind: 'pressure',
  direction: 'negative',
  magnitudeBand: 'medium',
}

const TYPED_CHOICES: readonly PreviewVarietyChoice[] = [
  { slot: RESPONSE_SLOTS[0]!, effects: [COIN_LOSS_EFFECT, STOCK_LOSS_EFFECT] },
  {
    slot: RESPONSE_SLOTS[1]!,
    effects: [COIN_LOSS_EFFECT, PRESSURE_EFFECT_TYPED],
  },
  {
    slot: RESPONSE_SLOTS[2]!,
    effects: [STOCK_LOSS_EFFECT, PRESSURE_EFFECT_TYPED],
  },
]

// A pool that varies (passes variety) but says nothing about the meter.
// Three distinct snippets, all of them generic enough to fail
// specificity. The Phase-144 base rung — "the room steadies a beat" /
// "a quiet shift threads through" — is exactly this shape.
const GENERIC_VARIED_POOL: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    {
      id: 'gen_a',
      text: 'the room steadies a beat',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change', 'pressure'] }],
    },
    {
      id: 'gen_b',
      text: 'a quiet shift threads through',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change', 'pressure'] }],
    },
    {
      id: 'gen_c',
      text: 'the count tilts a notch',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change', 'pressure'] }],
    },
  ],
}

// A pool where every snippet uses the targetKind keyword set. The
// rendered lines all name what changed.
const SPECIFIC_POOL: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    {
      id: 'spec_coin_neg',
      text: 'the till lightens by a hand',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
    {
      id: 'spec_stock_neg',
      text: 'shelves would thin a measure',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['stock'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
    {
      id: 'spec_pressure_neg',
      text: 'the meter would settle a notch',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
  ],
}

describe('previewVariety gate — specificity rule (Phase 145)', () => {
  it('flags preview_specificity_low when a varied pool says nothing about the meter', () => {
    const sampler = makeSampler(GENERIC_VARIED_POOL, TYPED_CHOICES)
    const report = checkPreviewVariety(sampler, {
      sampleSize: 4,
      specificity: { minSpecificityRatio: 0.5 },
    })
    expect(report.pass).toBe(false)
    const reasons = report.violations.map((v) => v.reason)
    expect(reasons).toContain('preview_specificity_low')
    expect(report.observed.specificityRatio).toBeLessThan(0.5)
  })

  it('passes specificity when every line names its targetKind', () => {
    const sampler = makeSampler(SPECIFIC_POOL, TYPED_CHOICES)
    const report = checkPreviewVariety(sampler, {
      sampleSize: 4,
      specificity: { minSpecificityRatio: 0.7 },
    })
    expect(report.pass).toBe(true)
    expect(report.observed.specificityRatio).toBeGreaterThanOrEqual(0.7)
  })

  it('counts sim-emitted readable fallthrough as specific (sim is authoritative)', () => {
    // Empty pool → every line falls back to `effect.readable` which IS
    // the sim's specific translation. The specificity rule must NOT
    // penalise sim fallthrough.
    const emptyPool: SnippetPool = { slotId: 'effect_preview', snippets: [] }
    const sampler = makeSampler(emptyPool, TYPED_CHOICES)
    const report = checkPreviewVariety(sampler, {
      sampleSize: 3,
      specificity: { minSpecificityRatio: 1 },
    })
    expect(report.pass).toBe(true)
    expect(report.observed.specificityRatio).toBe(1)
  })

  it('is opt-in: omitting the specificity config preserves Phase-144 behaviour', () => {
    // The generic pool was failing specificity above; without the
    // specificity rule it must pass (variety rules alone don't catch
    // generic-but-varied text).
    const sampler = makeSampler(GENERIC_VARIED_POOL, TYPED_CHOICES)
    const report = checkPreviewVariety(sampler, { sampleSize: 4 })
    expect(report.pass).toBe(true)
    expect(report.observed.specificityRatio).toBeUndefined()
  })
})

describe('previewVariety gate — frozen reason tuple', () => {
  it('exports the failure reasons as a frozen tuple', () => {
    // Phase 145 / ISSUE-113 — `preview_specificity_low` joined as the
    // third reason when the iteration-2 specificity rule landed.
    expect(PREVIEW_VARIETY_REASONS).toEqual([
      'within_card_preview_collapse',
      'card_render_low_diversity',
      'preview_specificity_low',
    ])
    expect(Object.isFrozen(PREVIEW_VARIETY_REASONS)).toBe(true)
  })
})
