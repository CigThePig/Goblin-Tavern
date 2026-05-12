import { Registry } from '../../registries/Registry'
import { ensureStarterNamingProfilesRegistered } from '../naming/namingProfiles'
import type { CultureDefinition } from './cultureTypes'

// Phase 22 §"Registry Pattern" / Phase 30 §30.1 — culture registry.
//
// Phase 22 reserved the seam; Phase 30 fills it with starter cultures
// that map 1:1 to the existing Phase 10 customer groups. Each culture
// references a naming profile already registered via the Phase 22/24
// naming layer — cross-reference validation (Phase 26 §26.4) will fail
// if any `namingProfileId` is unknown when the world state is seeded.
//
// The starter set is intentionally small: one culture per existing
// customer group, sharing the only naming profile the codebase currently
// carries (`goblin_common`). Later phases (and richer naming content)
// can refine these, but the starter set keeps Phase 30 grounded.

export const cultureRegistry = new Registry<CultureDefinition>()

const REQUIRED_CULTURES: CultureDefinition[] = [
  {
    id: 'goblin_local',
    label: 'Local Goblins',
    namingProfileId: 'goblin_common',
    description:
      'Townfolk goblins who know every brawl, every back alley, and every loose floorboard.',
    preferredStockTags: ['drink', 'goblin_favourite', 'food'],
    dislikedTags: ['expensive'],
    importantCalendarTags: ['local_night', 'payday'],
    areaTraitPreferences: {
      likes: ['cozy', 'sticky_floor'],
      dislikes: ['inspection_sensitive'],
    },
    conflictTags: ['merchant_distrust'],
    defaultFamiliarity: 80,
    defaultComfort: 70,
    defaultTension: 20,
    tags: ['local', 'goblin'],
  },
  {
    id: 'miner_workcrew',
    label: 'Miner Workcrews',
    namingProfileId: 'goblin_common',
    description:
      'Cave miners who come down on payday smelling of ore and looking for cheap drink.',
    preferredStockTags: ['drink', 'food'],
    dislikedTags: ['expensive'],
    importantCalendarTags: ['payday'],
    areaTraitPreferences: {
      likes: ['music_friendly'],
      dislikes: ['private'],
    },
    conflictTags: ['caravan_distrust'],
    defaultFamiliarity: 55,
    defaultComfort: 50,
    defaultTension: 35,
    tags: ['worker', 'rowdy'],
  },
  {
    id: 'merchant_roadfolk',
    label: 'Road Merchants',
    namingProfileId: 'goblin_common',
    description:
      'Travelling buyers and sellers who notice every stain and every short pour.',
    preferredStockTags: ['quality_sensitive', 'food'],
    dislikedTags: ['filth', 'danger', 'risky'],
    importantCalendarTags: ['market_day', 'supplier_day'],
    areaTraitPreferences: {
      likes: ['cozy', 'private'],
      dislikes: ['sticky_floor', 'pest_prone', 'inspection_sensitive'],
    },
    conflictTags: ['rowdy_friction'],
    defaultFamiliarity: 40,
    defaultComfort: 35,
    defaultTension: 45,
    tags: ['wealthy', 'cleanliness_sensitive'],
  },
  {
    id: 'ogre_clans',
    label: 'Ogre Clans',
    namingProfileId: 'goblin_common',
    description:
      'Clan ogres whose celebrations are loud, expensive, and structurally hazardous.',
    preferredStockTags: ['drink', 'food', 'alcohol'],
    dislikedTags: [],
    importantCalendarTags: ['brawl_night'],
    areaTraitPreferences: {
      likes: ['dangerous_corner', 'music_friendly'],
      dislikes: ['private'],
    },
    conflictTags: ['merchant_friction'],
    defaultFamiliarity: 35,
    defaultComfort: 45,
    defaultTension: 55,
    tags: ['rowdy', 'dangerous'],
  },
  {
    id: 'adventuring_bands',
    label: 'Adventuring Bands',
    namingProfileId: 'goblin_common',
    description:
      'Mixed crews of would-be heroes who tip well, scar furniture, and tell stories.',
    preferredStockTags: ['food', 'drink', 'quality_sensitive'],
    dislikedTags: ['filth'],
    importantCalendarTags: ['brawl_night', 'market_day'],
    areaTraitPreferences: {
      likes: ['well_lit', 'music_friendly'],
      dislikes: ['pest_prone'],
    },
    conflictTags: ['local_distrust'],
    defaultFamiliarity: 30,
    defaultComfort: 50,
    defaultTension: 40,
    tags: ['adventurer', 'mixed'],
  },
]

let initialized = false

export function ensureRequiredCulturesRegistered(): void {
  if (initialized) return
  // Phase 26 reference validation requires each culture's
  // `namingProfileId` to exist in the naming profile registry; make sure
  // the Phase 24 starter profile is registered before cultures seed.
  ensureStarterNamingProfilesRegistered()
  for (const def of REQUIRED_CULTURES) {
    if (!cultureRegistry.has(def.id)) {
      cultureRegistry.register(def)
    }
  }
  initialized = true
}
