// Phase 37 — Attribution module barrel.
//
// Surfaces the canonical `attributionModule`, the per-day state shape,
// the rule list, and the query helpers consumed by tests, reports, and
// (eventually) issue-seed generators and the card text-ingredient layer.

export {
  ATTRIBUTION_MODULE_ID,
  attributionModule,
  createInitialAttributionModuleState,
} from './attributionModule'

export type { AttributionModuleState } from './attributionModule'

export type {
  AttributionAccuracy,
  AttributionDraft,
  AttributionState,
  AttributionType,
} from './attributionTypes'

export {
  ATTRIBUTION_RULES,
  evaluateAllRules,
} from './attributionRules'

export type { AttributionRule } from './attributionRules'

export {
  attributionsByTag,
  attributionsByTarget,
  attributionsByType,
  attributionsHeldBy,
  blameAgainst,
  creditToward,
  getAttributionModuleState,
  strongestPublicAttributions,
} from './attributionQueries'

export {
  ATTRIBUTION_REPORT_ID,
  ATTRIBUTION_REPORT_SOURCE,
  buildAttributionReport,
} from './attributionReport'
