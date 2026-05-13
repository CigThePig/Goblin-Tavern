import { z } from 'zod'

import type { SimulationHook, SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'
import type {
  EntityRef,
  SocialRumourState,
  TavernState,
} from '../../state/TavernState'
import {
  CalendarStampSchema,
  EntityRefSchema,
} from '../../state/schemas'

import {
  ATTRIBUTION_MODULE_ID,
  getAttributionModuleState,
} from './attributionQueries'
import type {
  AttributionDraft,
  AttributionModuleState,
  AttributionState,
} from './attributionTypes'
import { evaluateAllRules } from './attributionRules'
import { buildAttributionReport } from './attributionReport'

// Phase 37 — Attribution module.
//
// Responsibilities:
//   - Reset the per-day generated list on `startDay`.
//   - Run attribution rules during `afterService`, `endWeek`, and on
//     `generateReports` so the most recent simulation truth (causes,
//     scenes, owner actions, completed projects, rumours) has had time
//     to settle into state.
//   - Dedupe attributions against existing entries and merge tags /
//     refresh strength when a duplicate fires.
//   - Age attributions on `endDay`, expiring weak / stale entries.
//   - Propagate strong, public attributions back into the entity memory
//     layer (Phase 36) and into causes / rumours so card-fuel queries can
//     reach them through any of those systems.
//   - Build the ATTRIBUTION REPORT during `generateReports`.

export { ATTRIBUTION_MODULE_ID } from './attributionQueries'
const SOURCE = ATTRIBUTION_MODULE_ID

export type { AttributionModuleState }

const DEFAULT_EXPIRY_DAYS = 14
const MIN_LIVE_STRENGTH = 5
const MEMORY_THRESHOLD = 60
const RUMOUR_THRESHOLD = 55
const CAUSE_THRESHOLD = 65
const STRENGTH_BUMP = 5
const STRENGTH_CAP = 100

function nextAttributionId(absoluteDay: number, suffix: number): string {
  return `attr-${absoluteDay}-${suffix}`
}

export function createInitialAttributionModuleState(): AttributionModuleState {
  return {
    attributions: [],
    generatedToday: [],
    lastUpdatedDay: -1,
    recentDistrustByRumour: {},
  }
}

function readSlice(state: TavernState): AttributionModuleState {
  const current = getAttributionModuleState(state)
  const defaults = createInitialAttributionModuleState()
  return current ? { ...defaults, ...current } : defaults
}

// Pre-`recentDistrustByRumour` slices (legacy saves, hand-built test
// fixtures) lack required fields. Layer defaults under the current slice
// so writes always emit a schema-complete shape.
function writeSlice(
  ctx: SimContext,
  patch: (current: AttributionModuleState) => AttributionModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<AttributionModuleState>(
    ATTRIBUTION_MODULE_ID,
    (current) => {
      const defaults = createInitialAttributionModuleState()
      const base: AttributionModuleState = current
        ? { ...defaults, ...current }
        : defaults
      return patch(base)
    },
    { source: SOURCE, reason },
  )
}

// ---------- Dedup / aging ----------

function attributionKey(a: {
  perceivedBy: EntityRef
  target: EntityRef
  attributionType: AttributionState['attributionType']
  sourceEventId?: string
  sourceCauseIds?: string[]
  tags: string[]
}): string {
  const causeKey =
    a.sourceCauseIds && a.sourceCauseIds.length > 0
      ? [...a.sourceCauseIds].sort().join(',')
      : (a.sourceEventId ?? '')
  const tagKey = [...a.tags].sort().join(',')
  return [
    a.perceivedBy.kind,
    a.perceivedBy.id,
    a.target.kind,
    a.target.id,
    a.attributionType,
    causeKey,
    tagKey,
  ].join('|')
}

function mergeStringList(
  a: ReadonlyArray<string> | undefined,
  b: ReadonlyArray<string> | undefined,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of a ?? []) {
    if (!seen.has(s)) {
      seen.add(s)
      out.push(s)
    }
  }
  for (const s of b ?? []) {
    if (!seen.has(s)) {
      seen.add(s)
      out.push(s)
    }
  }
  return out
}

function buildAttributionFromDraft(
  draft: AttributionDraft,
  state: TavernState,
  suffix: number,
): AttributionState {
  const stamp = {
    year: state.calendar.year,
    month: state.calendar.month,
    week: state.calendar.week,
    day: state.calendar.day,
    absoluteDay: state.calendar.totalDaysElapsed,
  }
  const id = nextAttributionId(stamp.absoluteDay, suffix)
  const attribution: AttributionState = {
    id,
    timestamp: stamp,
    sourceCauseIds: draft.sourceCauseIds ? [...draft.sourceCauseIds] : [],
    sourceMemoryIds: draft.sourceMemoryIds ? [...draft.sourceMemoryIds] : [],
    sourceSceneIds: draft.sourceSceneIds ? [...draft.sourceSceneIds] : [],
    perceivedBy: { ...draft.perceivedBy },
    target: { ...draft.target },
    attributionType: draft.attributionType,
    accuracy: draft.accuracy ?? 'true',
    strength: clampMeter(draft.strength ?? 40),
    confidence: clampMeter(draft.confidence ?? 50),
    publicness: clampMeter(draft.publicness ?? 30),
    volatility: clampMeter(draft.volatility ?? 30),
    readable: draft.readable,
    tags: draft.tags ? [...draft.tags] : [],
    relatedSystems: draft.relatedSystems ? [...draft.relatedSystems] : [],
    ageDays: 0,
    expiresAfterDays: draft.expiresAfterDays ?? DEFAULT_EXPIRY_DAYS,
  }
  if (draft.sourceEventId !== undefined) {
    attribution.sourceEventId = draft.sourceEventId
  }
  return attribution
}

function clampMeter(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 100) return 100
  return n
}

function applyDrafts(
  drafts: ReadonlyArray<AttributionDraft>,
  current: AttributionModuleState,
  state: TavernState,
): { next: AttributionModuleState; addedOrRefreshed: AttributionState[] } {
  const byKey = new Map<string, AttributionState>()
  for (const attribution of current.attributions) {
    byKey.set(attributionKey(attribution), attribution)
  }
  const generatedToday: string[] = [...current.generatedToday]
  const addedOrRefreshed: AttributionState[] = []
  // Determine the next id suffix from existing attributions on this day
  // so duplicate calls within a day stay deterministic.
  const today = state.calendar.totalDaysElapsed
  let suffix = 0
  for (const a of current.attributions) {
    if (a.timestamp.absoluteDay !== today) continue
    const parts = a.id.split('-')
    const tail = Number(parts[parts.length - 1])
    if (Number.isFinite(tail) && tail > suffix) suffix = tail
  }

  for (const draft of drafts) {
    const key = attributionKey({
      perceivedBy: draft.perceivedBy,
      target: draft.target,
      attributionType: draft.attributionType,
      tags: draft.tags ?? [],
      ...(draft.sourceEventId !== undefined
        ? { sourceEventId: draft.sourceEventId }
        : {}),
      ...(draft.sourceCauseIds !== undefined
        ? { sourceCauseIds: draft.sourceCauseIds }
        : {}),
    })
    const existing = byKey.get(key)
    if (existing) {
      const merged: AttributionState = {
        ...existing,
        strength: clampMeter(existing.strength + STRENGTH_BUMP),
        confidence: clampMeter(
          Math.max(existing.confidence, draft.confidence ?? existing.confidence),
        ),
        publicness: clampMeter(
          Math.max(existing.publicness, draft.publicness ?? existing.publicness),
        ),
        volatility: clampMeter(
          Math.max(existing.volatility, draft.volatility ?? existing.volatility),
        ),
        tags: mergeStringList(existing.tags, draft.tags),
        relatedSystems: mergeStringList(
          existing.relatedSystems,
          draft.relatedSystems,
        ),
        sourceCauseIds: mergeStringList(
          existing.sourceCauseIds,
          draft.sourceCauseIds,
        ),
        sourceMemoryIds: mergeStringList(
          existing.sourceMemoryIds,
          draft.sourceMemoryIds,
        ),
        sourceSceneIds: mergeStringList(
          existing.sourceSceneIds,
          draft.sourceSceneIds,
        ),
        ageDays: 0,
      }
      byKey.set(key, merged)
      if (!generatedToday.includes(merged.id)) {
        generatedToday.push(merged.id)
      }
      addedOrRefreshed.push(merged)
    } else {
      suffix += 1
      const built = buildAttributionFromDraft(draft, state, suffix)
      byKey.set(key, built)
      generatedToday.push(built.id)
      addedOrRefreshed.push(built)
    }
  }

  // Rumour-derived drafts carry a `rumour` tag plus a `sourceEventId`
  // identifying the rumour. Bake the cooldown update into draft
  // application so the side-effect happens alongside the persisted
  // attributions rather than during rule evaluation.
  const rumourCooldown: Record<string, number> = {
    ...(current.recentDistrustByRumour ?? {}),
  }
  for (const draft of drafts) {
    if (draft.sourceEventId === undefined) continue
    if (!(draft.tags ?? []).includes('rumour')) continue
    rumourCooldown[draft.sourceEventId] = today
  }

  const next: AttributionModuleState = {
    ...current,
    attributions: [...byKey.values()],
    generatedToday,
    lastUpdatedDay: state.calendar.totalDaysElapsed,
    recentDistrustByRumour: rumourCooldown,
  }
  return { next, addedOrRefreshed }
}

function ageAttributions(
  current: AttributionModuleState,
  daysElapsed: number,
): AttributionModuleState {
  if (daysElapsed <= 0) return current
  const next: AttributionState[] = []
  for (const attribution of current.attributions) {
    const aged = attribution.ageDays + daysElapsed
    let strength = attribution.strength
    if (attribution.confidence < 40) {
      strength = Math.max(0, strength - 2 * daysElapsed)
    }
    const expiry = attribution.expiresAfterDays ?? DEFAULT_EXPIRY_DAYS
    // High-publicness false attributions decay slowly until corrected.
    const isStickyFalse =
      attribution.accuracy === 'false' && attribution.publicness >= 60
    if (aged >= expiry && !isStickyFalse) continue
    if (strength < MIN_LIVE_STRENGTH && !isStickyFalse) continue
    next.push({ ...attribution, ageDays: aged, strength: clampMeter(strength) })
  }
  return { ...current, attributions: next }
}

// ---------- Propagation: memories, causes, rumours ----------

function propagateToMemories(
  ctx: SimContext,
  added: ReadonlyArray<AttributionState>,
): void {
  for (const attribution of added) {
    if (attribution.strength < MEMORY_THRESHOLD) continue
    if (attribution.publicness < 40) continue
    const memoryId = pickMemoryDefinition(attribution)
    if (!memoryId) continue
    const tags = mergeStringList(['attribution', attribution.attributionType], attribution.tags)
    try {
      ctx.addEntityMemory(
        attribution.perceivedBy,
        {
          id: memoryId,
          source: `${SOURCE}.${attribution.attributionType}`,
          tags,
          metadata: { attributionId: attribution.id },
        },
        {
          subjects: [attribution.target],
          ...(attribution.attributionType === 'blame' ||
          attribution.attributionType === 'resentment' ||
          attribution.attributionType === 'distrust'
            ? { blamed: [attribution.target] }
            : {}),
          ...(attribution.attributionType === 'credit' ||
          attribution.attributionType === 'gratitude' ||
          attribution.attributionType === 'trust'
            ? { credited: [attribution.target] }
            : {}),
        },
      )
    } catch {
      // The memory layer rejects unknown ids in some configurations;
      // attribution must remain best-effort and never crash the pipeline.
    }
  }
}

function pickMemoryDefinition(attribution: AttributionState): string | undefined {
  // Prefer specific definition ids when the surface area maps cleanly.
  const t = attribution.target.kind
  const a = attribution.attributionType
  if (t === 'supplier' && (a === 'blame' || a === 'resentment')) {
    return 'supplier_blamed_for_bad_stock'
  }
  if (t === 'staff' && a === 'blame') {
    return 'staff_publicly_blamed'
  }
  if (
    (t === 'tavern_identity' || t === 'system') &&
    (a === 'gratitude' || a === 'credit')
  ) {
    return 'regular_helped_by_owner'
  }
  if (t === 'tavern_identity' && a === 'blame') {
    return 'faction_publicly_insulted'
  }
  // Fall back to a generic synthesized id so the attribution can still
  // surface through the memory layer.
  return `attribution_${a}__${attribution.id}`
}

function propagateToCauses(
  ctx: SimContext,
  added: ReadonlyArray<AttributionState>,
): void {
  for (const attribution of added) {
    if (attribution.strength < CAUSE_THRESHOLD) continue
    const targetType = mapTargetTypeToCauseTarget(attribution.target.kind)
    if (!targetType) continue
    const sign = isPositive(attribution.attributionType) ? +1 : -1
    const amount = sign * Math.max(1, Math.round(attribution.strength / 10))
    ctx.addCause({
      source: `${SOURCE}.${attribution.attributionType}`,
      sourceType: 'memory',
      target: `${attribution.target.kind}:${attribution.target.id}.relationship`,
      targetType,
      amount,
      direction: sign > 0 ? 'increase' : 'decrease',
      readable: attribution.readable,
      tags: mergeStringList(['attribution'], attribution.tags),
      relatedActors: [
        { ...attribution.perceivedBy },
        { ...attribution.target },
      ],
    })
  }
}

function isPositive(t: AttributionState['attributionType']): boolean {
  return t === 'credit' || t === 'gratitude' || t === 'trust'
}

function mapTargetTypeToCauseTarget(
  kind: EntityRef['kind'],
):
  | 'supplier'
  | 'faction'
  | 'culture'
  | 'regular'
  | 'staff'
  | 'customer'
  | 'tavern_identity'
  | 'global'
  | undefined {
  switch (kind) {
    case 'supplier':
      return 'supplier'
    case 'faction':
      return 'faction'
    case 'culture':
      return 'culture'
    case 'regular':
      return 'regular'
    case 'staff':
      return 'staff'
    case 'customer_group':
      return 'customer'
    case 'tavern_identity':
      return 'tavern_identity'
    case 'system':
    case 'other':
      return 'global'
    default:
      return undefined
  }
}

function propagateToRumours(
  ctx: SimContext,
  added: ReadonlyArray<AttributionState>,
): void {
  for (const attribution of added) {
    if (attribution.publicness < RUMOUR_THRESHOLD) continue
    if (attribution.accuracy === 'true') continue
    const rumourId = `rumour_${attribution.attributionType}_${attribution.target.kind}_${attribution.target.id}`
    const existing = ctx.state.world.socialRumours[rumourId]
    if (existing) {
      const next: Partial<SocialRumourState> = {
        strength: clampMeter(existing.strength + Math.round(attribution.publicness / 10)),
        lastSpreadDay: ctx.state.calendar.totalDaysElapsed,
        accuracy:
          existing.accuracy === 'true' ? existing.accuracy : attribution.accuracy,
      }
      ctx.modifySocialRumour(rumourId, next, {
        source: `${SOURCE}.rumour_strengthened`,
        readable: `Rumour ${rumourId} strengthened by attribution.`,
        tags: ['attribution', 'rumour'],
      })
      continue
    }
    // Add a fresh rumour by writing the world record directly via the
    // social rumour mutation helper. Because `modifySocialRumour`
    // requires an existing id, we instead splice a new rumour into the
    // world container through the existing helper API: write an empty
    // shell first via direct world write.
    const rumour: SocialRumourState = {
      id: rumourId,
      label: `${attribution.attributionType} ${attribution.target.kind}:${attribution.target.id}`,
      strength: clampMeter(attribution.publicness),
      accuracy: attribution.accuracy,
      firstHeardDay: ctx.state.calendar.totalDaysElapsed,
      lastSpreadDay: ctx.state.calendar.totalDaysElapsed,
      tags: mergeStringList(['attribution'], attribution.tags),
      subject: { ...attribution.target },
      involvedRefs: [{ ...attribution.perceivedBy }, { ...attribution.target }],
    }
    seedRumour(ctx, rumour)
  }
}

function seedRumour(ctx: SimContext, rumour: SocialRumourState): void {
  // Rumour creation follows the same pattern as
  // `weekly/community.ts::persistRumour` and `regulars/regularModule.ts`:
  // there is no public "create rumour" context helper, so the new
  // record is spliced directly into the live `state.world.socialRumours`
  // container. The follow-up `addCause` call records the change so the
  // cause trail still attributes it.
  ctx.state.world.socialRumours[rumour.id] = rumour
  ctx.addCause({
    source: `${SOURCE}.rumour_seeded`,
    sourceType: 'memory',
    target: rumour.id,
    targetType: 'rumour',
    amount: rumour.strength,
    readable: `Attribution seeded rumour ${rumour.id}`,
    tags: ['attribution', 'rumour', 'new'],
    relatedSystems: ['rumour', 'attribution'],
  })
}

// ---------- Hooks ----------

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  writeSlice(
    ctx,
    (current) => ({
      ...current,
      generatedToday: [],
    }),
    'day_initialize',
  )
}

function runRulesAndApply(ctx: SimContext, reason: string): void {
  const drafts = evaluateAllRules(ctx)
  if (drafts.length === 0) {
    writeSlice(
      ctx,
      (current) => ({
        ...current,
        lastUpdatedDay: ctx.state.calendar.totalDaysElapsed,
      }),
      reason,
    )
    return
  }
  let addedOrRefreshed: AttributionState[] = []
  writeSlice(
    ctx,
    (current) => {
      const result = applyDrafts(drafts, current, ctx.state)
      addedOrRefreshed = result.addedOrRefreshed
      return result.next
    },
    reason,
  )
  propagateToMemories(ctx, addedOrRefreshed)
  propagateToCauses(ctx, addedOrRefreshed)
  propagateToRumours(ctx, addedOrRefreshed)
}

const afterServiceHook: SimulationHook = (ctx: SimContext): void => {
  runRulesAndApply(ctx, 'after_service_attribution_pass')
}

const endDayHook: SimulationHook = (ctx: SimContext): void => {
  writeSlice(ctx, (current) => ageAttributions(current, 1), 'aging')
}

const endWeekHook: SimulationHook = (ctx: SimContext): void => {
  runRulesAndApply(ctx, 'end_week_attribution_pass')
}

// ---------- Validation ----------

function validate(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const slice = readSlice(ctx.state)
  for (let i = 0; i < slice.attributions.length; i += 1) {
    const a = slice.attributions[i]!
    if (a.strength < 0 || a.strength > 100) {
      issues.push({
        path: `modules.${ATTRIBUTION_MODULE_ID}.attributions[${i}].strength`,
        message: `Attribution '${a.id}' strength out of range`,
        code: 'attribution_strength_oor',
      })
    }
    if (a.ageDays < 0) {
      issues.push({
        path: `modules.${ATTRIBUTION_MODULE_ID}.attributions[${i}].ageDays`,
        message: `Attribution '${a.id}' has negative age`,
        code: 'attribution_negative_age',
      })
    }
  }
  return issues
}

// ---------- Schema ----------

const AttributionTypeSchema = z.enum([
  'credit',
  'blame',
  'suspicion',
  'gratitude',
  'resentment',
  'trust',
  'distrust',
])

const AttributionAccuracySchema = z.enum([
  'true',
  'partial',
  'false',
  'unknown',
])

const AttributionStateSchema = z.object({
  id: z.string(),
  timestamp: CalendarStampSchema,
  sourceEventId: z.string().optional(),
  sourceCauseIds: z.array(z.string()),
  sourceMemoryIds: z.array(z.string()),
  sourceSceneIds: z.array(z.string()),
  perceivedBy: EntityRefSchema,
  target: EntityRefSchema,
  attributionType: AttributionTypeSchema,
  accuracy: AttributionAccuracySchema,
  strength: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  publicness: z.number().min(0).max(100),
  volatility: z.number().min(0).max(100),
  readable: z.string(),
  tags: z.array(z.string()),
  relatedSystems: z.array(z.string()),
  ageDays: z.number().int().min(0),
  expiresAfterDays: z.number().int().min(0).optional(),
})

const AttributionModuleStateSchema = z.object({
  attributions: z.array(AttributionStateSchema),
  generatedToday: z.array(z.string()),
  lastUpdatedDay: z.number().int(),
  recentDistrustByRumour: z.record(z.string(), z.number().int().min(0)),
})

function buildReport(ctx: SimContext): ReportSection {
  return buildAttributionReport(ctx.state)
}

export const attributionModule: SimulationModule = {
  id: ATTRIBUTION_MODULE_ID,
  version: '0.1.0',
  hooks: {
    startDay: [startDayHook],
    afterService: [afterServiceHook],
    endDay: [endDayHook],
    endWeek: [endWeekHook],
  },
  buildReport,
  validate,
  stateSchema: AttributionModuleStateSchema,
}
