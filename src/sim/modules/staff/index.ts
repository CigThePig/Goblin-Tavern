// Phase 11 — Staff module re-exports.
//
// `staffModule.ts` is the canonical implementation file. `index.ts`
// keeps the barrel so callers can `import { staffModule } from
// '.../modules/staff'` without knowing the file split.

export {
  staffModule,
  STAFF_MODULE_ID,
  createInitialStaffModuleState,
  getStaffModuleState,
  staffRegistry,
  staffPriorityRegistry,
  canStaffWork,
  getStaffEffectiveness,
  getStaffFatiguePenalty,
  getStaffMoraleBonus,
  getStaffStressPenalty,
  derivePriorityModifiers,
  summarizeStaff,
  validateStaffIdentityProfileRegistration,
} from './staffModule'

export {
  ensureRequiredStaffRolesRegistered,
} from '../../registries/staffRegistry'

export {
  ensureRequiredStaffPrioritiesRegistered,
  getAllowedPrioritiesForRole,
  getDefaultPriorityForRole,
  isPriorityAllowedForRole,
} from '../../registries/staffPriorityRegistry'

export type {
  StaffPriorityAssignment,
  StaffEffectivenessSummary,
  ServiceQualityModifiers,
  StaffModuleState,
} from './types'

export type {
  StaffRoleDefinition,
  StaffRoleDefaultState,
} from '../../registries/staffRegistry'

export type { StaffPriorityDefinition } from '../../registries/staffPriorityRegistry'
