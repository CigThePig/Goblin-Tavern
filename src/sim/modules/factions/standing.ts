import type { SimContext } from '../../core/context'
import type {
  CustomerGroupState,
  FactionWorldState,
  RegularWorldState,
  SupplierWorldState,
  TavernState,
} from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import { factionRegistry } from '../../content/factions/factionRegistry'
import type { FactionDefinition } from '../../content/factions/factionTypes'

import {
  getFactionModuleState,
  writeFactionSlice,
} from './factionState'
import type { FactionStanding, FactionStandingEntry } from './types'

// Expansion Phase 8 §8.1 — memory of treatment, and the constituency a
// faction speaks for.
//
// WHAT THIS REPLACES. Until this phase a faction's entire behaviour was:
// read a pressure, compare it to a threshold, move `relationship` by one.
// That is the "pure threshold +1/-1 drift" §8.1 names as the thing to stop
// doing, and its real failing was not the size of the step — it was that
// the number carried no reason. You could not ask a faction WHY it thought
// what it thought, so nothing it did could be argued with.
//
// The same signals still matter. They now land as EVIDENCE: dated,
// weighted, readable entries with tags. `net` is derived from the entries,
// and the visible `relationship` meter is derived from `net` — so §8.1's
// "relationships can still summarize history" holds literally. Nothing
// writes `relationship` as a behaviour any more; it is a projection of
// what the faction remembers, and what the faction DOES comes from its
// goals and its action set instead.

const SOURCE = 'factions.standing'

/** §5.11 — a faction remembers this many things about you at once. */
export const MAX_STANDING_ENTRIES = 12

/** Days before an entry has faded to nothing and is dropped. */
export const STANDING_MEMORY_DAYS = 30

/** The most the summarised relationship may move in one day. */
const MAX_RELATIONSHIP_STEP = 2

export function factionDefinition(id: string): FactionDefinition | undefined {
  return factionRegistry.get(id)
}

// ---------------------------------------------------------------------------
// Constituency (§8.1 "membership or represented constituency")
// ---------------------------------------------------------------------------

/** The customer groups this faction speaks for, as live state. */
export function representedGroups(
  state: TavernState,
  factionId: string,
): CustomerGroupState[] {
  const def = factionDefinition(factionId)
  if (!def) return []
  return def.representedGroupIds
    .map((groupId) => state.customerGroups[groupId])
    .filter((group): group is CustomerGroupState => group !== undefined)
}

/** Suppliers who answer to this faction. */
export function memberSuppliers(
  state: TavernState,
  factionId: string,
): SupplierWorldState[] {
  return Object.values(state.world.suppliers)
    .filter((supplier) => supplier.factionId === factionId)
    .sort((a, b) => a.id.localeCompare(b.id))
}

/** Named regulars who count themselves members. */
export function memberRegulars(
  state: TavernState,
  factionId: string,
): RegularWorldState[] {
  return Object.values(state.world.regulars)
    .filter((regular) => regular.factionId === factionId)
    .sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * How many people this faction can actually speak for, 0..1.
 *
 * A faction with a big, loyal constituency has something to withhold; one
 * with nobody in the room has to work through authority instead. Used by
 * the action scoring so a boycott from a faction nobody follows is not
 * worth calling.
 */
export function constituencyReach(state: TavernState, factionId: string): number {
  const groups = representedGroups(state, factionId)
  const patronage = groups.reduce((sum, group) => sum + group.patronage, 0)
  const regulars = memberRegulars(state, factionId).length
  const suppliers = memberSuppliers(state, factionId).length
  const raw = patronage / 200 + regulars * 0.08 + suppliers * 0.12
  return Math.min(1, Math.round(raw * 100) / 100)
}

// ---------------------------------------------------------------------------
// Standing (§8.1 "memory of treatment")
// ---------------------------------------------------------------------------

export function emptyStanding(factionId: string, today: number): FactionStanding {
  return { factionId, entries: [], net: 0, lastUpdatedOnDay: today }
}

/** An entry's remaining force today. Linear decay to nothing at 30 days. */
export function entryWeightToday(
  entry: FactionStandingEntry,
  today: number,
): number {
  const age = Math.max(0, today - entry.onDay)
  if (age >= STANDING_MEMORY_DAYS) return 0
  const fade = 1 - age / STANDING_MEMORY_DAYS
  const signed = entry.kind === 'favour' ? entry.weight : -entry.weight
  return Math.round(signed * fade * 100) / 100
}

/** -100..100, derived. Never stored except as a cached summary. */
export function netStanding(standing: FactionStanding, today: number): number {
  const total = standing.entries.reduce(
    (sum, entry) => sum + entryWeightToday(entry, today),
    0,
  )
  return Math.max(-100, Math.min(100, Math.round(total)))
}

/**
 * Record that the tavern did something this faction noticed.
 *
 * Same-day, same-id evidence REINFORCES rather than duplicating: a tavern
 * that misses three of a supplier's invoices on one day has one louder
 * grievance, not three identical ones, which is what stops a bad week
 * filling the whole twelve-entry memory with the same complaint.
 */
export function noteStanding(
  ctx: SimContext,
  input: {
    factionId: string
    id: string
    kind: 'favour' | 'grievance'
    weight: number
    readable: string
    tags?: string[]
  },
): void {
  const faction = ctx.state.world.factions[input.factionId]
  if (!faction) return
  const today = ctx.state.calendar.totalDaysElapsed
  const weight = Math.max(1, Math.min(40, Math.round(input.weight)))

  writeFactionSlice(
    ctx,
    (current) => {
      const existing =
        current.standing[input.factionId] ?? emptyStanding(input.factionId, today)
      const entries = [...existing.entries]
      const sameIndex = entries.findIndex(
        (entry) => entry.id === input.id && entry.kind === input.kind,
      )
      const entry: FactionStandingEntry = {
        id: input.id,
        onDay: today,
        kind: input.kind,
        weight:
          sameIndex >= 0 && entries[sameIndex]!.onDay === today
            ? Math.min(40, entries[sameIndex]!.weight + Math.ceil(weight / 2))
            : weight,
        readable: input.readable,
        tags: [...(input.tags ?? [])],
      }
      if (sameIndex >= 0) entries.splice(sameIndex, 1)
      entries.push(entry)
      // §5.11 — a faction holds twelve things against (or for) you. The
      // faintest goes first, not the oldest: a grudge that still burns
      // outlives a courtesy from last week.
      const trimmed =
        entries.length <= MAX_STANDING_ENTRIES
          ? entries
          : [...entries]
              .sort(
                (a, b) =>
                  Math.abs(entryWeightToday(b, today)) -
                  Math.abs(entryWeightToday(a, today)),
              )
              .slice(0, MAX_STANDING_ENTRIES)
              .sort((a, b) => a.onDay - b.onDay)
      const next: FactionStanding = {
        factionId: input.factionId,
        entries: trimmed,
        net: 0,
        lastUpdatedOnDay: today,
      }
      next.net = netStanding(next, today)
      return {
        ...current,
        standing: { ...current.standing, [input.factionId]: next },
      }
    },
    `standing_${input.kind}`,
  )
}

/** The strongest live grievance, for explaining a hostile move. */
export function worstGrievance(
  state: TavernState,
  factionId: string,
): FactionStandingEntry | undefined {
  const today = state.calendar.totalDaysElapsed
  const standing = getFactionModuleState(state).standing[factionId]
  if (!standing) return undefined
  return [...standing.entries]
    .filter((entry) => entry.kind === 'grievance' && entryWeightToday(entry, today) < 0)
    .sort(
      (a, b) => entryWeightToday(a, today) - entryWeightToday(b, today),
    )[0]
}

export function standingNet(state: TavernState, factionId: string): number {
  const standing = getFactionModuleState(state).standing[factionId]
  if (!standing) return 0
  return netStanding(standing, state.calendar.totalDaysElapsed)
}

// ---------------------------------------------------------------------------
// The daily summary pass
// ---------------------------------------------------------------------------

/**
 * Re-derive `net` from the entries, drop what has faded, and walk the
 * visible relationship meter toward what the faction actually remembers.
 *
 * The step cap matters: without it, one bad day would swing a relationship
 * thirty points and the meter would be noise again. With it, the meter is
 * a slow reading of a memory that itself decays — and every point of it is
 * attributable to a named entry.
 */
export function summariseStanding(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const slice = getFactionModuleState(ctx.state)
  const nextStanding: Record<string, FactionStanding> = {}

  const factionIds = Object.keys(ctx.state.world.factions).sort()
  for (const factionId of factionIds) {
    const existing = slice.standing[factionId]
    if (!existing) continue
    const entries = existing.entries.filter(
      (entry) => today - entry.onDay < STANDING_MEMORY_DAYS,
    )
    const summarised: FactionStanding = {
      factionId,
      entries,
      net: 0,
      lastUpdatedOnDay: today,
    }
    summarised.net = netStanding(summarised, today)
    nextStanding[factionId] = summarised
  }

  writeFactionSlice(
    ctx,
    (current) => ({ ...current, standing: nextStanding }),
    'standing_summary',
  )

  for (const factionId of factionIds) {
    const faction = ctx.state.world.factions[factionId]
    if (!faction) continue
    const net = nextStanding[factionId]?.net ?? 0
    applyRelationshipSummary(ctx, faction, net)
  }
}

function applyRelationshipSummary(
  ctx: SimContext,
  faction: FactionWorldState,
  net: number,
): void {
  const def = factionDefinition(faction.id)
  const anchor = def?.defaultRelationship ?? 50
  // Round before clamping: the meter is an integer the player reads, and a
  // half-point step would make the visible number jitter without moving.
  const target = clampPercent(Math.round(anchor + net / 2))
  if (target === faction.relationship) return
  const step = Math.max(
    -MAX_RELATIONSHIP_STEP,
    Math.min(MAX_RELATIONSHIP_STEP, target - faction.relationship),
  )
  const next = clampPercent(Math.round(faction.relationship + step))
  if (next === faction.relationship) return

  const driver = dominantEntry(ctx.state, faction.id)
  ctx.modifyFaction(
    faction.id,
    { relationship: next },
    {
      source: `${SOURCE}.summary`,
      sourceType: 'faction',
      target: faction.id,
      targetType: 'faction',
      amount: step,
      readable: driver
        ? `${faction.label} relationship ${faction.relationship} → ${next} (${driver.readable})`
        : `${faction.label} relationship ${faction.relationship} → ${next} (settling back toward normal).`,
      tags: ['faction', 'relationship', 'standing', faction.id],
      relatedActors: [{ kind: 'faction', id: faction.id }],
      relatedSystems: ['factions'],
    },
  )
}

/** The single entry doing most of the work in today's summary. */
function dominantEntry(
  state: TavernState,
  factionId: string,
): FactionStandingEntry | undefined {
  const today = state.calendar.totalDaysElapsed
  const standing = getFactionModuleState(state).standing[factionId]
  if (!standing || standing.entries.length === 0) return undefined
  return [...standing.entries].sort(
    (a, b) =>
      Math.abs(entryWeightToday(b, today)) - Math.abs(entryWeightToday(a, today)),
  )[0]
}
