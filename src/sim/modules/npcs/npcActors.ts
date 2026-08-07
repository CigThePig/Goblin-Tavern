import type { SimContext } from '../../core/context'
import type { EntityRef, NotableNpcWorldState, TavernState } from '../../state/TavernState'
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
import { noteStanding } from '../factions/standing'
import { noteIncidentEvidence } from '../regulatory/evidence'

import {
  bumpNpcTotal,
  getNpcModuleState,
  openProposalFor,
  promotedNpcs,
  recordNpcMove,
  writeNpcSlice,
} from './npcState'
import { isAboutToday, noteDealing } from './dealings'
import { openProposal } from './npcEvents'
import type { NpcRecord } from './types'

// Expansion Phase 8 §8.3 — the promoted few take turns.
//
// THE ACTION SET IS SMALL ON PURPOSE. §8.3 asks for "a small action set" and
// "visible participation in service, factions, suppliers, regulation, or
// arcs" — five domains, five moves, one each, and every one lands in a
// system that already exists rather than in a meter of its own:
//
//   pay_a_visit         service     — they are in the room, and the house
//                                     knows it
//   put_in_a_word       factions    — their faction's standing ledger moves,
//                                     with them named as the reason
//   offer_terms         suppliers   — a real offer of goods or credit, with a
//                                     deadline the player answers
//   take_it_to_the_watch regulation — the regulator's own evidence intake
//   call_in_a_favour    arcs        — what they want back for all of it
//
// GOALS COME FROM WHAT THEY FRONT. A creditor wants paying; an inspector
// wants the place in order; a merchant prince wants a customer. The weights
// come from live state, so an inspector with no case open wants nothing much
// and takes no turn.
//
// WHY AN NPC ACTS RATHER THAN THEIR FACTION. 8.1 gave factions moves; this
// is not a duplicate. A faction acts institutionally and slowly — a boycott,
// a squeeze, a demand with a deadline. A promoted NPC is a PERSON who can be
// dealt with: they turn up, they can be talked to, they offer things
// factions cannot, and what they think of the owner personally
// (`ownerStanding`) is separate from what their faction thinks of the house.

/** Days between an NPC deciding and acting. Same fairness rule as factions. */
export const NPC_INTENT_LEAD_DAYS = 2

export const NPC_GOALS = {
  BE_PAID: 'be_paid',
  KEEP_ORDER: 'keep_order',
  DO_BUSINESS: 'do_business',
  BE_RESPECTED: 'be_respected',
} as const

type NpcTarget = EntityRef

/** An NPC's budget is the standing they have inside their own faction. */
export function weeklyBudgetFor(record: NpcRecord): number {
  return Math.max(1, Math.round(record.resources.standing / 25))
}

export function deriveGoals(
  state: TavernState,
  npc: NotableNpcWorldState,
  record: NpcRecord,
): ActorGoal[] {
  const owed = record.resources.favoursOwed
  const importance = record.importance

  const paidWeight = clamp01(
    (npc.kind === 'creditor' ? 0.4 : 0.05) +
      (owed > 0 ? 0.3 : 0) +
      (importance >= 60 ? 0.15 : 0),
  )
  const orderWeight = clamp01(
    (npc.kind === 'authority' ? 0.4 : 0.05) +
      ((state.pressures['violence']?.value ?? 0) >= 50 ? 0.2 : 0) +
      ((state.pressures['maintenance']?.value ?? 0) >= 55 ? 0.15 : 0),
  )
  const businessWeight = clamp01(
    (npc.kind === 'merchant_prince' || npc.kind === 'smuggler' ? 0.4 : 0.05) +
      ((state.pressures['stock_shortage']?.value ?? 0) >= 45 ? 0.25 : 0) +
      (record.ownerStanding >= 20 ? 0.15 : 0),
  )
  const respectWeight = clamp01(
    0.1 +
      (record.ownerStanding <= -20 ? 0.35 : 0) +
      (npc.kind === 'labour_lead' || npc.kind === 'priest' ? 0.2 : 0),
  )

  return [
    { id: NPC_GOALS.BE_PAID, weight: paidWeight, readable: 'Get what I am owed.' },
    { id: NPC_GOALS.KEEP_ORDER, weight: orderWeight, readable: 'Keep this place in order.' },
    { id: NPC_GOALS.DO_BUSINESS, weight: businessWeight, readable: 'Do business here.' },
    {
      id: NPC_GOALS.BE_RESPECTED,
      weight: respectWeight,
      readable: 'Be treated as somebody.',
    },
  ]
}

export function buildPerception(
  state: TavernState,
  npc: NotableNpcWorldState,
  record: NpcRecord,
): ActorPerception {
  const faction = npc.factionId ? state.world.factions[npc.factionId] : undefined
  return {
    readings: {
      importance: record.importance,
      ownerStanding: record.ownerStanding,
      dealings: record.interactionCount,
      coin: record.resources.coin,
      standing: record.resources.standing,
      favoursOwed: record.resources.favoursOwed,
      factionRelationship: faction?.relationship ?? 50,
      tavernCoin: state.coin,
      violence: state.pressures['violence']?.value ?? 0,
      maintenance: state.pressures['maintenance']?.value ?? 0,
      stockShortage: state.pressures['stock_shortage']?.value ?? 0,
      hasOpenProposal: openProposalFor(state, npc.id) ? 1 : 0,
      aboutToday: isAboutToday(state, record) ? 1 : 0,
    },
    // §8.3's "memories and beliefs" — beliefs accumulate on the ActorState
    // through `performActorAction`'s `learned`, so what an NPC has come to
    // think is carried between turns.
    beliefs: {},
    visibleTargets: [{ kind: 'notable_npc', id: npc.id }],
  }
}

function self(perception: ActorPerception): EntityRef[] {
  const ref = perception.visibleTargets[0]
  return ref ? [ref] : []
}

function recordFor(state: TavernState, npcId: string): NpcRecord | undefined {
  return getNpcModuleState(state).records[npcId]
}

// ---------------------------------------------------------------------------
// The action set
// ---------------------------------------------------------------------------

/**
 * Is another notable of this faction already speaking, or about to?
 *
 * Checks both a declared intent and a move made in the last few days, so the
 * faction speaks with one voice across the whole announce-then-act window
 * rather than only on the day itself.
 *
 * THE TIE-BREAK IS LOAD-BEARING and was got wrong the first time. Both watch
 * notables declare the same intent on the same evening, so a symmetric "is
 * anyone else speaking?" test blocked BOTH of them on the day they came to
 * act — a mutual deadlock in which the faction never spoke at all. Only an
 * NPC whose id sorts EARLIER can block you, so exactly one voice survives
 * and it is always the same one.
 */
function someoneElseIsSpeakingFor(
  state: TavernState,
  factionId: string,
  exceptNpcId: string,
): boolean {
  const today = state.calendar.totalDaysElapsed
  const slice = getNpcModuleState(state)

  for (const [npcId, actor] of Object.entries(slice.actors)) {
    if (npcId >= exceptNpcId) continue
    if (state.world.notableNpcs[npcId]?.factionId !== factionId) continue
    if (actor.intent?.actionId === 'put_in_a_word') return true
  }
  // A move already MADE blocks everybody, earlier id or not — the point of
  // the window is that the faction does not say the same thing twice.
  for (const move of slice.moveHistory) {
    if (move.npcId === exceptNpcId) continue
    if (move.actionId !== 'put_in_a_word') continue
    if (today - move.onDay > SAME_FACTION_VOICE_DAYS) continue
    if (state.world.notableNpcs[move.npcId]?.factionId === factionId) return true
  }
  return false
}

/** Days a faction speaks with one voice after one of its people has spoken. */
const SAME_FACTION_VOICE_DAYS = 6

/** Turn up. The cheapest move, and the one that makes them a person. */
const payAVisit: ActorActionDefinition<NpcTarget> = {
  id: 'pay_a_visit',
  readable: 'come by the house',
  cost: 1,
  cooldownDays: 5,
  commitmentDays: 0,
  servesGoals: [NPC_GOALS.DO_BUSINESS, NPC_GOALS.BE_RESPECTED],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref) return []
    const record = recordFor(state, ref.id)
    if (!record) return []
    // They come when their pattern says they are about.
    if (!isAboutToday(state, record)) return []
    return [ref]
  },
  score: ({ perception }) => {
    const r = perception.readings
    if ((r['ownerStanding'] ?? 0) <= -40) return 0
    return 0.25 + ((r['ownerStanding'] ?? 0) >= 20 ? 0.2 : 0)
  },
  perform: (ctx, { target }) => {
    const npc = ctx.state.world.notableNpcs[target.id]
    if (!npc) return { result: 'failed', readable: 'Nobody came.' }
    noteDealing(ctx, {
      npcId: npc.id,
      kind: 'visit',
      readable: `${npc.name.display} came by the house.`,
      weight: 2,
    })
    bumpNpcTotal(ctx, 'visitsMade')
    return {
      result: 'succeeded',
      readable: `${npc.name.display} came by the house.`,
      learned: { last_visit: String(ctx.state.calendar.totalDaysElapsed) },
    }
  },
}

/**
 * Speak up for — or against — the house inside their own faction.
 *
 * The authoritative change lands in the FACTIONS module's standing ledger
 * (8.1), which is the only thing that owns how a faction feels. What this
 * adds is a named person behind the entry, so "the guild have cooled on us"
 * becomes "their factor has been talking".
 */
const putInAWord: ActorActionDefinition<NpcTarget> = {
  id: 'put_in_a_word',
  readable: 'have a word with their people',
  cost: 1,
  cooldownDays: 9,
  commitmentDays: 1,
  servesGoals: [NPC_GOALS.BE_RESPECTED, NPC_GOALS.DO_BUSINESS],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref) return []
    const npc = state.world.notableNpcs[ref.id]
    if (!npc?.factionId || !state.world.factions[npc.factionId]) return []
    // ONE VOICE PER FACTION AT A TIME. The watch have two notable faces, and
    // without this both put the same word round on the same evening — which
    // reads as a duplicated line rather than as two people. Whoever has the
    // move in hand keeps it; the other finds something else to do.
    if (someoneElseIsSpeakingFor(state, npc.factionId, npc.id)) return []
    return [ref]
  },
  score: ({ perception }) => {
    const standing = perception.readings['ownerStanding'] ?? 0
    // Somebody with no opinion says nothing. It takes a view either way.
    if (Math.abs(standing) < 15) return 0
    return Math.min(0.7, 0.2 + Math.abs(standing) / 150)
  },
  perform: (ctx, { target }) => {
    const npc = ctx.state.world.notableNpcs[target.id]
    const record = recordFor(ctx.state, target.id)
    if (!npc?.factionId || !record) {
      return { result: 'failed', readable: 'Nobody said anything.' }
    }
    const faction = ctx.state.world.factions[npc.factionId]
    if (!faction) return { result: 'failed', readable: 'Nobody to tell.' }

    const favourable = record.ownerStanding > 0
    noteStanding(ctx, {
      factionId: npc.factionId,
      id: `npc_word_${npc.id}`,
      kind: favourable ? 'favour' : 'grievance',
      weight: Math.min(20, 6 + Math.abs(record.ownerStanding) / 8),
      readable: favourable
        ? `${npc.name.display} has been speaking well of the house to ${faction.label}.`
        : `${npc.name.display} has been running the house down to ${faction.label}.`,
      tags: ['npc', npc.id, favourable ? 'advocacy' : 'briefing'],
    })
    bumpNpcTotal(ctx, 'wordsPutIn')
    return {
      result: 'succeeded',
      readable: favourable
        ? `${npc.name.display} put in a word for the house with ${faction.label}.`
        : `${npc.name.display} put the word round ${faction.label} against the house.`,
      learned: { spoke_to_faction: favourable ? 'for' : 'against' },
    }
  },
}

/** Offer goods or coin, on terms, with a day the answer is wanted by. */
const offerTerms: ActorActionDefinition<NpcTarget> = {
  id: 'offer_terms',
  readable: 'put an offer to the house',
  cost: 2,
  cooldownDays: 12,
  commitmentDays: 3,
  servesGoals: [NPC_GOALS.DO_BUSINESS, NPC_GOALS.BE_PAID],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref) return []
    const npc = state.world.notableNpcs[ref.id]
    const record = recordFor(state, ref.id)
    if (!npc || !record) return []
    if (openProposalFor(state, ref.id)) return []
    // Only somebody with something to offer makes an offer.
    const canSupply = record.resources.goods.length > 0
    const canLend = npc.kind === 'creditor' && record.resources.coin >= 60
    if (!canSupply && !canLend) return []
    return [ref]
  },
  score: ({ perception }) => {
    const r = perception.readings
    if ((r['ownerStanding'] ?? 0) <= -25) return 0
    const shortage = (r['stockShortage'] ?? 0) >= 45 ? 0.3 : 0
    const skint = (r['tavernCoin'] ?? 0) < 120 ? 0.25 : 0
    if (shortage === 0 && skint === 0) return 0
    return 0.2 + shortage + skint
  },
  perform: (ctx, { target }) => {
    const npc = ctx.state.world.notableNpcs[target.id]
    const record = recordFor(ctx.state, target.id)
    if (!npc || !record) return { result: 'failed', readable: 'No offer came.' }
    const proposal = openProposal(ctx, npc, record)
    if (!proposal) {
      return { result: 'failed', readable: `${npc.name.display} had nothing to offer.` }
    }
    return {
      result: 'succeeded',
      readable: `${npc.name.display} put an offer to the house: ${proposal.readable}.`,
      learned: { made_offer: String(ctx.state.calendar.totalDaysElapsed) },
    }
  },
}

/**
 * Report the house to the watch.
 *
 * Goes through the regulatory domain's own evidence intake — the same seam
 * the faction move uses — so an NPC can make the watch curious but cannot
 * summon an inspector. Inspections are not theirs to write.
 */
const takeItToTheWatch: ActorActionDefinition<NpcTarget> = {
  id: 'take_it_to_the_watch',
  readable: 'take it to the watch',
  cost: 2,
  cooldownDays: 14,
  commitmentDays: 2,
  servesGoals: [NPC_GOALS.KEEP_ORDER, NPC_GOALS.BE_RESPECTED],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref) return []
    const npc = state.world.notableNpcs[ref.id]
    // Anybody may complain, but only somebody the watch will listen to gets
    // anywhere: an authority, or somebody with real standing.
    const record = recordFor(state, ref.id)
    if (!npc || !record) return []
    // An authority IS the watch. Somebody who runs the case does not report
    // the house to themselves — their weight goes through their own faction
    // (`put_in_a_word` on Town Watch), which is the same lever seen from the
    // inside. This is an outsider's move.
    if (npc.kind === 'authority') return []
    if (record.resources.standing < 45) return []
    return [ref]
  },
  score: ({ perception }) => {
    const r = perception.readings
    const visible = Math.max(r['violence'] ?? 0, r['maintenance'] ?? 0)
    const sour = (r['ownerStanding'] ?? 0) <= -20
    // They report what they can see. A quiet, tidy house gives them nothing.
    if (visible < 45 && !sour) return 0
    return Math.min(0.8, 0.2 + visible / 200 + (sour ? 0.2 : 0))
  },
  perform: (ctx, { target }) => {
    const npc = ctx.state.world.notableNpcs[target.id]
    if (!npc) return { result: 'failed', readable: 'Nobody said anything.' }
    const violence = ctx.state.pressures['violence']?.value ?? 0
    const maintenance = ctx.state.pressures['maintenance']?.value ?? 0
    noteIncidentEvidence(ctx, {
      subject: `npc-${npc.id}`,
      severity: Math.max(3, Math.round(Math.max(violence, maintenance) / 8)),
      readable: `${npc.name.display} had a word with the watch about this place.`,
      tags: ['npc', npc.id, 'report'],
    })
    bumpNpcTotal(ctx, 'reportsToWatch')
    return {
      result: 'succeeded',
      readable: `${npc.name.display} took it to the watch.`,
      learned: { reported_the_house: 'yes' },
    }
  },
}

/** Ask for what they are owed. */
const callInAFavour: ActorActionDefinition<NpcTarget> = {
  id: 'call_in_a_favour',
  readable: 'call in what they are owed',
  cost: 1,
  cooldownDays: 14,
  commitmentDays: 2,
  servesGoals: [NPC_GOALS.BE_PAID, NPC_GOALS.BE_RESPECTED],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref) return []
    const record = recordFor(state, ref.id)
    if (!record || record.resources.favoursOwed <= 0) return []
    if (openProposalFor(state, ref.id)) return []
    return [ref]
  },
  score: ({ perception }) => {
    const owed = perception.readings['favoursOwed'] ?? 0
    if (owed <= 0) return 0
    return Math.min(0.8, 0.3 + owed * 0.2)
  },
  perform: (ctx, { target }) => {
    const npc = ctx.state.world.notableNpcs[target.id]
    const record = recordFor(ctx.state, target.id)
    if (!npc || !record) return { result: 'failed', readable: 'Nobody asked.' }
    const proposal = openProposal(ctx, npc, record, 'favour_request')
    if (!proposal) {
      return { result: 'failed', readable: `${npc.name.display} let it lie.` }
    }
    bumpNpcTotal(ctx, 'favoursCalled')
    return {
      result: 'succeeded',
      readable: `${npc.name.display} called in what the house owes them.`,
      learned: { called_favour: 'yes' },
    }
  },
}

export const NPC_ACTOR_ACTION_LIST: ReadonlyArray<ActorActionDefinition<NpcTarget>> = [
  payAVisit,
  putInAWord,
  callInAFavour,
  offerTerms,
  takeItToTheWatch,
]

// ---------------------------------------------------------------------------
// The daily pass
// ---------------------------------------------------------------------------

function ensureActor(
  slice: ReturnType<typeof getNpcModuleState>,
  state: TavernState,
  npc: NotableNpcWorldState,
  record: NpcRecord,
): ActorState {
  const existing = slice.actors[npc.id]
  if (existing) return { ...existing, goals: deriveGoals(state, npc, record) }
  return createActorState({
    ref: { kind: 'notable_npc', id: npc.id },
    ownerModuleId: 'npcs',
    budget: weeklyBudgetFor(record),
    goals: deriveGoals(state, npc, record),
  })
}

/**
 * Decide, announce, and carry out — for the promoted only.
 *
 * Runs at `endDay`, when the day's outcome is known, because an NPC reacts
 * to how the evening went rather than setting it up. The two-day intent lead
 * is the same fairness rule the factions use: the player reads what somebody
 * means to do and has a turn to answer it.
 */
export function runNpcActors(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const promoted = promotedNpcs(ctx.state)
  const slice = getNpcModuleState(ctx.state)
  const nextActors: Record<string, ActorState> = {}

  for (const record of promoted) {
    const npc = ctx.state.world.notableNpcs[record.npcId]
    if (!npc) continue
    let actor = ensureActor(slice, ctx.state, npc, record)

    if (ctx.state.calendar.dayOfWeek === 1) {
      actor = { ...actor, budget: weeklyBudgetFor(record) }
    }

    const intent = actor.intent
    if (intent && today - intent.decidedOnDay >= NPC_INTENT_LEAD_DAYS) {
      const action = NPC_ACTOR_ACTION_LIST.find((a) => a.id === intent.actionId)
      const target = intent.targetRef
      const perception = buildPerception(ctx.state, npc, record)
      const stillEligible =
        action !== undefined &&
        target !== undefined &&
        action
          .eligibleTargets(perception, ctx.state)
          .some((candidate) => candidate.id === target.id) &&
        action.score({
          target,
          goal: actor.goals.find((g) => g.id === intent.goalId) ?? actor.goals[0]!,
          perception,
          state: ctx.state,
        }) > 0

      if (action && target && stillEligible) {
        const performed = performActorAction<NpcTarget>(ctx, {
          actor,
          action,
          target,
          goalId: intent.goalId,
        })
        actor = performed.actor
        recordNpcMove(ctx, {
          onDay: today,
          npcId: npc.id,
          actionId: action.id,
          goalId: intent.goalId,
          result: performed.outcome.result,
          readable: performed.outcome.readable,
        })
        ctx.addLog(
          {
            message: performed.outcome.readable,
            level: 'info',
            data: { npcId: npc.id, actionId: action.id },
          },
          'npcs',
        )
        nextActors[npc.id] = actor
        continue
      }
      const { intent: _dropped, ...withoutIntent } = actor
      actor = orderActorState(withoutIntent)
    } else if (intent) {
      // Announced but not yet due. Leave it alone — re-deciding would rewrite
      // `decidedOnDay` and the intent would never age into being performed.
      nextActors[npc.id] = actor
      continue
    }

    const { decision } = decideActorAction({
      actor,
      perception: buildPerception(ctx.state, npc, record),
      actions: NPC_ACTOR_ACTION_LIST,
      state: ctx.state,
      today,
    })
    if (decision.status === 'decided') {
      const action = NPC_ACTOR_ACTION_LIST.find((a) => a.id === decision.actionId)!
      actor = declareActorIntent(
        actor,
        decision,
        `${npc.name.display} means to ${action.readable}.`,
        today,
      )
    } else if (actor.intent) {
      const { intent: _cleared, ...withoutIntent } = actor
      actor = orderActorState(withoutIntent)
    }
    nextActors[npc.id] = actor
  }

  writeNpcSlice(ctx, (current) => ({ ...current, actors: nextActors }), 'npc_actors')
}

/** Every announced-but-not-yet-taken NPC move. Read by the report. */
export function listNpcIntents(state: {
  modules: Record<string, unknown>
}): Array<{ npcId: string; actionId: string; readable: string; decidedOnDay: number }> {
  const slice = getNpcModuleState(state)
  return Object.entries(slice.actors)
    .filter(([, actor]) => actor.intent !== undefined)
    .map(([npcId, actor]) => ({
      npcId,
      actionId: actor.intent!.actionId,
      readable: actor.intent!.readable,
      decidedOnDay: actor.intent!.decidedOnDay,
    }))
    .sort((a, b) => a.npcId.localeCompare(b.npcId))
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100))
}
