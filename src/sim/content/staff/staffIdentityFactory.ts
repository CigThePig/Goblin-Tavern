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
import { generateName } from '../naming/nameGenerator'
import {
  ensureStarterNamingProfilesRegistered,
  namingProfileRegistry,
} from '../naming/namingProfiles'
import type { StaffIdentityState } from '../../state/TavernState'
import {
  ensureRequiredStaffIdentityProfilesRegistered,
  getStaffIdentityProfileForRole,
  staffIdentityProfileRegistry,
} from './staffIdentityProfiles'
import type { StaffIdentityProfile } from './staffIdentityTypes'

export type CreateStaffIdentityArgs = {
  staffId: string
  roleId: string
  rng: SimRng
  existingNames?: ReadonlySet<string>
  profileId?: string
}

export function createStaffIdentity(
  args: CreateStaffIdentityArgs,
): StaffIdentityState {
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
    generatedName,
    personalityTags: [...profile.personalityTags],
    workStyle,
    stressResponse,
    loyalties: [...profile.loyalties],
    dislikes: [...profile.dislikes],
    ...(backgroundHook ? { backgroundHook } : {}),
  }

  return identity
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
  const byRole = getStaffIdentityProfileForRole(args.roleId)
  if (!byRole) {
    throw new Error(
      `createStaffIdentity: no identity profile is registered for role '${args.roleId}'`,
    )
  }
  return byRole
}
