// Phase 168 / ISSUE-136 — Complete Surface arc, Phase 1 (Gate-Wiring
// Contract).
//
// The full-gate registry for the per-template `runAllGates` walk. Where
// Phase 124+ wired the seven always-on framework gates per template, the
// two render-path gates (`previewVariety`, Phase 144; `choiceDistinctness`,
// Phase 148) were opt-in and never configured for a real template. This
// harness derives a per-template sampler for each from the seed's own
// `responseSlots` + `consequenceProfiles` — the same fields the cross-sim
// `legibility` gate reads — so the per-template walk finally runs the full
// nine-gate set.
//
// One entry per migrated compositional template (the 20 in
// `REQUIRED_CARDS` minus `fallbackCard`). `buildSamples` reuses the
// per-template determinism factories already living in `samplers.ts`;
// `labelPool` / `previewPool` are the template's own choice-label /
// effect-preview snippet pools.
//
// The completeness of THIS registry against `REQUIRED_CARDS` is asserted
// by `harnessCompleteness.test.ts` — a template added to `REQUIRED_CARDS`
// but forgotten here fails that test.

import type {
  ChoiceDistinctnessSampler,
  ChoiceDistinctnessSlot,
  DeterminismSample,
  PreviewVarietyChoice,
  PreviewVarietySampler,
} from '../../../../src/cards/compose/gates'
import type {
  CompositionalCardTemplate,
  SnippetPool,
} from '../../../../src/cards/compose/types'
import type { ConsequenceProfile } from '../../../../src/sim/modules/issues/issueSeedTypes'
import {
  applyLegibleChoiceCap,
  DEFAULT_LEGIBLE_CHOICE_CAP,
} from '../../../../src/cards/cardHelpers'

// ---- templates ----
import { areaAtmosphereTemplate } from '../../../../src/cards/templates/areaAtmosphere'
import { cultureConflictTemplate } from '../../../../src/cards/templates/cultureConflict'
import { customerComplaintTemplate } from '../../../../src/cards/templates/customerComplaint'
import { debtRentTemplate } from '../../../../src/cards/templates/debtRent'
import { drinkOrderTemplate } from '../../../../src/cards/templates/drinkOrder'
import { factionRequestTemplate } from '../../../../src/cards/templates/factionRequest'
import { foodSafetyCrisisTemplate } from '../../../../src/cards/templates/foodSafetyCrisis'
import { inspectionTemplate } from '../../../../src/cards/templates/inspection'
import { maintenanceTemplate } from '../../../../src/cards/templates/maintenance'
import { monthlyReviewTemplate } from '../../../../src/cards/templates/monthlyReview'
import { regularComplaintTemplate } from '../../../../src/cards/templates/regularComplaint'
import { reputationShiftTemplate } from '../../../../src/cards/templates/reputationShift'
import { rivalTavernTemplate } from '../../../../src/cards/templates/rivalTavern'
import { rumourCrisisTemplate } from '../../../../src/cards/templates/rumourCrisis'
import { seasonalArcTemplate } from '../../../../src/cards/templates/seasonalArc'
import { staffArcTemplate } from '../../../../src/cards/templates/staffArc'
import { staffAsideTemplate } from '../../../../src/cards/templates/staffAside'
import { staffBurnoutTemplate } from '../../../../src/cards/templates/staffBurnout'
import { stockShortageTemplate } from '../../../../src/cards/templates/stockShortage'
import { supplierReliabilityTemplate } from '../../../../src/cards/templates/supplierReliability'
import { violenceTemplate } from '../../../../src/cards/templates/violence'

// ---- choice-label + effect-preview pools ----
import {
  areaAtmosphereChoiceLabelPool,
  areaAtmosphereEffectPreviewPool,
} from '../../../../src/cards/compose/pools/areaAtmosphere'
import {
  cultureConflictChoiceLabelPool,
  cultureConflictEffectPreviewPool,
} from '../../../../src/cards/compose/pools/cultureConflict'
import {
  customerComplaintChoiceLabelPool,
  customerComplaintEffectPreviewPool,
} from '../../../../src/cards/compose/pools/customerComplaint'
import {
  debtRentChoiceLabelPool,
  debtRentEffectPreviewPool,
} from '../../../../src/cards/compose/pools/debtRent'
import {
  drinkOrderChoiceLabelPool,
  drinkOrderEffectPreviewPool,
} from '../../../../src/cards/compose/pools/drinkOrder'
import {
  factionRequestChoiceLabelPool,
  factionRequestEffectPreviewPool,
} from '../../../../src/cards/compose/pools/factionRequest'
import {
  foodSafetyChoiceLabelPool,
  foodSafetyEffectPreviewPool,
} from '../../../../src/cards/compose/pools/foodSafety'
import {
  inspectionChoiceLabelPool,
  inspectionEffectPreviewPool,
} from '../../../../src/cards/compose/pools/inspection'
import {
  maintenanceChoiceLabelPool,
  maintenanceEffectPreviewPool,
} from '../../../../src/cards/compose/pools/maintenance'
import {
  monthlyReviewChoiceLabelPool,
  monthlyReviewEffectPreviewPool,
} from '../../../../src/cards/compose/pools/monthlyReview'
import {
  regularComplaintChoiceLabelPool,
  regularComplaintEffectPreviewPool,
} from '../../../../src/cards/compose/pools/regularComplaint'
import {
  reputationShiftChoiceLabelPool,
  reputationShiftEffectPreviewPool,
} from '../../../../src/cards/compose/pools/reputationShift'
import {
  rivalTavernChoiceLabelPool,
  rivalTavernEffectPreviewPool,
} from '../../../../src/cards/compose/pools/rivalTavern'
import {
  rumourCrisisChoiceLabelPool,
  rumourCrisisEffectPreviewPool,
} from '../../../../src/cards/compose/pools/rumourCrisis'
import {
  seasonalArcChoiceLabelPool,
  seasonalArcEffectPreviewPool,
} from '../../../../src/cards/compose/pools/seasonalArc'
import {
  staffArcChoiceLabelPool,
  staffArcEffectPreviewPool,
} from '../../../../src/cards/compose/pools/staffArc'
import {
  staffAsideChoiceLabelPool,
  staffAsideEffectPreviewPool,
} from '../../../../src/cards/compose/pools/staffAside'
import {
  staffBurnoutChoiceLabelPool,
  staffBurnoutEffectPreviewPool,
} from '../../../../src/cards/compose/pools/staffBurnout'
import {
  stockShortageChoiceLabelPool,
  stockShortageEffectPreviewPool,
} from '../../../../src/cards/compose/pools/stockShortage'
import {
  supplierReliabilityChoiceLabelPool,
  supplierReliabilityEffectPreviewPool,
} from '../../../../src/cards/compose/pools/supplierReliability'
import {
  violenceChoiceLabelPool,
  violenceEffectPreviewPool,
} from '../../../../src/cards/compose/pools/violence'

// ---- per-template determinism factories ----
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
  buildStaffArcDeterminismSamples,
  buildStaffBurnoutDeterminismSamples,
  buildStaffDeterminismSamples,
  buildStockShortageDeterminismSamples,
  buildSupplierReliabilityDeterminismSamples,
  buildViolenceDeterminismSamples,
} from './samplers'

/** One migrated template plus everything the full nine-gate per-template
 *  walk needs: its choice-label / effect-preview pools (for the two
 *  render-path gates) and the determinism factory (the real
 *  `(seed, state)` sample source, reused from `samplers.ts`). */
export type FullGateSituation = {
  templateId: string
  template: CompositionalCardTemplate
  labelPool: SnippetPool
  previewPool: SnippetPool
  buildSamples: () => readonly DeterminismSample[]
  /** Per-choice preview cap mirroring the template's production
   *  `composeChoicesFromSeed` call. Every migrated template renders with
   *  `maxPreview: 2`, so the gate must too — otherwise it would inspect a
   *  third preview line the player never sees. Defaults to
   *  `PRODUCTION_MAX_PREVIEW`; override only if a template's production
   *  call diverges. */
  maxPreview?: number
}

/** The `maxPreview` every migrated template passes to
 *  `composeChoicesFromSeed` (verified across all 20 `src/cards/templates/*`).
 *  The full-gate samplers mirror it so they check exactly the lines the
 *  player would see. */
export const PRODUCTION_MAX_PREVIEW = 2

/** Gates that are legitimately NOT applicable to a card template's
 *  per-template walk, recorded as data rather than left as silence
 *  (Complete Surface arc, Phase 1). `reportLegibility` reads a per-tag
 *  `tagToBand` mapping for report sections whose magnitude band lives in
 *  the routing tag; card snippets never gate on band-bearing tags, so the
 *  rule has nothing to check on a card template. */
export const CARD_TEMPLATE_EXCLUDED_GATES = ['reportLegibility'] as const

/** The 20 migrated compositional templates the full-gate walk iterates —
 *  `REQUIRED_CARDS` minus `fallbackCard`. Ordering mirrors
 *  `LEGIBILITY_SITUATIONS` for readability. */
export const FULL_GATE_SITUATIONS: readonly FullGateSituation[] = [
  {
    templateId: supplierReliabilityTemplate.id,
    template: supplierReliabilityTemplate,
    labelPool: supplierReliabilityChoiceLabelPool,
    previewPool: supplierReliabilityEffectPreviewPool,
    buildSamples: () => buildSupplierReliabilityDeterminismSamples(),
  },
  {
    templateId: stockShortageTemplate.id,
    template: stockShortageTemplate,
    labelPool: stockShortageChoiceLabelPool,
    previewPool: stockShortageEffectPreviewPool,
    buildSamples: () => buildStockShortageDeterminismSamples(),
  },
  {
    templateId: debtRentTemplate.id,
    template: debtRentTemplate,
    labelPool: debtRentChoiceLabelPool,
    previewPool: debtRentEffectPreviewPool,
    buildSamples: () => buildDebtRentDeterminismSamples(),
  },
  {
    templateId: staffAsideTemplate.id,
    template: staffAsideTemplate,
    labelPool: staffAsideChoiceLabelPool,
    previewPool: staffAsideEffectPreviewPool,
    buildSamples: () => buildStaffDeterminismSamples(),
  },
  {
    templateId: staffBurnoutTemplate.id,
    template: staffBurnoutTemplate,
    labelPool: staffBurnoutChoiceLabelPool,
    previewPool: staffBurnoutEffectPreviewPool,
    buildSamples: () => buildStaffBurnoutDeterminismSamples(),
  },
  {
    templateId: drinkOrderTemplate.id,
    template: drinkOrderTemplate,
    labelPool: drinkOrderChoiceLabelPool,
    previewPool: drinkOrderEffectPreviewPool,
    buildSamples: () => buildDeterminismSamples(),
  },
  {
    templateId: regularComplaintTemplate.id,
    template: regularComplaintTemplate,
    labelPool: regularComplaintChoiceLabelPool,
    previewPool: regularComplaintEffectPreviewPool,
    buildSamples: () => buildRegularComplaintDeterminismSamples(),
  },
  {
    templateId: customerComplaintTemplate.id,
    template: customerComplaintTemplate,
    labelPool: customerComplaintChoiceLabelPool,
    previewPool: customerComplaintEffectPreviewPool,
    buildSamples: () => buildCustomerComplaintDeterminismSamples(),
  },
  {
    templateId: factionRequestTemplate.id,
    template: factionRequestTemplate,
    labelPool: factionRequestChoiceLabelPool,
    previewPool: factionRequestEffectPreviewPool,
    buildSamples: () => buildFactionRequestDeterminismSamples(),
  },
  {
    templateId: cultureConflictTemplate.id,
    template: cultureConflictTemplate,
    labelPool: cultureConflictChoiceLabelPool,
    previewPool: cultureConflictEffectPreviewPool,
    buildSamples: () => buildCultureConflictDeterminismSamples(),
  },
  {
    templateId: maintenanceTemplate.id,
    template: maintenanceTemplate,
    labelPool: maintenanceChoiceLabelPool,
    previewPool: maintenanceEffectPreviewPool,
    buildSamples: () => buildMaintenanceDeterminismSamples(),
  },
  {
    templateId: areaAtmosphereTemplate.id,
    template: areaAtmosphereTemplate,
    labelPool: areaAtmosphereChoiceLabelPool,
    previewPool: areaAtmosphereEffectPreviewPool,
    buildSamples: () => buildAreaAtmosphereDeterminismSamples(),
  },
  {
    templateId: foodSafetyCrisisTemplate.id,
    template: foodSafetyCrisisTemplate,
    labelPool: foodSafetyChoiceLabelPool,
    previewPool: foodSafetyEffectPreviewPool,
    buildSamples: () => buildFoodSafetyDeterminismSamples(),
  },
  {
    templateId: violenceTemplate.id,
    template: violenceTemplate,
    labelPool: violenceChoiceLabelPool,
    previewPool: violenceEffectPreviewPool,
    buildSamples: () => buildViolenceDeterminismSamples(),
  },
  {
    templateId: inspectionTemplate.id,
    template: inspectionTemplate,
    labelPool: inspectionChoiceLabelPool,
    previewPool: inspectionEffectPreviewPool,
    buildSamples: () => buildInspectionDeterminismSamples(),
  },
  {
    templateId: reputationShiftTemplate.id,
    template: reputationShiftTemplate,
    labelPool: reputationShiftChoiceLabelPool,
    previewPool: reputationShiftEffectPreviewPool,
    buildSamples: () => buildReputationShiftDeterminismSamples(),
  },
  {
    templateId: rumourCrisisTemplate.id,
    template: rumourCrisisTemplate,
    labelPool: rumourCrisisChoiceLabelPool,
    previewPool: rumourCrisisEffectPreviewPool,
    buildSamples: () => buildRumourCrisisDeterminismSamples(),
  },
  {
    templateId: rivalTavernTemplate.id,
    template: rivalTavernTemplate,
    labelPool: rivalTavernChoiceLabelPool,
    previewPool: rivalTavernEffectPreviewPool,
    buildSamples: () => buildRivalTavernDeterminismSamples(),
  },
  {
    templateId: monthlyReviewTemplate.id,
    template: monthlyReviewTemplate,
    labelPool: monthlyReviewChoiceLabelPool,
    previewPool: monthlyReviewEffectPreviewPool,
    buildSamples: () => buildMonthlyReviewDeterminismSamples(),
  },
  {
    templateId: seasonalArcTemplate.id,
    template: seasonalArcTemplate,
    labelPool: seasonalArcChoiceLabelPool,
    previewPool: seasonalArcEffectPreviewPool,
    buildSamples: () => buildSeasonalArcDeterminismSamples(),
  },
  {
    templateId: staffArcTemplate.id,
    template: staffArcTemplate,
    labelPool: staffArcChoiceLabelPool,
    previewPool: staffArcEffectPreviewPool,
    buildSamples: () => buildStaffArcDeterminismSamples(),
  },
]

/** Build the `previewVariety` sampler for a situation. Mirrors how
 *  `composeChoicesFromSeed` sources preview effects per response slot:
 *  immediate effects, or delayed effects when immediate is empty (the
 *  Phase-147 inaction carve-out, flagged via `inactionPreview`). */
export function previewVarietySamplerFor(
  situation: FullGateSituation,
): PreviewVarietySampler {
  const samples = situation.buildSamples()
  const maxPreview = situation.maxPreview ?? PRODUCTION_MAX_PREVIEW
  return (i: number) => {
    const { seed, state } = samples[i % samples.length]!
    const choices: PreviewVarietyChoice[] = seed.responseSlots.map((slot) => {
      const profile = profileFor(seed.consequenceProfiles, slot.id)
      const immediate = profile?.immediateEffects ?? []
      const delayed = profile?.delayedEffects ?? []
      const useDelayed = immediate.length === 0 && delayed.length > 0
      return {
        slot,
        effects: useDelayed ? delayed : immediate,
        inactionPreview: useDelayed,
      }
    })
    return {
      seed,
      state,
      previewPool: situation.previewPool,
      choices,
      maxPreview,
    }
  }
}

/** Build the `choiceDistinctness` sampler for a situation. Applies the
 *  production legible choice cap first so the gate operates on the same
 *  capped choice set the player would see (the supplier 11-slot case). */
export function choiceDistinctnessSamplerFor(
  situation: FullGateSituation,
): ChoiceDistinctnessSampler {
  const samples = situation.buildSamples()
  const maxPreview = situation.maxPreview ?? PRODUCTION_MAX_PREVIEW
  return (i: number) => {
    const { seed, state } = samples[i % samples.length]!
    const lookup = (slotId: string) =>
      profileFor(seed.consequenceProfiles, slotId)
    const cappedSlots = applyLegibleChoiceCap(
      seed,
      seed.responseSlots,
      lookup,
      DEFAULT_LEGIBLE_CHOICE_CAP,
    )
    const slots: ChoiceDistinctnessSlot[] = cappedSlots.map((slot) => ({
      slot,
      profile: lookup(slot.id),
    }))
    return {
      seed,
      state,
      labelPool: situation.labelPool,
      previewPool: situation.previewPool,
      slots,
      maxPreview,
    }
  }
}

function profileFor(
  profiles: readonly ConsequenceProfile[],
  slotId: string,
): ConsequenceProfile | undefined {
  return profiles.find((p) => p.responseSlotId === slotId)
}
