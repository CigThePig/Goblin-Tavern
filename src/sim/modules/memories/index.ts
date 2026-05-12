// Phase 16 — Memory module barrel.
//
// `memoriesModule` is the canonical export consumed by the engine and
// by tests; the named helpers re-exported below keep older imports
// (registry access, query helpers, decay helpers) working without
// pulling in implementation files.

export {
  MEMORIES_MODULE_ID,
  memoriesModule,
  createInitialMemoryModuleState,
  getMemoryModuleState,
  ensureRequiredMemoriesRegistered,
  memoryRegistry,
} from './memoryModule'

export type { MemoryModuleState } from './memoryModule'

export {
  REQUIRED_MEMORY_DEFINITIONS,
} from './memoryRegistry'

export type {
  MemoryDefinition,
  MemoryDraft,
  MemoryStackingStrategy,
} from './memoryTypes'

export {
  findMemory,
  hasMemory,
  getMemoryStrength,
  getMemoriesByTag,
  getMemoriesByDefinition,
  getMemoriesForActor,
  getMemoriesForLocation,
  getMemoriesByType,
  stampFromCalendar,
} from './memoryQueries'

export { ageMemories, bumpStrength } from './memoryDecay'

export { detectPatterns } from './patternDetection'

export { buildMemoryReport } from './memoryReport'

// Phase 36 §36.1–§36.2 — Entity-scoped memory helpers.
export {
  memoriesForOwner,
  memoriesAboutEntity,
  grudgesAgainst,
  gratitudeToward,
  strongestMemoryFor,
  memoryBelongsTo,
  memoryIsAbout,
  memoryOwner,
  memorySubjects,
  memoryTargets,
  memoryBeneficiaries,
  memoryWitnesses,
  memoryCredited,
  memoryBlamed,
  withEntityMemoryMetadata,
  attachEntityOwnerToDraft,
  applyEntityMemoryFilters,
  addEntityMemoryViaCtx,
} from './entityMemory'

export type {
  EntityMemoryMetadata,
  EntityMemoryRole,
  EntityMemoryQueryOptions,
} from './entityMemory'
