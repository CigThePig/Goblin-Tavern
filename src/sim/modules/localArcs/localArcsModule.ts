import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { SimulationHook, SimulationModule } from '../../core/module'
import type { ValidationIssue } from '../../state/types'
import type {
  LocalEventWorldState,
  TavernState,
} from '../../state/TavernState'
import {
  ARC_REPEAT_COOLDOWN_DAYS,
  isActiveArcStage,
  isTerminalArcStage,
  type LocalArcStage,
} from '../../content/events/localArcTypes'
import { localArcRegistry } from '../../content/events/localArcRegistry'

import { MONTHLY_MODULE_ID } from '../monthly/types'
import { getMonthlyModuleState } from '../monthly/monthlyModule'

import { applyArcEffect, makeAppliedEffectRecord } from './arcEffects'
import {
  computeArcProgress,
  createArcInstance,
  listActiveArcs,
  listAllArcs,
  pickArcsToStart,
} from './arcEngine'
import { buildLocalArcsReport } from './report'
import {
  createInitialLocalArcsModuleState,
  getLocalArcsModuleState,
} from './state'
import {
  LOCAL_ARCS_MODULE_ID,
  type LocalArcsAppliedEffectRecord,
  type LocalArcsModuleState,
} from './types'

// Phase 35 — Local arcs / seasonal cycles module.
//
// Owns `state.modules.localArcs`. Arc instances themselves live on
// `state.world.localEvents`. The module:
//
//   1. Hooks `endMonth` (after the monthly module finalizes the month)
//      to progress existing arcs and seed at most one new arc per tick.
//   2. Applies each active arc's effects (pressure deltas, reputation
//      signals, customer-group flags, supplier flags, market-condition
//      ids, calendar tags, issue-seed tags).
//   3. Hooks `localEventUpdate` (Phase 27 daily hook) to refresh the
//      module slice's aggregated tag bundles — issue seed tags,
//      calendar tags, market condition ids — so downstream daily
//      consumers (issue seeds, market pricing) can read a current
//      snapshot without re-walking `state.world.localEvents`.
//   4. Emits a `LOCAL ARCS` report section on monthly tick days.
//   5. Validates that every active arc record references a registered
//      definition and a known stage.

const SOURCE = LOCAL_ARCS_MODULE_ID

function writeSlice(
  ctx: SimContext,
  patch: Partial<LocalArcsModuleState>,
  reason: string,
): void {
  ctx.modifyModuleState<LocalArcsModuleState>(
    LOCAL_ARCS_MODULE_ID,
    (current) => {
      const base = current ?? createInitialLocalArcsModuleState()
      return { ...base, ...patch }
    },
    { source: SOURCE, reason },
  )
}

function addArcToWorld(ctx: SimContext, arc: LocalEventWorldState): void {
  // Phase 27's `modifyLocalEvent` only handles updates to existing
  // records. Arc creation needs an additive write — mirror the regulars
  // module's direct-write pattern, then attribute it with `addCause`.
  ctx.state.world.localEvents[arc.id] = arc
  ctx.addCause({
    source: `${SOURCE}.start`,
    sourceType: 'local_event',
    target: arc.id,
    targetType: 'local_event',
    amount: 1,
    direction: 'increase',
    readable: `Local arc started: ${arc.label}.`,
    tags: ['local_arc', 'start', arc.definitionId],
    relatedSystems: ['local_arcs', 'monthly'],
  })
}

function updateArcRecord(
  ctx: SimContext,
  arcId: string,
  patch: Partial<LocalEventWorldState>,
  reason: string,
): void {
  ctx.modifyLocalEvent(arcId, patch, {
    source: `${SOURCE}.${reason}`,
    sourceType: 'local_event',
    target: arcId,
    targetType: 'local_event',
    amount: 0,
    readable: `Local arc updated: ${arcId} (${reason}).`,
    tags: ['local_arc', reason],
    relatedSystems: ['local_arcs'],
  })
}

function recordArcHistory(arc: LocalEventWorldState, entry: {
  day: number
  stage: LocalArcStage
  note: string
}): NonNullable<LocalEventWorldState['arcHistory']> {
  const existing = arc.arcHistory ?? []
  return [...existing, entry]
}

// ---------- Aggregated tag refresh ----------

type ArcTagBundles = {
  activeArcIds: string[]
  activeArcTags: string[]
  activeIssueSeedTags: string[]
  activeMarketConditionIds: string[]
}

function collectArcTagBundles(state: TavernState): ArcTagBundles {
  const arcs = listActiveArcs(state)
  const activeArcIds: string[] = []
  const activeArcTagsSet = new Set<string>()
  const activeIssueSeedTagsSet = new Set<string>()
  const activeMarketConditionIdsSet = new Set<string>()

  for (const arc of arcs) {
    activeArcIds.push(arc.id)
    if (!localArcRegistry.has(arc.definitionId)) continue
    const def = localArcRegistry.get(arc.definitionId)
    for (const effect of def.effects) {
      if (effect.kind === 'calendar_tag') activeArcTagsSet.add(effect.id)
      if (effect.kind === 'issue_seed_tag') activeIssueSeedTagsSet.add(effect.id)
      if (effect.kind === 'market_condition') {
        activeMarketConditionIdsSet.add(effect.id)
      }
    }
  }

  return {
    activeArcIds,
    activeArcTags: [...activeArcTagsSet].sort(),
    activeIssueSeedTags: [...activeIssueSeedTagsSet].sort(),
    activeMarketConditionIds: [...activeMarketConditionIdsSet].sort(),
  }
}

// ---------- Daily hook ----------

const localEventUpdateHook: SimulationHook = (ctx: SimContext): void => {
  // Refresh aggregated tag bundles so downstream consumers see a
  // current snapshot. Active-arc bookkeeping mostly happens on the
  // monthly tick; the daily hook just rebuilds the derived sets.
  //
  // The hook also unions today's calendar tags into
  // `monthlyCalendarTagsSeen` so the monthly seeding pass can satisfy
  // `calendar_tag` start conditions whose tag never falls on day 28
  // (e.g. `miner_payday` only fires on payday day types).
  const slice = getLocalArcsModuleState(ctx.state)
  const bundles = collectArcTagBundles(ctx.state)

  const todayTags = ctx.state.calendar.tags as readonly string[]
  let nextSeen = slice.monthlyCalendarTagsSeen
  let seenChanged = false
  if (todayTags.length > 0) {
    const seenSet = new Set(slice.monthlyCalendarTagsSeen)
    for (const tag of todayTags) {
      if (!seenSet.has(tag)) {
        seenSet.add(tag)
        seenChanged = true
      }
    }
    if (seenChanged) nextSeen = [...seenSet].sort()
  }

  if (
    !seenChanged &&
    arraysEqual(slice.activeArcIds, bundles.activeArcIds) &&
    arraysEqual(slice.activeArcTags, bundles.activeArcTags) &&
    arraysEqual(slice.activeIssueSeedTags, bundles.activeIssueSeedTags) &&
    arraysEqual(slice.activeMarketConditionIds, bundles.activeMarketConditionIds)
  ) {
    return
  }
  writeSlice(
    ctx,
    { ...bundles, monthlyCalendarTagsSeen: nextSeen },
    'refresh_active_tags',
  )
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

// ---------- Monthly tick ----------

const endMonthHook: SimulationHook = (ctx: SimContext): void => {
  const slice = getLocalArcsModuleState(ctx.state)
  const today = ctx.state.calendar.totalDaysElapsed
  if (slice.lastMonthlyTickDay === today) {
    // Already ticked this calendar day — keep the hook idempotent.
    return
  }
  const monthlySlice = getMonthlyModuleState(ctx.state)
  const cooldowns = { ...slice.cooldowns }
  const recentlyApplied: LocalArcsAppliedEffectRecord[] = []

  // 1. Progress existing arcs.
  for (const arc of listAllArcs(ctx.state)) {
    if (arc.stage === undefined) continue
    if (isTerminalArcStage(arc.stage)) continue
    const outcome = computeArcProgress(arc, today)
    if (!outcome) {
      // Still age the arc even when no stage transition fires so the
      // duration accounting stays accurate across ticks.
      const nextAge = (arc.ageDays ?? 0) + (today - (arc.lastUpdatedDay ?? today))
      if (nextAge !== (arc.ageDays ?? 0)) {
        updateArcRecord(
          ctx,
          arc.id,
          {
            ageDays: nextAge,
            lastUpdatedDay: today,
          },
          'age',
        )
      }
      continue
    }
    const updatedHistory = recordArcHistory(arc, {
      day: today,
      stage: outcome.nextStage,
      note: `Advanced to ${outcome.nextStage} (${outcome.reason}).`,
    })
    const nextAge = (arc.ageDays ?? 0) + (today - (arc.lastUpdatedDay ?? today))
    const becomingTerminal = isTerminalArcStage(outcome.nextStage)
    const nextIntensity = becomingTerminal
      ? Math.max(0, Math.min(100, arc.intensity - 10))
      : Math.max(0, Math.min(100, arc.intensity + 15))
    updateArcRecord(
      ctx,
      arc.id,
      {
        stage: outcome.nextStage,
        lastUpdatedDay: today,
        ageDays: nextAge,
        intensity: nextIntensity,
        arcHistory: updatedHistory,
      },
      `stage_${outcome.nextStage}`,
    )

    if (becomingTerminal) {
      cooldowns[arc.definitionId] = today + ARC_REPEAT_COOLDOWN_DAYS
      ctx.addHistory({
        category: 'monthly',
        summary: `Local arc resolved: ${arc.label}.`,
        tags: ['monthly', 'local_arc', 'resolved', arc.definitionId],
        relatedActors: [],
        relatedLocations: [],
        relatedSystems: ['monthly', 'local_arcs'],
        mechanicalRefs: [arc.id],
      })
      ctx.addMemory({
        id: `local_arc_resolved:${arc.definitionId}`,
        source: `${SOURCE}.${arc.definitionId}`,
        actors: [{ kind: 'local_event', id: arc.id }],
        metadata: { arcId: arc.id, stage: outcome.nextStage },
      })
    } else {
      ctx.addHistory({
        category: 'monthly',
        summary: `Local arc ${arc.label} entered ${outcome.nextStage}.`,
        tags: ['monthly', 'local_arc', 'progress', arc.definitionId],
        relatedActors: [],
        relatedLocations: [],
        relatedSystems: ['monthly', 'local_arcs'],
        mechanicalRefs: [arc.id],
      })
    }
  }

  // 2. Seed new arcs (at most one per monthly tick) using current
  // post-progress state. The slice's `monthlyCalendarTagsSeen` carries
  // tags observed earlier in the month so `calendar_tag` start
  // conditions can fire even though day 28 itself never produces those
  // tags.
  const newDefinitions = pickArcsToStart({
    ctx,
    monthlySlice,
    cooldowns,
    seenCalendarTags: slice.monthlyCalendarTagsSeen,
  })
  for (const def of newDefinitions) {
    const instance = createArcInstance({ definition: def, today })
    addArcToWorld(ctx, instance)
    ctx.addHistory({
      category: 'monthly',
      summary: `Local arc started: ${instance.label}.`,
      tags: ['monthly', 'local_arc', 'start', def.id],
      relatedActors: [],
      relatedLocations: [],
      relatedSystems: ['monthly', 'local_arcs'],
      mechanicalRefs: [instance.id],
    })
    ctx.addMemory({
      id: `local_arc_started:${def.id}`,
      source: `${SOURCE}.${def.id}`,
      actors: [{ kind: 'local_event', id: instance.id }],
      metadata: { arcId: instance.id },
    })
  }

  // 3. Apply effects from every currently-active arc (post-progress
  // and post-seed). New arcs at `seeded` stage have no active effects
  // yet; only `rising / active / climax` arcs apply mechanical nudges.
  for (const arc of listActiveArcs(ctx.state)) {
    if (!localArcRegistry.has(arc.definitionId)) continue
    const def = localArcRegistry.get(arc.definitionId)
    const appliedKeys: string[] = []
    for (const effect of def.effects) {
      const application = applyArcEffect({ ctx, arc, definition: def, effect })
      appliedKeys.push(application.effectKey)
      recentlyApplied.push(makeAppliedEffectRecord({ application, day: today }))
    }
    // Refresh the arc's `activeEffects` snapshot to reflect what was
    // applied this tick.
    if (!arraysEqual(arc.activeEffects ?? [], appliedKeys)) {
      updateArcRecord(
        ctx,
        arc.id,
        { activeEffects: appliedKeys },
        'apply_effects',
      )
    }
  }

  // 4. Refresh aggregated tag bundles to reflect the new world state.
  const bundles = collectArcTagBundles(ctx.state)

  writeSlice(
    ctx,
    {
      lastMonthlyTickDay: today,
      cooldowns,
      recentlyAppliedEffects: recentlyApplied,
      // Reset the running tag history after the seeding pass has read
      // it, so the next month accumulates from scratch.
      monthlyCalendarTagsSeen: [],
      ...bundles,
    },
    'monthly_tick',
  )
}

// ---------- Reports ----------

function buildReport(ctx: SimContext) {
  return buildLocalArcsReport(ctx)
}

// ---------- Validation ----------

function validateLocalArcs(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const event of Object.values(ctx.state.world.localEvents)) {
    if (event.stage === undefined) continue // Not an arc record.
    if (!localArcRegistry.has(event.definitionId)) {
      issues.push({
        path: `world.localEvents.${event.id}.definitionId`,
        message: `Unknown local arc definition '${event.definitionId}'`,
        code: 'unknown_local_arc_definition',
      })
    }
    if (
      event.stage !== undefined &&
      !isActiveArcStage(event.stage) &&
      !isTerminalArcStage(event.stage) &&
      event.stage !== 'seeded'
    ) {
      issues.push({
        path: `world.localEvents.${event.id}.stage`,
        message: `Unknown local arc stage '${event.stage}'`,
        code: 'unknown_local_arc_stage',
      })
    }
  }
  return issues
}

// ---------- Schema ----------

const LocalArcEffectSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('pressure_delta'),
    id: z.string(),
    amount: z.number(),
    tags: z.array(z.string()).optional(),
  }),
  z.object({
    kind: z.literal('market_condition'),
    id: z.string(),
    tags: z.array(z.string()).optional(),
  }),
  z.object({
    kind: z.literal('customer_group_modifier'),
    id: z.string(),
    tags: z.array(z.string()).optional(),
  }),
  z.object({
    kind: z.literal('supplier_modifier'),
    id: z.string(),
    tags: z.array(z.string()).optional(),
  }),
  z.object({
    kind: z.literal('calendar_tag'),
    id: z.string(),
    tags: z.array(z.string()).optional(),
  }),
  z.object({
    kind: z.literal('issue_seed_tag'),
    id: z.string(),
    tags: z.array(z.string()).optional(),
  }),
  z.object({
    kind: z.literal('reputation_signal'),
    id: z.string(),
    amount: z.number(),
    tags: z.array(z.string()).optional(),
  }),
])

const LocalArcStageSchema = z.enum([
  'seeded',
  'rising',
  'active',
  'climax',
  'resolved',
  'failed',
])

const LocalArcsAppliedEffectRecordSchema = z.object({
  arcId: z.string(),
  day: z.number().int().min(0),
  effect: LocalArcEffectSchema,
  appliedAtStage: LocalArcStageSchema,
})

const LocalArcsModuleStateSchema = z.object({
  lastMonthlyTickDay: z.number().int().min(0),
  activeArcIds: z.array(z.string()),
  activeArcTags: z.array(z.string()),
  activeIssueSeedTags: z.array(z.string()),
  activeMarketConditionIds: z.array(z.string()),
  cooldowns: z.record(z.string(), z.number().int().min(0)),
  recentlyAppliedEffects: z.array(LocalArcsAppliedEffectRecordSchema),
  monthlyCalendarTagsSeen: z.array(z.string()),
})

export const localArcsModule: SimulationModule = {
  id: LOCAL_ARCS_MODULE_ID,
  version: '0.1.0',
  // Arcs read the monthly module's `currentModifier` and (eventually)
  // its accumulator-driven outputs. Running after the monthly module
  // keeps Phase 35 §35.5's "after the existing monthly resolution but
  // before report generation" contract.
  dependsOn: [MONTHLY_MODULE_ID],
  hooks: {
    localEventUpdate: [localEventUpdateHook],
    endMonth: [endMonthHook],
  },
  buildReport,
  validate: validateLocalArcs,
  stateSchema: LocalArcsModuleStateSchema,
}

export {
  LOCAL_ARCS_MODULE_ID,
  createInitialLocalArcsModuleState,
  getLocalArcsModuleState,
}
