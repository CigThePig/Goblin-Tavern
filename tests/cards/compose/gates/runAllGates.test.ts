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
import { regularComplaintTemplate } from '../../../../src/cards/templates/regularComplaint'
import { customerComplaintTemplate } from '../../../../src/cards/templates/customerComplaint'
import { supplierReliabilityTemplate } from '../../../../src/cards/templates/supplierReliability'
import { stockShortageTemplate } from '../../../../src/cards/templates/stockShortage'
import { debtRentTemplate } from '../../../../src/cards/templates/debtRent'
import { factionRequestTemplate } from '../../../../src/cards/templates/factionRequest'
import { cultureConflictTemplate } from '../../../../src/cards/templates/cultureConflict'
import { maintenanceTemplate } from '../../../../src/cards/templates/maintenance'
import { areaAtmosphereTemplate } from '../../../../src/cards/templates/areaAtmosphere'
import {
  drinkOrderChoiceLabelPool,
  drinkOrderEffectPreviewPool,
} from '../../../../src/cards/compose/pools/drinkOrder'
import {
  staffAsideChoiceLabelPool,
  staffAsideEffectPreviewPool,
} from '../../../../src/cards/compose/pools/staffAside'
import {
  regularComplaintChoiceLabelPool,
  regularComplaintEffectPreviewPool,
} from '../../../../src/cards/compose/pools/regularComplaint'
import {
  customerComplaintChoiceLabelPool,
  customerComplaintEffectPreviewPool,
} from '../../../../src/cards/compose/pools/customerComplaint'
import {
  supplierReliabilityChoiceLabelPool,
  supplierReliabilityEffectPreviewPool,
} from '../../../../src/cards/compose/pools/supplierReliability'
import {
  stockShortageChoiceLabelPool,
  stockShortageEffectPreviewPool,
} from '../../../../src/cards/compose/pools/stockShortage'
import {
  debtRentChoiceLabelPool,
  debtRentEffectPreviewPool,
} from '../../../../src/cards/compose/pools/debtRent'
import {
  factionRequestChoiceLabelPool,
  factionRequestEffectPreviewPool,
} from '../../../../src/cards/compose/pools/factionRequest'
import {
  cultureConflictChoiceLabelPool,
  cultureConflictEffectPreviewPool,
} from '../../../../src/cards/compose/pools/cultureConflict'
import {
  maintenanceChoiceLabelPool,
  maintenanceEffectPreviewPool,
} from '../../../../src/cards/compose/pools/maintenance'
import {
  areaAtmosphereChoiceLabelPool,
  areaAtmosphereEffectPreviewPool,
} from '../../../../src/cards/compose/pools/areaAtmosphere'
import type { CompositionalCardTemplate } from '../../../../src/cards/compose/types'
import { createInitialTavernState } from '../../../../src/sim/state/defaults'
import { buildTemplate } from './fixtures'
import {
  buildAreaAtmosphereChoiceLabelContext,
  buildAreaAtmosphereDeterminismSamples,
  buildAreaAtmosphereDiversitySampler,
  buildAreaAtmosphereEffectPreviewContext,
  buildCultureConflictChoiceLabelContext,
  buildCultureConflictDeterminismSamples,
  buildCultureConflictDiversitySampler,
  buildCultureConflictEffectPreviewContext,
  buildMaintenanceChoiceLabelContext,
  buildMaintenanceDeterminismSamples,
  buildMaintenanceDiversitySampler,
  buildMaintenanceEffectPreviewContext,
  buildCustomerComplaintChoiceLabelContext,
  buildCustomerComplaintDeterminismSamples,
  buildCustomerComplaintDiversitySampler,
  buildCustomerComplaintEffectPreviewContext,
  buildDebtRentChoiceLabelContext,
  buildDebtRentDeterminismSamples,
  buildDebtRentDiversitySampler,
  buildDebtRentEffectPreviewContext,
  buildDeterminismSamples,
  buildDiversitySampler,
  buildDrinkOrderChoiceLabelContext,
  buildDrinkOrderEffectPreviewContext,
  buildFactionRequestChoiceLabelContext,
  buildFactionRequestDeterminismSamples,
  buildFactionRequestDiversitySampler,
  buildFactionRequestEffectPreviewContext,
  buildRegularComplaintChoiceLabelContext,
  buildRegularComplaintDeterminismSamples,
  buildRegularComplaintDiversitySampler,
  buildRegularComplaintEffectPreviewContext,
  buildStaffAsideChoiceLabelContext,
  buildStaffAsideEffectPreviewContext,
  buildStaffBurnoutDeterminismSamples,
  buildStaffBurnoutDiversitySampler,
  buildStaffDeterminismSamples,
  buildStaffDiversitySampler,
  buildStockShortageChoiceLabelContext,
  buildStockShortageDeterminismSamples,
  buildStockShortageDiversitySampler,
  buildStockShortageEffectPreviewContext,
  buildSupplierReliabilityChoiceLabelContext,
  buildSupplierReliabilityDeterminismSamples,
  buildSupplierReliabilityDiversitySampler,
  buildSupplierReliabilityEffectPreviewContext,
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

  // Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8 (Regulars & Complaints).
  // Two new compositional templates partition the legacy customerComplaint
  // surface by family. Each clears every gate against the perturbed regular
  // / customer-group cast distribution, the same shape staffBurnout uses.
  it('the real regularComplaint template passes all seven gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(regularComplaintTemplate, {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: buildRegularComplaintDeterminismSamples() },
      diversity: [
        {
          slotId: 'title',
          sampler: buildRegularComplaintDiversitySampler({
            rngSeed: 'run-all-regular-complaint-title',
          }),
          config: { sampleSize: 100, minDistinct: 3 },
        },
        {
          slotId: 'establishing_line',
          sampler: buildRegularComplaintDiversitySampler({
            rngSeed: 'run-all-regular-complaint-establishing',
          }),
          config: { sampleSize: 100, minDistinct: 1 },
        },
        {
          slotId: 'reaction_line',
          sampler: buildRegularComplaintDiversitySampler({
            rngSeed: 'run-all-regular-complaint-reaction',
          }),
          config: { sampleSize: 100, minDistinct: 6 },
        },
        {
          slotId: 'manner_note',
          sampler: buildRegularComplaintDiversitySampler({
            rngSeed: 'run-all-regular-complaint-manner',
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

  it('the real customerComplaint template passes all seven gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(customerComplaintTemplate, {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: buildCustomerComplaintDeterminismSamples() },
      diversity: [
        {
          slotId: 'title',
          sampler: buildCustomerComplaintDiversitySampler({
            rngSeed: 'run-all-customer-complaint-title',
          }),
          config: { sampleSize: 100, minDistinct: 3 },
        },
        {
          slotId: 'establishing_line',
          sampler: buildCustomerComplaintDiversitySampler({
            rngSeed: 'run-all-customer-complaint-establishing',
          }),
          config: { sampleSize: 100, minDistinct: 1 },
        },
        {
          slotId: 'reaction_line',
          sampler: buildCustomerComplaintDiversitySampler({
            rngSeed: 'run-all-customer-complaint-reaction',
          }),
          config: { sampleSize: 100, minDistinct: 6 },
        },
        {
          slotId: 'manner_note',
          sampler: buildCustomerComplaintDiversitySampler({
            rngSeed: 'run-all-customer-complaint-manner',
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

  // Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
  // Three new compositional templates land in this cluster:
  //   - supplierReliability: actor-voiced, mirrors the Phase-7 / Phase-8
  //     cast-perturbation pattern using `createSupplierCastAttributes`.
  //   - stockShortage / debtRent: narrator-voiced (no primaryActor on
  //     the seed), so the diversity sampler perturbs STATE not cast.
  //     The reachable condition space is smaller — `minDistinct` on the
  //     flavor slots is set to the realised distribution + a safety
  //     floor of 3 (still tight; under that the gate is meaningfully
  //     informative).
  it('the real supplierReliability template passes all seven gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(supplierReliabilityTemplate, {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: buildSupplierReliabilityDeterminismSamples() },
      diversity: [
        {
          slotId: 'title',
          sampler: buildSupplierReliabilityDiversitySampler({
            rngSeed: 'run-all-supplier-reliability-title',
          }),
          config: { sampleSize: 100, minDistinct: 3 },
        },
        {
          slotId: 'establishing_line',
          sampler: buildSupplierReliabilityDiversitySampler({
            rngSeed: 'run-all-supplier-reliability-establishing',
          }),
          config: { sampleSize: 100, minDistinct: 1 },
        },
        {
          slotId: 'reaction_line',
          sampler: buildSupplierReliabilityDiversitySampler({
            rngSeed: 'run-all-supplier-reliability-reaction',
          }),
          config: { sampleSize: 100, minDistinct: 6 },
        },
        {
          slotId: 'manner_note',
          sampler: buildSupplierReliabilityDiversitySampler({
            rngSeed: 'run-all-supplier-reliability-manner',
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

  it('the real stockShortage template passes all seven gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(stockShortageTemplate, {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: buildStockShortageDeterminismSamples() },
      diversity: [
        {
          slotId: 'title',
          sampler: buildStockShortageDiversitySampler({
            rngSeed: 'run-all-stock-shortage-title',
          }),
          config: { sampleSize: 100, minDistinct: 3 },
        },
        {
          slotId: 'establishing_line',
          sampler: buildStockShortageDiversitySampler({
            rngSeed: 'run-all-stock-shortage-establishing',
          }),
          config: { sampleSize: 100, minDistinct: 1 },
        },
        {
          slotId: 'reaction_line',
          sampler: buildStockShortageDiversitySampler({
            rngSeed: 'run-all-stock-shortage-reaction',
          }),
          // Narrator-voiced. State perturbation reaches a smaller
          // condition surface than cast perturbation (10–12 distinct
          // perturbations vs the continuous 4-axis cast space), so the
          // floor is 3 distinct rather than the actor-voiced 6.
          config: { sampleSize: 100, minDistinct: 3 },
        },
        {
          slotId: 'manner_note',
          sampler: buildStockShortageDiversitySampler({
            rngSeed: 'run-all-stock-shortage-manner',
          }),
          config: { sampleSize: 100, minDistinct: 2 },
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

  it('the real debtRent template passes all seven gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(debtRentTemplate, {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: buildDebtRentDeterminismSamples() },
      diversity: [
        {
          slotId: 'title',
          sampler: buildDebtRentDiversitySampler({
            rngSeed: 'run-all-debt-rent-title',
          }),
          config: { sampleSize: 100, minDistinct: 3 },
        },
        {
          slotId: 'establishing_line',
          sampler: buildDebtRentDiversitySampler({
            rngSeed: 'run-all-debt-rent-establishing',
          }),
          config: { sampleSize: 100, minDistinct: 1 },
        },
        {
          slotId: 'reaction_line',
          sampler: buildDebtRentDiversitySampler({
            rngSeed: 'run-all-debt-rent-reaction',
          }),
          config: { sampleSize: 100, minDistinct: 3 },
        },
        {
          slotId: 'manner_note',
          sampler: buildDebtRentDiversitySampler({
            rngSeed: 'run-all-debt-rent-manner',
          }),
          config: { sampleSize: 100, minDistinct: 2 },
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

  // Phase 136 / ISSUE-105 — Voiced Surface arc, Phase 10 (Factions & Culture).
  // Two new compositional templates land in this cluster:
  //   - factionRequest: actor-voiced, mirrors the Phase-7 / Phase-8 / Phase-9
  //     cast-perturbation pattern using `createFactionCastAttributes`.
  //   - cultureConflict: narrator-voiced (cultures have no castAttributes),
  //     so the diversity sampler perturbs STATE not cast. The reachable
  //     condition space (culture meters × pressures × memories × calendar
  //     tags) is smaller than the continuous 4-axis cast space; `minDistinct`
  //     on the flavor slots is set to a tight floor of 3.
  it('the real factionRequest template passes all seven gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(factionRequestTemplate, {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: buildFactionRequestDeterminismSamples() },
      diversity: [
        {
          slotId: 'title',
          sampler: buildFactionRequestDiversitySampler({
            rngSeed: 'run-all-faction-request-title',
          }),
          config: { sampleSize: 100, minDistinct: 3 },
        },
        {
          slotId: 'establishing_line',
          sampler: buildFactionRequestDiversitySampler({
            rngSeed: 'run-all-faction-request-establishing',
          }),
          config: { sampleSize: 100, minDistinct: 1 },
        },
        {
          slotId: 'reaction_line',
          sampler: buildFactionRequestDiversitySampler({
            rngSeed: 'run-all-faction-request-reaction',
          }),
          config: { sampleSize: 100, minDistinct: 6 },
        },
        {
          slotId: 'manner_note',
          sampler: buildFactionRequestDiversitySampler({
            rngSeed: 'run-all-faction-request-manner',
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

  // Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11 (Premises & Atmosphere).
  // Two new compositional templates land in this cluster:
  //   - maintenance: narrator-voiced (no primaryActor; area resolved via
  //     `seed.location` and the Phase-11 `'location'` role extension).
  //     The diversity sampler perturbs STATE (area meters, pressures,
  //     memories, tone tags, severity). The reachable surface is
  //     comparable to Phase 9's stock/debt; `minDistinct` on the flavor
  //     slots is set to a tight floor of 3.
  //   - areaAtmosphere: same shape — narrator-voiced, state-perturbed.
  it('the real maintenance template passes all seven gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(maintenanceTemplate, {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: buildMaintenanceDeterminismSamples() },
      diversity: [
        {
          slotId: 'title',
          sampler: buildMaintenanceDiversitySampler({
            rngSeed: 'run-all-maintenance-title',
          }),
          config: { sampleSize: 100, minDistinct: 3 },
        },
        {
          slotId: 'establishing_line',
          sampler: buildMaintenanceDiversitySampler({
            rngSeed: 'run-all-maintenance-establishing',
          }),
          config: { sampleSize: 100, minDistinct: 1 },
        },
        {
          slotId: 'reaction_line',
          sampler: buildMaintenanceDiversitySampler({
            rngSeed: 'run-all-maintenance-reaction',
          }),
          // Narrator-voiced. State perturbation reaches a smaller
          // condition surface than cast perturbation; floor at 3.
          config: { sampleSize: 100, minDistinct: 3 },
        },
        {
          slotId: 'manner_note',
          sampler: buildMaintenanceDiversitySampler({
            rngSeed: 'run-all-maintenance-manner',
          }),
          config: { sampleSize: 100, minDistinct: 2 },
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

  it('the real areaAtmosphere template passes all seven gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(areaAtmosphereTemplate, {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: buildAreaAtmosphereDeterminismSamples() },
      diversity: [
        {
          slotId: 'title',
          sampler: buildAreaAtmosphereDiversitySampler({
            rngSeed: 'run-all-area-atmosphere-title',
          }),
          config: { sampleSize: 100, minDistinct: 3 },
        },
        {
          slotId: 'establishing_line',
          sampler: buildAreaAtmosphereDiversitySampler({
            rngSeed: 'run-all-area-atmosphere-establishing',
          }),
          config: { sampleSize: 100, minDistinct: 1 },
        },
        {
          slotId: 'reaction_line',
          sampler: buildAreaAtmosphereDiversitySampler({
            rngSeed: 'run-all-area-atmosphere-reaction',
          }),
          config: { sampleSize: 100, minDistinct: 3 },
        },
        {
          slotId: 'manner_note',
          sampler: buildAreaAtmosphereDiversitySampler({
            rngSeed: 'run-all-area-atmosphere-manner',
          }),
          config: { sampleSize: 100, minDistinct: 2 },
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

  it('the real cultureConflict template passes all seven gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(cultureConflictTemplate, {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: buildCultureConflictDeterminismSamples() },
      diversity: [
        {
          slotId: 'title',
          sampler: buildCultureConflictDiversitySampler({
            rngSeed: 'run-all-culture-conflict-title',
          }),
          config: { sampleSize: 100, minDistinct: 3 },
        },
        {
          slotId: 'establishing_line',
          sampler: buildCultureConflictDiversitySampler({
            rngSeed: 'run-all-culture-conflict-establishing',
          }),
          config: { sampleSize: 100, minDistinct: 1 },
        },
        {
          slotId: 'reaction_line',
          sampler: buildCultureConflictDiversitySampler({
            rngSeed: 'run-all-culture-conflict-reaction',
          }),
          // Narrator-voiced. State perturbation reaches a smaller
          // condition surface than cast perturbation; the floor is 3.
          config: { sampleSize: 100, minDistinct: 3 },
        },
        {
          slotId: 'manner_note',
          sampler: buildCultureConflictDiversitySampler({
            rngSeed: 'run-all-culture-conflict-manner',
          }),
          config: { sampleSize: 100, minDistinct: 2 },
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

// Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8.
function buildRegularComplaintChoicesGateTemplate(): CompositionalCardTemplate {
  return {
    ...regularComplaintTemplate,
    id: 'phase134-regularComplaint-choices-gate',
    slots: [
      {
        id: 'choice_label',
        role: 'choice_label',
        pool: regularComplaintChoiceLabelPool,
        optional: true,
        wordBudget: 6,
        claimMode: 'flavor',
      },
      {
        id: 'effect_preview',
        role: 'effect_preview',
        pool: regularComplaintEffectPreviewPool,
        optional: true,
        wordBudget: 10,
        claimMode: 'flavor',
      },
    ],
  }
}

function buildCustomerComplaintChoicesGateTemplate(): CompositionalCardTemplate {
  return {
    ...customerComplaintTemplate,
    id: 'phase134-customerComplaint-choices-gate',
    slots: [
      {
        id: 'choice_label',
        role: 'choice_label',
        pool: customerComplaintChoiceLabelPool,
        optional: true,
        wordBudget: 6,
        claimMode: 'flavor',
      },
      {
        id: 'effect_preview',
        role: 'effect_preview',
        pool: customerComplaintEffectPreviewPool,
        optional: true,
        wordBudget: 10,
        claimMode: 'flavor',
      },
    ],
  }
}

// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
function buildSupplierReliabilityChoicesGateTemplate(): CompositionalCardTemplate {
  return {
    ...supplierReliabilityTemplate,
    id: 'phase135-supplierReliability-choices-gate',
    slots: [
      {
        id: 'choice_label',
        role: 'choice_label',
        pool: supplierReliabilityChoiceLabelPool,
        optional: true,
        wordBudget: 6,
        claimMode: 'flavor',
      },
      {
        id: 'effect_preview',
        role: 'effect_preview',
        pool: supplierReliabilityEffectPreviewPool,
        optional: true,
        wordBudget: 10,
        claimMode: 'flavor',
      },
    ],
  }
}

function buildStockShortageChoicesGateTemplate(): CompositionalCardTemplate {
  return {
    ...stockShortageTemplate,
    id: 'phase135-stockShortage-choices-gate',
    slots: [
      {
        id: 'choice_label',
        role: 'choice_label',
        pool: stockShortageChoiceLabelPool,
        optional: true,
        wordBudget: 6,
        claimMode: 'flavor',
      },
      {
        id: 'effect_preview',
        role: 'effect_preview',
        pool: stockShortageEffectPreviewPool,
        optional: true,
        wordBudget: 10,
        claimMode: 'flavor',
      },
    ],
  }
}

function buildDebtRentChoicesGateTemplate(): CompositionalCardTemplate {
  return {
    ...debtRentTemplate,
    id: 'phase135-debtRent-choices-gate',
    slots: [
      {
        id: 'choice_label',
        role: 'choice_label',
        pool: debtRentChoiceLabelPool,
        optional: true,
        wordBudget: 6,
        claimMode: 'flavor',
      },
      {
        id: 'effect_preview',
        role: 'effect_preview',
        pool: debtRentEffectPreviewPool,
        optional: true,
        wordBudget: 10,
        claimMode: 'flavor',
      },
    ],
  }
}

// Phase 136 / ISSUE-105 — Voiced Surface arc, Phase 10.
function buildFactionRequestChoicesGateTemplate(): CompositionalCardTemplate {
  return {
    ...factionRequestTemplate,
    id: 'phase136-factionRequest-choices-gate',
    slots: [
      {
        id: 'choice_label',
        role: 'choice_label',
        pool: factionRequestChoiceLabelPool,
        optional: true,
        wordBudget: 6,
        claimMode: 'flavor',
      },
      {
        id: 'effect_preview',
        role: 'effect_preview',
        pool: factionRequestEffectPreviewPool,
        optional: true,
        wordBudget: 10,
        claimMode: 'flavor',
      },
    ],
  }
}

function buildCultureConflictChoicesGateTemplate(): CompositionalCardTemplate {
  return {
    ...cultureConflictTemplate,
    id: 'phase136-cultureConflict-choices-gate',
    slots: [
      {
        id: 'choice_label',
        role: 'choice_label',
        pool: cultureConflictChoiceLabelPool,
        optional: true,
        wordBudget: 6,
        claimMode: 'flavor',
      },
      {
        id: 'effect_preview',
        role: 'effect_preview',
        pool: cultureConflictEffectPreviewPool,
        optional: true,
        wordBudget: 10,
        claimMode: 'flavor',
      },
    ],
  }
}

// Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11.
function buildMaintenanceChoicesGateTemplate(): CompositionalCardTemplate {
  return {
    ...maintenanceTemplate,
    id: 'phase137-maintenance-choices-gate',
    slots: [
      {
        id: 'choice_label',
        role: 'choice_label',
        pool: maintenanceChoiceLabelPool,
        optional: true,
        wordBudget: 6,
        claimMode: 'flavor',
      },
      {
        id: 'effect_preview',
        role: 'effect_preview',
        pool: maintenanceEffectPreviewPool,
        optional: true,
        wordBudget: 10,
        claimMode: 'flavor',
      },
    ],
  }
}

function buildAreaAtmosphereChoicesGateTemplate(): CompositionalCardTemplate {
  return {
    ...areaAtmosphereTemplate,
    id: 'phase137-areaAtmosphere-choices-gate',
    slots: [
      {
        id: 'choice_label',
        role: 'choice_label',
        pool: areaAtmosphereChoiceLabelPool,
        optional: true,
        wordBudget: 6,
        claimMode: 'flavor',
      },
      {
        id: 'effect_preview',
        role: 'effect_preview',
        pool: areaAtmosphereEffectPreviewPool,
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

  // Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8.
  it('the regularComplaint choice-label and effect-preview pools pass all gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(buildRegularComplaintChoicesGateTemplate(), {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: [] },
      diversity: [
        {
          slotId: 'choice_label',
          sampler: buildRegularComplaintDiversitySampler({
            rngSeed: 'phase134-regular-choice-label',
          }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildRegularComplaintChoiceLabelContext,
          },
        },
        {
          slotId: 'effect_preview',
          sampler: buildRegularComplaintDiversitySampler({
            rngSeed: 'phase134-regular-effect-preview',
          }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildRegularComplaintEffectPreviewContext,
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

  it('the customerComplaint choice-label and effect-preview pools pass all gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(buildCustomerComplaintChoicesGateTemplate(), {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: [] },
      diversity: [
        {
          slotId: 'choice_label',
          sampler: buildCustomerComplaintDiversitySampler({
            rngSeed: 'phase134-customer-choice-label',
          }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildCustomerComplaintChoiceLabelContext,
          },
        },
        {
          slotId: 'effect_preview',
          sampler: buildCustomerComplaintDiversitySampler({
            rngSeed: 'phase134-customer-effect-preview',
          }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildCustomerComplaintEffectPreviewContext,
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

  // Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9.
  it('the supplierReliability choice-label and effect-preview pools pass all gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(buildSupplierReliabilityChoicesGateTemplate(), {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: [] },
      diversity: [
        {
          slotId: 'choice_label',
          sampler: buildSupplierReliabilityDiversitySampler({
            rngSeed: 'phase135-supplier-choice-label',
          }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildSupplierReliabilityChoiceLabelContext,
          },
        },
        {
          slotId: 'effect_preview',
          sampler: buildSupplierReliabilityDiversitySampler({
            rngSeed: 'phase135-supplier-effect-preview',
          }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildSupplierReliabilityEffectPreviewContext,
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

  it('the stockShortage choice-label and effect-preview pools pass all gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(buildStockShortageChoicesGateTemplate(), {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: [] },
      diversity: [
        {
          slotId: 'choice_label',
          sampler: buildStockShortageDiversitySampler({
            rngSeed: 'phase135-stock-choice-label',
          }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildStockShortageChoiceLabelContext,
          },
        },
        {
          slotId: 'effect_preview',
          sampler: buildStockShortageDiversitySampler({
            rngSeed: 'phase135-stock-effect-preview',
          }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildStockShortageEffectPreviewContext,
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

  it('the debtRent choice-label and effect-preview pools pass all gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(buildDebtRentChoicesGateTemplate(), {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: [] },
      diversity: [
        {
          slotId: 'choice_label',
          sampler: buildDebtRentDiversitySampler({
            rngSeed: 'phase135-debt-choice-label',
          }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildDebtRentChoiceLabelContext,
          },
        },
        {
          slotId: 'effect_preview',
          sampler: buildDebtRentDiversitySampler({
            rngSeed: 'phase135-debt-effect-preview',
          }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildDebtRentEffectPreviewContext,
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

  // Phase 136 / ISSUE-105 — Voiced Surface arc, Phase 10.
  it('the factionRequest choice-label and effect-preview pools pass all gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(buildFactionRequestChoicesGateTemplate(), {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: [] },
      diversity: [
        {
          slotId: 'choice_label',
          sampler: buildFactionRequestDiversitySampler({
            rngSeed: 'phase136-faction-choice-label',
          }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildFactionRequestChoiceLabelContext,
          },
        },
        {
          slotId: 'effect_preview',
          sampler: buildFactionRequestDiversitySampler({
            rngSeed: 'phase136-faction-effect-preview',
          }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildFactionRequestEffectPreviewContext,
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

  it('the cultureConflict choice-label and effect-preview pools pass all gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(buildCultureConflictChoicesGateTemplate(), {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: [] },
      diversity: [
        {
          slotId: 'choice_label',
          sampler: buildCultureConflictDiversitySampler({
            rngSeed: 'phase136-culture-choice-label',
          }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildCultureConflictChoiceLabelContext,
          },
        },
        {
          slotId: 'effect_preview',
          sampler: buildCultureConflictDiversitySampler({
            rngSeed: 'phase136-culture-effect-preview',
          }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildCultureConflictEffectPreviewContext,
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

  // Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11.
  it('the maintenance choice-label and effect-preview pools pass all gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(buildMaintenanceChoicesGateTemplate(), {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: [] },
      diversity: [
        {
          slotId: 'choice_label',
          sampler: buildMaintenanceDiversitySampler({
            rngSeed: 'phase137-maintenance-choice-label',
          }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildMaintenanceChoiceLabelContext,
          },
        },
        {
          slotId: 'effect_preview',
          sampler: buildMaintenanceDiversitySampler({
            rngSeed: 'phase137-maintenance-effect-preview',
          }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildMaintenanceEffectPreviewContext,
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

  it('the areaAtmosphere choice-label and effect-preview pools pass all gates with one call', () => {
    const state = createInitialTavernState()
    const report = runAllGates(buildAreaAtmosphereChoicesGateTemplate(), {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(state),
      },
      determinism: { samples: [] },
      diversity: [
        {
          slotId: 'choice_label',
          sampler: buildAreaAtmosphereDiversitySampler({
            rngSeed: 'phase137-area-choice-label',
          }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildAreaAtmosphereChoiceLabelContext,
          },
        },
        {
          slotId: 'effect_preview',
          sampler: buildAreaAtmosphereDiversitySampler({
            rngSeed: 'phase137-area-effect-preview',
          }),
          config: {
            sampleSize: 100,
            minDistinct: 3,
            pickContext: buildAreaAtmosphereEffectPreviewContext,
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
