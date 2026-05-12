// Phase 22 §"Naming Types" / Phase 24 §"Name Generator Starter" /
// Phase 31 §31.4 — naming profile registry.
//
// Phase 22 set up the seam: a registry-backed naming-profile store and
// an empty starter set. Phase 24 §"Name Generator Starter" populated a
// minimal `goblin_common` profile so deterministic name generation could
// be exercised by tests against the `names` RNG stream. Phase 31 §31.4
// adds two more starter profiles (`human_town`, `dwarf_caravan`) so
// staff identity factories can produce visibly different display-name
// patterns. The starter list stays intentionally small — the goal is
// proof that the generator supports distinct profiles, not full naming
// coverage.

import { Registry } from '../../registries/Registry'
import type { NamingProfile } from './nameTypes'

export const namingProfileRegistry = new Registry<NamingProfile>()

export const STARTER_NAMING_PROFILES: NamingProfile[] = [
  {
    id: 'goblin_common',
    label: 'Goblin Common',
    tags: ['goblin', 'short', 'sharp'],
    given: ['Nib', 'Grib', 'Snit', 'Brakka', 'Nesk', 'Gribna', 'Mizz', 'Vro', 'Takka', 'Skib'],
    family: ['Cracket', 'Sootspoon', 'Tallowmug', 'Bentnail', 'Greasewick', 'Mugbit'],
    nicknames: ['the Quick', 'Mug-Biter', 'Stool-Kicker', 'Soupnose', 'Ashfingers'],
    patterns: [
      {
        id: 'given_family',
        weight: 8,
        template: '{given} {family}',
        partKinds: ['given', 'family'],
        tags: ['formal'],
      },
      {
        id: 'given_nickname',
        weight: 2,
        template: '{given} {nickname}',
        partKinds: ['given', 'nickname'],
        tags: ['informal'],
      },
    ],
  },
  {
    id: 'human_town',
    label: 'Town Human',
    tags: ['human', 'town'],
    given: ['Mara', 'Tomlin', 'Bessa', 'Harl', 'Edda', 'Corvin', 'Wilm', 'Sera'],
    family: ['Vetch', 'Cooper', 'Marl', 'Rusk', 'Briar', 'Tanner', 'Hollow'],
    patterns: [
      {
        id: 'given_family',
        weight: 8,
        template: '{given} {family}',
        partKinds: ['given', 'family'],
        tags: ['formal'],
      },
      {
        id: 'given_only',
        weight: 2,
        template: '{given}',
        partKinds: ['given'],
        tags: ['casual'],
      },
    ],
  },
  {
    id: 'dwarf_caravan',
    label: 'Dwarven Caravan',
    tags: ['dwarf', 'caravan', 'trade'],
    given: ['Borren', 'Hilda', 'Korrim', 'Dagna', 'Varric', 'Beldi', 'Thora', 'Orik'],
    family: ['Stonekeg', 'Copperbraid', 'Ironpike', 'Ashbarrel', 'Deepmalt'],
    titles: ['Auntie', 'Uncle', 'Master', 'Mistress'],
    patterns: [
      {
        id: 'given_family',
        weight: 9,
        template: '{given} {family}',
        partKinds: ['given', 'family'],
        tags: ['formal'],
      },
      {
        id: 'title_given_family',
        weight: 1,
        template: '{title} {given} {family}',
        partKinds: ['title', 'given', 'family'],
        tags: ['ceremonial'],
      },
    ],
  },
]

let initialized = false

export function ensureStarterNamingProfilesRegistered(): void {
  if (initialized) return
  for (const profile of STARTER_NAMING_PROFILES) {
    if (!namingProfileRegistry.has(profile.id)) {
      namingProfileRegistry.register(profile)
    }
  }
  initialized = true
}
