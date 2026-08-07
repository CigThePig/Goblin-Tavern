import type { ActorState } from '../../contracts/actors/index'
import type { FactionActionId } from '../../content/factions/factionTypes'

// Phase 27 §27.4 — Faction module type surface.
//
// Expansion Phase 8 §8.1 fills it. Before this phase the slice was
// `Record<string, never>`: the faction layer had nowhere to keep anything,
// which is why its entire behaviour was a ±1 nudge on a meter driven off a
// pressure threshold. Everything a faction needs in order to ACT — what it
// remembers, what it is currently doing, what it has asked for, what it is
// owed — lives here, in the factions slice, because the actor IS the
// faction (see `contracts/actors/index.ts` on why there is no actor slice).

/** Why a faction thinks better or worse of the tavern. One recorded event. */
export type FactionStandingEntry = {
  id: string
  onDay: number
  kind: 'favour' | 'grievance'
  /** 1..40. Decays with age; see `standing.ts`. */
  weight: number
  readable: string
  tags: string[]
}

/**
 * §8.1's "memory of treatment".
 *
 * A faction's opinion is a SUMMARY of these entries rather than a number
 * that drifted there, which is the difference the plan asks for: `net` can
 * always be explained by naming the entries behind it, and an entry ages
 * out rather than being permanent.
 */
export type FactionStanding = {
  factionId: string
  entries: FactionStandingEntry[]
  /** -100..100. Derived from `entries` every day; never written directly. */
  net: number
  lastUpdatedOnDay: number
}

/**
 * A live faction commitment — the thing a faction is currently DOING.
 *
 * Stances are the mechanism behind §8.1's "commitments and cooldowns": a
 * faction that calls a boycott is committed to it for a bounded window, the
 * window is visible, and the player can contest it. Every stance has an end
 * day, which is also how the collection stays bounded (§5.11).
 */
export type FactionStanceKind =
  | 'support'
  | 'boycott'
  | 'protection'
  | 'supply_squeeze'
  | 'rival_backing'

export type FactionStance = {
  /** `${factionId}:${kind}` — one of each kind per faction at a time. */
  id: string
  factionId: string
  kind: FactionStanceKind
  /** 1..100. How hard the faction is leaning. */
  strength: number
  startedOnDay: number
  endsOnDay: number
  reason: string
  goalId: string
  /** Set when the player has argued it down; a stance may be contested once. */
  contestedOnDay?: number
}

/** What a faction is asking for. Answerable, with a deadline. */
export type FactionDemandKind =
  /** Hand over coin — a levy, a subscription, a contribution to the fund. */
  | 'coin_contribution'
  /** Be seen to take their side — a faction night inside the window. */
  | 'public_backing'

export type FactionDemandStatus = 'open' | 'granted' | 'refused' | 'lapsed'

export type FactionDemand = {
  id: string
  factionId: string
  kind: FactionDemandKind
  /** Coin asked for. Zero for `public_backing`. */
  askCoin: number
  openedOnDay: number
  dueOnDay: number
  status: FactionDemandStatus
  readable: string
  goalId: string
  /** Set when it closed, so the report can say when and how. */
  closedOnDay?: number
}

/** A sponsorship the tavern took, and the favour that came with it. */
export type FactionFavourStatus = 'owed' | 'repaid' | 'called_in'

export type FactionFavour = {
  id: string
  factionId: string
  /** Coin (or coin-equivalent goods) the faction put in. */
  grantedValue: number
  openedOnDay: number
  dueOnDay: number
  status: FactionFavourStatus
  readable: string
  closedOnDay?: number
}

/** One faction move, for the report and for the bounded history. */
export type FactionMoveEntry = {
  onDay: number
  factionId: string
  actionId: FactionActionId
  goalId: string
  result: 'succeeded' | 'failed' | 'partial'
  readable: string
}

export type FactionTotals = {
  movesMade: number
  demandsMade: number
  demandsGranted: number
  demandsRefused: number
  demandsLapsed: number
  boycottsCalled: number
  boycottsEnded: number
  supportPledged: number
  sponsorshipsGiven: number
  favoursRepaid: number
  favoursCalledIn: number
  inspectionsPressed: number
  stancesContested: number
}

export type FactionModuleState = {
  /** Per-faction actor record: budget, goals, beliefs, cooldowns, intent, history. */
  actors: Record<string, ActorState>
  /** Per-faction memory of treatment. */
  standing: Record<string, FactionStanding>
  /** Live commitments, keyed `${factionId}:${kind}`. */
  stances: Record<string, FactionStance>
  /** Live and recently-closed requests, keyed by demand id. Pruned. */
  demands: Record<string, FactionDemand>
  /** Sponsorship debts, keyed by favour id. Pruned. */
  favours: Record<string, FactionFavour>
  /** Bounded record of moves made, newest last. */
  moveHistory: FactionMoveEntry[]
  /** Moves made today. Rebuilt each day; read by the report. */
  movesToday: FactionMoveEntry[]
  totals: FactionTotals
}
