// Phase 31 §31.7 — staff identity factory.
//
// `createStaffIdentity` resolves a `StaffIdentityState` for one staff
// member. It picks a `StaffIdentityProfile` by role (or an explicit
// `profileId` override), resolves the referenced naming profile,
// generates a deterministic display name via the seeded RNG passed in
// by the caller, then picks one work style, one stress response, and
// optionally one background hook.
//
// The factory never reaches into runtime state. The caller is
// responsible for routing the right RNG stream in (e.g. the
// `staff_identity` stream from Phase 24); see `state/defaults.ts` for
// how `createInitialStaff` wires this for the canonical seeded staff.

import type { SimRng } from '../../core/rng'
import type { GeneratedName } from '../naming/nameTypes'
import { generateName } from '../naming/nameGenerator'
import {
  ensureStarterNamingProfilesRegistered,
  namingProfileRegistry,
} from '../naming/namingProfiles'
import type { StaffIdentityState } from '../../state/TavernState'
import {
  ensureRequiredStaffIdentityProfilesRegistered,
  getStaffIdentityProfileForRole,
  getStaffIdentityProfilesForRole,
  staffIdentityProfileRegistry,
} from './staffIdentityProfiles'
import type { StaffIdentityProfile } from './staffIdentityTypes'

export type CreateStaffIdentityArgs = {
  staffId: string
  roleId: string
  rng: SimRng
  existingNames?: ReadonlySet<string>
  profileId?: string
  // Phase 81 / ISSUE-041 — optional culture preference. When set,
  // matching profiles get a heavier weight in the deterministic pick;
  // non-matching profiles still remain selectable so we never throw
  // when the preferred culture has no profile for the requested role.
  preferredCultureId?: string
}

export type CreateStaffIdentityResult = {
  identity: StaffIdentityState
  generatedName: GeneratedName
}

export function createStaffIdentity(
  args: CreateStaffIdentityArgs,
): CreateStaffIdentityResult {
  ensureRequiredStaffIdentityProfilesRegistered()
  ensureStarterNamingProfilesRegistered()

  const profile = resolveProfile(args)
  const namingProfile = namingProfileRegistry.get(profile.namingProfileId)

  const generatedName = generateName(
    namingProfile,
    args.rng,
    `staff:${args.staffId}`,
    args.existingNames ? { existingDisplayNames: args.existingNames } : undefined,
  )

  const workStyle = args.rng.pick([...profile.workStyles])
  const stressResponse = args.rng.pick([...profile.stressResponses])
  const backgroundHook =
    profile.backgroundHooks.length > 0
      ? args.rng.pick([...profile.backgroundHooks])
      : undefined

  const identity: StaffIdentityState = {
    groupId: profile.groupId,
    ...(profile.cultureId !== undefined ? { cultureId: profile.cultureId } : {}),
    namingProfileId: profile.namingProfileId,
    personalityTags: [...profile.personalityTags],
    workStyle,
    stressResponse,
    loyalties: [...profile.loyalties],
    dislikes: [...profile.dislikes],
    ...(backgroundHook ? { backgroundHook } : {}),
  }

  return { identity, generatedName }
}

function resolveProfile(args: CreateStaffIdentityArgs): StaffIdentityProfile {
  if (args.profileId !== undefined) {
    if (!staffIdentityProfileRegistry.has(args.profileId)) {
      throw new Error(
        `createStaffIdentity: unknown identity profile '${args.profileId}'`,
      )
    }
    return staffIdentityProfileRegistry.get(args.profileId)
  }
  const matches = getStaffIdentityProfilesForRole(args.roleId)
  if (matches.length === 0) {
    // Fall back to the legacy first-match helper purely for the
    // identical error message — callers depend on it.
    if (!getStaffIdentityProfileForRole(args.roleId)) {
      throw new Error(
        `createStaffIdentity: no identity profile is registered for role '${args.roleId}'`,
      )
    }
  }
  if (matches.length === 1) return matches[0]!

  // Phase 81 / ISSUE-041 — weighted pick across all role-matching
  // profiles. Cultural plausibility: shrine_devotees-flavoured
  // profiles (when any are added) get a low weight for cleaner_bouncer.
  // For now we lean on `preferredCultureId` and a small bias against
  // non-violent cultures filling violent roles.
  const weights = matches.map((profile) => profileWeight(profile, args))
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum <= 0) {
    // Degenerate weighting (shouldn't happen with positive base weights)
    // — fall through to uniform pick.
    return args.rng.pick([...matches])
  }
  let roll = args.rng.float() * sum
  for (let i = 0; i < matches.length; i += 1) {
    roll -= weights[i]!
    if (roll <= 0) return matches[i]!
  }
  return matches[matches.length - 1]!
}

function profileWeight(
  profile: StaffIdentityProfile,
  args: CreateStaffIdentityArgs,
): number {
  let weight = 1
  if (
    args.preferredCultureId !== undefined &&
    profile.cultureId === args.preferredCultureId
  ) {
    weight += 3
  }
  // `shrine_devotees` reads as a poor fit for a bouncer slot. No
  // shrine_devotees profile is registered today, but the heuristic
  // is here so future additions automatically follow the cultural-
  // plausibility intent of ISSUE-041.
  if (
    profile.cultureId === 'shrine_devotees' &&
    profile.roleId === 'cleaner_bouncer'
  ) {
    weight *= 0.1
  }
  if (
    profile.cultureId === 'ogre_clans' &&
    profile.roleId === 'cleaner_bouncer'
  ) {
    weight *= 2
  }
  return weight
}
