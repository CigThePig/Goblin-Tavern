// Expansion Phase 7 §7.3 — the regulatory module's public surface.

export {
  regulatoryModule,
  createInitialRegulatoryModuleState,
  watchRef,
} from './regulatoryModule'
export { REGULATORY_ACTIONS } from './actions'
export {
  EVIDENCE_WINDOW_DAYS,
  INSPECTION_DIMENSIONS,
  MAX_APPEALS_PER_CASE,
  MAX_ARCHIVED_CASES,
  MAX_EVIDENCE_ENTRIES,
  MAX_FINDINGS_PER_CASE,
  MAX_OPEN_CASES,
  REGULATORY_MODULE_ID,
  WATCH_ID,
  WATCH_LABEL,
  evidenceWeight,
  liveEvidence,
  openCases,
  type EvidenceEntry,
  type InspectionDimension,
  type InspectionFinding,
  type InspectionOutcome,
  type RegulatoryModuleState,
  type TavernRegulatoryCase,
} from './types'
export {
  findCase,
  getCase,
  getFinding,
  getRegulatoryModuleState,
  listFindings,
} from './state'
export {
  accumulateEvidence,
  observeEvidence,
  suspicionFromEvidence,
  noteIncidentEvidence,
} from './evidence'
export {
  CASE_THRESHOLD,
  appealFinding,
  bribeInspector,
  caseIsSettled,
  checkRequirement,
  closeCase,
  evaluateDimension,
  evaluateVisit,
  openCase,
  payFine,
  performFollowUp,
  performVisit,
  remediateFinding,
  shouldOpenCase,
  updateRecords,
} from './inspection'
export {
  BRIBE_EXPOSED_EVENT,
  CLEANING_STREAK_EVENT,
  REGULATORY_FOLLOWUP_EVENT,
  REGULATORY_VISIT_EVENT,
  WATCH_RELATIONSHIP_EVENT,
  scheduleFollowUp,
  scheduleVisit,
} from './regulatoryEvents'
