import type { SimContext } from '../../core/context'
import { cultureRegistry } from '../../content/cultures/cultureRegistry'
import { getServiceModuleState } from '../service/serviceModule'
import type { DayType } from '../calendar/types'
import {
  activeArcsByTypeOrTag,
  hasCalendarTag,
  ownerPolicies,
  ownerProjects,
} from '../pressures/calculators/expandedHelpers'

import { bumpCultureTotal, getCultureModuleState, writeCultureSlice } from './cultureState'
import { noteAccommodation, noteEvidence } from './standing'
import { recipeTags } from './serviceEvidence'
import type { CultureObservance } from './types'

// Expansion Phase 8 §8.2 — calendar observance, and whether the house kept it.
//
// The old pass emitted a `cultural_misunderstanding_recently` memory for
// EVERY culture whose important tag was live, unless any friction-reducing
// policy happened to be enabled — and since no policy in the game carried
// those tags, the exception never fired and the memory always did. So an
// observance was a guaranteed grievance that no action could prevent, which
// is the opposite of what a calendar the player can plan around should be.
//
// An observance is now a thing with two possible endings. It is HONOURED
// when the tavern actually did something the culture recognises on the day:
// served a dish carrying one of their `observanceHonouredBy` tags, ran a
// policy or project carrying one, or had a matching arc live. It is IGNORED
// when the day passed and none of that happened. Both are recorded as
// accommodation history, which is what trust is partly derived from.

/**
 * An occasion, versus a Tuesday.
 *
 * A culture's `importantCalendarTags` mix two very different things: named
 * calendar tags that mark a genuine occasion (`festival_window`,
 * `mushroom_festival`), and routine DAY TYPES that come round constantly
 * (`payday`, `local_night`, `market_day`). Treating both the same meant a
 * passive tavern was charged with letting 35 observances pass in 28 days —
 * more than one a day — which is not a house neglecting anybody's festival,
 * it is a house being open on a Tuesday.
 *
 * So the two are weighted differently. A named calendar tag is a full
 * occasion: worth keeping, and letting it pass is a real slight that can
 * open a misunderstanding. A recurring day type is a small courtesy: worth
 * something when kept, barely anything when missed.
 */
export function isMajorObservance(tag: string): boolean {
  // NOT `hasCalendarTag`: the calendar always carries the day type as a tag
  // in its own right, so that test called every routine Tuesday an occasion.
  // The discriminator is the day-type union itself — the seven days that
  // come round every week are the routine, and anything else on the
  // calendar (`festival_window`, `mushroom_festival`, a season or an arc
  // tag) is the occasion.
  return !(ROUTINE_DAY_TYPES as ReadonlyArray<string>).includes(tag)
}

/** The seven day types that cycle every week. Never an occasion by themselves. */
const ROUTINE_DAY_TYPES: ReadonlyArray<DayType> = [
  'supplier_day',
  'quiet_day',
  'market_day',
  'local_night',
  'payday',
  'brawl_night',
  'maintenance_day',
] as const

const MAJOR_HONOURED_WEIGHT = 14
const MAJOR_IGNORED_WEIGHT = 13
const MINOR_HONOURED_WEIGHT = 6
const MINOR_IGNORED_WEIGHT = 4

/** Cultures observing something today, in id order. */
export function observancesToday(ctx: SimContext): CultureObservance[] {
  const today = ctx.state.calendar.totalDaysElapsed
  const dayType = ctx.getDayType()
  const out: CultureObservance[] = []
  for (const cultureId of Object.keys(ctx.state.world.cultures).sort()) {
    const culture = ctx.state.world.cultures[cultureId]!
    // An occasion outranks a routine day, so a culture that watches both
    // reports the occasion rather than the Tuesday.
    const live = culture.importantCalendarTags.filter(
      (tag) => tag === dayType || hasCalendarTag(ctx.state, tag),
    )
    const tag =
      live.find((candidate) => isMajorObservance(candidate)) ?? live[0]
    if (!tag) continue
    out.push({ cultureId, tag, startedOnDay: today })
  }
  return out
}

/** Did the tavern do anything this culture would recognise today? */
export function observanceHonoured(
  ctx: SimContext,
  cultureId: string,
): { honoured: boolean; how?: string } {
  const def = cultureRegistry.get(cultureId)
  if (!def) return { honoured: false }
  const marks = new Set(def.observanceHonouredBy)
  if (marks.size === 0) return { honoured: false }

  // 0. The player marked it deliberately today.
  //
  // Checked FIRST and separately, because `mark_culture_observance` writes
  // its evidence at the moment it is taken and this pass runs later the same
  // day under the same evidence id. Without this the evening pass would find
  // no dish, no policy and no project, decide the day was ignored, and
  // overwrite the player's own accommodation with a grievance for the thing
  // they had just paid to prevent.
  const today = ctx.state.calendar.totalDaysElapsed
  const standing = getCultureModuleState(ctx.state).standing[cultureId]
  const markedToday = standing?.accommodations.some(
    (entry) =>
      entry.onDay === today &&
      entry.accommodated &&
      entry.kind === 'honoured_observance',
  )
  if (markedToday) return { honoured: true, how: 'marked the day for them' }

  // 1. Something they recognise actually reached their tables tonight.
  const flow = getServiceModuleState(ctx.state).result.flow
  if (flow.ran) {
    for (const party of flow.parties) {
      if (ctx.state.customerGroups[party.groupId]?.cultureId !== cultureId) continue
      for (const line of party.order) {
        if (line.delivered <= 0) continue
        const hit = recipeTags(line.recipeId).find((tag) => marks.has(tag))
        if (hit) return { honoured: true, how: `served them ${hit} fare` }
      }
    }
  }

  // 2. A standing house rule they recognise.
  for (const policy of Object.values(ownerPolicies(ctx.state))) {
    if (!policy.enabled) continue
    if (policy.tags.some((tag) => marks.has(tag))) {
      return { honoured: true, how: `kept the house rule '${policy.label}'` }
    }
  }

  // 3. A project or an arc the house is running for them.
  for (const project of Object.values(ownerProjects(ctx.state))) {
    if (project.status !== 'active') continue
    if (project.tags.some((tag) => marks.has(tag))) {
      return { honoured: true, how: `ran '${project.label}' for them` }
    }
  }
  const arcs = activeArcsByTypeOrTag(ctx.state, {
    types: ['festival'],
    tags: [...marks],
  })
  if (arcs.length > 0) return { honoured: true, how: 'kept the occasion with them' }

  return { honoured: false }
}

/**
 * Resolve today's observances.
 *
 * Runs at `closing`, so "did anything reach their tables" is answerable.
 */
export function resolveObservances(ctx: SimContext): void {
  const live = observancesToday(ctx)
  if (live.length === 0) {
    writeCultureSlice(ctx, (current) => ({ ...current, observances: [] }), 'observances')
    return
  }

  const resolved: CultureObservance[] = []
  for (const observance of live) {
    const culture = ctx.state.world.cultures[observance.cultureId]
    if (!culture) continue
    const { honoured, how } = observanceHonoured(ctx, observance.cultureId)
    resolved.push({ ...observance, honoured })

    const major = isMajorObservance(observance.tag)
    if (honoured) {
      bumpCultureTotal(ctx, 'observancesHonoured')
      noteEvidence(ctx, {
        cultureId: culture.id,
        id: `observance_${observance.tag}`,
        kind: 'observance_honoured',
        weight: major ? MAJOR_HONOURED_WEIGHT : MINOR_HONOURED_WEIGHT,
        readable: `${culture.label}'s ${observance.tag.replace(/_/g, ' ')} was kept — the house ${how}.`,
        subjectId: observance.tag,
        tags: ['observance', observance.tag],
      })
      if (major) {
        noteAccommodation(ctx, {
          cultureId: culture.id,
          kind: 'honoured_observance',
          readable: `The house ${how} for ${culture.label}'s ${observance.tag.replace(/_/g, ' ')}.`,
          accommodated: true,
        })
      }
    } else {
      bumpCultureTotal(ctx, 'observancesIgnored')
      noteEvidence(ctx, {
        cultureId: culture.id,
        id: `observance_${observance.tag}`,
        kind: 'observance_ignored',
        weight: major ? MAJOR_IGNORED_WEIGHT : MINOR_IGNORED_WEIGHT,
        readable: `${culture.label}'s ${observance.tag.replace(/_/g, ' ')} passed and the house did nothing about it.`,
        subjectId: observance.tag,
        tags: ['observance', observance.tag],
      })
      if (major) {
        noteAccommodation(ctx, {
          cultureId: culture.id,
          kind: 'ignored_observance',
          readable: `The house let ${culture.label}'s ${observance.tag.replace(/_/g, ' ')} pass unmarked.`,
          accommodated: false,
        })
      }
    }
  }

  writeCultureSlice(
    ctx,
    (current) => ({ ...current, observances: resolved }),
    'observances',
  )
}

/** What a culture is observing today, if anything. Read by the report. */
export function liveObservances(state: {
  modules: Record<string, unknown>
}): CultureObservance[] {
  return getCultureModuleState(state).observances
}
