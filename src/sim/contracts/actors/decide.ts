import type { SimContext } from '../../core/context'
import type { EntityRef, TavernState } from '../../state/TavernState'

import {
  MAX_ACTOR_HISTORY,
  type ActorActionDefinition,
  type ActorActionOutcome,
  type ActorCandidate,
  type ActorDecision,
  type ActorPerception,
  type ActorState,
} from './types'

// Expansion Phase 1 §1.6 — the shared decision procedure.
//
// `decideActorAction` is pure: state in, decision out, nothing written. That
// separation matters because it means a report can show what an actor WOULD
// do (the visible-intent surface) without the act of looking changing
// anything — and because a pure decision is trivially testable for
// determinism.
//
// `performActorAction` is the impure half: it spends the budget, sets the
// cooldown and commitment, performs the domain's action, and folds the
// outcome back into the actor's beliefs.

/** A stable string for an actor's target, used for tie-breaking. */
function targetKey(target: unknown): string {
  if (target && typeof target === 'object') {
    const ref = target as Partial<EntityRef>
    if (typeof ref.kind === 'string' && typeof ref.id === 'string') {
      return `${ref.kind}:${ref.id}`
    }
    return JSON.stringify(target)
  }
  return String(target)
}

export type DecideInput<TTarget> = {
  actor: ActorState
  perception: ActorPerception
  actions: ReadonlyArray<ActorActionDefinition<TTarget>>
  state: TavernState
  today: number
}

/**
 * Score every (action × goal × target) the actor could take and pick the
 * best.
 *
 * TIE-BREAKING IS THE INTERESTING PART. Floating-point scores tie far more
 * often than you would guess — two identical rooms, two suppliers with the
 * same standing — and if ties resolved by iteration order, an actor's choice
 * would depend on the order a `Record` happened to enumerate, which is not
 * something a save/reload can be relied upon to preserve. So ties break on
 * an explicit ladder: goal weight, then action id, then target key. All
 * three are stable strings or declared numbers, so the same perceived state
 * always yields the same choice.
 */
export function decideActorAction<TTarget>(
  input: DecideInput<TTarget>,
): { decision: ActorDecision<TTarget>; candidates: ActorCandidate<TTarget>[] } {
  const { actor, perception, actions, state, today } = input

  if (actor.committedUntilDay !== undefined && today <= actor.committedUntilDay) {
    return { decision: { status: 'no_action', reason: 'committed' }, candidates: [] }
  }
  const liveGoals = actor.goals.filter((goal) => goal.weight > 0)
  if (liveGoals.length === 0) {
    return {
      decision: { status: 'no_action', reason: 'no_live_goals' },
      candidates: [],
    }
  }

  const candidates: ActorCandidate<TTarget>[] = []
  let sawAffordable = false
  let sawTarget = false

  // Iterate in declared order and sort explicitly afterwards, rather than
  // relying on the order candidates happen to be produced in.
  for (const action of actions) {
    if (action.cost > actor.budget) continue
    const readyOn = actor.cooldowns[action.id]
    if (readyOn !== undefined && today < readyOn) continue
    sawAffordable = true

    const goals = liveGoals.filter((goal) => action.servesGoals.includes(goal.id))
    if (goals.length === 0) continue

    const targets = action.eligibleTargets(perception, state)
    if (targets.length === 0) continue
    sawTarget = true

    for (const goal of goals) {
      for (const target of targets) {
        const rawScore = action.score({ target, goal, perception, state })
        if (!(rawScore > 0)) continue
        candidates.push({
          actionId: action.id,
          goalId: goal.id,
          target,
          rawScore,
          weightedScore: rawScore * goal.weight,
        })
      }
    }
  }

  if (candidates.length === 0) {
    const reason = !sawAffordable
      ? 'no_affordable_action'
      : !sawTarget
        ? 'no_eligible_target'
        : 'nothing_worth_doing'
    return { decision: { status: 'no_action', reason }, candidates: [] }
  }

  const goalWeight = new Map(liveGoals.map((goal) => [goal.id, goal.weight]))
  const ranked = [...candidates].sort((a, b) => {
    if (b.weightedScore !== a.weightedScore) {
      return b.weightedScore - a.weightedScore
    }
    const weightDelta =
      (goalWeight.get(b.goalId) ?? 0) - (goalWeight.get(a.goalId) ?? 0)
    if (weightDelta !== 0) return weightDelta
    if (a.actionId !== b.actionId) return a.actionId.localeCompare(b.actionId)
    return targetKey(a.target).localeCompare(targetKey(b.target))
  })

  const best = ranked[0]!
  return {
    decision: {
      status: 'decided',
      actionId: best.actionId,
      goalId: best.goalId,
      target: best.target,
      weightedScore: best.weightedScore,
    },
    candidates: ranked,
  }
}

/**
 * Announce a decision without performing it.
 *
 * §1.6 asks for "visible intent or next move". An actor that declares its
 * intent a day before acting is the difference between an autonomous world
 * and an unfair one — the player gets a turn to respond.
 */
export function declareActorIntent<TTarget>(
  actor: ActorState,
  decision: ActorDecision<TTarget>,
  readable: string,
  today: number,
): ActorState {
  if (decision.status !== 'decided') {
    const { intent: _dropped, ...rest } = actor
    return rest
  }
  const targetRef = asEntityRef(decision.target)
  return {
    ...actor,
    intent: {
      actionId: decision.actionId,
      goalId: decision.goalId,
      ...(targetRef ? { targetRef } : {}),
      readable,
      decidedOnDay: today,
    },
  }
}

/**
 * Perform a decided action and fold the result back into the actor.
 *
 * Everything an actor pays for acting happens here in one place: budget
 * spent, cooldown set, commitment taken, intent cleared, outcome and beliefs
 * recorded. A domain that performed the mutation itself and forgot one of
 * these would produce an actor that acts for free or acts twice.
 */
export function performActorAction<TTarget>(
  ctx: SimContext,
  input: {
    actor: ActorState
    action: ActorActionDefinition<TTarget>
    target: TTarget
    goalId: string
  },
): { actor: ActorState; outcome: ActorActionOutcome } {
  const today = ctx.state.calendar.totalDaysElapsed
  const goal =
    input.actor.goals.find((g) => g.id === input.goalId) ??
    input.actor.goals[0]!

  const outcome = input.action.perform(ctx, {
    actor: input.actor,
    target: input.target,
    goal,
  })

  const targetRef = asEntityRef(input.target)
  const record = {
    onDay: today,
    actionId: input.action.id,
    goalId: input.goalId,
    ...(targetRef ? { targetRef } : {}),
    result: outcome.result,
    readable: outcome.readable,
  }

  const { intent: _cleared, ...withoutIntent } = input.actor
  const history = [...input.actor.history, record]

  return {
    actor: {
      ...withoutIntent,
      budget: round2(input.actor.budget - input.action.cost),
      cooldowns: {
        ...input.actor.cooldowns,
        [input.action.id]: today + input.action.cooldownDays,
      },
      ...(input.action.commitmentDays > 0
        ? { committedUntilDay: today + input.action.commitmentDays }
        : {}),
      // Learning: an actor updates what it believes based on what happened.
      // This is the whole difference between an actor and a random walk.
      beliefs: { ...input.actor.beliefs, ...(outcome.learned ?? {}) },
      // §5.11 bounded growth.
      history:
        history.length > MAX_ACTOR_HISTORY
          ? history.slice(history.length - MAX_ACTOR_HISTORY)
          : history,
      lastActedOnDay: today,
    },
    outcome,
  }
}

/** A fresh actor with no history. */
export function createActorState(input: {
  ref: EntityRef
  ownerModuleId: string
  budget: number
  goals: ActorState['goals']
  beliefs?: Record<string, string>
}): ActorState {
  return {
    ref: input.ref,
    ownerModuleId: input.ownerModuleId,
    budget: input.budget,
    goals: input.goals,
    beliefs: input.beliefs ?? {},
    cooldowns: {},
    history: [],
  }
}

function asEntityRef(target: unknown): EntityRef | undefined {
  if (!target || typeof target !== 'object') return undefined
  const ref = target as Partial<EntityRef>
  if (typeof ref.kind === 'string' && typeof ref.id === 'string') {
    return { kind: ref.kind, id: ref.id } as EntityRef
  }
  return undefined
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
