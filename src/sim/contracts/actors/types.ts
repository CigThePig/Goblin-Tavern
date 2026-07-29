import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { EntityRef, TavernState } from '../../state/TavernState'

// Expansion Phase 1 §1.6 — the actor-action interface.
//
// Six kinds of entity are about to need to ACT rather than drift: factions,
// cultures, suppliers, a rival tavern, notable NPCs, staff, and regulars.
// Today each of them changes by having a number nudged during its update
// hook, which is why the world feels like weather rather than like people —
// nothing has a goal, nothing spends anything to act, and nothing remembers
// whether acting worked.
//
// The plan is emphatic about what this must NOT become: "Do not implement
// generic 'AI' detached from domain rules. Each domain supplies its own
// goals, actions, and scoring." So what lives here is the DECISION
// PROCEDURE and the bookkeeping around it — budget, cooldown, commitment,
// visible intent, outcome, learning. The goals, the action list, and the
// scoring function are supplied by the domain, which is the only place that
// knows what a supplier wants or what a faction can do about it.
//
// Determinism is a hard requirement (architecture rule 5). Scoring is pure,
// ties break on a declared key and then on action id, and nothing here
// touches the RNG — so the same perceived state always yields the same
// decision, on a replay and after a reload alike.

/** What an actor is trying to achieve. Domain-defined. */
export type ActorGoal = {
  id: string
  /** Relative importance, 0..1. Scoring multiplies action fit by this. */
  weight: number
  readable: string
}

/**
 * An actor's own view of the world.
 *
 * Deliberately NOT the full `TavernState`: an actor decides on what it can
 * perceive, and Phase 8's rumour propagation depends on different actors
 * believing different things. Domains build this from the actor's beliefs
 * and whatever they can legitimately observe.
 */
export type ActorPerception = {
  /** Numeric readings the scoring function may use. */
  readings: Record<string, number>
  /** Things the actor holds true, whether or not they are. */
  beliefs: Record<string, string>
  /** Candidate targets the actor can act on. */
  visibleTargets: EntityRef[]
}

export type ActorActionDefinition<TTarget = EntityRef> = {
  id: string
  readable: string
  /** Influence this action spends from the actor's budget. */
  cost: number
  /** Days before this actor may take this action again. */
  cooldownDays: number
  /**
   * Days the actor is committed once it acts. While committed it takes no
   * new actions — which is what stops an actor doing five things a day and
   * makes its behaviour legible.
   */
  commitmentDays: number
  /** Goals this action serves. Scoring only considers actions serving a live goal. */
  servesGoals: ReadonlyArray<string>
  /** Targets this action could apply to, given what the actor perceives. */
  eligibleTargets: (
    perception: ActorPerception,
    state: TavernState,
  ) => ReadonlyArray<TTarget>
  /**
   * How well this action-on-this-target serves this goal, 0..1. Pure: same
   * inputs, same score, no RNG.
   */
  score: (input: {
    target: TTarget
    goal: ActorGoal
    perception: ActorPerception
    state: TavernState
  }) => number
  /**
   * Perform it. The domain mutates state here through the normal `ctx`
   * helpers and returns what happened, so the outcome can be learned from.
   */
  perform: (
    ctx: SimContext,
    input: { actor: ActorState; target: TTarget; goal: ActorGoal },
  ) => ActorActionOutcome
}

export type ActorActionOutcome = {
  /** Did the action achieve what the actor wanted? Drives learning. */
  result: 'succeeded' | 'failed' | 'partial'
  readable: string
  /** What the actor will believe as a result. Merged into `beliefs`. */
  learned?: Record<string, string>
}

/**
 * The persisted per-actor record.
 *
 * `intent` is the visible-next-move the plan asks for: an actor that has
 * decided announces it, so the player can see a supplier is about to
 * renegotiate before it happens. That is what makes an autonomous world
 * fair rather than arbitrary.
 */
export type ActorState = {
  ref: EntityRef
  /** The domain that owns this actor's goals and actions. */
  ownerModuleId: string
  /** Influence available to spend. Domains replenish it on their own cadence. */
  budget: number
  goals: ActorGoal[]
  beliefs: Record<string, string>
  /** `actionId` → the day it may next be used. */
  cooldowns: Record<string, number>
  /** Day the current commitment ends. Absent when free to act. */
  committedUntilDay?: number
  /** The decided-but-not-yet-performed move, announced to the player. */
  intent?: {
    actionId: string
    targetRef?: EntityRef
    goalId: string
    readable: string
    decidedOnDay: number
  }
  /** Bounded record of what this actor has done and how it went. */
  history: ActorActionRecord[]
  lastActedOnDay?: number
}

export type ActorActionRecord = {
  onDay: number
  actionId: string
  goalId: string
  targetRef?: EntityRef
  result: ActorActionOutcome['result']
  readable: string
}

export const MAX_ACTOR_HISTORY = 16

/** A scored candidate, exposed so tests and reports can inspect the ranking. */
export type ActorCandidate<TTarget = EntityRef> = {
  actionId: string
  goalId: string
  target: TTarget
  /** `score × goal.weight`. The ranking key. */
  weightedScore: number
  rawScore: number
  /** Why this candidate was not chosen, when it was rejected outright. */
  rejected?: 'unaffordable' | 'on_cooldown' | 'no_targets' | 'zero_score'
}

export type ActorDecision<TTarget = EntityRef> =
  | {
      status: 'decided'
      actionId: string
      goalId: string
      target: TTarget
      weightedScore: number
    }
  | {
      status: 'no_action'
      /** Always populated. An actor that did nothing must say why. */
      reason:
        | 'committed'
        | 'no_live_goals'
        | 'no_affordable_action'
        | 'no_eligible_target'
        | 'nothing_worth_doing'
    }

export const ActorGoalSchema = z.object({
  id: z.string(),
  weight: z.number().min(0).max(1),
  readable: z.string(),
})

const EntityRefSchema = z.object({ kind: z.string(), id: z.string() })

export const ActorActionRecordSchema = z.object({
  onDay: z.number().int(),
  actionId: z.string(),
  goalId: z.string(),
  targetRef: EntityRefSchema.optional(),
  result: z.enum(['succeeded', 'failed', 'partial']),
  readable: z.string(),
})

export const ActorStateSchema = z.object({
  ref: EntityRefSchema,
  ownerModuleId: z.string(),
  budget: z.number(),
  goals: z.array(ActorGoalSchema),
  beliefs: z.record(z.string(), z.string()),
  cooldowns: z.record(z.string(), z.number().int()),
  committedUntilDay: z.number().int().optional(),
  intent: z
    .object({
      actionId: z.string(),
      targetRef: EntityRefSchema.optional(),
      goalId: z.string(),
      readable: z.string(),
      decidedOnDay: z.number().int(),
    })
    .optional(),
  history: z.array(ActorActionRecordSchema),
  lastActedOnDay: z.number().int().optional(),
})
