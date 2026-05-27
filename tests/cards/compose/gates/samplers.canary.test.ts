import { describe, expect, it } from 'vitest'

// Phase 163 / ISSUE-131 (Faithful Surface arc, Phase 1).
//
// Synthetic-stub-detection canary. Every gate sampler in `samplers.ts` is
// supposed to emit seeds whose `responseSlots` and `consequenceProfiles`
// match production. Before Phase 1, all 20 templates inherited a 2-slot
// `clean`/`ignore` stub from `cardFactories.makeSeed` — and three downstream
// gates (`choiceDistinctness`, `previewVariety`, `legibility`) were
// auditing a shape players never see. This test catches any regression
// to that stub by asserting three properties on every determinism
// sampler's first sample:
//
//   1. ≥3 response slots (production minimum across all 20 templates).
//   2. consequenceProfiles count covers responseSlots count.
//   3. The verb set is not the stub signature `['clean', 'ignore']`.
//
// If a future change reverts a sampler's `*SeedFor` to a vanilla
// `makeSeed({...})` call without spreading the captured shape, the third
// assertion fires immediately.

import * as Samplers from './samplers'

type DetCase = {
  name: string
  build: () => readonly { seed: { responseSlots: readonly { allowedVerbs: readonly string[] }[]; consequenceProfiles: readonly unknown[] } }[]
}

const CASES: readonly DetCase[] = [
  { name: 'drinkOrder', build: Samplers.buildDeterminismSamples },
  { name: 'staffAside', build: Samplers.buildStaffDeterminismSamples },
  { name: 'staffBurnout', build: Samplers.buildStaffBurnoutDeterminismSamples },
  { name: 'regularComplaint', build: Samplers.buildRegularComplaintDeterminismSamples },
  { name: 'customerComplaint', build: Samplers.buildCustomerComplaintDeterminismSamples },
  { name: 'supplierReliability', build: Samplers.buildSupplierReliabilityDeterminismSamples },
  { name: 'factionRequest', build: Samplers.buildFactionRequestDeterminismSamples },
  { name: 'foodSafety', build: Samplers.buildFoodSafetyDeterminismSamples },
  { name: 'violence', build: Samplers.buildViolenceDeterminismSamples },
  { name: 'inspection', build: Samplers.buildInspectionDeterminismSamples },
  { name: 'rumourCrisis', build: Samplers.buildRumourCrisisDeterminismSamples },
  { name: 'stockShortage', build: Samplers.buildStockShortageDeterminismSamples },
  { name: 'debtRent', build: Samplers.buildDebtRentDeterminismSamples },
  { name: 'maintenance', build: Samplers.buildMaintenanceDeterminismSamples },
  { name: 'areaAtmosphere', build: Samplers.buildAreaAtmosphereDeterminismSamples },
  { name: 'cultureConflict', build: Samplers.buildCultureConflictDeterminismSamples },
  { name: 'monthlyReview', build: Samplers.buildMonthlyReviewDeterminismSamples },
  { name: 'seasonalArc', build: Samplers.buildSeasonalArcDeterminismSamples },
  { name: 'reputationShift', build: Samplers.buildReputationShiftDeterminismSamples },
  { name: 'rivalTavern', build: Samplers.buildRivalTavernDeterminismSamples },
]

describe('Phase 163 / ISSUE-131 — Samplers canary', () => {
  for (const { name, build } of CASES) {
    it(`${name}: ≥3 response slots, matching profile count, non-stub verb set`, () => {
      const samples = build()
      expect(samples.length).toBeGreaterThan(0)
      const sample = samples[0]!
      expect(
        sample.seed.responseSlots.length,
        `${name}: expected ≥3 production-shape slots, got ${sample.seed.responseSlots.length}. Did the sampler regress to cardFactories.makeSeed's 2-slot stub?`,
      ).toBeGreaterThanOrEqual(3)
      expect(
        sample.seed.consequenceProfiles.length,
        `${name}: consequence-profile count must cover slot count`,
      ).toBeGreaterThanOrEqual(sample.seed.responseSlots.length)
      const verbs = sample.seed.responseSlots.flatMap((s) => s.allowedVerbs)
      // The synthetic stub from cardFactories.makeSeed is exactly ['clean', 'ignore'].
      // Real production seeds carry varied verb surfaces (4-15 unique verbs).
      expect(
        verbs,
        `${name}: verb set matches the synthetic stub — sampler is back to inheriting cardFactories.makeSeed defaults`,
      ).not.toEqual(['clean', 'ignore'])
    })
  }
})
