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
  IssueSeed,
  IssueSeedFamilyId,
  IssueSeedQuery,
  IssueSeedTiming,
  IssueSeedType,
  ResponseIntent,
  ResponseIntentShape,
  ResponseIntentVerb,
  ResponseResolutionResult,
  ResponseSlot,
  SeedValidation,
  StakeRef,
  TextIngredients,
} from './issueSeedTypes'

export { TEXT_INGREDIENT_LIMITS } from './issueSeedTypes'

export type { IssueSeedGenerator } from './issueSeedRegistry'

export { ensureRequiredSeedGeneratorsRegistered } from './issueSeedGenerators'

export {
  CONTRADICTION_GUARDS,
  aleStockHighGuard,
  unpaidWagesGuard,
  merchantPresenceGuard,
  roofRepairedTodayGuard,
} from './contradictionGuards'

export type { ContradictionResult } from './contradictionGuards'

export {
  bumpCooldownOnGenerate,
  computeCardWorthiness,
  computeNovelty,
  rankSeeds,
} from './issueSeedRanking'

export { validateSeed, validateTextIngredients, CONTRACT_CHECK_IDS } from './issueSeedValidation'

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
  customerRef,
  effect,
  makeProfile,
  staffRef,
  stockRef,
  systemRef,
  stake,
} from './generatorHelpers'
