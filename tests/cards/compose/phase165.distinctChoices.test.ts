// Phase 165 / ISSUE-133 — Faithful Surface arc, Phase 3 (Distinguishable Choices).
//
// Guards the two choice-surface defects this phase fixed, exercised against the
// SHAPE PLAYERS ACTUALLY SEE: each template is rendered through its real
// `.render()` path over the Phase-1 voice-extreme determinism samples (real
// generator `responseSlots` + `consequenceProfiles`, full voice-axis grid).
//
//   1. Label collisions — two distinct response slots on one card must never
//      render the same label. Pre-Phase-165 the label pools keyed only on
//      `responseVerb` (+ voiceAxis), so two slots sharing a leading verb
//      collapsed to one label. Fixed by `responseShape` / `responseSlot`
//      discriminators.
//   2. Preview collapse — no single preview line may appear on 3+ choices in
//      one card render (the `previewVariety` FAIL threshold). Pre-Phase-165 the
//      shared base had ≤2 snippets per (targetKind, direction, band) cell, so
//      3+ same-band slots collapsed. Fixed by `responseShape` variants in the
//      shared base. (2-way residuals are accepted WARN-level per the arc plan.)
//
// Per-template and bounded by design — the comprehensive cross-sim audit is
// Phase 5's job. This re-uses the existing determinism samplers (fast, cached
// real-seed shapes) rather than a new multi-bot harness.

import { describe, it, expect } from 'vitest'
import type { CardDefinition, CardView } from '../../../src/cards/types'
import type { DeterminismSample } from '../../../src/cards/compose/gates'
import {
  foodSafetyCrisisCard,
  customerComplaintCard,
  regularComplaintCard,
  supplierReliabilityCard,
  stockShortageCard,
  debtRentCard,
  maintenanceCard,
  areaAtmosphereCard,
  violenceCard,
  inspectionCard,
  staffBurnoutCard,
  factionRequestCard,
  cultureConflictCard,
  reputationShiftCard,
  rumourCrisisCard,
  rivalTavernCard,
  monthlyReviewCard,
  seasonalArcCard,
  drinkOrderCard,
  staffAsideCard,
} from '../../../src/cards/templates/index'
import {
  buildAreaAtmosphereDeterminismSamples,
  buildCultureConflictDeterminismSamples,
  buildCustomerComplaintDeterminismSamples,
  buildDebtRentDeterminismSamples,
  buildDeterminismSamples,
  buildFactionRequestDeterminismSamples,
  buildFoodSafetyDeterminismSamples,
  buildInspectionDeterminismSamples,
  buildMaintenanceDeterminismSamples,
  buildMonthlyReviewDeterminismSamples,
  buildRegularComplaintDeterminismSamples,
  buildReputationShiftDeterminismSamples,
  buildRivalTavernDeterminismSamples,
  buildRumourCrisisDeterminismSamples,
  buildSeasonalArcDeterminismSamples,
  buildStaffBurnoutDeterminismSamples,
  buildStaffDeterminismSamples,
  buildStockShortageDeterminismSamples,
  buildSupplierReliabilityDeterminismSamples,
  buildViolenceDeterminismSamples,
} from './gates/samplers'

type Entry = [string, CardDefinition, () => DeterminismSample[]]

const TEMPLATES: Entry[] = [
  ['drinkOrder', drinkOrderCard, buildDeterminismSamples],
  ['staffAside', staffAsideCard, buildStaffDeterminismSamples],
  ['staffBurnout', staffBurnoutCard, buildStaffBurnoutDeterminismSamples],
  ['regularComplaint', regularComplaintCard, buildRegularComplaintDeterminismSamples],
  ['customerComplaint', customerComplaintCard, buildCustomerComplaintDeterminismSamples],
  ['factionRequest', factionRequestCard, buildFactionRequestDeterminismSamples],
  ['cultureConflict', cultureConflictCard, buildCultureConflictDeterminismSamples],
  ['supplierReliability', supplierReliabilityCard, buildSupplierReliabilityDeterminismSamples],
  ['stockShortage', stockShortageCard, buildStockShortageDeterminismSamples],
  ['debtRent', debtRentCard, buildDebtRentDeterminismSamples],
  ['maintenance', maintenanceCard, buildMaintenanceDeterminismSamples],
  ['areaAtmosphere', areaAtmosphereCard, buildAreaAtmosphereDeterminismSamples],
  ['foodSafety', foodSafetyCrisisCard, buildFoodSafetyDeterminismSamples],
  ['violence', violenceCard, buildViolenceDeterminismSamples],
  ['inspection', inspectionCard, buildInspectionDeterminismSamples],
  ['reputationShift', reputationShiftCard, buildReputationShiftDeterminismSamples],
  ['rumourCrisis', rumourCrisisCard, buildRumourCrisisDeterminismSamples],
  ['rivalTavern', rivalTavernCard, buildRivalTavernDeterminismSamples],
  ['monthlyReview', monthlyReviewCard, buildMonthlyReviewDeterminismSamples],
  ['seasonalArc', seasonalArcCard, buildSeasonalArcDeterminismSamples],
]

/** The most distinct choices sharing one preview line within a single card. */
function maxPreviewRun(view: CardView): { run: number; line: string } {
  const byLine = new Map<string, Set<string>>()
  for (const c of view.choices) {
    for (const line of c.previewEffects) {
      if (!byLine.has(line)) byLine.set(line, new Set())
      byLine.get(line)!.add(c.slotId)
    }
  }
  let run = 0
  let line = ''
  for (const [text, slots] of byLine) {
    if (slots.size > run) {
      run = slots.size
      line = text
    }
  }
  return { run, line }
}

describe('Phase 165 — distinguishable choices (real-seed renders)', () => {
  for (const [name, card, sampler] of TEMPLATES) {
    it(`${name}: no two choices on one card render the same label`, () => {
      for (const { seed, state } of sampler()) {
        const view = card.render(seed, state)
        const seen = new Map<string, string>()
        for (const c of view.choices) {
          const prior = seen.get(c.label)
          expect(
            prior,
            `${name}: label "${c.label}" rendered for both ${prior} and ${c.slotId}`,
          ).toBeUndefined()
          seen.set(c.label, c.slotId)
        }
      }
    })

    it(`${name}: no preview line appears on 3+ choices in one card`, () => {
      for (const { seed, state } of sampler()) {
        const view = card.render(seed, state)
        const { run, line } = maxPreviewRun(view)
        expect(
          run,
          `${name}: preview line "${line}" rendered on ${run} choices in one card`,
        ).toBeLessThanOrEqual(2)
      }
    })
  }

  it('factionRequest: same-verb slots negotiate_terms / play_rival_faction render distinct labels', () => {
    for (const { seed, state } of buildFactionRequestDeterminismSamples()) {
      const view = factionRequestCard.render(seed, state)
      const bySlot = new Map(view.choices.map((c) => [c.slotId, c.label]))
      const a = bySlot.get('negotiate_terms')
      const b = bySlot.get('play_rival_faction')
      if (a !== undefined && b !== undefined) {
        expect(a).not.toBe(b)
      }
    }
  })
})
