import type { ActorState } from '../../contracts/actors/index'

// Expansion Phase 8 §8.3 — notable NPCs and actor memory.
//
// WHAT EXISTS TODAY. Nine notable NPCs are seeded at day zero from
// `content/npc/notableNpcProfiles.ts`, each anchored to a faction. A record
// is a name, a kind, three optional links and a `tags` array. Nothing ever
// writes one — not even `lastSeenDay`, which is declared and never set. They
// are referenced by issue-seed generators and cause targets, so they appear
// in the game's text without ever having done anything in it.
//
// THE CONSTRAINT §8.3 PUTS ON THE FIX. "Do not promote every generated name
// into a full agent. Use importance and repeated interaction thresholds."
// That is the spine of this design, not a footnote: a world where every
// named person is an agent is both unaffordable to simulate and unreadable
// to play. So there are two tiers.
//
//   TIER 1 — a KNOWN NPC. Everybody in `world.notableNpcs`. Carries a record
//   here the moment the tavern first deals with them: what they have done
//   with the house, how they feel about the owner, when they are about, and
//   what they have to work with. Cheap, and enough to explain them.
//
//   TIER 2 — a PROMOTED NPC. Someone the tavern deals with repeatedly AND
//   who matters to something live — the watch inspector while a case is
//   open, the creditor while a loan is outstanding. Only these get an
//   `ActorState` and take turns. Promotion is earned, reversible, and capped.
//
// The thresholds are in `npcState.ts` and the promotion rule is in
// `importance.ts`, so "why is this person an agent" always has an answer.

/** One dealing between the house and an NPC. §8.3's repeated interaction. */
export type NpcInteractionEntry = {
  onDay: number
  /** What happened, in the NPC's terms. */
  kind: NpcInteractionKind
  readable: string
  /** Positive when it went well for the relationship, negative when badly. */
  weight: number
}

export type NpcInteractionKind =
  /** They were in the room. */
  | 'visit'
  /** The house answered something their faction asked for. */
  | 'faction_dealing'
  /** They ran, or sat in on, an inspection. */
  | 'regulatory_dealing'
  /** Goods or credit moved between them. */
  | 'trade_dealing'
  /** The owner sought them out. */
  | 'cultivated'
  /** They asked the house for something. */
  | 'asked'
  /** The house answered — or did not. */
  | 'answered'
  | 'refused'

/** What an NPC has to work with. §8.3's "relevant possessions/resources". */
export type NpcResources = {
  /** Coin they can put behind something. */
  coin: number
  /** Sway inside their own faction, 0..100. */
  standing: number
  /** Goods they can get hold of, by stock id. */
  goods: string[]
  /** Favours the house owes them. */
  favoursOwed: number
}

/**
 * When this person is about. §8.3's "schedule or availability".
 *
 * Deliberately coarse — an NPC is not on the service clock, they are either
 * findable today or not. The pattern is a property of the ROLE (a market
 * factor comes on market days; a smuggler comes at night), so the player can
 * learn when to look for somebody.
 */
export type NpcAvailabilityPattern =
  | 'most_days'
  | 'market_days'
  | 'paydays'
  | 'nights'
  | 'by_arrangement'

export type NpcAvailability = {
  pattern: NpcAvailabilityPattern
  /** The last day they were actually about. */
  lastAboutOnDay?: number
  /** The next day the pattern says they will be. */
  nextExpectedDay?: number
}

/** How an NPC feels about somebody else in the world. */
export type NpcRelationship = {
  /** `staff:<id>`, `notable_npc:<id>`, `faction:<id>`, `regular:<id>`. */
  withRef: { kind: string; id: string }
  /** -100..100. */
  affinity: number
  readable: string
  lastChangedOnDay: number
}

/** A live offer or request from an NPC, answerable by the player. */
export type NpcProposalKind =
  /** They will supply something, on terms. */
  | 'supply_offer'
  /** They will put coin in, expecting it back. */
  | 'credit_offer'
  /** They want a favour returned. */
  | 'favour_request'
  /** They want the house to back them with their faction. */
  | 'backing_request'

export type NpcProposalStatus = 'open' | 'accepted' | 'declined' | 'lapsed'

export type NpcProposal = {
  id: string
  npcId: string
  kind: NpcProposalKind
  /** Coin the house pays (positive) or receives (negative). */
  coin: number
  /** Stock the offer is about, when it is about stock. */
  stockId?: string
  units?: number
  openedOnDay: number
  dueOnDay: number
  status: NpcProposalStatus
  readable: string
  closedOnDay?: number
}

/** One NPC move, for the report and the bounded history. */
export type NpcMoveEntry = {
  onDay: number
  npcId: string
  actionId: string
  goalId: string
  result: 'succeeded' | 'failed' | 'partial'
  readable: string
}

export type NpcRecord = {
  npcId: string
  /** Bounded, decaying record of dealings. */
  interactions: NpcInteractionEntry[]
  /** Lifetime count — the repeated-interaction threshold reads this. */
  interactionCount: number
  /** 0..100, derived daily. See `importance.ts`. */
  importance: number
  /** Whether this NPC currently takes turns. */
  promoted: boolean
  promotedOnDay?: number
  /** Why they were promoted, so the report can say. */
  promotionReason?: string
  /** -100..100. How they feel about the owner specifically. */
  ownerStanding: number
  relationships: NpcRelationship[]
  availability: NpcAvailability
  resources: NpcResources
  lastUpdatedOnDay: number
}

export type NpcTotals = {
  promoted: number
  demoted: number
  visitsMade: number
  proposalsMade: number
  proposalsAccepted: number
  proposalsDeclined: number
  proposalsLapsed: number
  wordsPutIn: number
  reportsToWatch: number
  favoursCalled: number
  movesMade: number
}

export type NpcModuleState = {
  /** Everyone the house has dealt with. Tier 1. */
  records: Record<string, NpcRecord>
  /** Only the promoted. Tier 2. */
  actors: Record<string, ActorState>
  /** Live and recently-closed proposals. Pruned. */
  proposals: Record<string, NpcProposal>
  /** Bounded record of moves made, newest last. */
  moveHistory: NpcMoveEntry[]
  /** Moves made today. Rebuilt each day; read by the report. */
  movesToday: NpcMoveEntry[]
  /** Who was about today, in id order. Rebuilt each day. */
  aboutToday: string[]
  totals: NpcTotals
}
