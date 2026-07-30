import { z } from 'zod'

import type { SimContext } from '../../core/context'
import { clampPercent } from '../../state/normalize'
import { registerScheduledEvent } from '../../contracts/scheduledEvents/registry'
import type {
  ScheduledEventDefinition,
  ScheduledEventRecord,
  ScheduledEventResolution,
} from '../../contracts/scheduledEvents/types'
import { getAreaUpgradeDefinition } from '../../content/tavern/areaUpgradeRegistry'

import { completeUpgrade, damageUpgrade, resumeUpgrade } from './construction'

// Expansion Phase 2 §2.2 + Phase 1 §1.1 — three future-hook families move
// from narrative to mechanical.
//
// Phase 1 built the typed scheduled-event machinery and honestly reclassified
// every existing future hook as a `narrative_expectation`: tracked, warned,
// expiring, countable — and mechanically inert. The arc's plan is that each
// later phase claims the families its own domain can now deliver on.
//
// Phase 2 can deliver on three, because it now owns construction, fittings and
// area condition as real state:
//
//   failed_patch_possible          "the cheap patch you chose may fail later"
//   area_collapse_risk_<areaId>    "you ignored the area problem; it may give way"
//   area_project_completion_<areaId>
//                                  "the area project you paid for will finish"
//
// Each resolver performs an authoritative mutation on a real record, and each
// has a genuine no-op branch with a mandatory reason — because a player who
// actually fixed the room afterwards should be told the promise lapsed for a
// good reason, not silently punished.
//
// Three families in the ledger stay narrative, recorded rather than fudged:
//   * `area_failure_possible` is declared at SEED level, and seed-level hooks
//     never reach `routeFutureHook` (only profile-level ones do), so there is
//     no emission path to claim. Routing seed-level hooks belongs to the
//     issue-seed refit in Phase 11.
//   * `cellar_capacity_unlocked_*` is emitted by the monthly review and would
//     have to install a fitting nobody paid for; the honest version needs the
//     monthly domain, which Phase 5 owns.
//   * `main_room_too_dark` comes from a test-expansion fixture, not shipped
//     content.

const AREAS_MODULE_ID = 'areas'

export const FAILED_PATCH_EVENT = 'failed_patch_possible'
export const AREA_COLLAPSE_RISK_EVENT = 'area_collapse_risk'
export const AREA_PROJECT_COMPLETION_EVENT = 'area_project_completion'

// ---------- shared helpers ----------

const AreaPayloadSchema = z.object({ areaId: z.string() })
const PatchedAreaPayloadSchema = z.object({
  /** No area id: the hook name carries none, so the resolver finds it from the
   *  memory the same response profile wrote. */
  scope: z.literal('patched_area'),
})

function noOp(reason: string, readable: string): ScheduledEventResolution {
  return { status: 'no_op', reason, readable }
}

/** Parse the `<prefix><areaId>` shape a parameterised hook family carries. */
function areaIdFromHookName(hookName: string, prefix: string): string | undefined {
  if (!hookName.startsWith(prefix)) return undefined
  const areaId = hookName.slice(prefix.length)
  return areaId.length > 0 ? areaId : undefined
}

/** Worsen an area's fabric, returning the mutations performed. */
function degradeArea(
  ctx: SimContext,
  areaId: string,
  args: {
    damage: number
    condition: number
    problem?: string
    source: string
    reason: string
    readable: string
  },
): Array<{ targetKind: string; targetId: string; field?: string; readable: string }> {
  const area = ctx.state.areas[areaId]
  if (!area) return []
  const mutations: Array<{
    targetKind: string
    targetId: string
    field?: string
    readable: string
  }> = []

  const damage = clampPercent(area.damage + args.damage)
  const condition = clampPercent(area.condition - args.condition)
  const problems =
    args.problem && !area.activeProblems.includes(args.problem)
      ? [...area.activeProblems, args.problem]
      : area.activeProblems

  const changes: Record<string, unknown> = {}
  if (damage !== area.damage) changes['damage'] = damage
  if (condition !== area.condition) changes['condition'] = condition
  if (problems !== area.activeProblems) changes['activeProblems'] = problems
  if (Object.keys(changes).length === 0) return mutations

  ctx.modifyArea(areaId, changes, {
    source: args.source,
    reason: args.reason,
    target: `area:${areaId}`,
    targetType: 'area',
    amount: damage - area.damage,
    readable: args.readable,
    tags: ['area', 'scheduled_event', args.reason, areaId],
    relatedLocations: [{ kind: 'area', id: areaId }],
    relatedSystems: ['areas'],
  })

  if (damage !== area.damage) {
    mutations.push({
      targetKind: 'area',
      targetId: areaId,
      field: 'damage',
      readable: `${area.label} damage ${area.damage} → ${damage}.`,
    })
  }
  if (condition !== area.condition) {
    mutations.push({
      targetKind: 'area',
      targetId: areaId,
      field: 'condition',
      readable: `${area.label} condition ${area.condition} → ${condition}.`,
    })
  }
  if (problems !== area.activeProblems && args.problem) {
    mutations.push({
      targetKind: 'area',
      targetId: areaId,
      field: 'activeProblems',
      readable: `${area.label} now carries '${args.problem}'.`,
    })
  }
  return mutations
}

/** The installed fitting in an area with the lowest condition, if any. */
function weakestInstalledFitting(
  ctx: SimContext,
  areaId: string,
): string | undefined {
  const area = ctx.state.areas[areaId]
  if (!area) return undefined
  return Object.values(area.upgrades)
    .filter((u) => u.status === 'installed')
    .sort(
      (a, b) => (a.condition ?? 100) - (b.condition ?? 100) || a.id.localeCompare(b.id),
    )[0]?.id
}

// ---------- failed_patch_possible ----------

/**
 * Which area was patched?
 *
 * The `patch` response profile writes a `<areaId>_patched_recently` memory
 * tagged with the area id, so the evidence is already in state. The resolver
 * reads it rather than guessing — which is the same discipline §1.1 asks of
 * the bridge, applied one step later.
 */
function findPatchedArea(ctx: SimContext): string | undefined {
  const candidates = ctx
    .getMemoriesByTag('patch')
    .flatMap((memory) => memory.tags.filter((tag) => ctx.state.areas[tag]))
  if (candidates.length === 0) return undefined
  // Most damaged among the patched rooms: if two were patched, the one still
  // in trouble is the one whose patch is failing.
  return candidates.sort(
    (a, b) =>
      (ctx.state.areas[b]?.damage ?? 0) - (ctx.state.areas[a]?.damage ?? 0) ||
      a.localeCompare(b),
  )[0]
}

const failedPatchEvent: ScheduledEventDefinition = {
  type: FAILED_PATCH_EVENT,
  kind: 'mechanical',
  ownerModuleId: AREAS_MODULE_ID,
  label: 'Cheap patch fails',
  payloadSchema: PatchedAreaPayloadSchema,
  // A patch failing is a consequence OF the days since the choice, so it fires
  // at `wrap_up` with the day's own repairs already counted.
  beat: 'wrap_up',
  defaultOffsetDays: 7,
  warningWindowDays: 2,
  expiryDays: 7,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, scheduledForDay }) => `${type}:${scheduledForDay}`,
  fromFutureHook: ({ hookName }) =>
    hookName === FAILED_PATCH_EVENT
      ? { payload: { scope: 'patched_area' as const } }
      : undefined,
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = PatchedAreaPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload was not a patched-area promise', record.origin.readable)
    }
    const areaId = findPatchedArea(ctx)
    if (!areaId) {
      return noOp(
        'no patched area is on record any more',
        'Whatever was patched is no longer identifiable.',
      )
    }
    const area = ctx.state.areas[areaId]!

    // The player who went back and did the job properly earns the lapse.
    if (area.damage <= 25 && area.condition >= 60) {
      return noOp(
        `${area.label} was properly repaired after the patch (damage ${area.damage}, condition ${area.condition})`,
        `The patch on ${area.label} held — the room was put right in the meantime.`,
      )
    }

    const readable = `The cheap patch on ${area.label} gave way.`
    const mutations = degradeArea(ctx, areaId, {
      damage: 8,
      condition: 4,
      problem: 'failed_patch',
      source: 'areas.failed_patch',
      reason: 'failed_patch',
      readable,
    })
    if (mutations.length === 0) {
      return noOp(
        `${area.label} is already at its worst on every fabric meter`,
        `The patch on ${area.label} gave way, but the room could get no worse.`,
      )
    }

    return {
      status: 'resolved',
      mutations,
      readable,
      cause: {
        source: 'areas.failed_patch',
        sourceType: 'area',
        target: `area:${areaId}.damage`,
        targetType: 'area',
        amount: 8,
        readable,
        tags: ['area', 'maintenance', 'failed_patch', areaId],
        relatedLocations: [{ kind: 'area', id: areaId }],
        relatedSystems: ['areas'],
      },
      history: {
        category: 'state_change',
        summary: readable,
        tags: ['area', 'maintenance', 'failed_patch', areaId],
        relatedLocations: [{ kind: 'area', id: areaId }],
        relatedSystems: ['areas'],
        mechanicalRefs: [areaId, FAILED_PATCH_EVENT],
      },
    }
  },
}

// ---------- area_collapse_risk_<areaId> ----------

const areaCollapseRiskEvent: ScheduledEventDefinition = {
  type: AREA_COLLAPSE_RISK_EVENT,
  kind: 'mechanical',
  ownerModuleId: AREAS_MODULE_ID,
  label: 'Neglected area gives way',
  payloadSchema: AreaPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 7,
  warningWindowDays: 3,
  expiryDays: 7,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = AreaPayloadSchema.safeParse(payload)
    const areaId = parsed.success ? parsed.data.areaId : 'unknown'
    return `${type}:${areaId}:${scheduledForDay}`
  },
  futureHookPrefixes: ['area_collapse_risk_'],
  fromFutureHook: ({ hookName }) => {
    const areaId = areaIdFromHookName(hookName, 'area_collapse_risk_')
    if (!areaId) return undefined
    return { payload: { areaId }, target: { kind: 'area', id: areaId } }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = AreaPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload did not name an area', record.origin.readable)
    }
    const area = ctx.state.areas[parsed.data.areaId]
    if (!area) {
      return noOp(
        `area '${parsed.data.areaId}' is no longer part of the tavern`,
        record.origin.readable,
      )
    }

    if (area.condition >= 45 && area.damage <= 40) {
      return noOp(
        `${area.label} was brought back into repair (condition ${area.condition}, damage ${area.damage})`,
        `${area.label} was seen to in time — nothing gave way.`,
      )
    }

    const readable = `Neglect caught up with ${area.label}: something gave way.`
    const mutations = degradeArea(ctx, area.id, {
      damage: 10,
      condition: 6,
      problem: 'structural_failure',
      source: 'areas.collapse_risk',
      reason: 'area_collapse',
      readable,
    })

    // A structural failure takes a fitting with it. This is the second
    // authoritative mutation, and it is what makes the damage → disabled →
    // repair loop reachable without the player having to be unlucky.
    const fitting = weakestInstalledFitting(ctx, area.id)
    if (fitting) {
      const def = getAreaUpgradeDefinition(fitting)
      const broke = damageUpgrade(
        ctx,
        area.id,
        fitting,
        45,
        'area_collapse_damaged_fitting',
        `${def?.label ?? fitting} was wrecked when ${area.label} gave way.`,
      )
      if (broke) {
        mutations.push({
          targetKind: 'area_upgrade',
          targetId: `${area.id}:${fitting}`,
          field: 'condition',
          readable: `${def?.label ?? fitting} was wrecked.`,
        })
      }
    }

    if (mutations.length === 0) {
      return noOp(
        `${area.label} is already at its worst and holds no fittings to lose`,
        `${area.label} could get no worse than it already is.`,
      )
    }

    return {
      status: 'resolved',
      mutations,
      readable,
      cause: {
        source: 'areas.collapse_risk',
        sourceType: 'area',
        target: `area:${area.id}.condition`,
        targetType: 'area',
        amount: -6,
        readable,
        tags: ['area', 'maintenance', 'collapse', area.id],
        relatedLocations: [{ kind: 'area', id: area.id }],
        relatedSystems: ['areas'],
      },
      history: {
        category: 'state_change',
        summary: readable,
        tags: ['area', 'maintenance', 'collapse', area.id],
        relatedLocations: [{ kind: 'area', id: area.id }],
        relatedSystems: ['areas'],
        mechanicalRefs: [area.id, AREA_COLLAPSE_RISK_EVENT],
      },
    }
  },
}

// ---------- area_project_completion_<areaId> ----------

const areaProjectCompletionEvent: ScheduledEventDefinition = {
  type: AREA_PROJECT_COMPLETION_EVENT,
  kind: 'mechanical',
  ownerModuleId: AREAS_MODULE_ID,
  label: 'Area project completes',
  payloadSchema: AreaPayloadSchema,
  // A completion is something the player should find waiting for them, so it
  // lands in the morning they can act on it.
  beat: 'morning',
  defaultOffsetDays: 7,
  warningWindowDays: 2,
  expiryDays: 7,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = AreaPayloadSchema.safeParse(payload)
    const areaId = parsed.success ? parsed.data.areaId : 'unknown'
    return `${type}:${areaId}:${scheduledForDay}`
  },
  futureHookPrefixes: ['area_project_completion_'],
  fromFutureHook: ({ hookName }) => {
    const areaId = areaIdFromHookName(hookName, 'area_project_completion_')
    if (!areaId) return undefined
    return { payload: { areaId }, target: { kind: 'area', id: areaId } }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = AreaPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload did not name an area', record.origin.readable)
    }
    const area = ctx.state.areas[parsed.data.areaId]
    if (!area) {
      return noOp(
        `area '${parsed.data.areaId}' is no longer part of the tavern`,
        record.origin.readable,
      )
    }

    // Nothing is invented here: the promise is honoured against work the
    // player actually has on the books in that room.
    const live = Object.values(area.upgrades)
      .filter((u) => u.status === 'in_progress')
      .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0) || a.id.localeCompare(b.id))[0]
    if (live) {
      const def = getAreaUpgradeDefinition(live.id)
      const readable = `The work on ${def?.label ?? live.id} in ${area.label} came good.`
      completeUpgrade(ctx, area.id, live.id, AREA_PROJECT_COMPLETION_EVENT)
      return {
        status: 'resolved',
        mutations: [
          {
            targetKind: 'area_upgrade',
            targetId: `${area.id}:${live.id}`,
            field: 'status',
            readable: `${def?.label ?? live.id} is installed in ${area.label}.`,
          },
        ],
        readable,
        cause: {
          source: 'areas.project_completion',
          sourceType: 'area',
          target: `area:${area.id}.upgrades.${live.id}`,
          targetType: 'area',
          amount: 1,
          readable,
          tags: ['area', 'upgrade', 'completed', area.id, live.id],
          relatedLocations: [{ kind: 'area', id: area.id }],
          relatedSystems: ['areas'],
        },
        history: {
          category: 'owner_action',
          summary: readable,
          tags: ['area', 'upgrade', 'completed', area.id, live.id],
          relatedLocations: [{ kind: 'area', id: area.id }],
          relatedSystems: ['areas'],
          mechanicalRefs: [area.id, live.id],
        },
      }
    }

    const paused = Object.values(area.upgrades)
      .filter((u) => u.status === 'paused')
      .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0) || a.id.localeCompare(b.id))[0]
    if (paused) {
      const def = getAreaUpgradeDefinition(paused.id)
      const readable = `The crew came back to ${def?.label ?? paused.id} in ${area.label}.`
      resumeUpgrade(ctx, area.id, paused.id)
      return {
        status: 'resolved',
        mutations: [
          {
            targetKind: 'area_upgrade',
            targetId: `${area.id}:${paused.id}`,
            field: 'status',
            readable: `${def?.label ?? paused.id} is being built again.`,
          },
        ],
        readable,
      }
    }

    return noOp(
      `no project is open in ${area.label}`,
      `Nothing was left running in ${area.label} for the crew to finish.`,
    )
  },
}

let registered = false

/**
 * Register the areas module's mechanical event types.
 *
 * Idempotent, and called at module import like every other `ensureRequired*`
 * bootstrap, because the response bridge has to be able to find these types
 * the first time a hook is routed — which can happen before any area code runs.
 */
export function ensureAreaScheduledEventsRegistered(): void {
  if (registered) return
  registerScheduledEvent(failedPatchEvent)
  registerScheduledEvent(areaCollapseRiskEvent)
  registerScheduledEvent(areaProjectCompletionEvent)
  registered = true
}

ensureAreaScheduledEventsRegistered()

export const AREA_SCHEDULED_EVENT_TYPES = [
  FAILED_PATCH_EVENT,
  AREA_COLLAPSE_RISK_EVENT,
  AREA_PROJECT_COMPLETION_EVENT,
] as const
