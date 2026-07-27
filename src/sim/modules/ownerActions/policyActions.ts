import type { SimContext } from '../../core/context'

import {
  TIME_COST_QUICK,
  getOwnerActionsModuleState,
  writePoliciesSlice,
} from './stateHelpers'
import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionApplied,
  OwnerActionDefinition,
  OwnerPolicyState,
} from './types'

// Phase 33 §33.6 — Policy actions.
//
// Policies are standing rules that affect downstream systems for as long
// as they remain enabled. Each starter policy ships as a paired
// `enable_<policy>` / `disable_<policy>` action so the registry stays
// flat and the player input model stays a single id + targetId. The
// effects of a policy live in the consuming subsystem (service, weekly,
// monthly) and read enabled status via
// `stateHelpers.getEnabledPolicies()`; this file only handles the
// persistence and validation of the policy record itself.

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

export type PolicyStarterDefinition = {
  /** Stable instance id stored in `state.modules.ownerActions.policies`. */
  id: string
  policyType: string
  label: string
  tags: string[]
  effects: string[]
  /** Phase 33 §33.6 contradictory policies. Enabling one auto-disables
   *  any policy whose id appears here. */
  conflictsWith?: string[]
}

export const POLICY_STARTERS: PolicyStarterDefinition[] = [
  // Audit fixes pass 1 §1.4 — a baseline policy that exists from day
  // zero so the policy backlash pressure calculator has something to
  // bite even when the owner takes no input. The `risky` tag matches
  // merchants' `dislikedTags`, so the calculator's disliking-groups
  // term contributes immediately.
  {
    id: 'cheap_payday_specials',
    policyType: 'cheap_payday_specials',
    label: 'Cheap Payday Specials',
    tags: ['policy', 'cheap', 'payday', 'food', 'risky'],
    effects: ['miners love it', 'merchants grumble about cheapness'],
  },
  {
    id: 'allow_tabs_for_regulars',
    policyType: 'allow_tabs_for_regulars',
    label: 'Allow Tabs for Regulars',
    tags: ['policy', 'tabs', 'regulars'],
    effects: ['regulars accumulate loyalty', 'unpaid tabs risk rises'],
    conflictsWith: ['refuse_tabs'],
  },
  {
    id: 'refuse_tabs',
    policyType: 'refuse_tabs',
    label: 'Refuse Tabs',
    tags: ['policy', 'tabs'],
    effects: [
      'unpaid tabs decrease in service',
      'high-tab-risk groups lose patience',
    ],
    conflictsWith: ['allow_tabs_for_regulars'],
  },
  {
    id: 'ban_weapons_inside',
    policyType: 'ban_weapons_inside',
    label: 'Ban Weapons Inside',
    tags: ['policy', 'violence', 'respectable'],
    effects: ['brawl risk falls slightly', 'rowdy groups grumble'],
  },
  {
    id: 'serve_miners_discount',
    policyType: 'serve_miners_discount',
    label: 'Serve Miners Discount',
    tags: ['policy', 'miners'],
    effects: [
      'miner satisfaction rises',
      'miner ale/stew profit margins shrink',
    ],
  },
  {
    id: 'water_ale_quietly',
    policyType: 'water_ale_quietly',
    label: 'Water Ale Quietly',
    tags: ['policy', 'ale', 'deception'],
    effects: ['ale consumption falls', 'regulars may notice'],
  },
  {
    id: 'close_early_on_festival_eve',
    policyType: 'close_early_on_festival_eve',
    label: 'Close Early on Festival Eve',
    tags: ['policy', 'calendar'],
    effects: ['lower festival-eve risk', 'lost evening sales'],
  },
]

function findStarter(policyType: string): PolicyStarterDefinition | undefined {
  return POLICY_STARTERS.find((p) => p.policyType === policyType)
}

// Phase 203 / audit Wave 4 (`P3-BHV-001`) — a toggle's valid targets are
// its OWN policy, not the whole catalogue. Each definition closes over one
// starter and ignores `input.targetId` entirely, so listing the other six
// advertised targets that could never take effect — which is what made
// `invalid target` meaningless and let the inline control queue against a
// target the row was not showing.
function listOwnPolicy(starter: PolicyStarterDefinition) {
  return (_ctx: SimContext): ActionTarget[] => [
    {
      id: starter.id,
      label: starter.label,
      hint: starter.effects[0] ?? '',
    },
  ]
}

function recordPolicyChange(
  ctx: SimContext,
  starter: PolicyStarterDefinition,
  enabled: boolean,
  conflictDisabled: PolicyStarterDefinition[],
): OwnerActionApplied {
  const today = ctx.state.calendar.totalDaysElapsed

  const patch: Record<string, OwnerPolicyState> = {}
  patch[starter.id] = {
    id: starter.id,
    policyType: starter.policyType,
    label: starter.label,
    enabled,
    startedAtDay: today,
    tags: [...starter.tags],
    effects: [...starter.effects],
  }
  for (const conflict of conflictDisabled) {
    const existing = getOwnerActionsModuleState(ctx.state).policies[conflict.id]
    if (existing && existing.enabled) {
      patch[conflict.id] = { ...existing, enabled: false }
    }
  }
  writePoliciesSlice(ctx, patch, enabled ? 'policy_enabled' : 'policy_disabled')

  ctx.addCause({
    source: `ownerActions.${enabled ? 'enable' : 'disable'}_${starter.policyType}`,
    sourceType: 'owner_action',
    target: `policy:${starter.id}`,
    targetType: 'global',
    amount: enabled ? 1 : -1,
    readable: `Policy ${starter.label} ${enabled ? 'enabled' : 'disabled'}.`,
    tags: ['owner_action', 'policy', starter.policyType, enabled ? 'enabled' : 'disabled'],
    relatedSystems: ['ownerActions', 'policies'],
  })
  ctx.addHistory({
    category: 'owner_action',
    summary: `Policy ${starter.label} ${enabled ? 'enabled' : 'disabled'}.`,
    tags: ['owner_action', 'policy', starter.policyType],
    relatedSystems: ['ownerActions', 'policies'],
    mechanicalRefs: [starter.id],
  })

  const effects: string[] = [
    `policy ${starter.policyType} ${enabled ? 'enabled' : 'disabled'}`,
  ]
  for (const c of conflictDisabled) {
    effects.push(`policy ${c.policyType} auto-disabled (conflict)`)
  }
  return {
    actionId: `${enabled ? 'enable' : 'disable'}_${starter.policyType}`,
    label: `${enabled ? 'Enable' : 'Disable'} ${starter.label}`,
    targetId: starter.id,
    timeCost: TIME_COST_QUICK,
    effects,
    data: {
      policyId: starter.id,
      policyType: starter.policyType,
      enabled,
      conflictsDisabled: conflictDisabled.map((c) => c.id),
    },
  }
}

function buildEnableDefinition(
  starter: PolicyStarterDefinition,
): OwnerActionDefinition {
  return {
    id: `enable_${starter.policyType}`,
    label: `Enable ${starter.label}`,
    category: 'policy',
    tags: [...starter.tags, 'enable'],
    targetType: 'policy',
    timeCost: TIME_COST_QUICK,
    getValidTargets: listOwnPolicy(starter),
    canApply: (ctx) => {
      const slice = getOwnerActionsModuleState(ctx.state)
      const existing = slice.policies[starter.id]
      if (existing?.enabled === true) {
        return reject(
          'policy_already_enabled',
          `${starter.label} is already on.`,
        )
      }
      return OK
    },
    apply: (ctx): OwnerActionApplied => {
      const conflicts: PolicyStarterDefinition[] = []
      for (const conflictId of starter.conflictsWith ?? []) {
        const conflictStarter = findStarter(conflictId)
        if (conflictStarter) conflicts.push(conflictStarter)
      }
      return recordPolicyChange(ctx, starter, true, conflicts)
    },
  }
}

function buildDisableDefinition(
  starter: PolicyStarterDefinition,
): OwnerActionDefinition {
  return {
    id: `disable_${starter.policyType}`,
    label: `Disable ${starter.label}`,
    category: 'policy',
    tags: [...starter.tags, 'disable'],
    targetType: 'policy',
    timeCost: TIME_COST_QUICK,
    getValidTargets: listOwnPolicy(starter),
    canApply: (ctx) => {
      const slice = getOwnerActionsModuleState(ctx.state)
      const existing = slice.policies[starter.id]
      if (!existing || existing.enabled !== true) {
        return reject(
          'policy_not_enabled',
          `${starter.label} is already off.`,
        )
      }
      return OK
    },
    apply: (ctx): OwnerActionApplied => {
      return recordPolicyChange(ctx, starter, false, [])
    },
  }
}

export const POLICY_ACTIONS: OwnerActionDefinition[] = [
  ...POLICY_STARTERS.map(buildEnableDefinition),
  ...POLICY_STARTERS.map(buildDisableDefinition),
]
