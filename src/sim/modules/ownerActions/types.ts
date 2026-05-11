import type { SimContext } from '../../core/context'

// Phase 13 §13.1 / §13.2 — Owner action types.
//
// `OwnerActionInput` is the per-action payload the engine accepts on
// `SimInput.ownerActions`. `OwnerActionDefinition` is the registry shape
// for the action (validation + apply). The module slice
// (`OwnerActionsModuleState`) records the day's applied/rejected actions
// so the report and downstream phases can audit player intervention.

export type OwnerActionId = string

export type OwnerActionTargetType = 'area' | 'stock' | 'staff' | 'global'

export type OwnerActionInput = {
  actionId: OwnerActionId
  targetId?: string
  amount?: number
  options?: Record<string, unknown>
}

export type ActionTarget = {
  id: string
  label: string
  /** Optional human hint about the current state of this target. */
  hint?: string
}

export type ActionValidationResult =
  | { ok: true }
  | { ok: false; code: string; reason: string }

export type OwnerActionApplied = {
  actionId: OwnerActionId
  label: string
  targetId?: string
  actionPointCost: number
  /** Lines describing what changed. Surfaced in the owner-action report. */
  effects: string[]
  /** Structured before/after snapshot for the report data payload. */
  data: Record<string, unknown>
}

export type OwnerActionRejected = {
  actionId: OwnerActionId
  targetId?: string
  code: string
  reason: string
}

export type OwnerActionsModuleState = {
  /** Action points consumed by `applied` this day. */
  actionPointsUsed: number
  /** Maximum action points the engine accepted for this day. */
  actionPointBudget: number
  applied: OwnerActionApplied[]
  rejected: OwnerActionRejected[]
}

export type OwnerActionDefinition = {
  id: OwnerActionId
  label: string
  /** Free-form tags for future card metadata and report grouping. */
  tags: string[]
  targetType?: OwnerActionTargetType
  actionPointCost: number
  /** Targets the action can be applied to. Empty array for global actions. */
  getValidTargets: (ctx: SimContext) => ActionTarget[]
  /** Pure validation. Must not mutate state. */
  canApply: (ctx: SimContext, input: OwnerActionInput) => ActionValidationResult
  /** Apply the action via `ctx.modify*` helpers. */
  apply: (ctx: SimContext, input: OwnerActionInput) => OwnerActionApplied
}
