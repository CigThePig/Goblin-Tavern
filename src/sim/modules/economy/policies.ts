import type { SimContext } from '../../core/context'
import type { StaffRoleId, TavernState } from '../../state/TavernState'
import { getOwnerActionsModuleState } from '../ownerActions/stateHelpers'

import {
  MAX_POLICY_EVIDENCE,
  getEconomyModuleState,
  writeEconomyState,
} from './state'
import type {
  PolicyComplianceState,
  PolicyEvidence,
  PolicyRuntimeStatus,
} from './types'

type PolicyRule = {
  policyId: string
  enforcerRoles: ReadonlyArray<StaffRoleId>
  enforcementMinutes: number
  operatingCost: number
  supportWhenKept: number
  backlashWhenKept: number
}

/** One rule table: intent, worker, time and operating cost cannot drift. */
export const POLICY_RULES: ReadonlyArray<PolicyRule> = [
  {
    policyId: 'cheap_payday_specials',
    enforcerRoles: ['server'],
    enforcementMinutes: 20,
    operatingCost: 0,
    supportWhenKept: 2,
    backlashWhenKept: 1,
  },
  {
    policyId: 'allow_tabs_for_regulars',
    enforcerRoles: ['server'],
    enforcementMinutes: 15,
    operatingCost: 0,
    supportWhenKept: 2,
    backlashWhenKept: 1,
  },
  {
    policyId: 'refuse_tabs',
    enforcerRoles: ['server', 'cleaner_bouncer'],
    enforcementMinutes: 25,
    operatingCost: 0,
    supportWhenKept: 1,
    backlashWhenKept: 2,
  },
  // Expansion Phase 8 §8.2 — `seat_groups_apart` needs a real enforcer like
  // every other policy (§5.6). Seating people deliberately is a server's
  // attention all evening, so the enforcement minutes are the highest of any
  // policy that costs no coin: the house pays for it in floor time rather
  // than in coin, on top of the seats it wastes.
  {
    policyId: 'seat_groups_apart',
    enforcerRoles: ['server'],
    enforcementMinutes: 50,
    operatingCost: 0,
    supportWhenKept: 2,
    backlashWhenKept: 1,
  },
  {
    policyId: 'ban_weapons_inside',
    enforcerRoles: ['cleaner_bouncer'],
    enforcementMinutes: 45,
    operatingCost: 1,
    supportWhenKept: 2,
    backlashWhenKept: 2,
  },
  {
    policyId: 'serve_miners_discount',
    enforcerRoles: ['server'],
    enforcementMinutes: 15,
    operatingCost: 0,
    supportWhenKept: 3,
    backlashWhenKept: 1,
  },
  {
    policyId: 'water_ale_quietly',
    enforcerRoles: ['cook'],
    enforcementMinutes: 20,
    operatingCost: 0,
    supportWhenKept: 0,
    backlashWhenKept: 3,
  },
  {
    policyId: 'close_early_on_festival_eve',
    enforcerRoles: ['server'],
    enforcementMinutes: 10,
    operatingCost: 0,
    supportWhenKept: 1,
    backlashWhenKept: 1,
  },
]

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function emptyPolicy(
  policyId: string,
  day: number,
): PolicyComplianceState {
  return {
    policyId,
    intendedEnabled: false,
    status: 'inactive',
    compliance: 0,
    enforcerIds: [],
    enforcementMinutes: 0,
    operatingCost: 0,
    support: 50,
    backlash: 0,
    fulfilledCount: 0,
    violationCount: 0,
    reversalCount: 0,
    lastEvaluatedDay: day,
    evidence: [],
  }
}

function appendEvidence(
  previous: PolicyComplianceState,
  evidence: PolicyEvidence,
): PolicyEvidence[] {
  const withoutSameDay = previous.evidence.filter(
    (entry) => entry.day !== evidence.day,
  )
  const next = [...withoutSameDay, evidence]
  return next.length > MAX_POLICY_EVIDENCE
    ? next.slice(next.length - MAX_POLICY_EVIDENCE)
    : next
}

function statusFor(compliance: number): PolicyRuntimeStatus {
  if (compliance >= 0.75) return 'compliant'
  if (compliance > 0) return 'partial'
  return 'violated'
}

function enforcersFor(state: TavernState, rule: PolicyRule): string[] {
  return Object.values(state.staff)
    .filter(
      (staff) =>
        !staff.unavailable && rule.enforcerRoles.includes(staff.role),
    )
    .sort((a, b) => b.skill - a.skill || a.id.localeCompare(b.id))
    .map((staff) => staff.id)
}

function complianceFor(state: TavernState, enforcerIds: string[]): number {
  if (enforcerIds.length === 0) return 0
  const best = state.staff[enforcerIds[0]!]
  if (!best) return 0
  return Math.round(clamp(0.65 + best.skill / 200, 0, 1) * 100) / 100
}

/**
 * Reconcile intended policies against today's people immediately before
 * service. Missing workers produce a recorded violation, never a free effect.
 */
export function evaluatePolicyCompliance(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed + 1
  const intended = getOwnerActionsModuleState(ctx.state).policies
  const current = getEconomyModuleState(ctx.state)
  const next: Record<string, PolicyComplianceState> = { ...current.policies }

  for (const rule of POLICY_RULES) {
    const ownerPolicy = intended[rule.policyId]
    const before = current.policies[rule.policyId] ?? emptyPolicy(rule.policyId, today)
    if (!ownerPolicy?.enabled) {
      const reversed = before.intendedEnabled
      const status: PolicyRuntimeStatus = reversed ? 'suspended' : 'inactive'
      next[rule.policyId] = {
        ...before,
        intendedEnabled: false,
        status,
        compliance: 0,
        enforcerIds: [],
        enforcementMinutes: 0,
        operatingCost: 0,
        reversalCount: before.reversalCount + (reversed ? 1 : 0),
        lastEvaluatedDay: today,
        evidence: appendEvidence(before, {
          day: today,
          status,
          readable: reversed
            ? `${ownerPolicy?.label ?? rule.policyId} was suspended or repealed.`
            : `${ownerPolicy?.label ?? rule.policyId} was not intended to operate.`,
          tags: ['policy', rule.policyId, status],
        }),
      }
      continue
    }

    const enforcerIds = enforcersFor(ctx.state, rule)
    const compliance = complianceFor(ctx.state, enforcerIds)
    const status = statusFor(compliance)
    const fulfilled = status === 'compliant'
    const violated = status === 'violated'
    const readable = fulfilled
      ? `${ownerPolicy.label} was carried out by ${enforcerIds.join(', ')}.`
      : violated
        ? `${ownerPolicy.label} had no available ${rule.enforcerRoles.join(' or ')} to enforce it.`
        : `${ownerPolicy.label} was applied inconsistently.`
    next[rule.policyId] = {
      ...before,
      intendedEnabled: true,
      status,
      compliance,
      enforcerIds,
      enforcementMinutes: Math.round(rule.enforcementMinutes * compliance),
      operatingCost:
        rule.operatingCost > 0 && compliance > 0
          ? Math.ceil(rule.operatingCost * compliance)
          : 0,
      support: clamp(
        before.support + (fulfilled ? rule.supportWhenKept : 0) - (violated ? 1 : 0),
        0,
        100,
      ),
      backlash: clamp(
        before.backlash + rule.backlashWhenKept * compliance + (violated ? 2 : 0),
        0,
        100,
      ),
      fulfilledCount: before.fulfilledCount + (fulfilled ? 1 : 0),
      violationCount: before.violationCount + (violated ? 1 : 0),
      lastEvaluatedDay: today,
      evidence: appendEvidence(before, {
        day: today,
        status,
        readable,
        tags: ['policy', rule.policyId, status, ...enforcerIds],
      }),
    }
  }

  writeEconomyState(ctx, (state) => ({ ...state, policies: next }), 'policy_compliance')
}

export function getPolicyEffectStrength(
  state: TavernState,
  policyId: string,
): number {
  const policy = getEconomyModuleState(state).policies[policyId]
  // Compatibility pipelines used by focused domain tests can invoke a
  // policy consumer without running the economy module's before-service
  // reconciliation first. Preserve real enforcement semantics in that
  // case: intent alone is still insufficient, and the effect is derived
  // from an actually available worker rather than granted for free.
  if (!policy) {
    const intended = getOwnerActionsModuleState(state).policies[policyId]
    const rule = POLICY_RULES.find((candidate) => candidate.policyId === policyId)
    if (!intended?.enabled || !rule) return 0
    return complianceFor(state, enforcersFor(state, rule))
  }
  if (!policy?.intendedEnabled) return 0
  if (policy.status !== 'compliant' && policy.status !== 'partial') return 0
  return clamp(policy.compliance, 0, 1)
}

export function getServicePriceMultiplier(
  state: TavernState,
  groupId: string,
): number {
  let multiplier = 1
  if (
    state.calendar.dayType === 'payday' &&
    (groupId === 'miners' || groupId === 'local_goblins')
  ) {
    multiplier *= 1 - 0.1 * getPolicyEffectStrength(state, 'cheap_payday_specials')
  }
  if (groupId === 'miners') {
    multiplier *= 1 - 0.15 * getPolicyEffectStrength(state, 'serve_miners_discount')
  }
  return Math.round(clamp(multiplier, 0.7, 1.2) * 100) / 100
}

export function getPolicyServiceCapacityFactor(state: TavernState): number {
  const minutes = Object.values(getEconomyModuleState(state).policies)
    .filter((policy) => policy.intendedEnabled)
    .reduce((sum, policy) => sum + policy.enforcementMinutes, 0)
  return clamp(1 - minutes / 1440, 0.75, 1)
}

export function getServiceWaveLimit(state: TavernState): number {
  const strength = getPolicyEffectStrength(state, 'close_early_on_festival_eve')
  const festival = state.calendar.tags.includes('festival_window')
  return festival && strength > 0 ? Math.max(4, Math.round(6 - 2 * strength)) : 6
}

export function getTabsPolicyAdjustment(
  state: TavernState,
  namedRegular: boolean,
): number {
  const refusal = getPolicyEffectStrength(state, 'refuse_tabs')
  const allowance = namedRegular
    ? getPolicyEffectStrength(state, 'allow_tabs_for_regulars')
    : 0
  return clamp((1 - refusal * 0.6) * (1 + allowance * 0.35), 0.3, 1.5)
}

export function getAleIngredientUseFactor(state: TavernState): number {
  const strength = getPolicyEffectStrength(state, 'water_ale_quietly')
  return Math.round((1 - strength * 0.2) * 100) / 100
}

export function getWeaponsPolicySecurityBonus(state: TavernState): number {
  return getPolicyEffectStrength(state, 'ban_weapons_inside') * 0.8
}
