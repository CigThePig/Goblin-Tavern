export type { SimulationPhase, SimPhase } from './phases'
export { SIMULATION_PHASES } from './phases'
export type {
  SimContext,
  SimInput,
  MutationMeta,
  AddLogInput,
} from './context'
export type {
  SimulationHook,
  SimulationModule,
  SimHook,
  SimModule,
  RegistrationContext,
} from './module'
export type { SimulationResult, SimResult } from './result'
export type { ReportSection, SimLog, SimLogLevel } from './reports'
export type {
  StateChange,
  StateDiff,
  DiffThresholds,
  TaggedStateDiff,
  PhaseBoundary,
} from './diff'
export {
  DEFAULT_THRESHOLDS,
  createStateDiff,
  filterSignificantChanges,
  tagDiff,
} from './diff'
export { ChangeTracker } from './changeTracker'
export type { EffectKind, EffectPreview, EffectResult } from './effect'
export { simulateDay, runSimulation } from './engine'
