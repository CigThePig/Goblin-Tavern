// Phase 27 §27.4 — Culture module type surface.
//
// The culture module's per-day state slice is empty in Phase 27;
// Phase 30 may add fields like `forecastNotes` or `tensionDeltasToday`.

export type CultureModuleState = Record<string, never>
