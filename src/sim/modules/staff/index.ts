// Phase 11 — Staff module re-exports.
//
// `staffModule.ts` is the canonical implementation file. `index.ts`
// keeps the barrel so callers can `import { staffModule } from
// '.../modules/staff'` without knowing the file split.

export {
  staffModule,
  STAFF_MODULE_ID,
  REQUIRED_STAFF_IDS,
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

// Expansion Phase 3 §3.1–§3.4 — the workforce surface. Re-exported here so
// callers can import from `.../modules/staff` without knowing the file split,
// exactly as the Phase 11 barrel note intends.
export {
  ensureEmploymentRecords,
  effectiveNoticeDays,
  disciplineStaff,
  giveNotice,
  isOnProbation,
  separateStaff,
  setStaffWage,
  severanceFor,
  withdrawNotice,
} from './employment'
export {
  DEFAULT_NOTICE_DAYS,
  MAX_DISCIPLINE_ESCALATION,
  PROBATION_DAYS,
  createEmploymentRecord,
  dailyRate,
  employmentId,
} from './employmentRecord'
export {
  MARKET_REFRESH_DAYS,
  closeVacancy,
  generateApplicant,
  getApplicant,
  hireApplicant,
  listApplicants,
  openVacancy,
  refreshLaborMarket,
  uncoveredRoles,
} from './laborMarket'
export {
  ABANDONMENT_DAYS,
  advanceTenure,
  applyDayLoad,
  buildCoverage,
  buildRoster,
  dayFatigueAndStress,
  illnessRisk,
  resolveAbsences,
  setAbsence,
  totalCoverageGap,
} from './roster'
export {
  CROSS_TRAINING_PER_SESSION,
  EXPERIENCE_PER_SKILL_POINT,
  PROMOTION_MIN_TENURE_DAYS,
  TRAINING_EXPERIENCE,
  TRAINING_EXPERIENCE_WITH_HELPER,
  advanceCrossTraining,
  applyExperience,
  checkPromotion,
  crossTrainableRoles,
  grantExperience,
  isAtSkillCeiling,
  promoteStaff,
  trainStaff,
} from './development'
export {
  OWNER_REF,
  adjustEdge,
  ageRelationships,
  coworkerEdgeId,
  dropEdgesFor,
  findConflictPairs,
  findTrainingHelper,
  findWillingCover,
  getEdge,
  getOwnerEdge,
  listActiveEdgesFor,
  listEdges,
  listEdgesFor,
  noteContact,
  ownerEdgeId,
  ownerTrust,
} from './relationships'
export {
  listWageArrears,
  openWageArrears,
  payDownArrears,
  settleWeeklyWages,
  totalWageArrears,
  wageArrearsTag,
} from './staffWages'
export {
  STAFF_ACTOR_ACTIONS,
  STAFF_ACTOR_ACTION_LIST,
  STAFF_ACTOR_GOALS,
  WEEKLY_ACTOR_BUDGET,
  buildPerception,
  clearStaffIntent,
  deriveGoals,
  listStaffIntents,
  runStaffActors,
} from './staffActors'
export {
  QUIT_RISK_DEFER_BELOW,
  QUIT_RISK_DEFER_DAYS,
  QUIT_RISK_NO_OP_BELOW,
  QUIT_RISK_WALKOUT_AT,
  STAFF_SCHEDULED_EVENTS,
  STAFF_SCHEDULED_EVENT_TYPES,
  describeQuitRiskContributors,
  ensureStaffScheduledEventsRegistered,
  quitRiskScore,
  scheduleQuitRisk,
  scheduleRaiseDemand,
  scheduleSeparation,
} from './staffEvents'
export * from './staffEventTypes'
export {
  DEFAULT_SHIFT,
  deriveCareerGoal,
  withWorkforceDefaults,
} from './workforceDefaults'
export {
  bumpStaffTotal,
  getEmployment,
  recordSeparation,
  upsertEmployment,
  writeStaffSlice,
} from './workforceState'
export {
  getPromotionTarget,
  getRoleDailyDemand,
  getRoleSkillCeiling,
} from '../../registries/staffRegistry'
export {
  getPriorityDefaultAreaId,
  getPriorityWorkKind,
} from '../../registries/staffPriorityRegistry'

export type {
  StaffApplicant,
  StaffCoverageEntry,
  StaffDevelopmentEntry,
  StaffLaborMarketState,
  StaffRelationshipEdge,
  StaffRosterEntry,
  StaffSeparationEntry,
  StaffVacancy,
  StaffWageSettlement,
  StaffWorkKind,
  StaffWorkforceState,
  StaffWorkforceTotals,
} from './workforceTypes'
