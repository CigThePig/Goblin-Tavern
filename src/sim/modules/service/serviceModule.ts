import { z } from 'zod'

import type { SimulationModule, SimulationHook } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'

import {
  applyStaffStressFatigue,
  buildEmptyResult,
  findDayDrivers,
  resolveService,
} from './resolveService'
import type { ResolveServiceInputs } from './resolveService'
import { buildServiceScenes } from './serviceScenes'
import type {
  AreaChangeSummary,
  CustomerSatisfactionChange,
  DailyServiceResult,
  PurchaseSummary,
  ServiceIncidentSummary,
  ServiceModuleState,
  ServiceScene,
  StaffChangeSummary,
} from './types'

// Phase 12 — Daily service module.
//
// Responsibilities:
//   - Run the daily service resolver (`resolveService`) during the
//     `service` phase, *after* the customers module has produced
//     per-group turnouts (visitor counts). The resolver coordinates
//     purchases, area mess/damage, unpaid tabs, and structured
//     incidents.
//   - Run staff stress/fatigue adjustments during `afterService`,
//     after the customers module has applied per-group satisfaction
//     updates (Phase 7 phase ordering keeps the customer-facing pass
//     in front of the staff-facing pass).
//   - Build the DAILY SERVICE REPORT during `generateReports`.
//
// All mutations route through Phase 7 §7.3.1 helpers (`ctx.modifyArea`,
// `ctx.modifyStock`, `ctx.modifyStaff`, `ctx.modifyCustomerGroup`,
// `ctx.modifyCoin`, `ctx.modifyModuleState`). Phase 12 §"Do Not Do"
// — no cards, no prose, no issue seeds; reports are structured only.

export const SERVICE_MODULE_ID = 'service'
const SOURCE = SERVICE_MODULE_ID

export function createInitialServiceModuleState(): ServiceModuleState {
  return {
    result: {
      dayKey: '0-0-0',
      trafficByGroup: {},
      purchasesByGroup: {},
      coinEarned: 0,
      unpaidTabs: 0,
      netCoinEarned: 0,
      stockConsumed: [],
      shortages: [],
      messCreated: [],
      damageCreated: [],
      satisfactionChanges: [],
      staffChanges: [],
      incidents: [],
      serviceQuality: {
        foodQualityModifier: 0,
        serviceSpeed: 0,
        tabControl: 0,
        messControl: 0,
        fightControl: 0,
        repairSupport: 0,
        staffSummaries: [],
      },
      // Phase 32 §32.1 — scene array always seeded.
      scenes: [],
    },
  }
}

export function getServiceModuleState(state: {
  modules: Record<string, unknown>
}): ServiceModuleState {
  const slice = state.modules[SERVICE_MODULE_ID] as
    | ServiceModuleState
    | undefined
  if (!slice) return createInitialServiceModuleState()
  return slice
}

function writeResult(
  ctx: SimContext,
  result: DailyServiceResult,
  reason: string,
): void {
  ctx.modifyModuleState<ServiceModuleState>(
    SERVICE_MODULE_ID,
    (current) => {
      const base = current ?? { result }
      return { ...base, result }
    },
    { source: SOURCE, reason },
  )
}

// ---------- Hooks ----------

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  // Reset the per-day service slice so reports and downstream callers
  // never read stale data from yesterday.
  ctx.modifyModuleState<ServiceModuleState>(
    SERVICE_MODULE_ID,
    () => ({ result: buildEmptyResult(ctx.state) }),
    { source: SOURCE, reason: 'day_initialize' },
  )
}

// Phase 12 §12.5 — snapshots used to compute area/stock deltas. The
// resolver needs the *pre-customer-impact* values; we snapshot during
// `beforeService` and stash them on a closure-scoped variable since
// the resolver is invoked from the next phase but inside the same
// engine run. (Per Phase 7 the engine processes phases sequentially
// within a single `simulateDay` call, so a module-local closure is
// safe — no parallel days in flight.)
let snapshot: ResolveServiceInputs | undefined

const beforeServiceHook: SimulationHook = (ctx: SimContext): void => {
  const areasBefore: Record<string, typeof ctx.state.areas[string]> = {}
  for (const [id, area] of Object.entries(ctx.state.areas)) {
    areasBefore[id] = { ...area }
  }
  const stockBefore: Record<string, { quantity: number }> = {}
  for (const [id, item] of Object.entries(ctx.state.stock)) {
    stockBefore[id] = { quantity: item.quantity }
  }
  snapshot = { areasBefore, stockBefore }
}

const serviceHook: SimulationHook = (ctx: SimContext): void => {
  const inputs: ResolveServiceInputs = snapshot ?? {
    areasBefore: { ...ctx.state.areas },
    stockBefore: Object.fromEntries(
      Object.entries(ctx.state.stock).map(([id, item]) => [
        id,
        { quantity: item.quantity },
      ]),
    ),
  }
  const result = resolveService(ctx, inputs)
  writeResult(ctx, result, 'service_resolved')
  snapshot = undefined
}

const afterServiceHook: SimulationHook = (ctx: SimContext): void => {
  const current = getServiceModuleState(ctx.state).result
  const staffChanges = applyStaffStressFatigue(ctx, current)
  const next: DailyServiceResult = { ...current, staffChanges }

  // Phase 12 §12.8 — pick up the satisfaction changes produced by the
  // customers module (the customer module owns the actual mutation;
  // we only mirror the deltas for the service report).
  const satisfactionChanges = collectSatisfactionChanges(ctx)
  next.satisfactionChanges = satisfactionChanges

  // Phase 32 §32.4 — build structured scenes from the resolved result.
  // The builder is pure: it only reads state. Memories/history emitted
  // below are derived from the selected scenes plus the existing
  // incident/shortage records (Phase 16 §16.3).
  const scenes = buildServiceScenes({
    ctx,
    resultBeforeScenes: next,
    satisfactionChanges,
  })
  next.scenes = scenes

  writeResult(ctx, next, 'after_service')

  // Phase 16 §16.3 — fold today's incidents and shortages into
  // memories. The memory module never decides *what* happened — it
  // just records the events each system already produced.
  emitServiceMemories(ctx, next, satisfactionChanges)
  // Phase 32 §32.5 — scene-driven memories and history. Only the
  // scenes that should influence future days are mirrored as memories;
  // a structural history entry is always emitted so audit trails can
  // pick up every scene that ran.
  emitSceneMemoriesAndHistory(ctx, scenes)
}

function emitServiceMemories(
  ctx: SimContext,
  result: DailyServiceResult,
  satisfactionChanges: CustomerSatisfactionChange[],
): void {
  // Brawls → `recent_brawl`. A single major brawl is enough to drop
  // the memory; stacking strength means multiple brawls in a window
  // compound.
  const brawl = result.incidents.find((i) => i.id === 'minor_brawl')
  if (brawl) {
    const owner = brawl.actorGroup
      ? ({ kind: 'customer_group', id: brawl.actorGroup } as const)
      : ({ kind: 'tavern_identity', id: ctx.state.meta.tavernId } as const)
    ctx.addEntityMemory(
      owner,
      {
        id: 'recent_brawl',
        source: SOURCE,
        metadata: { severity: brawl.severity, actorGroup: brawl.actorGroup },
        ...(brawl.areaId
          ? { locations: [{ kind: 'area', id: brawl.areaId }] }
          : {}),
      },
      brawl.areaId
        ? { subjects: [{ kind: 'area', id: brawl.areaId }] }
        : undefined,
    )
    ctx.addHistory({
      category: 'service',
      summary: `Brawl during service (severity ${brawl.severity}).`,
      tags: ['service', 'incident', 'brawl'],
      relatedSystems: ['service'],
      mechanicalRefs: ['minor_brawl'],
      ...(brawl.actorGroup
        ? { relatedActors: [{ kind: 'customer_group' as const, id: brawl.actorGroup }] }
        : {}),
      ...(brawl.areaId
        ? { relatedLocations: [{ kind: 'area' as const, id: brawl.areaId }] }
        : {}),
    })
  }

  // Shortages by stock id → `ale_shortage_recently` / `stew_shortage_recently`.
  const shortageStocks = new Set<string>()
  for (const shortage of result.shortages) shortageStocks.add(shortage.stockId)
  if (shortageStocks.has('ale')) {
    ctx.addMemory({
      id: 'ale_shortage_recently',
      source: SOURCE,
    })
  }
  if (shortageStocks.has('stew')) {
    ctx.addMemory({
      id: 'stew_shortage_recently',
      source: SOURCE,
    })
  }

  // Merchant satisfaction drop → `merchants_unhappy_recently`.
  const merchantChange = satisfactionChanges.find((s) => s.groupId === 'merchants')
  if (merchantChange && merchantChange.delta <= -2) {
    ctx.addMemory({
      id: 'merchants_unhappy_recently',
      source: SOURCE,
      actors: [{ kind: 'customer_group', id: 'merchants' }],
      metadata: { delta: merchantChange.delta, after: merchantChange.after },
    })
  }
}

function emitSceneMemoriesAndHistory(
  ctx: SimContext,
  scenes: ReadonlyArray<ServiceScene>,
): void {
  for (const scene of scenes) {
    // Phase 32 §32.5 — history is always emitted so the audit trail has
    // a structured pointer at the scene. Memories are emitted only when
    // the scene type should influence future days.
    const relatedActors: typeof scene.involvedEntityRefs = scene.involvedEntityRefs.filter(
      (ref) =>
        ref.kind === 'staff' ||
        ref.kind === 'regular' ||
        ref.kind === 'customer_group' ||
        ref.kind === 'supplier' ||
        ref.kind === 'faction' ||
        ref.kind === 'notable_npc',
    )
    const relatedLocations: typeof scene.involvedEntityRefs = scene.involvedEntityRefs.filter(
      (ref) => ref.kind === 'area',
    )
    ctx.addHistory({
      category: 'service',
      summary: sceneHistorySummary(scene),
      tags: ['service', 'scene', scene.sceneType, ...scene.tags],
      relatedActors,
      relatedLocations,
      relatedSystems: ['service'],
      mechanicalRefs: [scene.id],
    })

    if (scene.sceneType === 'regular_complaint' && scene.regularIds.length > 0) {
      ctx.addMemory({
        id: 'regular_complained_recently',
        source: SOURCE,
        actors: scene.involvedEntityRefs.filter(
          (r) => r.kind === 'regular' || r.kind === 'customer_group',
        ),
        metadata: {
          sceneId: scene.id,
          severity: scene.numericSeverity,
          topic: scene.textIngredients.complaintTopic ?? null,
        },
      })
    }

    if (
      scene.sceneType === 'staff_moment' &&
      scene.staffIds.length > 0 &&
      scene.tags.includes('strained')
    ) {
      const staffActors = scene.involvedEntityRefs.filter((r) => r.kind === 'staff')
      ctx.addMemory({
        id: 'staff_snapped_recently',
        source: SOURCE,
        actors: staffActors,
        metadata: {
          sceneId: scene.id,
          severity: scene.numericSeverity,
          stressResponse: scene.textIngredients.stressResponse ?? null,
        },
      })
    }

    if (scene.sceneType === 'area_problem_noticed' && scene.areaId) {
      ctx.addMemory({
        id: 'area_problem_publicly_noticed',
        source: SOURCE,
        locations: [{ kind: 'area', id: scene.areaId }],
        actors: scene.involvedEntityRefs.filter((r) => r.kind === 'customer_group'),
        metadata: {
          sceneId: scene.id,
          severity: scene.numericSeverity,
          trait: scene.textIngredients.trait ?? null,
        },
      })
    }
  }
}

function sceneHistorySummary(scene: ServiceScene): string {
  switch (scene.sceneType) {
    case 'regular_complaint': {
      const regular = scene.textIngredients.regularName ?? 'A regular'
      const topic = scene.textIngredients.complaintTopic ?? 'service'
      return `${regular} complained (${topic}).`
    }
    case 'stock_quality_complaint': {
      const stock = scene.textIngredients.stockId ?? 'stock'
      const group = scene.textIngredients.groupName ?? 'customers'
      return `${group} flagged quality of ${stock}.`
    }
    case 'area_problem_noticed': {
      const area = scene.textIngredients.areaLabel ?? scene.areaId ?? 'an area'
      return `Customers noticed a problem in ${area}.`
    }
    case 'unpaid_tab_argument': {
      return `Unpaid tabs caused friction (${scene.textIngredients.totalUnpaid ?? 0} coin).`
    }
    case 'brawl_aftermath': {
      return `Brawl aftermath in ${scene.areaId ?? 'the tavern'}.`
    }
    case 'staff_moment': {
      const staff = scene.textIngredients.staffName ?? 'A staff member'
      const tone = scene.textIngredients.tone ?? 'service'
      return `${staff} had a ${tone} moment.`
    }
    default:
      return `Service scene: ${scene.sceneType}.`
  }
}

function collectSatisfactionChanges(
  ctx: SimContext,
): CustomerSatisfactionChange[] {
  const customers = ctx.state.modules['customers'] as
    | { turnouts?: ReadonlyArray<{ groupId: string; satisfactionChange: number }> }
    | undefined
  if (!customers || !customers.turnouts) return []
  const out: CustomerSatisfactionChange[] = []
  for (const t of customers.turnouts) {
    const group = ctx.state.customerGroups[t.groupId]
    if (!group) continue
    const before = group.satisfaction - t.satisfactionChange
    out.push({
      groupId: t.groupId,
      before,
      after: group.satisfaction,
      delta: t.satisfactionChange,
      drivers: [],
    })
  }
  return out
}

// ---------- Reports ----------

function formatTrafficLines(result: DailyServiceResult): string[] {
  const entries = Object.entries(result.trafficByGroup)
  if (entries.length === 0) return ['  (no traffic)']
  const sorted = entries.sort((a, b) => b[1] - a[1])
  return sorted.map(([id, visitors]) => `  ${id}: ${visitors}`)
}

function bestSellingItem(result: DailyServiceResult): string | undefined {
  let best: { id: string; coin: number } | undefined
  for (const purchase of Object.values(result.purchasesByGroup)) {
    for (const line of purchase.itemsBought) {
      if (!best || line.coin > best.coin) {
        best = { id: line.stockId, coin: line.coin }
      }
    }
  }
  return best?.id
}

function buildDailyServiceReport(ctx: SimContext): ReportSection {
  const state = getServiceModuleState(ctx.state)
  const result = state.result
  const dayType = ctx.getDayType()
  const dayLabel = formatDayType(dayType)
  const lines: string[] = []
  lines.push(`Day: ${dayLabel}`)
  lines.push('')

  lines.push('Traffic:')
  lines.push(...formatTrafficLines(result))
  lines.push('')

  lines.push('Economy:')
  lines.push(`  Coin earned: ${result.coinEarned}`)
  lines.push(`  Unpaid tabs: ${result.unpaidTabs}`)
  lines.push(`  Net coin: ${result.netCoinEarned}`)
  const seller = bestSellingItem(result)
  if (seller) lines.push(`  Best seller: ${seller}`)
  lines.push('')

  lines.push('Stock:')
  if (result.stockConsumed.length === 0) {
    lines.push('  (no stock consumed)')
  } else {
    for (const entry of result.stockConsumed) {
      lines.push(`  ${entry.stockId}: -${entry.quantity}`)
    }
  }
  if (result.shortages.length > 0) {
    const ids = [...new Set(result.shortages.map((s) => s.stockId))]
    lines.push(`  Shortages: ${ids.join(', ')}`)
  }
  lines.push('')

  lines.push('Tavern Impact:')
  if (result.messCreated.length === 0 && result.damageCreated.length === 0) {
    lines.push('  (no area changes)')
  } else {
    for (const change of result.messCreated) {
      lines.push(formatAreaChange(change))
    }
    for (const change of result.damageCreated) {
      lines.push(formatAreaChange(change))
    }
  }
  lines.push('')

  lines.push('Staff:')
  if (result.staffChanges.length === 0) {
    lines.push('  (no staff changes)')
  } else {
    for (const change of result.staffChanges) {
      lines.push(formatStaffChange(change))
    }
  }
  lines.push('')

  lines.push('Customer Satisfaction:')
  if (result.satisfactionChanges.length === 0) {
    lines.push('  (no changes)')
  } else {
    for (const change of result.satisfactionChanges) {
      const sign = change.delta >= 0 ? '+' : ''
      lines.push(`  ${change.groupId}: ${sign}${change.delta}`)
    }
  }
  lines.push('')

  if (result.incidents.length > 0) {
    lines.push('Incidents:')
    for (const incident of result.incidents) {
      lines.push(formatIncident(incident))
    }
    lines.push('')
  }

  // Phase 32 §32.6 — compact scene subsection. Stays structured /
  // debug-readable; explicitly not prose.
  lines.push('Service Scenes:')
  if (result.scenes.length === 0) {
    lines.push('  (none)')
  } else {
    for (const scene of result.scenes) {
      lines.push(formatScene(scene))
    }
  }
  lines.push('')

  const drivers = findDayDrivers(result)
  if (drivers.positive) {
    lines.push(`Largest positive driver: ${drivers.positive}`)
  }
  if (drivers.negative) {
    lines.push(`Largest negative driver: ${drivers.negative}`)
  }

  return {
    id: 'service',
    source: SOURCE,
    title: `DAILY SERVICE REPORT — ${dayLabel}`,
    lines,
    data: {
      result: cloneResultForData(result),
      drivers,
    },
  }
}

function formatAreaChange(change: AreaChangeSummary): string {
  const sign = change.delta >= 0 ? '+' : ''
  return `  ${change.areaId}.${change.field} ${sign}${change.delta} (${change.reason})`
}

function formatStaffChange(change: StaffChangeSummary): string {
  const parts: string[] = []
  if (change.stressDelta !== 0) {
    parts.push(`stress ${formatSigned(change.stressDelta)}`)
  }
  if (change.fatigueDelta !== 0) {
    parts.push(`fatigue ${formatSigned(change.fatigueDelta)}`)
  }
  if (change.moraleDelta !== 0) {
    parts.push(`morale ${formatSigned(change.moraleDelta)}`)
  }
  const summary = parts.length > 0 ? parts.join(', ') : 'no change'
  return `  ${change.staffId}: ${summary}`
}

function formatSigned(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

function formatScene(scene: ServiceScene): string {
  const involved: string[] = []
  if (scene.regularIds.length > 0) {
    involved.push(`regulars=${scene.regularIds.join(',')}`)
  }
  if (scene.staffIds.length > 0) {
    involved.push(`staff=${scene.staffIds.join(',')}`)
  }
  if (scene.involvedGroupIds.length > 0) {
    involved.push(`groups=${scene.involvedGroupIds.join(',')}`)
  }
  if (scene.areaId) involved.push(`area=${scene.areaId}`)
  const tail = involved.length > 0 ? ` [${involved.join(' ')}]` : ''
  return `  ${scene.severity} ${scene.sceneType} (${scene.numericSeverity})${tail}`
}

function formatIncident(incident: ServiceIncidentSummary): string {
  const parts = [`severity ${incident.severity}`]
  if (incident.actorGroup) parts.push(`actor:${incident.actorGroup}`)
  if (incident.areaId) parts.push(`area:${incident.areaId}`)
  const tail = parts.join(' ')
  return `  ${incident.id} — ${tail}`
}

function formatDayType(dayType: string): string {
  return dayType
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function cloneResultForData(result: DailyServiceResult): DailyServiceResult {
  return {
    ...result,
    trafficByGroup: { ...result.trafficByGroup },
    purchasesByGroup: clonePurchasesByGroup(result.purchasesByGroup),
    stockConsumed: result.stockConsumed.map((s) => ({ ...s })),
    shortages: result.shortages.map((s) => ({ ...s })),
    messCreated: result.messCreated.map((c) => ({ ...c })),
    damageCreated: result.damageCreated.map((c) => ({ ...c })),
    satisfactionChanges: result.satisfactionChanges.map((s) => ({
      ...s,
      drivers: [...s.drivers],
    })),
    staffChanges: result.staffChanges.map((s) => ({
      ...s,
      notes: [...s.notes],
    })),
    incidents: result.incidents.map((i) => ({
      ...i,
      effects: [...i.effects],
    })),
    serviceQuality: {
      ...result.serviceQuality,
      staffSummaries: result.serviceQuality.staffSummaries.map((s) => ({
        ...s,
      })),
    },
    // Phase 32 §32.1 — deep-clone scenes so report `data` consumers
    // cannot mutate the live result.
    scenes: result.scenes.map((s) => ({
      ...s,
      involvedEntityRefs: s.involvedEntityRefs.map((r) => ({ ...r })),
      involvedGroupIds: [...s.involvedGroupIds],
      staffIds: [...s.staffIds],
      regularIds: [...s.regularIds],
      supplierIds: [...s.supplierIds],
      tags: [...s.tags],
      causes: [...s.causes],
      textIngredients: { ...s.textIngredients },
      possibleIssueSeedIds: [...s.possibleIssueSeedIds],
    })),
  }
}

function clonePurchasesByGroup(
  purchases: Record<string, PurchaseSummary>,
): Record<string, PurchaseSummary> {
  const out: Record<string, PurchaseSummary> = {}
  for (const [k, v] of Object.entries(purchases)) {
    out[k] = {
      ...v,
      itemsBought: v.itemsBought.map((i) => ({ ...i })),
      shortages: v.shortages.map((s) => ({ ...s })),
    }
  }
  return out
}

// ---------- Validation ----------

function validateService(_ctx: SimContext): ValidationIssue[] {
  // Phase 12 doesn't add structural invariants beyond what the state
  // schema already enforces. Returning an empty array keeps the contract
  // explicit ("validate ran, no issues") so future phases can wire in
  // richer checks.
  return []
}

// ---------- Module schema ----------

const PurchaseLineSchema = z.object({
  stockId: z.string(),
  quantity: z.number().min(0),
  coin: z.number(),
})

const ShortageRecordSchema = z.object({
  stockId: z.string(),
  requested: z.number().min(0),
  available: z.number().min(0),
  day: z.number().int().min(1),
  reason: z.string(),
})

const PurchaseSummarySchema = z.object({
  groupId: z.string(),
  visitors: z.number().min(0),
  coinEarned: z.number(),
  unpaidTabs: z.number().min(0),
  netCoin: z.number(),
  itemsBought: z.array(PurchaseLineSchema),
  shortages: z.array(ShortageRecordSchema),
})

const AreaChangeSchema = z.object({
  areaId: z.string(),
  field: z.enum(['mess', 'damage', 'cleanliness', 'smell', 'risk']),
  delta: z.number(),
  reason: z.string(),
})

const SatisfactionChangeSchema = z.object({
  groupId: z.string(),
  before: z.number(),
  after: z.number(),
  delta: z.number(),
  drivers: z.array(z.string()),
})

const StaffChangeSchema = z.object({
  staffId: z.string(),
  stressDelta: z.number(),
  fatigueDelta: z.number(),
  moraleDelta: z.number(),
  notes: z.array(z.string()),
})

const IncidentSchema = z.object({
  id: z.string(),
  severity: z.number().min(0).max(100),
  actorGroup: z.string().optional(),
  areaId: z.string().optional(),
  effects: z.array(z.string()),
})

const StaffEffectivenessSummarySchema = z.object({
  staffId: z.string(),
  roleId: z.string(),
  priorityId: z.string().optional(),
  effectiveness: z.number(),
  stressPenalty: z.number(),
  fatiguePenalty: z.number(),
  moraleBonus: z.number(),
  canWork: z.boolean(),
})

const ServiceQualitySchema = z.object({
  foodQualityModifier: z.number(),
  serviceSpeed: z.number(),
  tabControl: z.number(),
  messControl: z.number(),
  fightControl: z.number(),
  repairSupport: z.number(),
  staffSummaries: z.array(StaffEffectivenessSummarySchema),
})

// Phase 32 §32.1 — structured scene record. `textIngredients` is a
// JSON-safe map of primitives so the future card layer can read named
// values out without re-deriving them. `numericSeverity` is 0–100 to
// stay consistent with the existing incident severity meter.
const EntityRefSchema = z.object({
  kind: z.enum([
    'staff',
    'customer_group',
    'area',
    'stock',
    'role',
    'system',
    'other',
    'culture',
    'faction',
    'supplier',
    'regular',
    'notable_npc',
    'local_event',
    'rumour',
    'tavern_identity',
  ]),
  id: z.string(),
})

const ServiceSceneSchema = z.object({
  id: z.string(),
  sceneType: z.enum([
    'staff_customer_friction',
    'regular_complaint',
    'supplier_arrival_during_rush',
    'area_problem_noticed',
    'stock_quality_complaint',
    'cultural_seating_friction',
    'unpaid_tab_argument',
    'brawl_aftermath',
    'staff_moment',
  ]),
  severity: z.enum(['minor', 'moderate', 'major']),
  numericSeverity: z.number().min(0).max(100),
  areaId: z.string().optional(),
  involvedEntityRefs: z.array(EntityRefSchema),
  involvedGroupIds: z.array(z.string()),
  staffIds: z.array(z.string()),
  regularIds: z.array(z.string()),
  supplierIds: z.array(z.string()),
  tags: z.array(z.string()),
  causes: z.array(z.string()),
  textIngredients: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
  ),
  possibleIssueSeedIds: z.array(z.string()),
})

const DailyServiceResultSchema = z.object({
  dayKey: z.string(),
  trafficByGroup: z.record(z.string(), z.number().min(0)),
  purchasesByGroup: z.record(z.string(), PurchaseSummarySchema),
  coinEarned: z.number(),
  unpaidTabs: z.number().min(0),
  netCoinEarned: z.number(),
  stockConsumed: z.array(z.object({ stockId: z.string(), quantity: z.number().min(0) })),
  shortages: z.array(ShortageRecordSchema),
  messCreated: z.array(AreaChangeSchema),
  damageCreated: z.array(AreaChangeSchema),
  satisfactionChanges: z.array(SatisfactionChangeSchema),
  staffChanges: z.array(StaffChangeSchema),
  incidents: z.array(IncidentSchema),
  serviceQuality: ServiceQualitySchema,
  scenes: z.array(ServiceSceneSchema),
})

const ServiceModuleStateSchema = z.object({
  result: DailyServiceResultSchema,
})

export const serviceModule: SimulationModule = {
  id: SERVICE_MODULE_ID,
  version: '0.1.0',
  // Phase 12 §12.1 — depends on customers, staff, stock, areas. The
  // customers module produces per-group turnouts during `service`; the
  // staff module publishes the service-quality modifiers during
  // `beforeService`. The engine will sort hooks within a phase by
  // dependency so customers.service runs before service.service.
  dependsOn: ['customers', 'staff', 'stock', 'areas'],
  hooks: {
    startDay: [startDayHook],
    beforeService: [beforeServiceHook],
    service: [serviceHook],
    afterService: [afterServiceHook],
  },
  buildReport: buildDailyServiceReport,
  validate: validateService,
  stateSchema: ServiceModuleStateSchema,
}
