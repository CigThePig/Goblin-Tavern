import type { TavernState } from '../state/TavernState'
import type { ValidationSummary } from '../state/types'
import type { ReportSection, SimLog } from './reports'

// Phase 7 §7.4 — Result of `simulateDay`.
//
// Replaces the Phase 2 placeholder. The future, broader engine result shape
// (with `causes`, `diffs`, `issueSeeds`, `debug`) lands once Phases 17–19
// introduce those subsystems; for Phase 7 the result is intentionally
// narrow: state, reports, logs, and a validation summary.

export type SimResult = {
  state: TavernState
  reports: ReportSection[]
  logs: SimLog[]
  validation: ValidationSummary
}

// Existing callers import `SimulationResult`; keep the name as an alias so
// older imports continue to compile without churn.
export type SimulationResult = SimResult
