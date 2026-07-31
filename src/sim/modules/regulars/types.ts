// Phase 27 §27.4 / Phase 30 §30.6 — Regular customer module type surface.
//
// Phase 27 reserved an empty slot. Phase 30 fills the slice with the
// per-day fields the emergence logic produces:
//   - `candidatesToday`: groups eligible to spawn a regular on this day,
//     with the reason and the rolled chance for transparency in reports.
//   - `createdToday`: ids of regulars newly created during the day.
//   - `visitedToday`: ids of existing regulars who visited during the
//     `regularCustomerUpdate` phase. Reports and (later) issue seeds
//     can read this slice without re-walking `state.world.regulars`.
//
// Expansion Phase 4 §4.3 — a visit is now a two-part event. The regulars
// module DECIDES (`visitIntents`, during `regularCustomerUpdate`), the service
// flow SERVES the resulting party, and the regulars module reads back what
// happened (`outcomes`, during `afterService`). Splitting it is what makes a
// regular a participant rather than a counter: before this phase `visitedToday`
// both decided the visit and recorded its success in the same breath, so a
// regular could "visit" a tavern that never seated them.

export type RegularEmergenceCandidate = {
  groupId: string
  chance: number
  reason: string
  tags: string[]
}

/** Expansion Phase 4 §4.3 — a regular who means to come in tonight. */
export type RegularVisitIntent = {
  regularId: string
  groupId: string
  /** The rolled chance, kept so the report can explain a quiet night. */
  probability: number
  drivers: string[]
}

/** Expansion Phase 4 §4.3 — how that visit actually went. */
export type RegularVisitOutcome = {
  regularId: string
  outcome: 'served' | 'abandoned' | 'turned_away' | 'no_visit'
  /** The party they were part of, when they got as far as having one. */
  partyId?: string
  readable: string
}

export type RegularModuleState = {
  candidatesToday: RegularEmergenceCandidate[]
  createdToday: string[]
  visitedToday: string[]
  // Phase 51 / ISSUE-011 — Regulars dropped today because they have
  // been inactive past the decay threshold and carry high irritation.
  // Reports and validators read this slice; the actual removal lives
  // in `regularModule.closing`.
  decayedToday: string[]
  // -- Expansion Phase 4 §4.3 ------------------------------------------------
  /** Decided during `regularCustomerUpdate`, consumed by the service flow. */
  visitIntents: RegularVisitIntent[]
  /** Read back from the flow during `afterService`. */
  outcomes: RegularVisitOutcome[]
  /** Regulars who gave up on the place today. */
  stoppedToday: string[]
  /** Regulars who came back after having stopped. */
  returnedToday: string[]
  /** Requests opened and closed today (§4.3 "make requests"). */
  requestsOpened: string[]
  requestsResolved: string[]
}
