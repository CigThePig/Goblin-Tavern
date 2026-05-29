// Phase 168 / ISSUE-136 — Complete Surface arc, Phase 1 (Gate-Wiring
// Contract).
//
// The per-template `runAllGates` walk, now running the full nine-gate set.
// Before this phase the two render-path gates (`previewVariety`,
// `choiceDistinctness`) were opt-in and configured for zero real
// templates, so every migrated card's per-template walk ran only the
// seven framework gates. This data-driven loop wires both in for every
// situation in `FULL_GATE_SITUATIONS` with a sampler derived from the
// template's own seed shape, and asserts the gates actually ran
// (`skipped === false`) and passed.
//
// The existing per-slot-diversity blocks in `runAllGates.test.ts` stay as
// the detailed diversity walk; this file is the full-gate walk.

import { describe, expect, it } from 'vitest'

import { runAllGates } from '../../../../src/cards/compose/gates'
import { representativeBannedNames } from '../../../../src/cards/compose/gates'
import { createInitialTavernState } from '../../../../src/sim/state/defaults'
import {
  FULL_GATE_SITUATIONS,
  choiceDistinctnessSamplerFor,
  previewVarietySamplerFor,
} from './fullGateHarness'

describe('runAllGates — full nine-gate per-template walk', () => {
  for (const situation of FULL_GATE_SITUATIONS) {
    it(`${situation.templateId} passes the full gate set with previewVariety + choiceDistinctness wired`, () => {
      const state = createInitialTavernState()
      const sampleCount = situation.buildSamples().length
      expect(sampleCount).toBeGreaterThan(0)

      const report = runAllGates(situation.template, {
        simCoherence: {
          bannedDisplayNames: representativeBannedNames(state),
        },
        determinism: { samples: situation.buildSamples() },
        // Per-slot diversity is exercised in detail by the existing
        // runAllGates.test.ts blocks; here we focus on the two newly-wired
        // render-path gates against the full framework set.
        diversity: [],
        previewVariety: {
          sampler: previewVarietySamplerFor(situation),
          config: { sampleSize: sampleCount },
        },
        choiceDistinctness: {
          sampler: choiceDistinctnessSamplerFor(situation),
          config: { sampleSize: sampleCount },
        },
      })

      // The two render-path gates actually ran (not the opt-in no-op).
      expect(report.previewVariety.skipped).toBe(false)
      expect(report.choiceDistinctness.skipped).toBe(false)

      // And they passed — surface violations in the failure message.
      expect(
        report.previewVariety.pass,
        `previewVariety violations: ${JSON.stringify(report.previewVariety.violations)}`,
      ).toBe(true)
      expect(
        report.choiceDistinctness.pass,
        `choiceDistinctness violations: ${JSON.stringify(report.choiceDistinctness.violations)}`,
      ).toBe(true)

      // The full nine-gate aggregate passes.
      expect(report.pass).toBe(true)
    })
  }
})
