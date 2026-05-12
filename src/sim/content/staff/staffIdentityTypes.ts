// Phase 31 §31.6 — staff identity profile types.
//
// A `StaffIdentityProfile` describes the *space* a staff identity is
// drawn from for a given role: which naming profile to use, which
// personality tags, work styles, and stress responses are plausible,
// and what background hooks the factory may pick from. The factory
// (`createStaffIdentity` in `staffIdentityFactory.ts`) resolves one
// concrete `StaffIdentityState` per staff member using a seeded RNG.
//
// Identity profiles are pure data: no functions, no class instances,
// no mutable state. They live in `src/sim/content/staff/` rather than
// `src/sim/state/` because they are *content* — the simulation can run
// without them, they just produce blander staff.

import type { NamingProfileId } from '../naming/nameTypes'
import type {
  StaffStressResponse,
  StaffWorkStyle,
} from '../../state/TavernState'

export type StaffIdentityProfileId = string

export type StaffIdentityProfile = {
  id: StaffIdentityProfileId
  /** The staff role this profile is plausible for. The factory picks
   * the first profile whose `roleId` matches the staff member's role
   * unless an explicit `profileId` override is supplied. */
  roleId: string
  /** Coarse cultural/group bucket — used by Phase 32 service scenes
   * and Phase 34 weekly community routines to reason about staff
   * affinities ("the cook is a town goblin, the server is a townie"). */
  groupId: string
  /** Optional culture pointer. The factory copies it into the
   * resulting identity if set; reference validation enforces that it
   * exists in `state.world.cultures` when present. */
  cultureId?: string
  /** Naming profile the factory uses to generate the display name. */
  namingProfileId: NamingProfileId
  /** Free-form personality tags. The factory copies them verbatim
   * into the identity — they are not weighted. */
  personalityTags: string[]
  /** Candidate work styles. The factory picks exactly one. Must be
   * non-empty. */
  workStyles: StaffWorkStyle[]
  /** Candidate stress responses. The factory picks exactly one.
   * Must be non-empty. */
  stressResponses: StaffStressResponse[]
  /** Loyalty tags (people/groups this staff member tends to back). */
  loyalties: string[]
  /** Dislike tags (situations/things this staff member tends to
   * complain about). */
  dislikes: string[]
  /** Background hook strings the factory may pick from. Empty means
   * the resulting identity has no background hook. */
  backgroundHooks: string[]
}
