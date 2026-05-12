// Phase 18 — Pressure module barrel.

export {
  PRESSURES_MODULE_ID,
  pressuresModule,
  createInitialPressureModuleState,
  getPressureModuleState,
  ensureRequiredPressuresRegistered,
  pressureRegistry,
} from './pressureModule'

export type { PressureModuleState } from './pressureModule'

export type { PressureDefinition } from './pressureRegistry'
export {
  REQUIRED_PRESSURE_DEFINITIONS,
  EXPANDED_PRESSURE_DEFINITIONS,
} from './pressureRegistry'

export type {
  AnyPressureId,
  ExpandedPressureId,
  PressureCalculationResult,
  PressureCategory,
  PressureCauseRef,
  PressureId,
  PressureSnapshot,
  PressureTrend,
} from './pressureTypes'
export {
  PRESSURE_IDS,
  EXPANDED_PRESSURE_IDS,
  EXPANDED_PRESSURE_CATEGORIES,
  TREND_STABLE_EPSILON,
} from './pressureTypes'

export {
  PRESSURE_WEBS,
  pressureSnapshotValue,
  pressureValue,
  relatedPressureContribution,
} from './pressureWebs'

export {
  buildPressureReport,
  PRESSURE_REPORT_ID,
  PRESSURE_REPORT_SOURCE,
} from './pressureReport'

export {
  getPressureSnapshot,
  getAllPressureSnapshots,
  getPressureTrend,
  getDominantPressures,
  getRisingPressures,
  getMostUrgentPressures,
  getPressureCauses,
  getPressureHistory,
} from './pressureQueries'
