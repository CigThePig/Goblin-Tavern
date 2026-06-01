import type { SimContext } from '../../core/context'

// Phase 13 §13.1 / §13.2 — Owner action types.
//
// `OwnerActionInput` is the per-action payload the engine accepts on
// `SimInput.ownerActions`. `OwnerActionDefinition` is the registry shape
// for the action (validation + apply). The module slice
// (`OwnerActionsModuleState`) records the day's applied/rejected actions
// so the report and downstream phases can audit player intervention.
//
// Phase 33 §33.1 / §33.2 — Owner action target/category expansion.
// The Phase 13 surface (`area | stock | staff | global`) is widened to
// cover named world entities (regulars, suppliers, factions, customer
// groups) and the new persistent owner-action records (projects,
// policies). Categories partition the registry into immediate fixes,
// long-running projects, standing policies, and relationship-based
// social actions so the report can group them and the project tick can
// find projects without scanning the whole registry. Phase 13 actions
// continue to work — they keep `category: 'immediate'` and the old
// `targetType` values.

export type OwnerActionId = string

export type OwnerActionTargetType =
  | 'area'
  | 'stock'
  | 'staff'
  | 'customer_group'
  | 'regular'
  | 'supplier'
  | 'faction'
  | 'project'
  | 'policy'
  | 'recipe'
  | 'global'

// Phase 33 §33.2 — Category metadata on each action definition. Lets the
// report group rows ("Immediate Actions" vs. "Active Projects") and lets
// future code (Phase 39 issue seeds) filter the registry without
// string-matching ids.
export type OwnerActionCategory =
  | 'immediate'
  | 'project'
  | 'policy'
  | 'social'

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
  /**
   * Time this action drew from the daily budget, in MINUTES. Phase 186
   * Cluster 3 converted the action-point economy to time; Cluster 7 renamed
   * the field from `actionPointCost` to `timeCost` (pre-Cluster-7 saves
   * migrate via `ensureOwnerTimeFields`).
   */
  timeCost: number
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

// Phase 33 §33.3 — Persistent project / policy / social-action records.
//
// Projects are long-running owner investments that accrue progress each
// day until they complete and apply a structural effect (an area trait,
// an upgrade, a market shift). Policies are standing rules that affect
// downstream systems for as long as they remain enabled. Social actions
// are one-day relationship moves against named entities; the record
// retains enough context for weekly community routines (Phase 34) and
// future issue seeds to react to them.
export type OwnerProjectStatus = 'active' | 'completed' | 'cancelled' | 'blocked'

export type OwnerProjectState = {
  id: string
  projectType: string
  label: string
  targetType?: OwnerActionTargetType
  targetId?: string
  startedAtDay: number
  progress: number
  requiredProgress: number
  coinInvested: number
  status: OwnerProjectStatus
  tags: string[]
  effectsPreview: string[]
}

export type OwnerPolicyState = {
  id: string
  policyType: string
  label: string
  enabled: boolean
  startedAtDay: number
  targetType?: OwnerActionTargetType
  targetId?: string
  tags: string[]
  effects: string[]
}

export type OwnerSocialActionOutcome = 'improved' | 'worsened' | 'neutral'

export type OwnerSocialActionRecord = {
  id: string
  actionId: OwnerActionId
  targetType: OwnerActionTargetType
  targetId: string
  day: number
  outcome: OwnerSocialActionOutcome
  notes: string[]
  tags: string[]
}

export type OwnerActionsModuleState = {
  /** Minutes consumed by `applied` this day (Phase 186; was `actionPointsUsed`). */
  timeSpent: number
  /** The day's time budget in minutes (`DAY_MINUTES`; was `actionPointBudget`). */
  timeBudget: number
  applied: OwnerActionApplied[]
  rejected: OwnerActionRejected[]

  // Phase 33 §33.3 — Persistent owner-action records.
  //
  // `projects` and `policies` survive `startDay`'s slice reset so a
  // project started Monday continues to progress Tuesday. The daily
  // applied/rejected/timeSpent fields still reset every morning.
  // `recentSocialActions` is a bounded ring (most recent first) so
  // weekly routines and reports can surface "who got apologized to this
  // week" without scanning history.
  projects: Record<string, OwnerProjectState>
  policies: Record<string, OwnerPolicyState>
  recentSocialActions: OwnerSocialActionRecord[]
}

export type OwnerActionDefinition = {
  id: OwnerActionId
  label: string
  /** Phase 33 §33.2 — partition of the registry. */
  category: OwnerActionCategory
  /** Free-form tags for future card metadata and report grouping. */
  tags: string[]
  targetType?: OwnerActionTargetType
  /**
   * Minutes this action costs against the daily time budget
   * (`DAY_MINUTES`). Phase 186 — see `OwnerActionApplied.timeCost`.
   */
  timeCost: number
  /** Targets the action can be applied to. Empty array for global actions. */
  getValidTargets: (ctx: SimContext) => ActionTarget[]
  /** Pure validation. Must not mutate state. */
  canApply: (ctx: SimContext, input: OwnerActionInput) => ActionValidationResult
  /** Apply the action via `ctx.modify*` helpers. */
  apply: (ctx: SimContext, input: OwnerActionInput) => OwnerActionApplied
}
