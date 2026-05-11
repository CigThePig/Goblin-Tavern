// Phase 22 §"Naming Types" / Phase 24 §"Name Generator Starter" —
// naming profile registry.
//
// Phase 22 set up the seam: a registry-backed naming-profile store and
// an empty starter set. Phase 24 §"Name Generator Starter" populates a
// minimal `goblin_common` profile so deterministic name generation can
// be exercised by tests against the `names` RNG stream. Generated names
// are not yet attached to staff or any other state.

import { Registry } from '../../registries/Registry'
import type { NamingProfile } from './nameTypes'

export const namingProfileRegistry = new Registry<NamingProfile>()

export const STARTER_NAMING_PROFILES: NamingProfile[] = [
  {
    id: 'goblin_common',
    label: 'Goblin Common',
    tags: ['goblin', 'short', 'sharp'],
    given: ['Nib', 'Grib', 'Snit', 'Brakka', 'Nesk', 'Gribna'],
    family: ['Cracket', 'Sootspoon', 'Tallowmug', 'Bentnail'],
    nicknames: ['the Quick', 'Mug-Biter', 'Stool-Kicker'],
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
