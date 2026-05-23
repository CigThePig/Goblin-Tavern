// Phase 124 / ISSUE-093 — Living Cast arc, Phase D.
//
// Integration test for the composite runner. Proves the real drinkOrder
// template clears all six gates with one call and that a regression in
// any single gate surfaces independently from the others — Phase E's
// generation pipeline relies on this report shape to attribute failures
// back to the right retry prompt.

import { describe, expect, it } from 'vitest'

import { runAllGates } from '../../../../src/cards/compose/gates'
import { drinkOrderTemplate } from '../../../../src/cards/templates/drinkOrder'
import { staffAsideTemplate } from '../../../../src/cards/templates/staffAside'
import { staffBurnoutTemplate } from '../../../../src/cards/templates/staffBurnout'
import {
  drinkOrderChoiceLabelPool,
  drinkOrderEffectPreviewPool,
} from '../../../../src/cards/compose/pools/drinkOrder'
import {
  staffAsideChoiceLabelPool,
  staffAsideEffectPreviewPool,
} from '../../../../src/cards/compose/pools/staffAside'
import type { CompositionalCardTemplate } from '../../../../src/cards/compose/types'
import { createInitialTavernState } from '../../../../src/sim/state/defaults'
import { buildTemplate } from './fixtures'
import {
  buildDeterminismSamples,
  buildDiversitySampler,
  buildDrinkOrderChoiceLabelContext,
  buildDrinkOrderEffectPreviewContext,
  buildStaffAsideChoiceLabelContext,
  buildStaffAsideEffectPreviewContext,
  buildStaffBurnoutDeterminismSamples,
  buildStaffBurnoutDiversitySampler,
  buildStaffDeterminismSamples,
  buildStaffDiversitySampler,
  representativeBannedNames,
} from './samplers'

describe('runAllGates — happy path', () => {
  it('the real drinkOrder template passes all six gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(drinkOrderTemplate, {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: buildDeterminismSamples() },
      diversity: [
        // Phase 131 / ISSUE-100 — title is now a composed slot; the
        // diversity sampler exercises it the same way as order_line.
        // The title pool is small (one fallback plus a voice-axis-
        // conditioned variant per axis) so the achievable distinct
        // count is correspondingly lower.
        {
          slotId: 'title',
          sampler: buildDiversitySampler({ rngSeed: 'run-all-title' }),
          config: { sampleSize: 100, minDistinct: 3 },
        },
        {
          slotId: 'order_line',
          sampler: buildDiversitySampler({ rngSeed: 'run-all-order' }),
          config: { sampleSize: 100, minDistinct: 6 },
        },
        {
          slotId: 'manner_note',
          sampler: buildDiversitySampler({ rngSeed: 'run-all-manner' }),
          config: { sampleSize: 100, minDistinct: 3 },
        },
      ],
    })
    expect(report.pass).toBe(true)
    expect(report.coverage.pass).toBe(true)
    expect(report.specificity.pass).toBe(true)
    expect(report.voiceBounds.pass).toBe(true)
    expect(report.simCoherence.pass).toBe(true)
    expect(report.determinism.pass).toBe(true)
    expect(report.diversity.every((d) => d.pass)).toBe(true)
  })

  // Phase 126 / ISSUE-095 — the same composite runner clears the new
  // staffAside template against the same six gates. Diversity samplers
  // and determinism profiles target a staff actor; banned-names list is
  // shared (it includes both staff and regular display names).
  it('the real staffAside template passes all six gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(staffAsideTemplate, {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: buildStaffDeterminismSamples() },
      diversity: [
        {
          slotId: 'title',
          sampler: buildStaffDiversitySampler({ rngSeed: 'run-all-staff-title' }),
          config: { sampleSize: 100, minDistinct: 3 },
        },
        // Phase 133 / ISSUE-102 — establishing_line is sim-backed; the
        // voice-perturbation sampler doesn't vary signal state, so the
        // achievable distinct count is small (fallback + est_low_stress
        // for the starter staff). minDistinct: 1 holds the floor; the
        // simCoherence + coverage gates exercise the rest.
        {
          slotId: 'establishing_line',
          sampler: buildStaffDiversitySampler({ rngSeed: 'run-all-staff-establishing' }),
          config: { sampleSize: 100, minDistinct: 1 },
        },
        {
          slotId: 'aside_line',
          sampler: buildStaffDiversitySampler({ rngSeed: 'run-all-aside' }),
          config: { sampleSize: 100, minDistinct: 6 },
        },
        {
          slotId: 'manner_note',
          sampler: buildStaffDiversitySampler({ rngSeed: 'run-all-staff-manner' }),
          config: { sampleSize: 100, minDistinct: 3 },
        },
      ],
    })
    expect(report.pass).toBe(true)
    expect(report.coverage.pass).toBe(true)
    expect(report.specificity.pass).toBe(true)
    expect(report.voiceBounds.pass).toBe(true)
    expect(report.simCoherence.pass).toBe(true)
    expect(report.determinism.pass).toBe(true)
    expect(report.diversity.every((d) => d.pass)).toBe(true)
  })

  // Phase 133 / ISSUE-102 — Voiced Surface arc, Phase 7. The new
  // staff_burnout template (replacing the legacy staffRequest) passes
  // every gate too. Voice-perturbation sampler is the same shape as
  // staff_aside's; the seed targets the staff_burnout / staff_request /
  // morning_prep slice the new template handles.
  it('the real staffBurnout template passes all seven gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(staffBurnoutTemplate, {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: buildStaffBurnoutDeterminismSamples() },
      diversity: [
        {
          slotId: 'title',
          sampler: buildStaffBurnoutDiversitySampler({
            rngSeed: 'run-all-staff-burnout-title',
          }),
          config: { sampleSize: 100, minDistinct: 3 },
        },
        {
          slotId: 'establishing_line',
          sampler: buildStaffBurnoutDiversitySampler({
            rngSeed: 'run-all-staff-burnout-establishing',
          }),
          config: { sampleSize: 100, minDistinct: 1 },
        },
        {
          slotId: 'reaction_line',
          sampler: buildStaffBurnoutDiversitySampler({
            rngSeed: 'run-all-staff-burnout-reaction',
          }),
          config: { sampleSize: 100, minDistinct: 6 },
        },
        {
          slotId: 'manner_note',
          sampler: buildStaffBurnoutDiversitySampler({
            rngSeed: 'run-all-staff-burnout-manner',
          }),
          config: { sampleSize: 100, minDistinct: 3 },
        },
      ],
    })
    expect(report.pass).toBe(true)
    expect(report.coverage.pass).toBe(true)
    expect(report.specificity.pass).toBe(true)
    expect(report.voiceBounds.pass).toBe(true)
    expect(report.simCoherence.pass).toBe(true)
    expect(report.determinism.pass).toBe(true)
    expect(report.diversity.every((d) => d.pass)).toBe(true)
  })
})

// ---- Phase 132 / ISSUE-101 — Voiced Surface arc, Phase 6 ----
//
// Choice-label and effect-preview pools live outside the runtime
// template's `slots[]` (the helper `composeChoicesFromSeed` builds
// synthetic SlotSpecs per response slot / per effect). To run the seven
// gates against these pools, build ad-hoc gate-only templates that
// include them as static slot members. The pickContext threading on the
// diversity gate supplies the iteration context the new condition
// primitives read.

function buildDrinkOrderChoicesGateTemplate(): CompositionalCardTemplate {
  return {
    ...drinkOrderTemplate,
    id: 'phase132-drinkOrder-choices-gate',
    slots: [
      {
        id: 'choice_label',
        role: 'choice_label',
        pool: drinkOrderChoiceLabelPool,
        optional: true,
        wordBudget: 6,
        claimMode: 'flavor',
      },
      {
        id: 'effect_preview',
        role: 'effect_preview',
        pool: drinkOrderEffectPreviewPool,
        optional: true,
        wordBudget: 10,
        claimMode: 'flavor',
      },
    ],
  }
}

function buildStaffAsideChoicesGateTemplate(): CompositionalCardTemplate {
  return {
    ...staffAsideTemplate,
    id: 'phase132-staffAside-choices-gate',
    slots: [
      {
        id: 'choice_label',
        role: 'choice_label',
        pool: staffAsideChoiceLabelPool,
        optional: true,
        wordBudget: 6,
        claimMode: 'flavor',
      },
      {
        id: 'effect_preview',
        role: 'effect_preview',
        pool: staffAsideEffectPreviewPool,
        optional: true,
        wordBudget: 10,
        claimMode: 'flavor',
      },
    ],
  }
}

describe('runAllGates — Phase 6 choice / consequence pools', () => {
  it('the drinkOrder choice-label and effect-preview pools pass all gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(buildDrinkOrderChoicesGateTemplate(), {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      // No need to sample the full render path here — the determinism
      // gate runs against the existing runtime template; this ad-hoc
      // gate-only template is checked structurally. An empty samples
      // list keeps the gate as a no-op.
      determinism: { samples: [] },
      diversity: [
        {
          slotId: 'choice_label',
          sampler: buildDiversitySampler({ rngSeed: 'phase132-choice-label' }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildDrinkOrderChoiceLabelContext,
          },
        },
        {
          slotId: 'effect_preview',
          sampler: buildDiversitySampler({ rngSeed: 'phase132-effect-preview' }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildDrinkOrderEffectPreviewContext,
          },
        },
      ],
    })
    expect(report.pass).toBe(true)
    expect(report.coverage.pass).toBe(true)
    expect(report.specificity.pass).toBe(true)
    expect(report.voiceBounds.pass).toBe(true)
    expect(report.simCoherence.pass).toBe(true)
    expect(report.dedupe.pass).toBe(true)
    expect(report.diversity.every((d) => d.pass)).toBe(true)
  })

  it('the staffAside choice-label and effect-preview pools pass all gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(buildStaffAsideChoicesGateTemplate(), {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: [] },
      diversity: [
        {
          slotId: 'choice_label',
          sampler: buildStaffDiversitySampler({
            rngSeed: 'phase132-staff-choice-label',
          }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildStaffAsideChoiceLabelContext,
          },
        },
        {
          slotId: 'effect_preview',
          sampler: buildStaffDiversitySampler({
            rngSeed: 'phase132-staff-effect-preview',
          }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildStaffAsideEffectPreviewContext,
          },
        },
      ],
    })
    expect(report.pass).toBe(true)
    expect(report.coverage.pass).toBe(true)
    expect(report.specificity.pass).toBe(true)
    expect(report.voiceBounds.pass).toBe(true)
    expect(report.simCoherence.pass).toBe(true)
    expect(report.dedupe.pass).toBe(true)
    expect(report.diversity.every((d) => d.pass)).toBe(true)
  })
})

describe('runAllGates — independent failure attribution', () => {
  it('an over-budget snippet flips voiceBounds.pass without affecting coverage / specificity', () => {
    // Build a template whose pool clears coverage + specificity but
    // plants one over-budget snippet. Proves gates report
    // independently — Phase E reads each sub-report to attribute the
    // retry prompt to the right gate.
    const budget = 5
    const longText = Array.from({ length: budget + 3 }).fill('word').join(' ')
    const bad = buildTemplate('bad_only_voicebounds', [
      {
        id: 'order_line',
        role: 'aside',
        wordBudget: budget,
        claimMode: 'flavor',
        pool: {
          slotId: 'order_line',
          snippets: [
            { id: 'fallback', text: 'Ale.', conditions: [] },
            {
              id: 'too_long_but_conditioned',
              text: longText,
              conditions: [
                {
                  kind: 'voiceAxis',
                  role: 'primaryActor',
                  axis: 'terseness',
                  atLeast: 2,
                },
              ],
            },
          ],
        },
      },
    ])
    const state = createInitialTavernState()
    const report = runAllGates(bad, {
      simCoherence: { bannedDisplayNames: representativeBannedNames(state) },
      determinism: { samples: buildDeterminismSamples().slice(0, 1) },
      diversity: [],
    })
    expect(report.pass).toBe(false)
    expect(report.voiceBounds.pass).toBe(false)
    expect(report.voiceBounds.violations[0]!.reason).toBe('over_budget')
    // Coverage + specificity + sim-coherence + determinism stay green —
    // the bad slot has both a fallback and a conditioned snippet, both
    // texts contain no banned tokens, and the assembler is deterministic.
    expect(report.coverage.pass).toBe(true)
    expect(report.specificity.pass).toBe(true)
    expect(report.simCoherence.pass).toBe(true)
    expect(report.determinism.pass).toBe(true)
  })

  it('reports diversity_slot_not_found when a configured slot does not exist on the template', () => {
    const state = createInitialTavernState()
    const report = runAllGates(drinkOrderTemplate, {
      simCoherence: { bannedDisplayNames: representativeBannedNames(state) },
      determinism: { samples: [] },
      diversity: [
        {
          slotId: 'no_such_slot',
          sampler: buildDiversitySampler({ rngSeed: 'missing' }),
          config: { sampleSize: 1, minDistinct: 1 },
        },
      ],
    })
    expect(report.diversity[0]!.pass).toBe(false)
    expect(report.diversity[0]!.violations[0]!.reason).toBe(
      'diversity_slot_not_found',
    )
  })
})
