// Phase 13 — Owner actions module re-exports.
//
// `ownerActionsModule.ts` is the canonical implementation file. `index.ts`
// keeps the barrel so callers can `import { ownerActionsModule } from
// '.../modules/ownerActions'` without knowing the file split.

export {
  ownerActionsModule,
  OWNER_ACTIONS_MODULE_ID,
  DEFAULT_ACTION_POINT_BUDGET,
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

export type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionApplied,
  OwnerActionDefinition,
  OwnerActionId,
  OwnerActionInput,
  OwnerActionRejected,
  OwnerActionTargetType,
  OwnerActionsModuleState,
} from './types'
