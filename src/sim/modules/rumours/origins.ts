import type { SimContext } from '../../core/context'
import type { EntityRef, SocialRumourState } from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import { getNpcModuleState } from '../npcs/npcState'

import { audiencesOf, bumpRumourTotal, listRumours } from './rumourState'

// Expansion Phase 8 §8.4 — every rumour comes from somebody.
//
// §8.4's first bullet is "sources", and without one the whole network is
// inert: a channel may only repeat what it has heard or what it started, so
// a rumour that arrives belonging to nobody can never be carried by anybody.
// That is exactly what the world had — the weekly community pass minted
// rumours with a `sourceEntityId` that was sometimes set, often not, and
// never joined to anything that could speak.
//
// This pass adopts every ownerless rumour: it works out who most plausibly
// started it from what the rumour is actually about, records that as
// `originRef`, and puts them in as the first audience — because the person
// who started a story is by definition somebody who believes it.
//
// The choice is deterministic and reads the record rather than rolling:
//
//   1. an `involvedRefs` entry that names a speaking kind;
//   2. the `subject`, when that is somebody who could talk;
//   3. the legacy `sourceEntityId`, resolved against the world;
//   4. failing all of that, the promoted gossip — whose entire job this is —
//      and failing THAT, the largest customer group, because a story with no
//      author started with the crowd.

const SOURCE = 'rumours.origins'

const SPEAKING_KINDS = new Set(['faction', 'culture', 'customer_group', 'notable_npc'])

function resolveKind(
  ctx: SimContext,
  ref: EntityRef,
): { id: string; kind: 'faction' | 'culture' | 'customer_group' | 'notable_npc' } | undefined {
  if (!SPEAKING_KINDS.has(ref.kind)) return undefined
  const kind = ref.kind as 'faction' | 'culture' | 'customer_group' | 'notable_npc'
  const exists =
    (kind === 'faction' && ctx.state.world.factions[ref.id]) ||
    (kind === 'culture' && ctx.state.world.cultures[ref.id]) ||
    (kind === 'customer_group' && ctx.state.customerGroups[ref.id]) ||
    (kind === 'notable_npc' && ctx.state.world.notableNpcs[ref.id])
  return exists ? { id: ref.id, kind } : undefined
}

/** Who most plausibly started this, given what it is about. */
export function inferOrigin(
  ctx: SimContext,
  rumour: SocialRumourState,
): { id: string; kind: 'faction' | 'culture' | 'customer_group' | 'notable_npc' } | undefined {
  for (const ref of rumour.involvedRefs ?? []) {
    const resolved = resolveKind(ctx, ref)
    if (resolved) return resolved
  }
  if (rumour.subject) {
    const resolved = resolveKind(ctx, rumour.subject)
    if (resolved) return resolved
  }
  if (rumour.sourceEntityId) {
    for (const kind of ['notable_npc', 'faction', 'culture', 'customer_group'] as const) {
      const resolved = resolveKind(ctx, { kind, id: rumour.sourceEntityId })
      if (resolved) return resolved
    }
  }

  // The gossip's whole job. Only a PROMOTED one — §8.3's threshold means an
  // unpromoted NPC is not somebody the house has dealings with, and a story
  // has to start with somebody the house could plausibly hear about.
  const gossip = Object.values(getNpcModuleState(ctx.state).records)
    .filter((record) => {
      const npc = ctx.state.world.notableNpcs[record.npcId]
      return record.promoted && npc?.kind === 'gossip'
    })
    .sort((a, b) => a.npcId.localeCompare(b.npcId))[0]
  if (gossip) return { id: gossip.npcId, kind: 'notable_npc' }

  // Failing all of that, the crowd. ROTATED across the plausible carriers
  // rather than always the biggest: sending every ownerless story out of the
  // same mouth made one group the bottleneck for the whole world's talk, and
  // stories that all start in the same place are not a network. The index is
  // a stable function of the rumour id, so it is deterministic and a replay
  // picks the same mouth.
  const carriers = Object.values(ctx.state.customerGroups)
    .filter((group) => group.patronage > 0)
    .sort((a, b) => a.id.localeCompare(b.id))
  if (carriers.length === 0) return undefined
  const chosen = carriers[stableIndex(rumour.id, carriers.length)]!
  return { id: chosen.id, kind: 'customer_group' }
}

/**
 * Adopt every ownerless rumour.
 *
 * Runs before propagation each day, so a rumour minted by the weekly pass
 * (or carried in from an old save) can start travelling the same day it
 * appears rather than sitting inert forever.
 */
export function seedRumourOrigins(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  for (const rumour of listRumours(ctx.state)) {
    if (rumour.originRef && audiencesOf(rumour).length > 0) continue
    if (rumour.correctedOnDay !== undefined) continue

    const origin = rumour.originRef
      ? resolveKind(ctx, rumour.originRef)
      : inferOrigin(ctx, rumour)
    if (!origin) continue

    // Whoever started it believes it — that is what starting it means.
    const belief = clampPercent(Math.max(50, rumour.credibility ?? 50))
    ctx.modifySocialRumour(
      rumour.id,
      {
        originRef: { kind: origin.kind, id: origin.id },
        audiences: [
          { id: origin.id, kind: origin.kind, belief, heardOnDay: rumour.firstHeardDay },
        ],
        credibility: rumour.credibility ?? 50,
        reach: rumour.reach ?? 'public',
        distortion: rumour.distortion ?? 0,
        originalLabel: rumour.originalLabel ?? rumour.label,
        hops: rumour.hops ?? 0,
      },
      {
        source: `${SOURCE}.adopt`,
        sourceType: 'rumour',
        target: rumour.id,
        targetType: 'rumour',
        readable: `"${rumour.label}" is being put about by ${describe(ctx, origin)}.`,
        tags: ['rumour', 'origin', rumour.id, origin.id],
        relatedActors: [{ kind: 'rumour', id: rumour.id }],
        relatedSystems: ['rumours'],
      },
    )
    bumpRumourTotal(ctx, 'started')
    void today
  }
}

/** A stable, RNG-free index from a string. Same id, same answer, always. */
function stableIndex(key: string, length: number): number {
  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 100003
  }
  return hash % length
}

function describe(
  ctx: SimContext,
  origin: { id: string; kind: string },
): string {
  switch (origin.kind) {
    case 'faction':
      return ctx.state.world.factions[origin.id]?.label ?? origin.id
    case 'culture':
      return ctx.state.world.cultures[origin.id]?.label ?? origin.id
    case 'customer_group':
      return ctx.state.customerGroups[origin.id]?.label ?? origin.id
    case 'notable_npc':
      return ctx.state.world.notableNpcs[origin.id]?.name.display ?? origin.id
    default:
      return origin.id
  }
}
