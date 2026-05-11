// Phase 16 — module-level type re-exports.
//
// The canonical memory types live in `memoryTypes.ts` (registry-facing
// definitions) and `state/TavernState.ts` (on-state shape). This file
// remains as a stable import point so callers can write
// `import type { ... } from '.../memories/types'` without knowing the
// internal split.

export type {
  MemoryDefinition,
  MemoryDraft,
  MemoryStackingStrategy,
  MemoryPatternRule,
  MemoryPatternInput,
  MemoryPatternMatch,
} from './memoryTypes'

export type { MemoryModuleState } from './memoryModule'
