import type { SimContext } from '../../core/context'
import { clampPercent } from '../../state/normalize'

import { pushSocialAction } from './stateHelpers'
import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionApplied,
  OwnerActionDefinition,
  OwnerSocialActionOutcome,
  OwnerSocialActionRecord,
} from './types'

// Phase 33 §33.7 — Social actions.
//
// Social actions target named entities (staff, regulars, suppliers,
// customer groups, factions) and produce relationship-shaped changes
// without long-running progress. Each action writes an audit entry into
// `state.modules.ownerActions.recentSocialActions` so the weekly
// community routine in Phase 34 can react ("Brik Tallowmug was
// apologized to this week") and the report can surface what just
// happened without re-walking history.
//
// Phase 30 supplier/regular/faction state must exist for the
// supplier/regular/faction actions to land. When the target type is
// missing the validator rejects gracefully (`unknown_target`) per the
// plan's "fail gracefully" rule.

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

function listStaff(ctx: SimContext): ActionTarget[] {
  return Object.values(ctx.state.staff).map((s) => ({
    id: s.id,
    label: s.name.display,
    hint: `morale ${s.morale}, stress ${s.stress}`,
  }))
}

function listRegulars(ctx: SimContext): ActionTarget[] {
  return Object.values(ctx.state.world.regulars).map((r) => ({
    id: r.id,
    label: r.name.display,
    hint: `loyalty ${r.loyalty}, irritation ${r.irritation}`,
  }))
}

function listSuppliers(ctx: SimContext): ActionTarget[] {
  return Object.values(ctx.state.world.suppliers).map((s) => ({
    id: s.id,
    label: s.label,
    hint: `relationship ${s.relationship}`,
  }))
}

function listCustomerGroups(ctx: SimContext): ActionTarget[] {
  return Object.values(ctx.state.customerGroups).map((g) => ({
    id: g.id,
    label: g.label,
    hint: `satisfaction ${g.satisfaction}, rowdiness ${g.rowdiness}`,
  }))
}

function listFactions(ctx: SimContext): ActionTarget[] {
  return Object.values(ctx.state.world.factions).map((f) => ({
    id: f.id,
    label: f.label,
    hint: `relationship ${f.relationship}`,
  }))
}

function recordSocialAction(args: {
  ctx: SimContext
  actionId: string
  targetType: OwnerSocialActionRecord['targetType']
  targetId: string
  outcome: OwnerSocialActionOutcome
  notes: string[]
  tags: string[]
}): void {
  const { ctx, actionId, targetType, targetId, outcome, notes, tags } = args
  const day = ctx.state.calendar.totalDaysElapsed
  const record: OwnerSocialActionRecord = {
    id: `${actionId}.${targetId}.${day}`,
    actionId,
    targetType,
    targetId,
    day,
    outcome,
    notes: [...notes],
    tags: [...tags],
  }
  pushSocialAction(ctx, record, 'social_action_recorded')
}

// ---------- comfort_stressed_staff ----------

const COMFORT_STRESS_DROP = 8
const COMFORT_MORALE_LIFT = 4
const COMFORT_LOYALTY_LIFT = 1

const comfortStressedStaff: OwnerActionDefinition = {
  id: 'comfort_stressed_staff',
  label: 'Comfort Stressed Staff',
  category: 'social',
  tags: ['social', 'staff', 'morale'],
  targetType: 'staff',
  actionPointCost: 1,
  getValidTargets: listStaff,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'comfort_stressed_staff requires targetId')
    }
    if (!ctx.state.staff[input.targetId]) {
      return reject('unknown_target', `Unknown staff '${input.targetId}'`)
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const staff = ctx.state.staff[input.targetId!]!
    const nextStress = clampPercent(staff.stress - COMFORT_STRESS_DROP)
    const nextMorale = clampPercent(staff.morale + COMFORT_MORALE_LIFT)
    const nextLoyalty = clampPercent(staff.loyalty + COMFORT_LOYALTY_LIFT)

    ctx.modifyStaff(
      staff.id,
      { stress: nextStress, morale: nextMorale, loyalty: nextLoyalty },
      { source: 'ownerActions.comfort_stressed_staff', reason: 'comfort_stressed_staff' },
    )

    const outcome: OwnerSocialActionOutcome =
      nextMorale > staff.morale || nextStress < staff.stress ? 'improved' : 'neutral'

    recordSocialAction({
      ctx,
      actionId: 'comfort_stressed_staff',
      targetType: 'staff',
      targetId: staff.id,
      outcome,
      notes: [
        `stress ${staff.stress} → ${nextStress}`,
        `morale ${staff.morale} → ${nextMorale}`,
      ],
      tags: ['social', 'staff', staff.id],
    })

    ctx.addMemory({
      id: 'staff_comforted_recently',
      actors: [{ kind: 'staff', id: staff.id }],
      source: 'ownerActions.comfort_stressed_staff',
      metadata: { staffId: staff.id },
    })
    // Phase 36 §36.5 — staff-scoped entity memory recording the owner's
    // intervention. The legacy `staff_comforted_recently` memory above
    // is kept for backwards compatibility; this entry adds an owner
    // pointer + a credit edge so attribution queries can find it.
    ctx.addEntityMemory(
      { kind: 'staff', id: staff.id },
      {
        id: 'staff_comforted_after_bad_shift',
        source: 'ownerActions.comfort_stressed_staff',
        tags: ['staff', 'morale', 'identity', 'social'],
      },
      {
        credited: [
          { kind: 'tavern_identity', id: ctx.state.meta.tavernId },
        ],
      },
    )
    ctx.addHistory({
      category: 'owner_action',
      summary: `Owner comforted ${staff.name.display}.`,
      tags: ['owner_action', 'social', 'comfort_stressed_staff', staff.id],
      relatedActors: [{ kind: 'staff', id: staff.id }],
      relatedSystems: ['ownerActions', 'staff'],
      mechanicalRefs: ['comfort_stressed_staff'],
    })

    return {
      actionId: comfortStressedStaff.id,
      label: `Comforted ${staff.name.display}`,
      targetId: staff.id,
      actionPointCost: 1,
      effects: [
        `stress ${staff.stress} → ${nextStress}`,
        `morale ${staff.morale} → ${nextMorale}`,
      ],
      data: {
        staffId: staff.id,
        stress: { before: staff.stress, after: nextStress },
        morale: { before: staff.morale, after: nextMorale },
        loyalty: { before: staff.loyalty, after: nextLoyalty },
        outcome,
      },
    }
  },
}

// ---------- apologize_to_regular ----------

const APOLOGY_IRRITATION_DROP = 12
const APOLOGY_LOYALTY_LIFT = 4

const apologizeToRegular: OwnerActionDefinition = {
  id: 'apologize_to_regular',
  label: 'Apologize to Regular',
  category: 'social',
  tags: ['social', 'regular'],
  targetType: 'regular',
  actionPointCost: 1,
  getValidTargets: listRegulars,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'apologize_to_regular requires targetId')
    }
    if (!ctx.state.world.regulars[input.targetId]) {
      return reject('unknown_target', `Unknown regular '${input.targetId}'`)
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const regular = ctx.state.world.regulars[input.targetId!]!
    const nextIrritation = clampPercent(regular.irritation - APOLOGY_IRRITATION_DROP)
    const nextLoyalty = clampPercent(regular.loyalty + APOLOGY_LOYALTY_LIFT)

    ctx.modifyRegular(
      regular.id,
      { irritation: nextIrritation, loyalty: nextLoyalty },
      {
        source: 'ownerActions.apologize_to_regular',
        sourceType: 'owner_action',
        target: regular.id,
        targetType: 'regular',
        readable: `Owner apologized to ${regular.name.display}.`,
        tags: ['owner_action', 'social', 'apologize_to_regular', regular.id],
      },
    )

    const outcome: OwnerSocialActionOutcome =
      nextIrritation < regular.irritation || nextLoyalty > regular.loyalty
        ? 'improved'
        : 'neutral'

    recordSocialAction({
      ctx,
      actionId: 'apologize_to_regular',
      targetType: 'regular',
      targetId: regular.id,
      outcome,
      notes: [
        `irritation ${regular.irritation} → ${nextIrritation}`,
        `loyalty ${regular.loyalty} → ${nextLoyalty}`,
      ],
      tags: ['social', 'regular', regular.id],
    })

    ctx.addMemory({
      id: 'regular_apologized_to_recently',
      actors: [{ kind: 'regular', id: regular.id }],
      source: 'ownerActions.apologize_to_regular',
      metadata: { regularId: regular.id },
    })
    ctx.addHistory({
      category: 'owner_action',
      summary: `Owner apologized to ${regular.name.display}.`,
      tags: ['owner_action', 'social', 'apologize_to_regular', regular.id],
      relatedActors: [{ kind: 'regular', id: regular.id }],
      relatedSystems: ['ownerActions', 'regulars'],
      mechanicalRefs: ['apologize_to_regular'],
    })

    return {
      actionId: apologizeToRegular.id,
      label: `Apologized to ${regular.name.display}`,
      targetId: regular.id,
      actionPointCost: 1,
      effects: [
        `irritation ${regular.irritation} → ${nextIrritation}`,
        `loyalty ${regular.loyalty} → ${nextLoyalty}`,
      ],
      data: {
        regularId: regular.id,
        irritation: { before: regular.irritation, after: nextIrritation },
        loyalty: { before: regular.loyalty, after: nextLoyalty },
        outcome,
      },
    }
  },
}

// ---------- negotiate_with_supplier ----------

const NEGOTIATE_RELATIONSHIP_LIFT = 5
const NEGOTIATE_RELIABILITY_LIFT = 1

const negotiateWithSupplier: OwnerActionDefinition = {
  id: 'negotiate_with_supplier',
  label: 'Negotiate with Supplier',
  category: 'social',
  tags: ['social', 'supplier'],
  targetType: 'supplier',
  actionPointCost: 1,
  getValidTargets: listSuppliers,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'negotiate_with_supplier requires targetId')
    }
    if (!ctx.state.world.suppliers[input.targetId]) {
      return reject('unknown_target', `Unknown supplier '${input.targetId}'`)
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const supplier = ctx.state.world.suppliers[input.targetId!]!
    const nextRelationship = clampPercent(
      supplier.relationship + NEGOTIATE_RELATIONSHIP_LIFT,
    )
    const nextReliability = clampPercent(
      supplier.reliability + NEGOTIATE_RELIABILITY_LIFT,
    )

    ctx.modifySupplier(
      supplier.id,
      { relationship: nextRelationship, reliability: nextReliability },
      {
        source: 'ownerActions.negotiate_with_supplier',
        sourceType: 'owner_action',
        target: supplier.id,
        targetType: 'supplier',
        readable: `Owner negotiated with ${supplier.label}.`,
        tags: ['owner_action', 'social', 'negotiate_with_supplier', supplier.id],
      },
    )

    const outcome: OwnerSocialActionOutcome =
      nextRelationship > supplier.relationship ? 'improved' : 'neutral'

    recordSocialAction({
      ctx,
      actionId: 'negotiate_with_supplier',
      targetType: 'supplier',
      targetId: supplier.id,
      outcome,
      notes: [
        `relationship ${supplier.relationship} → ${nextRelationship}`,
        `reliability ${supplier.reliability} → ${nextReliability}`,
      ],
      tags: ['social', 'supplier', supplier.id],
    })

    ctx.addHistory({
      category: 'owner_action',
      summary: `Owner negotiated with ${supplier.label}.`,
      tags: ['owner_action', 'social', 'negotiate_with_supplier', supplier.id],
      relatedSystems: ['ownerActions', 'suppliers'],
      mechanicalRefs: ['negotiate_with_supplier'],
    })

    return {
      actionId: negotiateWithSupplier.id,
      label: `Negotiated with ${supplier.label}`,
      targetId: supplier.id,
      actionPointCost: 1,
      effects: [
        `relationship ${supplier.relationship} → ${nextRelationship}`,
        `reliability ${supplier.reliability} → ${nextReliability}`,
      ],
      data: {
        supplierId: supplier.id,
        relationship: { before: supplier.relationship, after: nextRelationship },
        reliability: { before: supplier.reliability, after: nextReliability },
        outcome,
      },
    }
  },
}

// ---------- warn_rowdy_group ----------

const WARN_ROWDINESS_DROP = 6
const WARN_SATISFACTION_DROP = 3

const warnRowdyGroup: OwnerActionDefinition = {
  id: 'warn_rowdy_group',
  label: 'Warn Rowdy Group',
  category: 'social',
  tags: ['social', 'customer_group', 'rowdiness'],
  targetType: 'customer_group',
  actionPointCost: 1,
  getValidTargets: listCustomerGroups,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'warn_rowdy_group requires targetId')
    }
    if (!ctx.state.customerGroups[input.targetId]) {
      return reject(
        'unknown_target',
        `Unknown customer group '${input.targetId}'`,
      )
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const group = ctx.state.customerGroups[input.targetId!]!
    const nextRowdiness = clampPercent(group.rowdiness - WARN_ROWDINESS_DROP)
    const nextSatisfaction = clampPercent(group.satisfaction - WARN_SATISFACTION_DROP)

    ctx.modifyCustomerGroup(
      group.id,
      { rowdiness: nextRowdiness, satisfaction: nextSatisfaction },
      {
        source: 'ownerActions.warn_rowdy_group',
        sourceType: 'owner_action',
        target: group.id,
        targetType: 'customer',
        readable: `Owner warned ${group.label} about rowdy behaviour.`,
        tags: ['owner_action', 'social', 'warn_rowdy_group', group.id],
      },
    )

    const outcome: OwnerSocialActionOutcome =
      nextRowdiness < group.rowdiness ? 'improved' : 'neutral'

    recordSocialAction({
      ctx,
      actionId: 'warn_rowdy_group',
      targetType: 'customer_group',
      targetId: group.id,
      outcome,
      notes: [
        `rowdiness ${group.rowdiness} → ${nextRowdiness}`,
        `satisfaction ${group.satisfaction} → ${nextSatisfaction}`,
      ],
      tags: ['social', 'customer_group', group.id],
    })

    ctx.addHistory({
      category: 'owner_action',
      summary: `Owner warned ${group.label} about rowdy behaviour.`,
      tags: ['owner_action', 'social', 'warn_rowdy_group', group.id],
      relatedSystems: ['ownerActions', 'customers'],
      mechanicalRefs: ['warn_rowdy_group'],
    })

    return {
      actionId: warnRowdyGroup.id,
      label: `Warned ${group.label}`,
      targetId: group.id,
      actionPointCost: 1,
      effects: [
        `rowdiness ${group.rowdiness} → ${nextRowdiness}`,
        `satisfaction ${group.satisfaction} → ${nextSatisfaction}`,
      ],
      data: {
        groupId: group.id,
        rowdiness: { before: group.rowdiness, after: nextRowdiness },
        satisfaction: { before: group.satisfaction, after: nextSatisfaction },
        outcome,
      },
    }
  },
}

// ---------- host_faction_night ----------

const HOST_FACTION_RELATIONSHIP_LIFT = 6
const HOST_FACTION_TRUST_LIFT = 2

const hostFactionNight: OwnerActionDefinition = {
  id: 'host_faction_night',
  label: 'Host Faction Night',
  category: 'social',
  tags: ['social', 'faction'],
  targetType: 'faction',
  actionPointCost: 1,
  getValidTargets: listFactions,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'host_faction_night requires targetId')
    }
    if (!ctx.state.world.factions[input.targetId]) {
      return reject('unknown_target', `Unknown faction '${input.targetId}'`)
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const faction = ctx.state.world.factions[input.targetId!]!
    const nextRelationship = clampPercent(
      faction.relationship + HOST_FACTION_RELATIONSHIP_LIFT,
    )
    const nextTrust = clampPercent(faction.trust + HOST_FACTION_TRUST_LIFT)

    ctx.modifyFaction(
      faction.id,
      { relationship: nextRelationship, trust: nextTrust },
      {
        source: 'ownerActions.host_faction_night',
        sourceType: 'owner_action',
        target: faction.id,
        targetType: 'faction',
        readable: `Owner hosted a ${faction.label} night.`,
        tags: ['owner_action', 'social', 'host_faction_night', faction.id],
      },
    )

    const outcome: OwnerSocialActionOutcome =
      nextRelationship > faction.relationship ? 'improved' : 'neutral'

    recordSocialAction({
      ctx,
      actionId: 'host_faction_night',
      targetType: 'faction',
      targetId: faction.id,
      outcome,
      notes: [
        `relationship ${faction.relationship} → ${nextRelationship}`,
        `trust ${faction.trust} → ${nextTrust}`,
      ],
      tags: ['social', 'faction', faction.id],
    })

    ctx.addHistory({
      category: 'owner_action',
      summary: `Owner hosted a ${faction.label} night.`,
      tags: ['owner_action', 'social', 'host_faction_night', faction.id],
      relatedSystems: ['ownerActions', 'factions'],
      mechanicalRefs: ['host_faction_night'],
    })

    return {
      actionId: hostFactionNight.id,
      label: `Hosted ${faction.label} Night`,
      targetId: faction.id,
      actionPointCost: 1,
      effects: [
        `relationship ${faction.relationship} → ${nextRelationship}`,
        `trust ${faction.trust} → ${nextTrust}`,
      ],
      data: {
        factionId: faction.id,
        relationship: { before: faction.relationship, after: nextRelationship },
        trust: { before: faction.trust, after: nextTrust },
        outcome,
      },
    }
  },
}

export const SOCIAL_ACTIONS: OwnerActionDefinition[] = [
  comfortStressedStaff,
  apologizeToRegular,
  negotiateWithSupplier,
  warnRowdyGroup,
  hostFactionNight,
]

export {
  comfortStressedStaff,
  apologizeToRegular,
  negotiateWithSupplier,
  warnRowdyGroup,
  hostFactionNight,
}
