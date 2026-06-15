// Phase 161 / ISSUE-129 — Legible Surface arc, Phase 16.
//
// The 20-migrated-template registry for `checkLegibility`. Each
// `LegibilitySituation` entry pairs a compositional template with a
// deterministic sample factory. Sample factories reuse the per-template
// determinism builders already living in `samplers.ts` — those tables
// were authored for Phase 124+ gate-runs against the same templates and
// cover the state-perturbation matrix each cluster needs.
//
// `fallbackCard` is intentionally excluded — it has no `saliencePolicy`
// slots (Q1 trivially passes) and uses `buildChoicesFromSeed` (not the
// production composer; no label/preview pools to test for Q2). The
// fallback is the catch-all by design.

import type {
  LegibilitySituation,
} from '../../../../src/cards/compose/gates'
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

/** The 20 migrated compositional templates Phase 16's gate iterates.
 *  Order is presentation: clusters grouped per Movement-VI authoring
 *  (suppliers/stock/debt, staff, regulars/customers, factions/culture,
 *  premises, crises, reputation/rumour/rivals, periodic, legacy
 *  actor-voiced). The gate iterates in order; output preserves this. */
export const LEGIBILITY_SITUATIONS: readonly LegibilitySituation[] = [
  // Suppliers, Stock & Debt — Phase 149 / ISSUE-117
  {
    templateId: supplierReliabilityTemplate.id,
    template: supplierReliabilityTemplate,
    buildSamples: () => buildSupplierReliabilityDeterminismSamples(),
  },
  {
    templateId: stockShortageTemplate.id,
    template: stockShortageTemplate,
    buildSamples: () => buildStockShortageDeterminismSamples(),
  },
  {
    templateId: debtRentTemplate.id,
    template: debtRentTemplate,
    buildSamples: () => buildDebtRentDeterminismSamples(),
  },
  // Staff & Personnel — Phase 150 / ISSUE-118
  {
    templateId: staffAsideTemplate.id,
    template: staffAsideTemplate,
    buildSamples: () => buildStaffDeterminismSamples(),
  },
  {
    templateId: staffBurnoutTemplate.id,
    template: staffBurnoutTemplate,
    buildSamples: () => buildStaffBurnoutDeterminismSamples(),
  },
  // Regulars & Complaints — Phase 151 / ISSUE-119
  {
    templateId: drinkOrderTemplate.id,
    template: drinkOrderTemplate,
    buildSamples: () => buildDeterminismSamples(),
  },
  {
    templateId: regularComplaintTemplate.id,
    template: regularComplaintTemplate,
    buildSamples: () => buildRegularComplaintDeterminismSamples(),
  },
  {
    templateId: customerComplaintTemplate.id,
    template: customerComplaintTemplate,
    buildSamples: () => buildCustomerComplaintDeterminismSamples(),
  },
  // Factions & Culture — Phase 152 / ISSUE-120
  {
    templateId: factionRequestTemplate.id,
    template: factionRequestTemplate,
    buildSamples: () => buildFactionRequestDeterminismSamples(),
  },
  {
    templateId: cultureConflictTemplate.id,
    template: cultureConflictTemplate,
    buildSamples: () => buildCultureConflictDeterminismSamples(),
  },
  // Premises & Atmosphere — Phase 153 / ISSUE-121
  {
    templateId: maintenanceTemplate.id,
    template: maintenanceTemplate,
    buildSamples: () => buildMaintenanceDeterminismSamples(),
  },
  {
    templateId: areaAtmosphereTemplate.id,
    template: areaAtmosphereTemplate,
    buildSamples: () => buildAreaAtmosphereDeterminismSamples(),
  },
  // Crises & Safety — Phase 154 / ISSUE-122
  {
    templateId: foodSafetyCrisisTemplate.id,
    template: foodSafetyCrisisTemplate,
    buildSamples: () => buildFoodSafetyDeterminismSamples(),
  },
  {
    templateId: violenceTemplate.id,
    template: violenceTemplate,
    buildSamples: () => buildViolenceDeterminismSamples(),
  },
  {
    templateId: inspectionTemplate.id,
    template: inspectionTemplate,
    buildSamples: () => buildInspectionDeterminismSamples(),
  },
  // Reputation, Rumour & Rivals — Phase 155 / ISSUE-123
  {
    templateId: reputationShiftTemplate.id,
    template: reputationShiftTemplate,
    buildSamples: () => buildReputationShiftDeterminismSamples(),
  },
  {
    templateId: rumourCrisisTemplate.id,
    template: rumourCrisisTemplate,
    buildSamples: () => buildRumourCrisisDeterminismSamples(),
  },
  {
    templateId: rivalTavernTemplate.id,
    template: rivalTavernTemplate,
    buildSamples: () => buildRivalTavernDeterminismSamples(),
  },
  // Periodic & Narrative Beats — Phase 156 / ISSUE-124
  {
    templateId: monthlyReviewTemplate.id,
    template: monthlyReviewTemplate,
    buildSamples: () => buildMonthlyReviewDeterminismSamples(),
  },
  {
    templateId: seasonalArcTemplate.id,
    template: seasonalArcTemplate,
    buildSamples: () => buildSeasonalArcDeterminismSamples(),
  },
  // Character Arcs — Phase 4b (teleology)
  {
    templateId: staffArcTemplate.id,
    template: staffArcTemplate,
    buildSamples: () => buildStaffArcDeterminismSamples(),
  },
]
