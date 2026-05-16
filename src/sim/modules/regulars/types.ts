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

export type RegularEmergenceCandidate = {
  groupId: string
  chance: number
  reason: string
  tags: string[]
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
}
