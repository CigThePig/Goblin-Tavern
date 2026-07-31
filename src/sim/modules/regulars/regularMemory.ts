import type { SimContext } from '../../core/context'
import type {
  RegularServiceMemoryEntry,
  RegularWorldState,
  TavernState,
} from '../../state/TavernState'
import { MAX_REGULAR_SERVICE_MEMORY } from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'

// Expansion Phase 4 §4.3 "remember service and incidents".
//
// WHAT WAS MISSING. `knownIncidentIds` was the only thing a regular remembered,
// it was written by the scene builder, and nothing read it back into a decision.
// So a regular who had been left standing every night for a week arrived on the
// eighth night exactly as willing as on the first — their `irritation` drifted
// up when they DIDN'T come, which is backwards.
//
// WHAT THIS IS. A short, signed, dated log of things that actually happened to
// this person here, capped at `MAX_REGULAR_SERVICE_MEMORY` entries (§5.11). It
// is read by `visitProbability` and by the request/grudge resolvers, so it is a
// decision input rather than a caption — plan §4.2's "beliefs and attribution
// must alter decisions, not only generate explanation", at the smallest scale
// the game has.
//
// THE WEIGHTS ARE THE MEMORY. Recency matters (an entry's pull halves over a
// fortnight) but the sign and size come from what happened: being served your
// usual is a small good thing, walking out after an hour is a large bad one.

const SOURCE = 'regulars.memory'

/** Days over which a memory's pull halves. */
const MEMORY_HALF_LIFE = 14

/** Standard weights, so two call sites cannot disagree about what a night was worth. */
export const MEMORY_WEIGHTS: Record<RegularServiceMemoryEntry['kind'], number> = {
  served_favourite: 3,
  good_service: 2,
  waited: -2,
  abandoned: -5,
  turned_away: -6,
  shortage: -3,
  incident: -4,
  tab_forgiven: 6,
  tab_chased: -3,
  request_granted: 5,
  request_ignored: -4,
}

export function readServiceMemory(
  regular: RegularWorldState,
): RegularServiceMemoryEntry[] {
  return regular.serviceMemory ?? []
}

/**
 * Net feeling, decayed by age.
 *
 * Positive means this house has been treating them well lately. The scale is
 * deliberately unbounded-ish rather than a 0–100 meter: it is evidence, and it
 * gets converted into a probability at the point of use.
 */
export function serviceMemoryScore(
  regular: RegularWorldState,
  today: number,
): number {
  let score = 0
  for (const entry of readServiceMemory(regular)) {
    const age = Math.max(0, today - entry.onDay)
    score += entry.weight * Math.pow(0.5, age / MEMORY_HALF_LIFE)
  }
  return Math.round(score * 100) / 100
}

/** Has this regular got a live memory of this kind inside `withinDays`? */
export function hasRecentMemory(
  regular: RegularWorldState,
  kind: RegularServiceMemoryEntry['kind'],
  today: number,
  withinDays: number,
): boolean {
  return readServiceMemory(regular).some(
    (entry) => entry.kind === kind && today - entry.onDay <= withinDays,
  )
}

export type RememberInput = {
  kind: RegularServiceMemoryEntry['kind']
  readable: string
  /** Override the standard weight when the event was unusually large or small. */
  weight?: number
  /** Meter movement that goes with it. Omitted fields are derived from weight. */
  loyaltyDelta?: number
  irritationDelta?: number
  standingDelta?: number
}

/**
 * Record something that happened to a regular, and move the meters with it.
 *
 * One writer for both halves on purpose: a memory with no meter movement is a
 * caption, and a meter movement with no memory is the untraceable nudge §4.2
 * exists to remove. This is the only place either changes during service.
 */
export function rememberService(
  ctx: SimContext,
  regular: RegularWorldState,
  input: RememberInput,
): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const weight = input.weight ?? MEMORY_WEIGHTS[input.kind]
  const entry: RegularServiceMemoryEntry = {
    onDay: today,
    kind: input.kind,
    weight,
    readable: input.readable,
  }
  // §5.11 — newest kept, oldest dropped.
  const memory = [...readServiceMemory(regular), entry].slice(
    -MAX_REGULAR_SERVICE_MEMORY,
  )

  // Derived movement: a good night lifts loyalty a little and settles
  // irritation; a bad one does the reverse. Explicit deltas win when the caller
  // knows better (a forgiven slate is worth more standing than loyalty).
  const loyaltyDelta =
    input.loyaltyDelta ?? Math.round(Math.max(-4, Math.min(4, weight / 2)))
  const irritationDelta =
    input.irritationDelta ?? Math.round(Math.max(-6, Math.min(8, -weight)))
  const standingDelta = input.standingDelta ?? 0

  const nextLoyalty = clampPercent(regular.loyalty + loyaltyDelta)
  const nextIrritation = clampPercent(regular.irritation + irritationDelta)
  const nextStanding = clampPercent((regular.ownerStanding ?? 50) + standingDelta)

  ctx.modifyRegular(
    regular.id,
    {
      serviceMemory: memory,
      loyalty: nextLoyalty,
      irritation: nextIrritation,
      ownerStanding: nextStanding,
    },
    {
      source: `${SOURCE}.${input.kind}`,
      sourceType: 'regular',
      target: regular.id,
      targetType: 'regular',
      amount: weight,
      readable: input.readable,
      tags: ['regular', 'memory', input.kind, regular.customerGroupId],
      relatedActors: [{ kind: 'regular', id: regular.id }],
      relatedSystems: ['regulars', 'service'],
    },
  )
}

/** Every regular who is currently refusing to come in. */
export function listLapsedRegulars(state: TavernState): RegularWorldState[] {
  return Object.values(state.world.regulars)
    .filter((regular) => regular.stoppedVisiting !== undefined)
    .sort((a, b) => a.id.localeCompare(b.id))
}
