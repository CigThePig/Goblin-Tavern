// Expansion Phase 1 §1.5 — public surface of the meters contract.
// Re-exports only; see `../ruleset/index.ts` for why.

export {
  MAX_METER_DETAILS,
  METERS_MODULE_ID,
  MOMENTUM_DECAY,
  VELOCITY_SMOOTHING,
  HysteresisLatchSchema,
  MeterDetailSchema,
  MetersModuleStateSchema,
  createEmptyMeterDetail,
  meterDetailIsInteresting,
  type HysteresisLatch,
  type MeterDetail,
  type MeterTarget,
  type MetersModuleState,
} from './types'

export {
  applyDebtToRecovery,
  createInitialMetersModuleState,
  getMeterDetail,
  meterDebt,
  meterExcess,
  readMetersSlice,
  recordMeterMovement,
  troubledMeters,
  writeMetersSlice,
  type MeterMovement,
} from './detail'

export {
  DEFAULT_HYSTERESIS_DAYS,
  evaluateHysteresis,
  getHysteresisLatch,
  peekHysteresis,
  type HysteresisEvaluation,
} from './hysteresis'

export { metersModule } from './metersModule'
