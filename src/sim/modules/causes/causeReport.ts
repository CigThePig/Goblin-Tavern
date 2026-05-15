import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { CauseEntry } from '../../state/TavernState'
import type { StateChange, TaggedStateDiff } from '../../core/diff'

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
  // Map a state-diff path to the canonical cause target string. The
  // engine's modify* helpers use the same convention so the cause and
  // diff layers line up.
  if (change.path === 'coin') return 'coin'
  if (change.path.startsWith('areas.')) {
    const id = change.path.split('.')[1]
    return id ? `area:${id}` : undefined
  }
  if (change.path.startsWith('stock.')) {
    const id = change.path.split('.')[1]
    return id ? `stock:${id}` : undefined
  }
  if (change.path.startsWith('staff.')) {
    const id = change.path.split('.')[1]
    return id ? `staff:${id}` : undefined
  }
  if (change.path.startsWith('customers.')) {
    const id = change.path.split('.')[1]
    return id ? `customer:${id}` : undefined
  }
  if (change.path.startsWith('reputation.')) {
    const axis = change.path.split('.')[1]
    return axis ? `reputation:${axis}` : undefined
  }
  if (change.path.startsWith('pressures.')) {
    const id = change.path.split('.')[1]
    return id ? `pressure:${id}` : undefined
  }
  // ISSUE-002 (phase 42) — world slices. Per-field cause targets emitted
  // by the engine's world mutators use the flat path style
  // (`cultures.foo.familiarity`) and match diff paths directly; explicit
  // `addCause` call sites that use the id-only canonical target
  // (`culture:foo`) match through `targetMatches`' prefix relationship.
  if (change.path.startsWith('cultures.')) {
    const id = change.path.split('.')[1]
    return id ? `culture:${id}` : undefined
  }
  if (change.path.startsWith('factions.')) {
    const id = change.path.split('.')[1]
    return id ? `faction:${id}` : undefined
  }
  if (change.path.startsWith('suppliers.')) {
    const id = change.path.split('.')[1]
    return id ? `supplier:${id}` : undefined
  }
  if (change.path.startsWith('regulars.')) {
    const id = change.path.split('.')[1]
    return id ? `regular:${id}` : undefined
  }
  if (change.path.startsWith('notableNpcs.')) {
    const id = change.path.split('.')[1]
    return id ? `notable_npc:${id}` : undefined
  }
  if (change.path.startsWith('localEvents.')) {
    const id = change.path.split('.')[1]
    return id ? `local_event:${id}` : undefined
  }
  if (change.path.startsWith('socialRumours.')) {
    const id = change.path.split('.')[1]
    return id ? `rumour:${id}` : undefined
  }
  if (change.path === 'tavernIdentity' || change.path.startsWith('tavernIdentity.')) {
    return 'tavernIdentity'
  }
  // `modules.*` is intentionally left unmapped. Module-internal state
  // mutations have no canonical cause-target convention, so surfacing
  // them as "unexplained" is the right audit signal until each module
  // chooses to attribute its own writes.
  return undefined
}

function targetMatches(target: string, expected: string): boolean {
  if (target === expected) return true
  // Field-level targets (e.g. `customer:miners.satisfaction`) should
  // match the broader id (`customer:miners`).
  if (target.startsWith(`${expected}.`)) return true
  if (expected.startsWith(`${target}.`)) return true
  return false
}

export function findUnexplainedSignificantChanges(
  diff: TaggedStateDiff | undefined,
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

  // Phase 17 §17.9 — Unexplained significant changes. Use the full-day
  // diff so the report covers anything between yesterday and the end of
  // today.
  const dayDiff = ctx.getDiffs().find((d) => d.boundary === 'day')
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
