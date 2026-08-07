import type { SimContext } from '../../core/context'
import type { EntityRef, TavernState } from '../../state/TavernState'

import { getAttributionModuleState } from './attributionQueries'
import {
  BELIEF_ACTING_THRESHOLD,
  PUBLIC_BELIEF_THRESHOLD,
  houseRef,
} from './beliefInputs'
import type {
  AttributionState,
  BeliefActingRecord,
  BeliefBehaviourState,
} from './attributionTypes'

// Expansion Phase 8 §8.5 — the record of what belief is actually doing.
//
// Every consumer in this phase reads beliefs through `beliefInputs.ts` and
// applies its own cap. That keeps each domain honest but leaves the player
// with no way to see the shape of it: a supplier quotes 4% higher, a group
// sends five fewer people, a regular stays home, and nothing anywhere says
// "because of what they think of you".
//
// So the module derives, once a day, WHICH beliefs are heavy enough to be
// acting and WHOSE decisions they reach. Derived rather than accumulated:
// the alternative is each consumer writing a line when it applies an effect,
// which would mean pure decision rules taking a `ctx` they do not need, a
// preview of a quote recording an effect that never happened, and a
// double-count on the segmented route.

/** Live acting beliefs kept. Strongest first; the rest are still believed. */
export const MAX_ACTING_BELIEFS = 12
/** Acting beliefs remembered after they stop acting. */
export const MAX_BELIEF_HISTORY = 40

export function createInitialBeliefBehaviour(): BeliefBehaviourState {
  return { acting: [], history: [], totals: { everActed: 0, answered: 0, refusedAsTrue: 0 } }
}

export function normalizeBeliefBehaviour(
  slice: Partial<BeliefBehaviourState> | undefined,
): BeliefBehaviourState {
  const base = createInitialBeliefBehaviour()
  if (!slice) return base
  return {
    acting: slice.acting ?? base.acting,
    history: slice.history ?? base.history,
    totals: { ...base.totals, ...(slice.totals ?? {}) },
  }
}

/**
 * The domain rules that read a belief held by this kind of entity.
 *
 * This is a MAP of the phase's own wiring rather than a guess: every id here
 * names a consumer that exists in this commit, and a holder kind nothing
 * reads yields an empty list and is therefore not recorded as acting. If a
 * later phase teaches another domain to read beliefs, it belongs here too —
 * otherwise the report would under-report what belief is costing.
 */
export function domainsReading(holder: EntityRef, publicness = 0): string[] {
  // Anything being said out loud reaches the landlord, who has no dealings
  // with the tavern's customers or staff but does hear about its tenant.
  const public_ =
    publicness >= PUBLIC_BELIEF_THRESHOLD ? ['landlord_terms'] : []
  switch (holder.kind) {
    case 'supplier':
      return ['supplier_quote', 'supplier_credit', ...public_]
    case 'customer_group':
      return ['customer_forecast', ...public_]
    case 'regular':
      return ['regular_visits', ...public_]
    case 'staff':
      return ['staff_quit_risk', ...public_]
    case 'faction':
      return holder.id === 'town_watch'
        ? ['faction_moves', 'watch_inspection', ...public_]
        : ['faction_moves', ...public_]
    default:
      return public_
  }
}

function weigh(attribution: AttributionState): number {
  const raw = (attribution.strength / 100) * (attribution.confidence / 100)
  return Math.max(0, Math.min(1, Math.round(raw * 1000) / 1000))
}

function directionOf(
  attribution: AttributionState,
): 'against' | 'toward' | undefined {
  switch (attribution.attributionType) {
    case 'blame':
    case 'resentment':
    case 'suspicion':
    case 'distrust':
      return 'against'
    case 'credit':
    case 'gratitude':
    case 'trust':
      return 'toward'
    default:
      return undefined
  }
}

/**
 * Which beliefs about the house are acting today.
 *
 * Only beliefs ABOUT THE HOUSE are recorded: those are the ones this phase's
 * six consumers read, and listing a supplier's opinion of a rival as "acting"
 * would claim a consequence no rule owns.
 */
export function deriveActingBeliefs(
  state: TavernState,
  previous: ReadonlyArray<BeliefActingRecord>,
): BeliefActingRecord[] {
  const slice = getAttributionModuleState(state)
  if (!slice) return []
  const house = houseRef(state)
  const today = state.calendar.totalDaysElapsed
  const since = new Map(previous.map((row) => [row.attributionId, row.sinceDay]))

  const rows: BeliefActingRecord[] = []
  for (const attribution of slice.attributions) {
    if (attribution.target.kind !== house.kind || attribution.target.id !== house.id) {
      continue
    }
    const direction = directionOf(attribution)
    if (!direction) continue
    const weight = weigh(attribution)
    if (weight < BELIEF_ACTING_THRESHOLD) continue
    const domains = domainsReading(attribution.perceivedBy, attribution.publicness)
    if (domains.length === 0) continue
    rows.push({
      attributionId: attribution.id,
      holder: { ...attribution.perceivedBy },
      subject: { ...attribution.target },
      direction,
      weight,
      domains,
      readable: attribution.readable,
      sinceDay: since.get(attribution.id) ?? today,
    })
  }

  // Strongest first, ties on id so a reload cannot reorder the list.
  rows.sort((a, b) => b.weight - a.weight || a.attributionId.localeCompare(b.attributionId))
  return rows.slice(0, MAX_ACTING_BELIEFS)
}

/** Fold today's derivation into the stored record. */
export function nextBeliefBehaviour(
  state: TavernState,
  current: BeliefBehaviourState,
): BeliefBehaviourState {
  const acting = deriveActingBeliefs(state, current.acting)
  const knownIds = new Set(current.history.map((row) => row.attributionId))
  const newlyActing = acting.filter((row) => !knownIds.has(row.attributionId))
  const history = [...current.history, ...newlyActing].slice(-MAX_BELIEF_HISTORY)
  if (
    acting.length === current.acting.length &&
    newlyActing.length === 0 &&
    acting.every((row, i) => {
      const before = current.acting[i]
      return before && before.attributionId === row.attributionId && before.weight === row.weight
    })
  ) {
    return current
  }
  return {
    acting,
    history,
    totals: {
      ...current.totals,
      everActed: current.totals.everActed + newlyActing.length,
    },
  }
}

/** The beliefs currently changing somebody's decisions. */
export function actingBeliefs(state: TavernState): ReadonlyArray<BeliefActingRecord> {
  const slice = getAttributionModuleState(state)
  return normalizeBeliefBehaviour(slice?.behaviour).acting
}

/** …and the ones reaching a particular domain rule. */
export function actingBeliefsFor(
  state: TavernState,
  domainId: string,
): ReadonlyArray<BeliefActingRecord> {
  return actingBeliefs(state).filter((row) => row.domains.includes(domainId))
}

export function bumpBeliefTotal(
  ctx: SimContext,
  key: keyof BeliefBehaviourState['totals'],
  by = 1,
): void {
  ctx.modifyModuleState<{ behaviour?: Partial<BeliefBehaviourState> }>(
    'attribution',
    (current) => {
      const behaviour = normalizeBeliefBehaviour(current?.behaviour)
      return {
        ...(current ?? {}),
        behaviour: {
          ...behaviour,
          totals: { ...behaviour.totals, [key]: behaviour.totals[key] + by },
        },
      }
    },
    { source: 'attribution', reason: `belief_total_${String(key)}` },
  )
}
