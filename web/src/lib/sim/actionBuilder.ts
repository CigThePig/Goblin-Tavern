// Phase 88 — Owner-action picker support.
//
// Wraps the actionRegistry so the UI can:
//   - list available actions by category,
//   - query a definition's valid targets against the current state,
//   - format a SimInputOwnerAction for `gameStore.runDay`,
//   - track the running action-point total so the 3-point cap can be
//     enforced before submission.
//
// Phase 92 moved the read-only ctx + canApply / disabledReason / target
// helpers down into `src/sim/modules/ownerActions/readonlyHelpers.ts`
// so the reports projection layer can use them too. This file remains
// the web-side surface: `PickedAction`, picks → SimInput conversion,
// counter helpers, and the category label table.

import {
  actionRegistry,
  type OwnerActionDefinition,
} from '../../../../src/sim/registries/actionRegistry'
import {
  actionDisabledReason,
  actionDisabledReasonForTarget,
  applicableActionsForTarget,
  canApplyAction,
  listValidTargets,
  makeReadOnlyCtx,
} from '../../../../src/sim/modules/ownerActions/readonlyHelpers'
import {
  POLICY_STARTERS,
  type PolicyStarterDefinition,
} from '../../../../src/sim/modules/ownerActions/policyActions'
import type {
  OwnerActionCategory,
  OwnerActionInput,
} from '../../../../src/sim/modules/ownerActions/types'
import type { SimInputOwnerAction } from '../../../../src/sim/core/context'
import type { TavernState } from '../../../../src/sim/state/TavernState'

export const ACTION_POINT_BUDGET = 3

export type PickedAction = {
  /** Unique per pick; the picker uses this to dedupe and remove. */
  pickId: string
  actionId: string
  label: string
  category: OwnerActionCategory
  targetType: OwnerActionDefinition['targetType']
  targetId?: string
  targetLabel?: string
  actionPointCost: number
  /**
   * Phase 92 — Optional structured options for actions that need them
   * (commission_expedition, etc.). Forwarded verbatim to the engine.
   */
  options?: Record<string, unknown>
}

let pickIdCounter = 0
export function nextPickId(): string {
  pickIdCounter += 1
  return `pick-${Date.now().toString(36)}-${pickIdCounter.toString(36)}`
}

export function listActionsByCategory(
  category: OwnerActionCategory,
): OwnerActionDefinition[] {
  return actionRegistry
    .all()
    .filter((a) => a.category === category)
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function getActionCategories(): OwnerActionCategory[] {
  return ['immediate', 'project', 'policy', 'social']
}

export function picksToInputs(
  picks: ReadonlyArray<PickedAction>,
): SimInputOwnerAction[] {
  return picks.map((p) => {
    const input: SimInputOwnerAction = { actionId: p.actionId }
    if (p.targetId !== undefined) input.targetId = p.targetId
    if (p.options !== undefined) input.options = p.options
    return input
  })
}

export function totalActionPoints(picks: ReadonlyArray<PickedAction>): number {
  return picks.reduce((n, p) => n + p.actionPointCost, 0)
}

const VALID_PICK_CATEGORIES: ReadonlySet<OwnerActionCategory> = new Set([
  'immediate',
  'project',
  'policy',
  'social',
])

// Phase 89 / ISSUE-049 — Sanitize raw owner-action picks pulled out of
// persistence. Drops any entry whose shape is wrong, whose actionId is
// no longer registered, whose category/targetType has drifted from the
// current definition, or whose targetId points at a non-existent target
// in the supplied state. The function never throws; it returns the
// surviving picks plus the count of dropped entries so callers can
// emit a single console.warn instead of one per pick.
//
// Crucially, this is the *only* validation gate between the JSON blob
// and the cross-screen `picks` queue. The engine revalidates again at
// `applyOwnerActions` time, but a malformed pick that survives the
// hydration boundary can break the UI before the engine sees it
// (rendered labels, category-tab filters, queue chip math).
export type SanitizePicksResult = {
  picks: PickedAction[]
  droppedCount: number
}

export function sanitizePicks(
  rawPicks: unknown,
  state: import('../../../../src/sim/state/TavernState').TavernState,
): SanitizePicksResult {
  if (!Array.isArray(rawPicks)) return { picks: [], droppedCount: 0 }
  const out: PickedAction[] = []
  let dropped = 0
  for (const raw of rawPicks) {
    const pick = sanitizeSinglePick(raw, state)
    if (pick) {
      out.push(pick)
    } else {
      dropped += 1
    }
  }
  return { picks: out, droppedCount: dropped }
}

function sanitizeSinglePick(
  raw: unknown,
  state: import('../../../../src/sim/state/TavernState').TavernState,
): PickedAction | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const r = raw as Record<string, unknown>
  const actionId = r.actionId
  const pickId = r.pickId
  const label = r.label
  const category = r.category
  const targetType = r.targetType
  const actionPointCost = r.actionPointCost
  if (
    typeof actionId !== 'string' ||
    typeof pickId !== 'string' ||
    typeof label !== 'string' ||
    typeof targetType !== 'string'
  ) {
    return undefined
  }
  if (
    typeof category !== 'string' ||
    !VALID_PICK_CATEGORIES.has(category as OwnerActionCategory)
  ) {
    return undefined
  }
  if (
    typeof actionPointCost !== 'number' ||
    !Number.isFinite(actionPointCost) ||
    actionPointCost < 0
  ) {
    return undefined
  }
  if (!actionRegistry.has(actionId)) return undefined
  const def = actionRegistry.get(actionId)
  if (def.targetType !== (targetType as OwnerActionDefinition['targetType'])) {
    return undefined
  }
  if (def.category !== (category as OwnerActionCategory)) return undefined

  const targetIdRaw = r.targetId
  let targetId: string | undefined
  if (def.targetType && def.targetType !== 'global') {
    if (typeof targetIdRaw !== 'string') return undefined
    const targets = listValidTargets(def, state)
    if (!targets.some((t) => t.id === targetIdRaw)) return undefined
    targetId = targetIdRaw
  } else if (typeof targetIdRaw === 'string') {
    targetId = targetIdRaw
  }

  const targetLabel = typeof r.targetLabel === 'string' ? r.targetLabel : undefined
  const optionsRaw = r.options
  const options =
    optionsRaw && typeof optionsRaw === 'object' && !Array.isArray(optionsRaw)
      ? (optionsRaw as Record<string, unknown>)
      : undefined

  const sanitized: PickedAction = {
    pickId,
    actionId,
    label,
    category: category as OwnerActionCategory,
    targetType: targetType as OwnerActionDefinition['targetType'],
    actionPointCost,
    ...(targetId !== undefined ? { targetId } : {}),
    ...(targetLabel !== undefined ? { targetLabel } : {}),
    ...(options !== undefined ? { options } : {}),
  }
  return sanitized
}

// Phase 117 — Policy toggle row support for ActionPicker.
//
// The owner-action registry carries paired `enable_X` / `disable_X`
// definitions for every starter policy (14 actions for 7 policies).
// Surfacing both halves of every pair is the visual of "Disable Allow
// Tabs for Regulars" sitting next to "Enable Allow Tabs for Regulars"
// — a double-negative inventory. Instead the picker renders one row
// per policy and the helper resolves the matching half based on
// current state. Conflict awareness is preserved by inspecting the
// pick queue for the conflicting policy's enable action.

export type PolicyToggleRow = {
  policyId: string
  label: string
  effects: string
  /** Current persisted state of the policy. */
  enabled: boolean
  /**
   * The action that toggles the policy *given current state*. If
   * `enabled === true`, this is the disable_X action; otherwise, the
   * enable_X action.
   */
  actionId: string
  actionPointCost: number
  /**
   * Already queued in the current pick list? Lets the row render an
   * accent-styled chip-equivalent state and supports tap-to-cancel.
   */
  queued: boolean
  /**
   * Optional explainer for why the toggle is disabled (budget, missing
   * registry entry, conflicting queued action). `undefined` means the
   * row is interactive.
   */
  disabledReason?: string
  /**
   * Optional callout when the *conflicting* policy is queued in the
   * same plan. Players can still queue this toggle, but the message
   * makes the interaction legible.
   */
  conflictNote?: string
}

type ToggleQueryInput = {
  state: TavernState
  pointsLeft: number
  picks: ReadonlyArray<PickedAction>
}

export function listPolicyToggleRows(input: ToggleQueryInput): PolicyToggleRow[] {
  const { state, pointsLeft, picks } = input
  const policies =
    (state.modules['ownerActions'] as
      | { policies?: Record<string, { enabled?: boolean }> }
      | undefined)?.policies ?? {}
  const queuedActionIds = new Set(picks.map((p) => p.actionId))

  return POLICY_STARTERS.map((starter) =>
    buildPolicyToggleRow(starter, policies, queuedActionIds, pointsLeft, picks),
  ).sort((a, b) => a.label.localeCompare(b.label))
}

function buildPolicyToggleRow(
  starter: PolicyStarterDefinition,
  policies: Record<string, { enabled?: boolean }>,
  queuedActionIds: Set<string>,
  pointsLeft: number,
  picks: ReadonlyArray<PickedAction>,
): PolicyToggleRow {
  const enabled = policies[starter.id]?.enabled === true
  const actionId = enabled
    ? `disable_${starter.policyType}`
    : `enable_${starter.policyType}`
  const inverseActionId = enabled
    ? `enable_${starter.policyType}`
    : `disable_${starter.policyType}`

  const queued = queuedActionIds.has(actionId)
  // If the inverse is queued, treat *this* row as not-queued — the
  // queue resolves consistently because it inverts the policy back.
  const inverseQueued = queuedActionIds.has(inverseActionId)

  const row: PolicyToggleRow = {
    policyId: starter.id,
    label: starter.label,
    effects: starter.effects[0] ?? '',
    enabled,
    actionId,
    actionPointCost: 1,
    queued,
  }

  if (!actionRegistry.has(actionId)) {
    row.disabledReason = 'action not available'
    return row
  }

  // Budget check uses pointsLeft inclusive of the row's own cost; if
  // already queued, tapping cancels the pick so the budget check is
  // skipped for the queued state.
  if (!queued && !inverseQueued && pointsLeft < row.actionPointCost) {
    row.disabledReason = `${row.actionPointCost} pt — out of action points`
  }

  if (starter.conflictsWith && starter.conflictsWith.length > 0) {
    for (const conflictId of starter.conflictsWith) {
      const conflictEnableId = `enable_${conflictId}`
      if (picks.some((p) => p.actionId === conflictEnableId)) {
        const conflictStarter = POLICY_STARTERS.find((p) => p.policyType === conflictId)
        row.conflictNote = `Conflicts with queued ${conflictStarter?.label ?? conflictId}.`
        break
      }
    }
  }

  return row
}

export function categoryLabel(c: OwnerActionCategory): string {
  switch (c) {
    case 'immediate':
      return 'Immediate'
    case 'project':
      return 'Projects'
    case 'policy':
      return 'Policies'
    case 'social':
      return 'Social'
  }
}

// Re-export the sim-side helpers so existing import sites keep working.
export {
  actionDisabledReason,
  actionDisabledReasonForTarget,
  applicableActionsForTarget,
  canApplyAction,
  listValidTargets,
  makeReadOnlyCtx,
}

// Type re-exports for convenience at call sites.
export type { OwnerActionInput }
