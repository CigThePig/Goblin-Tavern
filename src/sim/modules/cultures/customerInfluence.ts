import type {
  CustomerGroupState,
  TavernState,
} from '../../state/TavernState'

import { cultureWillingness } from './autonomy'
import { accommodationRate } from './standing'
import { liveMisunderstandingFor } from './cultureState'

// Phase 30 §30.8 — Culture forecast influence helper.
//
// Expansion Phase 8 §8.2 — the helper gains the terms that make a culture's
// experience matter to whether it comes back. Phase 30's calendar and
// area-trait terms are unchanged; what is new is that the four meters are
// now DYNAMIC (they were seeded at day zero and never written), so trust,
// comfort and a live unresolved misunderstanding can now legitimately be
// read here. This remains the customers module's own forecast rule reading
// a bounded culture input — the culture layer never writes turnout.
//
// Pure helper consumed by `customerModule.forecastTraffic` to mix
// culture-level signals (calendar tag affinity, area-trait fit,
// cultural tension) into the per-group projection without making
// `forecast.ts` own culture logic. The helper is pure and never
// mutates state.

export type CultureForecastModifier = {
  modifier: number
  notes: string[]
}

/**
 * The most the whole culture layer may move one group's forecast.
 *
 * Expansion Phase 8 §8.2. Before the clamp the terms simply summed, and
 * with §8.2's attendance, misunderstanding and accommodation terms added to
 * Phase 30's calendar and area-trait ones, a neglected culture could reach
 * about -13 on its own. On a passive 28-day route that compounded twice
 * over — directly through turnout, and again through the complaints that
 * lower turnout generates — costing 10% of all patrons and pushing the
 * `customer_complaint` family to a 4-day streak, past the ceiling the Wave 6
 * audit deliberately set at 3.
 *
 * Cultures are ONE input into a group's forecast, alongside the day type
 * (±25), price, cleanliness, stock, renown, the economy's demand factor and
 * the rival's pull. Bounding the layer as a whole says that in one place,
 * rather than hoping the individual terms never line up.
 */
export const MAX_CULTURE_FORECAST_SWING = 8

const TENSION_HIGH_THRESHOLD = 75

/**
 * Turnout a culture withholds while an unresolved slight stands.
 *
 * Four rather than five: this stacks on top of the attendance term below and
 * on Phase 5's demand factor, and the culture layer must be one input among
 * several rather than the one that decides the night.
 */
const MISUNDERSTANDING_TURNOUT_HIT = 4

/** A culture that has actually walked out withholds more, for longer. */
const WALKOUT_TURNOUT_HIT = 7

export function getCultureForecastModifier(
  state: TavernState,
  group: CustomerGroupState,
): CultureForecastModifier {
  const cultureId = group.cultureId
  const culture = cultureId ? state.world.cultures[cultureId] : undefined
  if (!culture) return { modifier: 0, notes: [] }

  let modifier = 0
  const notes: string[] = []

  // Calendar affinity — a culture's important calendar tags pull turnout up.
  // The calendar tag list is a typed union; the culture-side list is open
  // strings so future calendar tags can be referenced without rebuilding
  // every culture definition. Widen for comparison.
  const dayTags = state.calendar.tags as readonly string[]
  const matchingTag = culture.importantCalendarTags.find((t) =>
    dayTags.includes(t),
  )
  if (matchingTag) {
    modifier += 4
    notes.push(`${culture.label} care about today's tag '${matchingTag}'.`)
  } else if (culture.importantCalendarTags.includes(state.calendar.dayType)) {
    modifier += 3
    notes.push(
      `${culture.label} care about the day type '${state.calendar.dayType}'.`,
    )
  }

  // Area-trait fit — if the main room conflicts with the culture's
  // dislikes, soften the forecast a touch. This intentionally only
  // looks at the customer-facing main room; later phases can broaden
  // to per-group seating areas.
  const mainRoom = state.areas['main_room']
  if (mainRoom) {
    let likeHits = 0
    let dislikeHits = 0
    for (const trait of mainRoom.traits) {
      if (culture.tags.includes('local') && trait === 'sticky_floor') {
        // local cultures tolerate sticky floors — neutral, no note
        continue
      }
    }
    const likes = (culture.tags.includes('local')
      ? ['cozy', 'sticky_floor']
      : ['cozy', 'well_lit', 'music_friendly']) as string[]
    const dislikes = (culture.tags.includes('cleanliness_sensitive')
      ? ['sticky_floor', 'pest_prone', 'inspection_sensitive']
      : ['pest_prone']) as string[]
    for (const trait of mainRoom.traits) {
      if (likes.includes(trait)) likeHits += 1
      if (dislikes.includes(trait)) dislikeHits += 1
    }
    if (likeHits > 0) {
      modifier += Math.min(3, likeHits)
      notes.push(`Main room traits suit ${culture.label}.`)
    }
    if (dislikeHits > 0) {
      modifier -= Math.min(3, dislikeHits)
      notes.push(`Main room traits clash with ${culture.label}.`)
    }
  }

  // Cultural tension dampens turnout slightly when very high.
  if (culture.tension >= TENSION_HIGH_THRESHOLD) {
    modifier -= 2
    notes.push(`${culture.label} tension is high (${culture.tension}).`)
  }

  // -- Expansion Phase 8 §8.2 — attendance, the culture's own effect --------
  //
  // §8.2's first named autonomous effect is group attendance. A culture that
  // trusts the house turns out for it; one that does not stays home. Worth
  // roughly +/-5 on its own; the whole layer is bounded below.
  const willingness = cultureWillingness(state, group)
  const attendance = Math.round((willingness - 0.5) * 10)
  if (attendance !== 0) {
    modifier += attendance
    notes.push(
      attendance > 0
        ? `${culture.label} think well of the house (+${attendance}).`
        : `${culture.label} are in no hurry to come back (${attendance}).`,
    )
  }

  // A live misunderstanding is a community response: they hold off until
  // the house puts it right. This is why the remedy is named on the record.
  const misunderstanding = liveMisunderstandingFor(state, culture.id)
  if (misunderstanding) {
    const hit =
      misunderstanding.severity === 'walkout'
        ? WALKOUT_TURNOUT_HIT
        : MISUNDERSTANDING_TURNOUT_HIT
    modifier -= hit
    notes.push(
      misunderstanding.severity === 'walkout'
        ? `${culture.label} have walked out over an unresolved matter (-${hit}): ${misunderstanding.remedy}.`
        : `${culture.label} are staying away over an unresolved matter (-${hit}): ${misunderstanding.remedy}.`,
    )
  }

  // Being accommodated repeatedly is worth something on its own.
  const accommodation = accommodationRate(state, culture.id)
  if (accommodation >= 0.75) {
    modifier += 2
    notes.push(`${culture.label} are used to being looked after here.`)
  }

  const bounded = Math.max(
    -MAX_CULTURE_FORECAST_SWING,
    Math.min(MAX_CULTURE_FORECAST_SWING, modifier),
  )
  if (bounded !== modifier) {
    notes.push(
      `Culture effects capped at ${bounded > 0 ? '+' : ''}${bounded} for this group.`,
    )
  }

  return { modifier: bounded, notes }
}
