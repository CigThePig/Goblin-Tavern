// Phase 27 §27.4 — World module type surface.
//
// The world module is a thin host for cross-cutting world report
// sections and reference validation. It owns no per-day state slice
// in Phase 27; later phases may add one and extend `WorldModuleState`.

export type WorldModuleState = Record<string, never>
