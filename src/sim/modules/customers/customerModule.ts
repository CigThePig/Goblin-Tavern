import { z } from 'zod'

import type { SimulationModule, SimulationHook } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'
import type { CustomerGroupState } from '../../state/TavernState'

import {
  customerRegistry,
  ensureRequiredCustomerGroupsRegistered,
} from '../../registries/customerRegistry'

import { forecastTraffic } from './forecast'
import { applySatisfactionUpdate } from './satisfaction'
import type {
  CustomerDemand,
  CustomerForecast,
  CustomerModuleState,
  CustomerTurnout,
} from './types'
import type {
  ServiceQualityModifiers,
  StaffModuleState,
} from '../staff/types'
import type { StaffState, TavernState } from '../../state/TavernState'
import { isTavernTemporarilyClosed } from '../economy/dynamics'

// Phase 10 §10.2 — Customer module.
//
// Responsibilities:
//   - Confirm the five required customer groups exist at the start of
//     each day (mirrors Phase 8/9 startDay verification).
//   - Reset the per-day forecast and turnout lists on `startDay`.
//   - Forecast traffic on the `forecastTraffic` phase using Phase 4 RNG.
//   - Resolve turnout and customer purchases on `service`, routing all
//     stock/coin/area mutations through the Phase 7 §7.3.1 helpers and
//     the Phase 9 §9.4 sale helpers.
//   - Apply satisfaction updates on `afterService`.
//   - Build the customer report on `generateReports`.

export const CUSTOMERS_MODULE_ID = 'customers'

const SOURCE = 'customers'

// Phase 187 / ISSUE-154 — the single shared satisfaction threshold below
// which a group counts as "dissatisfied". The complaint generator's
// candidate filter and the `lowSatisfactionStreak` maintenance below both
// read this constant so the two can never drift apart.
export const COMPLAINT_THRESHOLD = 60

const REQUIRED_CUSTOMER_GROUP_IDS = [
  'local_goblins',
  'miners',
  'merchants',
  'ogres',
  'adventurers',
] as const

export function createInitialCustomerModuleState(): CustomerModuleState {
  return { forecasts: [], turnouts: [], demand: [], lowSatisfactionStreak: {} }
}

/**
 * Expansion Phase 4 — the service module's flow outcome, read through the
 * slice.
 *
 * Read rather than imported so the dependency stays one-directional: the
 * customers module publishes demand and reads back what happened to it; the
 * service module never reaches into the customers slice to write.
 */
function readFlowOutcome(state: TavernState):
  | {
      seatedByGroup: Record<string, number>
      servedByGroup: Record<string, number>
      abandonedByGroup: Record<string, number>
      coinByGroup: Record<string, number>
      tabByGroup: Record<string, number>
      shortagesByGroup: Record<string, CustomerTurnout['shortages']>
    }
  | undefined {
  const slice = state.modules['service'] as
    | {
        result?: {
          flow?: {
            ran?: boolean
            seatedByGroup?: Record<string, number>
            servedByGroup?: Record<string, number>
            abandonedByGroup?: Record<string, number>
            coinByGroup?: Record<string, number>
            tabByGroup?: Record<string, number>
            shortagesByGroup?: Record<string, CustomerTurnout['shortages']>
          }
        }
      }
    | undefined
  const flow = slice?.result?.flow
  if (!flow?.ran) return undefined
  return {
    seatedByGroup: flow.seatedByGroup ?? {},
    servedByGroup: flow.servedByGroup ?? {},
    abandonedByGroup: flow.abandonedByGroup ?? {},
    coinByGroup: flow.coinByGroup ?? {},
    tabByGroup: flow.tabByGroup ?? {},
    shortagesByGroup: flow.shortagesByGroup ?? {},
  }
}

export function getCustomerModuleState(
  state: { modules: Record<string, unknown> },
): CustomerModuleState {
  const slice = state.modules[CUSTOMERS_MODULE_ID] as
    | CustomerModuleState
    | undefined
  if (!slice) return createInitialCustomerModuleState()
  return slice
}

function setForecasts(ctx: SimContext, forecasts: CustomerForecast[]): void {
  ctx.modifyModuleState<CustomerModuleState>(
    CUSTOMERS_MODULE_ID,
    (current) => {
      const base = current ?? createInitialCustomerModuleState()
      return { ...base, forecasts }
    },
    { source: SOURCE, reason: 'forecast_traffic' },
  )
}

function setTurnouts(ctx: SimContext, turnouts: CustomerTurnout[]): void {
  ctx.modifyModuleState<CustomerModuleState>(
    CUSTOMERS_MODULE_ID,
    (current) => {
      const base = current ?? createInitialCustomerModuleState()
      return { ...base, turnouts }
    },
    { source: SOURCE, reason: 'service_turnout' },
  )
}

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  ensureRequiredCustomerGroupsRegistered()
  for (const id of REQUIRED_CUSTOMER_GROUP_IDS) {
    if (!ctx.state.customerGroups[id]) {
      throw new Error(
        `customers module: required customer group '${id}' is missing from state`,
      )
    }
  }
  // Reset the per-day forecast/turnout lists. The customers module owns
  // the `state.modules.customers` slice; the engine routes the write
  // through `ctx.modifyModuleState` so the cause-required mutation
  // contract holds (Phase 7 §7.3.1).
  //
  // Phase 187 / ISSUE-154 — `lowSatisfactionStreak` is a persistence
  // counter, not a per-day list, so it survives the daily reset; only
  // the forecast/turnout scratch lists clear here.
  ctx.modifyModuleState<CustomerModuleState>(
    CUSTOMERS_MODULE_ID,
    (current) => ({
      ...createInitialCustomerModuleState(),
      lowSatisfactionStreak: current?.lowSatisfactionStreak ?? {},
    }),
    { source: SOURCE, reason: 'day_initialize' },
  )
}

// Phase 72 / ISSUE-032 §4.7, §5.6 — Niche customer threshold
// evaluation. Runs before `forecastTraffic` so the activation flip
// is reflected in the same day's forecast.
const NICHE_ACTIVATION_FLOOR = 18
const NICHE_DEACTIVATION_HYSTERESIS = 5
const NICHE_DAILY_DECAY = 2

function evaluateNicheThresholds(ctx: SimContext): void {
  const renown = ctx.state.reputation.culinary_renown
  for (const group of Object.values(ctx.state.customerGroups)) {
    const threshold = group.minRenownThreshold
    if (typeof threshold !== 'number' || threshold <= 0) continue

    // Activation: threshold crossed and patronage at 0 → ramp.
    if (renown >= threshold && group.patronage <= 0) {
      ctx.modifyCustomerGroup(
        group.id,
        { patronage: NICHE_ACTIVATION_FLOOR },
        {
          source: 'customers.niche_activation',
          sourceType: 'customer',
          direction: 'increase',
          readable: `${group.label} started visiting (renown ${renown} >= ${threshold}).`,
          tags: ['niche', 'activation', group.id],
          relatedActors: [{ kind: 'customer_group', id: group.id }],
          relatedSystems: ['customers'],
        },
      )
      ctx.addMemory({
        id: 'niche_visitor_arrived',
        source: 'customers.niche',
        actors: [{ kind: 'customer_group', id: group.id }],
        tags: ['niche', 'arrival', group.id],
        metadata: {
          groupId: group.id,
          groupLabel: group.label,
          renownAtArrival: renown,
          threshold,
        },
      })
      continue
    }
    // Deactivation hysteresis: renown well below threshold AND
    // patronage positive → decay by NICHE_DAILY_DECAY toward 0.
    if (
      renown < threshold - NICHE_DEACTIVATION_HYSTERESIS &&
      group.patronage > 0
    ) {
      const next = Math.max(0, group.patronage - NICHE_DAILY_DECAY)
      if (next !== group.patronage) {
        ctx.modifyCustomerGroup(
          group.id,
          { patronage: next },
          {
            source: 'customers.niche_decay',
            sourceType: 'customer',
            direction: 'decrease',
            amount: next - group.patronage,
            readable: `${group.label} losing interest as renown falls below threshold.`,
            tags: ['niche', 'decay', group.id],
            relatedActors: [{ kind: 'customer_group', id: group.id }],
            relatedSystems: ['customers'],
          },
        )
      }
    }
  }
}

const forecastHook: SimulationHook = (ctx: SimContext): void => {
  // Threshold evaluation runs first so the same-day forecast sees
  // newly-activated niche groups.
  evaluateNicheThresholds(ctx)
  const forecasts = forecastTraffic(ctx)
  setForecasts(ctx, forecasts)
}

function readServiceQuality(
  state: TavernState,
): ServiceQualityModifiers | undefined {
  const slice = state.modules['staff'] as StaffModuleState | undefined
  return slice?.serviceQuality
}

function turnoutVisitorsFromForecast(
  forecast: CustomerForecast,
  quality: ServiceQualityModifiers | undefined,
  loyalty: number,
  ctx: SimContext,
): number {
  // Phase 12 §12.2 — Actual turnout adds a small deterministic
  // variation on top of the forecast. The Phase 10 forecast already
  // includes a ±2 jitter; the +/-1 here is a second tiny shake that
  // models "did the regulars show up tonight?". Service speed nudges
  // visitor counts upward when staff can absorb more flow.
  const base = Math.max(0, Math.round(forecast.expected))
  // Phase 72 / ISSUE-032 §4.7 — when the forecast resolved to zero
  // visitors (e.g. an inactive niche group), the turnout stays at
  // zero. Without this short-circuit, the daily jitter and speed
  // boost could pull phantom visitors for groups that explicitly
  // shouldn't show up.
  if (base <= 0) return 0
  const variation = ctx.rng.int(-1, 1)
  const speedBoost = quality
    ? Math.round(quality.serviceSpeed * (loyalty / 80))
    : 0
  return Math.max(0, base + variation + speedBoost)
}

// Expansion Phase 4 §4.1 — this hook publishes DEMAND and stops there.
//
// It used to do the whole night in one pass: roll a turnout, multiply it by a
// fixed basket, sell the result, and dirty the main room. Everything after the
// headcount now belongs to the service module's flow, because only the flow
// knows whether these people ever got a seat. What stays here is the question
// the customers module is the authority on: who set out for the tavern tonight.
const serviceHook: SimulationHook = (ctx: SimContext): void => {
  // Expansion Phase 5 review — forecasts describe who might visit if the
  // doors open; they are not actual turnout. Owner actions can close the
  // tavern after forecastTraffic but before service, so clear the customer-
  // owned demand/turnout rows here. Areas and service both consume these
  // rows later in the same phase sequence and must see zero real traffic.
  if (isTavernTemporarilyClosed(ctx.state)) {
    ctx.modifyModuleState<CustomerModuleState>(
      CUSTOMERS_MODULE_ID,
      (current) => ({
        ...(current ?? createInitialCustomerModuleState()),
        demand: [],
        turnouts: [],
      }),
      { source: SOURCE, reason: 'service_closed' },
    )
    return
  }

  const moduleState = getCustomerModuleState(ctx.state)
  const turnouts: CustomerTurnout[] = []
  const demand: CustomerDemand[] = []
  const serviceQuality = readServiceQuality(ctx.state)

  for (const forecast of moduleState.forecasts) {
    const group = ctx.state.customerGroups[forecast.groupId]
    if (!group) continue
    const visitors = turnoutVisitorsFromForecast(
      forecast,
      serviceQuality,
      group.loyalty,
      ctx,
    )
    demand.push({ groupId: group.id, patrons: visitors, notes: [] })
    turnouts.push({
      groupId: group.id,
      visitors,
      coinEarned: 0,
      satisfactionChange: 0,
      shortages: [],
      notes: [],
      seated: 0,
      served: 0,
      abandoned: 0,
      unpaidTab: 0,
    })
  }

  ctx.modifyModuleState<CustomerModuleState>(
    CUSTOMERS_MODULE_ID,
    (current) => ({
      ...(current ?? createInitialCustomerModuleState()),
      demand,
      turnouts,
    }),
    { source: SOURCE, reason: 'service_demand' },
  )
}

function readIncidents(
  state: TavernState,
): ReadonlyArray<{ actorGroup?: string; id: string }> {
  const slice = state.modules['service'] as
    | { result?: { incidents?: ReadonlyArray<{ actorGroup?: string; id: string }> } }
    | undefined
  return slice?.result?.incidents ?? []
}

/**
 * Expansion Phase 4 — fold the service flow's outcome back into each group's
 * own record, then judge the night.
 *
 * The customers module still owns satisfaction; what changed is that it now has
 * the truth to judge on. "Sixty people came" and "sixty people were fed" used
 * to be the same statement, so a night where half the room walked out looked
 * identical to a night where everybody was served.
 */
const afterServiceHook: SimulationHook = (ctx: SimContext): void => {
  const moduleState = getCustomerModuleState(ctx.state)
  const updatedTurnouts: CustomerTurnout[] = []
  const serviceQuality = readServiceQuality(ctx.state)
  const incidents = readIncidents(ctx.state)
  const flow = readFlowOutcome(ctx.state)
  for (const turnout of moduleState.turnouts) {
    const group = ctx.state.customerGroups[turnout.groupId]
    if (!group) {
      updatedTurnouts.push(turnout)
      continue
    }
    if (flow) {
      turnout.seated = flow.seatedByGroup[group.id] ?? 0
      turnout.served = flow.servedByGroup[group.id] ?? 0
      turnout.abandoned = flow.abandonedByGroup[group.id] ?? 0
      turnout.coinEarned = flow.coinByGroup[group.id] ?? 0
      turnout.unpaidTab = flow.tabByGroup[group.id] ?? 0
      turnout.shortages = flow.shortagesByGroup[group.id] ?? []
      if ((turnout.abandoned ?? 0) > 0) {
        turnout.notes.push(
          `${turnout.abandoned} left without being served.`,
        )
      }
    }
    applySatisfactionUpdate(ctx, group, turnout, {
      ...(serviceQuality ? { serviceQuality } : {}),
      incidents,
    })
    updatedTurnouts.push(turnout)
  }
  setTurnouts(ctx, updatedTurnouts)

  // Phase 187 / ISSUE-154 — maintain the per-group low-satisfaction
  // streak from the end-of-service satisfaction (after the updates above
  // are applied to `ctx.state.customerGroups`). A group that ends a
  // service at or below the shared threshold extends its streak; a group
  // that recovers above it resets to 0. Only groups that were actually
  // evaluated this service (i.e. had a turnout) move.
  const priorStreak = getCustomerModuleState(ctx.state).lowSatisfactionStreak
  const nextStreak: Record<string, number> = { ...priorStreak }
  for (const turnout of updatedTurnouts) {
    const group = ctx.state.customerGroups[turnout.groupId]
    if (!group) continue
    if (group.satisfaction <= COMPLAINT_THRESHOLD) {
      nextStreak[group.id] = (nextStreak[group.id] ?? 0) + 1
    } else {
      nextStreak[group.id] = 0
    }
  }
  ctx.modifyModuleState<CustomerModuleState>(
    CUSTOMERS_MODULE_ID,
    (current) => ({
      ...(current ?? createInitialCustomerModuleState()),
      lowSatisfactionStreak: nextStreak,
    }),
    { source: SOURCE, reason: 'low_satisfaction_streak' },
  )
}

function describeGroupLine(
  group: CustomerGroupState,
  turnout: CustomerTurnout | undefined,
  forecast: CustomerForecast | undefined,
): string[] {
  const lines: string[] = []
  lines.push(group.label)
  const traffic = turnout?.visitors ?? 0
  lines.push(`  Traffic: ${traffic}`)
  if (forecast && forecast.expected !== traffic) {
    lines.push(`  Forecast: ${forecast.expected}`)
  }
  const prior = group.satisfaction - (turnout?.satisfactionChange ?? 0)
  lines.push(`  Satisfaction: ${prior} → ${group.satisfaction}`)
  if (turnout?.coinEarned) {
    lines.push(`  Coin earned: ${turnout.coinEarned}`)
  }
  if (turnout && turnout.shortages.length > 0) {
    const ids = turnout.shortages.map((s) => s.stockId).join(', ')
    lines.push(`  Shortages: ${ids}`)
  }
  const notes = [
    ...(forecast?.notes ?? []),
    ...(turnout?.notes ?? []),
  ]
  if (notes.length > 0) {
    lines.push(`  Notes: ${notes.join(' ')}`)
  }
  return lines
}

function buildCustomerReport(ctx: SimContext): ReportSection {
  const moduleState = getCustomerModuleState(ctx.state)
  const groups = Object.values(ctx.state.customerGroups)
  const lines: string[] = []

  let topGroup: { id: string; visitors: number } | undefined
  let worstGroup: { id: string; satisfactionChange: number } | undefined

  for (const group of groups) {
    const turnout = moduleState.turnouts.find((t) => t.groupId === group.id)
    const forecast = moduleState.forecasts.find((f) => f.groupId === group.id)
    lines.push(...describeGroupLine(group, turnout, forecast))
    if (turnout) {
      if (!topGroup || turnout.visitors > topGroup.visitors) {
        topGroup = { id: group.id, visitors: turnout.visitors }
      }
      if (
        turnout.satisfactionChange < 0 &&
        (!worstGroup || turnout.satisfactionChange < worstGroup.satisfactionChange)
      ) {
        worstGroup = {
          id: group.id,
          satisfactionChange: turnout.satisfactionChange,
        }
      }
    }
  }

  if (topGroup) {
    lines.push('')
    lines.push(`Top group: ${topGroup.id} (${topGroup.visitors})`)
  }
  if (worstGroup) {
    lines.push(`Worst group: ${worstGroup.id} (${worstGroup.satisfactionChange})`)
  }

  return {
    id: 'customers',
    source: SOURCE,
    title: 'CUSTOMER REPORT',
    lines,
    data: {
      forecasts: moduleState.forecasts.map((f) => ({ ...f })),
      turnouts: moduleState.turnouts.map((t) => ({
        ...t,
        shortages: t.shortages.map((s) => ({ ...s })),
        notes: [...t.notes],
      })),
      topGroupId: topGroup?.id,
      worstGroupId: worstGroup?.id,
    },
  }
}

function validateCustomers(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const id of REQUIRED_CUSTOMER_GROUP_IDS) {
    if (!ctx.state.customerGroups[id]) {
      issues.push({
        path: `customerGroups.${id}`,
        message: `Required customer group '${id}' is missing`,
        code: 'missing_required_customer_group',
      })
    }
  }
  return issues
}

// Phase 6 §6.1.1 — schema for `state.modules.customers`.
const ShortageRecordSchema = z.object({
  stockId: z.string(),
  requested: z.number().min(0),
  available: z.number().min(0),
  day: z.number().int().min(1),
  reason: z.string(),
})

const CustomerForecastSchema = z.object({
  groupId: z.string(),
  expected: z.number().min(0),
  dayTypeModifier: z.number(),
  satisfactionModifier: z.number(),
  cleanlinessPenalty: z.number().min(0),
  pricePenalty: z.number().min(0),
  stockModifier: z.number(),
  notes: z.array(z.string()),
})

const CustomerTurnoutSchema = z.object({
  groupId: z.string(),
  visitors: z.number().min(0),
  coinEarned: z.number(),
  satisfactionChange: z.number(),
  shortages: z.array(ShortageRecordSchema),
  notes: z.array(z.string()),
  // Expansion Phase 4 §4.1 — `.default(0)` so a turnout written before the
  // flow existed parses forward; the `afterService` pass fills them every day
  // now.
  seated: z.number().min(0).default(0),
  served: z.number().min(0).default(0),
  abandoned: z.number().min(0).default(0),
  unpaidTab: z.number().min(0).default(0),
})

// Expansion Phase 4 §4.1 — tonight's demand, published for the service flow.
const CustomerDemandSchema = z.object({
  groupId: z.string(),
  patrons: z.number().min(0),
  notes: z.array(z.string()),
})

const CustomerModuleStateSchema: z.ZodType<CustomerModuleState> = z.object({
  forecasts: z.array(CustomerForecastSchema),
  turnouts: z.array(CustomerTurnoutSchema),
  // `.default([])` lets a pre-Phase-4 slice validate forward; the service
  // hook rewrites it every day.
  demand: z.array(CustomerDemandSchema).default([]),
  // Phase 187 / ISSUE-154 — per-group low-satisfaction streak counter.
  // `.default({})` lets saves predating this field validate forward
  // (additive migration) without a dedicated ensure-slice helper.
  lowSatisfactionStreak: z
    .record(z.string(), z.number().int().min(0))
    .default({}),
})

export const customersModule: SimulationModule = {
  id: CUSTOMERS_MODULE_ID,
  version: '0.1.0',
  // Phase 10 customers buy from stock and shape areas; declare those
  // dependencies so the engine sorts customers after both modules.
  dependsOn: ['stock', 'areas'],
  hooks: {
    startDay: [startDayHook],
    forecastTraffic: [forecastHook],
    service: [serviceHook],
    afterService: [afterServiceHook],
  },
  buildReport: buildCustomerReport,
  validate: validateCustomers,
  stateSchema: CustomerModuleStateSchema,
}

export { customerRegistry, ensureRequiredCustomerGroupsRegistered }
export { forecastTraffic, forecastTrafficForGroup } from './forecast'
export { applySatisfactionUpdate } from './satisfaction'
