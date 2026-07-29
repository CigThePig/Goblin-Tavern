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
//
// Phase 27 §27.1 — Expanded engine hooks.
//
// Phase 27 widens the pipeline with seams for the expanded world systems:
//   - `identityGeneration` runs early so later phases can safely reference
//     generated identities (names, regulars created today, freshly
//     emerged NPCs) without re-rolling them every report view.
//   - `cultureUpdate`, `supplierUpdate`, `factionUpdate`,
//     `regularCustomerUpdate`, `localEventUpdate`, and `rumourUpdate` run
//     before `forecastTraffic` so customer turnout and satisfaction can
//     eventually react to today's world state.
//
// The relative order of `beforeOwnerActions → applyOwnerActions →
// afterOwnerActions → assignStaffPriorities → beforeService → service →
// afterService` is unchanged from Phase 7 (the Phase 13 contract). The
// new phases slot in between `applyDayTypeModifiers` and `forecastTraffic`.
// Empty hooks are fine — modules may register no handlers for a new
// phase until later phases give them work to do.

export type SimulationPhase =
  | 'startDay'
  | 'identityGeneration'
  | 'applyDayTypeModifiers'
  | 'cultureUpdate'
  | 'supplierUpdate'
  | 'factionUpdate'
  | 'regularCustomerUpdate'
  | 'localEventUpdate'
  | 'rumourUpdate'
  | 'forecastTraffic'
  | 'beforeOwnerActions'
  | 'applyOwnerActions'
  | 'afterOwnerActions'
  | 'assignStaffPriorities'
  | 'beforeService'
  | 'service'
  | 'afterService'
  | 'closing'
  | 'applyResponses'
  | 'resolveScheduledEvents'
  | 'endDay'
  | 'endWeek'
  | 'endMonth'
  | 'generateReports'
  | 'validate'
  | 'advanceCalendar'

export type SimPhase = SimulationPhase

export const SIMULATION_PHASES: readonly SimulationPhase[] = [
  'startDay',
  'identityGeneration',
  'applyDayTypeModifiers',
  'cultureUpdate',
  'supplierUpdate',
  'factionUpdate',
  'regularCustomerUpdate',
  'localEventUpdate',
  'rumourUpdate',
  'forecastTraffic',
  'beforeOwnerActions',
  'applyOwnerActions',
  'afterOwnerActions',
  'assignStaffPriorities',
  'beforeService',
  'service',
  'afterService',
  'closing',
  // Phase 41 / ISSUE-001 — responses fire after the day's work has
  // settled (closing) but before the end-of-day pipeline tears down
  // per-day slices, so the responsesModule can mutate state, enqueue
  // pending entries, and have those mutations flow through endDay /
  // endWeek / endMonth aggregation and the report pass.
  'applyResponses',
  // Expansion Phase 1 §1.1 — the `wrap_up` beat for typed scheduled
  // events. It runs AFTER `applyResponses` so a consequence that comes due
  // today sees the day's choices (a debt the player just paid down does not
  // then default), and BEFORE `endDay` so its mutations flow through the
  // normal end-of-day / week / month aggregation and the report pass, like
  // any other domain change.
  //
  // Deliberately placed after `applyResponses` rather than before it: that
  // keeps `applyResponses` the first phase of segment C, so the day-clock
  // contract's segment boundaries (`core/segments.ts`) are unmoved by this
  // phase. The `morning` beat needs no phase of its own — it runs inside
  // `startDay`, where the player's morning is assembled.
  'resolveScheduledEvents',
  'endDay',
  'endWeek',
  'endMonth',
  'generateReports',
  'validate',
  'advanceCalendar',
] as const
