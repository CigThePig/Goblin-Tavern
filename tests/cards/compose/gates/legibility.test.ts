// Phase 161 / ISSUE-129 — Legible Surface arc, Phase 16.
//
// Two suites:
//
//   1. Live suite — runs `checkLegibility` against the 20 migrated
//      compositional templates and the real determinism samples (per
//      `legibilityHarness.LEGIBILITY_SITUATIONS`). Expects
//      `report.pass === true`. Any failure here is a Movement-VI content
//      debt: either the pool authors no salient snippet for a state
//      where one is on offer, or a preview line drops magnitude/cost,
//      or two choices collapse to the same label. Fix at the source,
//      not in the gate.
//
//   2. Failure-fixture suite — five synthetic situations each designed
//      to fail exactly one rule. Each fixture proves the corresponding
//      `LEGIBILITY_REASONS` entry bites, so the gate is provably
//      load-bearing.

import { describe, expect, it } from 'vitest'

import {
  checkLegibility,
  LEGIBILITY_REASONS,
  type LegibilityConfig,
  type LegibilitySample,
  type LegibilitySituation,
} from '../../../../src/cards/compose/gates'
import { LEGIBILITY_SITUATIONS } from './legibilityHarness'
import { makeSeed } from '../../cardFactories'
import { createInitialTavernState } from '../../../../src/sim/state/defaults'
import type {
  CompositionalCardTemplate,
  SlotSpec,
  Snippet,
} from '../../../../src/cards/compose/types'
import type { CardView } from '../../../../src/cards/types'
import type {
  ConsequenceProfile,
  IssueSeed,
  ResponseIntentShape,
  ResponseIntentVerb,
  ResponseSlot,
} from '../../../../src/sim/modules/issues/issueSeedTypes'
import type { EffectPreview } from '../../../../src/sim/core/effect'
import type { TavernState } from '../../../../src/sim/state/TavernState'

// ---------------------------------------------------------------------
// Live suite — the real 20 migrated templates.
// ---------------------------------------------------------------------

describe('Phase 16 — Legibility gate (live, 20 migrated situations)', () => {
  it('every migrated situation passes Q1 + Q2', () => {
    const report = checkLegibility({ situations: LEGIBILITY_SITUATIONS })
    if (!report.pass) {
      const preview = report.violations
        .slice(0, 10)
        .map((v) => `[${v.reason}] ${v.detail}`)
      throw new Error(
        `legibility gate failed with ${report.violations.length} violations:\n${preview.join('\n')}`,
      )
    }
    expect(report.pass).toBe(true)
    expect(report.observed.situations.length).toBe(LEGIBILITY_SITUATIONS.length)
    expect(report.observed.situations.length).toBe(20)
  })

  it('records observed coverage for every migrated template', () => {
    const report = checkLegibility({ situations: LEGIBILITY_SITUATIONS })
    for (const obs of report.observed.situations) {
      // Every situation evaluated at least one sample.
      expect(obs.samplesEvaluated).toBeGreaterThan(0)
      // Every situation rendered at least one choice per sample (cap
      // never drops everything; inaction is always preserved).
      expect(obs.choiceSetSizesAfterCap.length).toBe(obs.samplesEvaluated)
      for (const size of obs.choiceSetSizesAfterCap) {
        expect(size).toBeGreaterThan(0)
      }
    }
    // Salience reaches the bulk of migrated templates — at least 15 of
    // the 20 templates resolved ≥1 salient read in at least one sample.
    // drinkOrder, monthlyReview, seasonalArc can legitimately resolve
    // zero reads on neutral state samples (drinkOrder predates the
    // Phase-149 establishing-line migration; the periodic templates
    // depend on rising pressures the determinism state doesn't always
    // supply). The threshold names the floor, not the ceiling.
    const templatesWithSalience = report.observed.situations.filter(
      (s) => s.salienceReadsResolved > 0,
    )
    expect(templatesWithSalience.length).toBeGreaterThanOrEqual(15)
  })

  it('every choice set retains the inaction option when one existed', () => {
    // The legible cap (DEFAULT_LEGIBLE_CHOICE_CAP=6) preserves inaction
    // slots even when they fall outside the salience cut. The gate's
    // inactionBlankCount tally proves no choice rendered zero preview
    // lines — i.e. inaction options were both surfaced AND rendered
    // their delayed-effect previews via the Phase-147 inaction wiring.
    const report = checkLegibility({ situations: LEGIBILITY_SITUATIONS })
    for (const obs of report.observed.situations) {
      expect(obs.inactionBlankCount).toBe(0)
    }
  })

  it('is deterministic — two calls return identical reports', () => {
    const a = checkLegibility({ situations: LEGIBILITY_SITUATIONS })
    const b = checkLegibility({ situations: LEGIBILITY_SITUATIONS })
    expect(a.pass).toBe(b.pass)
    expect(a.violations.length).toBe(b.violations.length)
    expect(a.violations.map((v) => `${v.reason}::${v.detail}`)).toEqual(
      b.violations.map((v) => `${v.reason}::${v.detail}`),
    )
    expect(a.observed.situations.length).toBe(b.observed.situations.length)
    for (let i = 0; i < a.observed.situations.length; i += 1) {
      const A = a.observed.situations[i]!
      const B = b.observed.situations[i]!
      expect(A).toEqual(B)
    }
  })

  it('exports the frozen LEGIBILITY_REASONS tuple', () => {
    expect(LEGIBILITY_REASONS).toEqual([
      'establishing_off_salient',
      'preview_magnitude_missing',
      'preview_cost_unsurfaced',
      'preview_inaction_blank',
      'choice_label_collision',
    ])
    // The tuple is frozen.
    expect(Object.isFrozen(LEGIBILITY_REASONS)).toBe(true)
  })
})

// ---------------------------------------------------------------------
// Failure-fixture suite — synthetic situations that prove each
// LEGIBILITY_REASONS entry bites.
// ---------------------------------------------------------------------

/** Build a minimal `(seed, state)` pair anchored on a supplier with a
 *  *meaningfully* salient fact installed — a `supplier`-tagged memory
 *  entry so `resolveSalientReads` returns a memory read (extremity 1,
 *  non-signal, passes the gate's mid-band filter). The
 *  supplier_relationship salience table includes `memory tag: supplier`
 *  as a recognised salient read; mid-band signal reads alone would be
 *  filtered out by the gate as "default-is-the-fact." */
function supplierSampleFor(id: string): LegibilitySample {
  const base = createInitialTavernState()
  const supplierId = Object.keys(base.world.suppliers)[0]!
  const state: TavernState = {
    ...base,
    memories: [
      ...base.memories,
      {
        id: `${id}-supplier-memory`,
        type: 'fact',
        strength: 1,
        ageDays: 0,
        createdAt: { year: 1, month: 1, week: 1, day: 1, absoluteDay: 0 },
        actors: [{ kind: 'supplier', id: supplierId }],
        locations: [],
        relatedSystems: [],
        tags: ['supplier'],
      },
    ],
  }
  const seed = makeSeed({
    id,
    family: 'supplier_relationship',
    type: 'supplier_offer',
    timing: 'morning_prep',
    severity: 45,
    domain: ['suppliers'],
    primaryActor: { kind: 'supplier', id: supplierId },
    textIngredients: {
      subject: 'a supply matter',
      sensoryDetails: ['stacked crates'],
      recentContext: ['reliability questions'],
    },
  })
  return { seed, state }
}

/** A no-frills CardView with one rendered choice. Bypasses the
 *  production composer — the fixture's job is to drive exactly the
 *  inputs the gate inspects. */
function singleChoiceCardView(parts: {
  title?: string
  body?: string[]
  choice: {
    slotId: string
    label: string
    verb: ResponseIntentVerb
    targetId?: string
    shape?: ResponseIntentShape
    previewEffects: string[]
  }
}): CardView {
  return {
    title: parts.title ?? 'fixture',
    body: parts.body ?? [],
    stakes: [],
    choices: [
      {
        slotId: parts.choice.slotId,
        label: parts.choice.label,
        verb: parts.choice.verb,
        ...(parts.choice.targetId !== undefined
          ? { targetId: parts.choice.targetId }
          : {}),
        shape: parts.choice.shape ?? 'safe_costly',
        previewEffects: parts.choice.previewEffects,
      },
    ],
  }
}

function twoChoiceCardView(parts: {
  title?: string
  body?: string[]
  choices: Array<{
    slotId: string
    label: string
    verb: ResponseIntentVerb
    targetId?: string
    shape?: ResponseIntentShape
    previewEffects: string[]
  }>
}): CardView {
  return {
    title: parts.title ?? 'fixture',
    body: parts.body ?? [],
    stakes: [],
    choices: parts.choices.map((c) => ({
      slotId: c.slotId,
      label: c.label,
      verb: c.verb,
      ...(c.targetId !== undefined ? { targetId: c.targetId } : {}),
      shape: c.shape ?? 'safe_costly',
      previewEffects: c.previewEffects,
    })),
  }
}

/** Build a single-slot fixture template whose establishing-line slot
 *  opts into `saliencePolicy: 'top'` AND demonstrates the real failure
 *  mode the gate is designed to catch: a higher-specificity NON-covering
 *  snippet shadows a lower-specificity covering one. The supplier
 *  salience table includes `memoryPresent supplier`; the fixture sample
 *  installs a supplier-tagged memory so that read resolves. The pool
 *  has:
 *    - `est_fallback` (spec 0, unconditional)
 *    - `est_covering_memory` (spec 1, gated on memoryPresent supplier) —
 *      matches state, covers the resolved memory read.
 *    - `est_noncovering_high` (spec 2, gated on two state-lookup
 *      conditions outside the salience table) — also matches state,
 *      covers NO resolved read.
 *  `pickSnippetTrace`'s specificity filter retains only the spec-2
 *  candidate; `pickByTopSalience` is then trivial. The picked snippet
 *  is non-covering. The gate's "did the pool have a covering match the
 *  gradient suppressed?" check finds `est_covering_memory` and fires
 *  `establishing_off_salient`. */
function makeOffSalientTemplate(): CompositionalCardTemplate {
  const snippets: Snippet[] = [
    {
      id: 'off_salient_fallback',
      text: 'A morning unfolds at the tavern.',
      conditions: [],
    },
    {
      id: 'off_salient_covering_memory',
      text: 'The ledger remembers this merchant from before.',
      conditions: [
        { kind: 'memoryPresent', tag: 'supplier' },
      ],
    },
    {
      id: 'off_salient_noncovering_high',
      text: 'A clear morning, and the trade begins again.',
      conditions: [
        // Both conditions resolve against state but neither maps to a
        // supplier_relationship salience-table entry. The pair gives
        // this snippet specificity 2 (the count-based default).
        { kind: 'severityAtLeast', value: 30 },
        { kind: 'severityBelow', value: 60 },
      ],
    },
  ]
  const establishingSlot: SlotSpec = {
    id: 'establishing_line',
    role: 'establishing',
    pool: { slotId: 'establishing_line', snippets },
    wordBudget: 14,
    claimMode: 'sim_backed',
    saliencePolicy: 'top',
  }
  return {
    id: 'phase161.off-salient-fixture',
    appliesTo: { seedFamilies: ['supplier_relationship'] },
    voiceRegister: 'trade_floor',
    slots: [establishingSlot],
    toCardView: (filled, seed) =>
      singleChoiceCardView({
        title: 'fixture',
        body: filled['establishing_line'] ? [filled['establishing_line']] : [],
        choice: {
          slotId: 'phase161-fixture-slot',
          label: 'Carry on',
          verb: 'ignore',
          shape: 'ignore',
          previewEffects: ['nothing changes'],
        },
      }),
  } satisfies CompositionalCardTemplate as CompositionalCardTemplate
}

/** Helper: build a seed with a single response slot + consequence
 *  profile whose immediate effect carries the given fields. Lets the
 *  fixtures drive `requireMagnitude` / `requireCostSurfacing` / blank
 *  detection precisely. */
function seedWithProfile(parts: {
  id: string
  family: string
  slotId: string
  verb: ResponseIntentVerb
  shape?: ResponseIntentShape
  immediate?: EffectPreview[]
  delayed?: EffectPreview[]
}): IssueSeed {
  const slot: ResponseSlot = {
    id: parts.slotId,
    labelHint: 'Address',
    allowedVerbs: [parts.verb],
    shape: parts.shape ?? 'safe_costly',
    targetOptions: [],
    expectedEffects: [],
  }
  const profile: ConsequenceProfile = {
    id: `${parts.id}-profile`,
    responseSlotId: parts.slotId,
    immediateEffects: parts.immediate ?? [],
    delayedEffects: parts.delayed ?? [],
    memories: [],
    futureHooks: [],
    impactScore: 5,
  }
  return makeSeed({
    id: parts.id,
    family: parts.family,
    responseSlots: [slot],
    consequenceProfiles: [profile],
  })
}

/** Build a template whose `toCardView` returns a hand-crafted CardView
 *  driven by the provided builder. Lets fixtures sidestep the
 *  composeChoicesFromSeed path entirely. */
function makeRenderedTemplate(
  id: string,
  build: (seed: IssueSeed, state: TavernState) => CardView,
): CompositionalCardTemplate {
  return {
    id,
    appliesTo: {},
    voiceRegister: 'tavern_floor',
    slots: [],
    toCardView: (_filled, seed, state) => build(seed, state),
  } satisfies CompositionalCardTemplate as CompositionalCardTemplate
}

function runFixture(template: CompositionalCardTemplate, samples: LegibilitySample[]) {
  const situation: LegibilitySituation = {
    templateId: template.id,
    template,
    buildSamples: () => samples,
  }
  const config: LegibilityConfig = { situations: [situation] }
  return checkLegibility(config)
}

describe('Phase 16 — Legibility failure fixtures (each reason bites)', () => {
  it('establishing_off_salient fires when the saliencePolicy slot fired a snippet covering no resolved read', () => {
    const template = makeOffSalientTemplate()
    const sample = supplierSampleFor('off-salient-fixture')
    const report = runFixture(template, [sample])
    expect(report.pass).toBe(false)
    const offSalient = report.violations.filter(
      (v) => v.reason === 'establishing_off_salient',
    )
    expect(offSalient.length).toBeGreaterThan(0)
    expect(offSalient[0]?.slotId).toBe('establishing_line')
    // The gradient picked the spec-2 non-covering snippet; the gate
    // surfaces that snippet's id along with the suppressed covering one.
    expect(offSalient[0]?.snippetId).toBe('off_salient_noncovering_high')
    expect(offSalient[0]?.detail).toContain('off_salient_covering_memory')
  })

  it('preview_magnitude_missing fires when a banded effect renders without a magnitude-lexicon token', () => {
    const seed = seedWithProfile({
      id: 'magnitude-fixture',
      family: 'food_safety',
      slotId: 'fix-magnitude-slot',
      verb: 'appease',
      immediate: [
        {
          kind: 'state_change',
          target: 'staff.fatigue',
          amount: 8,
          readable: 'the rota would feel it',
          tags: ['staff'],
          targetKind: 'staff',
          direction: 'negative',
          magnitudeBand: 'medium',
        },
      ],
    })
    const state = createInitialTavernState()
    // The rendered preview is a flavor line that contains the
    // targetKind keyword (staff) but no MAGNITUDE_LEXICON.negative.medium
    // token (lexicon: "a clear drop", "a real slip", "a marked fall").
    const flavorLine = 'the rota stiffens up a touch'
    const template = makeRenderedTemplate('phase161.magnitude-fixture', () =>
      singleChoiceCardView({
        choice: {
          slotId: 'fix-magnitude-slot',
          label: 'Patch it',
          verb: 'appease',
          previewEffects: [flavorLine],
        },
      }),
    )
    const report = runFixture(template, [{ seed, state }])
    expect(report.pass).toBe(false)
    const magnitudeMissing = report.violations.filter(
      (v) => v.reason === 'preview_magnitude_missing',
    )
    expect(magnitudeMissing.length).toBeGreaterThan(0)
    expect(magnitudeMissing[0]?.detail).toContain('negative/medium')
  })

  it('preview_cost_unsurfaced fires when a coin-spending choice surfaces no coin keyword', () => {
    const seed = seedWithProfile({
      id: 'cost-fixture',
      family: 'supplier_relationship',
      slotId: 'fix-cost-slot',
      verb: 'pay',
      immediate: [
        {
          kind: 'state_change',
          target: 'coin',
          amount: -15,
          readable: 'fifteen coin would leave the till',
          tags: ['coin'],
          targetKind: 'coin',
          direction: 'negative',
          magnitudeBand: 'small',
        },
      ],
    })
    const state = createInitialTavernState()
    // The rendered line carries the magnitude token ("a step") but NO
    // coin keyword (till, purse, silver, copper, penny, coin).
    const noCostLine = 'the deal would tighten a step'
    const template = makeRenderedTemplate('phase161.cost-fixture', () =>
      singleChoiceCardView({
        choice: {
          slotId: 'fix-cost-slot',
          label: 'Pay them',
          verb: 'pay',
          previewEffects: [noCostLine],
        },
      }),
    )
    const report = runFixture(template, [{ seed, state }])
    expect(report.pass).toBe(false)
    const costUnsurfaced = report.violations.filter(
      (v) => v.reason === 'preview_cost_unsurfaced',
    )
    expect(costUnsurfaced.length).toBeGreaterThan(0)
    expect(costUnsurfaced[0]?.slotId).toBe('fix-cost-slot')
  })

  it('preview_inaction_blank fires when a choice renders zero preview lines', () => {
    const seed = seedWithProfile({
      id: 'blank-fixture',
      family: 'food_safety',
      slotId: 'fix-blank-slot',
      verb: 'ignore',
      shape: 'ignore',
      // Empty immediate AND empty delayed — the structural-blank case
      // the gate is meant to catch.
    })
    const state = createInitialTavernState()
    const template = makeRenderedTemplate('phase161.blank-fixture', () =>
      singleChoiceCardView({
        choice: {
          slotId: 'fix-blank-slot',
          label: 'Wait',
          verb: 'ignore',
          shape: 'ignore',
          previewEffects: [],
        },
      }),
    )
    const report = runFixture(template, [{ seed, state }])
    expect(report.pass).toBe(false)
    const blanks = report.violations.filter(
      (v) => v.reason === 'preview_inaction_blank',
    )
    expect(blanks.length).toBeGreaterThan(0)
    expect(blanks[0]?.slotId).toBe('fix-blank-slot')
  })

  it('choice_label_collision fires when two distinct slots render the same canonical label', () => {
    const slotA: ResponseSlot = {
      id: 'fix-collide-a',
      labelHint: 'Sign one',
      allowedVerbs: ['negotiate'],
      shape: 'safe_costly',
      targetOptions: [],
      expectedEffects: [],
    }
    const slotB: ResponseSlot = {
      id: 'fix-collide-b',
      labelHint: 'Sign two',
      allowedVerbs: ['negotiate'],
      shape: 'safe_costly',
      targetOptions: [],
      expectedEffects: [],
    }
    const profileA: ConsequenceProfile = {
      id: 'collide-profile-a',
      responseSlotId: slotA.id,
      immediateEffects: [],
      delayedEffects: [],
      memories: [],
      futureHooks: [],
      impactScore: 5,
    }
    const profileB: ConsequenceProfile = {
      id: 'collide-profile-b',
      responseSlotId: slotB.id,
      immediateEffects: [],
      delayedEffects: [],
      memories: [],
      futureHooks: [],
      impactScore: 5,
    }
    const seed = makeSeed({
      id: 'collision-fixture',
      family: 'supplier_relationship',
      responseSlots: [slotA, slotB],
      consequenceProfiles: [profileA, profileB],
    })
    const state = createInitialTavernState()
    // Both rendered labels canonicalise to "cut the terms shorter".
    const template = makeRenderedTemplate('phase161.collision-fixture', () =>
      twoChoiceCardView({
        choices: [
          {
            slotId: slotA.id,
            label: 'Cut the terms shorter.',
            verb: 'negotiate',
            previewEffects: ['something would happen'],
          },
          {
            slotId: slotB.id,
            label: 'Cut the terms shorter',
            verb: 'negotiate',
            previewEffects: ['something else would happen'],
          },
        ],
      }),
    )
    const report = runFixture(template, [{ seed, state }])
    expect(report.pass).toBe(false)
    const collisions = report.violations.filter(
      (v) => v.reason === 'choice_label_collision',
    )
    expect(collisions.length).toBeGreaterThan(0)
    expect(collisions[0]?.detail).toContain('Cut the terms shorter')
  })
})
