// Phase 7 §7.1 — Canonical simulation phase pipeline.
//
// This replaces the Phase 2 placeholder list. The Phase 7 doc fixes the
// canonical name as `SimPhase`; this codebase already wires `SimulationPhase`
// across module placeholders, so we keep `SimulationPhase` as the canonical
// name and re-export `SimPhase` as an alias. The two are the same union.
//
// Phase 7 §7.1 forward note: the relative ordering of
//   applyOwnerActions → beforeService → service
// is a Phase 13 contract. Do not reorder these three phases without
// updating both phase docs together.

export type SimulationPhase =
  | 'startDay'
  | 'applyDayTypeModifiers'
  | 'forecastTraffic'
  | 'beforeOwnerActions'
  | 'applyOwnerActions'
  | 'afterOwnerActions'
  | 'assignStaffPriorities'
  | 'beforeService'
  | 'service'
  | 'afterService'
  | 'closing'
  | 'endDay'
  | 'endWeek'
  | 'endMonth'
  | 'generateReports'
  | 'validate'
  | 'advanceCalendar'

export type SimPhase = SimulationPhase

export const SIMULATION_PHASES: readonly SimulationPhase[] = [
  'startDay',
  'applyDayTypeModifiers',
  'forecastTraffic',
  'beforeOwnerActions',
  'applyOwnerActions',
  'afterOwnerActions',
  'assignStaffPriorities',
  'beforeService',
  'service',
  'afterService',
  'closing',
  'endDay',
  'endWeek',
  'endMonth',
  'generateReports',
  'validate',
  'advanceCalendar',
] as const
