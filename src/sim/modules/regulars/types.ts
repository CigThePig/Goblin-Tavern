// Phase 27 §27.4 — Regular customer module type surface.
//
// Phase 30 §30.6 expands this with `candidatesToday`, `createdToday`,
// `visitedToday`. Phase 27 reserves the slot only.

export type RegularModuleState = Record<string, never>
