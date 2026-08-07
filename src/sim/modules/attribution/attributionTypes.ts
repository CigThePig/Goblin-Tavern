import type { CalendarStamp, EntityRef } from '../../state/TavernState'

// Phase 37 §37.2 — Attribution types.
//
// Phase 17 causes record what *actually* changed. Phase 37 attributions
// record what people *think* happened: who blames whom, who feels
// grateful, which suspicions are spreading even when they are wrong.
// The two systems coexist — causes feed the rules that produce
// attributions, but the attribution layer is free to be partial, false,
// or unknown.

export type AttributionType =
  | 'credit'
  | 'blame'
  | 'suspicion'
  | 'gratitude'
  | 'resentment'
  | 'trust'
  | 'distrust'

export type AttributionAccuracy =
  | 'true'
  | 'partial'
  | 'false'
  | 'unknown'

export type AttributionState = {
  id: string
  timestamp: CalendarStamp
  sourceEventId?: string
  sourceCauseIds: string[]
  sourceMemoryIds: string[]
  sourceSceneIds: string[]

  perceivedBy: EntityRef
  target: EntityRef
  attributionType: AttributionType
  accuracy: AttributionAccuracy

  /** How emotionally/mechanically important the belief is (0–100). */
  strength: number
  /** How certain the perceiver feels (0–100). */
  confidence: number
  /** How likely it is to spread (0–100). */
  publicness: number
  /** How likely it is to flip, escalate, or decay irregularly (0–100). */
  volatility: number

  readable: string
  tags: string[]
  relatedSystems: string[]

  ageDays: number
  expiresAfterDays?: number
}

export type AttributionDraft = {
  perceivedBy: EntityRef
  target: EntityRef
  attributionType: AttributionType
  accuracy?: AttributionAccuracy
  readable: string
  strength?: number
  confidence?: number
  publicness?: number
  volatility?: number
  tags?: string[]
  relatedSystems?: string[]
  sourceEventId?: string
  sourceCauseIds?: string[]
  sourceMemoryIds?: string[]
  sourceSceneIds?: string[]
  expiresAfterDays?: number
}

// Expansion Phase 8 §8.5 — what belief is currently DOING.
//
// The behaviour record answers a question the attribution list cannot: of
// the beliefs alive in the world, which ones are heavy enough to be changing
// a decision right now, and whose decision. It is derived at the end of each
// day from the live beliefs and the domains that read them, so it can never
// disagree with the beliefs it summarises — and it is what the report reads
// instead of re-deriving the same walk.
export type BeliefActingRecord = {
  attributionId: string
  holder: EntityRef
  subject: EntityRef
  direction: 'against' | 'toward'
  /** 0…1, as the shared belief input reports it. */
  weight: number
  /** Ids of the domain rules that read a belief held by this kind of holder. */
  domains: string[]
  readable: string
  /** First day this belief crossed the acting threshold. */
  sinceDay: number
}

export type BeliefBehaviourState = {
  /** Live, strongest first. Capped — see MAX_ACTING_BELIEFS. */
  acting: BeliefActingRecord[]
  /** Beliefs that have acted, newest last. Capped — see MAX_BELIEF_HISTORY. */
  history: BeliefActingRecord[]
  totals: {
    /** Distinct beliefs that have ever crossed the threshold. */
    everActed: number
    /** Times the player has answered one. */
    answered: number
    /** Times an answer was refused because the belief was TRUE. */
    refusedAsTrue: number
  }
}

export type AttributionModuleState = {
  attributions: AttributionState[]
  /** Ids of attributions added (or merged with) on the current day. */
  generatedToday: string[]
  /** Absolute day stamp of the most recent attribution pass. */
  lastUpdatedDay: number
  /** Last absolute day a `rumour_distorts_cause` draft fired for each rumour id. */
  recentDistrustByRumour: Record<string, number>
  /** Expansion Phase 8 §8.5 — which beliefs are acting, and on whom. */
  behaviour: BeliefBehaviourState
}
