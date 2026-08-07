import type { SimContext } from '../../core/context'
import type { EntityRef, FactionWorldState, TavernState } from '../../state/TavernState'
import {
  createActorState,
  decideActorAction,
  declareActorIntent,
  orderActorState,
  performActorAction,
  type ActorActionDefinition,
  type ActorGoal,
  type ActorPerception,
  type ActorState,
} from '../../contracts/actors/index'
import {
  ensureRequiredFactionsRegistered,
  factionRegistry,
} from '../../content/factions/factionRegistry'
import type { FactionActionId } from '../../content/factions/factionTypes'
import { noteIncidentEvidence } from '../regulatory/evidence'
import { getEconomyModuleState } from '../economy/state'
import { addCoin } from '../stock/ledger'
import {
  beliefAgainstHouse,
  beliefEffect,
  goodwillTowardHouse,
} from '../attribution/beliefInputs'

import {
  activeStance,
  getFactionModuleState,
  openDemandFor,
  owedFavourFor,
  recordFactionMove,
  writeFactionSlice,
  bumpFactionTotal,
} from './factionState'
import {
  constituencyReach,
  memberSuppliers,
  representedGroups,
  standingNet,
  worstGrievance,
} from './standing'
import { openStance } from './stances'
import { openDemandRecord, scheduleFavourDue } from './factionEvents'
import type { FactionFavour } from './types'

// Expansion Phase 8 §8.1 — factions decide and act.
//
// WHY THROUGH THE SHARED ACTOR CONTRACT. Phase 1 §1.6 built the decision
// procedure so a domain supplies goals, actions and scoring while budget,
// cooldown, commitment, visible intent and learning are handled once. Staff
// were the first consumer; factions are the second, and the contract earns
// its keep again: without commitment windows the Miners' Union could call a
// boycott, make a demand and pledge support in the same evening, and
// without visible intent a boycott would arrive with no turn in which to
// answer it.
//
// INFLUENCE IS THE RESOURCE. §8.1 asks for "resources or influence", and
// the faction already has an `influence` meter — so the actor's budget is
// derived from it rather than invented. A faction with 60 influence gets
// three moves a week; one with 25 gets one. That is what makes influence
// worth caring about: it is not a number on a sheet, it is how often they
// can do something about you.
//
// PRIORITIES COME FROM MEMORY AND CONSTITUENCY. `deriveGoals` reads the
// standing ledger and the state of the people the faction speaks for, so a
// union whose miners are being served badly wants to protect them, and a
// guild that has been stiffed on three invoices wants collecting. Weight 0
// means the goal is not considered at all, which is how a faction with no
// complaint and nothing to gain simply gets on with its own business.
//
// EVERY MOVE IS OPPOSABLE. Demands are answered by `grant_faction_demand` /
// `refuse_faction_demand`; hostile stances are argued with by
// `appeal_to_faction`; sponsorship debts are settled by
// `repay_faction_favour`. §8.1's "outcomes that can succeed, fail, or be
// opposed" is not a property of the outcome table — it is those four owner
// actions being on the board while the intent is visible.

const SOURCE = 'factions.actors'

/** Days between a faction deciding and it acting. Two, so the player gets a turn. */
export const FACTION_INTENT_LEAD_DAYS = 2

export const FACTION_GOALS = {
  PROTECT_CONSTITUENCY: 'protect_constituency',
  ENFORCE_STANDARDS: 'enforce_standards',
  COLLECT_WHAT_IS_OWED: 'collect_what_is_owed',
  GAIN_STANDING: 'gain_standing',
  SETTLE_THE_SCORE: 'settle_the_score',
} as const

type FactionActorTarget = EntityRef

// ---------------------------------------------------------------------------
// Resources, goals and perception
// ---------------------------------------------------------------------------

/** Moves a faction can afford in a week, from the influence it actually has. */
/** The most a faction's belief about the house can weigh on its goals. */
export const MAX_FACTION_BELIEF_WEIGHT = 0.2

export function weeklyBudgetFor(faction: FactionWorldState): number {
  return Math.max(1, Math.round(faction.influence / 20))
}

/**
 * What this faction wants right now, weighted 0..1.
 *
 * Every weight is traceable to live state: how the people it speaks for are
 * being treated, what it is owed, what it remembers, and what it is for.
 */
export function deriveGoals(
  state: TavernState,
  faction: FactionWorldState,
): ActorGoal[] {
  const def = factionRegistry.get(faction.id)
  const groups = representedGroups(state, faction.id)
  const reach = constituencyReach(state, faction.id)
  const net = standingNet(state, faction.id)

  const worstSatisfaction = groups.reduce(
    (worst, group) => Math.min(worst, group.satisfaction),
    100,
  )
  const constituencyWeight = clamp01(
    (groups.length > 0 ? 0.15 : 0) +
      (worstSatisfaction <= 40 ? 0.35 : worstSatisfaction <= 55 ? 0.15 : 0) +
      reach * 0.3,
  )

  const authority =
    (def?.tags.includes('inspection_authority') ? 1 : 0) +
    (def?.tags.includes('reputation_authority') ? 1 : 0)
  const violence = state.pressures['violence']?.value ?? 0
  const maintenance = state.pressures['maintenance']?.value ?? 0
  const enforceWeight = clamp01(
    (authority > 0 ? 0.2 : 0) +
      (authority > 0 && violence >= 50 ? 0.3 : 0) +
      (authority > 0 && maintenance >= 55 ? 0.2 : 0) +
      (faction.trust <= 35 ? 0.15 : 0),
  )

  const owed = amountOwedToMembers(state, faction.id)
  const collectWeight = clamp01(
    (owed > 0 ? 0.35 : 0) +
      (owed > 60 ? 0.25 : 0) +
      (owedFavourFor(state, faction.id) ? 0.2 : 0) +
      (def?.tags.includes('debt_pressure') ? 0.1 : 0),
  )

  const standingWeight = clamp01(
    (def?.tags.includes('wealthy') || def?.tags.includes('reputation_authority')
      ? 0.25
      : 0.08) +
      (faction.influence <= 35 ? 0.2 : 0) +
      (net > 20 ? 0.15 : 0),
  )

  // Expansion Phase 8 §8.5 — a faction that has come to blame the house wants
  // the score settled more than its ledger alone says. Capped at 0.2 so
  // belief tilts the goal rather than deciding it: the ledger of how they
  // have actually been treated stays the larger term, which is what keeps
  // §8.1's "memory of treatment" the thing a player manages.
  const grievance = beliefEffect(
    beliefAgainstHouse(state, { kind: 'faction', id: faction.id }),
    MAX_FACTION_BELIEF_WEIGHT,
  )
  const scoreWeight = clamp01(
    (net <= -20 ? 0.35 : net <= -8 ? 0.18 : 0) +
      (faction.relationship <= 30 ? 0.25 : 0) +
      (def?.tags.includes('competition') ? 0.15 : 0) +
      grievance,
  )

  return [
    {
      id: FACTION_GOALS.PROTECT_CONSTITUENCY,
      weight: constituencyWeight,
      readable: 'Look after our own.',
    },
    {
      id: FACTION_GOALS.ENFORCE_STANDARDS,
      weight: enforceWeight,
      readable: 'Keep the place in order.',
    },
    {
      id: FACTION_GOALS.COLLECT_WHAT_IS_OWED,
      weight: collectWeight,
      readable: 'Get back what we are owed.',
    },
    {
      id: FACTION_GOALS.GAIN_STANDING,
      weight: standingWeight,
      readable: 'Be worth knowing.',
    },
    {
      id: FACTION_GOALS.SETTLE_THE_SCORE,
      weight: scoreWeight,
      readable: 'Settle the score.',
    },
  ]
}

/** Coin the tavern is behind on to suppliers this faction speaks for. */
export function amountOwedToMembers(state: TavernState, factionId: string): number {
  const suppliers = new Set(memberSuppliers(state, factionId).map((s) => s.id))
  if (suppliers.size === 0) return 0
  const slice = state.modules['suppliers'] as
    | { invoices?: Record<string, { supplierId?: string; status?: string; amount?: number; paid?: number }> }
    | undefined
  const invoices = slice?.invoices
  if (!invoices) return 0
  let owed = 0
  for (const invoice of Object.values(invoices)) {
    if (!invoice.supplierId || !suppliers.has(invoice.supplierId)) continue
    if (invoice.status !== 'grace' && invoice.status !== 'defaulted' && invoice.status !== 'in_collections') {
      continue
    }
    owed += Math.max(0, (invoice.amount ?? 0) - (invoice.paid ?? 0))
  }
  return Math.round(owed)
}

/**
 * What this faction can see.
 *
 * Deliberately not the whole state: a faction knows how its own people are
 * being treated, what it is owed, and what everyone can see from the street.
 * §8.4's rumour work will widen this to what they merely BELIEVE.
 */
export function buildPerception(
  state: TavernState,
  faction: FactionWorldState,
): ActorPerception {
  const groups = representedGroups(state, faction.id)
  const worstSatisfaction = groups.reduce(
    (worst, group) => Math.min(worst, group.satisfaction),
    100,
  )
  const visibleTargets: EntityRef[] = [
    { kind: 'faction', id: faction.id },
    ...groups.map((group) => ({ kind: 'customer_group' as const, id: group.id })),
    ...memberSuppliers(state, faction.id).map((supplier) => ({
      kind: 'supplier' as const,
      id: supplier.id,
    })),
  ]
  // Expansion Phase 8 §8.5 — §8.1 left `beliefs` empty with a note that a
  // later part would widen a faction's view to what it merely BELIEVES. This
  // is that: the strongest thing the faction holds against the house, as a
  // reading its action scores can use and a sentence its intent can quote.
  const grievance = beliefAgainstHouse(state, { kind: 'faction', id: faction.id })
  const goodwill = goodwillTowardHouse(state, { kind: 'faction', id: faction.id })

  return {
    readings: {
      relationship: faction.relationship,
      grievanceAgainstHouse: Math.round((grievance?.weight ?? 0) * 100),
      goodwillTowardHouse: Math.round((goodwill?.weight ?? 0) * 100),
      trust: faction.trust,
      fear: faction.fear,
      influence: faction.influence,
      standingNet: standingNet(state, faction.id),
      reach: constituencyReach(state, faction.id),
      constituencySatisfaction: worstSatisfaction,
      owedToMembers: amountOwedToMembers(state, faction.id),
      violence: state.pressures['violence']?.value ?? 0,
      maintenance: state.pressures['maintenance']?.value ?? 0,
      tavernCoin: state.coin,
      hasOpenDemand: openDemandFor(state, faction.id) ? 1 : 0,
      owesFavour: owedFavourFor(state, faction.id) ? 1 : 0,
      houseInDistress:
        getEconomyModuleState(state).financial.status === 'stable' ? 0 : 1,
    },
    beliefs: {
      ...(grievance ? { againstHouse: grievance.readable } : {}),
      ...(goodwill ? { towardHouse: goodwill.readable } : {}),
    },
    visibleTargets,
  }
}

// ---------------------------------------------------------------------------
// The action set
// ---------------------------------------------------------------------------

function self(perception: ActorPerception): EntityRef[] {
  const ref = perception.visibleTargets[0]
  return ref ? [ref] : []
}

function actingFaction(state: TavernState, actorRef: EntityRef): FactionWorldState | undefined {
  return state.world.factions[actorRef.id]
}

/** A faction may only take a move its definition says it is capable of. */
function capableOf(factionId: string, actionId: FactionActionId): boolean {
  return factionRegistry.get(factionId)?.actions.includes(actionId) ?? false
}

/**
 * Ask the house for something.
 *
 * The cheapest move and the most common, because it is the one that gives
 * the player a choice rather than a consequence. It schedules a dated
 * `faction_demand_deadline`, so an ignored ask is a recorded grievance
 * rather than something that quietly evaporates.
 */
const makeDemand: ActorActionDefinition<FactionActorTarget> = {
  id: 'make_demand',
  readable: 'ask the house for something',
  cost: 1,
  cooldownDays: 12,
  commitmentDays: 3,
  servesGoals: [
    FACTION_GOALS.PROTECT_CONSTITUENCY,
    FACTION_GOALS.COLLECT_WHAT_IS_OWED,
    FACTION_GOALS.GAIN_STANDING,
  ],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref || !capableOf(ref.id, 'make_demand')) return []
    // One ask at a time. A faction that piles requests on top of an
    // unanswered one is noise, not pressure.
    if (openDemandFor(state, ref.id)) return []
    return [ref]
  },
  score: ({ perception, goal }) => {
    const r = perception.readings
    // Somebody has to think the ask might land. A faction the house has no
    // relationship with at all does not bother asking; it does something else.
    if ((r['relationship'] ?? 50) < 20) return 0
    const owedPush = (r['owedToMembers'] ?? 0) > 0 ? 0.35 : 0
    const constituencyPush = (r['constituencySatisfaction'] ?? 100) <= 45 ? 0.25 : 0
    const standingPush = (r['influence'] ?? 0) >= 50 ? 0.2 : 0
    // A faction needs an actual reason to come and ask for something.
    // Without this gate every faction in the world turns up with a request
    // on the first week, which is noise rather than pressure — and noise is
    // exactly what makes an autonomous layer feel like weather.
    if (owedPush === 0 && constituencyPush === 0 && standingPush === 0) return 0
    const base = 0.15 + owedPush + constituencyPush + standingPush
    return goal.id === FACTION_GOALS.COLLECT_WHAT_IS_OWED && owedPush > 0
      ? base
      : base * 0.8
  },
  perform: (ctx, { actor, target, goal }) => {
    const faction = actingFaction(ctx.state, target)
    if (!faction) return { result: 'failed', readable: 'Nobody was asking.' }
    const owed = amountOwedToMembers(ctx.state, faction.id)
    const wantsCoin = owed > 0 || goal.id === FACTION_GOALS.COLLECT_WHAT_IS_OWED
    const askCoin = wantsCoin
      ? Math.max(15, Math.min(120, Math.round(owed > 0 ? owed : faction.influence)))
      : 0
    const demand = openDemandRecord(ctx, {
      factionId: faction.id,
      kind: wantsCoin ? 'coin_contribution' : 'public_backing',
      askCoin,
      goalId: goal.id,
      readable: wantsCoin
        ? `${askCoin} coin toward what they say they are owed`
        : 'a night that shows the house is on their side',
      dueInDays: 4,
    })
    void actor
    return {
      result: demand ? 'succeeded' : 'failed',
      readable: demand
        ? `${faction.label} asked the house for ${demand.readable}.`
        : `${faction.label} had an ask outstanding already.`,
      learned: { asked_on_day: String(ctx.state.calendar.totalDaysElapsed) },
    }
  },
}

/** Tell their people this is the house to drink in. */
const pledgeSupport: ActorActionDefinition<FactionActorTarget> = {
  id: 'pledge_support',
  readable: 'put the word out for the house',
  cost: 1,
  cooldownDays: 9,
  commitmentDays: 2,
  servesGoals: [FACTION_GOALS.PROTECT_CONSTITUENCY, FACTION_GOALS.GAIN_STANDING],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref || !capableOf(ref.id, 'pledge_support')) return []
    if (activeStance(state, ref.id, 'support')) return []
    if (activeStance(state, ref.id, 'boycott')) return []
    return [ref]
  },
  score: ({ perception }) => {
    const r = perception.readings
    // Goodwill is earned, not defaulted: they back a house they think well
    // of, and they will not back one they are currently owed by.
    if ((r['relationship'] ?? 50) < 58) return 0
    if ((r['standingNet'] ?? 0) < 0) return 0
    if ((r['owedToMembers'] ?? 0) > 0) return 0
    return 0.3 + ((r['standingNet'] ?? 0) >= 25 ? 0.25 : 0)
  },
  perform: (ctx, { target, goal }) => {
    const faction = actingFaction(ctx.state, target)
    if (!faction) return { result: 'failed', readable: 'Nobody spoke up.' }
    const strength = Math.min(90, 30 + faction.relationship / 2)
    const stance = openStance(ctx, {
      factionId: faction.id,
      kind: 'support',
      strength,
      reason: `${faction.label} think well of the house.`,
      goalId: goal.id,
    })
    if (!stance) return { result: 'failed', readable: 'The word did not go out.' }
    bumpFactionTotal(ctx, 'supportPledged')
    return {
      result: 'succeeded',
      readable: `${faction.label} put the word out that this is the house to drink in.`,
      learned: { backed_the_house: 'yes' },
    }
  },
}

/** Tell their people to stay away, and say why in public. */
const callBoycott: ActorActionDefinition<FactionActorTarget> = {
  id: 'call_boycott',
  readable: 'call a boycott',
  cost: 2,
  cooldownDays: 16,
  commitmentDays: 5,
  servesGoals: [FACTION_GOALS.SETTLE_THE_SCORE, FACTION_GOALS.PROTECT_CONSTITUENCY],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref || !capableOf(ref.id, 'call_boycott')) return []
    if (activeStance(state, ref.id, 'boycott')) return []
    // A boycott needs people to keep away. Pick the biggest group they
    // speak for; the stance covers the whole constituency.
    const groups = representedGroups(state, ref.id).filter((g) => g.patronage > 0)
    if (groups.length === 0) return []
    const biggest = [...groups].sort(
      (a, b) => b.patronage - a.patronage || a.id.localeCompare(b.id),
    )[0]!
    return [{ kind: 'customer_group', id: biggest.id }]
  },
  score: ({ perception }) => {
    const r = perception.readings
    const net = r['standingNet'] ?? 0
    // Two conditions together: a real grievance AND enough people to make
    // withdrawing them mean something. One alone is a complaint, not a move.
    if (net > -18) return 0
    if ((r['reach'] ?? 0) < 0.2) return 0
    return Math.min(0.9, 0.3 + Math.abs(net) / 150 + (r['reach'] ?? 0) * 0.3)
  },
  perform: (ctx, { actor, target, goal }) => {
    const faction = ctx.state.world.factions[actor.ref.id]
    if (!faction) return { result: 'failed', readable: 'Nobody called anything.' }
    const grievance = worstGrievance(ctx.state, faction.id)
    const stance = openStance(ctx, {
      factionId: faction.id,
      kind: 'boycott',
      strength: Math.min(90, 30 + Math.abs(standingNet(ctx.state, faction.id))),
      reason: grievance?.readable ?? `${faction.label} have had enough of the house.`,
      goalId: goal.id,
    })
    if (!stance) return { result: 'failed', readable: 'The boycott did not hold.' }
    bumpFactionTotal(ctx, 'boycottsCalled')
    const group = ctx.state.customerGroups[target.id]
    return {
      result: 'succeeded',
      readable: `${faction.label} called a boycott and told the ${group?.label ?? target.id} to drink elsewhere.`,
      learned: { boycotting: 'yes' },
    }
  },
}

/**
 * Put the word in with the watch.
 *
 * The move goes through the REGULATORY domain's own evidence intake, which
 * is the only thing that decides whether a case opens and when a visit
 * happens. A faction can make the watch curious; it cannot summon an
 * inspector, because inspections are not its state to write.
 */
const pressInspection: ActorActionDefinition<FactionActorTarget> = {
  id: 'press_inspection',
  readable: 'have a word with the watch',
  cost: 2,
  cooldownDays: 14,
  commitmentDays: 3,
  servesGoals: [FACTION_GOALS.ENFORCE_STANDARDS, FACTION_GOALS.SETTLE_THE_SCORE],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref || !capableOf(ref.id, 'press_inspection')) return []
    return [ref]
  },
  score: ({ perception }) => {
    const r = perception.readings
    const violence = r['violence'] ?? 0
    const maintenance = r['maintenance'] ?? 0
    const net = r['standingNet'] ?? 0
    // They report what they can see. A tidy, quiet house gives them nothing
    // to report, however little they think of the owner.
    const visible = Math.max(violence, maintenance)
    if (visible < 45 && net > -25) return 0
    return Math.min(0.85, 0.2 + visible / 200 + (net < 0 ? Math.abs(net) / 250 : 0))
  },
  perform: (ctx, { actor }) => {
    const faction = ctx.state.world.factions[actor.ref.id]
    if (!faction) return { result: 'failed', readable: 'Nobody said anything.' }
    const violence = ctx.state.pressures['violence']?.value ?? 0
    const maintenance = ctx.state.pressures['maintenance']?.value ?? 0
    const severity = Math.max(4, Math.round(Math.max(violence, maintenance) / 8))
    noteIncidentEvidence(ctx, {
      subject: `faction-${faction.id}`,
      severity,
      readable: `${faction.label} put the word in with the watch about this place.`,
      tags: ['faction', faction.id, 'report'],
    })
    bumpFactionTotal(ctx, 'inspectionsPressed')
    return {
      result: 'succeeded',
      readable: `${faction.label} had a word with the watch about the house.`,
      learned: { reported_the_house: 'yes' },
    }
  },
}

/** Lean on the suppliers they speak for. */
const squeezeSupply: ActorActionDefinition<FactionActorTarget> = {
  id: 'squeeze_supply',
  readable: 'lean on their suppliers',
  cost: 2,
  cooldownDays: 14,
  commitmentDays: 4,
  servesGoals: [FACTION_GOALS.COLLECT_WHAT_IS_OWED, FACTION_GOALS.SETTLE_THE_SCORE],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref || !capableOf(ref.id, 'squeeze_supply')) return []
    if (activeStance(state, ref.id, 'supply_squeeze')) return []
    const suppliers = memberSuppliers(state, ref.id)
    if (suppliers.length === 0) return []
    return [{ kind: 'supplier', id: suppliers[0]!.id }]
  },
  score: ({ perception }) => {
    const r = perception.readings
    const owed = r['owedToMembers'] ?? 0
    const net = r['standingNet'] ?? 0
    if (owed <= 0 && net > -20) return 0
    return Math.min(0.85, 0.25 + Math.min(0.4, owed / 200) + (net < 0 ? 0.2 : 0))
  },
  perform: (ctx, { actor, goal }) => {
    const faction = ctx.state.world.factions[actor.ref.id]
    if (!faction) return { result: 'failed', readable: 'Nobody leaned on anyone.' }
    const owed = amountOwedToMembers(ctx.state, faction.id)
    const stance = openStance(ctx, {
      factionId: faction.id,
      kind: 'supply_squeeze',
      strength: Math.min(90, 35 + Math.min(45, owed / 2)),
      reason:
        owed > 0
          ? `${faction.label} say the house is ${owed} coin behind with their people.`
          : `${faction.label} are making a point.`,
      goalId: goal.id,
    })
    if (!stance) return { result: 'failed', readable: 'The word did not carry.' }
    return {
      result: 'succeeded',
      readable: `${faction.label} leaned on their suppliers: worse terms, and less credit.`,
      learned: { squeezing_supply: 'yes' },
    }
  },
}

/** Put money in now, and expect something back. */
const sponsorHouse: ActorActionDefinition<FactionActorTarget> = {
  id: 'sponsor_house',
  readable: 'put money into the house',
  cost: 2,
  cooldownDays: 21,
  commitmentDays: 3,
  servesGoals: [FACTION_GOALS.GAIN_STANDING, FACTION_GOALS.PROTECT_CONSTITUENCY],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref || !capableOf(ref.id, 'sponsor_house')) return []
    // Nobody sponsors a house that already owes them a favour.
    if (owedFavourFor(state, ref.id)) return []
    // And nobody puts money into a house that is going under. A faction
    // backs a business that is having a thin week, not one whose creditors
    // are already circling — which also keeps Phase 5's failure route
    // reachable rather than letting a well-liked tavern be propped up
    // indefinitely by its friends.
    const status = getEconomyModuleState(state).financial.status
    if (
      status === 'insolvent' ||
      status === 'restructuring' ||
      status === 'temporarily_closed'
    ) {
      return []
    }
    return [ref]
  },
  score: ({ perception }) => {
    const r = perception.readings
    // Sponsorship is a REWARD for a relationship the player built, not a
    // bailout available to anyone who is short. It needs banked goodwill —
    // a positive standing ledger, not merely a neutral starting meter — so
    // a tavern that has done nothing for anybody cannot be carried through
    // its first bad fortnight by strangers, and Phase 5's failure route
    // stays reachable.
    if ((r['relationship'] ?? 50) < 55) return 0
    if ((r['standingNet'] ?? 0) <= 0) return 0
    // Given that, they put money in where money is short: a house that is
    // flush does not need them, and a favour is only worth having when it
    // was needed.
    const needy = (r['tavernCoin'] ?? 0) < 150 ? 0.3 : 0.1
    return 0.2 + needy + ((r['influence'] ?? 0) >= 40 ? 0.15 : 0)
  },
  perform: (ctx, { actor }) => {
    const faction = ctx.state.world.factions[actor.ref.id]
    if (!faction) return { result: 'failed', readable: 'Nobody put anything in.' }
    const today = ctx.state.calendar.totalDaysElapsed
    const value = Math.max(20, Math.min(90, Math.round(faction.influence * 1.2)))

    // Through `addCoin`, not `ctx.modifyCoin`: a sponsorship is real money
    // arriving, so it belongs on the coin ledger like every other movement
    // (Phase 9 §9.3). Without the ledger entry the day's accounting would
    // not reconcile and the economy module would flag it.
    addCoin(ctx, value, {
      category: 'other',
      source: `${SOURCE}.sponsor_house`,
      sourceType: 'faction',
      target: 'coin',
      targetType: 'coin',
      amount: value,
      readable: `${faction.label} put ${value} coin into the house.`,
      tags: ['faction', 'sponsorship', faction.id],
      relatedActors: [{ kind: 'faction', id: faction.id }],
      relatedSystems: ['factions', 'economy'],
    })

    const favour: FactionFavour = {
      id: `favour_${faction.id}_${today}`,
      factionId: faction.id,
      grantedValue: value,
      openedOnDay: today,
      dueOnDay: today + 12,
      status: 'owed',
      readable: `the ${value} coin they put in`,
    }
    writeFactionSlice(
      ctx,
      (current) =>
        current.favours[favour.id]
          ? current
          : { ...current, favours: { ...current.favours, [favour.id]: favour } },
      'favour_opened',
    )
    bumpFactionTotal(ctx, 'sponsorshipsGiven')
    scheduleFavourDue(ctx, favour)

    return {
      result: 'succeeded',
      readable: `${faction.label} put ${value} coin into the house — and will want something back.`,
      learned: { sponsored_the_house: 'yes' },
    }
  },
}

/** Keep trouble off the floor while the goodwill lasts. */
const offerProtection: ActorActionDefinition<FactionActorTarget> = {
  id: 'offer_protection',
  readable: 'keep trouble off the floor',
  cost: 1,
  cooldownDays: 10,
  commitmentDays: 2,
  servesGoals: [FACTION_GOALS.PROTECT_CONSTITUENCY, FACTION_GOALS.ENFORCE_STANDARDS],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref || !capableOf(ref.id, 'offer_protection')) return []
    if (activeStance(state, ref.id, 'protection')) return []
    return [ref]
  },
  score: ({ perception }) => {
    const r = perception.readings
    if ((r['relationship'] ?? 50) < 45) return 0
    const violence = r['violence'] ?? 0
    if (violence < 40) return 0
    return Math.min(0.7, 0.15 + violence / 150)
  },
  perform: (ctx, { actor, goal }) => {
    const faction = ctx.state.world.factions[actor.ref.id]
    if (!faction) return { result: 'failed', readable: 'Nobody was watching the door.' }
    const stance = openStance(ctx, {
      factionId: faction.id,
      kind: 'protection',
      strength: Math.min(90, 25 + faction.relationship / 2),
      reason: `${faction.label} do not want trouble in a house they use.`,
      goalId: goal.id,
    })
    if (!stance) return { result: 'failed', readable: 'Nobody came.' }
    return {
      result: 'succeeded',
      readable: `${faction.label} put people on the door to keep trouble down.`,
      learned: { protecting_the_house: 'yes' },
    }
  },
}

/** Throw their weight behind the competition. */
const backRival: ActorActionDefinition<FactionActorTarget> = {
  id: 'back_rival',
  readable: 'back the competition',
  cost: 2,
  cooldownDays: 18,
  commitmentDays: 4,
  servesGoals: [FACTION_GOALS.SETTLE_THE_SCORE, FACTION_GOALS.GAIN_STANDING],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref || !capableOf(ref.id, 'back_rival')) return []
    if (activeStance(state, ref.id, 'rival_backing')) return []
    return [ref]
  },
  score: ({ perception }) => {
    const r = perception.readings
    const net = r['standingNet'] ?? 0
    if (net > -12 && (r['relationship'] ?? 50) > 35) return 0
    return Math.min(0.8, 0.2 + Math.abs(Math.min(0, net)) / 140)
  },
  perform: (ctx, { actor, goal }) => {
    const faction = ctx.state.world.factions[actor.ref.id]
    if (!faction) return { result: 'failed', readable: 'Nobody backed anybody.' }
    const stance = openStance(ctx, {
      factionId: faction.id,
      kind: 'rival_backing',
      strength: Math.min(90, 30 + Math.abs(standingNet(ctx.state, faction.id))),
      reason:
        worstGrievance(ctx.state, faction.id)?.readable ??
        `${faction.label} would rather deal with somebody else.`,
      goalId: goal.id,
    })
    if (!stance) return { result: 'failed', readable: 'Nothing came of it.' }
    return {
      result: 'succeeded',
      readable: `${faction.label} threw their weight behind the competition.`,
      learned: { backing_the_rival: 'yes' },
    }
  },
}

export const FACTION_ACTOR_ACTION_LIST: ReadonlyArray<
  ActorActionDefinition<FactionActorTarget>
> = [
  makeDemand,
  pledgeSupport,
  offerProtection,
  sponsorHouse,
  pressInspection,
  squeezeSupply,
  callBoycott,
  backRival,
]

// ---------------------------------------------------------------------------
// The daily pass
// ---------------------------------------------------------------------------

function ensureActor(
  slice: ReturnType<typeof getFactionModuleState>,
  state: TavernState,
  faction: FactionWorldState,
): ActorState {
  const existing = slice.actors[faction.id]
  if (existing) return { ...existing, goals: deriveGoals(state, faction) }
  return createActorState({
    ref: { kind: 'faction', id: faction.id },
    ownerModuleId: 'factions',
    budget: weeklyBudgetFor(faction),
    goals: deriveGoals(state, faction),
  })
}

/**
 * Decide, announce, and carry out.
 *
 * Runs at `factionUpdate`, before the day's traffic is forecast, so a
 * boycott that lands today is felt today rather than tomorrow. An actor
 * with an intent declared two or more days ago performs it now; one without
 * decides and announces. The two-day lead is the counterplay window: the
 * player sees "the Miners' Union mean to call a boycott" in one day's
 * report and has a full day of owner actions before it lands.
 */
export function runFactionActors(ctx: SimContext): void {
  ensureRequiredFactionsRegistered()
  const today = ctx.state.calendar.totalDaysElapsed
  const slice = getFactionModuleState(ctx.state)
  const factions = Object.values(ctx.state.world.factions).sort((a, b) =>
    a.id.localeCompare(b.id),
  )
  const nextActors: Record<string, ActorState> = {}

  for (const faction of factions) {
    let actor = ensureActor(slice, ctx.state, faction)

    // Weekly top-up on the first day of the week, tied to the calendar
    // rather than to a per-actor counter — so every faction's allowance
    // refreshes on the same day and a reload cannot hand one a second
    // allowance. The size of it is the influence they currently have.
    if (ctx.state.calendar.dayOfWeek === 1) {
      actor = { ...actor, budget: weeklyBudgetFor(faction) }
    }

    const intent = actor.intent
    if (intent && today - intent.decidedOnDay >= FACTION_INTENT_LEAD_DAYS) {
      const action = FACTION_ACTOR_ACTION_LIST.find((a) => a.id === intent.actionId)
      const target = intent.targetRef
      // Re-check eligibility on the day it lands, not on the day it was
      // decided. That is what makes the counterplay window real: a player
      // who settles the invoice, calms the room or answers the ask inside
      // the two days has removed the reason, and the move is dropped rather
      // than fired at a problem that no longer exists.
      const stillEligible =
        action !== undefined &&
        target !== undefined &&
        action
          .eligibleTargets(buildPerception(ctx.state, faction), ctx.state)
          .some((candidate) => candidate.kind === target.kind && candidate.id === target.id) &&
        action.score({
          target,
          goal:
            actor.goals.find((g) => g.id === intent.goalId) ?? actor.goals[0]!,
          perception: buildPerception(ctx.state, faction),
          state: ctx.state,
        }) > 0

      if (action && target && stillEligible) {
        const performed = performActorAction<FactionActorTarget>(ctx, {
          actor,
          action,
          target,
          goalId: intent.goalId,
        })
        actor = performed.actor
        recordFactionMove(ctx, {
          onDay: today,
          factionId: faction.id,
          actionId: action.id as FactionActionId,
          goalId: intent.goalId,
          result: performed.outcome.result,
          readable: performed.outcome.readable,
        })
        ctx.addLog(
          {
            message: performed.outcome.readable,
            level: 'info',
            data: { factionId: faction.id, actionId: action.id },
          },
          'factions',
        )
        nextActors[faction.id] = actor
        continue
      }
      // Either the intent no longer resolves, or the reason for it has gone.
      // Drop it rather than firing something arbitrary at a settled problem.
      const { intent: _dropped, ...withoutIntent } = actor
      actor = orderActorState(withoutIntent)
    } else if (intent) {
      // Announced, but not yet due. LEAVE IT ALONE.
      //
      // This is load-bearing and was got wrong the first time: re-deciding
      // every day rewrites `decidedOnDay`, so an intent with a lead longer
      // than one day would never age into being performed and the faction
      // would announce the same move forever without ever making it. An
      // announcement is a commitment for its own window.
      nextActors[faction.id] = actor
      continue
    }

    const { decision } = decideActorAction({
      actor,
      perception: buildPerception(ctx.state, faction),
      actions: FACTION_ACTOR_ACTION_LIST,
      state: ctx.state,
      today,
    })
    if (decision.status === 'decided') {
      const action = FACTION_ACTOR_ACTION_LIST.find((a) => a.id === decision.actionId)!
      actor = declareActorIntent(
        actor,
        decision,
        `${faction.label} mean to ${action.readable}.`,
        today,
      )
    } else if (actor.intent) {
      const { intent: _cleared, ...withoutIntent } = actor
      actor = orderActorState(withoutIntent)
    }
    nextActors[faction.id] = actor
  }

  writeFactionSlice(
    ctx,
    (current) => ({ ...current, actors: nextActors }),
    'faction_actors',
  )
}

/** Every announced-but-not-yet-taken faction move. Read by the report. */
export function listFactionIntents(state: {
  modules: Record<string, unknown>
}): Array<{
  factionId: string
  actionId: string
  readable: string
  decidedOnDay: number
}> {
  const slice = getFactionModuleState(state)
  return Object.entries(slice.actors)
    .filter(([, actor]) => actor.intent !== undefined)
    .map(([factionId, actor]) => ({
      factionId,
      actionId: actor.intent!.actionId,
      readable: actor.intent!.readable,
      decidedOnDay: actor.intent!.decidedOnDay,
    }))
    .sort((a, b) => a.factionId.localeCompare(b.factionId))
}

/** Withdraw an announced move — what a successful appeal buys. */
export function clearFactionIntent(ctx: SimContext, factionId: string): void {
  writeFactionSlice(
    ctx,
    (current) => {
      const actor = current.actors[factionId]
      if (!actor?.intent) return current
      const { intent: _dropped, ...rest } = actor
      return {
        ...current,
        actors: { ...current.actors, [factionId]: orderActorState(rest) },
      }
    },
    'clear_intent',
  )
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100))
}
