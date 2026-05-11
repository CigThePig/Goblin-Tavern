import type { MemoryState } from '../../state/TavernState'

// Phase 16 §16.4 — Memory aging and expiration.
//
// At the end of each day every memory has its `ageDays` incremented by
// 1 (or `daysElapsed` if a multi-day step is fed in). Timed and pattern
// memories also have their strength decayed when a `decayRate` is set.
// Memories expire when their duration has elapsed OR their strength
// has dropped to zero.
//
// Fact memories never decay or expire automatically. Future hooks may
// expire when their duration runs out.

export type MemoryAgeResult = {
  next: MemoryState[]
  expired: MemoryState[]
}

const DAY = 1

export function ageMemories(
  memories: ReadonlyArray<MemoryState>,
  daysElapsed: number = DAY,
): MemoryAgeResult {
  if (daysElapsed <= 0) {
    return { next: [...memories], expired: [] }
  }

  const next: MemoryState[] = []
  const expired: MemoryState[] = []

  for (const memory of memories) {
    const aged = stepMemory(memory, daysElapsed)
    if (isExpired(aged)) {
      expired.push(aged)
    } else {
      next.push(aged)
    }
  }

  return { next, expired }
}

function stepMemory(memory: MemoryState, daysElapsed: number): MemoryState {
  // Fact memories are immutable under aging — they may be removed
  // explicitly but do not expire on their own.
  if (memory.type === 'fact') {
    return memory
  }
  const ageDays = memory.ageDays + daysElapsed
  const decayPerDay = memory.decayRate ?? 0
  const nextStrength = decayPerDay > 0
    ? Math.max(0, memory.strength - decayPerDay * daysElapsed)
    : memory.strength
  return {
    ...memory,
    ageDays,
    strength: nextStrength,
  }
}

function isExpired(memory: MemoryState): boolean {
  if (memory.type === 'fact') return false
  if (memory.durationDays !== undefined && memory.ageDays >= memory.durationDays) {
    return true
  }
  if (memory.strength <= 0) {
    return true
  }
  return false
}

/**
 * Phase 16 §16.5 — strength bump for stacking memories. Clamps the
 * resulting strength to the [0, 100] range so additive stacks never
 * blow past the meter cap.
 */
export function bumpStrength(current: number, delta: number): number {
  const next = current + delta
  if (next < 0) return 0
  if (next > 100) return 100
  return next
}
