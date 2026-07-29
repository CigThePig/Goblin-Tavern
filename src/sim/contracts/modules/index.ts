// Expansion Phase 1 §1.7 — public surface of the module contract layer.
// Re-exports only; see `../ruleset/index.ts` for why.

export {
  KNOWN_COMPATIBILITY_BARRELS,
  MODULE_CONTRACTS,
  foreignSliceWrites,
  ownedSlices,
  type CompatibilityBarrel,
  type ModuleContract,
  type ModuleSliceContract,
  type SliceAccess,
} from './contracts'

export {
  EXPECTED_SEGMENT_FIRST_PHASES,
  checkContractCoverage,
  checkModuleOrder,
  checkPhaseDependencies,
  checkSegmentBoundaries,
  checkSliceOwnership,
  runArchitectureChecks,
  undeclaredModules,
  type ArchitectureProblem,
} from './architecture'
