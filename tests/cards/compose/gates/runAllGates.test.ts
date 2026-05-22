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
import { createInitialTavernState } from '../../../../src/sim/state/defaults'
import { buildTemplate } from './fixtures'
import {
  buildDeterminismSamples,
  buildDiversitySampler,
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
