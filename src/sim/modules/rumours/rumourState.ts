import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { SocialRumourState, TavernState } from '../../state/TavernState'

// Expansion Phase 8 §8.4 — the rumour network's own slice.
//
// WHAT THE RUMOUR LAYER WAS. `world.socialRumours` held a bag of records
// with a `strength` and an `accuracy`. The weekly community pass added to
// it, a daily hook multiplied every strength by 0.85, and a monthly hook
// dropped whatever had gone stale. Nothing spread: a rumour appeared at
// full volume in everybody's ears at once and then got quieter. Nobody
// heard it from anybody, nobody believed it more or less than anybody else,
// and it never changed in the telling.
//
// `accuracy` was declared and read by exactly one thing — the pressure
// calculator, which counted false rumours toward a meter. Whether a rumour
// was TRUE made no difference to whether anybody credited it.
//
// This slice holds what propagation needs and the rumour records cannot:
// the per-channel budget that stops one loud voice carrying everything, and
// the day's spread log the report reads.

export const RUMOURS_MODULE_ID = 'rumours'

// -- §5.11 bounded growth, and §8.4's anti-recursion protections ------------
//
// §8.4 asks for "anti-recursion and bounded-growth protections" by name, and
// they are different problems. Bounded growth is about the size of state.
// Anti-recursion is about a rumour feeding itself: A tells B who tells A,
// or a counter-rumour spawning a counter-counter-rumour forever. The three
// hop/audience/counter caps below are the second; the rest are the first.

/** Audiences one rumour can reach. Past this it is simply "everybody". */
export const MAX_RUMOUR_AUDIENCES = 6
/** Times a rumour may be passed on. The hard anti-recursion stop. */
export const MAX_RUMOUR_HOPS = 5
/** A counter-rumour may not itself be countered. Depth stops at one. */
export const MAX_COUNTER_DEPTH = 1
/** New audiences one rumour may reach in a single day. */
export const MAX_SPREAD_PER_RUMOUR_PER_DAY = 2
/** Rumours that may spread at all in a single day, across the whole world. */
export const MAX_SPREADS_PER_DAY = 4
/** Times one channel may carry anything in a week. */
export const MAX_CHANNEL_SHARES_PER_WEEK = 3
/** Bounded log of spreads, for the report and for "who told whom". */
export const MAX_SPREAD_HISTORY = 32

export type RumourSpreadEntry = {
  onDay: number
  rumourId: string
  /** The channel that carried it. */
  fromId: string
  /** The audience that heard it. */
  toId: string
  toKind: string
  /** Belief the audience formed, 0..100. */
  belief: number
  /** How much the telling drifted on this hop. */
  distortionAdded: number
  readable: string
}

export type RumourChannelState = {
  id: string
  lastSharedOnDay: number
  /** Shares inside the current week. Reset on day one. */
  sharesThisWeek: number
}

export type RumourTotals = {
  started: number
  spreads: number
  distorted: number
  contradicted: number
  corrected: number
  fadedOut: number
  pruned: number
  deniedByOwner: number
  counteredByOwner: number
  sourcesNamed: number
}

export type RumourModuleState = {
  channels: Record<string, RumourChannelState>
  spreadToday: RumourSpreadEntry[]
  spreadHistory: RumourSpreadEntry[]
  totals: RumourTotals
}

export function createInitialRumourTotals(): RumourTotals {
  return {
    started: 0,
    spreads: 0,
    distorted: 0,
    contradicted: 0,
    corrected: 0,
    fadedOut: 0,
    pruned: 0,
    deniedByOwner: 0,
    counteredByOwner: 0,
    sourcesNamed: 0,
  }
}

export function createInitialRumourModuleState(): RumourModuleState {
  return {
    channels: {},
    spreadToday: [],
    spreadHistory: [],
    totals: createInitialRumourTotals(),
  }
}

export function normalizeRumourSlice(
  slice: Partial<RumourModuleState> | undefined,
): RumourModuleState {
  const base = createInitialRumourModuleState()
  if (!slice) return base
  return {
    channels: slice.channels ?? base.channels,
    spreadToday: slice.spreadToday ?? base.spreadToday,
    spreadHistory: slice.spreadHistory ?? base.spreadHistory,
    totals: { ...base.totals, ...(slice.totals ?? {}) },
  }
}

export function getRumourModuleState(state: {
  modules: Record<string, unknown>
}): RumourModuleState {
  return normalizeRumourSlice(
    state.modules[RUMOURS_MODULE_ID] as Partial<RumourModuleState> | undefined,
  )
}

export function writeRumourSlice(
  ctx: SimContext,
  updater: (current: RumourModuleState) => RumourModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<RumourModuleState>(
    RUMOURS_MODULE_ID,
    (current) => updater(normalizeRumourSlice(current)),
    { source: `${RUMOURS_MODULE_ID}.${reason}`, reason },
  )
}

export function bumpRumourTotal(
  ctx: SimContext,
  key: keyof RumourTotals,
  by = 1,
): void {
  if (by === 0) return
  writeRumourSlice(
    ctx,
    (current) => ({
      ...current,
      totals: {
        ...createInitialRumourTotals(),
        ...current.totals,
        [key]: (current.totals[key] ?? 0) + by,
      },
    }),
    'totals',
  )
}

// -- readers ----------------------------------------------------------------

/** Every rumour, in a stable order. */
export function listRumours(state: TavernState): SocialRumourState[] {
  return Object.values(state.world.socialRumours).sort((a, b) =>
    a.id.localeCompare(b.id),
  )
}

/** Rumours still being repeated, loudest first. */
export function liveRumours(state: TavernState): SocialRumourState[] {
  return listRumours(state)
    .filter((rumour) => rumour.correctedOnDay === undefined)
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))
}

export function audiencesOf(rumour: SocialRumourState): NonNullable<
  SocialRumourState['audiences']
> {
  return rumour.audiences ?? []
}

/** How much this audience believes this rumour. 0 when they have not heard it. */
export function beliefOf(rumour: SocialRumourState, audienceId: string): number {
  return audiencesOf(rumour).find((entry) => entry.id === audienceId)?.belief ?? 0
}

export function hasHeard(rumour: SocialRumourState, audienceId: string): boolean {
  return audiencesOf(rumour).some((entry) => entry.id === audienceId)
}

/**
 * Everything an audience believes about a subject, as one 0..100 reading.
 *
 * This is the ONLY thing other domains read. §8.5 will widen it; for now it
 * is what makes a rumour matter to a decision rather than to a meter.
 */
export function believedAgainst(
  state: TavernState,
  audienceId: string,
  subjectKind?: string,
): { belief: number; loudest?: SocialRumourState } {
  let worst = 0
  let loudest: SocialRumourState | undefined
  for (const rumour of liveRumours(state)) {
    if (subjectKind && rumour.subject?.kind !== subjectKind) continue
    const belief = beliefOf(rumour, audienceId)
    if (belief <= worst) continue
    worst = belief
    loudest = rumour
  }
  return loudest ? { belief: worst, loudest } : { belief: 0 }
}

// -- schema -----------------------------------------------------------------

const SpreadSchema = z.object({
  onDay: z.number().int(),
  rumourId: z.string(),
  fromId: z.string(),
  toId: z.string(),
  toKind: z.string(),
  belief: z.number(),
  distortionAdded: z.number(),
  readable: z.string(),
})

export const RumourModuleStateSchema = z
  .object({
    channels: z
      .record(
        z.string(),
        z.object({
          id: z.string(),
          lastSharedOnDay: z.number().int(),
          sharesThisWeek: z.number().int(),
        }),
      )
      .default({}),
    spreadToday: z.array(SpreadSchema).default([]),
    spreadHistory: z.array(SpreadSchema).default([]),
    totals: z.record(z.string(), z.number()).default({}),
  })
  .partial()
  .passthrough()
  .optional()
