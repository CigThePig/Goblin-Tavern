// Phase 163 / ISSUE-131 (Faithful Surface arc, Phase 1).
//
// Captures production-shape `responseSlots` + `consequenceProfiles` + stake /
// cause / pressure data from each issue-seed generator ONCE per family at
// test-module load. Every gate sampler in `samplers.ts` then spreads the
// captured shape into its per-sample `makeSeed` call so the gates see the
// 6-17 slot card shape players actually see, not the 2-slot `clean`/`ignore`
// stub `cardFactories.makeSeed` falls back to.
//
// The four arc-defining defect classes (label collision, preview duplication
// across distinct choices, direction inversion on lower-is-better meters,
// flavor lines contradicting the sim-backed line) are structurally invisible
// to the gates unless they audit real slot shape. Phase 1 makes the audit
// honest; Phases 2-4 fix the defects it then surfaces.

import { getIssueSeeds } from '../../../../src/sim/modules/issues/issueSeedQueries'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../../../src/sim/modules/issues/issueSeedTypes'
import { runOneDay } from '../../../../src/sim/testing/simRunner'
import type { TavernState } from '../../../../src/sim/state/TavernState'

import {
  buildAreaAtmosphereTriggeringState,
  buildCultureConflictTriggeringState,
  buildCustomerComplaintTriggeringState,
  buildDebtRentTriggeringState,
  buildFactionRequestTriggeringState,
  buildFoodSafetyTriggeringState,
  buildInspectionTriggeringState,
  buildMaintenanceTriggeringState,
  buildMonthlyReviewTriggeringState,
  buildRegularCustomerComplaintTriggeringState,
  buildRegularCustomerRelationshipTriggeringState,
  buildReputationShiftTriggeringState,
  buildRivalTavernArcTriggeringState,
  buildRivalTavernSystemTriggeringState,
  buildRumourCrisisTriggeringState,
  buildSeasonalArcTriggeringState,
  buildStaffBurnoutTriggeringState,
  buildStaffIdentityTriggeringState,
  buildStockShortageTriggeringState,
  buildSupplierRelationshipTriggeringState,
  buildViolenceTriggeringState,
} from '../../../sim/triggeringStates'

/** Structural fields of an `IssueSeed` that gate samplers need to mirror
 *  production. Identity / display / per-sample fields (id, severity,
 *  toneHints, primaryActor, textIngredients, validation, generatedAt) are
 *  excluded — those remain per-sample overrides at the `*SeedFor` call site. */
export type CapturedSeedShape = Pick<
  IssueSeed,
  | 'responseSlots'
  | 'consequenceProfiles'
  | 'stakes'
  | 'causes'
  | 'pressures'
  | 'memoriesCreated'
  | 'futureHooks'
>

type CaptureOptions = {
  cacheKey: string
  family: IssueSeedFamilyId | string
  /** Optional seed type filter when the same family produces multiple types
   *  (e.g. `regular_customer` emits both `relationship_test` and `complaint`
   *  depending on irritation). */
  type?: string
  buildTriggeringState: () => TavernState
  /** Pick a representative seed when the generator emits >1. Default: first. */
  select?: (seeds: IssueSeed[]) => IssueSeed
}

const CACHE = new Map<string, CapturedSeedShape>()

export function captureSeedShape(opts: CaptureOptions): CapturedSeedShape {
  const cached = CACHE.get(opts.cacheKey)
  if (cached) return cached

  const state = opts.buildTriggeringState()
  const result = runOneDay(state, { seed: `phase163-capture-${opts.cacheKey}` })
  let seeds = getIssueSeeds(result.state, { family: opts.family })
  if (opts.type) {
    seeds = seeds.filter((s) => s.type === opts.type)
  }
  if (seeds.length === 0) {
    throw new Error(
      `captureSeedShape: generator for family="${opts.family}"${
        opts.type ? ` type="${opts.type}"` : ''
      } fired no seeds. Fix buildTriggeringState (cacheKey=${opts.cacheKey}).`,
    )
  }
  const seed = opts.select ? opts.select(seeds) : seeds[0]!
  const shape: CapturedSeedShape = {
    responseSlots: seed.responseSlots,
    consequenceProfiles: seed.consequenceProfiles,
    stakes: seed.stakes,
    causes: seed.causes,
    pressures: seed.pressures,
    memoriesCreated: seed.memoriesCreated,
    futureHooks: seed.futureHooks,
  }
  CACHE.set(opts.cacheKey, shape)
  return shape
}

// ----------------------------------------------------------------------
// Per-template captured shapes
//
// One per migrated compositional template (20 templates → 20+ shapes, with
// `regular_customer` capturing both type variants and `rival_tavern` both
// activation paths). Module-load cost is ~20 × `runOneDay` ≈ 0.5-1s once;
// `monthly_review` advances 28 days at ~30ms each, ~0.8s. Per-sample cost
// is microseconds (shape constants are reused across thousands of samples).
// ----------------------------------------------------------------------

export const FOOD_SAFETY_SHAPE = (): CapturedSeedShape =>
  captureSeedShape({
    cacheKey: 'food_safety',
    family: 'food_safety',
    buildTriggeringState: buildFoodSafetyTriggeringState,
  })

export const STOCK_SHORTAGE_SHAPE = (): CapturedSeedShape =>
  captureSeedShape({
    cacheKey: 'stock_shortage',
    family: 'stock_shortage',
    buildTriggeringState: buildStockShortageTriggeringState,
  })

export const MAINTENANCE_SHAPE = (): CapturedSeedShape =>
  captureSeedShape({
    cacheKey: 'maintenance',
    family: 'maintenance',
    buildTriggeringState: buildMaintenanceTriggeringState,
  })

export const STAFF_BURNOUT_SHAPE = (): CapturedSeedShape =>
  captureSeedShape({
    cacheKey: 'staff_burnout',
    family: 'staff_burnout',
    buildTriggeringState: buildStaffBurnoutTriggeringState,
  })

export const CUSTOMER_COMPLAINT_SHAPE = (): CapturedSeedShape =>
  captureSeedShape({
    cacheKey: 'customer_complaint',
    family: 'customer_complaint',
    buildTriggeringState: buildCustomerComplaintTriggeringState,
  })

export const VIOLENCE_SHAPE = (): CapturedSeedShape =>
  captureSeedShape({
    cacheKey: 'violence',
    family: 'violence',
    buildTriggeringState: buildViolenceTriggeringState,
  })

export const DEBT_RENT_SHAPE = (): CapturedSeedShape =>
  captureSeedShape({
    cacheKey: 'debt_rent',
    family: 'debt_rent',
    buildTriggeringState: buildDebtRentTriggeringState,
  })

export const INSPECTION_SHAPE = (): CapturedSeedShape =>
  captureSeedShape({
    cacheKey: 'inspection',
    family: 'inspection',
    buildTriggeringState: buildInspectionTriggeringState,
  })

export const REPUTATION_SHIFT_SHAPE = (): CapturedSeedShape =>
  captureSeedShape({
    cacheKey: 'reputation_shift',
    family: 'reputation_shift',
    buildTriggeringState: buildReputationShiftTriggeringState,
  })

export const STAFF_IDENTITY_SHAPE = (): CapturedSeedShape =>
  captureSeedShape({
    cacheKey: 'staff_identity',
    family: 'staff_identity',
    buildTriggeringState: buildStaffIdentityTriggeringState,
  })

export const REGULAR_CUSTOMER_RELATIONSHIP_SHAPE = (): CapturedSeedShape =>
  captureSeedShape({
    cacheKey: 'regular_customer.relationship_test',
    family: 'regular_customer',
    type: 'relationship_test',
    buildTriggeringState: buildRegularCustomerRelationshipTriggeringState,
  })

export const REGULAR_CUSTOMER_COMPLAINT_SHAPE = (): CapturedSeedShape =>
  captureSeedShape({
    cacheKey: 'regular_customer.complaint',
    family: 'regular_customer',
    type: 'complaint',
    buildTriggeringState: buildRegularCustomerComplaintTriggeringState,
  })

export const SUPPLIER_RELATIONSHIP_SHAPE = (): CapturedSeedShape =>
  captureSeedShape({
    cacheKey: 'supplier_relationship',
    family: 'supplier_relationship',
    buildTriggeringState: buildSupplierRelationshipTriggeringState,
  })

export const CULTURE_CONFLICT_SHAPE = (): CapturedSeedShape =>
  captureSeedShape({
    cacheKey: 'culture_conflict',
    family: 'culture_conflict',
    buildTriggeringState: buildCultureConflictTriggeringState,
  })

export const SEASONAL_ARC_SHAPE = (): CapturedSeedShape =>
  captureSeedShape({
    cacheKey: 'seasonal_arc',
    family: 'seasonal_arc',
    buildTriggeringState: buildSeasonalArcTriggeringState,
  })

export const RUMOUR_CRISIS_SHAPE = (): CapturedSeedShape =>
  captureSeedShape({
    cacheKey: 'rumour_crisis',
    family: 'rumour_crisis',
    buildTriggeringState: buildRumourCrisisTriggeringState,
    // Phase 139 — rumour_crisis can fire with multiple variants. Prefer
    // the largest-slot-count variant so gates exercise the widest verb
    // surface (Phase 12 noted 9 slots is the largest).
    select: (seeds) =>
      seeds.reduce((a, b) =>
        a.responseSlots.length >= b.responseSlots.length ? a : b,
      ),
  })

export const FACTION_REQUEST_SHAPE = (): CapturedSeedShape =>
  captureSeedShape({
    cacheKey: 'faction_request',
    family: 'faction_request',
    buildTriggeringState: buildFactionRequestTriggeringState,
  })

export const AREA_ATMOSPHERE_SHAPE = (): CapturedSeedShape =>
  captureSeedShape({
    cacheKey: 'area_atmosphere',
    family: 'area_atmosphere',
    buildTriggeringState: buildAreaAtmosphereTriggeringState,
  })

export const MONTHLY_REVIEW_SHAPE = (): CapturedSeedShape =>
  captureSeedShape({
    cacheKey: 'monthly_review',
    family: 'monthly_review',
    buildTriggeringState: buildMonthlyReviewTriggeringState,
  })

export const RIVAL_TAVERN_ARC_SHAPE = (): CapturedSeedShape =>
  captureSeedShape({
    cacheKey: 'rival_tavern.arc',
    family: 'rival_tavern',
    buildTriggeringState: buildRivalTavernArcTriggeringState,
  })

export const RIVAL_TAVERN_SYSTEM_SHAPE = (): CapturedSeedShape =>
  captureSeedShape({
    cacheKey: 'rival_tavern.system',
    family: 'rival_tavern',
    buildTriggeringState: buildRivalTavernSystemTriggeringState,
  })

/** All captured shapes the canary test verifies have ≥3 slots. */
export const ALL_CAPTURED_SHAPES = [
  { name: 'food_safety', get: FOOD_SAFETY_SHAPE },
  { name: 'stock_shortage', get: STOCK_SHORTAGE_SHAPE },
  { name: 'maintenance', get: MAINTENANCE_SHAPE },
  { name: 'staff_burnout', get: STAFF_BURNOUT_SHAPE },
  { name: 'customer_complaint', get: CUSTOMER_COMPLAINT_SHAPE },
  { name: 'violence', get: VIOLENCE_SHAPE },
  { name: 'debt_rent', get: DEBT_RENT_SHAPE },
  { name: 'inspection', get: INSPECTION_SHAPE },
  { name: 'reputation_shift', get: REPUTATION_SHIFT_SHAPE },
  { name: 'staff_identity', get: STAFF_IDENTITY_SHAPE },
  { name: 'regular_customer.relationship_test', get: REGULAR_CUSTOMER_RELATIONSHIP_SHAPE },
  { name: 'regular_customer.complaint', get: REGULAR_CUSTOMER_COMPLAINT_SHAPE },
  { name: 'supplier_relationship', get: SUPPLIER_RELATIONSHIP_SHAPE },
  { name: 'culture_conflict', get: CULTURE_CONFLICT_SHAPE },
  { name: 'seasonal_arc', get: SEASONAL_ARC_SHAPE },
  { name: 'rumour_crisis', get: RUMOUR_CRISIS_SHAPE },
  { name: 'faction_request', get: FACTION_REQUEST_SHAPE },
  { name: 'area_atmosphere', get: AREA_ATMOSPHERE_SHAPE },
  { name: 'monthly_review', get: MONTHLY_REVIEW_SHAPE },
  { name: 'rival_tavern.arc', get: RIVAL_TAVERN_ARC_SHAPE },
  { name: 'rival_tavern.system', get: RIVAL_TAVERN_SYSTEM_SHAPE },
] as const
