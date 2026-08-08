import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'

import { EXPEDITIONS_MODULE_ID } from './moduleId'

// Expansion Phase 9 §9.3 — the journey's own record.
//
// WHERE THIS LIVES, AND WHY NOT ON THE EXPEDITION. `state.expeditions` is a
// top-level slice with a Zod schema and a handful of readers — the report,
// the commission form, the stock haul. It holds what an expedition IS: who
// went, what for, how long, what it cost. Widening it with a supply count, a
// morale meter, an event log, a pending question and a dispatch queue would
// have meant a schema change in a top-level branch for bookkeeping that only
// this module reads.
//
// So the run lives in the module slice, exactly as a faction's actor lives
// in the factions slice and an arc's contest lives in the localArcs slice:
// the top-level record is the identity and the summary, the module slice is
// the domain's own working. `expeditionId` is the join, and both are written
// in the same pass so they cannot drift.
//
// THE SEED IS THE INTERESTING PART. §9.3 requires expedition seeds to be
// "stable from commission through resolution", and the run is where that is
// spent: every roll on the journey derives its stream from the `seed` stored
// on the expedition at commission time plus an INDEX that only ever goes up.
// Same commission, same journey — whatever day it is resolved on, whatever
// seed the day is running under, however many times the save is reloaded.

export type ExpeditionPhase = 'outbound' | 'at_site' | 'returning' | 'home'

export type ExpeditionTerminal =
  | 'returned'
  | 'recalled'
  | 'retreated'
  | 'lost'

export type ExpeditionLoadout = {
  provisions: number
  gear: number
  medicine: number
}

export type ExpeditionTermsKind = 'flat_fee' | 'share_of_haul' | 'hazard_bonus'

/**
 * What the party was hired on.
 *
 * §9.3's "contract and compensation terms". The three kinds are genuinely
 * different bets rather than three prices: a flat fee is paid whatever comes
 * back, a share pays only if there is a haul to share, and a hazard bonus is
 * cheap up front and expensive if the going was bad. `settled` is what stops
 * a reload paying anybody twice.
 */
export type ExpeditionTerms = {
  kind: ExpeditionTermsKind
  /** Paid at commission. */
  advanceCoin: number
  /** Owed on return, before any share or bonus. */
  agreedCoin: number
  /** For `share_of_haul`: percent of the haul's value, 0..100. */
  sharePercent: number
  settled: boolean
  settledCoin: number
  /**
   * What the house owed and could not pay.
   *
   * Recorded rather than forgiven. `settled` only ever meant "this has been
   * reckoned once, do not reckon it again across a reload"; paying whatever
   * was in the till and marking the terms settled made an expensive
   * share-of-haul free to anybody who spent the till down before the party
   * walked back through the door, and the difference simply disappeared.
   * The runners remember it, which is what `unpaidCoin` is for.
   */
  unpaidCoin: number
}

export type ExpeditionEventRecord = {
  /** Index in the run's event sequence. Also the RNG stream index. */
  index: number
  eventId: string
  onDay: number
  phase: ExpeditionPhase
  readable: string
  /** Set once the decision is taken, by the player or by the deadline. */
  chosenOptionId?: string
  chosenByDefault?: boolean
}

/** A question the party is waiting on an answer to. */
export type ExpeditionPendingDecision = {
  eventIndex: number
  eventId: string
  prompt: string
  askedOnDay: number
  /** The day the party stops waiting and takes the default. */
  deadlineDay: number
  optionIds: string[]
  defaultOptionId: string
}

/**
 * Word from the road.
 *
 * §9.3's "communication or delayed information". A dispatch is written the
 * day something happens and only becomes readable `arrivesOnDay` later,
 * which is how a route four days out is genuinely darker than one two days
 * out: not more dangerous on paper, just later to tell you about it.
 */
export type ExpeditionDispatch = {
  sentOnDay: number
  arrivesOnDay: number
  readable: string
  kind: 'event' | 'decision' | 'trouble' | 'progress' | 'terminal'
}

export type ExpeditionRun = {
  expeditionId: string
  routeId: string
  /** Every runner on the trip. The commission's `runnerId` leads. */
  partyRunnerIds: string[]
  loadout: ExpeditionLoadout
  terms: ExpeditionTerms
  phase: ExpeditionPhase
  legIndex: number
  legsTotal: number
  dayInLeg: number
  /** Provisions remaining. Running out is how morale and hazard turn. */
  supplies: number
  /**
   * Days the party actually went without.
   *
   * Counted rather than inferred from what is left. A trip that finishes
   * with exactly nothing in the packs was provisioned exactly right, and
   * reading the leftover count instead made that indistinguishable from
   * starving — which put a perfect trip and a badly-supplied one in the same
   * outcome band, and made `success` unreachable on any route where the
   * default loadout was the right one.
   */
  hungryDays: number
  medicine: number
  morale: number
  /** 0..100. The loss ladder reads this, not a flat per-trip chance. */
  hazard: number
  /** Days added by weather, washouts and the long way round. */
  delayDays: number
  injuredRunnerIds: string[]
  events: ExpeditionEventRecord[]
  pendingDecision?: ExpeditionPendingDecision
  dispatches: ExpeditionDispatch[]
  /** Multiplier on the haul, from the route and from decisions taken. */
  haulBonus: number
  /** Discovery ids this trip brought back. Unlocks future routes. */
  discoveries: string[]
  /**
   * The day the party actually reached the site.
   *
   * Recorded rather than inferred. Whether they got there is the single
   * fact the haul, the discovery and the outcome all turn on, and an
   * earlier draft reconstructed it from the event log and the phase — which
   * was wrong for any trip that reached the site quietly and had nothing
   * happen to it there.
   */
  reachedSiteOnDay?: number
  /**
   * Whether the working day at the site actually turned anything up.
   *
   * §9.3 replaced the single end-of-trip roll with a journey, and an early
   * draft went one step too far: the outcome was read entirely off the
   * road, so WHO went stopped mattering at all. A party that walked the
   * route in one piece succeeded whether it was a master forager or a
   * rookie, which quietly repealed Phase 77's contract that experience,
   * reliability and specialty are read rather than decorative.
   *
   * The search restores it in the one place it belongs — the day they spend
   * looking — and it is the reason `failure` is still a thing that can
   * happen to a party that came home safe. They got there. There was
   * nothing there for them.
   */
  foundAtSite?: boolean
  /** The search's own score, kept so the report can say how close it was. */
  searchScore?: number
  /** The day the house GAVE the order. */
  recalledOnDay?: number
  /**
   * The day the order actually reaches them.
   *
   * Word travels at the route's own speed in both directions. An earlier
   * draft turned the party round on the day the player clicked, which meant
   * a recall outran every message the same route delays — the party skipped
   * four days of outbound hazard on the Underdeep because the house had
   * changed its mind, and the whole point of `wordDelayDays` went with it.
   */
  recallReachesOnDay?: number
  /**
   * The day the party turned back on their OWN decision.
   *
   * Distinct from `recalledOnDay`, and the distinction is the point: §9.3
   * lists retreat and recall separately because they are different stories.
   * One is the house losing its nerve; the other is the party keeping
   * theirs. The record should be able to say which.
   */
  retreatedOnDay?: number
  reliefSentOnDay?: number
  terminal?: ExpeditionTerminal
  /** Coin the party spent on the road, billed to the house on return. */
  roadCosts: number
}

export type ExpeditionTotals = {
  commissioned: number
  returned: number
  recalled: number
  retreated: number
  partiesLost: number
  eventsFired: number
  decisionsAnswered: number
  decisionsDefaulted: number
  reliefsSent: number
  discoveriesMade: number
}

export type ExpeditionsModuleState = {
  runs: Record<string, ExpeditionRun>
  totals: ExpeditionTotals
  /** Discoveries the house knows about. Unlocks routes. §9.3 opportunities. */
  knownDiscoveries: string[]
}

/** Closed runs kept this long, for the report and for what was learned. */
export const CLOSED_RUN_RETENTION_DAYS = 60
/** Hard cap on run records regardless of retention. */
export const MAX_EXPEDITION_RUNS_KEPT = 12
/** Dispatches kept per run. */
export const MAX_DISPATCHES = 12

export function createInitialExpeditionTotals(): ExpeditionTotals {
  return {
    commissioned: 0,
    returned: 0,
    recalled: 0,
    retreated: 0,
    partiesLost: 0,
    eventsFired: 0,
    decisionsAnswered: 0,
    decisionsDefaulted: 0,
    reliefsSent: 0,
    discoveriesMade: 0,
  }
}

export function createInitialExpeditionsModuleState(): ExpeditionsModuleState {
  return {
    runs: {},
    totals: createInitialExpeditionTotals(),
    knownDiscoveries: [],
  }
}

export function normalizeExpeditionsSlice(
  slice: Partial<ExpeditionsModuleState> | undefined,
): ExpeditionsModuleState {
  const base = createInitialExpeditionsModuleState()
  if (!slice) return base
  return {
    runs: slice.runs ?? base.runs,
    totals: { ...base.totals, ...(slice.totals ?? {}) },
    knownDiscoveries: slice.knownDiscoveries ?? base.knownDiscoveries,
  }
}

export function getExpeditionsModuleState(state: {
  modules: Record<string, unknown>
}): ExpeditionsModuleState {
  return normalizeExpeditionsSlice(
    state.modules[EXPEDITIONS_MODULE_ID] as
      | Partial<ExpeditionsModuleState>
      | undefined,
  )
}

export function getExpeditionRun(
  state: TavernState,
  expeditionId: string,
): ExpeditionRun | undefined {
  return getExpeditionsModuleState(state).runs[expeditionId]
}

/** Runs still on the road, in a stable order. */
export function liveExpeditionRuns(state: TavernState): ExpeditionRun[] {
  return Object.values(getExpeditionsModuleState(state).runs)
    .filter((run) => run.terminal === undefined)
    .sort((a, b) => a.expeditionId.localeCompare(b.expeditionId))
}

export function writeExpeditionsSlice(
  ctx: SimContext,
  updater: (current: ExpeditionsModuleState) => ExpeditionsModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<ExpeditionsModuleState>(
    EXPEDITIONS_MODULE_ID,
    (current) => updater(normalizeExpeditionsSlice(current)),
    { source: `${EXPEDITIONS_MODULE_ID}.${reason}`, reason },
  )
}

export function writeExpeditionRun(
  ctx: SimContext,
  expeditionId: string,
  updater: (current: ExpeditionRun) => ExpeditionRun,
  reason: string,
): void {
  writeExpeditionsSlice(
    ctx,
    (current) => {
      const run = current.runs[expeditionId]
      if (!run) return current
      return { ...current, runs: { ...current.runs, [expeditionId]: updater(run) } }
    },
    reason,
  )
}

export function openExpeditionRun(ctx: SimContext, run: ExpeditionRun): void {
  writeExpeditionsSlice(
    ctx,
    (current) => ({
      ...current,
      runs: { ...current.runs, [run.expeditionId]: run },
      totals: {
        ...createInitialExpeditionTotals(),
        ...current.totals,
        commissioned: (current.totals.commissioned ?? 0) + 1,
      },
    }),
    'commission',
  )
}

export function bumpExpeditionTotal(
  ctx: SimContext,
  key: keyof ExpeditionTotals,
  by = 1,
): void {
  if (by === 0) return
  writeExpeditionsSlice(
    ctx,
    (current) => ({
      ...current,
      totals: {
        ...createInitialExpeditionTotals(),
        ...current.totals,
        [key]: (current.totals[key] ?? 0) + by,
      },
    }),
    'totals',
  )
}

/** Record a discovery the house now knows about. Unlocks routes. */
export function noteDiscovery(ctx: SimContext, discoveryId: string): boolean {
  const known = getExpeditionsModuleState(ctx.state).knownDiscoveries
  if (known.includes(discoveryId)) return false
  writeExpeditionsSlice(
    ctx,
    (current) => ({
      ...current,
      knownDiscoveries: [...new Set([...current.knownDiscoveries, discoveryId])].sort(),
    }),
    'discovery',
  )
  bumpExpeditionTotal(ctx, 'discoveriesMade')
  return true
}

/** Word the house has actually received by `today`. */
export function arrivedDispatches(
  run: ExpeditionRun,
  today: number,
): ExpeditionDispatch[] {
  return run.dispatches.filter((dispatch) => dispatch.arrivesOnDay <= today)
}

/** Word still on its way. The player knows something is coming, not what. */
export function dispatchesInTransit(
  run: ExpeditionRun,
  today: number,
): ExpeditionDispatch[] {
  return run.dispatches.filter((dispatch) => dispatch.arrivesOnDay > today)
}

// ---------------------------------------------------------------------------
// §5.11 bounded growth
// ---------------------------------------------------------------------------

export function pruneExpeditionRuns(
  runs: Record<string, ExpeditionRun>,
  today: number,
  closedOnDayFor: (run: ExpeditionRun) => number | undefined,
): Record<string, ExpeditionRun> {
  const live: ExpeditionRun[] = []
  const closed: Array<{ run: ExpeditionRun; day: number }> = []
  for (const run of Object.values(runs)) {
    if (run.terminal === undefined) {
      live.push(run)
      continue
    }
    const day = closedOnDayFor(run) ?? 0
    if (today - day > CLOSED_RUN_RETENTION_DAYS) continue
    closed.push({ run, day })
  }
  closed.sort((a, b) => a.day - b.day)
  const room = Math.max(0, MAX_EXPEDITION_RUNS_KEPT - live.length)
  const kept = closed.slice(Math.max(0, closed.length - room)).map((e) => e.run)

  const out: Record<string, ExpeditionRun> = {}
  for (const run of [...live, ...kept].sort((a, b) =>
    a.expeditionId.localeCompare(b.expeditionId),
  )) {
    out[run.expeditionId] = run
  }
  return out
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const LoadoutSchema = z.object({
  provisions: z.number(),
  gear: z.number(),
  medicine: z.number(),
})

const TermsSchema = z.object({
  kind: z.enum(['flat_fee', 'share_of_haul', 'hazard_bonus']),
  advanceCoin: z.number(),
  agreedCoin: z.number(),
  sharePercent: z.number(),
  settled: z.boolean(),
  settledCoin: z.number(),
  unpaidCoin: z.number().optional(),
})

const EventRecordSchema = z.object({
  index: z.number().int(),
  eventId: z.string(),
  onDay: z.number().int(),
  phase: z.enum(['outbound', 'at_site', 'returning', 'home']),
  readable: z.string(),
  chosenOptionId: z.string().optional(),
  chosenByDefault: z.boolean().optional(),
})

const PendingDecisionSchema = z.object({
  eventIndex: z.number().int(),
  eventId: z.string(),
  prompt: z.string(),
  askedOnDay: z.number().int(),
  deadlineDay: z.number().int(),
  optionIds: z.array(z.string()),
  defaultOptionId: z.string(),
})

const DispatchSchema = z.object({
  sentOnDay: z.number().int(),
  arrivesOnDay: z.number().int(),
  readable: z.string(),
  kind: z.enum(['event', 'decision', 'trouble', 'progress', 'terminal']),
})

export const ExpeditionRunSchema = z.object({
  expeditionId: z.string(),
  routeId: z.string(),
  partyRunnerIds: z.array(z.string()),
  loadout: LoadoutSchema,
  terms: TermsSchema,
  phase: z.enum(['outbound', 'at_site', 'returning', 'home']),
  legIndex: z.number().int(),
  legsTotal: z.number().int(),
  dayInLeg: z.number().int(),
  supplies: z.number(),
  hungryDays: z.number(),
  medicine: z.number(),
  morale: z.number(),
  hazard: z.number(),
  delayDays: z.number(),
  injuredRunnerIds: z.array(z.string()),
  events: z.array(EventRecordSchema),
  pendingDecision: PendingDecisionSchema.optional(),
  dispatches: z.array(DispatchSchema),
  haulBonus: z.number(),
  discoveries: z.array(z.string()),
  reachedSiteOnDay: z.number().int().optional(),
  foundAtSite: z.boolean().optional(),
  searchScore: z.number().optional(),
  recalledOnDay: z.number().int().optional(),
  recallReachesOnDay: z.number().int().optional(),
  retreatedOnDay: z.number().int().optional(),
  reliefSentOnDay: z.number().int().optional(),
  terminal: z.enum(['returned', 'recalled', 'retreated', 'lost']).optional(),
  roadCosts: z.number(),
})

export const ExpeditionsModuleStateSchema = z.object({
  runs: z.record(z.string(), ExpeditionRunSchema),
  totals: z.object({
    commissioned: z.number(),
    returned: z.number(),
    recalled: z.number(),
    retreated: z.number(),
    partiesLost: z.number(),
    eventsFired: z.number(),
    decisionsAnswered: z.number(),
    decisionsDefaulted: z.number(),
    reliefsSent: z.number(),
    discoveriesMade: z.number(),
  }),
  knownDiscoveries: z.array(z.string()),
})
