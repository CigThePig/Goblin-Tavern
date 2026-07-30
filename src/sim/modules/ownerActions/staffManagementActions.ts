import type { SimContext } from '../../core/context'

import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionDefinition,
} from './types'
import { TIME_COST_STANDARD } from './stateHelpers'

// Phase 86 / ISSUE-046 — customer-side management action.
//
// This file originally held three actions: `hire_staff`, `fire_staff` and
// `ban_customer_group`. Expansion Phase 3 moved the two staff ones to
// `workforceActions.ts` and rebuilt them, because both had become the wrong
// shape for a workforce with terms:
//
//   * `hire_staff` took a ROLE id and minted somebody at that role's registry
//     defaults, so hiring was a purchase at a fixed price with a fixed outcome.
//     It now takes an APPLICANT from the labor market at a negotiated wage.
//   * `fire_staff` deleted the record and docked morale, and exempted the three
//     founding staff outright — which is precisely the structural immunity plan
//     §3.1 requires removing. It now pays severance in lieu of notice, closes the
//     employment record, and cleans up everything that pointed at the person, and
//     it has no exemptions.
//
// The action IDS are unchanged, so nothing that referred to them by id had to
// move. What is left here is the customer-side action, which stayed put:
//
//   - `ban_customer_group`: target a customer-group id, suppress their
//     patronage/traffic, charge a reputation cost.

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

// ---------- ban_customer_group ----------

export const BAN_CUSTOMER_GROUP_ACTION_ID = 'ban_customer_group'

export const BAN_REPUTATION_COST = 3

function listCustomerGroups(ctx: SimContext): ActionTarget[] {
  return Object.values(ctx.state.customerGroups).map((g) => ({
    id: g.id,
    label: g.label,
    hint: `patronage ${g.patronage}`,
  }))
}

const banCustomerGroupAction: OwnerActionDefinition = {
  id: BAN_CUSTOMER_GROUP_ACTION_ID,
  label: 'Ban Customer Group',
  category: 'immediate',
  tags: ['customers', 'ban', 'social'],
  effectsPreview: 'Bars a troublesome group from the tavern',
  pressureAffinity: ['violence'],
  targetType: 'customer_group',
  timeCost: TIME_COST_STANDARD,
  getValidTargets: listCustomerGroups,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject(
        'missing_target',
        'ban_customer_group requires targetId (customer group id)',
      )
    }
    if (!ctx.state.customerGroups[input.targetId]) {
      return reject(
        'unknown_target',
        `Unknown customer group '${input.targetId}'`,
      )
    }
    return OK
  },
  apply: (ctx, input) => {
    const groupId = input.targetId!
    const group = ctx.state.customerGroups[groupId]!
    const beforePatronage = group.patronage
    const beforeLoyalty = group.loyalty

    // Suppress patronage immediately and apply a loyalty hit. Phase
    // 86 keeps the suppression a simple in-place drop. The
    // `customer_group:banned` memory marker (written below) and the
    // attached cause are the audit trail; future phases can layer a
    // windowed effect on top by adding `banned` to the group's
    // `tags`.
    ctx.modifyCustomerGroup(
      groupId,
      {
        patronage: 0,
        loyalty: Math.max(0, beforeLoyalty - 10),
        tags: Array.from(new Set([...group.tags, 'banned'])),
      },
      {
        source: `ownerActions.${BAN_CUSTOMER_GROUP_ACTION_ID}`,
        sourceType: 'owner_action',
        direction: 'decrease',
        readable: `Banned ${group.label} from the tavern.`,
        tags: ['customers', 'ban', groupId],
        relatedActors: [{ kind: 'customer_group', id: groupId }],
        relatedSystems: ['customers'],
      },
    )

    // Reputation cost against the group's culture. Reputation is
    // multi-axis; the most relevant axis depends on culture, but
    // `respectable` (a wide social axis) consistently moves on
    // visible bans across the existing tests.
    const nextRespectable = Math.max(0, ctx.state.reputation.respectable - BAN_REPUTATION_COST)
    if (nextRespectable !== ctx.state.reputation.respectable) {
      ctx.modifyReputation(
        { ...ctx.state.reputation, respectable: nextRespectable },
        {
          source: `ownerActions.${BAN_CUSTOMER_GROUP_ACTION_ID}.reputation`,
          sourceType: 'owner_action',
          direction: 'decrease',
          amount: -BAN_REPUTATION_COST,
          readable: `Word spread that the tavern banned ${group.label}.`,
          tags: ['reputation', 'ban', 'respectable', groupId],
          relatedActors: [{ kind: 'customer_group', id: groupId }],
          relatedSystems: ['customers', 'reputation'],
        },
      )
    }

    ctx.addMemory({
      id: 'customer_group_banned',
      source: 'ownerActions.ban_customer_group',
      actors: [{ kind: 'customer_group', id: groupId }],
      tags: ['customers', 'ban', groupId],
      metadata: {
        groupId,
        groupLabel: group.label,
        patronageBefore: beforePatronage,
        loyaltyBefore: beforeLoyalty,
      },
    })

    return {
      actionId: BAN_CUSTOMER_GROUP_ACTION_ID,
      label: 'Banned Customer Group',
      targetId: groupId,
      timeCost: TIME_COST_STANDARD,
      effects: [
        `${group.label} patronage ${beforePatronage} → 0.`,
        `${group.label} loyalty ${beforeLoyalty} → ${Math.max(0, beforeLoyalty - 10)}.`,
        `Respectable reputation -${BAN_REPUTATION_COST}.`,
      ],
      data: {
        groupId,
        patronage: { before: beforePatronage, after: 0 },
        loyalty: { before: beforeLoyalty, after: Math.max(0, beforeLoyalty - 10) },
        reputationHit: BAN_REPUTATION_COST,
      },
    }
  },
}

// Exported for the action registry boot path.
export const STAFF_MANAGEMENT_ACTIONS: OwnerActionDefinition[] = [
  banCustomerGroupAction,
]

export { banCustomerGroupAction }
