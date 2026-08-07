import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'

import { competitionSummary, competitorStandings } from './appeal'
import {
  activeCourting,
  getPrimaryRival,
  getRivalModuleState,
  liveSetbacks,
} from './rivalState'
import { rivalIntent } from './rivalActors'

// Expansion Phase 9 §9.1 — the competition report.
//
// It leads with what they DID and what they are ABOUT to do, for the same
// reason the faction report does: an autonomous competitor is only fair if
// its moves are legible before they land, and the announced line is what
// the player reads on the day `settle_with_rival`, `win_back_group` and
// `poach_rival_staff` are still available.
//
// SCOUTING GATES THE DETAIL, NOT THE FAIRNESS. What anybody in town can see
// — the house's position, its moves, what it has announced, who is backing
// it — is always printed. What only somebody who went and looked can know —
// its staffing, its quality, its purse — appears once the player has spent
// an hour on `scout_the_competition`, and goes stale after a fortnight.

const SOURCE = 'rival'

/** Days a scouting report stays current. */
export const SCOUT_FRESHNESS_DAYS = 14

export function buildRivalReport(ctx: SimContext): ReportSection | null {
  const rival = getPrimaryRival(ctx.state)
  if (!rival) return null
  const slice = getRivalModuleState(ctx.state)
  const today = ctx.state.calendar.totalDaysElapsed
  const summary = competitionSummary(ctx.state)
  const lines: string[] = []

  lines.push(
    rival.position === 'unknown'
      ? `${rival.name} is across the road, and nobody is sure what it means to be yet.`
      : `${rival.name} is running a ${rival.position} house, leading with ${rival.menuFocus}.`,
  )

  if (rival.truceUntilDay !== undefined && today <= rival.truceUntilDay) {
    lines.push(`  There is an arrangement with them until day ${rival.truceUntilDay}.`)
  }

  if (slice.movesToday.length > 0) {
    lines.push('')
    lines.push('Across the road today:')
    for (const move of slice.movesToday) lines.push(`  ${move.readable}`)
  }

  const intent = rivalIntent(ctx.state)
  if (intent) {
    lines.push('')
    lines.push('Announced:')
    lines.push(`  ${intent.readable}`)
  }

  // The head-to-head, which is the whole point of the section.
  const standings = competitorStandings(ctx.state)
  const losing = standings.filter((standing) => standing.advantage > 0.05)
  const holding = standings.filter((standing) => standing.advantage < -0.05)
  if (losing.length > 0) {
    lines.push('')
    lines.push('Losing ground with:')
    for (const standing of losing) lines.push(`  ${standing.readable}`)
  }
  if (holding.length > 0 && losing.length === 0) {
    lines.push('')
    lines.push('Holding:')
    for (const standing of holding.slice(0, 3)) lines.push(`  ${standing.readable}`)
  }

  const courting = activeCourting(rival)
  if (courting.length > 0) {
    lines.push('')
    lines.push('They are working:')
    for (const entry of courting) {
      const group = ctx.state.customerGroups[entry.groupId]
      lines.push(
        `  ${group?.label ?? entry.groupId} — ${entry.poaching ? 'going hard at them' : 'courting'} (effort ${entry.effort}). ${entry.reason}`,
      )
    }
  }

  if (rival.backingFactionIds.length > 0) {
    const labels = rival.backingFactionIds.map(
      (id) => ctx.state.world.factions[id]?.label ?? id,
    )
    lines.push('')
    lines.push(`Backed by: ${labels.join(', ')}.`)
  }

  const setbacks = liveSetbacks(rival)
  if (setbacks.length > 0) {
    lines.push('')
    lines.push('Their own troubles:')
    for (const setback of setbacks) {
      lines.push(`  ${setback.readable} (severity ${setback.severity})`)
    }
  }

  const scouted =
    rival.scoutedOnDay !== undefined && today - rival.scoutedOnDay <= SCOUT_FRESHNESS_DAYS
  if (scouted) {
    lines.push('')
    lines.push(`Scouted on day ${rival.scoutedOnDay}:`)
    lines.push(
      `  staffing ${rival.capability.staffing}, quality ${rival.capability.quality}, prices ${rival.capability.priceLevel} (50 is the going rate), reach ${rival.capability.reach}, purse ${rival.purse}.`,
    )
  } else {
    lines.push('')
    lines.push('  Nobody has been over to look lately.')
  }

  return {
    id: 'rival',
    source: SOURCE,
    title: 'ACROSS THE ROAD',
    lines,
    data: {
      rivalId: rival.id,
      name: rival.name,
      position: rival.position,
      meanAdvantage: summary?.meanAdvantage ?? 0,
      groupsLosing: summary?.groupsLosing ?? [],
      courtedGroupIds: courting.map((entry) => entry.groupId),
      backingFactionIds: [...rival.backingFactionIds],
      liveSetbacks: setbacks.length,
      movesToday: slice.movesToday.length,
      announced: intent?.actionId,
      scouted,
      underTruce: summary?.underTruce ?? false,
    },
  }
}
