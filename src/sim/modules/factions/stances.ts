import type { SimContext } from '../../core/context'
import type {
  CustomerGroupState,
  SupplierWorldState,
  TavernState,
} from '../../state/TavernState'
import { factionRegistry } from '../../content/factions/factionRegistry'

import {
  activeStance,
  activeStances,
  getFactionModuleState,
  stanceId,
  writeFactionSlice,
} from './factionState'
import type { FactionStance, FactionStanceKind } from './types'

// Expansion Phase 8 §8.1 — what a faction is currently DOING, and how the
// rest of the simulation reads it.
//
// THE RULE THIS FILE EXISTS TO KEEP. §5 fails a phase whose "only
// consequence is a direct pressure or reputation adjustment", and §8.5 is
// explicit that a belief "does not directly mutate unrelated domains — it
// supplies a bounded input to their decision rules". So a faction move
// never reaches into the customers, suppliers or regulatory slices. It
// opens a STANCE here, and each domain reads the stance through the
// accessor below when it makes its own decision:
//
//   boycott / support   → `customers/forecast.ts` when it projects turnout
//   supply_squeeze      → `suppliers/quote.ts` for price and credit
//   protection          → the violence pressure calculator
//   rival_backing       → `economy/dynamics.ts` competitor choice
//
// Every accessor is pure, bounded, and returns a note that names the
// faction, so the effect is always attributable in the surface that shows
// it. A stance the player never sees explained is the bug, not the feature.

const SOURCE = 'factions.stances'

/** How long each kind of commitment runs before it must be re-decided. */
export const STANCE_DURATION_DAYS: Record<FactionStanceKind, number> = {
  support: 7,
  boycott: 6,
  protection: 7,
  supply_squeeze: 6,
  rival_backing: 8,
}

/** Caps on how far any one stance can move the domain that reads it. */
const MAX_BOYCOTT_FORECAST_HIT = 14
const MAX_SUPPORT_FORECAST_LIFT = 9
const MAX_SUPPLY_PRICE_SWING = 0.08
const MAX_CREDIT_SWING = 0.35
const MAX_PROTECTION_RELIEF = 12
const MAX_RIVAL_BACKING_APPEAL = 0.12

export function openStance(
  ctx: SimContext,
  input: {
    factionId: string
    kind: FactionStanceKind
    strength: number
    reason: string
    goalId: string
  },
): FactionStance | undefined {
  const faction = ctx.state.world.factions[input.factionId]
  if (!faction) return undefined
  const today = ctx.state.calendar.totalDaysElapsed
  const stance: FactionStance = {
    id: stanceId(input.factionId, input.kind),
    factionId: input.factionId,
    kind: input.kind,
    strength: Math.max(1, Math.min(100, Math.round(input.strength))),
    startedOnDay: today,
    endsOnDay: today + STANCE_DURATION_DAYS[input.kind],
    reason: input.reason,
    goalId: input.goalId,
  }
  writeFactionSlice(
    ctx,
    (current) => ({
      ...current,
      stances: { ...current.stances, [stance.id]: stance },
    }),
    `stance_${input.kind}`,
  )
  syncFactionFlags(ctx, input.factionId)
  return stance
}

/**
 * End a stance early.
 *
 * `soften` is what a successful appeal buys when the faction will not drop
 * the move outright: the window shortens and the strength halves, so
 * arguing is worth doing even when it does not win.
 */
export function closeStance(
  ctx: SimContext,
  factionId: string,
  kind: FactionStanceKind,
  mode: 'end' | 'soften',
): FactionStance | undefined {
  const today = ctx.state.calendar.totalDaysElapsed
  const id = stanceId(factionId, kind)
  const existing = getFactionModuleState(ctx.state).stances[id]
  if (!existing || existing.endsOnDay < today) return undefined

  const next: FactionStance =
    mode === 'end'
      ? { ...existing, endsOnDay: today - 1, contestedOnDay: today }
      : {
          ...existing,
          strength: Math.max(1, Math.round(existing.strength / 2)),
          endsOnDay: Math.max(today, existing.endsOnDay - 3),
          contestedOnDay: today,
        }

  writeFactionSlice(
    ctx,
    (current) => ({ ...current, stances: { ...current.stances, [id]: next } }),
    `stance_${mode}`,
  )
  syncFactionFlags(ctx, factionId)
  return next
}

/**
 * Keep `FactionWorldState.activeFlags` in step with the live stances.
 *
 * The flags predate this phase and are already read by the faction report,
 * the issue-seed generators and the world overview, so mirroring the
 * stances into them is how a faction's current move shows up everywhere
 * that already looks at factions — without a second source of truth. The
 * stances are authoritative; the flags are the projection.
 */
export function syncFactionFlags(ctx: SimContext, factionId: string): void {
  const faction = ctx.state.world.factions[factionId]
  if (!faction) return
  const today = ctx.state.calendar.totalDaysElapsed
  const live = Object.values(getFactionModuleState(ctx.state).stances)
    .filter((stance) => stance.factionId === factionId && stance.endsOnDay >= today)
    .map((stance) => `stance:${stance.kind}`)
    .sort()
  const kept = faction.activeFlags.filter((flag) => !flag.startsWith('stance:'))
  const nextFlags = [...kept, ...live]
  if (
    nextFlags.length === faction.activeFlags.length &&
    nextFlags.every((flag, index) => flag === faction.activeFlags[index])
  ) {
    return
  }
  ctx.modifyFaction(
    factionId,
    { activeFlags: nextFlags },
    {
      source: `${SOURCE}.flags`,
      sourceType: 'faction',
      target: factionId,
      targetType: 'faction',
      readable: `${faction.label}: ${live.length > 0 ? live.join(', ') : 'no active stance'}.`,
      tags: ['faction', 'stance', factionId],
      relatedActors: [{ kind: 'faction', id: factionId }],
      relatedSystems: ['factions'],
    },
  )
}

// ---------------------------------------------------------------------------
// Bounded inputs the owning domains read
// ---------------------------------------------------------------------------

export type FactionForecastModifier = {
  modifier: number
  notes: string[]
}

/**
 * What the factions are doing to this group's turnout today.
 *
 * Read by `customers/forecast.ts`. A boycott is the whole point of a
 * constituency: the faction does not touch satisfaction or patronage, it
 * keeps its own people at home for a week, and the group's own forecast
 * rule is what turns that into fewer visitors.
 */
export function getFactionForecastModifier(
  state: TavernState,
  group: CustomerGroupState,
): FactionForecastModifier {
  let modifier = 0
  const notes: string[] = []
  for (const stance of activeStances(state)) {
    if (stance.kind !== 'boycott' && stance.kind !== 'support') continue
    const def = factionRegistry.get(stance.factionId)
    if (!def?.representedGroupIds.includes(group.id)) continue
    const faction = state.world.factions[stance.factionId]
    const label = faction?.label ?? stance.factionId
    if (stance.kind === 'boycott') {
      const hit = Math.round((stance.strength / 100) * MAX_BOYCOTT_FORECAST_HIT)
      if (hit <= 0) continue
      modifier -= hit
      notes.push(`${label} are keeping their people away (-${hit}).`)
    } else {
      const lift = Math.round((stance.strength / 100) * MAX_SUPPORT_FORECAST_LIFT)
      if (lift <= 0) continue
      modifier += lift
      notes.push(`${label} are sending their people here (+${lift}).`)
    }
  }
  return { modifier, notes }
}

export type FactionSupplyPressure = {
  /** Multiplier on the quoted price. 1 when nobody is leaning. */
  priceMultiplier: number
  /** Multiplier on the credit limit. 1 when nobody is leaning. */
  creditMultiplier: number
  note?: string
}

/**
 * What the faction behind a supplier is doing to its terms.
 *
 * Read by `suppliers/quote.ts`. The supplier still owns its own price and
 * its own credit decision; this is only an input to them, capped at ±8% on
 * price and −35% on credit so a squeeze hurts without ever being the whole
 * story.
 */
export function getFactionSupplyPressure(
  state: TavernState,
  supplier: SupplierWorldState,
): FactionSupplyPressure {
  const factionId = supplier.factionId
  if (!factionId) return { priceMultiplier: 1, creditMultiplier: 1 }
  const faction = state.world.factions[factionId]
  const label = faction?.label ?? factionId

  const squeeze = activeStance(state, factionId, 'supply_squeeze')
  if (squeeze) {
    const swing = (squeeze.strength / 100) * MAX_SUPPLY_PRICE_SWING
    return {
      priceMultiplier: round3(1 + swing),
      creditMultiplier: round3(1 - (squeeze.strength / 100) * MAX_CREDIT_SWING),
      note: `${label} are leaning on their suppliers: ${Math.round(swing * 100)}% on, credit tightened`,
    }
  }

  const support = activeStance(state, factionId, 'support')
  if (support) {
    const swing = (support.strength / 100) * (MAX_SUPPLY_PRICE_SWING / 2)
    return {
      priceMultiplier: round3(1 - swing),
      creditMultiplier: round3(1 + (support.strength / 100) * (MAX_CREDIT_SWING / 2)),
      note: `${label} have put a word in: ${Math.round(swing * 100)}% off, credit eased`,
    }
  }

  return { priceMultiplier: 1, creditMultiplier: 1 }
}

export type FactionProtection = {
  /** Points of relief on violence pressure. 0 when nobody is watching the door. */
  relief: number
  readable?: string
}

/**
 * Somebody is keeping trouble off the floor.
 *
 * Read by the violence pressure calculator, alongside the bouncer relief it
 * already computes — the faction's people are doing the same job, so it
 * lands in the same place rather than inventing a second channel.
 */
export function getFactionProtection(state: TavernState): FactionProtection {
  let relief = 0
  const labels: string[] = []
  for (const stance of activeStances(state)) {
    if (stance.kind !== 'protection') continue
    const faction = state.world.factions[stance.factionId]
    relief += Math.round((stance.strength / 100) * MAX_PROTECTION_RELIEF)
    labels.push(faction?.label ?? stance.factionId)
  }
  if (relief <= 0) return { relief: 0 }
  const capped = Math.min(MAX_PROTECTION_RELIEF, relief)
  return {
    relief: capped,
    readable: `${labels.join(' and ')} keeping order (-${capped}).`,
  }
}

/**
 * How much extra pull the rival has because somebody is backing them.
 *
 * Returned as an appeal DELTA in the 0..1 space `economy/dynamics.ts`
 * already works in, capped at 0.12, so the competitor factor stays the
 * economy module's calculation and this is only one of its terms.
 */
export function getFactionRivalBacking(state: TavernState): {
  appealDelta: number
  note?: string
} {
  let delta = 0
  const labels: string[] = []
  for (const stance of activeStances(state)) {
    if (stance.kind !== 'rival_backing') continue
    const faction = state.world.factions[stance.factionId]
    delta += (stance.strength / 100) * MAX_RIVAL_BACKING_APPEAL
    labels.push(faction?.label ?? stance.factionId)
  }
  if (delta <= 0) return { appealDelta: 0 }
  const capped = Math.min(MAX_RIVAL_BACKING_APPEAL, round3(delta))
  return {
    appealDelta: capped,
    note: `${labels.join(' and ')} are backing the competition.`,
  }
}

/** Every hostile stance a player could argue with today. */
export function contestableStances(state: TavernState): FactionStance[] {
  return activeStances(state).filter(
    (stance) =>
      stance.kind === 'boycott' ||
      stance.kind === 'supply_squeeze' ||
      stance.kind === 'rival_backing',
  )
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}
