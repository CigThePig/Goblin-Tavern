// Phase 28 §28.2 / §28.4 — Area upgrade registry.
//
// The starter set is organized by the five required areas. Each entry
// declares a coin cost, optional build days, the traits and atmosphere
// tags it adds/removes once installed, and the mechanical tags it
// publishes so later modules (customers, pressures, owner actions, issue
// seeds) can react. Phase 28 is identity-not-balance: numbers here are
// indicative, not retuned simulation values.

import { Registry } from '../../registries/Registry'
import type { AreaUpgradeDefinition } from './upgradeTypes'

export const areaUpgradeRegistry = new Registry<AreaUpgradeDefinition>()

const REQUIRED_UPGRADES: AreaUpgradeDefinition[] = [
  // Main Room ------------------------------------------------------------
  {
    id: 'better_tables',
    label: 'Better Tables',
    description: 'Sturdier benches and tables. Less wobble, fewer spills.',
    allowedAreaIds: ['main_room'],
    costCoin: 40,
    buildDays: 2,
    addsAtmosphere: ['tidy'],
    meterEffects: { mess: -5, cleanliness: 5 },
    tags: ['furniture', 'comfort_positive'],
  },
  {
    id: 'hearth_repair',
    label: 'Hearth Repair',
    description: 'A working hearth — proper warmth, less smoke leakage.',
    allowedAreaIds: ['main_room'],
    costCoin: 60,
    buildDays: 3,
    addsTraits: ['cozy'],
    removesTraits: ['drafty'],
    addsAtmosphere: ['warm'],
    meterEffects: { condition: 5 },
    tags: ['comfort_positive', 'weather_negative'],
  },
  {
    id: 'music_corner',
    label: 'Music Corner',
    description: 'A small stage and a stool for whichever bard turns up.',
    allowedAreaIds: ['main_room'],
    costCoin: 35,
    buildDays: 1,
    addsTraits: ['music_friendly'],
    addsAtmosphere: ['musical'],
    tags: ['comfort_positive', 'rowdy_sensitive'],
  },
  {
    id: 'private_booths',
    label: 'Private Booths',
    description: 'Curtained alcoves for merchants who do not want an audience.',
    allowedAreaIds: ['main_room'],
    costCoin: 80,
    buildDays: 4,
    addsTraits: ['private'],
    addsAtmosphere: ['discreet'],
    tags: ['merchant_sensitive', 'respectable_sensitive'],
  },
  {
    id: 'reinforced_stools',
    label: 'Reinforced Stools',
    description: 'Iron-banded oak. Fewer brawls end with broken furniture.',
    allowedAreaIds: ['main_room'],
    costCoin: 30,
    buildDays: 1,
    meterEffects: { damage: -5, risk: -3 },
    tags: ['furniture', 'risk_negative'],
  },

  // Kitchen --------------------------------------------------------------
  {
    id: 'sharp_knives',
    label: 'Sharp Knives',
    description: 'A proper rack of sharp blades. Cooks work faster, cleaner.',
    allowedAreaIds: ['kitchen'],
    costCoin: 25,
    meterEffects: { cleanliness: 3 },
    tags: ['kitchen', 'service_positive'],
  },
  {
    id: 'large_stew_pot',
    label: 'Large Stew Pot',
    description: 'Feeds a busy night without scraping the bottom by midnight.',
    allowedAreaIds: ['kitchen'],
    costCoin: 35,
    buildDays: 1,
    tags: ['kitchen', 'service_positive'],
  },
  {
    id: 'clean_prep_bench',
    label: 'Clean Prep Bench',
    description: 'A dedicated, scrubbable surface for food prep.',
    allowedAreaIds: ['kitchen'],
    costCoin: 45,
    buildDays: 2,
    meterEffects: { cleanliness: 8, mess: -5 },
    tags: ['kitchen', 'cleanliness_positive', 'inspection_negative'],
  },
  {
    id: 'smoke_vent',
    label: 'Smoke Vent',
    description: 'A working flue that actually carries smoke out the roof.',
    allowedAreaIds: ['kitchen'],
    costCoin: 50,
    buildDays: 3,
    removesTraits: ['smells_of_smoke'],
    addsAtmosphere: ['airy'],
    meterEffects: { smell: -10 },
    tags: ['kitchen', 'comfort_positive', 'smell_negative'],
  },

  // Cellar ---------------------------------------------------------------
  {
    id: 'rat_proof_barrels',
    label: 'Rat-Proof Barrels',
    description: 'Tight-lidded barrels and stone bases. Rats give up.',
    allowedAreaIds: ['cellar'],
    costCoin: 55,
    buildDays: 2,
    removesTraits: ['pest_prone'],
    meterEffects: { risk: -5 },
    tags: ['cellar', 'pest_negative', 'stock_safety'],
  },
  {
    id: 'cold_stone_shelves',
    label: 'Cold-Stone Shelves',
    description: 'Slate shelves that keep stock cooler in highsun.',
    allowedAreaIds: ['cellar'],
    costCoin: 45,
    buildDays: 2,
    meterEffects: { cleanliness: 3 },
    tags: ['cellar', 'stock_safety', 'spoilage_negative'],
  },
  {
    id: 'hidden_reserve_rack',
    label: 'Hidden Reserve Rack',
    description: 'A concealed rack behind the wine. The watch does not see it.',
    allowedAreaIds: ['cellar'],
    costCoin: 65,
    buildDays: 3,
    addsTraits: ['private'],
    tags: ['cellar', 'merchant_sensitive', 'inspection_negative'],
  },

  // Privy ----------------------------------------------------------------
  {
    id: 'lime_bucket_station',
    label: 'Lime Bucket Station',
    description: 'A bucket of slaked lime, kept stocked. Smell drops, problems drop.',
    allowedAreaIds: ['privy'],
    costCoin: 15,
    meterEffects: { smell: -8, cleanliness: 5 },
    tags: ['privy', 'smell_negative', 'inspection_negative'],
  },
  {
    id: 'privacy_screen',
    label: 'Privacy Screen',
    description: 'A wooden screen between the privy door and the main room.',
    allowedAreaIds: ['privy'],
    costCoin: 20,
    buildDays: 1,
    addsAtmosphere: ['discreet'],
    tags: ['privy', 'comfort_positive', 'respectable_sensitive'],
  },
  {
    id: 'stone_drainage',
    label: 'Stone Drainage',
    description: 'A real drainage channel that does not back up after rain.',
    allowedAreaIds: ['privy'],
    costCoin: 60,
    buildDays: 4,
    removesTraits: ['inspection_sensitive'],
    meterEffects: { smell: -15, cleanliness: 10, risk: -5 },
    tags: ['privy', 'smell_negative', 'inspection_negative'],
  },

  // Roof -----------------------------------------------------------------
  {
    id: 'patched_thatch',
    label: 'Patched Thatch',
    description: 'Fresh thatch over the worst patches. Keeps the rain out.',
    allowedAreaIds: ['roof'],
    costCoin: 25,
    buildDays: 1,
    meterEffects: { damage: -8, condition: 5 },
    tags: ['roof', 'weather_negative', 'maintenance_negative'],
  },
  {
    id: 'rain_gutters',
    label: 'Rain Gutters',
    description: 'Wooden gutters carry water away from the walls.',
    allowedAreaIds: ['roof'],
    costCoin: 35,
    buildDays: 2,
    addsAtmosphere: ['dry'],
    meterEffects: { damage: -5 },
    tags: ['roof', 'weather_negative'],
  },
  {
    id: 'reinforced_beams',
    label: 'Reinforced Beams',
    description: 'Oak beams replacing the worst rot. The whole roof sits straighter.',
    allowedAreaIds: ['roof'],
    costCoin: 75,
    buildDays: 4,
    removesTraits: ['weather_exposed'],
    meterEffects: { condition: 15, damage: -10 },
    tags: ['roof', 'maintenance_negative', 'structure_positive'],
  },
]

let initialized = false

export function ensureRequiredAreaUpgradesRegistered(): void {
  if (initialized) return
  for (const def of REQUIRED_UPGRADES) {
    if (!areaUpgradeRegistry.has(def.id)) {
      areaUpgradeRegistry.register(def)
    }
  }
  initialized = true
}

ensureRequiredAreaUpgradesRegistered()

export function getAreaUpgradeDefinition(id: string): AreaUpgradeDefinition | undefined {
  return areaUpgradeRegistry.has(id) ? areaUpgradeRegistry.get(id) : undefined
}
