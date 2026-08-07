// Phase 37 — Attribution module barrel.
//
// Surfaces the canonical `attributionModule`, the per-day state shape,
// the rule list, and the query helpers consumed by tests, reports, and
// (eventually) issue-seed generators and the card text-ingredient layer.

export {
  ATTRIBUTION_MODULE_ID,
  attributionModule,
  createInitialAttributionModuleState,
  easeAttribution,
  recordAttribution,
} from './attributionModule'

// Expansion Phase 8 §8.5 — the shared belief input, and the record of what it
// is doing. Every domain that reads belief reads it through here.
export {
  BELIEF_ACTING_THRESHOLD,
  PUBLIC_BELIEF_THRESHOLD,
  beliefAgainstHouse,
  beliefBetween,
  beliefEffect,
  goodwillTowardHouse,
  houseRef,
  isActing,
  netFeelingTowardHouse,
  publicBeliefAgainstHouse,
} from './beliefInputs'
export type { BeliefDirection, BeliefPressure } from './beliefInputs'
export {
  MAX_ACTING_BELIEFS,
  MAX_BELIEF_HISTORY,
  actingBeliefs,
  actingBeliefsFor,
  bumpBeliefTotal,
  createInitialBeliefBehaviour,
  deriveActingBeliefs,
  domainsReading,
  normalizeBeliefBehaviour,
} from './beliefBehaviour'
export type {
  BeliefActingRecord,
  BeliefBehaviourState,
} from './attributionTypes'
// Imported for its registration side effect as well as its exports: the two
// belief-shaped hook families have to be in the scheduled-event registry
// before a response can drain one. It lives on the barrel rather than inside
// `attributionModule` because it needs `recordAttribution` from there, and a
// module that imports its own importer is a cycle waiting to bite.
export {
  BELIEF_BRIBE_EXPOSED_EVENT,
  BELIEF_GRUDGE_EVENT,
  BELIEF_SCHEDULED_EVENTS,
  BELIEF_SCHEDULED_EVENT_TYPES,
  ensureBeliefScheduledEventsRegistered,
} from './beliefEvents'

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
