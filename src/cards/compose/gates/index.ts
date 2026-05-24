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
  VOICE_BOUNDS_REASONS,
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
export { representativeBannedNames } from './representativeBannedNames'
export {
  checkDedupe,
  canonicaliseText,
  DEFAULT_DEDUPE_THRESHOLD,
  type DedupeConfig,
} from './dedupe'
export { levenshtein, normalisedSimilarity } from './levenshtein'
export {
  checkCrossSituationVoice,
  type CrossSituationActorKind,
  type CrossSituationArchetype,
  type CrossSituationArchetypeObservation,
  type CrossSituationConfig,
  type CrossSituationKindConfig,
  type CrossSituationKindObservation,
  type CrossSituationReport,
  type CrossSituationSample,
} from './crossSituation'
export {
  checkPreviewVariety,
  DEFAULT_TARGET_KIND_KEYWORDS,
  PREVIEW_VARIETY_REASONS,
  PREVIEW_VARIETY_DEFAULTS,
  type PreviewLegibilityRule,
  type PreviewSpecificityRule,
  type PreviewVarietyChoice,
  type PreviewVarietyConfig,
  type PreviewVarietyContext,
  type PreviewVarietyObservation,
  type PreviewVarietyReason,
  type PreviewVarietySample,
  type PreviewVarietySampler,
} from './previewVariety'
