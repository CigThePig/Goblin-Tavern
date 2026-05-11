// Phase 19 §19.11 — Impact scoring re-export.
//
// The canonical impact-scoring code lives in the issues module so the
// generators can pre-compute consequence profile scores. This file
// re-exports the surface for response-resolver consumers.

export {
  classifyImpact,
  IMPACT_THRESHOLDS,
  scoreAppliedEffects,
  scoreEffects,
  scoreProfile,
} from '../issues/impactScoring'
