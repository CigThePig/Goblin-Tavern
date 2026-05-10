// Phase 7 §7 (Agent Execution Checklist step 5) — state diff placeholder.
//
// TODO(Phase 17): real state diff collection lands when cause tracking is
// added. For now this file exists so future imports of `StateDiff` have a
// stable home and so the engine has a place to wire diff collection into
// `SimContext` without churning import paths later.

export type StateDiff = {
  path: string
  before: unknown
  after: unknown
  source: string
  reason?: string
}
