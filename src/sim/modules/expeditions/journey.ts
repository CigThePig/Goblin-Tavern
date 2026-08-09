import type { SimContext } from '../../core/context'
import type {
  Expedition,
  ExpeditionTargetTier,
  TavernState,
} from '../../state/TavernState'
import { createRng, type SimRng } from '../../core/rng'
import { stockRegistry } from '../../registries/stockRegistry'
import {
  expeditionEventRegistry,
  MAX_EXPEDITION_EVENTS,
  type ExpeditionEventDefinition,
  type ExpeditionEventEffects,
  type ExpeditionEventOption,
} from '../../content/expeditions/expeditionEvents'
import {
  expeditionRouteRegistry,
  type ExpeditionRoute,
} from '../../content/expeditions/expeditionRoutes'

import {
  MAX_DISPATCHES,
  bumpExpeditionTotal,
  getExpeditionRun,
  writeExpeditionRun,
  type ExpeditionDispatch,
  type ExpeditionPhase,
  type ExpeditionRun,
} from './runState'

// Expansion Phase 9 §9.3 — the days between setting out and coming home.
//
// WHAT WAS BROKEN. Phase 70's tick was two lines: add one to `daysElapsed`,
// and when it reached `daysTotal` make a single roll that decided the whole
// trip. §9.3 calls that a "final-result roll" and asks for a journey — legs,
// supplies, intermediate events, decisions, injury, delay, retreat, rescue,
// recall and loss — with word of it all arriving late.
//
// THE SEED IS THE SPINE. §9.3 requires expedition seeds "stable from
// commission through resolution", and everything here derives its stream
// from the seed stored on the expedition at COMMISSION time plus an index
// that only goes up: `<seed>:expedition_<id>_event_<n>`. Not the day's input
// seed, not a counter in the slice. So the same commission produces the same
// journey whatever day it resolves on, however the save is reloaded, and
// however many other expeditions are running alongside it.
//
// THE PARTY IS NEVER SURPRISED INTO A DECISION. An event that asks something
// gives the party a stated number of days to wait. If word does not get home
// and back in time they take the cautious option themselves — which is what
// makes a route four days out genuinely darker than one two days out.

const SOURCE = 'expeditions.journey'

/** Hazard at or above this is where a party stops coming back. */
export const LOSS_HAZARD_THRESHOLD = 85
/** Morale at or below this and they turn around on their own. */
export const RETREAT_MORALE_THRESHOLD = 15

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

export function routeFor(routeId: string): ExpeditionRoute | undefined {
  return expeditionRouteRegistry.has(routeId)
    ? expeditionRouteRegistry.get(routeId)
    : undefined
}

/**
 * A stream for one specific roll on one specific expedition.
 *
 * The index is what makes it stable AND distinct: roll five is roll five
 * whenever it is taken, and never the same stream as roll four.
 */
export function journeyStream(
  expeditionSeed: string,
  expeditionId: string,
  purpose: string,
  index: number,
): SimRng {
  return createRng(`${expeditionSeed}:expedition_${expeditionId}_${purpose}_${index}`, 0)
}

// ---------------------------------------------------------------------------
// Dispatches — §9.3 delayed information
// ---------------------------------------------------------------------------

export function queueDispatch(
  ctx: SimContext,
  expeditionId: string,
  route: ExpeditionRoute,
  kind: ExpeditionDispatch['kind'],
  readable: string,
): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const dispatch: ExpeditionDispatch = {
    sentOnDay: today,
    arrivesOnDay: today + route.wordDelayDays,
    readable,
    kind,
  }
  writeExpeditionRun(
    ctx,
    expeditionId,
    (run) => {
      const next = [...run.dispatches, dispatch]
      return {
        ...run,
        dispatches:
          next.length > MAX_DISPATCHES ? next.slice(next.length - MAX_DISPATCHES) : next,
      }
    },
    'dispatch',
  )
}

// ---------------------------------------------------------------------------
// Who went — Phase 77's contract, kept alive inside the journey
// ---------------------------------------------------------------------------

/**
 * How good this party is, 0..100.
 *
 * Phase 77 made `experience`, `reliability` and `specialty` real: they set
 * what a runner costs and what a trip is likely to come to. §9.3 replaced
 * the trip's single closing roll with a journey, and the party has to reach
 * INTO that journey or the fields go back to being decoration. So the same
 * number that priced the commission also decides how often the road catches
 * them out, how badly it hurts when it does, and whether the day they spend
 * searching turns anything up.
 *
 * Members who are already gone from the roster are not counted; a party of
 * ghosts falls back to the middle of the scale rather than to zero, because
 * an unknown party is average, not incompetent.
 */
export function partySkill(state: TavernState, run: ExpeditionRun): number {
  const members = run.partyRunnerIds
    .map((id) => state.world.hireableAdventurers[id])
    .filter((member): member is NonNullable<typeof member> => Boolean(member))
  if (members.length === 0) return 50
  const total = members.reduce(
    (sum, member) => sum + (member.experience + member.reliability) / 2,
    0,
  )
  return clamp(total / members.length, 0, 100)
}

/** The tier this trip could actually bring back, from where it went. */
export function tierForRun(
  expedition: Expedition,
  run: ExpeditionRun,
): ExpeditionTargetTier {
  const route = routeFor(run.routeId)
  if (expedition.mode === 'targeted' && expedition.targetIngredientId) {
    if (stockRegistry.has(expedition.targetIngredientId)) {
      const rarity = stockRegistry.get(expedition.targetIngredientId).defaultState
        .rarity
      if (rarity === 'common') return 'uncommon'
      return rarity
    }
  }
  if (expedition.targetTier && route?.yields.includes(expedition.targetTier)) {
    return expedition.targetTier
  }
  return route?.yields[route.yields.length - 1] ?? 'uncommon'
}

/** Does anybody on the trip know this kind of ground? */
export function partyHasSpecialty(
  state: TavernState,
  run: ExpeditionRun,
  tier: ExpeditionTargetTier,
): boolean {
  return run.partyRunnerIds.some(
    (id) => state.world.hireableAdventurers[id]?.specialty === tier,
  )
}

/**
 * The floor a competent party searches from, before the tier is subtracted.
 *
 * Named rather than folded into the formula because it is the balance dial
 * for the whole expedition loop: raise it and every trip pays, lower it and
 * nobody bothers sending anyone.
 */
export const SEARCH_BASE = 25

/** How hard the thing they went for is to find at all. */
function searchDifficulty(tier: ExpeditionTargetTier): number {
  return tier === 'legendary' ? 55 : tier === 'rare' ? 35 : 15
}

/**
 * The working day at the site.
 *
 * Everything the trip has been through so far is priced in — a party that
 * arrives hungry, hurt and frightened searches badly — but the party's own
 * competence is the largest term, which is what makes hiring the right
 * runner a decision rather than a price.
 */
export function runSiteSearch(
  ctx: SimContext,
  expedition: Expedition,
  run: ExpeditionRun,
): void {
  if (run.foundAtSite !== undefined) return
  const tier = tierForRun(expedition, run)
  const skill = partySkill(ctx.state, run)
  const specialty = partyHasSpecialty(ctx.state, run, tier)
  // The `+ SEARCH_BASE` is what stops the trip being a coin flip for a
  // competent party: the house's best starter runner, sent on-tier to the
  // route that yields it, comes home with the thing about two trips in
  // three. Without it the same runner failed more often than not, which
  // made the whole loop feel like a tax rather than a wager — and made the
  // choice between runners invisible, because everybody lost.
  const score = clamp(
    SEARCH_BASE +
      skill +
      (specialty ? 15 : 0) +
      (run.morale - 50) / 4 -
      searchDifficulty(tier) -
      run.hazard / 4 -
      run.hungryDays * 8 -
      run.injuredRunnerIds.length * 10,
    5,
    95,
  )
  // Keyed by the ROUTE as well as the expedition: two parties sent out on
  // the same day to different places are on different trips, and sharing one
  // stream would have them find or miss in lockstep.
  const rng = journeyStream(
    expedition.seed,
    expedition.id,
    `search_${run.routeId}`,
    0,
  )
  const found = rng.int(1, 100) <= score
  writeExpeditionRun(
    ctx,
    expedition.id,
    (current) => ({ ...current, foundAtSite: found, searchScore: score }),
    'search',
  )
  const route = routeFor(run.routeId)
  if (route) {
    queueDispatch(
      ctx,
      expedition.id,
      route,
      'progress',
      found
        ? `They found what they went to ${route.label} for.`
        : `They worked ${route.label} and turned up nothing.`,
    )
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

function eventEligible(
  definition: ExpeditionEventDefinition,
  route: ExpeditionRoute,
  run: ExpeditionRun,
): boolean {
  if (definition.terrains && !definition.terrains.includes(route.terrain)) {
    // A route may still whitelist an event its terrain would not allow.
    if (!route.localEventIds.includes(definition.id)) return false
  }
  if (definition.minDanger !== undefined && route.danger < definition.minDanger) {
    return false
  }
  if (definition.phases && run.phase !== 'home') {
    if (!definition.phases.includes(run.phase)) return false
  }
  // One of each per trip. A party does not lose the same trail twice.
  if (run.events.some((entry) => entry.eventId === definition.id)) return false
  return true
}

/**
 * Which event, if any, happens today.
 *
 * Deterministic: the chance and the pick both come from the run's own
 * indexed stream. `MAX_EXPEDITION_EVENTS` is the §9.3 bound, and it is per
 * EXPEDITION rather than per day — a long route is a riskier trip, not a
 * longer story.
 */
export function pickEventForToday(
  expedition: Expedition,
  run: ExpeditionRun,
  route: ExpeditionRoute,
  dayOfTrip: number,
  skill = 50,
): ExpeditionEventDefinition | undefined {
  if (run.events.length >= MAX_EXPEDITION_EVENTS) return undefined
  if (run.pendingDecision) return undefined
  if (run.phase === 'home') return undefined

  // INDEXED BY THE DAY OF THE TRIP, not by how many events have happened.
  //
  // An earlier draft indexed by `run.events.length`, which meant the stream
  // was rebuilt identically every day until something fired — so if the
  // first draw came up above the threshold, it came up above the threshold
  // for ever and the expedition could never have an event at all. The day
  // of the trip is monotonic, reproducible from the commission, and
  // independent of the day's input seed, which is what §9.3's "stable from
  // commission through resolution" actually asks for.
  const rng = journeyStream(expedition.seed, expedition.id, 'event', dayOfTrip)

  // Danger sets how often anything happens at all. A road trip is mostly
  // uneventful; the Underdeep is mostly not — and a party that knows what it
  // is doing walks into less of it, which is the first place Phase 77's
  // experience and reliability reach into the journey.
  const base = 0.1 + (route.danger / 100) * 0.3
  const chance = Math.max(0.03, base * (1 - (skill - 50) / 150))
  if (rng.float() >= chance) return undefined

  const candidates = [...expeditionEventRegistry.all()]
    .filter((definition) => eventEligible(definition, route, run))
    .sort((a, b) => a.id.localeCompare(b.id))
  if (candidates.length === 0) return undefined

  return rng.weightedPick(
    candidates.map((definition) => ({ item: definition, weight: definition.weight })),
  )
}

/** Options a party can actually take, given what they are carrying. */
export function affordableOptions(
  definition: ExpeditionEventDefinition,
  run: ExpeditionRun,
): ExpeditionEventOption[] {
  if (!definition.decision) return []
  return definition.decision.options.filter((option) => {
    if (option.id === 'use_the_medicine') return run.medicine > 0
    if (option.requiresSupplies !== undefined) {
      return run.supplies >= option.requiresSupplies
    }
    return true
  })
}

export function applyEventEffects(
  run: ExpeditionRun,
  effects: ExpeditionEventEffects,
  injured: boolean,
): ExpeditionRun {
  return {
    ...run,
    supplies: Math.max(0, run.supplies - (effects.supplies ?? 0)),
    morale: clamp(run.morale + (effects.morale ?? 0), 0, 100),
    hazard: clamp(run.hazard + (effects.hazard ?? 0), 0, 100),
    delayDays: Math.max(0, run.delayDays + (effects.delayDays ?? 0)),
    haulBonus: Math.max(0, Math.round((run.haulBonus + (effects.haulBonus ?? 0)) * 100) / 100),
    roadCosts: run.roadCosts + (effects.coinCost ?? 0),
    injuredRunnerIds: injured
      ? [...new Set([...run.injuredRunnerIds, ...pickInjured(run)])]
      : run.injuredRunnerIds,
  }
}

function pickInjured(run: ExpeditionRun): string[] {
  const healthy = run.partyRunnerIds.filter(
    (id) => !run.injuredRunnerIds.includes(id),
  )
  const first = healthy[0] ?? run.partyRunnerIds[0]
  return first ? [first] : []
}

/**
 * Take a decision — by the player answering, or by the deadline passing.
 *
 * `byDefault` is recorded rather than inferred, because "they waited as long
 * as they could and then did the careful thing" is a different story from
 * "the house told them to", and the report should be able to tell them
 * apart.
 */
export function resolveDecision(
  ctx: SimContext,
  expedition: Expedition,
  optionId: string,
  byDefault: boolean,
): boolean {
  const run = getExpeditionRun(ctx.state, expedition.id)
  if (!run?.pendingDecision) return false
  const route = routeFor(run.routeId)
  if (!route) return false
  const definition = expeditionEventRegistry.has(run.pendingDecision.eventId)
    ? expeditionEventRegistry.get(run.pendingDecision.eventId)
    : undefined
  if (!definition?.decision) return false
  const option =
    definition.decision.options.find((entry) => entry.id === optionId) ??
    definition.decision.options.find(
      (entry) => entry.id === definition.decision!.defaultOptionId,
    )
  if (!option) return false

  const eventIndex = run.pendingDecision.eventIndex
  const injuryRng = journeyStream(
    expedition.seed,
    expedition.id,
    'injury',
    eventIndex,
  )
  const injured =
    option.effects.injuryChance !== undefined &&
    injuryRng.float() < option.effects.injuryChance

  writeExpeditionRun(
    ctx,
    expedition.id,
    (current) => {
      const applied = applyEventEffects(current, option.effects, injured)
      const { pendingDecision: _cleared, ...rest } = applied
      return {
        ...rest,
        // Using the medicine is the one option that spends a distinct
        // stock, so it is spent here rather than through `supplies`.
        medicine:
          option.id === 'use_the_medicine'
            ? Math.max(0, current.medicine - 1)
            : current.medicine,
        events: current.events.map((entry) =>
          entry.index === eventIndex
            ? { ...entry, chosenOptionId: option.id, chosenByDefault: byDefault }
            : entry,
        ),
        ...(option.retreats && current.terminal === undefined
          ? {
              phase: 'returning' as ExpeditionPhase,
              dayInLeg: 0,
              retreatedOnDay: current.retreatedOnDay ?? ctx.state.calendar.totalDaysElapsed,
            }
          : {}),
      }
    },
    byDefault ? 'decision_default' : 'decision_answered',
  )

  bumpExpeditionTotal(
    ctx,
    byDefault ? 'decisionsDefaulted' : 'decisionsAnswered',
  )
  queueDispatch(
    ctx,
    expedition.id,
    route,
    'event',
    byDefault
      ? `No word came in time. ${option.readable}`
      : option.readable,
  )
  if (injured) {
    queueDispatch(
      ctx,
      expedition.id,
      route,
      'trouble',
      'Somebody was hurt doing it.',
    )
  }
  if (option.retreats) {
    queueDispatch(ctx, expedition.id, route, 'trouble', 'They are coming back.')
  }
  return true
}

// ---------------------------------------------------------------------------
// The day
// ---------------------------------------------------------------------------

export type JourneyStep = {
  expeditionId: string
  /** Set when the trip ended today. */
  terminal?: ExpeditionRun['terminal']
  readable: string
}

/**
 * Walk one expedition one day forward.
 *
 * Order matters and is argued for in place: a waiting party still eats, a
 * deadline is checked before the day is spent so an answer that arrives on
 * the last morning still counts, and the trouble check runs after the day's
 * event so a party can be finished off by what happened today rather than
 * only by what had happened before it.
 */
export function advanceExpeditionDay(
  ctx: SimContext,
  expedition: Expedition,
): JourneyStep | undefined {
  const run = getExpeditionRun(ctx.state, expedition.id)
  if (!run || run.terminal !== undefined) return undefined
  const route = routeFor(run.routeId)
  if (!route) return undefined
  const today = ctx.state.calendar.totalDaysElapsed

  // 1. AN ANSWER DUE TODAY ARRIVES BEFORE THE PARTY GIVES UP WAITING.
  //
  // `openQuestions` offers an answer whenever it can get there by the
  // deadline — `today + wordDelayDays <= deadlineDay` — so a reply landing
  // exactly ON the deadline is one the house was explicitly invited to
  // send. Resolving the default first threw that reply away: the default
  // cleared `pendingDecision`, the arrival block found nothing to apply,
  // and the player had spent an action on an answer that never happened.
  // The rider gets there in the morning; the party stops waiting at the end
  // of the day.
  applyArrivedAnswer(ctx, expedition, route, today)

  // 2. A question nobody answered in time is answered by the party.
  const afterAnswer = getExpeditionRun(ctx.state, expedition.id) ?? run
  if (afterAnswer.pendingDecision && today >= afterAnswer.pendingDecision.deadlineDay) {
    resolveDecision(ctx, expedition, afterAnswer.pendingDecision.defaultOptionId, true)
  }

  // 2. The day is spent: rations go whether they are walking or waiting.
  const partySize = Math.max(1, run.partyRunnerIds.length)
  const eaten = route.provisionsPerDay * partySize
  writeExpeditionRun(
    ctx,
    expedition.id,
    (current) => {
      // Hungry means there was nothing in the packs when today started —
      // not that today emptied them.
      const hungry = current.supplies <= 0
      return {
        ...current,
        supplies: Math.max(0, current.supplies - eaten),
        hungryDays: current.hungryDays + (hungry ? 1 : 0),
        // Short rations tell on a party quickly, and the hazard they run is
        // the honest consequence of the loadout the player chose.
        morale: clamp(current.morale + (hungry ? -10 : 0), 0, 100),
        hazard: clamp(current.hazard + (hungry ? 8 : 0), 0, 100),
      }
    },
    'day',
  )

  // 2b. ORDERS GIVEN DAYS AGO CATCH UP WITH THEM TODAY. Checked before they
  // walk, so the day something lands is the day it changes what they do
  // rather than one leg later. All three of the house's moves ride out at
  // the route's own speed — the recall, the answer to a question they
  // asked, and the relief — because a route four days out has to be four
  // days out in both directions or the delay is only a caption.
  const carrying = getExpeditionRun(ctx.state, expedition.id)
  if (
    carrying &&
    carrying.recallReachesOnDay !== undefined &&
    today >= carrying.recallReachesOnDay &&
    carrying.phase !== 'returning' &&
    carrying.phase !== 'home'
  ) {
    applyRecallArrival(ctx, expedition.id, today)
    queueDispatch(
      ctx,
      expedition.id,
      route,
      'progress',
      'The recall reached them and they turned for home.',
    )
  }

  const withRelief = getExpeditionRun(ctx.state, expedition.id)
  if (
    withRelief?.reliefReachesOnDay !== undefined &&
    withRelief.reliefArrivedOnDay === undefined &&
    today >= withRelief.reliefReachesOnDay
  ) {
    writeExpeditionRun(
      ctx,
      expedition.id,
      (current) => ({
        ...current,
        reliefArrivedOnDay: today,
        supplies: current.supplies + 6,
        medicine: current.medicine + 1,
        morale: clamp(current.morale + 15, 0, 100),
        hazard: clamp(current.hazard - 12, 0, 100),
      }),
      'relief_arrived',
    )
    queueDispatch(
      ctx,
      expedition.id,
      route,
      'progress',
      'The relief found them.',
    )
  }

  // 3. Walking, unless they are stood still waiting on an answer.
  const waiting = getExpeditionRun(ctx.state, expedition.id)?.pendingDecision
  if (!waiting) {
    advanceLeg(ctx, expedition, route)
  }

  // 3b. If today is the day they arrived, today is the day they look. The
  // search is the one roll left that asks who the party actually is, and it
  // happens on arrival rather than on return so everything that went wrong
  // getting there is already priced into it.
  const arrived = getExpeditionRun(ctx.state, expedition.id)
  if (arrived && arrived.phase === 'at_site' && arrived.foundAtSite === undefined) {
    runSiteSearch(ctx, expedition, arrived)
  }

  // 4. Something may happen.
  const afterLeg = getExpeditionRun(ctx.state, expedition.id)
  if (afterLeg && afterLeg.terminal === undefined && !afterLeg.pendingDecision) {
    fireEventIfAny(
      ctx,
      expedition,
      afterLeg,
      route,
      today - expedition.startedDay,
      partySkill(ctx.state, afterLeg),
    )
  }

  // 5. Trouble: loss, retreat.
  const afterEvent = getExpeditionRun(ctx.state, expedition.id)
  if (!afterEvent || afterEvent.terminal !== undefined) {
    return {
      expeditionId: expedition.id,
      ...(afterEvent?.terminal ? { terminal: afterEvent.terminal } : {}),
      readable: 'The trip ended.',
    }
  }
  // A PARTY THROUGH THE DOOR CANNOT BE LOST ON THE DOORSTEP. `advanceLeg`
  // can set `phase: 'home'` this very tick, and running the trouble check
  // anyway meant a party that walked in with high hazard could still fail
  // its loss roll — marked lost, a terminal dispatch queued, and the people
  // removed from a roster they had already reported back to.
  if (afterEvent.phase === 'home') {
    return { expeditionId: expedition.id, readable: 'They are home.' }
  }
  return checkTrouble(ctx, expedition, afterEvent, route)
}

/** Move the party along, accounting for any delay they have banked. */
function advanceLeg(
  ctx: SimContext,
  expedition: Expedition,
  route: ExpeditionRoute,
): void {
  const today = ctx.state.calendar.totalDaysElapsed
  writeExpeditionRun(
    ctx,
    expedition.id,
    (current) => {
      // A banked delay is spent standing still: the day passes and the leg
      // does not. That is what a washed-out crossing actually costs.
      if (current.delayDays > 0) {
        return { ...current, delayDays: current.delayDays - 1 }
      }
      const dayInLeg = current.dayInLeg + 1
      if (dayInLeg < route.daysPerLeg) return { ...current, dayInLeg }

      // A leg is done.
      if (current.phase === 'outbound') {
        const legIndex = current.legIndex + 1
        return legIndex >= current.legsTotal
          ? {
              ...current,
              legIndex,
              dayInLeg: 0,
              phase: 'at_site' as ExpeditionPhase,
              reachedSiteOnDay: today,
            }
          : { ...current, legIndex, dayInLeg: 0 }
      }
      if (current.phase === 'at_site') {
        // One working day at the site, then home.
        return { ...current, dayInLeg: 0, phase: 'returning' as ExpeditionPhase }
      }
      // returning
      const legIndex = current.legIndex - 1
      return legIndex <= 0
        ? { ...current, legIndex: 0, dayInLeg: 0, phase: 'home' as ExpeditionPhase }
        : { ...current, legIndex, dayInLeg: 0 }
    },
    'leg',
  )
}

function fireEventIfAny(
  ctx: SimContext,
  expedition: Expedition,
  run: ExpeditionRun,
  route: ExpeditionRoute,
  dayOfTrip: number,
  skill: number,
): void {
  const definition = pickEventForToday(expedition, run, route, dayOfTrip, skill)
  if (!definition) return
  const today = ctx.state.calendar.totalDaysElapsed
  const index = run.events.length

  if (definition.decision) {
    const options = affordableOptions(definition, run)
    if (options.length === 0) return
    const fallback =
      options.find((option) => option.id === definition.decision!.defaultOptionId) ??
      options[options.length - 1]!
    writeExpeditionRun(
      ctx,
      expedition.id,
      (current) => ({
        ...current,
        events: [
          ...current.events,
          {
            index,
            eventId: definition.id,
            onDay: today,
            phase: current.phase,
            readable: definition.readable,
          },
        ],
        pendingDecision: {
          eventIndex: index,
          eventId: definition.id,
          prompt: definition.decision!.prompt,
          askedOnDay: today,
          // The party knows word takes time. They wait for the round trip
          // PLUS their own patience, so `waitDays` is the window the house
          // actually gets to decide in — the same on every route — while the
          // distance decides how long the whole business takes and how late
          // the house hears about it. Without the round trip in here a
          // question asked four days out could never be answered at all,
          // which would make the far routes' decisions decorative.
          deadlineDay:
            today + route.wordDelayDays * 2 + definition.decision!.waitDays,
          optionIds: options.map((option) => option.id),
          defaultOptionId: fallback.id,
        },
      }),
      'event_decision',
    )
    bumpExpeditionTotal(ctx, 'eventsFired')
    queueDispatch(ctx, expedition.id, route, 'decision', definition.decision.prompt)
    return
  }

  // Self-resolving.
  const injuryRng = journeyStream(expedition.seed, expedition.id, 'injury', index)
  // A steadier party gets hurt less by the same misfortune — up to a quarter
  // less at the top of the scale, and half again as often at the bottom.
  const injuryChance =
    definition.effects?.injuryChance !== undefined
      ? definition.effects.injuryChance * (1 - (skill - 50) / 200)
      : undefined
  const injured = injuryChance !== undefined && injuryRng.float() < injuryChance
  writeExpeditionRun(
    ctx,
    expedition.id,
    (current) => ({
      ...applyEventEffects(current, definition.effects ?? {}, injured),
      events: [
        ...current.events,
        {
          index,
          eventId: definition.id,
          onDay: today,
          phase: current.phase,
          readable: definition.readable,
        },
      ],
    }),
    'event',
  )
  bumpExpeditionTotal(ctx, 'eventsFired')
  queueDispatch(ctx, expedition.id, route, 'event', definition.readable)
  // An injury is TROUBLE, and word of it travels like any other news. Sending
  // it as a dated dispatch is what lets `send_relief_to_expedition` be gated
  // on the house having actually heard, instead of reading the party's live
  // injury list — which was omniscient, and made the delayed-information
  // gate meaningless on exactly the remote routes it exists for.
  if (injured) {
    queueDispatch(ctx, expedition.id, route, 'trouble', 'Somebody is hurt.')
  }
}

/**
 * Has it gone badly enough to end?
 *
 * The two ladders §9.3 asks for. Hazard is how a party is LOST — and it is
 * accumulated from what actually happened rather than rolled flat at the
 * end, so a well-supplied trip down a bad route is genuinely safer than a
 * careless one. Morale is how a party RETREATS: they turn themselves around
 * before it kills them, which is the thing that makes provisions worth
 * buying.
 */
function checkTrouble(
  ctx: SimContext,
  expedition: Expedition,
  run: ExpeditionRun,
  route: ExpeditionRoute,
): JourneyStep {
  const today = ctx.state.calendar.totalDaysElapsed

  if (run.hazard >= LOSS_HAZARD_THRESHOLD) {
    // INDEXED BY THE DAY OF THE TRIP, for the same reason the event roll is.
    // Indexing by `run.events.length` rebuilt an identical stream on every
    // hazardous day where nothing else happened, so a party that survived
    // the first check could not be lost on any later one until its event
    // count changed — and once it hit the event cap the result was frozen
    // for the rest of the trip. The day is monotonic and reproducible from
    // the commission, which is what makes the risk daily AND replayable.
    const rng = journeyStream(
      expedition.seed,
      expedition.id,
      'loss',
      today - expedition.startedDay,
    )
    // Even at the top of the ladder it is a chance rather than a certainty,
    // and relief already sent halves it — which is what makes a rescue
    // worth paying for rather than a consolation.
    const base = (run.hazard - LOSS_HAZARD_THRESHOLD) / 40 + 0.1
    // Relief halves it once it has ARRIVED, not when it was sent. Reading
    // `reliefSentOnDay` meant a party in the Underdeep was rescued on the
    // day the player paid, four days before anybody could have reached them.
    const chance = run.reliefArrivedOnDay !== undefined ? base / 2 : base
    if (rng.float() < chance) {
      writeExpeditionRun(
        ctx,
        expedition.id,
        (current) => ({ ...current, terminal: 'lost' }),
        'lost',
      )
      queueDispatch(ctx, expedition.id, route, 'terminal', 'They did not come back.')
      return {
        expeditionId: expedition.id,
        terminal: 'lost',
        readable: 'They did not come back.',
      }
    }
  }

  if (
    run.morale <= RETREAT_MORALE_THRESHOLD &&
    run.phase !== 'home' &&
    run.phase !== 'returning'
  ) {
    writeExpeditionRun(ctx, expedition.id, (current) => retreat(current, today), 'retreat')
    queueDispatch(
      ctx,
      expedition.id,
      route,
      'trouble',
      'They have had enough and are coming home.',
    )
    return {
      expeditionId: expedition.id,
      readable: 'The party turned back.',
    }
  }

  void today
  return { expeditionId: expedition.id, readable: 'They walked on.' }
}

/**
 * Turn a party around.
 *
 * `dayInLeg` is reset, and that reset is the whole cost of a recall. Without
 * it the part-leg already walked counted as progress on the way BACK, so a
 * party three days out could be home the following morning — which made a
 * recall an undo rather than a decision. Resetting it means they walk back
 * the legs they walked out, which is what "the walk back will take days"
 * has to mean if the report is going to say it.
 */
function turnAround(run: ExpeditionRun): ExpeditionRun {
  return { ...run, phase: 'returning' as ExpeditionPhase, dayInLeg: 0 }
}

/** Turning back on their own account, which is a retreat rather than a recall. */
function retreat(run: ExpeditionRun, today: number): ExpeditionRun {
  return { ...turnAround(run), retreatedOnDay: run.retreatedOnDay ?? today }
}

/** Order a party home. §9.3's recall. */
/**
 * Order a party home.
 *
 * THE ORDER TRAVELS AT THE ROUTE'S OWN SPEED. Recording the decision is
 * immediate; the party turning round is not. On a route four days out the
 * order takes four days to reach them, and until it does they keep walking
 * into whatever the road has for them — which is the cost the player accepts
 * by sending anybody that far, and the reason a recall is a decision rather
 * than an undo button.
 */
export function recallExpedition(ctx: SimContext, expeditionId: string): boolean {
  const run = getExpeditionRun(ctx.state, expeditionId)
  if (!run || run.terminal !== undefined || run.phase === 'home') return false
  const route = routeFor(run.routeId)
  const today = ctx.state.calendar.totalDaysElapsed
  const reachesOn = today + (route?.wordDelayDays ?? 0)
  writeExpeditionRun(
    ctx,
    expeditionId,
    (current) => ({
      ...current,
      recalledOnDay: today,
      recallReachesOnDay: reachesOn,
    }),
    'recall_sent',
  )
  // Applied straight away only where word is instant, so a road trip still
  // turns on the day it is told to.
  if (reachesOn <= today) applyRecallArrival(ctx, expeditionId, today)
  if (route) {
    queueDispatch(
      ctx,
      expeditionId,
      route,
      'progress',
      reachesOn <= today
        ? 'The recall reached them and they turned for home.'
        : `A rider went out with the recall; it will reach them on day ${reachesOn}.`,
    )
  }
  return true
}

/**
 * A reply that reaches the party today.
 *
 * Two things have to be re-checked on arrival rather than trusted from the
 * day it was sent. The party may have run out of patience and answered it
 * themselves, in which case the reply is simply too late. And they have
 * been EATING while it travelled: an option that needed supplies when the
 * house chose it may no longer be one they can take, and applying it anyway
 * granted the reward while `applyEventEffects` quietly clamped the
 * overspend to zero. If what was asked for is no longer possible they do
 * the cautious thing instead, and word of that goes home.
 */
function applyArrivedAnswer(
  ctx: SimContext,
  expedition: Expedition,
  route: ExpeditionRoute,
  today: number,
): void {
  const run = getExpeditionRun(ctx.state, expedition.id)
  if (!run?.pendingAnswer || today < run.pendingAnswer.reachesOnDay) return
  const optionId = run.pendingAnswer.optionId
  const clear = (reason: string) =>
    writeExpeditionRun(
      ctx,
      expedition.id,
      (current) => {
        const { pendingAnswer: _landed, ...rest } = current
        return rest
      },
      reason,
    )

  const pending = run.pendingDecision
  if (!pending) {
    clear('answer_too_late')
    return
  }
  const definition = expeditionEventRegistry.has(pending.eventId)
    ? expeditionEventRegistry.get(pending.eventId)
    : undefined
  const stillPossible =
    definition !== undefined &&
    affordableOptions(definition, run).some((option) => option.id === optionId)
  if (!stillPossible) {
    queueDispatch(
      ctx,
      expedition.id,
      route,
      'event',
      'The word came too late to do what it asked; they did what they could.',
    )
    resolveDecision(ctx, expedition, pending.defaultOptionId, true)
    clear('answer_no_longer_possible')
    return
  }
  resolveDecision(ctx, expedition, optionId, false)
  clear('answer_arrived')
}

/** The day the order lands: they turn round, and it lifts them. */
function applyRecallArrival(ctx: SimContext, expeditionId: string, today: number): void {
  writeExpeditionRun(
    ctx,
    expeditionId,
    (current) => {
      const {
        pendingDecision: _moot,
        pendingAnswer: _alsoMoot,
        ...rest
      } = current
      return {
      ...turnAround(rest),
      // Stamped on ARRIVAL, not on sending. It is what makes the trip a
      // recall rather than a trip that happened to have an order chasing it.
      recallArrivedOnDay: today,
      // AND THE QUESTION IS MOOT — destructured off above. A party waiting
      // on an answer is stood still by the walking guard; leaving
      // `pendingDecision` in place after a recall landed kept them standing
      // there eating for days after the report said they had turned for
      // home. Being called home answers whatever they were asking.
      //
      // A recall lifts spirits: they were told to come home, not driven.
      morale: clamp(current.morale + 8, 0, 100),
      }
    },
    'recalled',
  )
}

/** Which discoveries a completed trip brought back. */
export function discoveriesFrom(
  run: ExpeditionRun,
  route: ExpeditionRoute,
  reachedSite: boolean,
): string[] {
  // Only a party that got there AND got back can tell anybody what they
  // found. §9.3's "future opportunities" has to be earned twice.
  if (!reachedSite || !route.discovers) return []
  if (run.terminal === 'lost') return []
  return [route.discovers]
}

/** Every route the house could send a party down today. */
export function availableRoutes(state: TavernState, known: string[]): ExpeditionRoute[] {
  void state
  return [...expeditionRouteRegistry.all()]
    .filter((route) => route.unlockedBy === undefined || known.includes(route.unlockedBy))
    .sort((a, b) => a.danger - b.danger || a.id.localeCompare(b.id))
}
