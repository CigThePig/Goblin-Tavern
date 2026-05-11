// Phase 18 — Re-export of pressure-related types for the module barrel.

export type {
  PressureCalculationResult,
  PressureCauseRef,
  PressureId,
  PressureSnapshot,
  PressureTrend,
} from './pressureTypes'

export { PRESSURE_IDS, TREND_STABLE_EPSILON } from './pressureTypes'
