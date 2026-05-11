import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { PressureSnapshot } from './pressureTypes'
import { getPressureModuleState } from './pressureModule'

// Phase 18 §18.13 — Pressure report.
//
// Surfaces value, trend, urgency, dominant causes, related systems,
// and possible consequences for each registered pressure. Output is
// compact text so it stays useful in test logs and CLI dumps; the
// `data` payload carries the structured snapshots for downstream
// consumers (Phase 19 will read this to seed issues).

export const PRESSURE_REPORT_ID = 'pressures'
export const PRESSURE_REPORT_SOURCE = 'pressures'

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

export function buildPressureReport(ctx: SimContext): ReportSection {
  const slice = getPressureModuleState(ctx.state)
  const lines: string[] = []
  const snapshots = Object.values(slice.snapshots).sort(
    (a, b) => b.value - a.value,
  )

  if (snapshots.length === 0) {
    lines.push('No pressures calculated this day.')
  }

  for (const snapshot of snapshots) {
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

  // Trim trailing blank line.
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }

  return {
    id: PRESSURE_REPORT_ID,
    source: PRESSURE_REPORT_SOURCE,
    title: 'PRESSURE REPORT',
    lines,
    data: {
      snapshots: snapshots.map((s) => ({
        id: s.id,
        label: s.label,
        value: s.value,
        previousValue: s.previousValue,
        delta: s.delta,
        trend: s.trend,
        severity: s.severity,
        urgency: s.urgency,
        volatility: s.volatility,
        dominantCauseIds: s.causes
          .filter((c) => c.direction !== 'decrease')
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 3)
          .map((c) => c.id),
        tags: [...s.tags],
        relatedSystems: [...s.relatedSystems],
      })),
      topPressureId: snapshots[0]?.id,
    },
  }
}
