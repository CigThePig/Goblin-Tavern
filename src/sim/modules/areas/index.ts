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
