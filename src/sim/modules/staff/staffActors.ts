import type { SimContext } from '../../core/context'
import type { StaffState, TavernState } from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import {
  createActorState,
  decideActorAction,
  declareActorIntent,
  performActorAction,
  type ActorActionDefinition,
  type ActorGoal,
  type ActorPerception,
  type ActorState,
} from '../../contracts/actors/index'

import { getStaffModuleState, writeStaffSlice } from './workforceState'
import { totalWageArrears } from './staffWages'
import {
  getOwnerEdge,
  listActiveEdgesFor,
  noteContact,
  ownerTrust,
} from './relationships'
import { crossTrainableRoles, isAtSkillCeiling } from './development'
import { giveNotice } from './employment'
import { getEmployment } from './workforceState'
import { setAbsence } from './roster'
import {
  STAFF_QUIT_RISK_EVENT,
  STAFF_RAISE_DEMAND_EVENT,
  scheduleQuitRisk,
  scheduleRaiseDemand,
} from './staffEvents'

// Expansion Phase 3 §3.3 — staff act, rather than drift.
//
// WHY THROUGH THE SHARED ACTOR CONTRACT. Phase 1 §1.6 built the decision
// procedure precisely so that a domain supplies goals, actions and scoring while
// budget, cooldown, commitment, visible intent and learning are handled once. A
// staff member is the first real consumer, and the contract earns its keep here:
// without a commitment window somebody could ask for a raise, call in sick and
// resign on the same evening, and without visible intent a resignation would
// arrive with no turn in which to answer it.
//
// VISIBLE INTENT IS THE FAIRNESS MECHANISM. An actor decides one evening and acts
// the next, and the decision is announced in between. So the morning a staff
// member is about to hand in their notice, the player is told they are about to —
// and `negotiate_with_staff` is on the board. Without that, autonomy would just
// be an ambush.
//
// GOALS COME FROM THE PERSON. `careerGoal` (derived from identity) sets which
// goal carries the most weight, and the live state sets whether it is urgent:
// somebody owed three weeks' wages wants to be paid whatever kind of person they
// are, but a `mastery` cook at their skill ceiling asks for training and a `coin`
// server asks for money.

const SOURCE = 'staff.actors'

/** Influence a staff member starts each week with. */
export const WEEKLY_ACTOR_BUDGET = 3

/** Days between an actor's decision and it being carried out. */
const INTENT_LEAD_DAYS = 1

export const STAFF_ACTOR_GOALS = {
  BE_PAID: 'be_paid',
  BE_RESTED: 'be_rested',
  ADVANCE: 'advance',
  BE_RESPECTED: 'be_respected',
} as const

export const STAFF_ACTOR_ACTIONS = {
  REQUEST_RAISE: 'request_raise',
  ASK_FOR_TRAINING: 'ask_for_training',
  CALL_IN_SICK: 'call_in_sick',
  COVER_FOR_COWORKER: 'cover_for_coworker',
  GIVE_NOTICE: 'give_notice',
} as const

// ---------------------------------------------------------------------------
// Goals and perception
// ---------------------------------------------------------------------------

/**
 * What this person wants right now, weighted.
 *
 * Weights are bounded 0..1 by the contract. The career goal adds a standing
 * lean; the live state adds the urgency. A goal at weight 0 is not considered at
 * all, which is how somebody who is paid, rested and going nowhere ends up
 * simply getting on with the job.
 */
export function deriveGoals(
  state: TavernState,
  member: StaffState,
): ActorGoal[] {
  const arrears = totalWageArrears(state, member.id)
  const goal = member.careerGoal ?? 'security'

  const paidWeight = clamp01(
    (arrears > 0 ? 0.45 : 0) +
      (member.paidThisWeek ? 0 : 0.2) +
      (goal === 'coin' ? 0.25 : 0.05) +
      (member.wage <= 8 ? 0.1 : 0),
  )
  const restedWeight = clamp01(
    (member.fatigue >= 60 ? 0.4 : member.fatigue >= 40 ? 0.2 : 0) +
      (member.stress >= 60 ? 0.25 : 0) +
      ((member.consecutiveDaysWorked ?? 0) >= 7 ? 0.2 : 0) +
      (goal === 'security' ? 0.1 : 0),
  )
  const advanceWeight = clamp01(
    (isAtSkillCeiling(member) ? 0.3 : 0.1) +
      (goal === 'mastery' ? 0.35 : 0.05) +
      ((member.daysEmployed ?? 0) >= 14 ? 0.15 : 0),
  )
  const respectedWeight = clamp01(
    (goal === 'standing' ? 0.35 : 0.05) +
      (member.morale <= 30 ? 0.25 : 0) +
      (member.loyalty <= 30 ? 0.2 : 0),
  )

  return [
    { id: STAFF_ACTOR_GOALS.BE_PAID, weight: paidWeight, readable: 'Be paid properly.' },
    { id: STAFF_ACTOR_GOALS.BE_RESTED, weight: restedWeight, readable: 'Get some rest.' },
    { id: STAFF_ACTOR_GOALS.ADVANCE, weight: advanceWeight, readable: 'Get on in the trade.' },
    {
      id: STAFF_ACTOR_GOALS.BE_RESPECTED,
      weight: respectedWeight,
      readable: 'Be treated decently.',
    },
  ]
}

/**
 * What this person can see. Their own condition, their standing with the owner,
 * and what the tavern owes them — not the whole state.
 */
export function buildPerception(
  state: TavernState,
  member: StaffState,
): ActorPerception {
  const edge = getOwnerEdge(state, member.id)
  return {
    readings: {
      morale: member.morale,
      stress: member.stress,
      fatigue: member.fatigue,
      loyalty: member.loyalty,
      skill: member.skill,
      wage: member.wage,
      arrears: totalWageArrears(state, member.id),
      ownerTrust: ownerTrust(state, member.id),
      ownerAffinity: edge?.affinity ?? 0,
      daysEmployed: member.daysEmployed ?? 0,
      consecutiveDaysWorked: member.consecutiveDaysWorked ?? 0,
      friends: listActiveEdgesFor(state, member.id).filter(
        (e) => e.kind === 'coworker' && e.affinity > 20,
      ).length,
    },
    beliefs: {},
    visibleTargets: [{ kind: 'staff', id: member.id }],
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type StaffActorTarget = { kind: 'staff'; id: string }

function selfTarget(perception: ActorPerception): StaffActorTarget[] {
  const ref = perception.visibleTargets[0]
  if (!ref || ref.kind !== 'staff') return []
  return [{ kind: 'staff', id: ref.id }]
}

/**
 * Ask for more money.
 *
 * Schedules a `staff_raise_demand`, which is a promise WITH A DEADLINE the owner
 * can answer: grant it (`adjust_staff_wage`), talk them round
 * (`negotiate_with_staff`), or let it lapse and pay the loyalty. The demand is
 * the mechanism; the resolver is where refusing has consequences.
 */
const requestRaise: ActorActionDefinition<StaffActorTarget> = {
  id: STAFF_ACTOR_ACTIONS.REQUEST_RAISE,
  readable: 'ask for a rise',
  cost: 1,
  cooldownDays: 14,
  commitmentDays: 2,
  servesGoals: [STAFF_ACTOR_GOALS.BE_PAID, STAFF_ACTOR_GOALS.BE_RESPECTED],
  eligibleTargets: (perception, state) => {
    const target = selfTarget(perception)[0]
    if (!target) return []
    const member = state.staff[target.id]
    // Nobody asks for a rise in their first fortnight, and nobody asks while
    // they are already on notice.
    if (!member || (member.daysEmployed ?? 0) < 10) return []
    if (member.absence?.kind === 'notice_served') return []
    return [target]
  },
  score: ({ perception, goal }) => {
    const r = perception.readings
    // Somebody has to believe the ask might work: trust with the owner is the
    // gate, which is what makes the relationship graph load-bearing rather than
    // decorative.
    if ((r['ownerTrust'] ?? 50) < 25) return 0
    const arrearsPush = (r['arrears'] ?? 0) > 0 ? 0.35 : 0
    const lowWagePush = (r['wage'] ?? 0) <= 10 ? 0.25 : 0.1
    const moralePush = (r['morale'] ?? 50) < 40 ? 0.2 : 0
    const base = arrearsPush + lowWagePush + moralePush
    return goal.id === STAFF_ACTOR_GOALS.BE_PAID ? base : base * 0.6
  },
  perform: (ctx, { actor, target }) => {
    const member = ctx.state.staff[target.id]
    if (!member) {
      return { result: 'failed', readable: 'The request had nobody behind it.' }
    }
    const asked = Math.max(member.wage + 2, Math.round(member.wage * 1.15))
    const scheduled = scheduleRaiseDemand(ctx, member, asked)
    void actor
    return {
      result: scheduled ? 'succeeded' : 'failed',
      readable: scheduled
        ? `${member.name.display} asked for ${asked} coin a week.`
        : `${member.name.display} has an outstanding request already.`,
      learned: { asked_for_raise: String(ctx.state.calendar.totalDaysElapsed) },
    }
  },
}

/**
 * Ask to be taught.
 *
 * The cheapest possible request, and the one an owner should nearly always say
 * yes to — which is the point: a `mastery` staff member who is refused training
 * repeatedly is the one who leaves for somewhere that will teach them.
 */
const askForTraining: ActorActionDefinition<StaffActorTarget> = {
  id: STAFF_ACTOR_ACTIONS.ASK_FOR_TRAINING,
  readable: 'ask to be taught',
  cost: 1,
  cooldownDays: 10,
  commitmentDays: 1,
  servesGoals: [STAFF_ACTOR_GOALS.ADVANCE],
  eligibleTargets: (perception, state) => {
    const target = selfTarget(perception)[0]
    if (!target) return []
    const member = state.staff[target.id]
    if (!member || member.absence) return []
    // There is something to ask for: either headroom in their own trade or a
    // second trade they could pick up.
    if (isAtSkillCeiling(member) && crossTrainableRoles(member).length === 0) {
      return []
    }
    return [target]
  },
  score: ({ perception }) => {
    const r = perception.readings
    if ((r['fatigue'] ?? 0) >= 70) return 0
    return 0.3 + ((r['morale'] ?? 50) >= 50 ? 0.15 : 0)
  },
  perform: (ctx, { target }) => {
    const member = ctx.state.staff[target.id]
    if (!member) {
      return { result: 'failed', readable: 'Nobody left to teach.' }
    }
    // The authoritative mutation is a memory the training action reads and the
    // quit-risk resolver counts: an unanswered request is a recorded fact.
    ctx.addMemory({
      id: `staff_asked_for_training_${member.id}`,
      source: SOURCE,
      actors: [{ kind: 'staff', id: member.id }],
      tags: ['staff', 'development', 'request', 'training', member.id],
      metadata: { staffId: member.id, skill: member.skill },
    })
    noteContact(ctx, {
      aStaffId: member.id,
      withOwner: true,
      trustDelta: 2,
      reason: 'asked to be taught',
      tags: ['request', 'training'],
    })
    return {
      result: 'succeeded',
      readable: `${member.name.display} asked to be shown more of the trade.`,
    }
  },
}

/**
 * Call in sick.
 *
 * The thing somebody does when they are exhausted and nobody has listened. It is
 * `unexcused` rather than `illness` because that is what it is — and because
 * `ABANDONMENT_DAYS` of it ends the employment, which gives the player a real
 * reason to answer the underlying problem rather than wait it out.
 */
const callInSick: ActorActionDefinition<StaffActorTarget> = {
  id: STAFF_ACTOR_ACTIONS.CALL_IN_SICK,
  readable: 'not come in',
  cost: 1,
  cooldownDays: 7,
  commitmentDays: 1,
  servesGoals: [STAFF_ACTOR_GOALS.BE_RESTED, STAFF_ACTOR_GOALS.BE_RESPECTED],
  eligibleTargets: (perception, state) => {
    const target = selfTarget(perception)[0]
    if (!target) return []
    const member = state.staff[target.id]
    if (!member || member.absence) return []
    return [target]
  },
  score: ({ perception }) => {
    const r = perception.readings
    // Two conditions together, not either alone: worn out AND not minded to put
    // up with it. Somebody exhausted but well-treated still turns up.
    const worn = (r['fatigue'] ?? 0) >= 55 || (r['consecutiveDaysWorked'] ?? 0) >= 8
    const fedUp = (r['morale'] ?? 50) <= 35 || (r['loyalty'] ?? 50) <= 30
    if (!worn || !fedUp) return 0
    return 0.4 + ((r['arrears'] ?? 0) > 0 ? 0.2 : 0)
  },
  perform: (ctx, { target }) => {
    const member = ctx.state.staff[target.id]
    if (!member) return { result: 'failed', readable: 'Nobody to miss.' }
    const applied = setAbsence(ctx, member.id, {
      kind: 'unexcused',
      days: 1,
      reason: 'did not come in',
      source: `${SOURCE}.call_in_sick`,
    })
    noteContact(ctx, {
      aStaffId: member.id,
      withOwner: true,
      affinityDelta: -6,
      trustDelta: -4,
      reason: 'did not come in',
      tags: ['absence', 'unexcused'],
    })
    return {
      result: applied ? 'succeeded' : 'failed',
      readable: applied
        ? `${member.name.display} did not come in.`
        : `${member.name.display} was already out.`,
    }
  },
}

/**
 * Step up for a colleague who is struggling.
 *
 * The positive action, and the reason the actor list is not purely a list of
 * complaints: a crew that gets on carries each other, and the mutation is a real
 * one — the colleague's fatigue actually comes down.
 */
const coverForCoworker: ActorActionDefinition<StaffActorTarget> = {
  id: STAFF_ACTOR_ACTIONS.COVER_FOR_COWORKER,
  readable: 'take some of the load off a friend',
  cost: 1,
  cooldownDays: 5,
  commitmentDays: 0,
  servesGoals: [STAFF_ACTOR_GOALS.BE_RESPECTED, STAFF_ACTOR_GOALS.BE_RESTED],
  eligibleTargets: (perception, state) => {
    const self = selfTarget(perception)[0]
    if (!self) return []
    const member = state.staff[self.id]
    if (!member || member.absence || member.fatigue >= 60) return []
    const friends = listActiveEdgesFor(state, self.id)
      .filter((edge) => edge.kind === 'coworker' && edge.affinity >= 25)
      .map((edge) => (edge.from.id === self.id ? edge.to.id : edge.from.id))
      .map((id) => state.staff[id])
      .filter(
        (other): other is NonNullable<typeof other> =>
          other !== undefined && other.fatigue >= 55 && !other.absence,
      )
      .sort((a, b) => b.fatigue - a.fatigue || a.id.localeCompare(b.id))
    const best = friends[0]
    return best ? [{ kind: 'staff' as const, id: best.id }] : []
  },
  score: ({ target, state }) => {
    const other = state.staff[target.id]
    if (!other) return 0
    return Math.min(0.5, other.fatigue / 200)
  },
  perform: (ctx, { actor, target }) => {
    const helper = ctx.state.staff[actor.ref.id]
    const helped = ctx.state.staff[target.id]
    if (!helper || !helped) {
      return { result: 'failed', readable: 'Nobody to help.' }
    }
    ctx.modifyStaff(
      helped.id,
      {
        fatigue: clampPercent(helped.fatigue - 6),
        morale: clampPercent(helped.morale + 4),
      },
      {
        source: `${SOURCE}.cover`,
        sourceType: 'staff',
        target: `staff:${helped.id}.fatigue`,
        targetType: 'staff',
        amount: -6,
        readable: `${helper.name.display} took some of the load off ${helped.name.display}.`,
        tags: ['staff', 'cover', helper.id, helped.id],
        relatedActors: [
          { kind: 'staff', id: helper.id },
          { kind: 'staff', id: helped.id },
        ],
        relatedSystems: ['staff'],
      },
    )
    ctx.modifyStaff(
      helper.id,
      { fatigue: clampPercent(helper.fatigue + 3) },
      { source: `${SOURCE}.cover`, reason: 'covered_for_coworker' },
    )
    noteContact(ctx, {
      aStaffId: helper.id,
      bStaffId: helped.id,
      affinityDelta: 6,
      trustDelta: 3,
      reason: 'took some of the load',
      tags: ['cover'],
    })
    return {
      result: 'succeeded',
      readable: `${helper.name.display} covered for ${helped.name.display}.`,
    }
  },
}

/**
 * Resign.
 *
 * The last resort, and gated hard: it needs the person to be genuinely finished
 * with the place, not merely having a bad week. It goes through `giveNotice`, so
 * the notice period runs, the coverage cost lands while it does, and the player
 * has the whole window to talk them round. §3.4's counterplay is a real window,
 * not a single-turn reflex.
 */
const giveNoticeAction: ActorActionDefinition<StaffActorTarget> = {
  id: STAFF_ACTOR_ACTIONS.GIVE_NOTICE,
  readable: 'hand in their notice',
  cost: 2,
  cooldownDays: 30,
  commitmentDays: 5,
  servesGoals: [
    STAFF_ACTOR_GOALS.BE_PAID,
    STAFF_ACTOR_GOALS.BE_RESPECTED,
    STAFF_ACTOR_GOALS.BE_RESTED,
  ],
  eligibleTargets: (perception, state) => {
    const target = selfTarget(perception)[0]
    if (!target) return []
    const member = state.staff[target.id]
    if (!member || member.absence?.kind === 'notice_served') return []
    return [target]
  },
  score: ({ perception }) => {
    const r = perception.readings
    const loyalty = r['loyalty'] ?? 50
    const morale = r['morale'] ?? 50
    // Three independent reasons to be done with the place; at least two have to
    // be true. One bad week must not be enough, or the crew would be a
    // revolving door.
    const reasons =
      (loyalty <= 20 ? 1 : 0) +
      (morale <= 20 ? 1 : 0) +
      ((r['arrears'] ?? 0) > 0 && (r['ownerTrust'] ?? 50) <= 30 ? 1 : 0) +
      ((r['fatigue'] ?? 0) >= 80 ? 1 : 0)
    if (reasons < 2) return 0
    return Math.min(0.9, 0.3 * reasons)
  },
  perform: (ctx, { target }) => {
    const member = ctx.state.staff[target.id]
    if (!member) return { result: 'failed', readable: 'Nobody to lose.' }
    // Resignation goes through the QUIT-RISK event rather than straight to
    // notice, so the player gets the warning, the contributor list and the
    // counterplay §3.4 requires — the same path a response-declared hook takes.
    const scheduled = scheduleQuitRisk(ctx, member.id, {
      reason: 'has had enough of the place',
      source: `${SOURCE}.give_notice`,
    })
    if (!scheduled) {
      // Already warned and the warning ran its course: act on it now.
      const record = getEmployment(ctx.state, member.id)
      const given = giveNotice(ctx, member.id, {
        givenBy: 'staff',
        reason: 'has had enough of the place',
      })
      void record
      return {
        result: given ? 'succeeded' : 'failed',
        readable: given
          ? `${member.name.display} handed in their notice.`
          : `${member.name.display} is already leaving.`,
      }
    }
    return {
      result: 'succeeded',
      readable: `${member.name.display} is close to walking out.`,
      learned: { considering_leaving: 'yes' },
    }
  },
}

export const STAFF_ACTOR_ACTION_LIST: ReadonlyArray<
  ActorActionDefinition<StaffActorTarget>
> = [requestRaise, askForTraining, coverForCoworker, callInSick, giveNoticeAction]

// ---------------------------------------------------------------------------
// The daily pass
// ---------------------------------------------------------------------------

function ensureActor(
  slice: ReturnType<typeof getStaffModuleState>,
  state: TavernState,
  member: StaffState,
): ActorState {
  const existing = slice.actors[member.id]
  if (existing) {
    return { ...existing, goals: deriveGoals(state, member) }
  }
  return createActorState({
    ref: { kind: 'staff', id: member.id },
    ownerModuleId: 'staff',
    budget: WEEKLY_ACTOR_BUDGET,
    goals: deriveGoals(state, member),
  })
}

/**
 * Decide, announce, and carry out.
 *
 * Runs at `endDay`, when the day's outcome is known. An actor with a declared
 * intent from a previous evening performs it now; an actor without one decides
 * and announces. So there is always at least one full player turn between "they
 * are going to do something" and them doing it.
 */
export function runStaffActors(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const slice = getStaffModuleState(ctx.state)
  const members = [...Object.values(ctx.state.staff)].sort((a, b) =>
    a.id.localeCompare(b.id),
  )
  const nextActors: Record<string, ActorState> = {}

  for (const member of members) {
    let actor = ensureActor(slice, ctx.state, member)

    // Weekly top-up. Deliberately tied to the calendar rather than to a
    // per-actor counter so every staff member's budget refreshes on the same
    // day and a reload cannot hand somebody a second allowance.
    if (ctx.isEndOfWeek()) {
      actor = { ...actor, budget: WEEKLY_ACTOR_BUDGET }
    }

    const intent = actor.intent
    if (intent && today - intent.decidedOnDay >= INTENT_LEAD_DAYS) {
      const action = STAFF_ACTOR_ACTION_LIST.find((a) => a.id === intent.actionId)
      const target = intent.targetRef
      if (action && target && target.kind === 'staff') {
        const performed = performActorAction<StaffActorTarget>(ctx, {
          actor,
          action,
          target: { kind: 'staff' as const, id: target.id },
          goalId: intent.goalId,
        })
        actor = performed.actor
        ctx.addLog(
          {
            message: performed.outcome.readable,
            level: 'info',
            data: { staffId: member.id, actionId: action.id },
          },
          'staff',
        )
        nextActors[member.id] = actor
        continue
      }
      // The intent no longer resolves (the action list changed, or the target
      // has gone). Drop it rather than firing something arbitrary.
      const { intent: _dropped, ...withoutIntent } = actor
      actor = withoutIntent
    }

    const { decision } = decideActorAction({
      actor,
      perception: buildPerception(ctx.state, member),
      actions: STAFF_ACTOR_ACTION_LIST,
      state: ctx.state,
      today,
    })
    if (decision.status === 'decided') {
      const action = STAFF_ACTOR_ACTION_LIST.find((a) => a.id === decision.actionId)!
      actor = declareActorIntent(
        actor,
        decision,
        `${member.name.display} means to ${action.readable}.`,
        today,
      )
    } else if (actor.intent) {
      const { intent: _cleared, ...withoutIntent } = actor
      actor = withoutIntent
    }
    nextActors[member.id] = actor
  }

  writeStaffSlice(
    ctx,
    (current) => ({ ...current, actors: nextActors }),
    'staff_actors',
  )
}

/** Every announced-but-not-yet-taken staff move. Read by the report. */
export function listStaffIntents(state: {
  modules: Record<string, unknown>
}): Array<{ staffId: string; actionId: string; readable: string; decidedOnDay: number }> {
  const slice = getStaffModuleState(state)
  return Object.entries(slice.actors)
    .filter(([, actor]) => actor.intent !== undefined)
    .map(([staffId, actor]) => ({
      staffId,
      actionId: actor.intent!.actionId,
      readable: actor.intent!.readable,
      decidedOnDay: actor.intent!.decidedOnDay,
    }))
    .sort((a, b) => a.staffId.localeCompare(b.staffId))
}

/** Withdraw an announced move — what a successful negotiation buys. */
export function clearStaffIntent(ctx: SimContext, staffId: string): void {
  writeStaffSlice(
    ctx,
    (current) => {
      const actor = current.actors[staffId]
      if (!actor?.intent) return current
      const { intent: _dropped, ...rest } = actor
      return { ...current, actors: { ...current.actors, [staffId]: rest } }
    },
    'clear_intent',
  )
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100))
}

export { STAFF_QUIT_RISK_EVENT, STAFF_RAISE_DEMAND_EVENT }
