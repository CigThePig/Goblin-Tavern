// Phase 123 / ISSUE-092 — Living Cast arc, Phase C.
//
// Public surface of the compose slice. Templates author against these
// types; the assembler and factory power the runtime.

export type {
  CompositionalCardTemplate,
  EntityRefKind,
  FilledSlots,
  Snippet,
  SnippetCondition,
  SnippetPool,
  SlotClaimMode,
  SlotSpec,
  VerbalTicId,
  VoiceAxisId,
  VoiceAxisValue,
  VoiceRegisterId,
} from './types'

export { evalCondition } from './conditions'
export {
  assembleSlots,
  pickComposedSlotText,
  pickSnippet,
  pickSnippetTrace,
  specificityOf,
} from './assemble'
export { defineCompositionalCard } from './defineCompositionalCard'

// Phase 146 / ISSUE-114 — Legible Surface arc, Phase 1. Signal salience
// read used by the assembler to tie-break top-specificity matches and
// drive the multi-fact establishing slot. Layered over the gradient.
export {
  SALIENCE_TABLES,
  resolveSalientReads,
  scoreCandidateSalience,
  type ResolvedRead,
  type SalienceRead,
  type SalienceScore,
  type SeedFamilySalience,
} from './salience'

// Phase 147 / ISSUE-115 — Legible Surface arc, Phase 2. Calibrated
// magnitude vocabulary for effect-preview composition; the
// `requireMagnitude` rule on `checkPreviewVariety` reads the same table.
export { MAGNITUDE_LEXICON, lineCarriesMagnitude } from './magnitudeLexicon'

// Phase 170 / ISSUE-138 — Complete Surface arc, Phase 3. Enumerable
// matrix-cell read over SALIENCE_TABLES + BAND_THRESHOLDS, and the
// reachability allowlist Movement II authors against. Reads + scaffold
// only — no gate yet (Phase 12 / ISSUE-147).
export {
  MAX_MATRIX_METERS,
  matrixMetersForFamily,
  matrixCellKey,
  enumerateMatrixCells,
  type MatrixMeter,
  type MatrixCell,
} from './matrixCells'
export {
  UNREACHABLE_CELLS,
  isCellAllowlisted,
  validateUnreachableCells,
  type UnreachableCell,
} from './unreachableCells'

// Phase 124 / ISSUE-093 — structural gate harness (framework §6).
export * from './gates'

// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15. Report-section
// composition runtime (synthetic seed adapter, multi-note assembler,
// gate adapter). The card runtime above is unchanged.
export * from './reports'
