import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { PressureCategory, PressureSnapshot } from './pressureTypes'
import { EXPANDED_PRESSURE_CATEGORIES } from './pressureTypes'
import { getPressureModuleState } from './pressureModule'

// Phase 18 §18.13 / Phase 38 §38.16 — Pressure report.
//
// Surfaces value, trend, urgency, dominant causes, related systems, and
// possible consequences for each registered pressure. Phase 38 splits the
// output into category buckets (Core / Social / Market / Arc) and only
// names pressures that are meaningful today: high severity, sharply
// rising, attached to named entity causes, or carrying explicit
// consequence lines.

export const PRESSURE_REPORT_ID = 'pressures'
export const PRESSURE_REPORT_SOURCE = 'pressures'

const PRIORITY_VALUE = 30
const PRIORITY_SEVERITY = 35
const PRIORITY_DELTA = 6

function trendLabel(snapshot: PressureSnapshot): string {
  return snapshot.trend
}

function describeCauses(snapshot: PressureSnapshot): string[] {
  const positives = snapshot.causes
    .filter((c) => c.direction !== 'decrease')
    .slice()
    .sort((a, b) => b.weight - a.weight)
  return positives.slice(0, 3).map((c) => `- ${c.readable}`)
}

function describeRelief(snapshot: PressureSnapshot): string[] {
  const negatives = snapshot.causes
    .filter((c) => c.direction === 'decrease')
    .slice()
    .sort((a, b) => b.weight - a.weight)
  return negatives.slice(0, 2).map((c) => `- ${c.readable}`)
}

function categoryFor(snapshot: PressureSnapshot): PressureCategory {
  const expanded =
    EXPANDED_PRESSURE_CATEGORIES[
      snapshot.id as keyof typeof EXPANDED_PRESSURE_CATEGORIES
    ]
  if (expanded) return expanded
  return 'core'
}

function isMeaningful(snapshot: PressureSnapshot): boolean {
  if (snapshot.severity >= PRIORITY_SEVERITY) return true
  if (snapshot.value >= PRIORITY_VALUE) return true
  if (snapshot.trend === 'rising' && Math.abs(snapshot.delta) >= PRIORITY_DELTA) {
    return true
  }
  if (snapshot.consequences.length > 0 && snapshot.severity >= 25) return true
  if (snapshot.relatedActors.length > 0 && snapshot.severity >= 25) return true
  return false
}

function renderSnapshot(snapshot: PressureSnapshot, lines: string[]): void {
  lines.push(
    `${snapshot.label} Pressure: ${snapshot.value} (severity ${snapshot.severity}, urgency ${snapshot.urgency}), ${trendLabel(snapshot)}`,
  )
  const dominant = describeCauses(snapshot)
  if (dominant.length > 0) {
    lines.push('Dominant causes:')
    for (const line of dominant) lines.push(`  ${line}`)
  }
  const relief = describeRelief(snapshot)
  if (relief.length > 0) {
    lines.push('Relief:')
    for (const line of relief) lines.push(`  ${line}`)
  }
  if (snapshot.consequences.length > 0) {
    lines.push('If ignored:')
    for (const c of snapshot.consequences) {
      lines.push(`  - ${c}`)
    }
  }
  lines.push('')
}

export function buildPressureReport(ctx: SimContext): ReportSection {
  const slice = getPressureModuleState(ctx.state)
  const lines: string[] = []
  const all = Object.values(slice.snapshots).sort((a, b) => b.value - a.value)

  if (all.length === 0) {
    lines.push('No pressures calculated this day.')
    return {
      id: PRESSURE_REPORT_ID,
      source: PRESSURE_REPORT_SOURCE,
      title: 'PRESSURE REPORT',
      lines,
      data: { snapshots: [], topPressureId: undefined },
    }
  }

  const buckets: Record<PressureCategory, PressureSnapshot[]> = {
    core: [],
    social: [],
    market: [],
    arc: [],
  }
  for (const snapshot of all) {
    buckets[categoryFor(snapshot)].push(snapshot)
  }

  const headings: Record<PressureCategory, string> = {
    core: 'Core Pressures',
    social: 'Social Pressures',
    market: 'Market Pressures',
    arc: 'Arc Pressures',
  }

  let renderedAny = false
  for (const category of ['core', 'social', 'market', 'arc'] as PressureCategory[]) {
    const snapshots = buckets[category]
    if (snapshots.length === 0) continue
    const meaningful = snapshots.filter(isMeaningful)
    // Always show core pressures (existing tests inspect them); expanded
    // categories only render when at least one expanded pressure is
    // meaningful today.
    const toRender = category === 'core' ? snapshots : meaningful
    if (toRender.length === 0) continue
    if (renderedAny) lines.push('')
    lines.push(headings[category])
    lines.push('-'.repeat(headings[category].length))
    for (const snapshot of toRender) {
      renderSnapshot(snapshot, lines)
    }
    // Trim trailing blank line from this section.
    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop()
    }
    renderedAny = true
  }

  return {
    id: PRESSURE_REPORT_ID,
    source: PRESSURE_REPORT_SOURCE,
    title: 'PRESSURE REPORT',
    lines,
    data: {
      snapshots: all.map((s) => ({
        id: s.id,
        label: s.label,
        value: s.value,
        previousValue: s.previousValue,
        delta: s.delta,
        trend: s.trend,
        severity: s.severity,
        urgency: s.urgency,
        volatility: s.volatility,
        category: categoryFor(s),
        dominantCauseIds: s.causes
          .filter((c) => c.direction !== 'decrease')
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 3)
          .map((c) => c.id),
        tags: [...s.tags],
        relatedSystems: [...s.relatedSystems],
      })),
      topPressureId: all[0]?.id,
      categories: {
        core: buckets.core.map((s) => s.id),
        social: buckets.social.map((s) => s.id),
        market: buckets.market.map((s) => s.id),
        arc: buckets.arc.map((s) => s.id),
      },
    },
  }
}
