import type { SimContext } from '../../core/context'
import type {
  CauseEntry,
  EntityRef,
  MemoryState,
  TavernState,
} from '../../state/TavernState'
import type { ServiceScene } from '../service/types'
import type { OwnerSocialActionRecord } from '../ownerActions/types'
import { OWNER_ACTIONS_MODULE_ID } from '../ownerActions/ownerActionsModule'
import { SERVICE_MODULE_ID } from '../service/serviceModule'

import { getAttributionModuleState } from './attributionQueries'
import type { AttributionDraft } from './attributionTypes'

// Phase 37 §37.4 — Attribution rules.
//
// Each rule reads a slice of recent simulation truth (causes, scenes,
// memories, owner actions, projects, policies, supplier events, faction
// state, social rumours, local arcs) and emits zero or more
// `AttributionDraft`s. The module collects, deduplicates, ages, and (for
// strong public beliefs) propagates them into memories, causes, and
// rumours.

export type AttributionRule = {
  id: string
  tags: string[]
  evaluate(ctx: SimContext): AttributionDraft[]
}

const RECENT_WINDOW_DAYS = 3

function tavernRef(state: TavernState): EntityRef {
  return { kind: 'tavern_identity', id: state.meta.tavernId }
}

function recentCauses(state: TavernState, days: number): CauseEntry[] {
  const cutoff = state.calendar.totalDaysElapsed - days
  return state.causes.filter((c) => c.timestamp.absoluteDay >= cutoff)
}

function recentMemories(state: TavernState, days: number): MemoryState[] {
  const cutoff = state.calendar.totalDaysElapsed - days
  return state.memories.filter((m) => m.createdAt.absoluteDay >= cutoff)
}

function todaysScenes(state: TavernState): ServiceScene[] {
  const slice = state.modules['service'] as
    | { result?: { scenes?: ServiceScene[] } }
    | undefined
  if (!slice || !slice.result || !Array.isArray(slice.result.scenes)) {
    return []
  }
  return slice.result.scenes
}

function recentSocialActions(
  state: TavernState,
  days: number,
): OwnerSocialActionRecord[] {
  const slice = state.modules[OWNER_ACTIONS_MODULE_ID] as
    | { recentSocialActions?: OwnerSocialActionRecord[] }
    | undefined
  if (!slice || !Array.isArray(slice.recentSocialActions)) return []
  const today = state.calendar.totalDaysElapsed
  return slice.recentSocialActions.filter((r) => today - r.day <= days)
}

function recentlyCompletedProjects(state: TavernState, days: number) {
  const slice = state.modules[OWNER_ACTIONS_MODULE_ID] as
    | { projects?: Record<string, {
        id: string
        status: string
        targetType?: string
        targetId?: string
        startedAtDay: number
        requiredProgress: number
        progress: number
        tags: string[]
        label: string
      }> }
    | undefined
  if (!slice || !slice.projects) return []
  const today = state.calendar.totalDaysElapsed
  const completed = []
  for (const project of Object.values(slice.projects)) {
    if (project.status !== 'completed') continue
    // Use startedAtDay + requiredProgress as a rough completion indicator
    // when no completedAtDay field exists. We treat any project still
    // present with status 'completed' that hasn't existed forever as
    // recent enough.
    const elapsed = today - project.startedAtDay
    if (elapsed >= 0 && elapsed <= days + project.requiredProgress) {
      completed.push(project)
    }
  }
  return completed
}

function spreadingRumours(state: TavernState) {
  const out: Array<{
    id: string
    label: string
    accuracy: 'true' | 'partial' | 'false' | 'unknown'
    strength: number
    subject?: EntityRef
    targetEntityId?: string
    tags: string[]
  }> = []
  for (const rumour of Object.values(state.world.socialRumours)) {
    if (rumour.strength < 30) continue
    const entry: {
      id: string
      label: string
      accuracy: 'true' | 'partial' | 'false' | 'unknown'
      strength: number
      subject?: EntityRef
      targetEntityId?: string
      tags: string[]
    } = {
      id: rumour.id,
      label: rumour.label,
      accuracy: rumour.accuracy,
      strength: rumour.strength,
      tags: rumour.tags,
    }
    if (rumour.subject) entry.subject = rumour.subject
    if (rumour.targetEntityId !== undefined) {
      entry.targetEntityId = rumour.targetEntityId
    }
    out.push(entry)
  }
  return out
}

function activeRivalArcs(state: TavernState) {
  const arcs: Array<{ id: string; intensity: number }> = []
  for (const event of Object.values(state.world.localEvents)) {
    const isRival =
      event.tags.includes('rival') ||
      event.type === 'rival' ||
      event.definitionId.includes('rival')
    if (!isRival) continue
    if (event.stage === 'resolved' || event.stage === 'failed') continue
    arcs.push({ id: event.id, intensity: event.intensity })
  }
  return arcs
}

// ---------- Individual rules ----------

const badStockBlameSupplier: AttributionRule = {
  id: 'bad_stock_blame_supplier',
  tags: ['supplier', 'blame', 'stock'],
  evaluate(ctx: SimContext): AttributionDraft[] {
    const drafts: AttributionDraft[] = []
    const tavern = tavernRef(ctx.state)

    const causes = recentCauses(ctx.state, RECENT_WINDOW_DAYS).filter(
      (c) =>
        (c.tags.includes('food_safety') ||
          c.tags.includes('spoilage') ||
          c.tags.includes('bad_stock')) &&
        c.relatedActors.some((a) => a.kind === 'supplier'),
    )

    for (const cause of causes) {
      const supplierRefs = cause.relatedActors.filter(
        (a) => a.kind === 'supplier',
      )
      for (const supplierRef of supplierRefs) {
        // Customers blame the tavern.
        for (const groupId of Object.keys(ctx.state.customerGroups)) {
          drafts.push({
            perceivedBy: { kind: 'customer_group', id: groupId },
            target: tavern,
            attributionType: 'blame',
            accuracy: 'partial',
            readable:
              'Customers blame the tavern for serving spoiled goods.',
            strength: Math.min(60, Math.abs(cause.amount) + 30),
            confidence: 50,
            publicness: 60,
            volatility: 30,
            tags: ['supplier', 'blame', 'stock'],
            sourceCauseIds: [cause.id],
            relatedSystems: ['supplier', 'stock'],
          })
        }
        // Owner blames supplier.
        drafts.push({
          perceivedBy: tavern,
          target: supplierRef,
          attributionType: 'blame',
          accuracy: 'true',
          readable: 'The owner blames the supplier for the bad stock.',
          strength: 60,
          confidence: 70,
          publicness: 30,
          volatility: 20,
          tags: ['supplier', 'blame', 'stock'],
          sourceCauseIds: [cause.id],
          relatedSystems: ['supplier', 'stock'],
        })
        // Supplier resents being publicly blamed.
        drafts.push({
          perceivedBy: supplierRef,
          target: tavern,
          attributionType: 'resentment',
          accuracy: 'partial',
          readable:
            'The supplier resents being publicly blamed by the tavern.',
          strength: 45,
          confidence: 60,
          publicness: 30,
          volatility: 40,
          tags: ['supplier', 'resentment'],
          sourceCauseIds: [cause.id],
          relatedSystems: ['supplier'],
        })
      }
    }
    return drafts
  },
}

const staffServiceFailureBlame: AttributionRule = {
  id: 'staff_service_failure_blame',
  tags: ['staff', 'blame', 'service'],
  evaluate(ctx: SimContext): AttributionDraft[] {
    const drafts: AttributionDraft[] = []
    const tavern = tavernRef(ctx.state)
    const scenes = todaysScenes(ctx.state)

    // Causes tagged with staff/service failure also feed this rule so
    // the layer can react to multi-day patterns even after today's
    // service slice resets at startDay.
    const failureCauses = recentCauses(ctx.state, RECENT_WINDOW_DAYS).filter(
      (c) =>
        (c.tags.includes('service_failure') ||
          c.tags.includes('staff_mistake') ||
          c.tags.includes('service')) &&
        c.relatedActors.some((a) => a.kind === 'staff'),
    )
    for (const cause of failureCauses) {
      const staffRefs = cause.relatedActors.filter((a) => a.kind === 'staff')
      for (const staffRef of staffRefs) {
        for (const groupId of Object.keys(ctx.state.customerGroups)) {
          drafts.push({
            perceivedBy: { kind: 'customer_group', id: groupId },
            target: staffRef,
            attributionType: 'blame',
            accuracy: 'partial',
            readable: 'Customers blame the staff for the service failure.',
            strength: Math.min(60, Math.abs(cause.amount) + 30),
            confidence: 50,
            publicness: 45,
            volatility: 30,
            tags: ['staff', 'blame', 'service'],
            sourceCauseIds: [cause.id],
            relatedSystems: ['staff', 'service'],
          })
        }
      }
    }

    for (const scene of scenes) {
      const isStaffMistake =
        scene.sceneType === 'staff_customer_friction' ||
        scene.sceneType === 'staff_moment' ||
        scene.tags.includes('staff_mistake') ||
        scene.tags.includes('staff_failure')
      if (!isStaffMistake) continue

      for (const staffId of scene.staffIds) {
        const staffRef: EntityRef = { kind: 'staff', id: staffId }
        for (const groupId of scene.involvedGroupIds.length > 0
          ? scene.involvedGroupIds
          : Object.keys(ctx.state.customerGroups)) {
          drafts.push({
            perceivedBy: { kind: 'customer_group', id: groupId },
            target: staffRef,
            attributionType: 'blame',
            accuracy: 'partial',
            readable: 'Customers blame the staff for the service failure.',
            strength: Math.min(70, scene.numericSeverity + 20),
            confidence: 55,
            publicness: 50,
            volatility: 35,
            tags: ['staff', 'blame', 'service'],
            sourceSceneIds: [scene.id],
            relatedSystems: ['staff', 'service'],
          })
        }
        // Staff blame area conditions / stress when there is supporting
        // cause data with stress or area tags.
        const stressCauses = recentCauses(ctx.state, 1).filter(
          (c) =>
            (c.tags.includes('stress') ||
              c.tags.includes('fatigue') ||
              c.tags.includes('area_problem')) &&
            c.relatedActors.some((a) => a.kind === 'staff' && a.id === staffId),
        )
        if (stressCauses.length > 0) {
          drafts.push({
            perceivedBy: staffRef,
            target: tavern,
            attributionType: 'resentment',
            accuracy: 'partial',
            readable:
              'The staff member blames bad working conditions for the slip.',
            strength: 40,
            confidence: 55,
            publicness: 20,
            volatility: 30,
            tags: ['staff', 'resentment', 'conditions'],
            sourceSceneIds: [scene.id],
            sourceCauseIds: stressCauses.map((c) => c.id),
            relatedSystems: ['staff'],
          })
        }
      }
    }
    return drafts
  },
}

const projectSuccessCreditOwner: AttributionRule = {
  id: 'project_success_credit_owner',
  tags: ['project', 'credit'],
  evaluate(ctx: SimContext): AttributionDraft[] {
    const drafts: AttributionDraft[] = []
    const tavern = tavernRef(ctx.state)
    const projects = recentlyCompletedProjects(ctx.state, RECENT_WINDOW_DAYS)

    for (const project of projects) {
      // Customers / factions affected by the project credit owner.
      if (project.targetType === 'customer' && project.targetId) {
        drafts.push({
          perceivedBy: { kind: 'customer_group', id: project.targetId },
          target: tavern,
          attributionType: 'credit',
          accuracy: 'true',
          readable: `The ${project.label} earns the owner credit with regulars.`,
          strength: 55,
          confidence: 70,
          publicness: 50,
          volatility: 20,
          tags: ['project', 'credit'],
          relatedSystems: ['ownerActions', 'projects'],
        })
      } else if (project.targetType === 'faction' && project.targetId) {
        drafts.push({
          perceivedBy: { kind: 'faction', id: project.targetId },
          target: tavern,
          attributionType: 'credit',
          accuracy: 'true',
          readable: `The ${project.label} earns the owner credit with the faction.`,
          strength: 55,
          confidence: 70,
          publicness: 50,
          volatility: 20,
          tags: ['project', 'credit', 'faction'],
          relatedSystems: ['ownerActions', 'projects'],
        })
      } else {
        // Generic: regulars credit the tavern.
        for (const regularId of Object.keys(ctx.state.world.regulars)) {
          drafts.push({
            perceivedBy: { kind: 'regular', id: regularId },
            target: tavern,
            attributionType: 'gratitude',
            accuracy: 'true',
            readable: `Regulars credit the owner for finishing the ${project.label}.`,
            strength: 45,
            confidence: 60,
            publicness: 35,
            volatility: 20,
            tags: ['project', 'gratitude'],
            relatedSystems: ['ownerActions', 'projects'],
          })
        }
      }

      // Staff involved feel proud / credited if any staff actor exists.
      for (const staffId of Object.keys(ctx.state.staff)) {
        if (project.tags.includes('staff') || project.tags.includes('crew')) {
          drafts.push({
            perceivedBy: { kind: 'staff', id: staffId },
            target: tavern,
            attributionType: 'gratitude',
            accuracy: 'partial',
            readable: 'Staff feel proud of finishing the project.',
            strength: 30,
            confidence: 55,
            publicness: 15,
            volatility: 25,
            tags: ['project', 'staff', 'gratitude'],
            relatedSystems: ['ownerActions', 'staff'],
          })
        }
      }
    }
    return drafts
  },
}

const policyBacklashAttribution: AttributionRule = {
  id: 'policy_backlash_attribution',
  tags: ['policy', 'blame'],
  evaluate(ctx: SimContext): AttributionDraft[] {
    const drafts: AttributionDraft[] = []
    const tavern = tavernRef(ctx.state)

    const causes = recentCauses(ctx.state, RECENT_WINDOW_DAYS).filter(
      (c) => c.tags.includes('policy') && c.direction === 'decrease',
    )

    for (const cause of causes) {
      const groupRefs = cause.relatedActors.filter(
        (a) => a.kind === 'customer_group' || a.kind === 'faction',
      )
      for (const groupRef of groupRefs) {
        drafts.push({
          perceivedBy: groupRef,
          target: tavern,
          attributionType: 'blame',
          accuracy: 'true',
          readable: 'The group blames the owner for the new policy.',
          strength: Math.min(70, Math.abs(cause.amount) + 35),
          confidence: 65,
          publicness: 55,
          volatility: 30,
          tags: ['policy', 'blame'],
          sourceCauseIds: [cause.id],
          relatedSystems: ['policy', 'ownerActions'],
        })
      }
      // Loyal regulars defend; disloyal ones criticize.
      for (const regular of Object.values(ctx.state.world.regulars)) {
        const ref: EntityRef = { kind: 'regular', id: regular.id }
        if (regular.loyalty >= 60) {
          drafts.push({
            perceivedBy: ref,
            target: tavern,
            attributionType: 'trust',
            accuracy: 'partial',
            readable: 'A loyal regular defends the new policy.',
            strength: 30,
            confidence: 55,
            publicness: 25,
            volatility: 35,
            tags: ['policy', 'trust', 'loyalty'],
            sourceCauseIds: [cause.id],
            relatedSystems: ['policy'],
          })
        } else if (regular.loyalty <= 35) {
          drafts.push({
            perceivedBy: ref,
            target: tavern,
            attributionType: 'distrust',
            accuracy: 'partial',
            readable: 'A wavering regular criticizes the new policy.',
            strength: 35,
            confidence: 55,
            publicness: 30,
            volatility: 40,
            tags: ['policy', 'distrust'],
            sourceCauseIds: [cause.id],
            relatedSystems: ['policy'],
          })
        }
      }
    }
    return drafts
  },
}

const rivalTavernSuspicion: AttributionRule = {
  id: 'rival_tavern_suspicion',
  tags: ['rival', 'suspicion'],
  evaluate(ctx: SimContext): AttributionDraft[] {
    const drafts: AttributionDraft[] = []
    const tavern = tavernRef(ctx.state)
    const arcs = activeRivalArcs(ctx.state)
    if (arcs.length === 0) return drafts

    // Suspicion fires when a recent reputation cause shows a drop.
    const repDrops = recentCauses(ctx.state, RECENT_WINDOW_DAYS).filter(
      (c) => c.targetType === 'reputation' && c.direction === 'decrease',
    )
    if (repDrops.length === 0) return drafts

    const arcId = arcs[0]!.id
    const arcRef: EntityRef = { kind: 'local_event', id: arcId }

    for (const groupId of Object.keys(ctx.state.customerGroups)) {
      drafts.push({
        perceivedBy: { kind: 'customer_group', id: groupId },
        target: arcRef,
        attributionType: 'suspicion',
        accuracy: 'unknown',
        readable: 'Locals suspect rival interference behind the trouble.',
        strength: 40,
        confidence: 35,
        publicness: 50,
        volatility: 50,
        tags: ['rival', 'suspicion'],
        sourceCauseIds: repDrops.map((c) => c.id),
        relatedSystems: ['localEvents', 'reputation'],
      })
    }
    // The owner may suspect the rival but accuracy is unknown.
    drafts.push({
      perceivedBy: tavern,
      target: arcRef,
      attributionType: 'suspicion',
      accuracy: 'unknown',
      readable: 'The owner suspects the rival is behind the recent drift.',
      strength: 45,
      confidence: 30,
      publicness: 20,
      volatility: 50,
      tags: ['rival', 'suspicion'],
      sourceCauseIds: repDrops.map((c) => c.id),
      relatedSystems: ['localEvents', 'reputation'],
    })
    return drafts
  },
}

// Phase 37 — Rumour distrust rate-limit window. Without a cooldown, every
// active rumour fires this rule every day and the resulting distrust
// memories dominate entity-memory production. Seven days matches the
// `recent_*` memory horizon used elsewhere and keeps the propagated
// memories distributed across customer groups.
const RUMOUR_DISTRUST_COOLDOWN_DAYS = 7

const rumourDistortsCause: AttributionRule = {
  id: 'rumour_distorts_cause',
  tags: ['rumour', 'distortion'],
  evaluate(ctx: SimContext): AttributionDraft[] {
    const drafts: AttributionDraft[] = []
    const tavern = tavernRef(ctx.state)
    const rumours = spreadingRumours(ctx.state)
    if (rumours.length === 0) return drafts

    const today = ctx.state.calendar.totalDaysElapsed
    const slice = getAttributionModuleState(ctx.state)
    const cooldowns = slice?.recentDistrustByRumour ?? {}

    const eligibleGroups = Object.values(ctx.state.customerGroups).filter(
      (g) => g.patronage >= 25,
    )
    const rng = ctx.getRngStream('attribution_perceiver')

    for (const rumour of rumours) {
      if (rumour.accuracy === 'true') continue
      const lastDay = cooldowns[rumour.id]
      if (lastDay !== undefined && today - lastDay < RUMOUR_DISTRUST_COOLDOWN_DAYS) {
        continue
      }
      const target: EntityRef = rumour.subject ?? tavern
      const perceiverGroup =
        eligibleGroups.length > 0 ? rng.pick(eligibleGroups) : undefined
      const perceivedBy: EntityRef = perceiverGroup
        ? { kind: 'customer_group', id: perceiverGroup.id }
        : { kind: 'system', id: 'town_gossip' }
      drafts.push({
        perceivedBy,
        target,
        attributionType: 'distrust',
        accuracy: rumour.accuracy === 'unknown' ? 'unknown' : rumour.accuracy,
        readable: `Gossip spreads: ${rumour.label}`,
        strength: Math.min(70, rumour.strength + 10),
        confidence: 40,
        publicness: Math.min(85, rumour.strength + 20),
        volatility: 60,
        tags: ['rumour', ...rumour.tags],
        sourceEventId: rumour.id,
        relatedSystems: ['rumour'],
      })
    }

    return drafts
  },
}

// Memory-derived attributions: when an entity memory tagged
// blame/credit/gratitude already exists, surface a matching attribution
// so card-fuel queries against the attribution layer can find it without
// re-deriving from causes.
const memoryDerivedAttributions: AttributionRule = {
  id: 'memory_derived_attributions',
  tags: ['memory'],
  evaluate(ctx: SimContext): AttributionDraft[] {
    const drafts: AttributionDraft[] = []
    const memories = recentMemories(ctx.state, RECENT_WINDOW_DAYS)

    for (const memory of memories) {
      const meta = memory.metadata as
        | {
            owner?: EntityRef
            blamed?: EntityRef[]
            credited?: EntityRef[]
            sourceEventId?: string
          }
        | undefined
      const owner = meta?.owner ?? memory.actors[0]
      if (!owner) continue

      if (meta?.blamed && meta.blamed.length > 0) {
        for (const target of meta.blamed) {
          drafts.push({
            perceivedBy: owner,
            target,
            attributionType: 'blame',
            accuracy: memory.tags.includes('false') ? 'false' : 'true',
            readable:
              memory.label ?? `Memory ${memory.definitionId ?? memory.id}`,
            strength: memory.strength,
            confidence: 60,
            publicness: 35,
            volatility: 25,
            tags: ['memory', ...memory.tags],
            sourceMemoryIds: [memory.id],
            ...(meta?.sourceEventId !== undefined
              ? { sourceEventId: meta.sourceEventId }
              : {}),
            relatedSystems: memory.relatedSystems.length > 0
              ? memory.relatedSystems
              : ['memory'],
          })
        }
      }
      if (meta?.credited && meta.credited.length > 0) {
        for (const target of meta.credited) {
          drafts.push({
            perceivedBy: owner,
            target,
            attributionType: 'credit',
            accuracy: 'true',
            readable:
              memory.label ?? `Memory ${memory.definitionId ?? memory.id}`,
            strength: memory.strength,
            confidence: 65,
            publicness: 30,
            volatility: 20,
            tags: ['memory', ...memory.tags],
            sourceMemoryIds: [memory.id],
            ...(meta?.sourceEventId !== undefined
              ? { sourceEventId: meta.sourceEventId }
              : {}),
            relatedSystems: memory.relatedSystems.length > 0
              ? memory.relatedSystems
              : ['memory'],
          })
        }
      }
    }
    return drafts
  },
}

// Recent owner social actions can produce attributions even before
// memories settle (e.g. apology improves regular trust).
const socialActionAttributions: AttributionRule = {
  id: 'social_action_attributions',
  tags: ['social', 'action'],
  evaluate(ctx: SimContext): AttributionDraft[] {
    const drafts: AttributionDraft[] = []
    const tavern = tavernRef(ctx.state)
    const records = recentSocialActions(ctx.state, RECENT_WINDOW_DAYS)

    for (const record of records) {
      if (record.outcome === 'neutral') continue
      const targetRef: EntityRef = {
        kind: record.targetType === 'staff' ? 'staff' : record.targetType === 'regular' ? 'regular' : 'other',
        id: record.targetId,
      }
      const positive = record.outcome === 'improved'
      drafts.push({
        perceivedBy: targetRef,
        target: tavern,
        attributionType: positive ? 'gratitude' : 'resentment',
        accuracy: 'true',
        readable: positive
          ? 'The recipient feels grateful after the owner reached out.'
          : 'The recipient feels worse after the owner reached out.',
        strength: positive ? 45 : 50,
        confidence: 65,
        publicness: 25,
        volatility: 25,
        tags: ['social_action', record.actionId, ...record.tags],
        sourceEventId: record.id,
        relatedSystems: ['ownerActions', 'social'],
      })
    }
    return drafts
  },
}

export const ATTRIBUTION_RULES: ReadonlyArray<AttributionRule> = [
  badStockBlameSupplier,
  staffServiceFailureBlame,
  projectSuccessCreditOwner,
  policyBacklashAttribution,
  rivalTavernSuspicion,
  rumourDistortsCause,
  memoryDerivedAttributions,
  socialActionAttributions,
]

export function evaluateAllRules(ctx: SimContext): AttributionDraft[] {
  const drafts: AttributionDraft[] = []
  for (const rule of ATTRIBUTION_RULES) {
    const out = rule.evaluate(ctx)
    for (const draft of out) drafts.push(draft)
  }
  return drafts
}
