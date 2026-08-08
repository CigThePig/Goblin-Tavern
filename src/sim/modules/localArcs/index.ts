export {
  LOCAL_ARCS_MODULE_ID,
  createInitialLocalArcsModuleState,
  getLocalArcsModuleState,
  localArcsModule,
} from './localArcsModule'
export type {
  LocalArcsAppliedEffectRecord,
  LocalArcsModuleState,
} from './types'
export {
  listActiveArcs,
  listAllArcs,
  computeArcProgress,
  createArcInstance,
  pickArcsToStart,
} from './arcEngine'
export { buildLocalArcsReport } from './report'

// Expansion Phase 9 §9.2 — arcs that progress on state and on moves.
export {
  ARC_BACKLASH_EVENT,
  ARC_DEBT_CALLED_IN_EVENT,
  ARC_OUTCOME_REVIEW_EVENT,
  ARC_PERMANENT_LOCK_EVENT,
  ARC_SCHEDULED_EVENTS,
  ARC_SCHEDULED_EVENT_TYPES,
  ensureArcScheduledEventsRegistered,
  scheduleArcHook,
} from './arcEvents'
export {
  SETTLEMENT_MARGIN,
  arcLabel,
  availableInterventions,
  canSettleArc,
  definitionLabel,
  ensureArcRuns,
  findIntervention,
  runArcDailyPass,
  settleArc,
  takeArcIntervention,
} from './arcDay'
export {
  allConditionsHold,
  computeOutcome,
  computeStageTransition,
  enterStage,
  evaluateAdvanceCondition,
  ownerRelationship,
  progressionFor,
  resolveArcOwner,
  runOpposingMoves,
  stageFor,
  unmetConditions,
} from './arcProgress'
export { applyPermanentChange, closeArcRun } from './arcOutcomes'
export {
  bumpArcRunTotal,
  createInitialArcRunTotals,
  getArcRun,
  getArcRunTotals,
  getArcRuns,
  liveArcRuns,
  noteArcRun,
  openArcRun,
  pruneArcRuns,
  writeArcRun,
  writeArcSlice,
} from './arcRuns'
export type { ArcRun, ArcRunTotals } from './arcRuns'
export { hasStateGate } from './arcEngine'
