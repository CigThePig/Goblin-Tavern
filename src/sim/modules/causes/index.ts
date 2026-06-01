// Phase 17 — Cause-tracking module barrel.

export {
  CAUSES_MODULE_ID,
  causesModule,
  createInitialCauseModuleState,
  getCauseModuleState,
  ensureRequiredCausesRegistered,
  causeRegistry,
} from './causeModule'

export type { CauseModuleState } from './causeModule'
export type { CauseDefinition } from './causeRegistry'
export { REQUIRED_CAUSE_DEFINITIONS } from './causeRegistry'

export type {
  CauseDirection,
  CauseDraft,
  CauseSourceType,
  CauseTargetType,
} from './causeTypes'

export {
  ageCauses,
  DEFAULT_CAUSE_EXPIRY_DAYS,
} from './causeAging'

export {
  buildCauseReport,
  findUnexplainedSignificantChanges,
  CAUSE_REPORT_ID,
  CAUSE_REPORT_SOURCE,
} from './causeReport'

export type { CauseClass } from './causeClassify'
export { classifyCause, pickDominantCause } from './causeClassify'

export {
  getCausesForTarget,
  getCausesByTag,
  getCausesBySource,
  getTopCausesForTarget,
  getRecentCauses,
  explainTargetChange,
  explainCustomerSatisfaction,
  explainPressure,
  explainReputation,
  explainCoinChange,
} from './causeQueries'
