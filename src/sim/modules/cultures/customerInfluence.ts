import type {
  CustomerGroupState,
  TavernState,
} from '../../state/TavernState'

// Phase 30 §30.8 — Culture forecast influence helper.
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

const TENSION_HIGH_THRESHOLD = 75

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

  return { modifier, notes }
}
