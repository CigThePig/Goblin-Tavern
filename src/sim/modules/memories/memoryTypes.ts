import type {
  CalendarStamp,
  EntityRef,
  MemoryState,
  MemoryType,
} from '../../state/TavernState'

// Phase 16 §"Memory Shape" / §16.1 — supporting types for the memory
// registry and context API. The state-side `MemoryState` shape lives in
// `state/TavernState.ts` so it can be schema-validated; this file holds
// the registry definition shape, the draft shape used by `ctx.addMemory`,
// and helpers re-exported for module authors.

/**
 * Strategy applied when `ctx.addMemory` is called with an `id` that
 * already exists in `state.memories`.
 *
 * - `replace` — drop the existing memory and add the new one.
 * - `refresh` — keep the existing memory but reset its `ageDays` and
 *   refresh `durationDays` / `expiresAt` from the new draft.
 * - `increase_strength` — bump the strength of the existing memory
 *   (clamped to 100). Duration is refreshed when the draft has one.
 * - `stack` — append a new memory whose state id is the registry id
 *   suffixed with a counter so existing instances are preserved.
 */
export type MemoryStackingStrategy =
  | 'replace'
  | 'refresh'
  | 'increase_strength'
  | 'stack'

export type MemoryDefinition = {
  id: string
  type: MemoryType
  label?: string
  defaultDurationDays?: number
  defaultStrength?: number
  defaultDecayRate?: number
  tags: string[]
  relatedSystems?: string[]
  stacking?: MemoryStackingStrategy
}

/**
 * Phase 16 §16.2 — the input shape for `ctx.addMemory`. Every field
 * other than `id` is optional: when omitted, the value is filled in
 * from the registered `MemoryDefinition` (and ultimately from sensible
 * defaults if no definition exists).
 */
export type MemoryDraft = {
  id: string
  type?: MemoryType
  label?: string
  strength?: number
  durationDays?: number
  decayRate?: number
  actors?: EntityRef[]
  locations?: EntityRef[]
  relatedSystems?: string[]
  tags?: string[]
  source?: string
  metadata?: Record<string, unknown>
}

export type MemoryPatternRule = {
  id: string
  /** Predicate evaluated weekly. When true, the pattern memory is created. */
  detect(input: MemoryPatternInput): MemoryPatternMatch | null
}

export type MemoryPatternInput = {
  memories: ReadonlyArray<MemoryState>
  /** Absolute day at the moment of detection. */
  absoluteDay: number
}

export type MemoryPatternMatch = {
  strength?: number
  durationDays?: number
  relatedSystems?: string[]
  tags?: string[]
  source?: string
  metadata?: Record<string, unknown>
}

export type { CalendarStamp, EntityRef, MemoryState, MemoryType }
