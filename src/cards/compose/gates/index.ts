// Phase 124 / ISSUE-093 — Living Cast arc, Phase D.
//
// Public surface of the six structural gates. Phase E will import from
// here when it wires generation output into CI.

export { checkCoverage } from './coverage'
export { checkSpecificityGradient } from './specificity'
export {
  checkVoiceBounds,
  wordCount,
  DEFAULT_BODY_WORD_BUDGET,
  type VoiceBoundsConfig,
} from './voiceBounds'
export {
  checkSimCoherence,
  type SimCoherenceConfig,
} from './simCoherence'
export {
  checkDeterminism,
  type DeterminismSample,
} from './determinism'
export {
  checkPoolDiversity,
  type DiversityConfig,
  type DiversityObservation,
  type DiversitySample,
  type DiversitySampler,
} from './diversity'
export {
  runAllGates,
  type AllGatesConfig,
  type AllGatesReport,
  type DiversityReportEntry,
  type DiversitySlotConfig,
} from './runAllGates'
export {
  passReport,
  failReport,
  type GateReport,
  type GateViolation,
} from './types'
