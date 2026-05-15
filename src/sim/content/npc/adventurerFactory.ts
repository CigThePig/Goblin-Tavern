// Phase 69 / ISSUE-029 §5.4 — Hireable adventurer factory.
//
// Mirrors `createNotableNpc` in this same folder: the caller hands in
// an RNG (typically `ctx.getRngStream('npc_identity')` or a stable
// seeded stream from `defaults.ts`), the factory pulls the
// `adventuring_bands` naming profile registered in phase 24,
// generates a deterministic display name, and returns a shape that
// drops straight into `state.world.hireableAdventurers[id]`.
//
// Per §12 "Do Not Do" — names are generated *once* at NPC creation
// and stored in state. Subsequent reports re-render against the
// stored `GeneratedName`; the factory is never called from a report
// path.

import type { SimRng } from '../../core/rng'
import type { HireableAdventurer } from '../../state/TavernState'
import { generateName } from '../naming/nameGenerator'
import type { GeneratedName } from '../naming/nameTypes'
import {
  ensureStarterNamingProfilesRegistered,
  namingProfileRegistry,
} from '../naming/namingProfiles'

export const ADVENTURER_NAMING_PROFILE_ID = 'adventuring_bands'
export const ADVENTURER_CULTURE_ID = 'adventuring_bands'

export type CreateHireableAdventurerArgs = {
  adventurerId: string
  rng: SimRng
  joinedDay: number
  /** Optional pre-existing display names to avoid duplicates with. */
  existingNames?: ReadonlySet<string>
  /** Initial experience (0-100); defaults to a modest starter value. */
  experience?: number
  /** Initial reliability (0-100); defaults to a modest starter value. */
  reliability?: number
  /** Initial relationship (0-100); defaults to a modest starter value. */
  relationship?: number
  /** Optional specialty tag biasing target tier / category. */
  specialty?: string | null
  /** Hire cost per expedition day; defaults to 5. */
  wageBase?: number
  /** Optional starter tags / flags. */
  tags?: string[]
  activeFlags?: string[]
}

export type CreateHireableAdventurerResult = {
  adventurer: HireableAdventurer
  generatedName: GeneratedName
}

export function createHireableAdventurer(
  args: CreateHireableAdventurerArgs,
): CreateHireableAdventurerResult {
  ensureStarterNamingProfilesRegistered()
  if (!namingProfileRegistry.has(ADVENTURER_NAMING_PROFILE_ID)) {
    throw new Error(
      `createHireableAdventurer: naming profile '${ADVENTURER_NAMING_PROFILE_ID}' is not registered`,
    )
  }
  const namingProfile = namingProfileRegistry.get(ADVENTURER_NAMING_PROFILE_ID)

  const generatedName = generateName(
    namingProfile,
    args.rng,
    `hireable_adventurer:${args.adventurerId}`,
    args.existingNames
      ? { existingDisplayNames: args.existingNames }
      : undefined,
  )

  const adventurer: HireableAdventurer = {
    id: args.adventurerId,
    name: generatedName,
    cultureId: ADVENTURER_CULTURE_ID,
    experience: args.experience ?? 45,
    reliability: args.reliability ?? 50,
    relationship: args.relationship ?? 50,
    specialty: args.specialty ?? null,
    wageBase: args.wageBase ?? 5,
    daysSinceLastJob: 0,
    currentExpeditionId: null,
    joinedDay: args.joinedDay,
    tags: args.tags ? [...args.tags] : [],
    activeFlags: args.activeFlags ? [...args.activeFlags] : [],
  }

  return { adventurer, generatedName }
}
