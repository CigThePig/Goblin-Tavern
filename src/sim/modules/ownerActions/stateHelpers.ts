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

// Phase 186 (Cluster 3) — Day-clock time economy.
//
// The owner's day is a budget of MINUTES, not abstract "action points".
// `DAY_MINUTES` is the length of the owner's working day; every owner
// action draws minutes down from it through the same additive gate the
// 3-slot action-point budget used (`used + cost > budget`). Only the
// constants and their unit change — the gate structure is untouched
// (contract §1.6, §3.8).
//
// 360 minutes == a six-hour owner workday, calibrated so three "standard"
// chores (TIME_COST_STANDARD) fill the day — the same coarse ceiling the
// old 3-slot budget gave, now denominated in time so costs can be
// expressive. The exact value is a calibration decision deferred to
// playtest (contract §6); keep it a single constant.
//
// NAMING DEBT (deliberate, documented): the *serialized* fields are still
// named `actionPoint*` —
// `OwnerActionsModuleState.actionPointsUsed`/`actionPointBudget`,
// `OwnerActionApplied.actionPointCost`, and the persisted web
// `PickedAction.actionPointCost`. They now hold MINUTES. Renaming those
// identifiers would change the save shape and force a state migration,
// which belongs with the in-flight save migration in Cluster 7 — so the
// rename is deferred there (see phase-186 implementation notes). Until
// then, read every `actionPoint*` field as "minutes".
export const DAY_MINUTES = 360

// Expressive minute-cost tiers for owner actions (starting calibration —
// the contract §6 defers precise per-action tuning to playtest, so these
// are coarse tiers, not finely-engineered numbers). A quiet word is
// cheap; re-flagging the cellar eats most of the day (contract §3.8).
export const TIME_COST_TRIVIAL = 0 // a pure logistics toggle (no labour)
export const TIME_COST_QUICK = 30 // a quiet word, a chalkboard change
export const TIME_COST_SHORT = 60 // a light hands-on task
export const TIME_COST_STANDARD = 120 // a solid chore — a third of the day
export const TIME_COST_HEAVY = 240 // a big job that eats most of the day

/**
 * Format a minute count as a short, human-readable duration for display
 * (`0m`, `30m`, `2h`, `2h 30m`). Pure — safe to call from the report
 * projection layer and the web UI alike.
 */
export function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes))
  const hours = Math.floor(safe / 60)
  const mins = safe % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

// Bounded ring for the social-action audit trail. Phase 33 §33.3 calls
// out that `recentSocialActions` must not grow unbounded; the weekly
// community routine in Phase 34 will continue to scan it.
export const RECENT_SOCIAL_ACTIONS_LIMIT = 20

export function createInitialOwnerActionsModuleState(): OwnerActionsModuleState {
  return {
    actionPointsUsed: 0,
    actionPointBudget: DAY_MINUTES,
    applied: [],
    rejected: [],
    projects: {},
    // Audit fixes pass 1 §1.4 — one starter policy enabled from day
    // zero. The `policy_backlash` pressure calculator early-exits at 0
    // when no policies are active, so policy-related seeds, attribution
    // rules, and feedback loops never fire in cardless gate runs unless
    // an instance exists. The cheap-payday tags overlap merchants'
    // `dislikedTags` (`risky`), which lets the calculator's
    // disliking-groups term move the pressure off zero.
    policies: {
      cheap_payday_specials: {
        id: 'cheap_payday_specials',
        policyType: 'cheap_payday_specials',
        label: 'Cheap Payday Specials',
        enabled: true,
        startedAtDay: 0,
        tags: ['policy', 'cheap', 'payday', 'food', 'risky'],
        effects: ['miners love it', 'merchants grumble about cheapness'],
      },
    },
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
