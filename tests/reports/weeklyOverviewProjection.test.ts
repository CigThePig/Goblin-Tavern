// Phase 90 — Tests for the weekly-overview projection.
//
// Drives the simulation end-to-end via `runCardlessSim` so the projection
// runs against real `TavernState` shapes — no hand-rolled fixtures. Per
// cards-contract §1, the simulation is the source of truth; tests prove
// the projection faithfully reads it and resolves entity ids to labels.

import { describe, expect, it } from 'vitest'

import { runCardlessSim } from '../../src/sim/testing/simRunner'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import { buildWeeklyOverview } from '../../src/reports/weeklyOverviewProjection'
import { getWeeklyModuleState } from '../../src/sim/modules/weekly/state'
import type { TavernState } from '../../src/sim/state/TavernState'
import {
  OBLIGATIONS_MODULE_ID,
  createInitialObligationsModuleState,
  openObligation,
  payObligation,
} from '../../src/sim/contracts/obligations/index'

const SEED_PREFIX = 'tests/reports/weeklyOverview'

function startingState(): TavernState {
  const base = withCoin(createInitialTavernState(), 5000)
  const withAle = withStock(base, 'ale', { quantity: 800, quality: 60 })
  const withStew = withStock(withAle, 'stew', { quantity: 400, quality: 60 })
  return withStock(withStew, 'mushrooms', { quantity: 200 })
}

function runDays(
  count: number,
  seedSuffix = '',
  initialState = startingState(),
): TavernState {
  const run = runCardlessSim({
    initialState,
    seed: `${SEED_PREFIX}.${seedSuffix}`,
    days: count,
  })
  return run.finalState
}

describe('buildWeeklyOverview — empty state', () => {
  it('reports no result on day 1 of week 1', () => {
    const state = startingState()
    const data = buildWeeklyOverview(state)
    expect(data.hasResult).toBe(false)
    expect(data.empty?.reason).toBe('no_week_yet')
    expect(data.empty?.message).toMatch(/first weekly summary/i)
    expect(data.header).toBeUndefined()
    expect(data.economy).toBeUndefined()
    expect(data.comparison).toBeUndefined()
  })

  it('reports no result on days 2–6 (no week has closed yet)', () => {
    const state = runDays(3, 'midweek1')
    const data = buildWeeklyOverview(state)
    expect(data.hasResult).toBe(false)
  })
})

describe('buildWeeklyOverview — single-week shape', () => {
  it('produces a well-formed view-model after 7 days', () => {
    const state = runDays(7, 'week1')
    const data = buildWeeklyOverview(state)

    expect(data.hasResult).toBe(true)
    expect(data.header?.weekNumber).toBe(1)
    expect(data.header?.monthNumber).toBe(1)
    expect(data.header?.yearNumber).toBe(1)
    expect(data.header?.endDay).toBe(7)
    expect(data.header?.daysSinceClose).toBe(0)

    expect(data.economy).toBeDefined()
    expect(typeof data.economy?.net).toBe('number')
    expect(typeof data.economy?.sales).toBe('number')
    expect(typeof data.economy?.wages).toBe('number')

    expect(data.wages).toBeDefined()
    expect(typeof data.wages?.totalDue).toBe('number')
    expect(typeof data.wages?.paid).toBe('boolean')
    expect(Array.isArray(data.wages?.unpaidStaff)).toBe(true)

    expect(data.signals).toBeDefined()
    expect(data.signals?.notes).toBeInstanceOf(Array)

    expect(data.customerGroups).toBeDefined()
    expect(Array.isArray(data.customerGroups?.rows)).toBe(true)

    expect(data.staff).toBeDefined()
    expect(Array.isArray(data.staff?.rows)).toBe(true)

    expect(data.maintenance).toBeDefined()
    expect(Array.isArray(data.maintenance?.rows)).toBe(true)

    expect(data.supplierInvoices).toBeDefined()
    expect(Array.isArray(data.supplierInvoices?.rows)).toBe(true)
  })

  it('persists into the next week with daysSinceClose > 0', () => {
    const state = runDays(8, 'next-day')
    const data = buildWeeklyOverview(state)
    expect(data.hasResult).toBe(true)
    expect(data.header?.endDay).toBe(7)
    expect(data.header?.daysSinceClose).toBe(1)
  })

  it('daysSinceClose grows as the week progresses', () => {
    const state = runDays(12, 'mid-next-week')
    const data = buildWeeklyOverview(state)
    expect(data.hasResult).toBe(true)
    expect(data.header?.endDay).toBe(7)
    expect(data.header?.daysSinceClose).toBe(5)
  })

  it('economy fields match the source WeeklyResult exactly', () => {
    const state = runDays(7, 'economy-match')
    const data = buildWeeklyOverview(state)
    const source = getWeeklyModuleState(state).lastWeeklyResult!
    expect(data.economy?.sales).toBe(source.economy.sales)
    expect(data.economy?.purchases).toBe(source.economy.purchases)
    expect(data.economy?.wages).toBe(source.economy.wages)
    expect(data.economy?.rent).toBe(source.economy.rent)
    expect(data.economy?.repairs).toBe(source.economy.repairs)
    expect(data.economy?.waste).toBe(source.economy.waste)
    expect(data.economy?.other).toBe(source.economy.other)
    expect(data.economy?.net).toBe(source.economy.net)
  })

  it('resolves staff rows to GeneratedName.display rather than ids', () => {
    const state = runDays(7, 'staff-names')
    const data = buildWeeklyOverview(state)
    for (const row of data.staff?.rows ?? []) {
      const staff = state.staff[row.id]
      expect(staff).toBeDefined()
      expect(row.name).toBe(staff!.name.display)
      // Role label resolves to a registry label, not the raw role id.
      expect(typeof row.roleLabel).toBe('string')
      expect(row.roleLabel.length).toBeGreaterThan(0)
    }
  })

  it('resolves customer-group rows to labels and marks best/worst', () => {
    const state = runDays(7, 'groups')
    const data = buildWeeklyOverview(state)
    for (const row of data.customerGroups?.rows ?? []) {
      const group = state.customerGroups[row.id]
      // Either a real label or fall-through id; either way, defined.
      expect(typeof row.label).toBe('string')
      if (group) expect(row.label).toBe(group.label)
      expect(row.isBest).toBe(row.id === data.customerGroups!.bestGroupId)
      expect(row.isWorst).toBe(row.id === data.customerGroups!.worstGroupId)
    }
  })

  it('resolves maintenance rows to area labels with severity in 0–100 range', () => {
    const state = runDays(7, 'maintenance')
    const data = buildWeeklyOverview(state)
    for (const row of data.maintenance?.rows ?? []) {
      const area = state.areas[row.areaId]
      if (area) expect(row.areaLabel).toBe(area.label)
      expect(row.severity).toBeGreaterThanOrEqual(0)
      expect(row.severity).toBeLessThanOrEqual(100)
      expect(Array.isArray(row.reasons)).toBe(true)
    }
  })

  it('supplier invoices list is empty under Option A (immediate payment)', () => {
    const state = runDays(7, 'invoices')
    const data = buildWeeklyOverview(state)
    expect(data.supplierInvoices?.paidCount).toBe(0)
    expect(data.supplierInvoices?.unpaidCount).toBe(0)
    expect(data.supplierInvoices?.totalUnpaid).toBe(0)
    expect(data.supplierInvoices?.rows).toEqual([])
  })

  it('shows the supplier name and remaining balance for a partial invoice', () => {
    let initial = startingState()
    const supplier = Object.values(initial.world.suppliers)[0]!
    const supplierLabel = supplier.name?.display ?? supplier.label
    const opened = openObligation({
      id: 'obl-suppliers-review-1',
      ownerModuleId: 'suppliers',
      counterparty: { kind: 'supplier', id: supplier.id },
      direction: 'payable',
      principal: 100,
      openedOnDay: 1,
      dueOnDay: 14,
      graceDays: 3,
      lateChargeRate: 0.05,
      readable: `100 coin invoice from ${supplierLabel}`,
      tags: ['supplier', 'invoice', 'stock:ale'],
    })
    const partial = payObligation(opened, 30, 2, 'partial supplier payment')
    const obligations = createInitialObligationsModuleState()
    obligations.records[partial.record.id] = partial.record
    obligations.nextSuffix = 1
    obligations.totals.opened = 1
    obligations.totals.paidOut = partial.applied
    initial = {
      ...initial,
      modules: {
        ...initial.modules,
        [OBLIGATIONS_MODULE_ID]: obligations,
      },
    }

    const state = runDays(7, 'partial-invoice', initial)
    const source = getWeeklyModuleState(state).lastWeeklyResult!
    expect(source.supplierInvoices).toEqual([
      {
        id: partial.record.id,
        supplierId: supplier.id,
        amount: 70,
        dueWeek: 2,
        paid: false,
        relatedStockIds: ['ale'],
      },
    ])

    const data = buildWeeklyOverview(state)
    expect(data.supplierInvoices?.totalUnpaid).toBe(70)
    expect(data.supplierInvoices?.rows[0]).toMatchObject({
      id: partial.record.id,
      supplierLabel,
      amount: 70,
      paid: false,
    })
  })

  it('top revenue source resolves to a stock label when present', () => {
    const state = runDays(7, 'top-revenue')
    const data = buildWeeklyOverview(state)
    if (data.economy?.topRevenueSource) {
      const stock = state.stock[data.economy.topRevenueSource.id]
      if (stock) {
        expect(data.economy.topRevenueSource.label).toBe(stock.label)
      }
    }
  })

  it('falls back to raw ids when referenced entities are missing', () => {
    const state = runDays(7, 'fallback')
    // Remove a staff entry the projection might reference.
    const slice = getWeeklyModuleState(state)
    const targetId = slice.lastWeeklyResult?.staffTrend[0]?.staffId
    if (!targetId) return // skip the assertion gracefully on degenerate runs
    const stripped: TavernState = {
      ...state,
      staff: Object.fromEntries(
        Object.entries(state.staff).filter(([id]) => id !== targetId),
      ),
    }
    const data = buildWeeklyOverview(stripped)
    const row = data.staff?.rows.find((r) => r.id === targetId)
    expect(row).toBeDefined()
    expect(row!.name).toBe(targetId)
    expect(row!.roleLabel).toBe('')
  })
})

describe('buildWeeklyOverview — community section', () => {
  it('is omitted when all four counts are zero (degenerate week)', () => {
    // A fresh week with no scenes typically produces an empty community
    // block. If a particular run happens to surface something, the
    // assertion is conditional on emptiness.
    const state = runDays(7, 'community-empty')
    const slice = getWeeklyModuleState(state)
    const c = slice.lastWeeklyResult!.community
    if (
      c.supplierTrend.length === 0 &&
      c.regularTrend.length === 0 &&
      c.factionTrend.length === 0 &&
      c.rumours.length === 0
    ) {
      const data = buildWeeklyOverview(state)
      expect(data.community).toBeUndefined()
    }
  })
})

describe('buildWeeklyOverview — comparison', () => {
  it('is undefined after only one finalized week', () => {
    const state = runDays(7, 'one-week')
    const data = buildWeeklyOverview(state)
    expect(data.comparison).toBeUndefined()
  })

  it('is present after two finalized weeks and references the previous week key', () => {
    const state = runDays(14, 'two-weeks')
    const slice = getWeeklyModuleState(state)
    expect(slice.weeklyHistory.length).toBeGreaterThanOrEqual(2)
    const data = buildWeeklyOverview(state)
    expect(data.comparison).toBeDefined()
    expect(data.comparison!.previousWeekKey).toBe(slice.weeklyHistory[0]!.weekKey)
  })

  it('comparison deltas equal current-minus-previous on covered fields', () => {
    const state = runDays(14, 'deltas')
    const slice = getWeeklyModuleState(state)
    const previous = slice.weeklyHistory[slice.weeklyHistory.length - 2]!
    const current = slice.lastWeeklyResult!
    const data = buildWeeklyOverview(state)
    expect(data.comparison!.netDelta).toBe(current.economy.net - previous.economy.net)
    expect(data.comparison!.salesDelta).toBe(current.economy.sales - previous.economy.sales)
    expect(data.comparison!.wagesDelta).toBe(current.economy.wages - previous.economy.wages)
    expect(data.comparison!.signalsDelta.cheap).toBe(
      current.signals.cheap - previous.signals.cheap,
    )
    expect(data.comparison!.signalsDelta.tasty).toBe(
      current.signals.tasty - previous.signals.tasty,
    )
  })
})

describe('buildWeeklyOverview — non-mutation', () => {
  it('does not mutate state', () => {
    const state = runDays(14, 'non-mutation')
    const before = JSON.stringify(state)
    buildWeeklyOverview(state)
    const after = JSON.stringify(state)
    expect(after).toBe(before)
  })
})
