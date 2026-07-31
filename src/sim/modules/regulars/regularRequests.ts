import type { SimContext } from '../../core/context'
import type { RegularRequest, RegularWorldState } from '../../state/TavernState'
import { listPatronTabs } from '../service/tabs'
import { outstandingAmount } from '../../contracts/obligations/index'

import { favouriteAvailability } from './visits'
import { hasRecentMemory, rememberService } from './regularMemory'

// Expansion Phase 4 §4.3 "make requests or pursue a small goal".
//
// WHY A REQUEST RATHER THAN A MOOD. Everything else a regular does to the
// player is a consequence they discover after the fact: the loyalty already
// fell, the visit already did not happen. A request is the opposite — it is the
// person telling the player what they want BEFORE the consequence, which is the
// difference between a simulation that is fair and one that is merely
// unpredictable. It is also the smallest possible version of the plan's
// "beliefs and attribution must alter decisions": the belief is stated, the
// player can act on it, and refusing is a real choice with a real cost.
//
// FOUR REQUESTS, EACH FROM A CONDITION THE SIM ALREADY TRACKS. Nothing is
// invented to give them something to ask for: the favourite that ran out, the
// seat somebody else took, the room that turned into a brawl, the slate they
// cannot pay. One open request per person at a time, so the player is never
// facing a wall of demands, and each expires so an unanswered one resolves
// rather than hanging forever.

const SOURCE = 'regulars.requests'

/** Days a request stands before they stop expecting an answer. */
export const REQUEST_EXPIRY_DAYS = 7

/** Standing needed before somebody feels able to ask for anything. */
const MIN_STANDING_TO_ASK = 45

/** Coin owed before "write it off" becomes the thing they want most. */
const SLATE_REQUEST_THRESHOLD = 12

export function openRequestFor(
  regular: RegularWorldState,
): RegularRequest | undefined {
  return regular.openRequest?.status === 'open' ? regular.openRequest : undefined
}

/** What this regular currently owes across every live slate. */
function slateFor(ctx: SimContext, regularId: string): number {
  return listPatronTabs(ctx.state)
    .filter((record) => record.counterparty.id === regularId)
    .reduce((sum, record) => sum + outstandingAmount(record), 0)
}

/** Tonight's concrete party record, if this regular actually came in. */
function servedPartyFor(ctx: SimContext, regularId: string) {
  const service = ctx.state.modules['service'] as
    | {
        result?: {
          flow?: {
            ran?: boolean
            parties?: Array<{
              id: string
              regularId?: string
              outcome?: string
              areaId?: string
              wavesWaited?: number
              groupId: string
            }>
          }
          incidents?: Array<{ id: string; effects: string[] }>
        }
      }
    | undefined
  const flow = service?.result?.flow
  if (!flow?.ran) return undefined
  const party = flow.parties?.find(
    (candidate) =>
      candidate.regularId === regularId && candidate.outcome === 'served',
  )
  if (!party) return undefined
  return { party, incidents: service?.result?.incidents ?? [] }
}

/**
 * Decide what, if anything, each regular asks for today.
 *
 * Pure decision + one write per opened request. Deterministic: the conditions
 * are read off live state and the first matching one wins, so no RNG is
 * involved in what somebody wants — only in whether they turn up to say it.
 */
export function openRequests(
  ctx: SimContext,
  arrivingRegularIds: ReadonlyArray<string>,
): string[] {
  const today = ctx.state.calendar.totalDaysElapsed
  const opened: string[] = []
  const arrivals = new Set(arrivingRegularIds)
  const regulars = Object.values(ctx.state.world.regulars).sort((a, b) =>
    a.id.localeCompare(b.id),
  )
  for (const regular of regulars) {
    // Requests are conversations, not mail. A failed visit roll cannot expose
    // an action or start an expiry penalty for somebody who never arrived.
    if (!arrivals.has(regular.id)) continue
    if (openRequestFor(regular)) continue
    if (regular.stoppedVisiting) continue
    if ((regular.ownerStanding ?? 50) < MIN_STANDING_TO_ASK) continue

    const request = pickRequest(ctx, regular, today)
    if (!request) continue
    ctx.modifyRegular(
      regular.id,
      { openRequest: request },
      {
        source: `${SOURCE}.${request.kind}`,
        sourceType: 'regular',
        target: regular.id,
        targetType: 'regular',
        amount: 1,
        readable: request.readable,
        tags: ['regular', 'request', request.kind, regular.customerGroupId],
        relatedActors: [{ kind: 'regular', id: regular.id }],
        relatedSystems: ['regulars'],
      },
    )
    opened.push(regular.id)
  }
  return opened
}

function pickRequest(
  ctx: SimContext,
  regular: RegularWorldState,
  today: number,
): RegularRequest | undefined {
  const base = {
    openedOnDay: today,
    expiresOnDay: today + REQUEST_EXPIRY_DAYS,
    status: 'open' as const,
  }

  // 1. The slate they cannot clear. Most pressing, because it is the one that
  //    ends with them not coming back.
  const slate = slateFor(ctx, regular.id)
  if (slate >= SLATE_REQUEST_THRESHOLD) {
    return {
      ...base,
      id: `request_${regular.id}_slate_${today}`,
      kind: 'forgive_my_slate',
      readable: `${regular.name.display} asks you to wipe their ${slate}-coin slate.`,
    }
  }

  // 2. Their usual is off, and they have noticed.
  const favourite = favouriteAvailability(ctx.state, regular)
  if (favourite.subject && !favourite.available) {
    return {
      ...base,
      id: `request_${regular.id}_stock_${today}`,
      kind: 'stock_favourite',
      subjectId: favourite.subject,
      readable: `${regular.name.display} asks you to keep ${favourite.subject} on.`,
    }
  }

  // 3. They keep losing their table.
  if (
    regular.favoriteAreaId &&
    hasRecentMemory(regular, 'waited', today, REQUEST_EXPIRY_DAYS)
  ) {
    return {
      ...base,
      id: `request_${regular.id}_seat_${today}`,
      kind: 'keep_my_seat',
      subjectId: regular.favoriteAreaId,
      readable: `${regular.name.display} asks you to keep their spot in ${regular.favoriteAreaId} free.`,
    }
  }

  // 4. The room got ugly around them.
  if (hasRecentMemory(regular, 'incident', today, REQUEST_EXPIRY_DAYS)) {
    return {
      ...base,
      id: `request_${regular.id}_quiet_${today}`,
      kind: 'quieter_room',
      readable: `${regular.name.display} asks for somewhere quieter to drink.`,
    }
  }

  return undefined
}

export type RequestResolution = 'granted' | 'refused' | 'expired'

/**
 * Close a request, and make it matter.
 *
 * Granting is worth real standing and a memory that pulls them back in;
 * refusing or letting it lapse is worth the reverse. That asymmetry is the
 * point: a request the player can safely ignore is not a request.
 */
export function resolveRequest(
  ctx: SimContext,
  regular: RegularWorldState,
  resolution: RequestResolution,
  reason: string,
): boolean {
  const request = openRequestFor(regular)
  if (!request) return false
  ctx.modifyRegular(
    regular.id,
    {
      openRequest: {
        ...request,
        status: resolution === 'expired' ? 'expired' : resolution,
      },
    },
    {
      source: `${SOURCE}.${resolution}`,
      sourceType: 'regular',
      target: regular.id,
      targetType: 'regular',
      amount: resolution === 'granted' ? 1 : -1,
      readable: reason,
      tags: ['regular', 'request', resolution, regular.customerGroupId],
      relatedActors: [{ kind: 'regular', id: regular.id }],
      relatedSystems: ['regulars'],
    },
  )
  // Re-read: `rememberService` writes the meters, and it must see the record
  // that already carries the closed request.
  const live = ctx.state.world.regulars[regular.id]
  if (!live) return true
  if (resolution === 'granted') {
    rememberService(ctx, live, {
      kind: 'request_granted',
      readable: reason,
      standingDelta: 8,
    })
  } else {
    rememberService(ctx, live, {
      kind: 'request_ignored',
      readable: reason,
      standingDelta: -6,
    })
  }
  return true
}

/**
 * Expire requests nobody answered, and grant the ones the player answered
 * without meaning to.
 *
 * The second half matters more than it sounds: a player who restocks the ale
 * because they needed ale has, in fact, done what Grulk asked, and a
 * simulation that only counted the explicit action would be scoring
 * bookkeeping rather than outcomes.
 */
export function sweepRequests(ctx: SimContext): string[] {
  const today = ctx.state.calendar.totalDaysElapsed
  const resolved: string[] = []
  const regulars = Object.values(ctx.state.world.regulars).sort((a, b) =>
    a.id.localeCompare(b.id),
  )
  for (const regular of regulars) {
    const request = openRequestFor(regular)
    if (!request) continue

    if (request.kind === 'stock_favourite') {
      const favourite = favouriteAvailability(ctx.state, regular)
      if (favourite.available) {
        resolveRequest(
          ctx,
          regular,
          'granted',
          `${request.subjectId} is back on for ${regular.name.display}.`,
        )
        resolved.push(regular.id)
        continue
      }
    }
    if (request.kind === 'forgive_my_slate' && slateFor(ctx, regular.id) <= 0) {
      resolveRequest(
        ctx,
        regular,
        'granted',
        `${regular.name.display}'s slate is clear.`,
      )
      resolved.push(regular.id)
      continue
    }
    if (request.kind === 'keep_my_seat' && request.subjectId) {
      const visit = servedPartyFor(ctx, regular.id)
      if (visit?.party.areaId === request.subjectId) {
        resolveRequest(
          ctx,
          regular,
          'granted',
          `${regular.name.display}'s spot in ${request.subjectId} was kept.`,
        )
        resolved.push(regular.id)
        continue
      }
    }
    if (request.kind === 'quieter_room') {
      const visit = servedPartyFor(ctx, regular.id)
      const disruptive = visit?.incidents.some(
        (incident) =>
          (incident.id === 'minor_brawl' || incident.id === 'seating_conflict') &&
          incident.effects.some(
            (effect) =>
              effect === `party ${visit.party.id}` ||
              (effect.startsWith('parties ') &&
                effect
                  .slice('parties '.length)
                  .split('+')
                  .includes(visit.party.id)),
          ),
      )
      if (visit && !disruptive && (visit.party.wavesWaited ?? 0) < 2) {
        resolveRequest(
          ctx,
          regular,
          'granted',
          `${regular.name.display} got a quiet table without a long wait.`,
        )
        resolved.push(regular.id)
        continue
      }
    }

    if (today >= request.expiresOnDay) {
      resolveRequest(
        ctx,
        regular,
        'expired',
        `${regular.name.display} stopped waiting for an answer.`,
      )
      resolved.push(regular.id)
    }
  }
  return resolved
}
