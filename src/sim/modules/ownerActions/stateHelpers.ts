import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'

import type {
  OwnerActionsModuleState,
  OwnerPolicyState,
  OwnerProjectState,
  OwnerSocialActionRecord,
} from './types'

// Phase 33 §33.3 — Owner-actions state helpers.
//
// The project / policy / social-action subsystems all read and write the
// same `state.modules.ownerActions` slice. Keeping the slice accessors
// and the persistent-field merges here avoids a circular import between
// `ownerActionsModule.ts` and the new `projectActions.ts` /
// `policyActions.ts` / `socialActions.ts` files.

export const OWNER_ACTIONS_MODULE_ID = 'ownerActions'

// Phase 13 §"Action Point Limit" — 3 slots per day. Re-exported here so
// the action-files do not depend on `ownerActionsModule.ts`.
export const DEFAULT_ACTION_POINT_BUDGET = 3

// Bounded ring for the social-action audit trail. Phase 33 §33.3 calls
// out that `recentSocialActions` must not grow unbounded; the weekly
// community routine in Phase 34 will continue to scan it.
export const RECENT_SOCIAL_ACTIONS_LIMIT = 20

export function createInitialOwnerActionsModuleState(): OwnerActionsModuleState {
  return {
    actionPointsUsed: 0,
    actionPointBudget: DEFAULT_ACTION_POINT_BUDGET,
    applied: [],
    rejected: [],
    projects: {},
    policies: {},
    recentSocialActions: [],
  }
}

export function getOwnerActionsModuleState(state: TavernState): OwnerActionsModuleState {
  const slice = state.modules[OWNER_ACTIONS_MODULE_ID] as
    | OwnerActionsModuleState
    | undefined
  if (!slice) return createInitialOwnerActionsModuleState()
  return slice
}

function withSlice(
  ctx: SimContext,
  updater: (current: OwnerActionsModuleState) => OwnerActionsModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<OwnerActionsModuleState>(
    OWNER_ACTIONS_MODULE_ID,
    (current) => {
      const base = current ?? createInitialOwnerActionsModuleState()
      return updater(base)
    },
    { source: `ownerActions.${reason}`, reason },
  )
}

export function writeProjectsSlice(
  ctx: SimContext,
  patch: Record<string, OwnerProjectState>,
  reason: string,
): void {
  withSlice(
    ctx,
    (current) => ({
      ...current,
      projects: { ...current.projects, ...patch },
    }),
    reason,
  )
}

export function writePoliciesSlice(
  ctx: SimContext,
  patch: Record<string, OwnerPolicyState>,
  reason: string,
): void {
  withSlice(
    ctx,
    (current) => ({
      ...current,
      policies: { ...current.policies, ...patch },
    }),
    reason,
  )
}

export function pushSocialAction(
  ctx: SimContext,
  record: OwnerSocialActionRecord,
  reason: string,
): void {
  withSlice(
    ctx,
    (current) => {
      const next = [record, ...current.recentSocialActions].slice(
        0,
        RECENT_SOCIAL_ACTIONS_LIMIT,
      )
      return { ...current, recentSocialActions: next }
    },
    reason,
  )
}

// ---------- Service-side policy reader ----------

/**
 * Phase 33 §33.8 — Service-side policy reader.
 *
 * Service code reads enabled policies via this helper rather than
 * reaching into `state.modules.ownerActions.policies` directly. The
 * service module is otherwise oblivious to the owner-actions schema;
 * this keeps the coupling thin enough that a future schema change in
 * the owner-actions slice only updates two files.
 */
export function getEnabledPolicies(state: TavernState): OwnerPolicyState[] {
  const slice = getOwnerActionsModuleState(state)
  return Object.values(slice.policies).filter((p) => p.enabled)
}

export function isPolicyEnabled(state: TavernState, policyId: string): boolean {
  const slice = getOwnerActionsModuleState(state)
  const policy = slice.policies[policyId]
  return policy?.enabled === true
}
