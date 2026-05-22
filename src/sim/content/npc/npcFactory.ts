// Phase 44 §ISSUE-004 — Notable NPC factory.
//
// `createNotableNpc` resolves one persistent `NotableNpcWorldState`
// record from a `NotableNpcProfile`. It mirrors `createStaffIdentity`
// in `src/sim/content/staff/staffIdentityFactory.ts`: the caller hands
// in the RNG (typically `ctx.getRngStream('npc_identity')` or a stable
// seeded stream from `defaults.ts`), the factory pulls the profile and
// naming profile, generates a deterministic display name, and composes
// the world-state record.
//
// The factory never reaches into runtime state; the caller is
// responsible for routing the right RNG stream in. The returned shape
// matches `state.world.notableNpcs[id]` directly so the caller can
// write it without an adapter layer.

import { createNotableNpcCastAttributes } from '../cast/createCastAttributes'
import type { SimRng } from '../../core/rng'
import type { NotableNpcWorldState } from '../../state/TavernState'
import { generateName } from '../naming/nameGenerator'
import type { GeneratedName } from '../naming/nameTypes'
import { namingProfileRegistry } from '../naming/namingProfiles'
import {
  ensureRequiredNotableNpcProfilesRegistered,
  notableNpcProfileRegistry,
} from './notableNpcProfiles'
import type { NotableNpcProfile } from './notableNpcProfiles'

export type CreateNotableNpcArgs = {
  npcId: string
  profileId: string
  rng: SimRng
  firstSeenDay: number
  existingNames?: ReadonlySet<string>
}

export type CreateNotableNpcResult = {
  npc: NotableNpcWorldState
  generatedName: GeneratedName
}

export function createNotableNpc(
  args: CreateNotableNpcArgs,
): CreateNotableNpcResult {
  ensureRequiredNotableNpcProfilesRegistered()
  const profile = resolveProfile(args.profileId)
  const namingProfile = namingProfileRegistry.get(profile.namingProfileId)

  const generatedName = generateName(
    namingProfile,
    args.rng,
    `notable_npc:${args.npcId}`,
    args.existingNames
      ? { existingDisplayNames: args.existingNames }
      : undefined,
  )

  // Phase 128 / ISSUE-097 — Voiced Surface Phase 2 (Universal Cast).
  // Cast attribute roll lands on the SAME rng, AFTER the existing
  // name roll. Mirrors the staff/regular ordering at
  // `defaults.ts:190-202`: the load-bearing property is that every
  // canonical pre-Phase-2 NPC name stays byte-identical and only
  // new rolls burn at the end of the per-NPC sequence.
  const castAttributes = createNotableNpcCastAttributes({
    profileKind: profile.kind,
    ...(profile.cultureId !== undefined ? { cultureId: profile.cultureId } : {}),
    rng: args.rng,
  })

  const npc: NotableNpcWorldState = {
    id: args.npcId,
    name: generatedName,
    kind: profile.kind,
    ...(profile.cultureId !== undefined ? { cultureId: profile.cultureId } : {}),
    ...(profile.factionId !== undefined ? { factionId: profile.factionId } : {}),
    ...(profile.customerGroupId !== undefined
      ? { customerGroupId: profile.customerGroupId }
      : {}),
    firstSeenDay: args.firstSeenDay,
    tags: [...profile.tags],
    activeFlags: [...profile.activeFlags],
    castAttributes,
  }

  return { npc, generatedName }
}

function resolveProfile(profileId: string): NotableNpcProfile {
  if (!notableNpcProfileRegistry.has(profileId)) {
    throw new Error(
      `createNotableNpc: unknown notable NPC profile '${profileId}'`,
    )
  }
  return notableNpcProfileRegistry.get(profileId)
}
