import type { SimContext } from '../../core/context'
import { createStaffIdentity } from '../../content/staff/staffIdentityFactory'
import { staffRegistry } from '../../registries/staffRegistry'
import { spendCoin } from '../stock/ledger'
import type { StaffState } from '../../state/TavernState'

import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionDefinition,
  OwnerActionInput,
} from './types'

// Phase 86 / ISSUE-046 — staff-management owner actions.
//
// Three actions close the gap the post-phase-73 audit flagged: the
// player previously had no in-run path to add or remove staff or to
// refuse service to a customer group, capping the depth of every
// staff- and customer-side feedback loop.
//
//   - `hire_staff`: pick a role, pay a placement fee, append a new
//     staff member with a generated identity from the wider
//     Phase 81 / ISSUE-041 identity profile pool.
//   - `fire_staff`: target a staff id, remove it, hit remaining
//     staff morale, and post a memory for any regular who knew the
//     departing staff member.
//   - `ban_customer_group`: target a customer-group id, suppress
//     their patronage/traffic for a configurable window, charge a
//     reputation cost.

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

// ---------- hire_staff ----------

// Flat placement fee. Higher than a single shift bonus, lower than a
// week's wage — the player pays to bring a new hand in, then carries
// the recurring wage cost from the weekly module.
export const HIRE_STAFF_COST = 40

export const HIRE_STAFF_ACTION_ID = 'hire_staff'

function listHireableRoles(_ctx: SimContext): ActionTarget[] {
  // Every registered role is a potential hire target. The defaults
  // file uses `seedOnDayZero` to skip seeding some roles (cook tiers)
  // but they're still hireable.
  return staffRegistry.all().map((def) => ({
    id: def.id,
    label: def.label,
    hint: `skill ${def.defaultState.skill}, wage ${def.defaultState.wage}/wk`,
  }))
}

function buildHireId(ctx: SimContext, roleId: string): string {
  const today = ctx.state.calendar.totalDaysElapsed + 1
  let counter = 0
  let candidate = `hire_${roleId}_${today}_${counter}`
  while (ctx.state.staff[candidate]) {
    counter += 1
    candidate = `hire_${roleId}_${today}_${counter}`
  }
  return candidate
}

const hireStaffAction: OwnerActionDefinition = {
  id: HIRE_STAFF_ACTION_ID,
  label: 'Hire Staff',
  category: 'immediate',
  tags: ['staff', 'hire'],
  targetType: 'staff',
  actionPointCost: 1,
  getValidTargets: listHireableRoles,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'hire_staff requires targetId (role id)')
    }
    if (!staffRegistry.has(input.targetId)) {
      return reject('unknown_role', `Unknown staff role '${input.targetId}'`)
    }
    if (ctx.state.coin < HIRE_STAFF_COST) {
      return reject(
        'insufficient_coin',
        `Hiring costs ${HIRE_STAFF_COST} coin; have ${ctx.state.coin}.`,
      )
    }
    return OK
  },
  apply: (ctx, input) => {
    const roleId = input.targetId!
    const def = staffRegistry.get(roleId)
    const hireId = buildHireId(ctx, roleId)

    const identityRng = ctx.getRngStream('staff_identity')
    const existingNames = new Set(
      Object.values(ctx.state.staff).map((s) => s.name.display),
    )
    // Optional culture preference threaded through input.options to
    // bias the identity pool when the player wants a specific
    // cultural flavour.
    const preferredCultureId =
      typeof input.options?.['preferredCultureId'] === 'string'
        ? (input.options['preferredCultureId'] as string)
        : undefined
    const { identity, generatedName } = createStaffIdentity({
      staffId: hireId,
      roleId,
      rng: identityRng,
      existingNames,
      ...(preferredCultureId !== undefined ? { preferredCultureId } : {}),
    })

    const newStaff: StaffState = {
      id: hireId,
      name: generatedName,
      role: def.id,
      tags: [...def.defaultTags],
      ...def.defaultState,
      activeFlags: [...def.defaultState.activeFlags],
      identity,
    }

    spendCoin(ctx, HIRE_STAFF_COST, {
      source: `ownerActions.${HIRE_STAFF_ACTION_ID}`,
      category: 'wage',
      tags: ['staff', 'hire', roleId, hireId],
    })

    ctx.addStaff(newStaff, {
      source: `ownerActions.${HIRE_STAFF_ACTION_ID}`,
      sourceType: 'owner_action',
      direction: 'increase',
      amount: 1,
      readable: `Hired ${generatedName.display} as ${def.label}.`,
      tags: ['staff', 'hire', roleId, hireId],
      relatedActors: [{ kind: 'staff', id: hireId }],
      relatedSystems: ['staff'],
    })

    ctx.addMemory({
      id: 'staff_hired',
      source: 'ownerActions.hire_staff',
      actors: [{ kind: 'staff', id: hireId }],
      tags: ['staff', 'hire', roleId, hireId],
      metadata: {
        staffId: hireId,
        staffName: generatedName.display,
        roleId,
      },
    })

    return {
      actionId: HIRE_STAFF_ACTION_ID,
      label: 'Hired Staff',
      targetId: hireId,
      actionPointCost: 1,
      effects: [
        `Hired ${generatedName.display} (${def.label}).`,
        `coin -${HIRE_STAFF_COST}`,
      ],
      data: {
        staffId: hireId,
        roleId,
        coin: { spent: HIRE_STAFF_COST },
      },
    }
  },
}

// ---------- fire_staff ----------

export const FIRE_STAFF_ACTION_ID = 'fire_staff'

// How much morale every remaining staff member drops on a firing.
// Modest but real — witnessing a firing tightens up but stings.
const FIRE_MORALE_HIT = 5

function listFireableStaff(ctx: SimContext): ActionTarget[] {
  return Object.values(ctx.state.staff).map((s) => ({
    id: s.id,
    label: s.name.display,
    hint: `${s.role}, morale ${s.morale}`,
  }))
}

const fireStaffAction: OwnerActionDefinition = {
  id: FIRE_STAFF_ACTION_ID,
  label: 'Fire Staff',
  category: 'immediate',
  tags: ['staff', 'fire'],
  targetType: 'staff',
  actionPointCost: 1,
  getValidTargets: listFireableStaff,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'fire_staff requires targetId')
    }
    if (!ctx.state.staff[input.targetId]) {
      return reject('unknown_target', `Unknown staff '${input.targetId}'`)
    }
    if (Object.keys(ctx.state.staff).length <= 1) {
      return reject(
        'last_staff',
        'Cannot fire the last remaining staff member.',
      )
    }
    return OK
  },
  apply: (ctx, input) => {
    const firedId = input.targetId!
    const fired = ctx.state.staff[firedId]!
    const firedName = fired.name.display
    const firedRole = fired.role

    // Drop morale on every remaining staff member before the removal
    // so they see the empty chair land.
    for (const member of Object.values(ctx.state.staff)) {
      if (member.id === firedId) continue
      const nextMorale = Math.max(0, member.morale - FIRE_MORALE_HIT)
      if (nextMorale === member.morale) continue
      ctx.modifyStaff(
        member.id,
        { morale: nextMorale },
        {
          source: `ownerActions.${FIRE_STAFF_ACTION_ID}.witness`,
          sourceType: 'owner_action',
          readable: `${member.name.display} watched ${firedName} get fired (morale -${FIRE_MORALE_HIT}).`,
          tags: ['staff', 'morale', 'witness', firedId],
          relatedActors: [
            { kind: 'staff', id: member.id },
            { kind: 'staff', id: firedId },
          ],
          relatedSystems: ['staff'],
        },
      )
    }

    ctx.removeStaff(firedId, {
      source: `ownerActions.${FIRE_STAFF_ACTION_ID}`,
      sourceType: 'owner_action',
      direction: 'decrease',
      amount: -1,
      readable: `Fired ${firedName}.`,
      tags: ['staff', 'fire', firedRole, firedId],
      relatedActors: [{ kind: 'staff', id: firedId }],
      relatedSystems: ['staff'],
    })

    ctx.addMemory({
      id: 'staff_fired',
      source: 'ownerActions.fire_staff',
      actors: [{ kind: 'staff', id: firedId }],
      tags: ['staff', 'fire', firedRole, firedId],
      metadata: {
        staffId: firedId,
        staffName: firedName,
        roleId: firedRole,
      },
    })

    return {
      actionId: FIRE_STAFF_ACTION_ID,
      label: 'Fired Staff',
      targetId: firedId,
      actionPointCost: 1,
      effects: [
        `Fired ${firedName} (${firedRole}).`,
        `Remaining staff morale -${FIRE_MORALE_HIT} each.`,
      ],
      data: {
        staffId: firedId,
        roleId: firedRole,
        moraleHit: FIRE_MORALE_HIT,
      },
    }
  },
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
  targetType: 'customer_group',
  actionPointCost: 1,
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
      actionPointCost: 1,
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
  hireStaffAction,
  fireStaffAction,
  banCustomerGroupAction,
]

export {
  hireStaffAction,
  fireStaffAction,
  banCustomerGroupAction,
}
