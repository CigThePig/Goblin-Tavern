import type { SimContext } from '../../core/context'
import type { RegularWorldState, TavernState } from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import type { ServiceFlowResult, ServiceParty } from '../service/flow/types'
import type { ServiceIncidentSummary } from '../service/types'

import { rememberService } from './regularMemory'
import { BAD_VISITS_BEFORE_LAPSE, learnPreferences } from './visits'
import type { RegularVisitOutcome } from './types'

// Expansion Phase 4 §4.3 — reading a regular's night back off the flow.
//
// This is the half of the visit lifecycle that used not to exist. The old code
// credited a visit at the moment it was rolled, so "Grulk visited" and "Grulk
// was served" were the same fact and nothing that happened in between could
// change it. Now:
//
//   served         they got a table and their food. Visit counted, memory good,
//                  and they learn a usual seat and a usual dish from what they
//                  actually had.
//   abandoned      they sat and waited and left. Visit NOT counted — they were
//                  in the building, but the tavern did not serve them — and it
//                  goes on the record as a bad night.
//   turned_away    never got in at all. The worst of the three.
//   no_visit       they never set out, or their intent produced no party.
//
// THREE BAD NIGHTS AND THEY STOP COMING (§4.3 "stop visiting"). That is a
// recorded fact with a stated reason, not a probability that quietly goes to
// zero — so the player can be told, and so `returnCondition` has something
// specific to undo.

const SOURCE = 'regulars.outcome'

/** Word-of-mouth: how good a night has to be before they tell people. */
const RECOMMEND_LOYALTY = 70

function partyFor(
  flow: ServiceFlowResult,
  regularId: string,
): ServiceParty | undefined {
  return flow.parties.find((party) => party.regularId === regularId)
}

export function readServiceFlow(state: TavernState): ServiceFlowResult | undefined {
  const slice = state.modules['service'] as
    | { result?: { flow?: ServiceFlowResult } }
    | undefined
  const flow = slice?.result?.flow
  return flow?.ran ? flow : undefined
}

function readServiceIncidents(state: TavernState): ServiceIncidentSummary[] {
  const slice = state.modules['service'] as
    | { result?: { incidents?: ServiceIncidentSummary[] } }
    | undefined
  return slice?.result?.incidents ?? []
}

/**
 * Fold tonight into every regular who meant to come.
 *
 * Returns the per-regular outcome list for the module slice and the report.
 */
export function recordVisitOutcomes(
  ctx: SimContext,
  intentIds: ReadonlyArray<string>,
): { outcomes: RegularVisitOutcome[]; visited: string[]; stopped: string[] } {
  const flow = readServiceFlow(ctx.state)
  const outcomes: RegularVisitOutcome[] = []
  const visited: string[] = []
  const stopped: string[] = []
  const today = ctx.state.calendar.totalDaysElapsed

  for (const regularId of [...intentIds].sort((a, b) => a.localeCompare(b))) {
    const regular = ctx.state.world.regulars[regularId]
    if (!regular) continue
    const party = flow ? partyFor(flow, regularId) : undefined

    if (!party) {
      outcomes.push({
        regularId,
        outcome: 'no_visit',
        readable: `${regular.name.display} meant to come and did not.`,
      })
      continue
    }

    if (party.outcome === 'served') {
      visited.push(regularId)
      creditVisit(ctx, regular, party, flow!, today)
      outcomes.push({
        regularId,
        outcome: 'served',
        partyId: party.id,
        readable: `${regular.name.display} was served in ${party.areaId ?? 'the tavern'}.`,
      })
      continue
    }

    const turnedAway =
      party.outcome === 'abandoned_queue' || party.seatedWave === undefined
    const outcome: RegularVisitOutcome['outcome'] = turnedAway
      ? 'turned_away'
      : 'abandoned'
    recordBadNight(ctx, regular, outcome, party, stopped)
    outcomes.push({
      regularId,
      outcome,
      partyId: party.id,
      readable: turnedAway
        ? `${regular.name.display} could not get in.`
        : `${regular.name.display} sat waiting and gave up.`,
    })
  }

  return { outcomes, visited, stopped }
}

/** A good night. The only place `visits` goes up. */
function creditVisit(
  ctx: SimContext,
  regular: RegularWorldState,
  party: ServiceParty,
  flow: ServiceFlowResult,
  today: number,
): void {
  const gotFavourite = party.order.some(
    (line) => line.delivered > 0 && line.recipeId === regular.favoriteRecipeId,
  )
  const waited = party.wavesWaited >= 2

  ctx.modifyRegular(
    regular.id,
    {
      visits: regular.visits + 1,
      lastSeenDay: today,
      lastVisitOutcome: 'served',
      consecutiveBadVisits: 0,
    },
    {
      source: `${SOURCE}.visit`,
      sourceType: 'regular',
      target: regular.id,
      targetType: 'regular',
      amount: 1,
      readable: `${regular.name.display} came in and was served.`,
      tags: ['regular', 'visit', regular.customerGroupId],
      relatedActors: [{ kind: 'regular', id: regular.id }],
      relatedSystems: ['regulars', 'service'],
    },
  )

  const live = ctx.state.world.regulars[regular.id]
  if (!live) return

  const shortages = flow.shortagesByGroup[party.groupId] ?? []
  const shortageNotes = party.notes.filter(
    (note) => note.startsWith('No ') || note.startsWith('Ran out '),
  )
  const incidents = readServiceIncidents(ctx.state).filter(
    (incident) =>
      incident.actorGroup === party.groupId ||
      (party.areaId !== undefined && incident.areaId === party.areaId),
  )
  const rememberCurrent = (
    input: Parameters<typeof rememberService>[2],
  ): void => {
    const current = ctx.state.world.regulars[regular.id]
    if (current) rememberService(ctx, current, input)
  }

  // Preserve the adverse facts first. A served party can still have had a bad
  // night: their order ran short, the room erupted, or the kitchen made them
  // wait. These memory kinds are decision inputs, so leaving them unwritten
  // made the same regular return as if nothing had happened.
  let adverse = false
  if (shortageNotes.length > 0) {
    adverse = true
    const stockIds = [...new Set(shortages.map((entry) => entry.stockId))]
    rememberCurrent({
      kind: 'shortage',
      readable:
        stockIds.length > 0
          ? `${live.name.display}'s table ran short of ${stockIds.join(', ')}.`
          : `${live.name.display}'s order could not be filled.`,
    })
  }
  if (incidents.length > 0) {
    adverse = true
    const incidentIds = [...new Set(incidents.map((incident) => incident.id))]
    rememberCurrent({
      kind: 'incident',
      readable: `${live.name.display} was caught up in ${incidentIds.join(', ')}.`,
    })
  }
  if (waited) {
    adverse = true
    rememberCurrent({
      kind: 'waited',
      readable: `${live.name.display} waited ${party.wavesWaited} rounds to be served.`,
    })
  } else if (!adverse && gotFavourite) {
    rememberCurrent({
      kind: 'served_favourite',
      readable: `${live.name.display} got their usual.`,
      standingDelta: 2,
    })
  } else if (!adverse) {
    rememberCurrent({
      kind: 'good_service',
      readable: `${live.name.display} had a decent night.`,
    })
  }

  // They pick up a usual from what they actually did.
  const bestLine = [...party.order]
    .filter((line) => line.delivered > 0)
    .sort((a, b) =>
      b.delivered === a.delivered
        ? a.recipeId.localeCompare(b.recipeId)
        : b.delivered - a.delivered,
    )[0]
  const after = ctx.state.world.regulars[regular.id]
  if (after) {
    learnPreferences(ctx, after, {
      ...(party.areaId ? { areaId: party.areaId } : {}),
      ...(bestLine ? { recipeId: bestLine.recipeId } : {}),
    })
  }

  applyWordOfMouth(ctx, regular.id, adverse ? 'criticise' : 'recommend')
}

/** A bad night, and the third one in a row ends the relationship. */
function recordBadNight(
  ctx: SimContext,
  regular: RegularWorldState,
  outcome: 'abandoned' | 'turned_away',
  party: ServiceParty,
  stopped: string[],
): void {
  const runningTotal = (regular.consecutiveBadVisits ?? 0) + 1
  ctx.modifyRegular(
    regular.id,
    {
      lastVisitOutcome: outcome,
      consecutiveBadVisits: runningTotal,
    },
    {
      source: `${SOURCE}.${outcome}`,
      sourceType: 'regular',
      target: regular.id,
      targetType: 'regular',
      amount: -1,
      direction: 'decrease',
      readable:
        outcome === 'turned_away'
          ? `${regular.name.display} could not get a seat.`
          : `${regular.name.display} walked out unserved.`,
      tags: ['regular', outcome, regular.customerGroupId],
      relatedActors: [{ kind: 'regular', id: regular.id }],
      relatedSystems: ['regulars', 'service'],
    },
  )

  const live = ctx.state.world.regulars[regular.id]
  if (!live) return
  rememberService(ctx, live, {
    kind: outcome === 'turned_away' ? 'turned_away' : 'abandoned',
    readable:
      outcome === 'turned_away'
        ? `${live.name.display} was turned away from a full room.`
        : `${live.name.display} gave up after ${party.wavesWaited} rounds.`,
    standingDelta: -3,
  })

  applyWordOfMouth(ctx, regular.id, 'criticise')

  if (runningTotal < BAD_VISITS_BEFORE_LAPSE) return

  const reason =
    outcome === 'turned_away'
      ? 'never gets a seat here any more'
      : 'never gets served here any more'
  const today = ctx.state.calendar.totalDaysElapsed
  ctx.modifyRegular(
    regular.id,
    { stoppedVisiting: { sinceDay: today, reason } },
    {
      source: `${SOURCE}.lapsed`,
      sourceType: 'regular',
      target: regular.id,
      targetType: 'regular',
      amount: -1,
      direction: 'decrease',
      readable: `${regular.name.display} has stopped coming — ${reason}.`,
      tags: ['regular', 'lapsed', regular.customerGroupId],
      relatedActors: [{ kind: 'regular', id: regular.id }],
      relatedSystems: ['regulars', 'service'],
    },
  )
  ctx.addMemory({
    id: 'regular_stopped_visiting',
    source: SOURCE,
    actors: [
      { kind: 'regular', id: regular.id },
      { kind: 'customer_group', id: regular.customerGroupId },
    ],
    tags: ['regular', 'lapsed', regular.customerGroupId],
    metadata: { regularId: regular.id, reason },
  })
  ctx.addHistory({
    category: 'service',
    summary: `${regular.name.display} stopped coming in (${reason}).`,
    tags: ['regular', 'lapsed'],
    relatedActors: [{ kind: 'regular', id: regular.id }],
    relatedSystems: ['regulars'],
    mechanicalRefs: [regular.id],
  })
  stopped.push(regular.id)
}

/**
 * §4.3 "recommend, criticize, or stop visiting".
 *
 * Word of mouth moves the GROUP's patronage, in small increments and only from
 * regulars who are strongly enough for or against the place to be worth
 * listening to. It is deliberately slow: a regular is one voice, and this is
 * the seam Phase 8's rumour propagation will widen into a channel.
 */
function applyWordOfMouth(
  ctx: SimContext,
  regularId: string,
  direction: 'recommend' | 'criticise',
): void {
  const regular = ctx.state.world.regulars[regularId]
  if (!regular) return
  const group = ctx.state.customerGroups[regular.customerGroupId]
  if (!group) return

  const speaksUp =
    direction === 'recommend'
      ? regular.loyalty >= RECOMMEND_LOYALTY
      : regular.irritation >= 55
  if (!speaksUp) return

  const counts = regular.wordOfMouth ?? { recommendations: 0, criticisms: 0 }
  const next =
    direction === 'recommend'
      ? { ...counts, recommendations: counts.recommendations + 1 }
      : { ...counts, criticisms: counts.criticisms + 1 }
  ctx.modifyRegular(regular.id, { wordOfMouth: next }, {
    source: `${SOURCE}.word_of_mouth`,
    sourceType: 'regular',
    target: regular.id,
    targetType: 'regular',
    readable:
      direction === 'recommend'
        ? `${regular.name.display} spoke well of the place.`
        : `${regular.name.display} told people to drink elsewhere.`,
    tags: ['regular', 'word_of_mouth', direction],
    relatedActors: [{ kind: 'regular', id: regular.id }],
    relatedSystems: ['regulars'],
  })

  const delta = direction === 'recommend' ? 1 : -1
  const patronage = clampPercent(group.patronage + delta)
  if (patronage === group.patronage) return
  ctx.modifyCustomerGroup(
    group.id,
    { patronage },
    {
      source: 'regulars.word_of_mouth',
      sourceType: 'regular',
      direction: direction === 'recommend' ? 'increase' : 'decrease',
      amount: delta,
      readable:
        direction === 'recommend'
          ? `${regular.name.display} brought word to the ${group.label}.`
          : `${regular.name.display} warned the ${group.label} off.`,
      tags: ['regular', 'word_of_mouth', group.id],
      relatedActors: [
        { kind: 'regular', id: regular.id },
        { kind: 'customer_group', id: group.id },
      ],
      relatedSystems: ['regulars', 'customers'],
    },
  )
}
