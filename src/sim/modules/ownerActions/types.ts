import type { SimContext } from '../../core/context'
import type { ExpandedPressureId, PressureId } from '../pressures/pressureTypes'

/** Any registry pressure — the core 10 plus the expanded social/market/arc set. */
export type ActionPressureId = PressureId | ExpandedPressureId

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
   * Phase 204 / audit Wave 5 (`P3-BHV-003`) — the target's display name,
   * captured from the definition's own `getValidTargets` at the moment
   * the action ran, and immutable from then on.
   *
   * The report used to resolve `targetId` against post-action state,
   * which cannot work for an action whose purpose is to remove the
   * record: firing `Caravanmaster Willem Threepence` reported as
   * `Hire kitchen hand 4 0`, the shape of a dead lookup. Capturing the
   * label while the entity still exists means the name survives the
   * removal, the day close, the next morning and a reload.
   *
   * Optional so pre-Wave-5 saves still parse; the report falls back to
   * live resolution when it is absent.
   */
  targetLabel?: string
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
  /**
   * Phase 193 / ISSUE-160 — terse, one-line "what this does" preview for
   * the planning picker. Additive and optional: actions without one render
   * no caption (no placeholder). This is authored sim data — the picker
   * surfaces it verbatim and never invents preview copy in the web layer.
   */
  effectsPreview?: string
  /**
   * Phase 193 / ISSUE-160 — pressures this action relieves. Drives the
   * picker's "Suggested" section: when a tagged pressure is in its danger
   * band, the action is suggested. Optional; untagged actions are never
   * suggested. Ids are validated against the pressure registry in tests.
   */
  pressureAffinity?: ActionPressureId[]
  /**
   * Phase 203 / audit Wave 4 (`P3-BHV-002`) — the id of the dedicated form
   * that owns this action's full input, when a generic picker cannot
   * assemble it. `commission_expedition` collects a runner, a mode, a
   * duration and a tier or ingredient; a two-level target list cannot
   * express that, so the definition names its composer and every generic
   * entry point routes there instead of queueing a half-specified pick.
   */
  composer?: string
  /**
   * Phase 203 / audit Wave 4 (`P3-BHV-002`) — may the player *begin*
   * specifying this action? Distinct from `canApply`, which answers
   * whether a fully specified input is valid.
   *
   * Only form-driven actions need this. Every eligibility query in the
   * codebase asks a global action `canApply({ actionId })` — an input the
   * form has not been filled in yet — so an action that requires options
   * answered "no" to a question nobody meant to ask, and its own entry
   * point disabled itself. Definitions without a `canOpen` are unchanged:
   * `canApply` remains the eligibility answer.
   */
  canOpen?: (ctx: SimContext) => ActionValidationResult
  /** Targets the action can be applied to. Empty array for global actions. */
  getValidTargets: (ctx: SimContext) => ActionTarget[]
  /** Pure validation. Must not mutate state. */
  canApply: (ctx: SimContext, input: OwnerActionInput) => ActionValidationResult
  /** Apply the action via `ctx.modify*` helpers. */
  apply: (ctx: SimContext, input: OwnerActionInput) => OwnerActionApplied
}
