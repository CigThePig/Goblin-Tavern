// Phase 19 §"Response Intent Shape" — re-export the response intent
// type surface from the issues module so consumers can import from
// `modules/responses` without reaching across the dependency tree. The
// canonical types live in `modules/issues/issueSeedTypes.ts` so the
// generators and consumers share one shape.

export type {
  ResponseIntent,
  ResponseIntentShape,
  ResponseIntentVerb,
  ResponseResolutionResult,
  ResponseSlot,
} from '../issues/issueSeedTypes'
