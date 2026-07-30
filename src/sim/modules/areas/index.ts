// Phase 8 — Area module re-exports.
//
// `areasModule.ts` is the canonical implementation file (per
// `phases-06-10.md` §8 Agent Execution Checklist). `index.ts` keeps the
// barrel so callers can `import { areasModule } from '.../modules/areas'`
// without knowing the file split.

export {
  areasModule,
  areaRegistry,
  ensureRequiredAreasRegistered,
  getAreaQualityBand,
  isAreaFilthy,
  isAreaDamaged,
  isAreaDangerous,
  isAreaInspectionRisk,
} from './areasModule'

// Phase 28 §28.6 — surface the trait/upgrade/atmosphere helpers so
// downstream modules can reach them without importing through `derived`.
export {
  hasAreaTrait,
  hasAreaAtmosphere,
  hasInstalledUpgrade,
  getInstalledUpgradeIds,
  getAreaMechanicalTags,
  describeAreaAtmosphere,
} from './derived'

export type { AreaQualityBand, AreaDefinition } from './types'

// Expansion Phase 2 §2.1–§2.5 — the physical model's public surface. Callers
// outside the module (the projection layer, the owner actions, the customers
// and stock modules) go through this barrel rather than reaching into the
// implementation files, so the module's slice and its derivations have one
// documented entry point.
export {
  AREAS_MODULE_ID,
  createInitialAreasModuleState,
  getAreasModuleState,
  AreasModuleStateSchema,
} from './state'
export type {
  AreaCapacitySnapshot,
  AreaConstructionLogEntry,
  AreaPropagationEntry,
  AreaWorkBlock,
  AreasModuleState,
} from './state'
export {
  PATRONS_PER_PRIVY_STALL,
  getAreaBlockedFraction,
  getBaseAreaCapacity,
  getCustomerFacingSeating,
  getInstalledAreaCapacity,
  getTotalUsableWorkstations,
  getUsableAreaCapacity,
  getUsableCapacity,
} from './capacity'
export {
  CONSTRUCTION_PRIORITY,
  OWNER_FUND_LABOUR,
  SITE_BASE_LABOUR_PER_DAY,
  crewMemberLabour,
  getMaxConcurrentSites,
  listActiveSites,
  listConstructionCrew,
} from './labour'
export {
  checkUpgradeAffordability,
  checkUpgradeEligibility,
  listAreasForUpgrade,
  listCatalogueForArea,
  quoteAreaUpgrade,
  upgradeLabourRequired,
} from './quote'
export type { AreaUpgradeQuote, AreaUpgradeVerdict } from './quote'
export {
  cancelUpgrade,
  completeUpgrade,
  damageUpgrade,
  fundUpgrade,
  pauseUpgrade,
  repairUpgrade,
  resumeUpgrade,
  serviceUpgrade,
  startUpgrade,
  tickConstruction,
  tickUpkeep,
} from './construction'
export {
  AREA_PROPAGATION_EDGES,
  applyAreaPropagation,
  findUngroundedPropagationEdges,
} from './propagation'
export {
  buildAreaWorkSchedule,
  getSiteLabourPerDay,
  scheduledSiteKeys,
} from './schedule'
export {
  AREA_SCHEDULED_EVENT_TYPES,
  ensureAreaScheduledEventsRegistered,
} from './areaEvents'
