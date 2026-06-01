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
  // Phase 163 / ISSUE-131 — Faithful Surface arc, Phase 1.
  //
  // Before Phase 1, the legibility gate ran against the 2-slot synthetic
  // stub `cardFactories.makeSeed` falls back to when samplers don't pass
  // responseSlots / consequenceProfiles — the four arc-defining defect
  // classes (label collisions across same-verb slots, preview duplication
  // across distinct choices, magnitude-missing previews on banded
  // effects, coin-spending choices that don't surface a coin keyword)
  // were structurally invisible.
  //
  // Phase 1 made every sampler emit production-shape seeds (Phase 163 /
  // ISSUE-131), which surfaced ~295 real violations across the 20
  // migrated templates. Phases 2-4 drove them to zero:
  //   - preview_magnitude_missing → Phase 2 (Meter Valence, ISSUE-132)
  //     flipped direction for lower-is-better meters so kindnesses stop
  //     reading as losses; Phase 4 (this arc) exempted `future_hook` /
  //     `cause` narrative effects (no player-facing magnitude) and fixed
  //     the `world.regulars.*` → `customer` targetKind gap so the shared
  //     banded snippets land a magnitude token.
  //   - preview_cost_unsurfaced → Phase 4 added the cost-surfacing
  //     policy in `composeChoicesFromSeed` (shared with this gate via
  //     `selectPreviewEffects`): a coin-spend effect is pulled into the
  //     preview cap so the player always sees a coin keyword.
  //   - choice_label_collision → Phase 3 (Distinguishable Choices,
  //     ISSUE-133): same-verb slots discriminate by slot id.
  //   - establishing_off_salient → Phase 4 (Flavor That Doesn't Lie,
  //     ISSUE-134): flavor lines that imply state are now state-gated, so
  //     the salience layer never fires a non-covering snippet.
  //
  // Restored now that Phase 4 lands. This is the cross-template
  // integration assertion the arc was built to keep green.
  it('every migrated situation passes Q1 + Q2', () => {
    const report = checkLegibility({ situations: LEGIBILITY_SITUATIONS })
    if (!report.pass) {
      const detail = report.violations
        .slice(0, 8)
        .map((v) => `${v.reason}: ${v.detail}`)
        .join('\n')
      throw new Error(
        `legibility report failed with ${report.violations.length} violations:\n${detail}`,
      )
    }
    expect(report.pass).toBe(true)
    for (const obs of report.observed.situations) {
      expect(obs.magnitudeChecksFailed).toBe(0)
      expect(obs.costSurfacingChecksFailed).toBe(0)
      expect(obs.labelCollisionsCount).toBe(0)
      expect(obs.inactionBlankCount).toBe(0)
      // Phase 184 / ISSUE-152 — the three new Q2 rules. The live suite is
      // the proof Phases 1-3 landed: every allowlisted-meter line names its
      // meter, no choice renders a duplicate line, and every decision-relevant
      // risk is surfaced.
      expect(obs.meterNamingChecksFailed).toBe(0)
      expect(obs.duplicateLineCount).toBe(0)
      expect(obs.riskSurfacingChecksFailed).toBe(0)
      // Phase 189 / ISSUE-156 — every active choice carrying a decision-
      // relevant delayed consequence surfaces a `later:` line.
      expect(obs.delayedSurfacingChecksFailed).toBe(0)
    }
  })

  it('actually exercises the Phase-189 delayed-consequence rule on live templates', () => {
    // Guard against the rule silently no-op-ing: across the 20 migrated
    // templates, active choices really do author decision-relevant delayed
    // consequences (the complaint card's fix_root / public_apology, etc.), so
    // the check runs (and, per the assertion above, all pass).
    const report = checkLegibility({ situations: LEGIBILITY_SITUATIONS })
    const totalDelayedChecks = report.observed.situations.reduce(
      (n, s) => n + s.delayedSurfacingChecksRun,
      0,
    )
    expect(totalDelayedChecks).toBeGreaterThan(0)
  })

  it('actually exercises the Phase-184 meter / risk rules on live templates', () => {
    // Guard against the rules silently no-op-ing: across the 20 migrated
    // templates the allowlisted meters and decision-relevant risks really do
    // occur, so the checks run (and, per the assertions above, all pass).
    const report = checkLegibility({ situations: LEGIBILITY_SITUATIONS })
    const totalMeterChecks = report.observed.situations.reduce(
      (n, s) => n + s.meterNamingChecksRun,
      0,
    )
    const totalRiskChecks = report.observed.situations.reduce(
      (n, s) => n + s.riskSurfacingChecksRun,
      0,
    )
    expect(totalMeterChecks).toBeGreaterThan(0)
    expect(totalRiskChecks).toBeGreaterThan(0)
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
      'preview_meter_unnamed',
      'preview_duplicate_line',
      'preview_risk_unsurfaced',
      'preview_delayed_unsurfaced',
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

  // -------------------------------------------------------------------
  // Phase 184 / ISSUE-152 — the three new Q2 rules. Each fixture fails
  // exactly one rule; each has a corrected counterpart that passes.
  // -------------------------------------------------------------------

  /** A `state_change` effect on staff loyalty — an allowlisted
   *  (`DEFAULT_NAMED_METERS`) meter the `preview_meter_unnamed` rule
   *  requires to be leaf-named. */
  const loyaltyEffect: EffectPreview = {
    kind: 'state_change',
    target: 'staff.server.loyalty',
    amount: 10,
    readable: 'the crew would hold together',
    tags: ['staff'],
    targetKind: 'staff',
    direction: 'positive',
    magnitudeBand: 'medium',
    meterId: 'loyalty',
    meterLabel: 'loyalty',
  }

  it('preview_meter_unnamed fires when an allowlisted-meter line names no meter token', () => {
    const seed = seedWithProfile({
      id: 'meter-fixture',
      family: 'staff_identity',
      slotId: 'fix-meter-slot',
      verb: 'appease',
      immediate: [loyaltyEffect],
    })
    const state = createInitialTavernState()
    // Carries a positive/medium magnitude token ("a marked rise") so the
    // magnitude rule is satisfied, but names the fictional "trust" rather
    // than the real meter — the Appendix A §1 defect.
    const unnamed = 'the crew would feel a marked rise in trust'
    const template = makeRenderedTemplate('phase184.meter-fixture', () =>
      singleChoiceCardView({
        choice: {
          slotId: 'fix-meter-slot',
          label: 'Comfort them',
          verb: 'appease',
          previewEffects: [unnamed],
        },
      }),
    )
    const report = runFixture(template, [{ seed, state }])
    expect(report.pass).toBe(false)
    const unnamedViolations = report.violations.filter(
      (v) => v.reason === 'preview_meter_unnamed',
    )
    expect(unnamedViolations.length).toBeGreaterThan(0)
    expect(unnamedViolations[0]?.slotId).toBe('fix-meter-slot')
    expect(unnamedViolations[0]?.detail).toContain('loyalty')
  })

  it('preview_meter_unnamed passes when the line names the meter (corrected)', () => {
    const seed = seedWithProfile({
      id: 'meter-fixture-ok',
      family: 'staff_identity',
      slotId: 'fix-meter-slot',
      verb: 'appease',
      immediate: [loyaltyEffect],
    })
    const state = createInitialTavernState()
    const named = 'loyalty would climb a marked rise across the crew'
    const template = makeRenderedTemplate('phase184.meter-fixture-ok', () =>
      singleChoiceCardView({
        choice: {
          slotId: 'fix-meter-slot',
          label: 'Comfort them',
          verb: 'appease',
          previewEffects: [named],
        },
      }),
    )
    const report = runFixture(template, [{ seed, state }])
    const unnamedViolations = report.violations.filter(
      (v) => v.reason === 'preview_meter_unnamed',
    )
    expect(unnamedViolations.length).toBe(0)
  })

  it('preview_meter_unnamed does not fire for an un-allowlisted meter', () => {
    // `relationship` is authored but not yet band-complete, so it stays out
    // of DEFAULT_NAMED_METERS — the coarse-base line that names only the
    // kind ("the merchant") must NOT fail until Phase 5 promotes it.
    const relationshipEffect: EffectPreview = {
      kind: 'state_change',
      target: 'world.suppliers.s1.relationship',
      amount: 6,
      readable: 'the merchant warms to the bar',
      tags: ['supplier'],
      targetKind: 'supplier',
      direction: 'positive',
      magnitudeBand: 'medium',
      meterId: 'relationship',
      meterLabel: 'relationship',
    }
    const seed = seedWithProfile({
      id: 'meter-fixture-offlist',
      family: 'supplier_relationship',
      slotId: 'fix-offlist-slot',
      verb: 'appease',
      immediate: [relationshipEffect],
    })
    const state = createInitialTavernState()
    const kindOnly = 'the merchant would warm a marked rise'
    const template = makeRenderedTemplate('phase184.meter-fixture-offlist', () =>
      singleChoiceCardView({
        choice: {
          slotId: 'fix-offlist-slot',
          label: 'Warm to them',
          verb: 'appease',
          previewEffects: [kindOnly],
        },
      }),
    )
    const report = runFixture(template, [{ seed, state }])
    const unnamedViolations = report.violations.filter(
      (v) => v.reason === 'preview_meter_unnamed',
    )
    expect(unnamedViolations.length).toBe(0)
  })

  it('preview_duplicate_line fires when a choice renders two identical lines', () => {
    const seed = seedWithProfile({
      id: 'dup-fixture',
      family: 'area_atmosphere',
      slotId: 'fix-dup-slot',
      verb: 'appease',
      // Empty profile: lineCount is driven purely by the hand-crafted
      // CardView, so only the duplicate-line rule is in play.
    })
    const state = createInitialTavernState()
    const line = 'the room would settle a step'
    const template = makeRenderedTemplate('phase184.dup-fixture', () =>
      singleChoiceCardView({
        choice: {
          slotId: 'fix-dup-slot',
          label: 'Send the cleaning crew',
          verb: 'appease',
          previewEffects: [line, line],
        },
      }),
    )
    const report = runFixture(template, [{ seed, state }])
    expect(report.pass).toBe(false)
    const dupViolations = report.violations.filter(
      (v) => v.reason === 'preview_duplicate_line',
    )
    expect(dupViolations.length).toBeGreaterThan(0)
    expect(dupViolations[0]?.slotId).toBe('fix-dup-slot')
  })

  it('preview_duplicate_line passes when the choice renders distinct lines (corrected)', () => {
    const seed = seedWithProfile({
      id: 'dup-fixture-ok',
      family: 'area_atmosphere',
      slotId: 'fix-dup-slot',
      verb: 'appease',
    })
    const state = createInitialTavernState()
    const template = makeRenderedTemplate('phase184.dup-fixture-ok', () =>
      singleChoiceCardView({
        choice: {
          slotId: 'fix-dup-slot',
          label: 'Send the cleaning crew',
          verb: 'appease',
          previewEffects: [
            'the room would settle a step',
            'the floor would steady a notch',
          ],
        },
      }),
    )
    const report = runFixture(template, [{ seed, state }])
    const dupViolations = report.violations.filter(
      (v) => v.reason === 'preview_duplicate_line',
    )
    expect(dupViolations.length).toBe(0)
  })

  // Source effects for the risk fixtures: a headline state_change on an
  // un-allowlisted meter (so the meter rule stays out of it), a coin cost,
  // and a decision-relevant rising pressure — in that priority order. With a
  // 2-line render cap the pressure (priority 3) is dropped; with a 3-line cap
  // it surfaces.
  const respectableEffect: EffectPreview = {
    kind: 'state_change',
    target: 'reputation.respectable',
    amount: 4,
    readable: 'the name steadies',
    tags: ['reputation'],
    targetKind: 'reputation',
    direction: 'positive',
    magnitudeBand: 'small',
    meterId: 'respectable',
    meterLabel: 'respectable',
  }
  const coinCostEffect: EffectPreview = {
    kind: 'state_change',
    target: 'coin',
    amount: -12,
    readable: 'a notch of coin leaves the till',
    tags: ['coin'],
    targetKind: 'coin',
    direction: 'negative',
    magnitudeBand: 'small',
    meterId: 'coin',
    meterLabel: 'coin',
  }
  const risingRiskEffect: EffectPreview = {
    kind: 'pressure',
    target: 'pressure:inspection',
    amount: 8,
    readable: 'the inspection risk rises',
    tags: ['pressure'],
    targetKind: 'pressure',
    direction: 'positive',
    magnitudeBand: 'medium',
    meterId: 'inspection',
    meterLabel: 'inspection risk',
  }

  it('preview_risk_unsurfaced fires when a decision-relevant pressure is dropped past the cap', () => {
    const seed = seedWithProfile({
      id: 'risk-fixture',
      family: 'inspection',
      slotId: 'fix-risk-slot',
      verb: 'pay',
      immediate: [respectableEffect, coinCostEffect, risingRiskEffect],
    })
    const state = createInitialTavernState()
    // Only two lines rendered: selectPreviewEffects(source, 2) force-includes
    // the headline state_change and the coin cost (priorities 1+2), so the
    // risk (priority 3) falls out — exactly the hidden-risk defect.
    const template = makeRenderedTemplate('phase184.risk-fixture', () =>
      singleChoiceCardView({
        choice: {
          slotId: 'fix-risk-slot',
          label: 'Pay them off',
          verb: 'pay',
          previewEffects: [
            'word of the name lifts a step',
            'a notch of coin leaves the till',
          ],
        },
      }),
    )
    const report = runFixture(template, [{ seed, state }])
    expect(report.pass).toBe(false)
    const riskViolations = report.violations.filter(
      (v) => v.reason === 'preview_risk_unsurfaced',
    )
    expect(riskViolations.length).toBeGreaterThan(0)
    expect(riskViolations[0]?.slotId).toBe('fix-risk-slot')
  })

  it('preview_risk_unsurfaced passes when the render cap holds the risk (corrected)', () => {
    const seed = seedWithProfile({
      id: 'risk-fixture-ok',
      family: 'inspection',
      slotId: 'fix-risk-slot',
      verb: 'pay',
      immediate: [respectableEffect, coinCostEffect, risingRiskEffect],
    })
    const state = createInitialTavernState()
    // Three lines rendered: selectPreviewEffects(source, 3) holds all three
    // priorities, so the rising risk is surfaced.
    const template = makeRenderedTemplate('phase184.risk-fixture-ok', () =>
      singleChoiceCardView({
        choice: {
          slotId: 'fix-risk-slot',
          label: 'Pay them off',
          verb: 'pay',
          previewEffects: [
            'word of the name lifts a step',
            'a notch of coin leaves the till',
            'the inspection risk would climb a marked rise',
          ],
        },
      }),
    )
    const report = runFixture(template, [{ seed, state }])
    const riskViolations = report.violations.filter(
      (v) => v.reason === 'preview_risk_unsurfaced',
    )
    expect(riskViolations.length).toBe(0)
  })

  // -------------------------------------------------------------------
  // Phase 189 / ISSUE-156 — preview_delayed_unsurfaced. An active choice
  // whose profile carries a decision-relevant delayed consequence must
  // surface a `later:` line. Failing + corrected fixtures.
  // -------------------------------------------------------------------

  // An immediate effect whose rendered line is the sim `readable` (so the
  // magnitude / meter / cost / risk rules all carve out) — isolating the
  // delayed rule as the only one that can fire.
  const steadyingEffect: EffectPreview = {
    kind: 'state_change',
    target: 'reputation.respectable',
    amount: 4,
    readable: 'the name steadies',
    tags: ['reputation'],
    targetKind: 'reputation',
    direction: 'positive',
    magnitudeBand: 'small',
    meterId: 'respectable',
    meterLabel: 'respectable',
  }
  // A decision-relevant delayed consequence (a `future_hook` recurrence hook).
  const expectationHook: EffectPreview = {
    kind: 'future_hook',
    target: 'group_expectation_hook',
    amount: 8,
    readable: 'the group may expect this standard',
    tags: ['future_hook'],
  }

  it('preview_delayed_unsurfaced fires when an active choice hides its decision-relevant delayed consequence', () => {
    const seed = seedWithProfile({
      id: 'delayed-fixture',
      family: 'customer_complaint',
      slotId: 'fix-delayed-slot',
      verb: 'appease',
      immediate: [steadyingEffect],
      delayed: [expectationHook],
    })
    const state = createInitialTavernState()
    // The render surfaces only the immediate line — no `later:` line.
    const template = makeRenderedTemplate('phase189.delayed-fixture', () =>
      singleChoiceCardView({
        choice: {
          slotId: 'fix-delayed-slot',
          label: 'Fix the root cause',
          verb: 'appease',
          previewEffects: ['the name steadies'],
        },
      }),
    )
    const report = runFixture(template, [{ seed, state }])
    expect(report.pass).toBe(false)
    const delayedViolations = report.violations.filter(
      (v) => v.reason === 'preview_delayed_unsurfaced',
    )
    expect(delayedViolations.length).toBeGreaterThan(0)
    expect(delayedViolations[0]?.slotId).toBe('fix-delayed-slot')
  })

  it('preview_delayed_unsurfaced passes when the choice surfaces a later: line (corrected)', () => {
    const seed = seedWithProfile({
      id: 'delayed-fixture-ok',
      family: 'customer_complaint',
      slotId: 'fix-delayed-slot',
      verb: 'appease',
      immediate: [steadyingEffect],
      delayed: [expectationHook],
    })
    const state = createInitialTavernState()
    const template = makeRenderedTemplate('phase189.delayed-fixture-ok', () =>
      singleChoiceCardView({
        choice: {
          slotId: 'fix-delayed-slot',
          label: 'Fix the root cause',
          verb: 'appease',
          previewEffects: [
            'the name steadies',
            'later: the group may expect this standard',
          ],
        },
      }),
    )
    const report = runFixture(template, [{ seed, state }])
    const delayedViolations = report.violations.filter(
      (v) => v.reason === 'preview_delayed_unsurfaced',
    )
    expect(delayedViolations.length).toBe(0)
  })

  it('preview_delayed_unsurfaced does not fire on the inaction path (delayed previewed directly)', () => {
    // A zero-immediate (inaction) profile previews its delayed effects
    // directly via the Phase-147 wiring — no `later:` prefix — and must NOT be
    // flagged for the missing prefix.
    const seed = seedWithProfile({
      id: 'delayed-inaction-fixture',
      family: 'customer_complaint',
      slotId: 'ignore-delayed-slot',
      verb: 'ignore',
      shape: 'ignore',
      immediate: [],
      delayed: [expectationHook],
    })
    const state = createInitialTavernState()
    const template = makeRenderedTemplate('phase189.delayed-inaction-fixture', () =>
      singleChoiceCardView({
        choice: {
          slotId: 'ignore-delayed-slot',
          label: 'Let it ride',
          verb: 'ignore',
          shape: 'ignore',
          previewEffects: ['the group may expect this standard'],
        },
      }),
    )
    const report = runFixture(template, [{ seed, state }])
    const delayedViolations = report.violations.filter(
      (v) => v.reason === 'preview_delayed_unsurfaced',
    )
    expect(delayedViolations.length).toBe(0)
  })
})
