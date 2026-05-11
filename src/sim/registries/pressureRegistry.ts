// Phase 2 placeholder file kept around to preserve the import path used
// by `tests/sim/phase2.structure.test.ts`. The canonical pressure
// registry lives in `src/sim/modules/pressures/pressureRegistry.ts`
// (Phase 18 §"Required Outputs"); this file simply re-exports it.

export {
  pressureRegistry,
  REQUIRED_PRESSURE_DEFINITIONS,
  ensureRequiredPressuresRegistered,
} from '../modules/pressures/pressureRegistry'

export type { PressureDefinition } from '../modules/pressures/pressureRegistry'
