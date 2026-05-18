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
import type {
  OwnerActionCategory,
  OwnerActionInput,
} from '../../../../src/sim/modules/ownerActions/types'
import type { SimInputOwnerAction } from '../../../../src/sim/core/context'

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
