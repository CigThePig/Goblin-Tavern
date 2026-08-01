import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type {
  CustomerGroupState,
  EntityRef,
  TavernState,
} from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import { registerScheduledEvent } from '../../contracts/scheduledEvents/registry'
import type {
  ScheduledEventDefinition,
  ScheduledEventMutation,
  ScheduledEventResolution,
} from '../../contracts/scheduledEvents/index'
import {
  getOwnerActionsModuleState,
  isPolicyEnabled,
} from '../ownerActions/stateHelpers'

import {
  ECONOMY_MODULE_ID,
  MAX_POLICY_EVIDENCE,
  getEconomyModuleState,
  writeEconomyState,
} from './state'
import type { PolicyComplianceState, PolicyRuntimeStatus } from './types'

export const HOUSE_RULE_FRICTION_EVENT = 'economy.house_rule_friction'
export const POLICY_HELD_UNREST_EVENT = 'economy.policy_held_unrest'
export const POLICY_PUNISHMENT_GRUDGE_EVENT = 'economy.policy_punishment_grudge'
export const POLICY_REVERSAL_REMEMBERED_EVENT = 'economy.policy_reversal_remembered'
export const PRICE_COMPLAINT_EVENT = 'price_complaint_possible'
export const RESERVES_INTACT_EVENT = 'economy.reserves_intact'

const GroupPayloadSchema = z.object({ groupId: z.string() })
const PolicyPayloadSchema = z.object({ policyId: z.string() })
const ReservePayloadSchema = z.object({ monthKey: z.string() })
const EmptyPayloadSchema = z.object({}).passthrough()

function noOp(reason: string, readable: string): ScheduledEventResolution {
  return { status: 'no_op', reason, readable }
}

function suffixAdapter(prefix: string, field: string, kind: EntityRef['kind']) {
  return ({ hookName }: { hookName: string }) => {
    if (!hookName.startsWith(prefix)) return undefined
    const subject = hookName.slice(prefix.length)
    if (!subject) return undefined
    return {
      payload: { [field]: subject },
      target: { kind, id: subject },
    }
  }
}

function exactKey(field: 'groupId' | 'policyId' | 'monthKey') {
  return ({ type, payload, scheduledForDay }: {
    type: string
    payload: unknown
    scheduledForDay: number
  }): string => {
    const value =
      payload && typeof payload === 'object' && field in payload
        ? String((payload as Record<string, unknown>)[field])
        : 'unknown'
    return `${type}:${value}:${scheduledForDay}`
  }
}

function groupForPolicy(state: TavernState, policyId: string): CustomerGroupState | undefined {
  const policy = getOwnerActionsModuleState(state).policies[policyId]
  if (policy?.targetType === 'customer_group' && policy.targetId) {
    return state.customerGroups[policy.targetId]
  }
  const tags = policy?.tags ?? []
  return Object.values(state.customerGroups)
    .filter((group) => group.patronage > 0)
    .map((group) => ({
      group,
      score:
        group.dislikedTags.filter((tag) => tags.includes(tag)).length * 20 +
        group.priceSensitivity / 10 +
        group.rowdiness / 20,
    }))
    .sort((a, b) => b.score - a.score || a.group.id.localeCompare(b.group.id))[0]
    ?.group
}

function updatePolicyEvidence(
  ctx: SimContext,
  policyId: string,
  change: {
    support?: number
    backlash?: number
    reversal?: number
    violation?: number
    status?: PolicyRuntimeStatus
    readable: string
    tags: string[]
  },
): void {
  const today = ctx.state.calendar.totalDaysElapsed + 1
  writeEconomyState(
    ctx,
    (state) => {
      const prior = state.policies[policyId] ?? {
        policyId,
        intendedEnabled: isPolicyEnabled(ctx.state, policyId),
        status: 'inactive' as const,
        compliance: 0,
        enforcerIds: [],
        enforcementMinutes: 0,
        operatingCost: 0,
        support: 50,
        backlash: 0,
        fulfilledCount: 0,
        violationCount: 0,
        reversalCount: 0,
        lastEvaluatedDay: today,
        evidence: [],
      }
      const evidence = [
        ...prior.evidence,
        {
          day: today,
          status: change.status ?? prior.status,
          readable: change.readable,
          tags: ['policy', policyId, ...change.tags],
        },
      ].slice(-MAX_POLICY_EVIDENCE)
      const next: PolicyComplianceState = {
        ...prior,
        ...(change.status ? { status: change.status } : {}),
        support: clampPercent(prior.support + (change.support ?? 0)),
        backlash: clampPercent(prior.backlash + (change.backlash ?? 0)),
        reversalCount: prior.reversalCount + (change.reversal ?? 0),
        violationCount: prior.violationCount + (change.violation ?? 0),
        lastEvaluatedDay: today,
        evidence,
      }
      return { ...state, policies: { ...state.policies, [policyId]: next } }
    },
    'scheduled_policy_consequence',
  )
}

function groupConsequence(
  ctx: SimContext,
  group: CustomerGroupState,
  input: { patronage: number; loyalty: number; grudge?: string; reason: string },
): ScheduledEventMutation[] {
  const patronage = clampPercent(group.patronage + input.patronage)
  const loyalty = clampPercent(group.loyalty + input.loyalty)
  const activeGrudges = input.grudge && !group.activeGrudges.includes(input.grudge)
    ? [...group.activeGrudges, input.grudge].slice(-12)
    : group.activeGrudges
  const mutations: ScheduledEventMutation[] = []
  const changes: Partial<CustomerGroupState> = {}
  if (patronage !== group.patronage) {
    changes.patronage = patronage
    mutations.push({
      targetKind: 'customer_group',
      targetId: group.id,
      field: 'patronage',
      readable: `${group.label} patronage changed to ${patronage}.`,
    })
  }
  if (loyalty !== group.loyalty) {
    changes.loyalty = loyalty
    mutations.push({
      targetKind: 'customer_group',
      targetId: group.id,
      field: 'loyalty',
      readable: `${group.label} loyalty changed to ${loyalty}.`,
    })
  }
  if (activeGrudges !== group.activeGrudges) {
    changes.activeGrudges = activeGrudges
    mutations.push({
      targetKind: 'customer_group',
      targetId: group.id,
      field: 'activeGrudges',
      readable: `${group.label} retained a new grudge.`,
    })
  }
  if (mutations.length === 0) return mutations
  ctx.modifyCustomerGroup(
    group.id,
    changes,
    {
      source: 'economy.scheduled_event',
      sourceType: 'customer',
      direction: input.patronage + input.loyalty < 0 ? 'decrease' : 'increase',
      amount: input.patronage + input.loyalty,
      readable: input.reason,
      tags: ['economy', 'customer_consequence', group.id],
      relatedActors: [{ kind: 'customer_group', id: group.id }],
      relatedSystems: ['economy', 'customers'],
    },
  )
  if (activeGrudges !== group.activeGrudges) {
    ctx.addCause({
      source: 'economy.scheduled_event',
      sourceType: 'customer',
      target: `customer:${group.id}.activeGrudges`,
      targetType: 'customer',
      amount: 1,
      direction: 'increase',
      readable: input.reason,
      tags: ['economy', 'customer_consequence', 'grudge', group.id],
      relatedActors: [{ kind: 'customer_group', id: group.id }],
      relatedSystems: ['economy', 'customers'],
    })
  }
  return mutations
}

function groupResolution(
  group: CustomerGroupState,
  readable: string,
  eventType: string,
  mutations: ScheduledEventMutation[],
): ScheduledEventResolution {
  return {
    status: 'resolved',
    mutations,
    readable,
    memory: {
      id: eventType,
      source: 'economy.scheduled_event',
      actors: [{ kind: 'customer_group', id: group.id }],
      tags: ['economy', 'delayed_consequence', group.id],
      metadata: { groupId: group.id },
    },
    history: {
      category: 'state_change',
      summary: readable,
      tags: ['economy', 'scheduled_event'],
      relatedActors: [{ kind: 'customer_group', id: group.id }],
      relatedSystems: ['economy', 'customers'],
      mechanicalRefs: [eventType],
    },
  }
}

const houseRuleFriction: ScheduledEventDefinition = {
  type: HOUSE_RULE_FRICTION_EVENT,
  kind: 'mechanical',
  ownerModuleId: ECONOMY_MODULE_ID,
  label: 'A crowd tests the house rule',
  payloadSchema: GroupPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 4,
  warningWindowDays: 2,
  expiryDays: 7,
  missingTarget: 'cancel',
  exactOnceKey: exactKey('groupId'),
  futureHookPrefixes: ['house_rule_friction_'],
  fromFutureHook: suffixAdapter('house_rule_friction_', 'groupId', 'customer_group'),
  resolve: (ctx, record) => {
    const parsed = GroupPayloadSchema.safeParse(record.payload)
    const group = parsed.success ? ctx.state.customerGroups[parsed.data.groupId] : undefined
    if (!group) return noOp('the crowd no longer exists', record.origin.readable)
    const explained = ctx.state.memories.some(
      (memory) =>
        memory.strength > 0 &&
        memory.actors.some((actor) => actor.kind === 'customer_group' && actor.id === group.id) &&
        (memory.tags.includes('policy_explained') || memory.tags.includes('exception')),
    )
    if (explained) return noOp('the owner explained or made an exception to the rule', 'The house rule caused no further friction.')
    const readable = `${group.label} stayed away after the unexplained house rule.`
    const mutations = groupConsequence(ctx, group, {
      patronage: -3,
      loyalty: -2,
      grudge: 'house_rule',
      reason: readable,
    })
    if (mutations.length === 0) {
      return noOp('the crowd had no remaining standing to lose', readable)
    }
    return groupResolution(
      group,
      readable,
      HOUSE_RULE_FRICTION_EVENT,
      mutations,
    )
  },
}

function policyEvent(
  definition: {
    type: string
    prefix: string
    label: string
    mustBeEnabled: boolean
    patronage: number
    loyalty: number
    backlash: number
    support: number
    reversal?: number
    grudge?: boolean
  },
): ScheduledEventDefinition {
  return {
    type: definition.type,
    kind: 'mechanical',
    ownerModuleId: ECONOMY_MODULE_ID,
    label: definition.label,
    payloadSchema: PolicyPayloadSchema,
    beat: 'wrap_up',
    defaultOffsetDays: 7,
    warningWindowDays: 3,
    expiryDays: 10,
    missingTarget: 'resolve_anyway',
    exactOnceKey: exactKey('policyId'),
    futureHookPrefixes: [definition.prefix],
    fromFutureHook: suffixAdapter(definition.prefix, 'policyId', 'other'),
    resolve: (ctx, record) => {
      const parsed = PolicyPayloadSchema.safeParse(record.payload)
      if (!parsed.success) return noOp('the policy id was invalid', record.origin.readable)
      const policyId = parsed.data.policyId
      const enabled = isPolicyEnabled(ctx.state, policyId)
      if (definition.mustBeEnabled !== enabled) {
        return noOp(
          definition.mustBeEnabled ? 'the policy was repealed in time' : 'the policy is still in force',
          record.origin.readable,
        )
      }
      const group = groupForPolicy(ctx.state, policyId)
      if (!group) return noOp('no affected crowd remains', record.origin.readable)
      const readable = definition.reversal
        ? `${group.label} noticed that ${policyId} stayed repealed.`
        : `${group.label} carried forward its grievance against ${policyId}.`
      const mutations = groupConsequence(ctx, group, {
        patronage: definition.patronage,
        loyalty: definition.loyalty,
        ...(definition.grudge ? { grudge: `policy:${policyId}` } : {}),
        reason: readable,
      })
      updatePolicyEvidence(ctx, policyId, {
        support: definition.support,
        backlash: definition.backlash,
        reversal: definition.reversal ?? 0,
        violation: definition.mustBeEnabled ? 1 : 0,
        readable,
        tags: ['scheduled_consequence'],
      })
      mutations.push({
        targetKind: 'economy_policy',
        targetId: policyId,
        field: 'evidence',
        readable: `${policyId} support and backlash evidence was updated.`,
      })
      return groupResolution(
        group,
        readable,
        definition.type,
        mutations,
      )
    },
  }
}

const policyHeldUnrest = policyEvent({
  type: POLICY_HELD_UNREST_EVENT,
  prefix: 'policy_held_unrest_',
  label: 'Unrest tests a held policy',
  mustBeEnabled: true,
  patronage: -2,
  loyalty: -2,
  backlash: 6,
  support: -1,
})

const policyPunishmentGrudge = policyEvent({
  type: POLICY_PUNISHMENT_GRUDGE_EVENT,
  prefix: 'policy_punishment_grudge_',
  label: 'A punished crowd keeps its grudge',
  mustBeEnabled: true,
  patronage: -3,
  loyalty: -3,
  backlash: 8,
  support: -2,
  grudge: true,
})

const policyReversalRemembered = policyEvent({
  type: POLICY_REVERSAL_REMEMBERED_EVENT,
  prefix: 'policy_reversal_remembered_',
  label: 'A crowd remembers the reversal',
  mustBeEnabled: false,
  patronage: 1,
  loyalty: 2,
  backlash: -4,
  support: 4,
  reversal: 1,
})

const priceComplaint: ScheduledEventDefinition = {
  type: PRICE_COMPLAINT_EVENT,
  kind: 'mechanical',
  ownerModuleId: ECONOMY_MODULE_ID,
  label: 'A price complaint returns',
  payloadSchema: EmptyPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 5,
  warningWindowDays: 2,
  expiryDays: 8,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, scheduledForDay }) => `${type}:${scheduledForDay}`,
  fromFutureHook: ({ hookName }) =>
    hookName === PRICE_COMPLAINT_EVENT ? { payload: {} } : undefined,
  resolve: (ctx, record) => {
    const raised = Object.values(ctx.state.stock).some(
      (stock) => stock.quantity > 0 && stock.salePrice > stock.basePrice,
    )
    if (!raised) return noOp('the raised prices were rolled back', 'The promised price complaint faded after prices fell.')
    const group = Object.values(ctx.state.customerGroups)
      .filter((candidate) => candidate.patronage > 0)
      .sort((a, b) => b.priceSensitivity - a.priceSensitivity || a.id.localeCompare(b.id))[0]
    if (!group) return noOp('no active crowd remained to complain', record.origin.readable)
    const readable = `${group.label} cut back visits while raised prices persisted.`
    const mutations = groupConsequence(ctx, group, {
      patronage: -4,
      loyalty: -2,
      grudge: 'raised_prices',
      reason: readable,
    })
    writeEconomyState(
      ctx,
      (state) => ({
        ...state,
        modifiers: {
          ...state.modifiers,
          recoveryLagDays: state.modifiers.recoveryLagDays + 2,
        },
      }),
      'price_complaint_lag',
    )
    mutations.push({
      targetKind: 'economy',
      targetId: 'modifiers',
      field: 'recoveryLagDays',
      readable: 'Raised prices extended the economy recovery lag by two days.',
    })
    return groupResolution(
      group,
      readable,
      PRICE_COMPLAINT_EVENT,
      mutations,
    )
  },
}

const reservesIntact: ScheduledEventDefinition = {
  type: RESERVES_INTACT_EVENT,
  kind: 'mechanical',
  ownerModuleId: ECONOMY_MODULE_ID,
  label: 'Held reserves prove their value',
  payloadSchema: ReservePayloadSchema,
  beat: 'morning',
  defaultOffsetDays: 14,
  warningWindowDays: 3,
  expiryDays: 8,
  missingTarget: 'resolve_anyway',
  exactOnceKey: exactKey('monthKey'),
  futureHookPrefixes: ['reserves_intact_'],
  fromFutureHook: suffixAdapter('reserves_intact_', 'monthKey', 'system'),
  resolve: (ctx, record) => {
    const parsed = ReservePayloadSchema.safeParse(record.payload)
    if (!parsed.success) return noOp('the reserve period was invalid', record.origin.readable)
    const economy = getEconomyModuleState(ctx.state)
    const reserveTarget = 30 + economy.financial.operatingArrears
    const promised = ctx.state.memories.some(
      (memory) =>
        memory.strength > 0 &&
        (memory.id === `reserves_held_${parsed.data.monthKey}` ||
          memory.tags.includes(parsed.data.monthKey)),
    )
    if (!promised || ctx.state.coin < reserveTarget) {
      return noOp('the promised reserve was no longer intact', 'The reserve had been spent before it could cushion the tavern.')
    }
    writeEconomyState(
      ctx,
      (state) => ({
        ...state,
        reserveStreak: state.reserveStreak + 1,
        modifiers: {
          ...state.modifiers,
          repairCostFactor: Math.max(1, Math.round((state.modifiers.repairCostFactor - 0.08) * 100) / 100),
          recoveryLagDays: Math.max(0, state.modifiers.recoveryLagDays - 2),
        },
      }),
      'reserves_held',
    )
    const readable = `${parsed.data.monthKey}'s reserve remained intact and reduced emergency exposure.`
    return {
      status: 'resolved',
      mutations: [{ targetKind: 'economy', targetId: 'reserves', field: 'reserveStreak', readable }],
      readable,
      history: {
        category: 'state_change',
        summary: readable,
        tags: ['economy', 'reserves', 'recovery'],
        relatedSystems: ['economy'],
        mechanicalRefs: [RESERVES_INTACT_EVENT],
      },
    }
  },
}

export const ECONOMY_SCHEDULED_EVENTS: ReadonlyArray<ScheduledEventDefinition> = [
  houseRuleFriction,
  policyHeldUnrest,
  policyPunishmentGrudge,
  policyReversalRemembered,
  priceComplaint,
  reservesIntact,
]

export function ensureEconomyScheduledEventsRegistered(): void {
  for (const definition of ECONOMY_SCHEDULED_EVENTS) {
    registerScheduledEvent(definition)
  }
}

// Keep direct event-scheduling tests and response application safe before the
// first day starts; the start-day ensure remains for registry resets in tests.
ensureEconomyScheduledEventsRegistered()
