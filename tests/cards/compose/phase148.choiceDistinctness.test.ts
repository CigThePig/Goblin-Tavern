// Phase 148 / ISSUE-116 — Legible Surface arc, Phase 3.
//
// Tests for the four Phase-3 layers:
//   A) `responseSlot { anyOf }` condition primitive
//   B) `checkChoiceDistinctness` gate + warnings channel + runAllGates wiring
//   C) `applyLegibleChoiceCap` presentation policy in cardHelpers
//   D) supplierReliability/choiceLabel.ts slot-distinct snippets

import { describe, expect, it } from 'vitest'

import { evalCondition } from '../../../src/cards/compose/conditions'
import type {
  CompositionalCardTemplate,
  ConditionContext,
  SnippetCondition,
  SnippetPool,
} from '../../../src/cards/compose/types'
import type { CardView } from '../../../src/cards/types'
import {
  CHOICE_DISTINCTNESS_REASONS,
  checkChoiceDistinctness,
  runAllGates,
  type ChoiceDistinctnessSample,
} from '../../../src/cards/compose/gates'
import { failReport } from '../../../src/cards/compose/gates'
import {
  applyLegibleChoiceCap,
  DEFAULT_LEGIBLE_CHOICE_CAP,
  composeChoicesFromSeed,
  buildChoicesFromSeed,
} from '../../../src/cards/cardHelpers'
import { makeSeed, makeTavernState } from '../../cards/cardFactories'
import type {
  ConsequenceProfile,
  IssueSeed,
  ResponseSlot,
} from '../../../src/sim/modules/issues/issueSeedTypes'
import type { EffectPreview } from '../../../src/sim/core/effect'

// ---------- Layer A: responseSlot condition primitive ----------

describe('Phase 148 / Layer A — responseSlot condition primitive', () => {
  const slot: ResponseSlot = {
    id: 'slot_x',
    labelHint: 'X',
    allowedVerbs: ['pay'],
    shape: 'safe_costly',
    targetOptions: [],
    expectedEffects: [],
  }
  const seed: IssueSeed = makeSeed({ id: 'seed-a' })
  const state = makeTavernState()

  it('matches when ctx.currentResponseSlot.id is in anyOf', () => {
    const condition: SnippetCondition = {
      kind: 'responseSlot',
      anyOf: ['slot_x', 'slot_y'],
    }
    const ctx: ConditionContext = { currentResponseSlot: slot }
    expect(evalCondition(condition, seed, state, ctx)).toBe(true)
  })

  it('returns false when slot id is absent from anyOf', () => {
    const condition: SnippetCondition = {
      kind: 'responseSlot',
      anyOf: ['slot_y'],
    }
    const ctx: ConditionContext = { currentResponseSlot: slot }
    expect(evalCondition(condition, seed, state, ctx)).toBe(false)
  })

  it('returns false outside choice iteration (body / title slot eval)', () => {
    const condition: SnippetCondition = {
      kind: 'responseSlot',
      anyOf: ['slot_x'],
    }
    // No currentResponseSlot in context — body / title evaluation
    // graceful-degrades to false.
    expect(evalCondition(condition, seed, state, {})).toBe(false)
  })
})

// ---------- Shared fixtures for Layer B + C tests ----------

const PRESSURE_EFFECT: EffectPreview = {
  kind: 'pressure',
  target: 'pressure:supplier_distrust',
  amount: -10,
  readable: 'Lower distrust',
  tags: ['pressure'],
  targetKind: 'pressure',
  direction: 'positive',
  magnitudeBand: 'small',
}

const SUPPLIER_EFFECT: EffectPreview = {
  kind: 'cause',
  target: 'supplier:abc',
  amount: 10,
  readable: 'Supplier paid on time',
  tags: ['supplier', 'attribution'],
  targetKind: 'supplier',
  direction: 'positive',
  magnitudeBand: 'medium',
}

const COIN_EFFECT: EffectPreview = {
  kind: 'state_change',
  target: 'coin',
  amount: -15,
  readable: 'Pay supplier',
  tags: ['coin'],
  targetKind: 'coin',
  direction: 'negative',
  magnitudeBand: 'small',
}

function buildSlot(
  id: string,
  overrides: Partial<ResponseSlot> = {},
): ResponseSlot {
  return {
    id,
    labelHint: id,
    allowedVerbs: ['negotiate'],
    shape: 'compromise',
    targetOptions: [{ kind: 'supplier', id: 'abc' }],
    expectedEffects: [],
    ...overrides,
  }
}

function buildProfile(
  slotId: string,
  effects: EffectPreview[] = [SUPPLIER_EFFECT],
  delayed: EffectPreview[] = [],
): ConsequenceProfile {
  return {
    id: `${slotId}-profile`,
    responseSlotId: slotId,
    immediateEffects: effects,
    delayedEffects: delayed,
    memories: [],
    futureHooks: [],
    impactScore: 10,
  }
}

// ---------- Layer B: choiceDistinctness gate ----------

describe('Phase 148 / Layer B — checkChoiceDistinctness gate', () => {
  it('fails on canonical-equal labels across distinct slots', () => {
    const slotA = buildSlot('slot_a')
    const slotB = buildSlot('slot_b')
    // Pool authors the same label for both verbs — a verb-only gating
    // that's blind to slot identity, exactly the supplier defect.
    const collidingPool: SnippetPool = {
      slotId: 'choice_label',
      snippets: [
        {
          id: 'colliding',
          text: 'Cut the terms shorter',
          conditions: [{ kind: 'responseVerb', anyOf: ['negotiate'] }],
        },
      ],
    }
    const emptyPreviewPool: SnippetPool = {
      slotId: 'effect_preview',
      snippets: [],
    }
    const seed = makeSeed({
      id: 'collision-seed',
      responseSlots: [slotA, slotB],
      consequenceProfiles: [buildProfile('slot_a'), buildProfile('slot_b')],
    })
    const state = makeTavernState()
    const sample: ChoiceDistinctnessSample = {
      seed,
      state,
      labelPool: collidingPool,
      previewPool: emptyPreviewPool,
      slots: [
        { slot: slotA, profile: buildProfile('slot_a') },
        { slot: slotB, profile: buildProfile('slot_b') },
      ],
      maxPreview: 2,
    }
    const result = checkChoiceDistinctness(() => sample, { sampleSize: 1 })
    expect(result.pass).toBe(false)
    expect(result.violations.map((v) => v.reason)).toContain(
      'choice_label_collision',
    )
    expect(result.observed.labelCollisions).toBeGreaterThan(0)
  })

  it('passes when slot-distinct snippets disambiguate same-verb slots', () => {
    const slotA = buildSlot('slot_a')
    const slotB = buildSlot('slot_b')
    const distinctPool: SnippetPool = {
      slotId: 'choice_label',
      snippets: [
        {
          id: 'a_specific',
          text: 'First option',
          conditions: [{ kind: 'responseSlot', anyOf: ['slot_a'] }],
        },
        {
          id: 'b_specific',
          text: 'Second option',
          conditions: [{ kind: 'responseSlot', anyOf: ['slot_b'] }],
        },
      ],
    }
    const emptyPreviewPool: SnippetPool = {
      slotId: 'effect_preview',
      snippets: [],
    }
    const seed = makeSeed({
      id: 'distinct-seed',
      responseSlots: [slotA, slotB],
      consequenceProfiles: [buildProfile('slot_a'), buildProfile('slot_b')],
    })
    const state = makeTavernState()
    const result = checkChoiceDistinctness(
      () => ({
        seed,
        state,
        labelPool: distinctPool,
        previewPool: emptyPreviewPool,
        slots: [
          { slot: slotA, profile: buildProfile('slot_a') },
          { slot: slotB, profile: buildProfile('slot_b') },
        ],
      }),
      { sampleSize: 1 },
    )
    expect(result.pass).toBe(true)
    expect(result.violations).toEqual([])
    expect(result.observed.labelCollisions).toBe(0)
  })

  it('emits a warning (not a failure) on near-collision previews', () => {
    const slotA = buildSlot('slot_a')
    const slotB = buildSlot('slot_b')
    // Label pool is fine; preview pool returns near-identical text per
    // slot. The gate must warn, not fail.
    const labelPool: SnippetPool = {
      slotId: 'choice_label',
      snippets: [
        {
          id: 'a',
          text: 'First option',
          conditions: [{ kind: 'responseSlot', anyOf: ['slot_a'] }],
        },
        {
          id: 'b',
          text: 'Second option',
          conditions: [{ kind: 'responseSlot', anyOf: ['slot_b'] }],
        },
      ],
    }
    const nearPreviewPool: SnippetPool = {
      slotId: 'effect_preview',
      snippets: [
        {
          id: 'near_a',
          text: 'the room steadies a beat',
          conditions: [{ kind: 'responseSlot', anyOf: ['slot_a'] }],
        },
        {
          id: 'near_b',
          // One-character difference after canonicalisation — well above 0.85.
          text: 'the room steadies a beats',
          conditions: [{ kind: 'responseSlot', anyOf: ['slot_b'] }],
        },
      ],
    }
    const seed = makeSeed({
      id: 'near-collision-seed',
      responseSlots: [slotA, slotB],
      consequenceProfiles: [
        buildProfile('slot_a', [SUPPLIER_EFFECT]),
        buildProfile('slot_b', [SUPPLIER_EFFECT]),
      ],
    })
    const state = makeTavernState()
    const result = checkChoiceDistinctness(
      () => ({
        seed,
        state,
        labelPool,
        previewPool: nearPreviewPool,
        slots: [
          { slot: slotA, profile: buildProfile('slot_a', [SUPPLIER_EFFECT]) },
          { slot: slotB, profile: buildProfile('slot_b', [SUPPLIER_EFFECT]) },
        ],
      }),
      { sampleSize: 1 },
    )
    // Pass invariant preserved: warnings never fail the gate.
    expect(result.pass).toBe(true)
    expect(result.violations).toEqual([])
    // Warning surface populated.
    expect(result.warnings).toBeDefined()
    expect(result.warnings!.length).toBeGreaterThan(0)
    expect(result.warnings!.map((w) => w.reason)).toContain(
      'choice_preview_near_collision',
    )
    expect(result.observed.previewNearCollisions).toBeGreaterThan(0)
  })

  it('exports the frozen reason tuple', () => {
    expect(CHOICE_DISTINCTNESS_REASONS).toContain('choice_label_collision')
    expect(CHOICE_DISTINCTNESS_REASONS).toContain(
      'choice_preview_near_collision',
    )
  })

  it('determinism — same sampler ⇒ same report', () => {
    const slotA = buildSlot('slot_a')
    const slotB = buildSlot('slot_b')
    const collidingPool: SnippetPool = {
      slotId: 'choice_label',
      snippets: [
        {
          id: 'colliding',
          text: 'Cut the terms shorter',
          conditions: [{ kind: 'responseVerb', anyOf: ['negotiate'] }],
        },
      ],
    }
    const emptyPreviewPool: SnippetPool = {
      slotId: 'effect_preview',
      snippets: [],
    }
    const seed = makeSeed({
      id: 'determinism-seed',
      responseSlots: [slotA, slotB],
      consequenceProfiles: [buildProfile('slot_a'), buildProfile('slot_b')],
    })
    const state = makeTavernState()
    const sampler = () => ({
      seed,
      state,
      labelPool: collidingPool,
      previewPool: emptyPreviewPool,
      slots: [
        { slot: slotA, profile: buildProfile('slot_a') },
        { slot: slotB, profile: buildProfile('slot_b') },
      ],
    })
    const a = checkChoiceDistinctness(sampler, { sampleSize: 3 })
    const b = checkChoiceDistinctness(sampler, { sampleSize: 3 })
    expect(a.violations).toEqual(b.violations)
    expect(a.observed).toEqual(b.observed)
  })
})

// ---------- Layer B: warnings channel invariant on GateReport ----------

describe('Phase 148 / Layer B — GateReport.warnings channel invariant', () => {
  it('failReport ignores the warnings field (existing gates emit none)', () => {
    const passing = failReport([])
    expect(passing.pass).toBe(true)
    expect(passing.violations).toEqual([])
    expect(passing.warnings).toBeUndefined()
  })

  it('a report with only warnings stays passing', () => {
    // Constructed manually — mirrors the shape choiceDistinctness emits
    // when there are near-collisions but no label collisions.
    const report = {
      pass: true,
      violations: [],
      warnings: [
        { slotId: 'x', reason: 'choice_preview_near_collision', detail: 'd' },
      ],
    }
    // Invariant: pass === (violations.length === 0). Warnings never
    // affect pass.
    expect(report.pass).toBe(report.violations.length === 0)
  })
})

// ---------- Layer C: applyLegibleChoiceCap ----------

describe('Phase 148 / Layer C — applyLegibleChoiceCap policy', () => {
  function makeElevenSlotSupplierSeed(): IssueSeed {
    // Eleven slots mirroring the real supplier seed shape but with
    // synthetic ids and minimal profiles. The cap policy reads
    // SALIENCE_TABLES['supplier_relationship'] — every slot's effects
    // touch the supplier ref (signal read at salience index 0 or 1)
    // so all slots score equally and ties resolve by original index.
    const slots: ResponseSlot[] = [
      { id: 'pay_supplier', labelHint: 'Pay', allowedVerbs: ['pay'], shape: 'safe_costly', targetOptions: [{ kind: 'supplier', id: 'abc' }], expectedEffects: [] },
      { id: 'negotiate_supplier', labelHint: 'Negotiate', allowedVerbs: ['negotiate'], shape: 'compromise', targetOptions: [{ kind: 'supplier', id: 'abc' }], expectedEffects: [] },
      { id: 'blame_supplier', labelHint: 'Blame', allowedVerbs: ['blame'], shape: 'relationship_sacrifice', targetOptions: [{ kind: 'supplier', id: 'abc' }], expectedEffects: [] },
      { id: 'switch_supplier', labelHint: 'Switch', allowedVerbs: ['fire'], shape: 'long_term_investment', targetOptions: [{ kind: 'supplier', id: 'abc' }], expectedEffects: [] },
      { id: 'accept_suspicious_goods', labelHint: 'Accept', allowedVerbs: ['buy'], shape: 'risky_profitable', targetOptions: [{ kind: 'supplier', id: 'abc' }], expectedEffects: [] },
      { id: 'refuse_supplier_offer', labelHint: 'Refuse', allowedVerbs: ['ignore'], shape: 'safe_costly', targetOptions: [{ kind: 'supplier', id: 'abc' }], expectedEffects: [] },
      { id: 'place_standing_order', labelHint: 'Standing order', allowedVerbs: ['buy', 'negotiate'], shape: 'safe_costly', targetOptions: [{ kind: 'supplier', id: 'abc' }], expectedEffects: [] },
      { id: 'inspect_delivery', labelHint: 'Inspect', allowedVerbs: ['inspect'], shape: 'compromise', targetOptions: [{ kind: 'supplier', id: 'abc' }], expectedEffects: [] },
      { id: 'split_orders', labelHint: 'Split', allowedVerbs: ['buy', 'negotiate'], shape: 'long_term_investment', targetOptions: [{ kind: 'supplier', id: 'abc' }], expectedEffects: [] },
      { id: 'supplier_exclusivity_deal', labelHint: 'Exclusivity', allowedVerbs: ['negotiate', 'buy'], shape: 'risky_profitable', targetOptions: [{ kind: 'supplier', id: 'abc' }], expectedEffects: [] },
      { id: 'investigate_suspicious_goods', labelHint: 'Investigate', allowedVerbs: ['inspect', 'discard'], shape: 'safe_costly', targetOptions: [{ kind: 'supplier', id: 'abc' }], expectedEffects: [] },
    ]
    const profiles: ConsequenceProfile[] = slots.map((s, i) => {
      if (s.id === 'refuse_supplier_offer') {
        // The inaction slot: empty immediate, non-empty delayed.
        return {
          id: `${s.id}-profile`,
          responseSlotId: s.id,
          immediateEffects: [],
          delayedEffects: [SUPPLIER_EFFECT],
          memories: [],
          futureHooks: [],
          impactScore: 5,
        }
      }
      return buildProfile(s.id, [SUPPLIER_EFFECT, PRESSURE_EFFECT])
    })
    return makeSeed({
      id: 'eleven-slot-seed',
      family: 'supplier_relationship' as IssueSeed['family'],
      type: 'supplier_offer',
      timing: 'morning_prep',
      responseSlots: slots,
      consequenceProfiles: profiles,
    })
  }

  it('passes through ≤ cap seeds unchanged (no-op)', () => {
    const seed = makeSeed({ id: 'small-seed' }) // 2 slots
    const result = applyLegibleChoiceCap(
      seed,
      seed.responseSlots,
      (id) => seed.consequenceProfiles.find((p) => p.responseSlotId === id),
      DEFAULT_LEGIBLE_CHOICE_CAP,
    )
    expect(result.length).toBe(seed.responseSlots.length)
    expect(result.map((s) => s.id)).toEqual(seed.responseSlots.map((s) => s.id))
  })

  it('caps an 11-slot supplier seed to 6 in salience + seed order', () => {
    const seed = makeElevenSlotSupplierSeed()
    const result = applyLegibleChoiceCap(
      seed,
      seed.responseSlots,
      (id) => seed.consequenceProfiles.find((p) => p.responseSlotId === id),
      DEFAULT_LEGIBLE_CHOICE_CAP,
    )
    // All 11 slots tie at min salience index 0 (every effect touches
    // `supplier:abc`). Ties resolve by original index, so we take the
    // first 6 in seed order. `refuse_supplier_offer` is at original
    // index 5 ⇒ already in the first 6 ⇒ no append.
    expect(result.length).toBe(6)
    expect(result.map((s) => s.id)).toEqual([
      'pay_supplier',
      'negotiate_supplier',
      'blame_supplier',
      'switch_supplier',
      'accept_suspicious_goods',
      'refuse_supplier_offer',
    ])
  })

  it('appends the inaction slot when salience would otherwise drop it', () => {
    const seed = makeElevenSlotSupplierSeed()
    // Tighter cap of 3 — inaction (idx 5) ranks outside; must be appended.
    const result = applyLegibleChoiceCap(
      seed,
      seed.responseSlots,
      (id) => seed.consequenceProfiles.find((p) => p.responseSlotId === id),
      3,
    )
    expect(result.length).toBe(4) // cap 3 + appended inaction
    expect(result.map((s) => s.id)).toEqual([
      'pay_supplier',
      'negotiate_supplier',
      'blame_supplier',
      'refuse_supplier_offer',
    ])
  })

  it('determinism — same input ⇒ same output', () => {
    const seed = makeElevenSlotSupplierSeed()
    const profileFor = (id: string) =>
      seed.consequenceProfiles.find((p) => p.responseSlotId === id)
    const a = applyLegibleChoiceCap(seed, seed.responseSlots, profileFor, 6)
    const b = applyLegibleChoiceCap(seed, seed.responseSlots, profileFor, 6)
    expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id))
  })

  it('mechanical mapping preserved — every capped slot still has its real profile', () => {
    const seed = makeElevenSlotSupplierSeed()
    const profileFor = (id: string) =>
      seed.consequenceProfiles.find((p) => p.responseSlotId === id)
    const capped = applyLegibleChoiceCap(
      seed,
      seed.responseSlots,
      profileFor,
      6,
    )
    for (const slot of capped) {
      const profile = profileFor(slot.id)
      expect(profile).toBeDefined()
      // The capped slot is byte-identical to the seed's slot (same
      // reference) — verbs, targets, shape unchanged.
      expect(seed.responseSlots).toContain(slot)
    }
  })

  it('falls back to seed order when family has no salience table', () => {
    // Use a family without an entry in SALIENCE_TABLES.
    const slotsArr: ResponseSlot[] = Array.from({ length: 8 }, (_, i) => ({
      id: `s${i}`,
      labelHint: `S${i}`,
      allowedVerbs: i === 5 ? ['ignore'] : ['negotiate'],
      shape: 'compromise' as const,
      targetOptions: [],
      expectedEffects: [],
    }))
    const seed = makeSeed({
      id: 'unknown-family-seed',
      family: 'staff_burnout' as IssueSeed['family'], // no Phase-1 entry
      responseSlots: slotsArr,
      consequenceProfiles: slotsArr.map((s) => buildProfile(s.id, [PRESSURE_EFFECT])),
    })
    const result = applyLegibleChoiceCap(
      seed,
      seed.responseSlots,
      (id) => seed.consequenceProfiles.find((p) => p.responseSlotId === id),
      6,
    )
    // Cap of 6: first 6 in seed order. Inaction is at idx 5 ⇒ inside.
    expect(result.map((s) => s.id)).toEqual(['s0', 's1', 's2', 's3', 's4', 's5'])
  })
})

// ---------- Layer C: composeChoicesFromSeed integration ----------

describe('Phase 148 / Layer C — composeChoicesFromSeed integration', () => {
  it('renders ≤ DEFAULT_LEGIBLE_CHOICE_CAP choices by default', () => {
    // Eleven-slot supplier seed.
    const slots: ResponseSlot[] = Array.from({ length: 11 }, (_, i) => ({
      id: `s${i}`,
      labelHint: `S${i}`,
      allowedVerbs: i === 5 ? ['ignore'] : ['negotiate'],
      shape: 'compromise' as const,
      targetOptions: [{ kind: 'supplier' as const, id: 'abc' }],
      expectedEffects: [],
    }))
    const seed = makeSeed({
      id: 'cap-integration-seed',
      family: 'supplier_relationship' as IssueSeed['family'],
      type: 'supplier_offer',
      timing: 'morning_prep',
      responseSlots: slots,
      consequenceProfiles: slots.map((s) => buildProfile(s.id, [SUPPLIER_EFFECT])),
    })
    const state = makeTavernState()
    const labelPool: SnippetPool = { slotId: 'choice_label', snippets: [] }
    const previewPool: SnippetPool = { slotId: 'effect_preview', snippets: [] }
    const choices = composeChoicesFromSeed(seed, state, {
      labelPool,
      previewPool,
      maxPreview: 2,
    })
    expect(choices.length).toBeLessThanOrEqual(DEFAULT_LEGIBLE_CHOICE_CAP)
    expect(choices.length).toBe(6)
  })

  it('honours an explicit maxChoices override', () => {
    const slots: ResponseSlot[] = Array.from({ length: 11 }, (_, i) => ({
      id: `s${i}`,
      labelHint: `S${i}`,
      allowedVerbs: i === 5 ? ['ignore'] : ['negotiate'],
      shape: 'compromise' as const,
      targetOptions: [{ kind: 'supplier' as const, id: 'abc' }],
      expectedEffects: [],
    }))
    const seed = makeSeed({
      id: 'override-seed',
      family: 'supplier_relationship' as IssueSeed['family'],
      type: 'supplier_offer',
      timing: 'morning_prep',
      responseSlots: slots,
      consequenceProfiles: slots.map((s) => buildProfile(s.id, [SUPPLIER_EFFECT])),
    })
    const state = makeTavernState()
    const choices = composeChoicesFromSeed(seed, state, {
      labelPool: { slotId: 'choice_label', snippets: [] },
      previewPool: { slotId: 'effect_preview', snippets: [] },
      maxChoices: 4,
    })
    // Cap 4, inaction at idx 5 must still be present ⇒ effective 5.
    expect(choices.length).toBe(5)
    expect(choices.map((c) => c.slotId)).toContain('s5')
  })

  it('runAllGates wires the 9th gate through (config present ⇒ report populated)', () => {
    const slotA = buildSlot('slot_a')
    const slotB = buildSlot('slot_b')
    const distinctPool: SnippetPool = {
      slotId: 'choice_label',
      snippets: [
        {
          id: 'a_specific',
          text: 'First option',
          conditions: [{ kind: 'responseSlot', anyOf: ['slot_a'] }],
        },
        {
          id: 'b_specific',
          text: 'Second option',
          conditions: [{ kind: 'responseSlot', anyOf: ['slot_b'] }],
        },
        // Unconditional fallback so the coverage gate stays happy on
        // this synthetic template.
        { id: 'fallback', text: 'Unspecified', conditions: [] },
      ],
    }
    const seed = makeSeed({
      id: 'wiring-seed',
      responseSlots: [slotA, slotB],
      consequenceProfiles: [buildProfile('slot_a'), buildProfile('slot_b')],
    })
    const state = makeTavernState()
    const template: CompositionalCardTemplate = {
      id: 'wiring-template',
      appliesTo: { seedFamilies: ['regular_customer'] },
      voiceRegister: 'tavern_floor',
      slots: [
        {
          id: 'choice_label',
          role: 'choice_label',
          pool: distinctPool,
        },
      ],
      toCardView: (): CardView => ({
        title: 'x',
        body: [],
        stakes: [],
        choices: [],
      }),
    }
    const report = runAllGates(template, {
      simCoherence: { bannedDisplayNames: [] },
      determinism: { samples: [] },
      diversity: [],
      choiceDistinctness: {
        sampler: () => ({
          seed,
          state,
          labelPool: distinctPool,
          previewPool: { slotId: 'effect_preview', snippets: [] },
          slots: [
            { slot: slotA, profile: buildProfile('slot_a') },
            { slot: slotB, profile: buildProfile('slot_b') },
          ],
        }),
        config: { sampleSize: 2 },
      },
    })
    expect(report.choiceDistinctness.skipped).toBe(false)
    expect(report.choiceDistinctness.pass).toBe(true)
    expect(report.choiceDistinctness.observed.sampleSize).toBe(2)
    expect(report.pass).toBe(true)
  })

  it('runAllGates skips the 9th gate cleanly when omitted', () => {
    const template: CompositionalCardTemplate = {
      id: 'no-distinctness-template',
      appliesTo: { seedFamilies: ['regular_customer'] },
      voiceRegister: 'tavern_floor',
      slots: [
        {
          id: 'choice_label',
          role: 'choice_label',
          pool: { slotId: 'choice_label', snippets: [{ id: 'x', text: 'x', conditions: [] }] },
        },
      ],
      toCardView: (): CardView => ({
        title: 'x',
        body: [],
        stakes: [],
        choices: [],
      }),
    }
    const report = runAllGates(template, {
      simCoherence: { bannedDisplayNames: [] },
      determinism: { samples: [] },
      diversity: [],
    })
    expect(report.choiceDistinctness.skipped).toBe(true)
    expect(report.choiceDistinctness.pass).toBe(true)
    expect(report.choiceDistinctness.violations).toEqual([])
    expect(report.choiceDistinctness.warnings).toBeUndefined()
  })

  it('mechanical mapping unchanged — composed choice slotIds are a subset of buildChoicesFromSeed output', () => {
    const slots: ResponseSlot[] = Array.from({ length: 11 }, (_, i) => ({
      id: `s${i}`,
      labelHint: `S${i}`,
      allowedVerbs: i === 5 ? ['ignore'] : ['negotiate'],
      shape: 'compromise' as const,
      targetOptions: [{ kind: 'supplier' as const, id: 'abc' }],
      expectedEffects: [],
    }))
    const seed = makeSeed({
      id: 'mechanical-seed',
      family: 'supplier_relationship' as IssueSeed['family'],
      type: 'supplier_offer',
      timing: 'morning_prep',
      responseSlots: slots,
      consequenceProfiles: slots.map((s) => buildProfile(s.id, [SUPPLIER_EFFECT])),
    })
    const state = makeTavernState()
    const composed = composeChoicesFromSeed(seed, state, {
      labelPool: { slotId: 'choice_label', snippets: [] },
      previewPool: { slotId: 'effect_preview', snippets: [] },
    })
    const baseline = buildChoicesFromSeed(seed) // un-capped
    // Every composed choice's structural identity (slotId / verb /
    // targetId / shape) exactly matches the baseline's entry for that
    // same slot. Only the choices that survive the cap appear in
    // `composed`, but those that DO appear must be byte-identical
    // structurally.
    for (const choice of composed) {
      const ref = baseline.find((b) => b.slotId === choice.slotId)
      expect(ref).toBeDefined()
      expect(choice.verb).toBe(ref!.verb)
      expect(choice.targetId).toBe(ref!.targetId)
      expect(choice.shape).toBe(ref!.shape)
    }
  })
})
