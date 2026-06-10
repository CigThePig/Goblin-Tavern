import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { CauseEntry } from '../../state/TavernState'
import type { StateChange, StateDiff } from '../../core/diff'
import { canonicalCauseTarget, targetMatches } from './causeTargets'

// Phase 17 §17.9 — Cause report.
//
// The report surfaces:
//   - top causes today by weight
//   - top causes today grouped by target
//   - "unexplained" significant state changes from today's full-day
//     diff (changes whose path/target has no recent cause)
//
// "Unexplained" is treated as a flag, not a hard failure. Future phases
// (Phase 20 readiness gate) will treat unexplained changes as bugs.

export const CAUSE_REPORT_ID = 'causes'
export const CAUSE_REPORT_SOURCE = 'causes'

function describeCause(cause: CauseEntry): string {
  const parts: string[] = []
  parts.push(cause.readable)
  parts.push(`(${cause.source})`)
  if (cause.weight > 0) parts.push(`weight ${Math.round(cause.weight)}`)
  return parts.join(' ')
}

function targetForChange(change: StateChange): string | undefined {
  // Phase 197 / ISSUE-164 — delegates to the shared canonicalizer so
  // causeReport and causeLookup share one mapping.
  return canonicalCauseTarget(change.path)
}

export function findUnexplainedSignificantChanges(
  diff: StateDiff | undefined,
  causes: ReadonlyArray<CauseEntry>,
): StateChange[] {
  if (!diff) return []
  const unexplained: StateChange[] = []
  for (const change of diff.significantChanges) {
    const target = targetForChange(change)
    if (!target) {
      // No mapping → leave as unexplained so reports surface the gap.
      unexplained.push(change)
      continue
    }
    const matched = causes.some((c) => targetMatches(c.target, target))
    if (!matched) unexplained.push(change)
  }
  return unexplained
}

export function buildCauseReport(ctx: SimContext): ReportSection {
  const lines: string[] = []
  const all = ctx.state.causes
  const today = ctx.getRecentCauses(1)
  const sortedToday = [...today].sort((a, b) => b.weight - a.weight)

  lines.push(`Active causes: ${all.length}`)
  lines.push(`New today: ${today.length}`)
  lines.push('')

  lines.push('Top causes today:')
  if (sortedToday.length === 0) {
    lines.push('  (none recorded today)')
  } else {
    for (const cause of sortedToday.slice(0, 5)) {
      lines.push(`  - ${describeCause(cause)}`)
    }
  }
  lines.push('')

  const grouped = new Map<string, CauseEntry[]>()
  for (const cause of today) {
    const arr = grouped.get(cause.target) ?? []
    arr.push(cause)
    grouped.set(cause.target, arr)
  }
  lines.push('Top causes by target:')
  if (grouped.size === 0) {
    lines.push('  (none)')
  } else {
    const targets = [...grouped.keys()].sort()
    for (const target of targets) {
      const arr = grouped.get(target)!
      const weight = arr.reduce((sum, c) => sum + c.weight, 0)
      lines.push(`  ${target} (weight ${Math.round(weight)}):`)
      for (const cause of arr.sort((a, b) => b.weight - a.weight).slice(0, 3)) {
        lines.push(`    - ${cause.readable}`)
      }
    }
  }
  lines.push('')

  // Phase 197 / ISSUE-164 — Cluster 1. Use getDiffSoFar so the check
  // runs against the live snapshot→now diff even though finalize('day')
  // hasn't been called yet at generateReports time.
  const dayDiff = ctx.getDiffSoFar('day')
  const unexplained = findUnexplainedSignificantChanges(dayDiff, today)
  lines.push('Unexplained significant changes:')
  if (unexplained.length === 0) {
    lines.push('  (none — every significant change has a recorded cause)')
  } else {
    for (const change of unexplained.slice(0, 8)) {
      lines.push(`  - ${change.readable}`)
    }
  }

  return {
    id: CAUSE_REPORT_ID,
    source: CAUSE_REPORT_SOURCE,
    title: 'CAUSE REPORT',
    lines,
    data: {
      activeCount: all.length,
      newTodayCount: today.length,
      unexplainedCount: unexplained.length,
      newTodayIds: today.map((c) => c.id),
      unexplainedPaths: unexplained.map((c) => c.path),
      topTargets: [...grouped.keys()],
    },
  }
}
