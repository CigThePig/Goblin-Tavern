import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { FactionWorldState } from '../../state/TavernState'

import {
  activeStances,
  getFactionModuleState,
  openDemands,
  owedFavours,
} from './factionState'
import { listFactionIntents } from './factionActors'

// Phase 27 §27.4 / Phase 30 §30.10 — Faction report.
//
// Expansion Phase 8 §8.1 — the report leads with what the factions DID and
// what they are ABOUT to do, because a world where actors move
// autonomously is only fair if their moves are legible before they land.
// Announced intent comes first for exactly that reason: it is the line the
// player reads on the day they still have `appeal_to_faction` available.
//
//   - moves made today, and moves announced for the days ahead,
//   - live stances (who is boycotting, backing, squeezing, protecting),
//   - open requests with their answer-by day, and favours owed,
//   - today's biggest relationship gain and loss (read from causes),
//   - high-influence factions with poor relationships.

const SOURCE = 'factions'

const POOR_RELATIONSHIP_THRESHOLD = 35
const HIGH_INFLUENCE_THRESHOLD = 55

export function buildFactionReport(ctx: SimContext): ReportSection | null {
  const factions = Object.values(ctx.state.world.factions)
  if (factions.length === 0) return null

  const lines: string[] = []
  const slice = getFactionModuleState(ctx.state)
  const today = ctx.state.calendar.totalDaysElapsed

  // What they did today.
  if (slice.movesToday.length > 0) {
    lines.push('Faction moves today:')
    for (const move of [...slice.movesToday].sort((a, b) =>
      a.factionId.localeCompare(b.factionId),
    )) {
      lines.push(`  ${move.readable}`)
    }
    lines.push('')
  }

  // What they have announced. This is the counterplay window.
  const intents = listFactionIntents(ctx.state)
  if (intents.length > 0) {
    lines.push('Announced:')
    for (const intent of intents) {
      lines.push(`  ${intent.readable}`)
    }
    lines.push('')
  }

  // What is currently in force.
  const stances = activeStances(ctx.state)
  if (stances.length > 0) {
    lines.push('In force:')
    for (const stance of stances) {
      const faction = ctx.state.world.factions[stance.factionId]
      lines.push(
        `  ${faction?.label ?? stance.factionId}: ${stance.kind.replace('_', ' ')} (strength ${stance.strength}, until day ${stance.endsOnDay}) — ${stance.reason}`,
      )
    }
    lines.push('')
  }

  // What they are waiting on.
  const demands = openDemands(ctx.state)
  if (demands.length > 0) {
    lines.push('Waiting on an answer:')
    for (const demand of demands) {
      const faction = ctx.state.world.factions[demand.factionId]
      lines.push(
        `  ${faction?.label ?? demand.factionId} want ${demand.readable} — answer by day ${demand.dueOnDay} (${demand.dueOnDay - today} days).`,
      )
    }
    lines.push('')
  }

  const favours = owedFavours(ctx.state)
  if (favours.length > 0) {
    lines.push('Favours owed:')
    for (const favour of favours) {
      const faction = ctx.state.world.factions[favour.factionId]
      lines.push(
        `  ${faction?.label ?? favour.factionId}: ${favour.grantedValue} coin, called in on day ${favour.dueOnDay}.`,
      )
    }
    lines.push('')
  }

  // Today's biggest faction shifts (from cause history).
  const todayCauses = ctx.state.causes.filter(
    (c) =>
      c.timestamp.absoluteDay === today &&
      c.targetType === 'faction' &&
      c.tags.includes('relationship'),
  )
  if (todayCauses.length > 0) {
    let biggestGain: (typeof todayCauses)[number] | undefined
    let biggestLoss: (typeof todayCauses)[number] | undefined
    for (const cause of todayCauses) {
      if (cause.amount > 0 && (!biggestGain || cause.amount > biggestGain.amount)) {
        biggestGain = cause
      }
      if (cause.amount < 0 && (!biggestLoss || cause.amount < biggestLoss.amount)) {
        biggestLoss = cause
      }
    }
    if (biggestGain) {
      const target = ctx.state.world.factions[biggestGain.target]
      lines.push(
        `Biggest gain: ${target?.label ?? biggestGain.target} (+${biggestGain.amount})`,
      )
    }
    if (biggestLoss) {
      const target = ctx.state.world.factions[biggestLoss.target]
      lines.push(
        `Biggest loss: ${target?.label ?? biggestLoss.target} (${biggestLoss.amount})`,
      )
    }
  }

  // High-influence factions with poor relationships.
  const watchlist: FactionWorldState[] = factions.filter(
    (f) =>
      f.influence >= HIGH_INFLUENCE_THRESHOLD &&
      f.relationship <= POOR_RELATIONSHIP_THRESHOLD,
  )
  if (watchlist.length > 0) {
    lines.push('')
    lines.push('High-influence, poor relationship:')
    for (const f of watchlist) {
      lines.push(
        `  ${f.label}: relationship ${f.relationship}, influence ${f.influence}`,
      )
    }
  }

  // Active faction flags that are not already spelled out as stances above.
  const flagged: FactionWorldState[] = factions.filter((f) =>
    f.activeFlags.some((flag) => !flag.startsWith('stance:')),
  )
  if (flagged.length > 0) {
    lines.push('')
    lines.push('Active flags:')
    for (const f of flagged) {
      lines.push(
        `  ${f.label}: ${f.activeFlags.filter((flag) => !flag.startsWith('stance:')).join(', ')}`,
      )
    }
  }

  if (lines.length === 0) {
    lines.push('Factions stable.')
  }

  return {
    id: 'factions',
    source: SOURCE,
    title: 'FACTION REPORT',
    lines,
    data: {
      factionCount: factions.length,
      watchlistIds: watchlist.map((f) => f.id),
      flaggedIds: flagged.map((f) => f.id),
      movesToday: slice.movesToday.length,
      announcedIntents: intents.map((intent) => intent.factionId),
      activeStanceIds: stances.map((stance) => stance.id),
      openDemandIds: demands.map((demand) => demand.id),
      owedFavourIds: favours.map((favour) => favour.id),
    },
  }
}
