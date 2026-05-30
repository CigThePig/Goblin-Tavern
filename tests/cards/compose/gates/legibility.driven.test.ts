// Phase 185 / ISSUE-153 — Choice-Preview Legibility arc, Phase 5
// (Drive, tune, deepen — standing).
//
// Closes the audit's sampling gap. The motivating sweep (Appendix A §2)
// tabulated `food_safety`, `regular_customer`, and `rumour_crisis` as
// "unverified" — they never surfaced in a passive playthrough, so the
// legibility gate had only ever run against their synthetic determinism
// samples, never a seed the live simulation actually emitted. This suite
// drives each into existence from constructed adverse state through the real
// `simulateDay` pipeline, renders the production seed through its production
// template, and asserts the Phase-4 legibility gate is clean for it.
//
// This is the standing proof that "no family is unverified": it runs on every
// `npm test`, so a regression in any of the three families' preview legibility
// — a duplicate line, a hidden risk, an unnamed allowlisted meter — fails here
// even though those families don't surface under neutral play.

import { describe, expect, it } from 'vitest'

import { checkLegibility } from '../../../../src/cards/compose/gates'
import type {
  LegibilityConfig,
  LegibilitySituation,
} from '../../../../src/cards/compose/gates'
import {
  DRIVEN_FAMILIES,
  surfaceDrivenSample,
  templateForSeed,
} from './drivenFamilies'

describe('Phase 185 — Legibility gate (driven, the three unsampled families)', () => {
  for (const family of DRIVEN_FAMILIES) {
    describe(family, () => {
      const sample = surfaceDrivenSample(family)
      const template = templateForSeed(sample.seed, sample.state)
      const situation: LegibilitySituation = {
        templateId: template.id,
        template,
        buildSamples: () => [sample],
      }
      const config: LegibilityConfig = { situations: [situation] }
      const report = checkLegibility(config)
      const observed = report.observed.situations[0]!

      it('surfaces a real seed of the family carrying consequence profiles', () => {
        expect(sample.seed.family).toBe(family)
        // Real, generated content — not an empty stub — so the gate's
        // checks actually have effects to inspect.
        expect(sample.seed.consequenceProfiles.length).toBeGreaterThan(0)
      })

      it('renders at least one playable choice', () => {
        expect(observed.samplesEvaluated).toBe(1)
        expect(observed.choiceSetSizesAfterCap.length).toBe(1)
        expect(observed.choiceSetSizesAfterCap[0]).toBeGreaterThan(0)
      })

      it('passes every legibility rule (Q1 + Q2, including the Phase-184 rules)', () => {
        if (!report.pass) {
          const detail = report.violations
            .slice(0, 8)
            .map((v) => `${v.reason}: ${v.detail}`)
            .join('\n')
          throw new Error(
            `driven ${family} (template ${template.id}) failed with ` +
              `${report.violations.length} violation(s):\n${detail}`,
          )
        }
        expect(report.pass).toBe(true)
        expect(observed.magnitudeChecksFailed).toBe(0)
        expect(observed.costSurfacingChecksFailed).toBe(0)
        expect(observed.labelCollisionsCount).toBe(0)
        expect(observed.inactionBlankCount).toBe(0)
        expect(observed.meterNamingChecksFailed).toBe(0)
        expect(observed.duplicateLineCount).toBe(0)
        expect(observed.riskSurfacingChecksFailed).toBe(0)
      })
    })
  }

  it('drives all three audit-unsampled families, none left unverified', () => {
    const surfaced = DRIVEN_FAMILIES.map((f) => surfaceDrivenSample(f).seed.family)
    expect([...surfaced].sort()).toEqual([...DRIVEN_FAMILIES].sort())
  })
})
