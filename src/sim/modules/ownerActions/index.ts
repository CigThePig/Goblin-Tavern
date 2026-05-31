// Phase 13 — Owner actions module re-exports.
//
// `ownerActionsModule.ts` is the canonical implementation file. `index.ts`
// keeps the barrel so callers can `import { ownerActionsModule } from
// '.../modules/ownerActions'` without knowing the file split.
//
// Phase 33 — Adds barrels for the project/policy/social subsystems and
// the state helpers so test files and service-side integrations can
// pull everything from one path.

export {
  ownerActionsModule,
  OWNER_ACTIONS_MODULE_ID,
  DAY_MINUTES,
  createInitialOwnerActionsModuleState,
  getOwnerActionsModuleState,
  actionRegistry,
  ensureRequiredOwnerActionsRegistered,
} from './ownerActionsModule'

export {
  REQUIRED_OWNER_ACTIONS,
  cleanArea,
  repairArea,
  restockItemAction,
  adjustPrices,
  payStaffBonus,
  waterDownAle,
  improveStew,
  patchRoof,
  fumigateCellar,
  buyMugs,
} from './actionDefinitions'

export {
  PROJECT_ACTIONS,
  PROJECT_STARTERS,
  findStarterByProjectType,
  projectInstanceIdFor,
} from './projectActions'

export { POLICY_ACTIONS, POLICY_STARTERS } from './policyActions'

export {
  SOCIAL_ACTIONS,
  comfortStressedStaff,
  apologizeToRegular,
  negotiateWithSupplier,
  warnRowdyGroup,
  hostFactionNight,
} from './socialActions'

export {
  getEnabledPolicies,
  isPolicyEnabled,
  RECENT_SOCIAL_ACTIONS_LIMIT,
} from './stateHelpers'

export type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionApplied,
  OwnerActionCategory,
  OwnerActionDefinition,
  OwnerActionId,
  OwnerActionInput,
  OwnerActionRejected,
  OwnerActionTargetType,
  OwnerActionsModuleState,
  OwnerPolicyState,
  OwnerProjectState,
  OwnerProjectStatus,
  OwnerSocialActionOutcome,
  OwnerSocialActionRecord,
} from './types'
