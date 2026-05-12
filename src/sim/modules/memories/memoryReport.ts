import type { ReportSection } from '../../core/reports'
import type { EntityRef, MemoryState, TavernState } from '../../state/TavernState'

import { memoryOwner } from './entityMemory'

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
    lines.push('')
  }

  // Phase 36 §36.7 — Entity memory sections. Only surface memories that
  // are tied to a named entity AND that pass the salience filter: high
  // strength, or newly created today. Pure low-strength dust stays out
  // of the report so the section does not become a wall of text.
  const entitySections = buildEntitySections(memories, newToday)
  for (const section of entitySections) {
    lines.push(section.title)
    for (const line of section.lines) lines.push(`  - ${line}`)
    lines.push('')
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
      entitySections: entitySections.map((section) => ({
        title: section.title,
        memoryIds: section.memoryIds,
      })),
    },
  }
}

// ---------- Phase 36 §36.7 — Entity memory report helpers ----------

const ENTITY_SECTION_TITLES: Record<string, string> = {
  staff: 'Important Staff Memories:',
  regular: 'Important Regular Memories:',
  supplier: 'Supplier Grudges and Gratitude:',
  faction: 'Faction Memory:',
  area: 'Area Reputation Memory:',
  local_event: 'Arc Memory:',
}

const ENTITY_SECTION_ORDER: string[] = [
  'staff',
  'regular',
  'supplier',
  'faction',
  'area',
  'local_event',
]

const ENTITY_REPORT_STRENGTH = 50
const ENTITY_REPORT_LIMIT_PER_KIND = 4

function memoryEntityRef(memory: MemoryState): EntityRef | undefined {
  const owner = memoryOwner(memory)
  if (owner) return owner
  // Fall back to the first actor or location for legacy memories.
  if (memory.actors.length > 0) return memory.actors[0]
  if (memory.locations.length > 0) return memory.locations[0]
  return undefined
}

function isReportable(
  memory: MemoryState,
  newTodayIds: ReadonlySet<string>,
): boolean {
  if (memory.strength >= ENTITY_REPORT_STRENGTH) return true
  if (newTodayIds.has(memory.id)) return true
  return false
}

function describeEntityMemory(memory: MemoryState, owner: EntityRef): string {
  const idLabel = memory.label ?? memory.definitionId ?? memory.id
  return `${owner.kind}:${owner.id} — ${idLabel} (strength ${Math.round(memory.strength)})`
}

type EntitySection = {
  title: string
  lines: string[]
  memoryIds: string[]
}

function buildEntitySections(
  memories: ReadonlyArray<MemoryState>,
  newToday: ReadonlyArray<MemoryState>,
): EntitySection[] {
  const newTodayIds = new Set(newToday.map((m) => m.id))
  const buckets = new Map<string, MemoryState[]>()
  for (const memory of memories) {
    const owner = memoryEntityRef(memory)
    if (!owner) continue
    if (!ENTITY_SECTION_TITLES[owner.kind]) continue
    if (!isReportable(memory, newTodayIds)) continue
    const bucket = buckets.get(owner.kind) ?? []
    bucket.push(memory)
    buckets.set(owner.kind, bucket)
  }

  const sections: EntitySection[] = []
  for (const kind of ENTITY_SECTION_ORDER) {
    const bucket = buckets.get(kind)
    if (!bucket || bucket.length === 0) continue
    bucket.sort((a, b) => b.strength - a.strength)
    const trimmed = bucket.slice(0, ENTITY_REPORT_LIMIT_PER_KIND)
    sections.push({
      title: ENTITY_SECTION_TITLES[kind]!,
      lines: trimmed.map((memory) => {
        const owner = memoryEntityRef(memory)!
        return describeEntityMemory(memory, owner)
      }),
      memoryIds: trimmed.map((m) => m.id),
    })
  }
  return sections
}

export { MEMORY_REPORT_ID, MEMORY_REPORT_SOURCE }
