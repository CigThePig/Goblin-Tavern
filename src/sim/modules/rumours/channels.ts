import type { SocialRumourState, TavernState } from '../../state/TavernState'
import { cultureRegistry } from '../../content/cultures/cultureRegistry'
import { factionRegistry } from '../../content/factions/factionRegistry'
import { getNpcModuleState } from '../npcs/npcState'
import { getCultureModuleState } from '../cultures/cultureState'
import { activeStances } from '../factions/factionState'

import {
  MAX_CHANNEL_SHARES_PER_WEEK,
  getRumourModuleState,
  hasHeard,
} from './rumourState'

// Expansion Phase 8 §8.4 — who carries talk, and how far.
//
// §8.4 asks for "faction, culture, regular, and NPC sharing behavior", which
// is the join this whole part of the arc has been building toward: §8.1 gave
// factions constituencies, §8.2 gave cultures dynamic comfort and trust, and
// §8.3 promoted a handful of NPCs into people. Those are the channels. A
// rumour does not diffuse into the air — somebody specific repeats it to
// somebody specific, and who they are decides how far and how faithfully.
//
// FOUR KINDS OF CARRIER, and they behave differently on purpose:
//
//   notable_npc  the widest reach and the least faithful telling. A gossip
//                is the fastest way for anything to travel and the surest
//                way for it to arrive wrong.
//   faction      reaches its own membership reliably. Distorts little —
//                an institution repeats a line rather than a story.
//   culture      reaches its own people and the cultures it shares rooms
//                with. Distorts moderately.
//   customer_group  the slowest and most faithful: people who were there.
//
// The `reach` on a rumour gates all of it. Something said in private moves
// between individuals; something said in public moves between crowds.

export type RumourChannel = {
  id: string
  kind: 'culture' | 'faction' | 'customer_group' | 'notable_npc'
  label: string
  /** 0..1. How much of what they repeat is theirs rather than what they heard. */
  distortionRate: number
  /** How many audiences they can reach in one telling. */
  reach: number
  /** 0..1. How much weight an audience gives what they say. */
  authority: number
}

const NPC_DISTORTION: Record<string, number> = {
  gossip: 0.45,
  smuggler: 0.3,
  rival: 0.35,
  authority: 0.05,
  creditor: 0.1,
  priest: 0.15,
  merchant_prince: 0.2,
  labour_lead: 0.25,
}

/** Everybody who could carry talk today, in a stable order. */
export function listChannels(state: TavernState): RumourChannel[] {
  const channels: RumourChannel[] = []

  // Promoted NPCs only. §8.3's threshold is what stops every name in the
  // world being a broadcast tower — an unpromoted NPC is not somebody the
  // house has dealings with, so they are not somebody it hears things from.
  for (const record of Object.values(getNpcModuleState(state).records)) {
    if (!record.promoted) continue
    const npc = state.world.notableNpcs[record.npcId]
    if (!npc) continue
    channels.push({
      id: npc.id,
      kind: 'notable_npc',
      label: npc.name.display,
      distortionRate: NPC_DISTORTION[npc.kind] ?? 0.25,
      reach: npc.kind === 'gossip' ? 3 : 2,
      authority: Math.min(1, 0.3 + record.resources.standing / 150),
    })
  }

  for (const faction of Object.values(state.world.factions)) {
    channels.push({
      id: faction.id,
      kind: 'faction',
      label: faction.label,
      distortionRate: 0.1,
      reach: faction.influence >= 50 ? 2 : 1,
      authority: Math.min(1, 0.3 + faction.influence / 150),
    })
  }

  for (const culture of Object.values(state.world.cultures)) {
    channels.push({
      id: culture.id,
      kind: 'culture',
      label: culture.label,
      distortionRate: 0.2,
      reach: culture.familiarity >= 55 ? 2 : 1,
      authority: Math.min(1, 0.25 + culture.familiarity / 200),
    })
  }

  for (const group of Object.values(state.customerGroups)) {
    if (group.patronage <= 0) continue
    channels.push({
      id: group.id,
      kind: 'customer_group',
      label: group.label,
      distortionRate: 0.12,
      reach: 1,
      authority: Math.min(1, 0.2 + group.patronage / 200),
    })
  }

  return channels.sort((a, b) => a.id.localeCompare(b.id))
}

/** Has this channel already done its talking this week? */
export function channelIsSpent(state: TavernState, channelId: string): boolean {
  const record = getRumourModuleState(state).channels[channelId]
  if (!record) return false
  return record.sharesThisWeek >= MAX_CHANNEL_SHARES_PER_WEEK
}

/**
 * Who this channel can reach, in a stable order.
 *
 * The edges are the world's own relationships rather than a graph of their
 * own: a faction reaches its constituency, a culture reaches the cultures it
 * actually shares rooms with, an NPC reaches their faction and their
 * culture. That means the rumour network is a VIEW of the social world §8.1
 * to §8.3 built, not a second one that could disagree with it.
 */
export function audiencesFor(
  state: TavernState,
  channel: RumourChannel,
  rumour: SocialRumourState,
): Array<{ id: string; kind: RumourChannel['kind']; label: string }> {
  const out: Array<{ id: string; kind: RumourChannel['kind']; label: string }> = []
  const push = (
    id: string,
    kind: RumourChannel['kind'],
    label: string | undefined,
  ): void => {
    if (!label) return
    if (id === channel.id) return
    if (hasHeard(rumour, id)) return
    if (out.some((entry) => entry.id === id)) return
    out.push({ id, kind, label })
  }

  switch (channel.kind) {
    case 'notable_npc': {
      const npc = state.world.notableNpcs[channel.id]
      if (!npc) break
      if (npc.factionId) {
        push(npc.factionId, 'faction', state.world.factions[npc.factionId]?.label)
      }
      if (npc.cultureId) {
        push(npc.cultureId, 'culture', state.world.cultures[npc.cultureId]?.label)
      }
      if (npc.customerGroupId) {
        push(
          npc.customerGroupId,
          'customer_group',
          state.customerGroups[npc.customerGroupId]?.label,
        )
      }
      // A gossip talks to anybody who will listen — that is the job.
      if (npc.kind === 'gossip' && rumour.reach === 'public') {
        for (const group of Object.values(state.customerGroups).sort((a, b) =>
          a.id.localeCompare(b.id),
        )) {
          if (group.patronage > 0) push(group.id, 'customer_group', group.label)
        }
      }
      break
    }
    case 'faction': {
      const def = factionRegistry.get(channel.id)
      for (const groupId of def?.representedGroupIds ?? []) {
        push(groupId, 'customer_group', state.customerGroups[groupId]?.label)
      }
      if (def?.cultureId) {
        push(def.cultureId, 'culture', state.world.cultures[def.cultureId]?.label)
      }
      break
    }
    case 'culture': {
      // The cultures they actually share rooms with — friction records are
      // earned by co-placement (§8.2), so this is real contact rather than a
      // notional social graph.
      for (const entry of Object.values(getCultureModuleState(state).friction)) {
        if (entry.cultureA === channel.id) {
          push(entry.cultureB, 'culture', state.world.cultures[entry.cultureB]?.label)
        } else if (entry.cultureB === channel.id) {
          push(entry.cultureA, 'culture', state.world.cultures[entry.cultureA]?.label)
        }
      }
      for (const group of Object.values(state.customerGroups).sort((a, b) =>
        a.id.localeCompare(b.id),
      )) {
        if (group.cultureId === channel.id) {
          push(group.id, 'customer_group', group.label)
        }
      }
      break
    }
    case 'customer_group': {
      const group = state.customerGroups[channel.id]
      if (group?.cultureId) {
        push(group.cultureId, 'culture', state.world.cultures[group.cultureId]?.label)
      }
      // A faction that speaks for them hears what they are saying.
      for (const def of factionRegistry.all()) {
        if (!def.representedGroupIds.includes(channel.id)) continue
        push(def.id, 'faction', state.world.factions[def.id]?.label)
      }
      break
    }
  }

  return out.slice(0, channel.reach)
}

/**
 * Would this channel bother repeating this?
 *
 * People pass on what suits them. A faction under a hostile stance carries
 * bad news about the house eagerly; one that has pledged support does not.
 * That is what stops the network being a uniform diffusion process and makes
 * WHO is talking mean something.
 */
export function willingToShare(
  state: TavernState,
  channel: RumourChannel,
  rumour: SocialRumourState,
): boolean {
  const damaging = isDamaging(rumour)

  if (channel.kind === 'faction') {
    const hostile = activeStances(state).some(
      (stance) =>
        stance.factionId === channel.id &&
        (stance.kind === 'boycott' ||
          stance.kind === 'supply_squeeze' ||
          stance.kind === 'rival_backing'),
    )
    const supportive = activeStances(state).some(
      (stance) => stance.factionId === channel.id && stance.kind === 'support',
    )
    if (damaging && supportive) return false
    if (!damaging && hostile) return false
    return true
  }

  if (channel.kind === 'culture') {
    const culture = state.world.cultures[channel.id]
    if (!culture) return false
    const trust = culture.trust ?? 50
    // People who trust the house do not spread stories about it, and people
    // who do not trust it are in no hurry to spread good news.
    if (damaging && trust >= 65) return false
    if (!damaging && trust <= 35) return false
    return true
  }

  if (channel.kind === 'notable_npc') {
    const record = getNpcModuleState(state).records[channel.id]
    if (!record) return false
    if (damaging && record.ownerStanding >= 30) return false
    if (!damaging && record.ownerStanding <= -30) return false
    return true
  }

  return true
}

/** Talk that reflects badly on the house. */
export function isDamaging(rumour: SocialRumourState): boolean {
  return !rumour.tags.includes('favourable')
}

/** A culture's display label, falling back to the registry then the id. */
export function cultureLabel(state: TavernState, id: string): string {
  if (state.world.cultures[id]) return state.world.cultures[id]!.label
  // `Registry.get` throws on an unknown id, so ask before reaching.
  return cultureRegistry.has(id) ? cultureRegistry.get(id).label : id
}
