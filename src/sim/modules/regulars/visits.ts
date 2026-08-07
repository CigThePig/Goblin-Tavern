import type { SimContext } from '../../core/context'
import type {
  CustomerGroupState,
  RegularWorldState,
  TavernState,
} from '../../state/TavernState'
import { recipeRegistry } from '../../registries/recipeRegistry'
import { feasibleServings } from '../service/flow/choice'

import {
  beliefAgainstHouse,
  beliefEffect,
  goodwillTowardHouse,
} from '../attribution/beliefInputs'

import { serviceMemoryScore } from './regularMemory'

/** The most a regular's opinion of the house can move their visit chance. */
export const MAX_BELIEF_VISIT_PULL = 0.12

// Expansion Phase 4 §4.3 — whether a named regular comes in tonight.
//
// WHAT THE OLD RULE WAS. `shouldVisit` read exactly two things: the regular's
// loyalty and their group's patronage, plus a 5% floor for anyone too irritated.
// Nothing the player did to a specific person changed it, nothing they wanted
// changed it, and a regular's own history with the house was not an input at
// all — their irritation went UP on nights they stayed home, which made absence
// self-reinforcing for no reason anybody chose.
//
// THE FOUR INPUTS §4.3 NAMES, and where each is read:
//
//   belief     `serviceMemoryScore` — what they remember about this place
//   treatment  `ownerStanding`, and whether their slate got chased or forgiven
//   stock      is their usual actually available tonight (`stockPull`)
//   identity   the tavern's reputation against their culture's taste
//
// STOPPING AND RETURNING ARE STATE, NOT PROBABILITY. Three bad nights running
// and they stop coming — a recorded fact with a reason, not a number that
// happens to be small. They come back when a named condition changes, which is
// what makes "return under changed conditions" a promise the player can act on
// rather than a wait.

const STREAM_ID = 'regular_behaviour' as const

/** Bad visits in a row before a regular gives up on the place. */
export const BAD_VISITS_BEFORE_LAPSE = 3

/** A lapsed regular will not even consider coming back inside this window. */
export const MIN_LAPSE_DAYS = 5

/** Ceiling on any night's visit chance — nobody is certain. */
const MAX_VISIT_CHANCE = 0.9

/**
 * Is the thing this regular actually comes here for available tonight?
 *
 * This is the mechanical answer to §4.3's "favorite stock must affect behavior
 * rather than remain descriptive metadata": running out of Grulk's pickled eggs
 * is a reason Grulk does not turn up, and restocking them is a reason he does.
 */
export function favouriteAvailability(
  state: TavernState,
  regular: RegularWorldState,
): { available: boolean; subject?: string } {
  if (regular.favoriteRecipeId) {
    const recipe = state.recipes[regular.favoriteRecipeId]
    const feasible =
      recipe?.onMenu === true && feasibleServings(state, regular.favoriteRecipeId) > 0
    return { available: feasible, subject: regular.favoriteRecipeId }
  }
  if (regular.favoriteStockId) {
    // Service sells recipes, never loose ingredients. Raw stock only counts as
    // a restored usual when at least one on-menu recipe that consumes it can
    // actually be served from the whole ingredient set.
    const available = Object.values(state.recipes).some(
      (recipe) =>
        recipe.onMenu &&
        recipeRegistry.has(recipe.id) &&
        recipeRegistry
          .get(recipe.id)
          .inputs.some(
            (input) => input.ingredientId === regular.favoriteStockId,
          ) &&
        feasibleServings(state, recipe.id) > 0,
    )
    return { available, subject: regular.favoriteStockId }
  }
  return { available: true }
}

/** How well the house's name sits with this regular's culture. §4.3 "identity". */
function identityPull(ctx: SimContext, group: CustomerGroupState): number {
  const rep = ctx.state.reputation
  let pull = (rep.reliable - 50) / 200
  const culture = group.cultureId ? ctx.getCulture(group.cultureId) : undefined
  if (culture) {
    pull += (culture.comfort - 50) / 250
    pull -= culture.tension / 400
  }
  if (rep.filthy > 60) pull -= (rep.filthy - 60) / 250
  if (rep.dangerous > 70) pull -= (rep.dangerous - 70) / 250
  return pull
}

export type VisitAssessment = {
  probability: number
  drivers: string[]
  /** Set when they are not coming at all, whatever the roll would say. */
  blocked?: string
}

/**
 * The chance this regular walks in tonight, with its reasons.
 *
 * Pure — no RNG. The caller rolls, so the same assessment can be shown to the
 * player (a report can say "Grulk is unlikely tonight: the eggs ran out") and
 * used to decide, without the two disagreeing.
 */
export function assessVisit(
  ctx: SimContext,
  regular: RegularWorldState,
  group: CustomerGroupState | undefined,
): VisitAssessment {
  const drivers: string[] = []
  if (!group) return { probability: 0, drivers, blocked: 'their crowd is gone' }

  const today = ctx.state.calendar.totalDaysElapsed
  if (regular.stoppedVisiting) {
    return {
      probability: 0,
      drivers,
      blocked: regular.stoppedVisiting.reason,
    }
  }

  // The Phase 30 base — loyalty and how busy their crowd is — is kept, because
  // it is the honest floor: people go where their friends go.
  //
  // Expansion Phase 8 §8.2 — the upward and downward terms are now
  // accumulated SEPARATELY, and the ceiling is applied to the upward side
  // before the downward side is taken off.
  //
  // The final clamp used to be the only ceiling, which meant a regular whose
  // loyalty and crowd already carried them past `MAX_VISIT_CHANCE` had every
  // negative driver silently absorbed: the assessment still listed "their
  // usual is off" as a reason they were less likely to come, and the
  // probability did not move a point. A driver the player is shown has to be
  // a driver that acts — that is the whole premise of this arc — so nothing
  // that pushes a regular away can be eaten by the cap.
  const base = 0.15 + (regular.loyalty / 100) * 0.35 + (group.patronage / 100) * 0.25
  let bonus = 0
  let penalty = 0
  const add = (delta: number): void => {
    if (delta >= 0) bonus += delta
    else penalty -= delta
  }

  const memory = serviceMemoryScore(regular, today)
  if (memory !== 0) {
    const pull = Math.max(-0.35, Math.min(0.25, memory / 40))
    add(pull)
    if (Math.abs(pull) >= 0.05) {
      drivers.push(
        pull > 0 ? 'good memories of the place' : 'bad memories of the place',
      )
    }
  }

  const standing = regular.ownerStanding ?? 50
  if (standing !== 50) {
    const pull = (standing - 50) / 400
    add(pull)
    if (Math.abs(pull) >= 0.05) {
      drivers.push(pull > 0 ? 'they like you' : 'they have gone off you')
    }
  }

  const favourite = favouriteAvailability(ctx.state, regular)
  if (favourite.subject) {
    if (favourite.available) {
      add(0.12)
      drivers.push(`their usual (${favourite.subject}) is on`)
    } else {
      add(-0.25)
      drivers.push(`their usual (${favourite.subject}) is off`)
    }
  }

  // Expansion Phase 8 §8.5 — what this regular has come to believe about the
  // house. Capped at 0.12: a settled grievance is worth about half of finding
  // their usual off the board, which keeps belief a reason among the reasons
  // rather than the one that empties the room.
  const grievance = beliefAgainstHouse(ctx.state, { kind: 'regular', id: regular.id })
  const grievancePull = beliefEffect(grievance, MAX_BELIEF_VISIT_PULL)
  if (grievancePull > 0) {
    add(-grievancePull)
    drivers.push('they hold something against the house')
  }
  const goodwill = goodwillTowardHouse(ctx.state, { kind: 'regular', id: regular.id })
  const goodwillPull = beliefEffect(goodwill, MAX_BELIEF_VISIT_PULL / 2)
  if (goodwillPull > 0) {
    add(goodwillPull)
    drivers.push('they credit the house with something')
  }

  const identity = identityPull(ctx, group)
  if (Math.abs(identity) >= 0.03) {
    add(identity)
    drivers.push(identity > 0 ? "the tavern's name draws them" : "the tavern's name puts them off")
  }

  const dayType = ctx.getDayType()
  const culture = group.cultureId ? ctx.getCulture(group.cultureId) : undefined
  if (culture?.importantCalendarTags.includes(dayType)) {
    add(0.15)
    drivers.push(`it is ${dayType}`)
  }

  // The ceiling binds what draws a regular in; what puts them off comes off
  // afterwards, so it is always felt.
  let probability = Math.min(MAX_VISIT_CHANCE, base + bonus) - penalty

  // Being thoroughly fed up is a multiplier rather than a term: it does not
  // add a reason, it discounts every other one.
  if (regular.irritation >= 70) {
    probability *= 0.25
    drivers.push('they are thoroughly fed up')
  }

  return {
    probability: Math.max(0, Math.min(MAX_VISIT_CHANCE, Math.round(probability * 100) / 100)),
    drivers,
  }
}

/** Roll the assessment. The only RNG in the visit decision. */
export function rollVisit(ctx: SimContext, assessment: VisitAssessment): boolean {
  if (assessment.blocked) return false
  if (assessment.probability <= 0) return false
  return ctx.getRngStream(STREAM_ID).chance(assessment.probability)
}

/**
 * What would bring a lapsed regular back.
 *
 * Named conditions, checked against live state — so a player who fixes the
 * thing gets the person back, and a player who does not, does not. Returns
 * `undefined` while nothing has changed.
 */
export function returnCondition(
  ctx: SimContext,
  regular: RegularWorldState,
): string | undefined {
  const lapse = regular.stoppedVisiting
  if (!lapse) return undefined
  const today = ctx.state.calendar.totalDaysElapsed
  if (today - lapse.sinceDay < MIN_LAPSE_DAYS) return undefined

  // Their slate was forgiven, or their request granted, since they walked.
  const goodwill = (regular.serviceMemory ?? []).find(
    (entry) =>
      entry.onDay >= lapse.sinceDay &&
      (entry.kind === 'tab_forgiven' || entry.kind === 'request_granted'),
  )
  if (goodwill) return `you made it right — ${goodwill.readable}`

  // Their usual is back on the menu after being off.
  const favourite = favouriteAvailability(ctx.state, regular)
  if (favourite.subject && favourite.available && lapse.reason.includes('usual')) {
    return `${favourite.subject} is back on`
  }

  // The place cleaned up its act.
  const rep = ctx.state.reputation
  if (rep.reliable >= 65 && regular.irritation <= 40) {
    return 'the place is running properly again'
  }
  return undefined
}

/**
 * Choose a favourite seat and dish for a regular who has none.
 *
 * Assigned from what they actually did — the area their party sat in, the dish
 * their party ordered — rather than rolled at emergence, so "their usual" is
 * something the tavern taught them.
 */
export function learnPreferences(
  ctx: SimContext,
  regular: RegularWorldState,
  observed: { areaId?: string; recipeId?: string },
): void {
  const patch: Partial<RegularWorldState> = {}
  if (!regular.favoriteAreaId && observed.areaId) {
    patch.favoriteAreaId = observed.areaId
  }
  if (
    !regular.favoriteRecipeId &&
    observed.recipeId &&
    recipeRegistry.has(observed.recipeId)
  ) {
    patch.favoriteRecipeId = observed.recipeId
  }
  if (Object.keys(patch).length === 0) return
  ctx.modifyRegular(regular.id, patch, {
    source: 'regulars.preferences',
    sourceType: 'regular',
    target: regular.id,
    targetType: 'regular',
    readable: `${regular.name.display} has a usual now${
      patch.favoriteRecipeId ? ` (${patch.favoriteRecipeId})` : ''
    }${patch.favoriteAreaId ? ` at ${patch.favoriteAreaId}` : ''}.`,
    tags: ['regular', 'preference', regular.customerGroupId],
    relatedActors: [{ kind: 'regular', id: regular.id }],
    relatedSystems: ['regulars', 'service'],
  })
}
