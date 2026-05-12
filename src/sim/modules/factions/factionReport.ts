import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { FactionWorldState } from '../../state/TavernState'

// Phase 27 §27.4 / Phase 30 §30.10 — Faction report.
//
// Compact summary of the faction layer:
//   - today's biggest relationship gain and loss (read from causes),
//   - high-influence factions with poor relationships,
//   - any active faction flags.

const SOURCE = 'factions'

const POOR_RELATIONSHIP_THRESHOLD = 35
const HIGH_INFLUENCE_THRESHOLD = 55

export function buildFactionReport(ctx: SimContext): ReportSection | null {
  const factions = Object.values(ctx.state.world.factions)
  if (factions.length === 0) return null

  const lines: string[] = []

  // Today's biggest faction shifts (from cause history).
  const today = ctx.state.calendar.totalDaysElapsed
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

  // Active faction flags.
  const flagged: FactionWorldState[] = factions.filter(
    (f) => f.activeFlags.length > 0,
  )
  if (flagged.length > 0) {
    lines.push('')
    lines.push('Active flags:')
    for (const f of flagged) {
      lines.push(`  ${f.label}: ${f.activeFlags.join(', ')}`)
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
    },
  }
}
