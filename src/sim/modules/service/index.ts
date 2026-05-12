// Phase 12 — Daily service module re-exports.
//
// `serviceModule.ts` is the canonical implementation file. `index.ts`
// keeps the barrel so callers can `import { serviceModule } from
// '.../modules/service'` without knowing the file split.

export {
  serviceModule,
  SERVICE_MODULE_ID,
  createInitialServiceModuleState,
  getServiceModuleState,
} from './serviceModule'

export {
  resolveService,
  applyStaffStressFatigue,
  buildEmptyResult,
  findDayDrivers,
  readServiceResult,
  satisfactionAdjustmentsFromService,
} from './resolveService'

// Phase 32 — scene builder exports.
export { buildServiceScenes, SERVICE_SCENE_LIMITS } from './serviceScenes'

export type {
  AreaChangeSummary,
  CustomerSatisfactionChange,
  DailyServiceResult,
  PurchaseLine,
  PurchaseSummary,
  ServiceIncidentSummary,
  ServiceModuleState,
  ServiceScene,
  ServiceSceneSeverity,
  ServiceSceneTextIngredients,
  ServiceSceneType,
  StaffChangeSummary,
} from './types'
