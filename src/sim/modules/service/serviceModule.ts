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
import type {
  AreaChangeSummary,
  CustomerSatisfactionChange,
  DailyServiceResult,
  PurchaseSummary,
  ServiceIncidentSummary,
  ServiceModuleState,
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
  writeResult(ctx, next, 'after_service')
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
