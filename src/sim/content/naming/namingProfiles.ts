// Phase 22 §"Naming Types" — naming profile registry placeholder.
//
// Phase 22 sets up the seam: a registry-backed naming-profile store and
// an empty starter set. Phase 24 §"Name Generator Starter" will populate
// `STARTER_NAMING_PROFILES` and call `ensureStarterNamingProfilesRegistered()`
// during deterministic name generation.

import { Registry } from '../../registries/Registry'
import type { NamingProfile } from './nameTypes'

export const namingProfileRegistry = new Registry<NamingProfile>()

export const STARTER_NAMING_PROFILES: NamingProfile[] = []

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
