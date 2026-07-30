// Phase 28 §28.2 / §28.4 — Area upgrade registry.
//
// The starter set is organized by the five required areas. Each entry
// declares a coin cost, optional build days, the traits and atmosphere
// tags it adds/removes once installed, and the mechanical tags it
// publishes so later modules (customers, pressures, owner actions, issue
// seeds) can react. Phase 28 is identity-not-balance: numbers here are
// indicative, not retuned simulation values.
//
// Expansion Phase 2 §2.2 makes the catalogue buildable (OBL-01). Every
// entry now also carries the quote the player is shown and charged
// against (materials, labour points, build days), what the fitting does to
// the room's physical capacity, how much of that capacity the build itself
// closes off, the upkeep it demands once installed, and what a repair
// costs when it breaks. Five entries additionally name the legacy
// owner-project type they absorb, so `start_hearth_repair` and
// `hearth_repair` are one record instead of a trait plus an unrelated
// progress row.
//
// The numbers stay in Phase 28's spirit — believable, not finely tuned —
// but they are now load-bearing, so three shapes matter:
//   * labour scales with build days, so a four-day job really is four
//     times the site work of a one-day job;
//   * upkeep intervals are short where the real-world equivalent needs
//     frequent attention (a lime bucket weekly, oak beams monthly);
//   * `blocksCapacityWhileBuilding` is zero for work nobody sits under
//     and high for work in the middle of a room.

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
    materials: [{ stockId: 'timber', quantity: 4 }],
    labourRequired: 4,
    capacityEffects: { seats: 6 },
    blocksCapacityWhileBuilding: 0.15,
    maintenance: { intervalDays: 21, coin: 4, wearPerOverdueDay: 2 },
    repairCoin: 12,
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
    materials: [
      { stockId: 'cut_stone', quantity: 3 },
      { stockId: 'timber', quantity: 2 },
    ],
    labourRequired: 6,
    // A hearth cannot be rebuilt into a room that is falling down around it.
    eligibility: { minAreaCondition: 30 },
    blocksCapacityWhileBuilding: 0.2,
    maintenance: { intervalDays: 14, coin: 3, wearPerOverdueDay: 3 },
    repairCoin: 18,
    legacyProjectType: 'repair_hearth',
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
    materials: [{ stockId: 'timber', quantity: 3 }],
    labourRequired: 3,
    capacityEffects: { seats: 2, workstations: 1 },
    blocksCapacityWhileBuilding: 0.1,
    maintenance: { intervalDays: 28, coin: 2, wearPerOverdueDay: 1 },
    repairCoin: 10,
    legacyProjectType: 'music_corner',
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
    materials: [{ stockId: 'timber', quantity: 8 }],
    labourRequired: 8,
    // Booths are built onto the new benches, not the old wobbling ones.
    eligibility: { requiresUpgrades: ['better_tables'] },
    // Curtained alcoves seat fewer bodies than open benches, but they seat
    // the ones who pay for not being overheard.
    capacityEffects: { seats: 4 },
    blocksCapacityWhileBuilding: 0.3,
    maintenance: { intervalDays: 21, coin: 5, wearPerOverdueDay: 2 },
    repairCoin: 24,
    legacyProjectType: 'private_booths',
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
    materials: [{ stockId: 'timber', quantity: 2 }],
    labourRequired: 2,
    blocksCapacityWhileBuilding: 0.05,
    maintenance: { intervalDays: 28, coin: 2, wearPerOverdueDay: 1 },
    repairCoin: 9,
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
    labourRequired: 1,
    // Blades need honing far more often than furniture needs mending.
    maintenance: { intervalDays: 14, coin: 2, wearPerOverdueDay: 2 },
    repairCoin: 8,
  },
  {
    id: 'large_stew_pot',
    label: 'Large Stew Pot',
    description: 'Feeds a busy night without scraping the bottom by midnight.',
    allowedAreaIds: ['kitchen'],
    costCoin: 35,
    buildDays: 1,
    tags: ['kitchen', 'service_positive'],
    labourRequired: 2,
    capacityEffects: { workstations: 1 },
    maintenance: { intervalDays: 28, coin: 2, wearPerOverdueDay: 1 },
    repairCoin: 10,
    legacyProjectType: 'larger_stew_pot',
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
    materials: [{ stockId: 'timber', quantity: 4 }],
    labourRequired: 4,
    // No point fitting a scrubbable surface into a kitchen nobody scrubs.
    eligibility: { minAreaCleanliness: 25 },
    capacityEffects: { workstations: 1 },
    blocksCapacityWhileBuilding: 0.25,
    maintenance: { intervalDays: 14, coin: 3, wearPerOverdueDay: 2 },
    repairCoin: 14,
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
    materials: [
      { stockId: 'cut_stone', quantity: 2 },
      { stockId: 'timber', quantity: 2 },
    ],
    labourRequired: 5,
    blocksCapacityWhileBuilding: 0.25,
    maintenance: { intervalDays: 21, coin: 3, wearPerOverdueDay: 2 },
    repairCoin: 15,
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
    materials: [{ stockId: 'timber', quantity: 5 }],
    labourRequired: 4,
    capacityEffects: { storage: 6 },
    blocksCapacityWhileBuilding: 0.2,
    maintenance: { intervalDays: 21, coin: 4, wearPerOverdueDay: 2 },
    repairCoin: 16,
    legacyProjectType: 'rat_proof_storage',
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
    materials: [{ stockId: 'cut_stone', quantity: 5 }],
    labourRequired: 4,
    capacityEffects: { storage: 8 },
    blocksCapacityWhileBuilding: 0.2,
    maintenance: { intervalDays: 28, coin: 3, wearPerOverdueDay: 1 },
    repairCoin: 14,
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
    materials: [{ stockId: 'timber', quantity: 4 }],
    labourRequired: 5,
    // The concealed rack is cut into the stone shelving that hides it.
    eligibility: { requiresUpgrades: ['cold_stone_shelves'] },
    capacityEffects: { storage: 4 },
    blocksCapacityWhileBuilding: 0.15,
    maintenance: { intervalDays: 28, coin: 3, wearPerOverdueDay: 1 },
    repairCoin: 20,
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
    labourRequired: 1,
    // A lime bucket only works while somebody keeps filling it.
    maintenance: { intervalDays: 7, coin: 2, wearPerOverdueDay: 3 },
    repairCoin: 5,
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
    materials: [{ stockId: 'timber', quantity: 2 }],
    labourRequired: 2,
    blocksCapacityWhileBuilding: 0.25,
    maintenance: { intervalDays: 28, coin: 1, wearPerOverdueDay: 1 },
    repairCoin: 6,
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
    materials: [{ stockId: 'cut_stone', quantity: 6 }],
    labourRequired: 7,
    // A drain that does not back up makes the second stall usable again.
    capacityEffects: { seats: 2 },
    // Digging out the channel closes the privy for most of the build.
    blocksCapacityWhileBuilding: 0.5,
    maintenance: { intervalDays: 21, coin: 4, wearPerOverdueDay: 2 },
    repairCoin: 18,
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
    materials: [{ stockId: 'timber', quantity: 2 }],
    labourRequired: 2,
    // Nobody sits on the roof, so the build closes nothing.
    blocksCapacityWhileBuilding: 0,
    maintenance: { intervalDays: 14, coin: 2, wearPerOverdueDay: 3 },
    repairCoin: 8,
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
    materials: [{ stockId: 'timber', quantity: 3 }],
    labourRequired: 3,
    blocksCapacityWhileBuilding: 0,
    maintenance: { intervalDays: 21, coin: 2, wearPerOverdueDay: 2 },
    repairCoin: 11,
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
    materials: [
      { stockId: 'timber', quantity: 6 },
      { stockId: 'cut_stone', quantity: 2 },
    ],
    labourRequired: 8,
    // Beams go in under thatch that is already holding the weather off.
    eligibility: { requiresUpgrades: ['patched_thatch'] },
    // Proper beams make the patch redundant — this is the catalogue's one
    // replacement chain, and it is what exercises the replaced-fitting path.
    replaces: 'patched_thatch',
    blocksCapacityWhileBuilding: 0,
    maintenance: { intervalDays: 28, coin: 4, wearPerOverdueDay: 1 },
    repairCoin: 22,
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
