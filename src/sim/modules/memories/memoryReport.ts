import type { ReportSection } from '../../core/reports'
import type { MemoryState, TavernState } from '../../state/TavernState'

// Phase 16 §16.9 — Memory report.
//
// Builds a debug-facing summary of the tavern's current memory state:
// new memories today, strongest live memories, pattern memories, future
// hooks, and (optionally) recently expired memories supplied by the
// caller. Output is intentionally compact — no card prose — so it
// remains readable in test logs and CLI dumps.

const MEMORY_REPORT_ID = 'memories'
const MEMORY_REPORT_SOURCE = 'memories'

export type MemoryReportInputs = {
  state: TavernState
  newToday: ReadonlyArray<MemoryState>
  expiredToday: ReadonlyArray<MemoryState>
}

function describeMemory(memory: MemoryState): string {
  const parts: string[] = [memory.id]
  parts.push(`strength ${Math.round(memory.strength)}`)
  if (memory.durationDays !== undefined) {
    const remaining = Math.max(0, memory.durationDays - memory.ageDays)
    parts.push(`expires in ${remaining} day${remaining === 1 ? '' : 's'}`)
  }
  if (memory.type === 'pattern') parts.push('(pattern)')
  if (memory.type === 'future_hook') parts.push('(future hook)')
  if (memory.type === 'fact') parts.push('(fact)')
  if (memory.type === 'grudge') parts.push('(grudge)')
  return parts.join(', ')
}

function sortByStrength(a: MemoryState, b: MemoryState): number {
  return b.strength - a.strength
}

export function buildMemoryReport(inputs: MemoryReportInputs): ReportSection {
  const { state, newToday, expiredToday } = inputs
  const memories = state.memories

  const lines: string[] = []
  lines.push(`Active memories: ${memories.length}`)
  lines.push('')

  lines.push('New:')
  if (newToday.length === 0) {
    lines.push('  (no new memories today)')
  } else {
    for (const memory of [...newToday].sort(sortByStrength)) {
      lines.push(`  - ${describeMemory(memory)}`)
    }
  }
  lines.push('')

  const strongest = memories
    .filter((m) => m.type === 'timed' || m.type === 'grudge')
    .sort(sortByStrength)
    .slice(0, 5)
  lines.push('Strongest active memories:')
  if (strongest.length === 0) {
    lines.push('  (none)')
  } else {
    for (const memory of strongest) {
      lines.push(`  - ${describeMemory(memory)}`)
    }
  }
  lines.push('')

  const patterns = memories.filter((m) => m.type === 'pattern')
  lines.push('Active patterns:')
  if (patterns.length === 0) {
    lines.push('  (none)')
  } else {
    for (const pattern of [...patterns].sort(sortByStrength)) {
      lines.push(`  - ${describeMemory(pattern)}`)
    }
  }
  lines.push('')

  const hooks = memories.filter((m) => m.type === 'future_hook')
  lines.push('Future hooks:')
  if (hooks.length === 0) {
    lines.push('  (none)')
  } else {
    for (const hook of [...hooks].sort(sortByStrength)) {
      lines.push(`  - ${describeMemory(hook)}`)
    }
  }
  lines.push('')

  if (expiredToday.length > 0) {
    lines.push('Expired today:')
    for (const memory of expiredToday) {
      lines.push(`  - ${memory.id}`)
    }
  }

  return {
    id: MEMORY_REPORT_ID,
    source: MEMORY_REPORT_SOURCE,
    title: 'MEMORY REPORT',
    lines,
    data: {
      active: memories.length,
      newToday: newToday.length,
      expiredToday: expiredToday.length,
      patterns: patterns.length,
      futureHooks: hooks.length,
      strongestIds: strongest.map((m) => m.id),
      patternIds: patterns.map((m) => m.id),
      futureHookIds: hooks.map((m) => m.id),
      expiredIds: expiredToday.map((m) => m.id),
      newIds: newToday.map((m) => m.id),
    },
  }
}

export { MEMORY_REPORT_ID, MEMORY_REPORT_SOURCE }
