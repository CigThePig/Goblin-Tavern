// Phase 19 — Issue seed module barrel.

export {
  ISSUE_SEEDS_MODULE_ID,
  createInitialIssueSeedModuleState,
  issueSeedGeneratorRegistry,
  issueSeedsModule,
  REQUIRED_SEED_GENERATORS,
} from './issueSeedModule'

export type { IssueSeedModuleState } from './issueSeedTypes'

export type {
  ConsequenceProfile,
  CooldownEntry,
  CoreIssueSeedFamilyId,
  ExpandedIssueSeedFamilyId,
  IssueSeed,
  IssueSeedFamilyId,
  IssueSeedQuery,
  IssueSeedTiming,
  IssueSeedType,
  NamedEntityIngredient,
  ResponseIntent,
  ResponseIntentShape,
  ResponseIntentVerb,
  ResponseResolutionResult,
  ResponseSlot,
  SeedValidation,
  StakeRef,
  TextIngredients,
} from './issueSeedTypes'

export {
  CORE_ISSUE_SEED_FAMILIES,
  EXPANDED_ISSUE_SEED_FAMILIES,
  TEXT_INGREDIENT_LIMITS,
} from './issueSeedTypes'

export type { IssueSeedGenerator } from './issueSeedRegistry'

export {
  ALL_SEED_GENERATORS,
  ensureRequiredSeedGeneratorsRegistered,
} from './issueSeedGenerators'

export { EXPANDED_SEED_GENERATORS } from './expandedSeedGenerators'

export {
  CONTRADICTION_GUARDS,
  EXPANDED_CONTRADICTION_GUARDS,
  activeArcExistsGuard,
  aleStockHighGuard,
  areaTraitStillPresentGuard,
  cultureExistsGuard,
  factionExistsGuard,
  merchantPresenceGuard,
  policyStillActiveGuard,
  projectStillIncompleteGuard,
  regularExistsGuard,
  roofRepairedTodayGuard,
  rumourStillActiveGuard,
  staffStillEmployedGuard,
  supplierExistsGuard,
  unpaidWagesGuard,
} from './contradictionGuards'

export type { ContradictionResult } from './contradictionGuards'

export {
  bumpCooldownOnGenerate,
  computeCardWorthiness,
  computeNovelty,
  rankSeeds,
} from './issueSeedRanking'

export {
  CONTRACT_CHECK_IDS,
  validateSeed,
  validateSeedAgainstState,
  validateTextIngredients,
} from './issueSeedValidation'

export {
  buildIssueSeedReport,
  ISSUE_SEEDS_REPORT_ID,
  ISSUE_SEEDS_REPORT_SOURCE,
} from './issueSeedReport'

export {
  ISSUE_SEEDS_MODULE_ID as ISSUE_SEEDS_QUERY_MODULE_ID,
  getAllSeedsToday,
  getCooldown,
  getIssueSeedSlice,
  getIssueSeeds,
  getRejectedSeedsToday,
} from './issueSeedQueries'

export {
  classifyImpact,
  IMPACT_THRESHOLDS,
  scoreEffects,
  scoreProfile,
} from './impactScoring'

export {
  areaRef,
  buildTextIngredients,
  cultureRef,
  customerRef,
  displayNameForRef,
  effect,
  entityMemoryList,
  factionRef,
  localArcRef,
  makeProfile,
  namedEntityIngredient,
  projectRef,
  regularRef,
  rumourRef,
  serviceSceneRef,
  staffRef,
  stake,
  stockRef,
  strongestAttributionText,
  strongestMemoryText,
  supplierRef,
  systemRef,
  tavernIdentityRef,
} from './generatorHelpers'
