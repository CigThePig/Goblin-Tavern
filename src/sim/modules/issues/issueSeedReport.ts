import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import { getAllSeedsToday, getRejectedSeedsToday } from './issueSeedQueries'
import type { IssueSeed } from './issueSeedTypes'

// Phase 19 §19.13 — Issue seed report.
//
// Surfaces the day's seed pipeline: how many seeds were generated, how
// many passed validation, the top valid seeds, and the rejected seeds
// with reasons. The report is purely diagnostic — the card layer reads
// the structured data, the human reader reads the lines.

export const ISSUE_SEEDS_REPORT_ID = 'issue_seeds'
export const ISSUE_SEEDS_REPORT_SOURCE = 'issueSeeds'

function describeSeed(seed: IssueSeed, idx: number): string[] {
  const lines: string[] = []
  lines.push(
    `${idx + 1}. ${seed.family} :: ${seed.type} — ${seed.textIngredients.subject}`,
  )
  lines.push(
    `   severity ${seed.severity}, urgency ${seed.urgency}, cardWorthiness ${seed.cardWorthiness}`,
  )
  if (seed.causes.length > 0) {
    const causeNames = seed.causes
      .slice(0, 3)
      .map((c) => c.readable)
      .join('; ')
    lines.push(`   causes: ${causeNames}`)
  }
  if (seed.responseSlots.length > 0) {
    const slots = seed.responseSlots.map((s) => s.labelHint).join(', ')
    lines.push(`   responses: ${slots}`)
  }
  if (seed.consequenceProfiles.length > 0) {
    const min = Math.min(...seed.consequenceProfiles.map((p) => p.impactScore))
    const max = Math.max(...seed.consequenceProfiles.map((p) => p.impactScore))
    lines.push(`   impact range: ${min}–${max}`)
  }
  return lines
}

export function buildIssueSeedReport(ctx: SimContext): ReportSection {
  const all = getAllSeedsToday(ctx.state)
  const rejected = getRejectedSeedsToday(ctx.state)
  const valid = all.filter((s) => s.validation.valid)
  const lines: string[] = []
  lines.push(`Generated: ${all.length + rejected.length}`)
  lines.push(`Valid: ${valid.length}`)
  lines.push(`Rejected: ${rejected.length}`)
  lines.push('')

  lines.push('Top Valid Seeds:')
  if (valid.length === 0) {
    lines.push('  (none)')
  } else {
    const top = [...valid].slice(0, 5)
    for (let i = 0; i < top.length; i += 1) {
      const seed = top[i]!
      for (const line of describeSeed(seed, i)) {
        lines.push(line)
      }
    }
  }
  lines.push('')

  lines.push('Rejected Seeds:')
  if (rejected.length === 0) {
    lines.push('  (none)')
  } else {
    for (const r of rejected.slice(0, 10)) {
      lines.push(`  - ${r.family} (${r.templateId}): ${r.reason}`)
    }
  }

  return {
    id: ISSUE_SEEDS_REPORT_ID,
    source: ISSUE_SEEDS_REPORT_SOURCE,
    title: 'ISSUE SEED REPORT',
    lines,
    data: {
      generated: all.length + rejected.length,
      valid: valid.length,
      rejected: rejected.length,
      topSeedIds: valid.slice(0, 5).map((s) => s.id),
      rejectedSummary: rejected,
      validSeeds: valid,
    },
  }
}
