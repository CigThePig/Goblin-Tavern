// Phase 19 — backwards-compatible re-export. The Phase 2 placeholder
// `modules/issueSeeds/` skeleton is preserved as a thin re-export of
// the canonical Phase 19 module at `modules/issues/`. New callers
// should import from `../issues` directly; this barrel keeps existing
// phase-2-style imports working.
export * from '../issues/index'
