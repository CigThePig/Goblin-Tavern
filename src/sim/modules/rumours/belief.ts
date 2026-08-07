import type { SimContext } from '../../core/context'
import type { SocialRumourState, TavernState } from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import { addGroupedCause } from '../../contracts/causality/groupedCause'

import {
  MAX_COUNTER_DEPTH,
  audiencesOf,
  beliefOf,
  bumpRumourTotal,
  liveRumours,
  listRumours,
} from './rumourState'
import { isDamaging } from './channels'

// Expansion Phase 8 §8.4 — reinforcement, contradiction, correction, decay.
//
// THE DECAY IS THE OBLIGATION. `OBL-08` is "rumour decay … changes visible
// state without a matching cause", and the old daily pass was exactly that:
// it multiplied every rumour's strength by 0.85 in a bare loop, mutating
// `ctx.state.world.socialRumours` directly, and emitted ONE cause — only
// when something dropped out entirely. Every other day, every rumour in the
// world got quieter and nothing anywhere recorded why.
//
// It is now a GROUPED cause (Phase 1 §1.4's convention for high-volume
// homogeneous drift): one cause a day naming how many rumours faded and by
// how much, plus a per-rumour cause for any that crossed out of existence.
// Both go through `ctx.modifySocialRumour` rather than touching the record,
// so the mutation is inside the contract like everything else.
//
// CONTRADICTION AND CORRECTION ARE DIFFERENT THINGS, and §8.4 lists them
// separately for a reason. A CONTRADICTION is another rumour saying the
// opposite: both stay alive, both lose credibility, and audiences that hold
// both believe neither very much. A CORRECTION is the matter being settled
// — the story stops travelling and is marked, rather than quietly fading.

const SOURCE = 'rumours.belief'

/** Daily retention on a rumour nobody repeated. The Wave 7 rate, unchanged. */
export const RUMOUR_DAILY_RETENTION = 0.85

/**
 * Daily retention on a rumour that DID travel today.
 *
 * Not 1.0. A story reaching a new quarter this morning is still going quiet
 * in the quarters that heard it a week ago, and exempting it entirely made
 * an unanswered rumour effectively immortal — which put `rumour_pressure`
 * back on the ceiling for 16 of 28 days on the audit's never-managed route,
 * undoing Wave 7's de-saturation. Fading slowly while it spreads keeps the
 * loudest stories loud without letting them accumulate forever.
 */
export const RUMOUR_SPREADING_RETENTION = 0.95
/** Below this a rumour has stopped existing rather than idling. */
export const RUMOUR_FADE_FLOOR = 5
/** Belief fades faster than volume: people stop crediting before they stop repeating. */
export const BELIEF_DAILY_RETENTION = 0.9
/** Credibility lost by each side of a contradiction, per day it stands. */
const CONTRADICTION_CREDIBILITY_COST = 6

/**
 * Fade everything nobody repeated today, with a cause for all of it.
 *
 * Runs after propagation, so a rumour that was passed on today has already
 * had its strength raised and is not double-counted: the fade applies to
 * what is left over.
 */
export function decayRumours(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const rumours = listRumours(ctx.state)
  if (rumours.length === 0) return

  const faded: string[] = []
  const quietenedIds: string[] = []
  let totalLost = 0
  let quietened = 0

  for (const rumour of rumours) {
    const spreadToday = rumour.lastSpreadDay === today
    const retention = spreadToday
      ? RUMOUR_SPREADING_RETENTION
      : RUMOUR_DAILY_RETENTION
    const nextStrength = Math.round(rumour.strength * retention * 100) / 100

    // Belief fades whether or not the story was repeated — people stop
    // crediting a thing before they stop passing it on.
    const nextAudiences = audiencesOf(rumour).map((audience) => ({
      ...audience,
      belief: Math.round(audience.belief * BELIEF_DAILY_RETENTION),
    }))

    if (nextStrength < RUMOUR_FADE_FLOOR) {
      faded.push(rumour.id)
      // A rumour crossing out of existence is a MATERIAL deletion, so it
      // gets its own cause naming it rather than being folded into the
      // grouped one — §8.4: "all material decay and deletion must be
      // causally covered".
      ctx.removeSocialRumour(rumour.id, {
        source: `${SOURCE}.faded_out`,
        sourceType: 'rumour',
        target: rumour.id,
        targetType: 'rumour',
        amount: -rumour.strength,
        direction: 'decrease',
        readable: `"${rumour.label}" stopped being repeated and died out.`,
        tags: ['rumour', 'decay', 'faded_out', rumour.id],
        relatedActors: [{ kind: 'rumour', id: rumour.id }],
        relatedSystems: ['rumours'],
      })
      bumpRumourTotal(ctx, 'fadedOut')
      continue
    }

    const lost = Math.round((rumour.strength - nextStrength) * 100) / 100
    if (lost <= 0 && nextAudiences.every((a, i) => a.belief === audiencesOf(rumour)[i]?.belief)) {
      continue
    }
    totalLost += lost
    if (lost > 0) quietened += 1

    ctx.modifySocialRumour(
      rumour.id,
      { strength: nextStrength, audiences: nextAudiences },
      {
        // Distinct from the grouped `${SOURCE}.decay` below: a reader
        // filtering for the day's summary must not pick up one of the
        // per-rumour entries it summarises.
        source: `${SOURCE}.quietened`,
        sourceType: 'rumour',
        target: rumour.id,
        targetType: 'rumour',
        amount: -lost,
        direction: 'decrease',
        // Grouped: this cause exists so the change is inside the contract,
        // and the day's summary below is what a reader actually looks at.
        readable: `"${rumour.label}" quietened (${rumour.strength} → ${nextStrength}).`,
        tags: ['rumour', 'decay', rumour.id],
        relatedActors: [{ kind: 'rumour', id: rumour.id }],
        relatedSystems: ['rumours'],
      },
    )
    quietenedIds.push(rumour.id)
  }

  // The §1.4 grouped cause. Phase 1 built `addGroupedCause` for exactly this
  // family — "high-volume homogeneous drift (daily rumour/memory decay)" —
  // and it names every element it covers, so the audit counts each rumour as
  // attributed rather than seeing one anonymous global write.
  if (quietenedIds.length > 0) {
    addGroupedCause(ctx, {
      source: `${SOURCE}.decay`,
      sourceType: 'rumour',
      targetKind: 'rumour',
      targetType: 'rumour',
      targetIds: quietenedIds,
      totalAmount: -Math.round(totalLost),
      direction: 'decrease',
      readable: `${quietened} rumour${quietened === 1 ? '' : 's'} quietened — nobody repeated them today.`,
      tags: ['rumour', 'decay'],
      relatedSystems: ['rumours'],
    })
  }
}

/**
 * A rumour that keeps being confirmed gets easier to believe.
 *
 * Reinforcement is the counterweight to decay: talk that several
 * independent audiences hold, or that keeps being repeated, hardens. Without
 * it every rumour would eventually fade regardless of how true it was.
 */
export function reinforceRumours(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  for (const rumour of liveRumours(ctx.state)) {
    if (rumour.lastSpreadDay !== today) continue
    const audiences = audiencesOf(rumour)
    if (audiences.length < 2) continue
    const next = clampPercent((rumour.credibility ?? 50) + 4)
    if (next === (rumour.credibility ?? 50)) continue
    ctx.modifySocialRumour(
      rumour.id,
      { credibility: next },
      {
        source: `${SOURCE}.reinforced`,
        sourceType: 'rumour',
        target: rumour.id,
        targetType: 'rumour',
        amount: next - (rumour.credibility ?? 50),
        readable: `"${rumour.label}" is being heard from more than one direction now.`,
        tags: ['rumour', 'reinforced', rumour.id],
        relatedActors: [{ kind: 'rumour', id: rumour.id }],
        relatedSystems: ['rumours'],
      },
    )
  }
}

/**
 * Put a contradicting story about.
 *
 * Both rumours stay alive — that is what makes it a contradiction rather
 * than a correction — and both lose credibility while they stand against
 * each other. `MAX_COUNTER_DEPTH` stops the obvious recursion: a counter
 * cannot itself be countered, so there is no infinite ladder of rebuttals.
 */
export function openContradiction(
  ctx: SimContext,
  input: { rumourId: string; label: string; credibility: number; originRef?: SocialRumourState['originRef'] },
): SocialRumourState | undefined {
  const target = ctx.state.world.socialRumours[input.rumourId]
  if (!target) return undefined
  if (target.counterRumourId) return undefined
  // Anti-recursion: this rumour is itself somebody's counter.
  if (target.tags.includes('counter_rumour')) return undefined
  if ((counterDepth(ctx.state, target) ?? 0) >= MAX_COUNTER_DEPTH) return undefined

  const today = ctx.state.calendar.totalDaysElapsed
  const counter: SocialRumourState = {
    id: `counter_${target.id}`,
    label: input.label,
    originalLabel: input.label,
    strength: Math.max(20, Math.round(target.strength * 0.6)),
    accuracy: 'unknown',
    firstHeardDay: today,
    lastSpreadDay: today,
    tags: ['rumour', 'counter_rumour', 'favourable'],
    credibility: clampPercent(input.credibility),
    reach: target.reach ?? 'public',
    audiences: [],
    distortion: 0,
    hops: 0,
    counterRumourId: target.id,
    ...(input.originRef ? { originRef: input.originRef } : {}),
  }

  if (ctx.state.world.socialRumours[counter.id]) return undefined

  ctx.addSocialRumour(counter, {
    source: `${SOURCE}.counter`,
    sourceType: 'rumour',
    target: counter.id,
    targetType: 'rumour',
    amount: counter.strength,
    readable: `A contradicting story went about: "${counter.label}".`,
    tags: ['rumour', 'counter', counter.id, target.id],
    relatedActors: [{ kind: 'rumour', id: counter.id }],
    relatedSystems: ['rumours'],
  })
  ctx.modifySocialRumour(
    target.id,
    { counterRumourId: counter.id },
    {
      source: `${SOURCE}.contradicted`,
      sourceType: 'rumour',
      target: target.id,
      targetType: 'rumour',
      readable: `"${target.label}" is being contradicted.`,
      tags: ['rumour', 'contradicted', target.id],
      relatedActors: [{ kind: 'rumour', id: target.id }],
      relatedSystems: ['rumours'],
    },
  )
  bumpRumourTotal(ctx, 'contradicted')
  return counter
}

function counterDepth(state: TavernState, rumour: SocialRumourState): number {
  return rumour.tags.includes('counter_rumour') ? 1 : 0
  void state
}

/** Two stories standing against each other wear each other down. */
export function applyContradictions(ctx: SimContext): void {
  for (const rumour of liveRumours(ctx.state)) {
    const counterId = rumour.counterRumourId
    if (!counterId) continue
    const counter = ctx.state.world.socialRumours[counterId]
    if (!counter) continue
    for (const side of [rumour, counter]) {
      const next = clampPercent((side.credibility ?? 50) - CONTRADICTION_CREDIBILITY_COST)
      if (next === (side.credibility ?? 50)) continue
      ctx.modifySocialRumour(
        side.id,
        { credibility: next },
        {
          source: `${SOURCE}.contradiction`,
          sourceType: 'rumour',
          target: side.id,
          targetType: 'rumour',
          amount: -CONTRADICTION_CREDIBILITY_COST,
          direction: 'decrease',
          readable: `Nobody knows what to believe about "${side.label}" any more.`,
          tags: ['rumour', 'contradiction', side.id],
          relatedActors: [{ kind: 'rumour', id: side.id }],
          relatedSystems: ['rumours'],
        },
      )
    }
  }
}

/**
 * Settle it.
 *
 * A correction is not a fade: the rumour stops travelling, is marked with
 * the day it was put right, and its audiences stop believing it. It stays in
 * state so "that was settled last week" remains answerable, and the pruner
 * clears it on the normal schedule.
 */
export function correctRumour(
  ctx: SimContext,
  rumourId: string,
  readable: string,
): boolean {
  const rumour = ctx.state.world.socialRumours[rumourId]
  if (!rumour || rumour.correctedOnDay !== undefined) return false
  const today = ctx.state.calendar.totalDaysElapsed

  ctx.modifySocialRumour(
    rumourId,
    {
      correctedOnDay: today,
      credibility: 0,
      strength: Math.min(rumour.strength, RUMOUR_FADE_FLOOR + 1),
      audiences: audiencesOf(rumour).map((audience) => ({ ...audience, belief: 0 })),
    },
    {
      source: `${SOURCE}.corrected`,
      sourceType: 'rumour',
      target: rumourId,
      targetType: 'rumour',
      amount: -rumour.strength,
      direction: 'decrease',
      readable,
      tags: ['rumour', 'corrected', rumourId],
      relatedActors: [{ kind: 'rumour', id: rumourId }],
      relatedSystems: ['rumours'],
    },
  )
  bumpRumourTotal(ctx, 'corrected')
  return true
}

// ---------------------------------------------------------------------------
// The bounded input other domains read
// ---------------------------------------------------------------------------

export type RumourBeliefReading = {
  /** 0..100, the worst thing this audience currently credits about the house. */
  belief: number
  readable?: string
  rumourId?: string
}

/**
 * What this audience believes about the tavern, as one bounded reading.
 *
 * §8.4: "rumours should alter beliefs and decisions". This is the seam —
 * the only thing outside this module reads — and it deliberately returns a
 * READING rather than applying anything, so every domain decides for itself
 * what a rumour is worth to it.
 */
export function damagingBeliefFor(
  state: TavernState,
  audienceId: string,
): RumourBeliefReading {
  let worst = 0
  let chosen: SocialRumourState | undefined
  for (const rumour of liveRumours(state)) {
    if (!isDamaging(rumour)) continue
    const belief = beliefOf(rumour, audienceId)
    if (belief <= worst) continue
    worst = belief
    chosen = rumour
  }
  if (!chosen) return { belief: 0 }
  return {
    belief: worst,
    readable: `They believe "${chosen.label}" (${worst}).`,
    rumourId: chosen.id,
  }
}
