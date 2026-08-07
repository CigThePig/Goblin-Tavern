import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { CultureWorldState } from '../../state/TavernState'

import {
  activeFriction,
  getCultureModuleState,
  liveMisunderstandings,
} from './cultureState'
import { liveObservances } from './observance'

// Phase 27 §27.4 / Phase 30 §30.10 — Culture report.
//
// Mechanical summary of the culture layer for the current day:
//   - highest tension culture,
//   - highest comfort culture,
//   - calendar tags that matter today, grouped by culture,
//   - any cultures whose dislikes overlap a current area trait.
//
// Expansion Phase 8 §8.2 — the report leads with what actually HAPPENED to
// each culture tonight and what is outstanding, because the meters below it
// are now derived from exactly that. An unresolved misunderstanding names
// its remedy here, which is the surface that makes `make_amends_to_culture`
// discoverable rather than something the player has to already know about.
//
// Reports stay compact per the Phase 21 contract: no card prose, no
// flavour. Just ids, labels, and numbers.

const SOURCE = 'cultures'

function pickExtreme(
  cultures: CultureWorldState[],
  by: (c: CultureWorldState) => number,
  prefer: 'max' | 'min',
): CultureWorldState | undefined {
  let best: CultureWorldState | undefined
  for (const c of cultures) {
    if (!best) {
      best = c
      continue
    }
    const a = by(best)
    const b = by(c)
    if (prefer === 'max' ? b > a : b < a) best = c
  }
  return best
}

export function buildCultureReport(ctx: SimContext): ReportSection | null {
  const cultures = Object.values(ctx.state.world.cultures)
  if (cultures.length === 0) return null

  const lines: string[] = []
  const slice = getCultureModuleState(ctx.state)

  // What the cultures noticed tonight — the evidence every meter derives from.
  if (slice.evidenceToday.length > 0) {
    lines.push('Tonight:')
    for (const entry of [...slice.evidenceToday].sort(
      (a, b) => a.cultureId.localeCompare(b.cultureId) || a.id.localeCompare(b.id),
    )) {
      lines.push(`  ${entry.readable}`)
    }
    lines.push('')
  }

  // Outstanding, with the remedy named.
  const misunderstandings = liveMisunderstandings(ctx.state)
  if (misunderstandings.length > 0) {
    lines.push('Unresolved:')
    for (const record of misunderstandings) {
      const culture = ctx.state.world.cultures[record.cultureId]
      lines.push(
        `  ${culture?.label ?? record.cultureId}: ${record.reason} — ${record.remedy} (fades day ${record.expiresOnDay})`,
      )
    }
    lines.push('')
  }

  const observances = liveObservances(ctx.state)
  if (observances.length > 0) {
    lines.push('Observed today:')
    for (const observance of observances) {
      const culture = ctx.state.world.cultures[observance.cultureId]
      lines.push(
        `  ${culture?.label ?? observance.cultureId}: ${observance.tag.replace(/_/g, ' ')} — ${
          observance.honoured === true
            ? 'kept'
            : observance.honoured === false
              ? 'let pass'
              : 'in progress'
        }`,
      )
    }
    lines.push('')
  }

  const friction = activeFriction(ctx.state)
  if (friction.length > 0) {
    lines.push('Rubbing along badly:')
    for (const entry of friction) {
      const a = ctx.state.world.cultures[entry.cultureA]?.label ?? entry.cultureA
      const b = ctx.state.world.cultures[entry.cultureB]?.label ?? entry.cultureB
      lines.push(
        `  ${a} / ${b}: friction ${entry.level} over ${entry.sharedDays} shared night(s)`,
      )
    }
    lines.push('')
  }

  const highestTension = pickExtreme(cultures, (c) => c.tension, 'max')
  const highestComfort = pickExtreme(cultures, (c) => c.comfort, 'max')

  if (highestTension) {
    lines.push(
      `Highest tension: ${highestTension.label} (${highestTension.tension})`,
    )
  }
  if (highestComfort) {
    lines.push(
      `Highest comfort: ${highestComfort.label} (${highestComfort.comfort})`,
    )
  }

  const dayType = ctx.getDayType()
  // Widen the typed `CalendarTag[]` to plain strings so culture
  // definitions can hold open tag ids without re-typing every entry.
  const dayTags = ctx.state.calendar.tags as readonly string[]
  const interestedToday: string[] = []
  for (const culture of cultures) {
    const matches = culture.importantCalendarTags.filter(
      (t) => t === dayType || dayTags.includes(t),
    )
    if (matches.length > 0) {
      interestedToday.push(`${culture.label} (${matches.join(', ')})`)
    }
  }
  if (interestedToday.length > 0) {
    lines.push('')
    lines.push('Today’s calendar matters to:')
    for (const entry of interestedToday) {
      lines.push(`  ${entry}`)
    }
  }

  // Area-trait conflicts: surface any culture that dislikes a trait
  // currently present in the main room.
  const mainRoom = ctx.state.areas['main_room']
  if (mainRoom) {
    const conflicts: string[] = []
    for (const culture of cultures) {
      // The culture definition holds detailed area-trait preferences;
      // the world-state copy keeps only the disliked stock tags. Tag
      // overlap with the area's mechanical-tag list is a cheap proxy
      // that does not require pulling the full definition record.
      for (const tag of culture.dislikedTags) {
        if (mainRoom.tags.includes(tag) || mainRoom.atmosphere.includes(tag)) {
          conflicts.push(`${culture.label} dislikes '${tag}' in main room`)
        }
      }
    }
    if (conflicts.length > 0) {
      lines.push('')
      lines.push('Area-trait clashes:')
      for (const c of conflicts) lines.push(`  ${c}`)
    }
  }

  return {
    id: 'cultures',
    source: SOURCE,
    title: 'CULTURE REPORT',
    lines,
    data: {
      cultureCount: cultures.length,
      highestTensionId: highestTension?.id,
      highestComfortId: highestComfort?.id,
      evidenceToday: slice.evidenceToday.length,
      misunderstandingIds: misunderstandings.map((record) => record.id),
      observedTodayIds: observances.map((entry) => entry.cultureId),
      frictionIds: friction.map((entry) => entry.id),
      interestedTodayIds: cultures
        .filter((c) =>
          c.importantCalendarTags.some(
            (t) => t === dayType || (dayTags as readonly string[]).includes(t),
          ),
        )
        .map((c) => c.id),
    },
  }
}
