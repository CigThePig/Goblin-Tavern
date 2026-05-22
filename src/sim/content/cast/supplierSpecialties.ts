// Phase 128 / ISSUE-097 — Voiced Surface Phase 2 (Universal Cast).
//
// Per-supplier-type specialty domain. A supplier's specialty / blindspot
// describes the *trade*, not the person — what their goods are known
// for, what they tend to cut corners on. Same ≥ 2 entry invariant as
// staff/regular domains (`rollAttributes` picks specialty then a
// distinct blindspot from the same list).
//
// `supplierType` is a free-string label (see `supplierTypes.ts:8-10`);
// unknown values fall back to `SUPPLIER_FALLBACK_DOMAIN` so a new
// supplier-type id doesn't break attribute rolls before its trade
// domain is registered. 6 entries per type, matching the cook/seasoned
// cook/master chef domains in `staffSpecialties.ts`.

import type { SupplierTypeId } from '../suppliers/supplierTypes'

export const SUPPLIER_FALLBACK_DOMAIN: readonly string[] = [
  'consistency',
  'pricing',
  'breadth_of_stock',
  'on_time_delivery',
  'small_batches',
  'plain_dealing',
] as const

export const SUPPLIER_SPECIALTY_DOMAIN: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    food_cart: [
      'turnover_speed',
      'street_pricing',
      'casual_chatter',
      'quick_substitutes',
      'short_credit',
      'plain_dealing',
    ],
    brewer: [
      'grain_quality',
      'consistency',
      'hop_balance',
      'pricing',
      'small_batch',
      'novelty',
    ],
    caravan: [
      'long_haul_freshness',
      'exotic_goods',
      'price_haggling',
      'schedule_drift',
      'breadth_of_stock',
      'road_news',
    ],
    butcher_or_salvage_food: [
      'cut_selection',
      'salvage_judgement',
      'pricing',
      'offcuts_skill',
      'preservation',
      'plain_dealing',
    ],
    specialty_goods: [
      'rare_ingredients',
      'pedigree_proof',
      'high_pricing',
      'connoisseurship',
      'long_lead_times',
      'discretion',
    ],
  })

export function getSupplierSpecialtyDomain(
  supplierType: SupplierTypeId,
): readonly string[] {
  return SUPPLIER_SPECIALTY_DOMAIN[supplierType] ?? SUPPLIER_FALLBACK_DOMAIN
}
