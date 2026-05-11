import type { TavernState } from '../state/TavernState'
import type { ValidationSummary } from '../state/types'
import type { ReportSection, SimLog } from './reports'
import type { TaggedStateDiff } from './diff'

// Phase 7 §7.4 / Phase 17 §17.8 — Result of `simulateDay`.
//
// Phase 7 introduced this with `{ state, reports, logs, validation }`.
// Phase 17 extends it with `diffs`: an ordered list of phase-boundary
// state diffs (owner actions, service, end-of-week, end-of-month, and
// the full-day diff) so callers can read the day's mechanical movement
// without recomputing. The shape stays narrow: causes/issue seeds will
// be added in later phases.

export type SimResult = {
  state: TavernState
  reports: ReportSection[]
  logs: SimLog[]
  validation: ValidationSummary
  diffs: TaggedStateDiff[]
}

// Existing callers import `SimulationResult`; keep the name as an alias so
// older imports continue to compile without churn.
export type SimulationResult = SimResult
