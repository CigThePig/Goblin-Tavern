import { Registry } from '../../registries/Registry'
import { ensureStarterNamingProfilesRegistered } from '../naming/namingProfiles'
import type { SupplierDefinition } from './supplierTypes'

// Phase 22 §"Registry Pattern" / Phase 29 §29.1 — supplier registry.
//
// Phase 22 reserved the seam; Phase 29 fills it with the starter supplier
// set. Every `goodsProvided` id below must exist in `stockRegistry` —
// Phase 26 cross-reference validation will fail otherwise. Suppliers that
// would reference stock ids the registry does not yet carry (candles,
// tallow, scrap meat as distinct items) are deliberately omitted until
// the stock layer grows; see Phase 29 §29.1 "Important Compatibility Rule".

export const supplierRegistry = new Registry<SupplierDefinition>()

// Phase 29 §29.1 — Starter suppliers. Each one provides at least one
// stock id that already exists in the Phase 9 stock registry.
const REQUIRED_SUPPLIERS: SupplierDefinition[] = [
  {
    id: 'brakka_mushroom_cart',
    label: 'Brakka Mushroom Cart',
    supplierType: 'food_cart',
    namingProfileId: 'goblin_common',
    goodsProvided: ['mushrooms', 'ingredients'],
    defaultReliability: 45,
    defaultRelationship: 55,
    defaultDebtTolerance: 30,
    defaultPriceBias: -1,
    deliveryPattern: 'weekly_local',
    tags: ['cheap', 'local', 'unreliable_when_raining'],
  },
  {
    id: 'old_keg_brewers',
    label: 'Old Keg Brewers',
    supplierType: 'brewer',
    namingProfileId: 'goblin_common',
    goodsProvided: ['ale'],
    defaultReliability: 70,
    defaultRelationship: 50,
    defaultDebtTolerance: 50,
    defaultPriceBias: 0,
    deliveryPattern: 'weekly_supplier_day',
    tags: ['alcohol', 'established', 'relationship_sensitive'],
  },
  {
    id: 'mudroad_grain_runner',
    label: 'Mudroad Grain Runner',
    supplierType: 'caravan',
    namingProfileId: 'merchant_roadfolk',
    goodsProvided: ['ingredients'],
    defaultReliability: 55,
    defaultRelationship: 40,
    defaultDebtTolerance: 25,
    defaultPriceBias: 1,
    deliveryPattern: 'biweekly_caravan',
    tags: ['road_sensitive', 'bulk_goods'],
  },
  {
    id: 'scrap_meat_vendor',
    label: 'Scrap Meat Vendor',
    supplierType: 'butcher_or_salvage_food',
    namingProfileId: 'goblin_common',
    goodsProvided: ['stew'],
    defaultReliability: 40,
    defaultRelationship: 35,
    defaultDebtTolerance: 35,
    defaultPriceBias: -2,
    deliveryPattern: 'weekly_local',
    tags: ['cheap', 'suspicious_quality'],
  },
  // Phase 68 / ISSUE-028 §6.2 — Alternate suppliers per existing
  // category. Each alternate carries a deliberately different
  // trade-off profile so the "switch supplier" response surface has
  // real targets. At least two of the alternates carry an
  // uncommon-tier ingredient, giving the player a deterministic
  // non-expedition route to uncommon goods.
  {
    id: 'marsh_root_peddler',
    label: 'Marsh-Root Peddler',
    supplierType: 'food_cart',
    namingProfileId: 'goblin_common',
    // Alternate to brakka_mushroom_cart. Carries wild_thyme
    // (uncommon herb) alongside the baseline mushrooms.
    goodsProvided: ['mushrooms', 'wild_thyme'],
    defaultReliability: 55,
    defaultRelationship: 40,
    defaultDebtTolerance: 25,
    defaultPriceBias: 1,
    deliveryPattern: 'weekly_local',
    tags: ['herbal', 'local', 'expensive_but_stable'],
  },
  {
    id: 'gildlock_brewhouse',
    label: 'Gildlock Brewhouse',
    supplierType: 'brewer',
    namingProfileId: 'goblin_common',
    // Alternate to old_keg_brewers. Higher reliability, higher
    // price bias.
    goodsProvided: ['ale'],
    defaultReliability: 80,
    defaultRelationship: 35,
    defaultDebtTolerance: 30,
    defaultPriceBias: 2,
    deliveryPattern: 'weekly_supplier_day',
    tags: ['alcohol', 'premium', 'stable'],
  },
  {
    id: 'silken_road_caravan',
    label: 'Silken Road Caravan',
    supplierType: 'caravan',
    namingProfileId: 'merchant_roadfolk',
    // Alternate to mudroad_grain_runner. Premium goods, more
    // reliable, brings uncommon smoked boar haunch alongside
    // baseline ingredients.
    goodsProvided: ['ingredients', 'smoked_boar_haunch'],
    defaultReliability: 70,
    defaultRelationship: 45,
    defaultDebtTolerance: 20,
    defaultPriceBias: 3,
    deliveryPattern: 'biweekly_caravan',
    tags: ['exotic', 'expensive', 'road_resilient'],
  },
  {
    id: 'north_pier_smokehouse',
    label: 'North Pier Smokehouse',
    supplierType: 'butcher_or_salvage_food',
    namingProfileId: 'merchant_roadfolk',
    // Alternate to scrap_meat_vendor. Higher quality, higher
    // reliability, higher price.
    goodsProvided: ['stew', 'river_eel'],
    defaultReliability: 65,
    defaultRelationship: 45,
    defaultDebtTolerance: 25,
    defaultPriceBias: 2,
    deliveryPattern: 'weekly_supplier_day',
    tags: ['quality', 'reliable', 'expensive'],
  },
  // Phase 68 / ISSUE-028 §6.2 — Specialty supplier carries 2–3
  // uncommon-tier ingredients across a new supplier category. This
  // is the player's low-effort baseline route to uncommon goods;
  // expeditions (phase 70) remain the only path to rare and
  // legendary tiers.
  {
    id: 'crystalspine_traders',
    label: 'Crystalspine Traders',
    supplierType: 'specialty_goods',
    namingProfileId: 'merchant_roadfolk',
    goodsProvided: ['bog_truffle', 'frost_cap_mushroom', 'wild_thyme'],
    defaultReliability: 60,
    defaultRelationship: 30,
    defaultDebtTolerance: 15,
    defaultPriceBias: 4,
    deliveryPattern: 'biweekly_caravan',
    tags: ['specialty', 'expensive', 'rare_routes'],
  },
]

let initialized = false

export function ensureRequiredSuppliersRegistered(): void {
  if (initialized) return
  // Phase 26 reference validation requires each supplier's
  // `namingProfileId` to exist in the naming profile registry; make sure
  // the Phase 24 starter profile is registered before suppliers seed.
  ensureStarterNamingProfilesRegistered()
  for (const def of REQUIRED_SUPPLIERS) {
    if (!supplierRegistry.has(def.id)) {
      supplierRegistry.register(def)
    }
  }
  initialized = true
}

// Phase 22 §"Required Tests" intentionally checks that this registry is
// empty when imported. Phase 29 callers (`createInitialTavernState`, the
// supplier module) must call `ensureRequiredSuppliersRegistered()`
// explicitly before reading.
