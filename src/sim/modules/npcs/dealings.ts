import type { SimContext } from '../../core/context'
import type { NotableNpcWorldState, TavernState } from '../../state/TavernState'
import { getServiceModuleState } from '../service/serviceModule'
import { getFactionModuleState } from '../factions/factionState'
import { getRegulatoryModuleState } from '../regulatory/state'
import { openCases } from '../regulatory/types'

import {
  MAX_NPC_INTERACTIONS,
  MAX_NPC_RELATIONSHIPS,
  bumpNpcTotal,
  getNpcModuleState,
  writeNpcSlice,
} from './npcState'
import type {
  NpcAvailabilityPattern,
  NpcInteractionKind,
  NpcRecord,
  NpcResources,
} from './types'

// Expansion Phase 8 §8.3 — what the house has actually had to do with these
// people, and when they are about.
//
// The Tier 1 record. Everything here is cheap and factual: it exists so that
// "why is this person an agent" and "when can I find them" both have answers
// without anybody having to be simulated. `lastSeenDay` on the world record
// — declared since Phase 44 and never once written — is finally set here.

const SOURCE = 'npcs.dealings'

/** Where each role is usually found. §8.3's schedule/availability. */
const AVAILABILITY_BY_KIND: Record<string, NpcAvailabilityPattern> = {
  authority: 'most_days',
  gossip: 'most_days',
  priest: 'most_days',
  merchant_prince: 'market_days',
  labour_lead: 'paydays',
  smuggler: 'nights',
  creditor: 'by_arrangement',
  rival: 'by_arrangement',
}

/** What each role can put behind something. §8.3's possessions/resources. */
function startingResources(npc: NotableNpcWorldState): NpcResources {
  switch (npc.kind) {
    case 'creditor':
      return { coin: 250, standing: 60, goods: [], favoursOwed: 0 }
    case 'merchant_prince':
      return { coin: 160, standing: 55, goods: ['ingredients', 'mushrooms'], favoursOwed: 0 }
    case 'smuggler':
      return { coin: 60, standing: 30, goods: ['ale'], favoursOwed: 0 }
    case 'authority':
      return { coin: 40, standing: 65, goods: [], favoursOwed: 0 }
    case 'labour_lead':
      return { coin: 40, standing: 50, goods: [], favoursOwed: 0 }
    case 'priest':
      return { coin: 50, standing: 45, goods: [], favoursOwed: 0 }
    case 'gossip':
      return { coin: 15, standing: 25, goods: [], favoursOwed: 0 }
    default:
      return { coin: 40, standing: 35, goods: [], favoursOwed: 0 }
  }
}

export function emptyNpcRecord(
  npc: NotableNpcWorldState,
  today: number,
): NpcRecord {
  return {
    npcId: npc.id,
    interactions: [],
    interactionCount: 0,
    importance: 0,
    promoted: false,
    ownerStanding: 0,
    relationships: [],
    availability: { pattern: AVAILABILITY_BY_KIND[npc.kind] ?? 'by_arrangement' },
    resources: startingResources(npc),
    lastUpdatedOnDay: today,
  }
}

/** Is this person about today, by their own pattern? */
export function isAboutToday(
  state: TavernState,
  record: NpcRecord,
): boolean {
  const dayType = state.calendar.dayType
  switch (record.availability.pattern) {
    case 'most_days':
      return dayType !== 'maintenance_day'
    case 'market_days':
      return dayType === 'market_day' || dayType === 'supplier_day'
    case 'paydays':
      return dayType === 'payday'
    case 'nights':
      return dayType === 'local_night' || dayType === 'brawl_night'
    case 'by_arrangement':
      // Only when there is business to do — which is what `by_arrangement`
      // means. Promotion is that business existing.
      return record.promoted
  }
}

/** The next day their pattern says they will be about. */
export function nextExpectedDay(state: TavernState, record: NpcRecord): number {
  const today = state.calendar.totalDaysElapsed
  // The calendar cycles the seven day types weekly, so the next matching day
  // is at most a week away; walking forward is exact and cheap.
  for (let ahead = 1; ahead <= 7; ahead += 1) {
    const probe: TavernState = {
      ...state,
      calendar: { ...state.calendar, dayType: dayTypeIn(state, ahead) },
    }
    if (isAboutToday(probe, record)) return today + ahead
  }
  return today + 7
}

const DAY_TYPE_CYCLE = [
  'supplier_day',
  'quiet_day',
  'market_day',
  'local_night',
  'payday',
  'brawl_night',
  'maintenance_day',
] as const

function dayTypeIn(state: TavernState, ahead: number): TavernState['calendar']['dayType'] {
  const index = DAY_TYPE_CYCLE.indexOf(
    state.calendar.dayType as (typeof DAY_TYPE_CYCLE)[number],
  )
  if (index < 0) return state.calendar.dayType
  return DAY_TYPE_CYCLE[(index + ahead) % DAY_TYPE_CYCLE.length]!
}

/**
 * Record that the house dealt with somebody.
 *
 * Same-day, same-kind dealings reinforce rather than duplicating, so a busy
 * day with one person is one louder dealing rather than six identical ones.
 */
export function noteDealing(
  ctx: SimContext,
  input: {
    npcId: string
    kind: NpcInteractionKind
    readable: string
    /** Positive when it helped the relationship, negative when it hurt. */
    weight: number
  },
): void {
  const npc = ctx.state.world.notableNpcs[input.npcId]
  if (!npc) return
  const today = ctx.state.calendar.totalDaysElapsed

  writeNpcSlice(
    ctx,
    (current) => {
      const record = current.records[input.npcId] ?? emptyNpcRecord(npc, today)
      const interactions = [...record.interactions]
      const sameIndex = interactions.findIndex(
        (entry) => entry.kind === input.kind && entry.onDay === today,
      )
      const entry = {
        onDay: today,
        kind: input.kind,
        readable: input.readable,
        weight:
          sameIndex >= 0
            ? clampWeight(interactions[sameIndex]!.weight + input.weight / 2)
            : clampWeight(input.weight),
      }
      const isNew = sameIndex < 0
      if (sameIndex >= 0) interactions.splice(sameIndex, 1)
      interactions.push(entry)

      const standing = Math.max(
        -100,
        Math.min(100, record.ownerStanding + Math.round(input.weight)),
      )
      return {
        ...current,
        records: {
          ...current.records,
          [input.npcId]: {
            ...record,
            interactions: interactions.slice(-MAX_NPC_INTERACTIONS),
            // Only a NEW dealing counts toward the repeated-interaction
            // threshold — otherwise one busy evening would promote somebody.
            interactionCount: record.interactionCount + (isNew ? 1 : 0),
            ownerStanding: standing,
            lastUpdatedOnDay: today,
          },
        },
      }
    },
    `dealing_${input.kind}`,
  )
}

function clampWeight(value: number): number {
  return Math.max(-40, Math.min(40, Math.round(value)))
}

/** Note how an NPC feels about somebody else. §8.3's relationships. */
export function noteNpcRelationship(
  ctx: SimContext,
  input: {
    npcId: string
    withRef: { kind: string; id: string }
    affinityDelta: number
    readable: string
  },
): void {
  const npc = ctx.state.world.notableNpcs[input.npcId]
  if (!npc) return
  const today = ctx.state.calendar.totalDaysElapsed
  writeNpcSlice(
    ctx,
    (current) => {
      const record = current.records[input.npcId] ?? emptyNpcRecord(npc, today)
      const relationships = [...record.relationships]
      const index = relationships.findIndex(
        (entry) =>
          entry.withRef.kind === input.withRef.kind &&
          entry.withRef.id === input.withRef.id,
      )
      const previous = index >= 0 ? relationships[index]! : undefined
      const next = {
        withRef: input.withRef,
        affinity: Math.max(
          -100,
          Math.min(100, (previous?.affinity ?? 0) + input.affinityDelta),
        ),
        readable: input.readable,
        lastChangedOnDay: today,
      }
      if (index >= 0) relationships.splice(index, 1)
      relationships.push(next)
      return {
        ...current,
        records: {
          ...current.records,
          [input.npcId]: {
            ...record,
            relationships: relationships.slice(-MAX_NPC_RELATIONSHIPS),
            lastUpdatedOnDay: today,
          },
        },
      }
    },
    'relationship',
  )
}

/**
 * Read the day and record what the house had to do with these people.
 *
 * Runs at `closing`, after service, the faction pass and the regulatory pass
 * have all settled — so every dealing recorded here is one that actually
 * happened rather than one that was about to.
 */
/**
 * Work out who is about today, and write it down.
 *
 * Runs at `startDay`, and that placement is load-bearing: `cultivate_npc`
 * offers exactly the people who are about, and owner actions are applied
 * long before `closing`. Computed at the end of the day instead, the roster
 * was empty every time the player could have used it and then described
 * yesterday by the time anybody read it.
 */
export function observeAvailability(ctx: SimContext): void {
  const state = ctx.state
  const today = state.calendar.totalDaysElapsed
  const npcs = Object.values(state.world.notableNpcs).sort((a, b) =>
    a.id.localeCompare(b.id),
  )
  if (npcs.length === 0) return

  // Make sure everybody has a Tier 1 record before anything reads one.
  ensureRecords(ctx, npcs)

  const slice = getNpcModuleState(ctx.state)
  const about: string[] = []
  for (const npc of npcs) {
    const record = slice.records[npc.id] ?? emptyNpcRecord(npc, today)
    if (isAboutToday(state, record)) about.push(npc.id)
  }

  for (const npcId of about) {
    const npc = state.world.notableNpcs[npcId]
    if (!npc || npc.lastSeenDay === today) continue
    ctx.modifyNotableNpc(
      npcId,
      { lastSeenDay: today },
      {
        source: `${SOURCE}.about`,
        sourceType: 'notable_npc',
        target: npcId,
        targetType: 'notable_npc',
        readable: `${npc.name.display} was about today.`,
        tags: ['npc', 'about', npcId],
        relatedActors: [{ kind: 'notable_npc', id: npcId }],
        relatedSystems: ['npcs'],
      },
    )
  }

  writeNpcSlice(
    ctx,
    (current) => {
      const records = { ...current.records }
      for (const npcId of about) {
        const record = records[npcId]
        if (!record) continue
        records[npcId] = {
          ...record,
          availability: {
            ...record.availability,
            lastAboutOnDay: today,
            nextExpectedDay: nextExpectedDay(state, record),
          },
        }
      }
      return { ...current, records, aboutToday: about }
    },
    'availability',
  )
  bumpNpcTotal(ctx, 'visitsMade', about.length)
}

/**
 * Record what the house actually had to do with these people today.
 *
 * Runs at `closing`, after service, the faction pass and the regulatory pass
 * have all settled — so every dealing here is one that happened rather than
 * one that was about to.
 */
export function observeDealings(ctx: SimContext): void {
  const state = ctx.state
  const npcs = Object.values(state.world.notableNpcs).sort((a, b) =>
    a.id.localeCompare(b.id),
  )
  if (npcs.length === 0) return
  ensureRecords(ctx, npcs)

  // Their faction did something the house was part of.
  const factionSlice = getFactionModuleState(state)
  for (const move of factionSlice.movesToday) {
    for (const npc of npcs) {
      if (npc.factionId !== move.factionId) continue
      noteDealing(ctx, {
        npcId: npc.id,
        kind: 'faction_dealing',
        readable: `${npc.name.display} was part of it: ${move.readable}`,
        weight: -4,
      })
    }
  }

  // The watch actually came.
  const cases = openCases(getRegulatoryModuleState(state))
  if (cases.length > 0) {
    for (const npc of npcs) {
      if (npc.kind !== 'authority') continue
      noteDealing(ctx, {
        npcId: npc.id,
        kind: 'regulatory_dealing',
        readable: `${npc.name.display} has the house on their books.`,
        weight: -3,
      })
    }
  }

  // Somebody of their crowd was actually served tonight.
  const flow = getServiceModuleState(state).result.flow
  if (flow.ran) {
    const servedGroups = new Set(
      flow.parties
        .filter((party) => party.outcome === 'served')
        .map((party) => party.groupId),
    )
    for (const npc of npcs) {
      if (!npc.customerGroupId || !servedGroups.has(npc.customerGroupId)) continue
      noteDealing(ctx, {
        npcId: npc.id,
        kind: 'visit',
        readable: `${npc.name.display}'s people drank here tonight.`,
        weight: 3,
      })
    }
  }

}

function ensureRecords(
  ctx: SimContext,
  npcs: ReadonlyArray<NotableNpcWorldState>,
): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const slice = getNpcModuleState(ctx.state)
  const missing = npcs.filter((npc) => !slice.records[npc.id])
  if (missing.length === 0) return
  writeNpcSlice(
    ctx,
    (current) => {
      const records = { ...current.records }
      for (const npc of missing) {
        if (!records[npc.id]) records[npc.id] = emptyNpcRecord(npc, today)
      }
      return { ...current, records }
    },
    'seed_records',
  )
}
