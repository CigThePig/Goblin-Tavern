import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'

import { audiencesOf, getRumourModuleState, liveRumours } from './rumourState'

// Expansion Phase 8 §8.4 — the rumour report.
//
// Leads with what moved today and who is carrying it, because a network the
// player cannot see is indistinguishable from the global meter it replaced.
// Each live rumour states its strength (how loudly it is being repeated),
// its credibility (how much it is believed), how far it has drifted, and who
// has heard it — the four things that come apart and that the player needs
// separately to decide whether to deny it, counter it, or let it lie.

const SOURCE = 'rumours'

export function buildRumourReport(ctx: SimContext): ReportSection | null {
  const live = liveRumours(ctx.state)
  const slice = getRumourModuleState(ctx.state)
  if (live.length === 0 && slice.spreadToday.length === 0) return null

  const lines: string[] = []

  if (slice.spreadToday.length > 0) {
    lines.push('Talk moved today:')
    for (const spread of [...slice.spreadToday].sort((a, b) =>
      a.rumourId.localeCompare(b.rumourId),
    )) {
      lines.push(`  ${spread.readable}`)
    }
    lines.push('')
  }

  const carried = live.filter((rumour) => audiencesOf(rumour).length > 0)
  if (carried.length > 0) {
    lines.push('Going round:')
    for (const rumour of carried.slice(0, 6)) {
      const audiences = audiencesOf(rumour)
      const believers = audiences
        .filter((audience) => audience.belief >= 30)
        .map((audience) => audience.id)
      lines.push(
        `  "${rumour.label}" — repeated ${Math.round(rumour.strength)}, credited ${rumour.credibility ?? 50}` +
          `${(rumour.distortion ?? 0) >= 40 ? `, much changed in the telling (${rumour.distortion})` : ''}`,
      )
      lines.push(
        `      heard by ${audiences.length}${believers.length > 0 ? `, believed by ${believers.join(', ')}` : ', believed by nobody much'}`,
      )
      if (rumour.counterRumourId) {
        lines.push('      contradicted by another story')
      }
    }
    lines.push('')
  }

  const corrected = ctx.state.world.socialRumours
  const settled = Object.values(corrected).filter(
    (rumour) => rumour.correctedOnDay !== undefined,
  )
  if (settled.length > 0) {
    lines.push(`Settled: ${settled.map((rumour) => `"${rumour.label}"`).join(', ')}`)
  }

  if (lines.length === 0) lines.push('Nothing much is being said.')

  return {
    id: 'rumours',
    source: SOURCE,
    title: 'WHAT IS BEING SAID',
    lines,
    data: {
      liveCount: live.length,
      spreadsToday: slice.spreadToday.length,
      carriedIds: carried.map((rumour) => rumour.id),
      settledIds: settled.map((rumour) => rumour.id),
      totals: slice.totals,
    },
  }
}
