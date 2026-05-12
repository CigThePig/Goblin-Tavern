import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { RegularWorldState } from '../../state/TavernState'
import { getRegularModuleState } from './state'

// Phase 27 §27.4 / Phase 30 §30.10 — Regular customer report.
//
// Surfaces simulation truth about the regulars layer for today:
//   - regulars created today,
//   - regulars who visited today,
//   - regulars with high loyalty or high irritation.

const SOURCE = 'regulars'

const HIGH_LOYALTY_THRESHOLD = 80
const HIGH_IRRITATION_THRESHOLD = 60

export function buildRegularReport(ctx: SimContext): ReportSection | null {
  const slice = getRegularModuleState(ctx.state)
  const regulars = Object.values(ctx.state.world.regulars)

  const hasContent =
    regulars.length > 0 ||
    slice.createdToday.length > 0 ||
    slice.visitedToday.length > 0 ||
    slice.candidatesToday.length > 0
  if (!hasContent) return null

  const lines: string[] = []

  if (slice.createdToday.length > 0) {
    lines.push('New regulars today:')
    for (const id of slice.createdToday) {
      const r = ctx.state.world.regulars[id]
      if (r) lines.push(`  ${r.name.display} (${r.customerGroupId})`)
    }
  }

  if (slice.visitedToday.length > 0) {
    if (lines.length > 0) lines.push('')
    lines.push('Visited today:')
    for (const id of slice.visitedToday) {
      const r = ctx.state.world.regulars[id]
      if (r) lines.push(`  ${r.name.display} (visits ${r.visits})`)
    }
  }

  const loyal: RegularWorldState[] = regulars.filter(
    (r) => r.loyalty >= HIGH_LOYALTY_THRESHOLD,
  )
  if (loyal.length > 0) {
    if (lines.length > 0) lines.push('')
    lines.push('High loyalty:')
    for (const r of loyal) {
      lines.push(`  ${r.name.display}: loyalty ${r.loyalty}`)
    }
  }

  const irritated: RegularWorldState[] = regulars.filter(
    (r) => r.irritation >= HIGH_IRRITATION_THRESHOLD,
  )
  if (irritated.length > 0) {
    if (lines.length > 0) lines.push('')
    lines.push('High irritation:')
    for (const r of irritated) {
      lines.push(`  ${r.name.display}: irritation ${r.irritation}`)
    }
  }

  if (slice.candidatesToday.length > 0 && lines.length === 0) {
    lines.push('Emergence candidates considered:')
    for (const c of slice.candidatesToday) {
      lines.push(`  ${c.groupId}: ${(c.chance * 100).toFixed(1)}% (${c.reason})`)
    }
  }

  if (lines.length === 0) return null

  return {
    id: 'regulars',
    source: SOURCE,
    title: 'REGULAR REPORT',
    lines,
    data: {
      regularCount: regulars.length,
      createdTodayIds: [...slice.createdToday],
      visitedTodayIds: [...slice.visitedToday],
      loyalIds: loyal.map((r) => r.id),
      irritatedIds: irritated.map((r) => r.id),
      candidateCount: slice.candidatesToday.length,
    },
  }
}
