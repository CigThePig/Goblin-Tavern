import type { CalendarState } from '../../modules/calendar/types'
import type {
  CalendarStamp,
  EntityRef,
  MemoryState,
  TavernState,
} from '../../state/TavernState'

// Phase 16 §16.2 — query helpers used by the context API and by tests.
//
// These accept either a full `TavernState` or a raw `memories` array so
// they remain useful inside report builders and outside the engine
// (replays, fixtures, vitest assertions).

function asMemoryList(
  input: TavernState | ReadonlyArray<MemoryState>,
): ReadonlyArray<MemoryState> {
  if (Array.isArray(input)) return input
  return (input as TavernState).memories
}

export function findMemory(
  state: TavernState | ReadonlyArray<MemoryState>,
  id: string,
): MemoryState | undefined {
  for (const memory of asMemoryList(state)) {
    if (memory.id === id) return memory
  }
  return undefined
}

export function hasMemory(
  state: TavernState | ReadonlyArray<MemoryState>,
  id: string,
): boolean {
  return findMemory(state, id) !== undefined
}

export function getMemoryStrength(
  state: TavernState | ReadonlyArray<MemoryState>,
  id: string,
): number {
  return findMemory(state, id)?.strength ?? 0
}

export function getMemoriesByTag(
  state: TavernState | ReadonlyArray<MemoryState>,
  tag: string,
): MemoryState[] {
  const out: MemoryState[] = []
  for (const memory of asMemoryList(state)) {
    if (memory.tags.includes(tag)) out.push(memory)
  }
  return out
}

export function getMemoriesByDefinition(
  state: TavernState | ReadonlyArray<MemoryState>,
  definitionId: string,
): MemoryState[] {
  const out: MemoryState[] = []
  for (const memory of asMemoryList(state)) {
    if (memory.definitionId === definitionId) out.push(memory)
    else if (memory.id === definitionId) out.push(memory)
  }
  return out
}

function entityRefEquals(a: EntityRef, b: EntityRef): boolean {
  return a.kind === b.kind && a.id === b.id
}

export function getMemoriesForActor(
  state: TavernState | ReadonlyArray<MemoryState>,
  actor: EntityRef,
): MemoryState[] {
  const out: MemoryState[] = []
  for (const memory of asMemoryList(state)) {
    if (memory.actors.some((a) => entityRefEquals(a, actor))) {
      out.push(memory)
    }
  }
  return out
}

export function getMemoriesForLocation(
  state: TavernState | ReadonlyArray<MemoryState>,
  location: EntityRef,
): MemoryState[] {
  const out: MemoryState[] = []
  for (const memory of asMemoryList(state)) {
    if (memory.locations.some((l) => entityRefEquals(l, location))) {
      out.push(memory)
    }
  }
  return out
}

export function getMemoriesByType(
  state: TavernState | ReadonlyArray<MemoryState>,
  type: MemoryState['type'],
): MemoryState[] {
  const out: MemoryState[] = []
  for (const memory of asMemoryList(state)) {
    if (memory.type === type) out.push(memory)
  }
  return out
}

// Phase 16 §"Calendar Stamp" — build a stamp from the current calendar.
// `absoluteDay` mirrors `totalDaysElapsed` so age math is just
// subtraction.
export function stampFromCalendar(calendar: CalendarState): CalendarStamp {
  return {
    year: calendar.year,
    month: calendar.month,
    week: calendar.week,
    day: calendar.day,
    absoluteDay: calendar.totalDaysElapsed,
  }
}
