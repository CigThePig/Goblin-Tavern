// Phase 17 §"Required Outputs" — re-export of the canonical cause-type
// surface. The phase doc lists both `causeTypes.ts` and `types.ts` as
// expected files; this barrel mirrors the Phase 16 precedent (memories
// has the same split between `memoryTypes.ts` and `types.ts`).

export type {
  CauseDirection,
  CauseDraft,
  CauseSourceType,
  CauseTargetType,
} from './causeTypes'
