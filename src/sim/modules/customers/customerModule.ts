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
import { resolveGroupPurchases } from './purchases'
import { applySatisfactionUpdate } from './satisfaction'
import { applyCustomerImpact } from './impact'
import type {
  CustomerForecast,
  CustomerModuleState,
  CustomerTurnout,
} from './types'
import type {
  ServiceQualityModifiers,
  StaffModuleState,
} from '../staff/types'
import type { StaffState, TavernState } from '../../state/TavernState'

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

const REQUIRED_CUSTOMER_GROUP_IDS = [
  'local_goblins',
  'miners',
  'merchants',
  'ogres',
  'adventurers',
] as const

export function createInitialCustomerModuleState(): CustomerModuleState {
  return { forecasts: [], turnouts: [] }
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
  ctx.modifyModuleState<CustomerModuleState>(
    CUSTOMERS_MODULE_ID,
    () => createInitialCustomerModuleState(),
    { source: SOURCE, reason: 'day_initialize' },
  )
}

const forecastHook: SimulationHook = (ctx: SimContext): void => {
  const forecasts = forecastTraffic(ctx)
  setForecasts(ctx, forecasts)
}

function readServiceQuality(
  state: TavernState,
): ServiceQualityModifiers | undefined {
  const slice = state.modules['staff'] as StaffModuleState | undefined
  return slice?.serviceQuality
}

function findCook(state: TavernState): StaffState | undefined {
  for (const member of Object.values(state.staff)) {
    if (member.role === 'cook') return member
  }
  return undefined
}

function effectivenessSnapshot(staff: StaffState): number {
  // Mirror `getStaffEffectiveness` without importing the staff module —
  // keeps the customer/staff coupling at the data layer only.
  const raw =
    staff.skill +
    Math.round(staff.morale * 0.2) -
    Math.round(staff.stress * 0.25) -
    Math.round(staff.fatigue * 0.25)
  return Math.max(0, Math.min(100, Math.round(raw)))
}

function cookStretchFactor(state: TavernState): number {
  const cook = findCook(state)
  if (!cook) return 1
  if (cook.currentPriority !== 'stretch_ingredients') return 1
  const eff = effectivenessSnapshot(cook)
  // ~20% reduction at average effectiveness; ~35% at very high; floor 50%.
  const reduction = 0.2 + 0.15 * (eff / 100)
  return Math.max(0.5, 1 - reduction)
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
  const variation = ctx.rng.int(-1, 1)
  const speedBoost = quality
    ? Math.round(quality.serviceSpeed * (loyalty / 80))
    : 0
  return Math.max(0, base + variation + speedBoost)
}

const serviceHook: SimulationHook = (ctx: SimContext): void => {
  const moduleState = getCustomerModuleState(ctx.state)
  const turnouts: CustomerTurnout[] = []
  const serviceQuality = readServiceQuality(ctx.state)
  const stretchFactor = cookStretchFactor(ctx.state)

  for (const forecast of moduleState.forecasts) {
    const group = ctx.state.customerGroups[forecast.groupId]
    if (!group) continue
    const visitors = turnoutVisitorsFromForecast(
      forecast,
      serviceQuality,
      group.loyalty,
      ctx,
    )
    const turnout: CustomerTurnout = {
      groupId: group.id,
      visitors,
      coinEarned: 0,
      satisfactionChange: 0,
      shortages: [],
      notes: [],
    }

    if (visitors > 0) {
      const purchase = resolveGroupPurchases(ctx, group, visitors, {
        ...(serviceQuality ? { serviceQuality } : {}),
        stretchFactor,
      })
      turnout.coinEarned = purchase.coinEarned
      turnout.shortages = purchase.shortages
      if (purchase.itemsBought.length > 0) {
        const summary = purchase.itemsBought
          .map((b) => `${b.quantity}× ${b.stockId}`)
          .join(', ')
        turnout.notes.push(`Bought: ${summary}.`)
      }
      applyCustomerImpact(
        ctx,
        group,
        turnout,
        serviceQuality ? { serviceQuality } : {},
      )
    }

    turnouts.push(turnout)
  }

  setTurnouts(ctx, turnouts)
}

function readIncidents(
  state: TavernState,
): ReadonlyArray<{ actorGroup?: string; id: string }> {
  const slice = state.modules['service'] as
    | { result?: { incidents?: ReadonlyArray<{ actorGroup?: string; id: string }> } }
    | undefined
  return slice?.result?.incidents ?? []
}

const afterServiceHook: SimulationHook = (ctx: SimContext): void => {
  const moduleState = getCustomerModuleState(ctx.state)
  const updatedTurnouts: CustomerTurnout[] = []
  const serviceQuality = readServiceQuality(ctx.state)
  const incidents = readIncidents(ctx.state)
  for (const turnout of moduleState.turnouts) {
    const group = ctx.state.customerGroups[turnout.groupId]
    if (!group) {
      updatedTurnouts.push(turnout)
      continue
    }
    applySatisfactionUpdate(ctx, group, turnout, {
      ...(serviceQuality ? { serviceQuality } : {}),
      incidents,
    })
    updatedTurnouts.push(turnout)
  }
  setTurnouts(ctx, updatedTurnouts)
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
})

const CustomerModuleStateSchema: z.ZodType<CustomerModuleState> = z.object({
  forecasts: z.array(CustomerForecastSchema),
  turnouts: z.array(CustomerTurnoutSchema),
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
export { resolveGroupPurchases } from './purchases'
export { applySatisfactionUpdate } from './satisfaction'
export { applyCustomerImpact } from './impact'
