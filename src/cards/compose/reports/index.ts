// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Public surface of the report-section composition runtime: a synthetic
// `IssueSeed` adapter for surfaces that don't have a seed
// (`buildReportSeed`), the multi-line `assembleNotesList` analogue of
// `assembleSlots`, and the gate adapter that lets `runAllGates` run
// against report sections.

export {
  buildReportSeed,
  type BuildReportSeedOptions,
  type ReportSeedTiming,
} from './reportSeed'

export { assembleNotesList } from './assembleNotesList'

export {
  reportSectionAsTemplate,
  type ReportSection,
} from './gateAdapter'
