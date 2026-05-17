import { describe, it, expect } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { areasModule } from '../../src/sim/modules/areas/index'
import { customersModule } from '../../src/sim/modules/customers/index'
import { ownerActionsModule } from '../../src/sim/modules/ownerActions/index'
import { serviceModule } from '../../src/sim/modules/service/index'
import { staffModule } from '../../src/sim/modules/staff/index'
import { stockModule } from '../../src/sim/modules/stock/index'
import {
  WEEKLY_MODULE_ID,
  computeMaintenanceBacklog,
  createInitialWeeklyModuleState,
  getWeeklyModuleState,
  weeklyModule,
} from '../../src/sim/modules/weekly/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  withArea,
  withCoin,
  withCustomerGroup,
  withStaff,
  withStock,
} from '../../src/sim/testing/stateFactories'
import type { TavernState } from '../../src/sim/state/TavernState'

// Phase 14 — Weekly routine system.
//
// These tests cover the cases in `phases-11-15.md` §14 "Tests" plus a
// few structural assertions that mirror the Phase 11–13 precedents.

const SEED = 'phase-14-weekly-test'

const FULL_PIPELINE = [
  areasModule,
  stockModule,
  staffModule,
  customersModule,
  ownerActionsModule,
  serviceModule,
  weeklyModule,
]

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

function runDay(state: TavernState, overrides: Partial<SimInput> = {}) {
  return simulateDay(state, input(overrides), FULL_PIPELINE)
}

function plentyOfStock(state: TavernState): TavernState {
  return {
    ...state,
    stock: {
      ...state.stock,
      ale: { ...state.stock.ale!, quantity: 800, quality: 60 },
      stew: { ...state.stock.stew!, quantity: 400, quality: 60 },
      mushrooms: { ...state.stock.mushrooms!, quantity: 200 },
    },
  }
}

function runWeek(state: TavernState): TavernState {
  let current = state
  for (let i = 0; i < 7; i += 1) {
    current = runDay(current).state
  }
  return current
}

describe('Phase 14 — Module shape', () => {
  it('weeklyModule registers id, hooks, schema, report, and validator', () => {
    expect(weeklyModule.id).toBe(WEEKLY_MODULE_ID)
    expect(weeklyModule.id).toBe('weekly')
    expect(weeklyModule.hooks?.startDay).toBeDefined()
    expect(weeklyModule.hooks?.endDay).toBeDefined()
    expect(weeklyModule.hooks?.endWeek).toBeDefined()
    expect(weeklyModule.buildReport).toBeTypeOf('function')
    expect(weeklyModule.validate).toBeTypeOf('function')
    expect(weeklyModule.stateSchema).toBeDefined()
    expect(weeklyModule.dependsOn).toContain('stock')
    expect(weeklyModule.dependsOn).toContain('customers')
  })

  it('createInitialTavernState seeds an empty weekly slice', () => {
    const state = createInitialTavernState()
    const slice = getWeeklyModuleState(state)
    expect(slice.weekKey).toBe('')
    expect(slice.weekFinalized).toBe(false)
    expect(slice.lastWeeklyResult).toBeUndefined()
    expect(slice.weeklyHistory).toEqual([])
    expect(slice.economy.net).toBe(0)
    expect(slice.signals.cheap).toBe(0)
  })

  it('createInitialWeeklyModuleState returns the expected default shape', () => {
    const fresh = createInitialWeeklyModuleState()
    expect(fresh.economy.sales).toBe(0)
    expect(fresh.economy.purchases).toBe(0)
    expect(fresh.supplierInvoices).toEqual([])
    expect(fresh.signalNotes).toEqual([])
    expect(fresh.weeklyHistory).toEqual([])
  })
})

describe('Phase 14 §14.1 — endWeek gating', () => {
  it('endWeek runs only on the final day of the week', () => {
    const base = plentyOfStock(createInitialTavernState())
    // Days 1..6 should leave the slice un-finalized.
    let current = base
    for (let i = 0; i < 6; i += 1) {
      current = runDay(current).state
      const slice = getWeeklyModuleState(current)
      expect(slice.weekFinalized).toBe(false)
      expect(slice.lastWeeklyResult).toBeUndefined()
    }
    // Day 7 — endWeek finalizes the slice and produces a result.
    current = runDay(current).state
    const finalSlice = getWeeklyModuleState(current)
    expect(finalSlice.weekFinalized).toBe(true)
    expect(finalSlice.lastWeeklyResult).toBeDefined()
    expect(finalSlice.lastWeeklyResult!.endDay).toBe(7)
  })

  it('the weekly accumulator resets on the next week (day 8)', () => {
    const base = plentyOfStock(createInitialTavernState())
    let current = base
    for (let i = 0; i < 7; i += 1) current = runDay(current).state
    const week1 = getWeeklyModuleState(current)
    expect(week1.weekFinalized).toBe(true)
    expect(week1.lastWeeklyResult).toBeDefined()

    // Day 8 — startDay resets the weekly accumulator window, but Phase 90
    // preserves `lastWeeklyResult` and `weeklyHistory` so the Reports tab
    // can read the closed week beyond its close day.
    current = runDay(current).state
    const day8 = getWeeklyModuleState(current)
    expect(day8.weekFinalized).toBe(false)
    expect(day8.lastWeeklyResult).toBeDefined()
    expect(day8.lastWeeklyResult!.weekKey).toBe(week1.lastWeeklyResult!.weekKey)
    expect(day8.weeklyHistory.length).toBe(1)
    expect(day8.weeklyHistory[0]!.weekKey).toBe(week1.lastWeeklyResult!.weekKey)
    expect(day8.startedOnDay).toBe(8)
    expect(day8.economy.sales).toBe(0)
  })
})

describe('Phase 14 §14.2 — Wages', () => {
  it('wages paid when coin is sufficient', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 500)
    const result = runWeek(base)
    const slice = getWeeklyModuleState(result)
    const wages = slice.lastWeeklyResult!.wages
    expect(wages.paid).toBe(true)
    expect(wages.paidAmount).toBeGreaterThan(0)
    expect(wages.unpaidStaffIds).toEqual([])
    for (const member of Object.values(result.staff)) {
      expect(member.paidThisWeek).toBe(true)
    }
  })

  it('wages unpaid when coin is insufficient', () => {
    // Drain stock to zero across the board so no sales happen, then
    // start with 0 coin so the week ends below the wage bill.
    let base = withCoin(createInitialTavernState(), 0)
    for (const id of Object.keys(base.stock)) {
      base = withStock(base, id, { quantity: 0 })
    }
    let current = base
    for (let i = 0; i < 7; i += 1) current = runDay(current).state
    const slice = getWeeklyModuleState(current)
    const wages = slice.lastWeeklyResult!.wages
    expect(wages.paid).toBe(false)
    expect(wages.paidAmount).toBe(0)
    expect(wages.unpaidStaffIds.length).toBeGreaterThan(0)
    for (const member of Object.values(current.staff)) {
      expect(member.paidThisWeek).toBe(false)
    }
  })

  it('unpaid wages reduce morale and loyalty', () => {
    let base = withCoin(createInitialTavernState(), 0)
    for (const id of Object.keys(base.stock)) {
      base = withStock(base, id, { quantity: 0 })
    }
    const startMorale = base.staff.cook!.morale
    const startLoyalty = base.staff.cook!.loyalty
    let current = base
    for (let i = 0; i < 7; i += 1) current = runDay(current).state
    expect(current.staff.cook!.morale).toBeLessThan(startMorale)
    expect(current.staff.cook!.loyalty).toBeLessThan(startLoyalty)
  })

  it('wage spending flows through the Phase 9 ledger and the weekly economy', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 500)
    const totalWages = Object.values(base.staff).reduce(
      (sum, s) => sum + s.wage,
      0,
    )
    const result = runWeek(base)
    const economy = getWeeklyModuleState(result).lastWeeklyResult!.economy
    expect(economy.wages).toBeGreaterThanOrEqual(totalWages)
  })
})

describe('Phase 14 §14.3 — Supplier invoices (placeholder, Option A)', () => {
  it('weekly result carries an empty supplier-invoice list', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runWeek(base)
    const slice = getWeeklyModuleState(result)
    expect(slice.lastWeeklyResult!.supplierInvoices).toEqual([])
  })
})

describe('Phase 14 §14.4 — Weekly profit/loss', () => {
  it('weekly economy.net equals sales minus all spending categories', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 500)
    const result = runWeek(base)
    const economy = getWeeklyModuleState(result).lastWeeklyResult!.economy
    const expected =
      economy.sales -
      economy.purchases -
      economy.repairs -
      economy.wages -
      economy.rent -
      economy.waste +
      economy.other
    expect(economy.net).toBe(expected)
  })

  it('weekly economy captures restock purchases through owner actions', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 500)
    // Run six days with no actions.
    let current = base
    for (let i = 0; i < 6; i += 1) current = runDay(current).state
    // Day 7 — restock 50 ale (costs 100 coin at basePrice 2) before endWeek.
    current = runDay(current, {
      ownerActions: [
        { actionId: 'restock_item', targetId: 'ale', amount: 50 },
      ],
    }).state
    const economy = getWeeklyModuleState(current).lastWeeklyResult!.economy
    expect(economy.purchases).toBeGreaterThanOrEqual(100)
  })
})

describe('Phase 14 §14.5 — Maintenance backlog', () => {
  it('maintenance backlog flags dirty and damaged areas', () => {
    const dirty = withArea(
      withArea(plentyOfStock(createInitialTavernState()), 'kitchen', {
        cleanliness: 12,
      }),
      'main_room',
      { damage: 70 },
    )
    const backlog = computeMaintenanceBacklog(dirty)
    const ids = backlog.map((b) => b.areaId)
    expect(ids).toContain('kitchen')
    expect(ids).toContain('main_room')
    const kitchen = backlog.find((b) => b.areaId === 'kitchen')!
    expect(kitchen.reasons.some((r) => r.startsWith('cleanliness'))).toBe(true)
    const mainRoom = backlog.find((b) => b.areaId === 'main_room')!
    expect(mainRoom.reasons.some((r) => r.startsWith('damage'))).toBe(true)
  })

  it('clean areas do not appear in the backlog', () => {
    const clean = createInitialTavernState()
    // The default kitchen/cellar/privy have low cleanliness or condition
    // in the seed, so we restore each to passing values for this check.
    const allClean = withArea(
      withArea(
        withArea(
          withArea(
            withArea(clean, 'kitchen', {
              cleanliness: 80,
              smell: 10,
              risk: 10,
              condition: 80,
            }),
            'main_room',
            { cleanliness: 80, damage: 0, smell: 20, risk: 10, condition: 80 },
          ),
          'cellar',
          { cleanliness: 80, smell: 10, risk: 10, condition: 80 },
        ),
        'privy',
        { cleanliness: 80, smell: 10, risk: 10, condition: 80 },
      ),
      'roof',
      { condition: 90, damage: 0 },
    )
    const backlog = computeMaintenanceBacklog(allClean)
    expect(backlog).toEqual([])
  })

  it('weekly result surfaces the maintenance backlog', () => {
    const base = plentyOfStock(
      withArea(createInitialTavernState(), 'kitchen', { cleanliness: 10 }),
    )
    const result = runWeek(base)
    const maintenance = getWeeklyModuleState(result).lastWeeklyResult!.maintenance
    expect(maintenance.some((m) => m.areaId === 'kitchen')).toBe(true)
  })
})

describe('Phase 14 §14.6 — Staff weekly trend', () => {
  it('paid + profitable week lifts cook morale on top of the wage bump', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 500)
    const result = runWeek(base)
    const trend = getWeeklyModuleState(result).lastWeeklyResult!.staffTrend
    const cookTrend = trend.find((t) => t.staffId === 'cook')!
    expect(cookTrend).toBeDefined()
    // The combined wage-paid effect + staff trend should leave morale at
    // least as high as the start.
    expect(result.staff.cook!.morale).toBeGreaterThanOrEqual(
      base.staff.cook!.morale,
    )
  })
})

describe('Phase 14 §14.7 — Customer weekly trend', () => {
  it('heavy miner traffic with positive satisfaction nudges patronage upward', () => {
    const eagerMiners = withCustomerGroup(
      plentyOfStock(createInitialTavernState()),
      'miners',
      { satisfaction: 90, patronage: 40, loyalty: 70 },
    )
    const result = runWeek(eagerMiners)
    const trend = getWeeklyModuleState(result)
      .lastWeeklyResult!.customerTrend.find((t) => t.groupId === 'miners')!
    expect(trend.totalTraffic).toBeGreaterThan(0)
    // High-satisfaction miners with heavy traffic should have a
    // non-negative patronage delta this week.
    expect(trend.patronageDelta).toBeGreaterThanOrEqual(0)
  })

  it('repeated merchant dissatisfaction lowers merchant patronage', () => {
    // Dirty main room and unhappy merchants — Phase 12 satisfaction
    // updates will tank merchant satisfaction further.
    const base = withCustomerGroup(
      withArea(plentyOfStock(createInitialTavernState()), 'main_room', {
        cleanliness: 5,
      }),
      'merchants',
      { satisfaction: 20, patronage: 50, filthTolerance: 80 },
    )
    const result = runWeek(base)
    const merchants = result.customerGroups.merchants!
    expect(merchants.patronage).toBeLessThanOrEqual(50)
    const trend = getWeeklyModuleState(result)
      .lastWeeklyResult!.customerTrend.find((t) => t.groupId === 'merchants')!
    expect(trend.patronageDelta).toBeLessThanOrEqual(0)
  })
})

describe('Phase 14 §14.8 — Reputation signals', () => {
  it('a dirty week accumulates a filthy signal', () => {
    const dirty = withArea(
      withArea(plentyOfStock(createInitialTavernState()), 'main_room', {
        cleanliness: 10,
      }),
      'kitchen',
      { cleanliness: 10 },
    )
    const result = runWeek(dirty)
    const signals = getWeeklyModuleState(result).lastWeeklyResult!.signals
    expect(signals.filthy).toBeGreaterThan(0)
  })

  it('a week with frequent shortages produces a negative reliable signal', () => {
    // Strip stock to nearly nothing so service runs into shortages
    // every day. The reliable signal should accumulate negatively.
    const base = withStock(
      withStock(
        withStock(
          withStock(createInitialTavernState(), 'ale', { quantity: 2 }),
          'stew',
          { quantity: 1 },
        ),
        'mushrooms',
        { quantity: 0 },
      ),
      'ingredients',
      { quantity: 1 },
    )
    const result = runWeek(base)
    const signals = getWeeklyModuleState(result).lastWeeklyResult!.signals
    expect(signals.reliable).toBeLessThan(0)
  })
})

describe('Phase 14 §14.9 — Weekly report', () => {
  it('weekly report includes wages, economy, maintenance, staff, customers, and signals', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 500)
    let state = base
    let lastReports
    for (let i = 0; i < 7; i += 1) {
      const out = runDay(state)
      state = out.state
      lastReports = out.reports
    }
    const weekly = lastReports!.find((r) => r.id === 'weekly')
    expect(weekly).toBeDefined()
    expect(weekly!.title).toMatch(/WEEKLY REPORT/)
    const text = weekly!.lines.join('\n')
    expect(text).toMatch(/Economy:/)
    expect(text).toMatch(/Wages:/)
    expect(text).toMatch(/Maintenance:/)
    expect(text).toMatch(/Signals:/)
    expect(text).toMatch(/Staff:/)
    expect(text).toMatch(/Customers:/)
  })

  it('non-end-of-week days do not emit a weekly report', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(base)
    const weekly = result.reports.find((r) => r.id === 'weekly')
    expect(weekly).toBeUndefined()
  })

  it('weekly report data payload carries the structured WeeklyResult', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 500)
    let state = base
    let lastReports
    for (let i = 0; i < 7; i += 1) {
      const out = runDay(state)
      state = out.state
      lastReports = out.reports
    }
    const report = lastReports!.find((r) => r.id === 'weekly')!
    const data = report.data as {
      economy: { net: number }
      wages: { paid: boolean }
      signals: Record<string, number>
    }
    expect(data.economy).toBeDefined()
    expect(data.wages).toBeDefined()
    expect(typeof data.signals.cheap).toBe('number')
  })
})

describe('Phase 14 — State safety', () => {
  it('state validates after endWeek', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 500)
    let state = base
    let lastResult
    for (let i = 0; i < 7; i += 1) {
      lastResult = runDay(state)
      state = lastResult.state
    }
    expect(lastResult!.validation.errors).toEqual([])
  })

  it('multi-week run keeps state validating', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 500)
    let state = base
    let lastResult
    for (let i = 0; i < 14; i += 1) {
      lastResult = runDay(state)
      state = lastResult.state
    }
    expect(lastResult!.validation.errors).toEqual([])
    expect(getWeeklyModuleState(state).weekFinalized).toBe(true)
  })

  it('exhausted staff who go unpaid still leave state validating', () => {
    const base = withStaff(
      withCoin(createInitialTavernState(), 0),
      'cook',
      { morale: 8, loyalty: 8 },
    )
    let state = base
    let lastResult
    for (let i = 0; i < 7; i += 1) {
      lastResult = runDay(state)
      state = lastResult.state
    }
    expect(lastResult!.validation.errors).toEqual([])
    expect(state.staff.cook!.morale).toBeGreaterThanOrEqual(0)
    expect(state.staff.cook!.loyalty).toBeGreaterThanOrEqual(0)
  })
})

describe('Phase 14 — Standalone helpers', () => {
  it('computeMaintenanceBacklog severity sorts most-pressing first', () => {
    // Severity is the worst of the per-criterion scores: damage 90
    // produces 90, cleanliness 50 produces 50 (100 − 50). The high-
    // damage area should outrank the moderately dirty one.
    const state = withArea(
      withArea(createInitialTavernState(), 'kitchen', {
        cleanliness: 50,
        condition: 70,
      }),
      'main_room',
      { damage: 90 },
    )
    const backlog = computeMaintenanceBacklog(state)
    expect(backlog.length).toBeGreaterThan(0)
    expect(backlog[0]!.areaId).toBe('main_room')
  })

  it('weekly slice tracks per-stock sales totals', () => {
    const base = withStock(
      plentyOfStock(createInitialTavernState()),
      'ale',
      { quantity: 800, salePrice: 2, quality: 60 },
    )
    let state = base
    for (let i = 0; i < 7; i += 1) state = runDay(state).state
    const slice = getWeeklyModuleState(state)
    expect(slice.lastWeeklyResult).toBeDefined()
    expect(Object.keys(slice.salesByStockId).length).toBeGreaterThan(0)
  })

  it('weekly slice records traffic accumulated across the whole week', () => {
    const base = plentyOfStock(createInitialTavernState())
    let state = base
    for (let i = 0; i < 7; i += 1) state = runDay(state).state
    const slice = getWeeklyModuleState(state)
    const totalTraffic = Object.values(slice.trafficByGroup).reduce(
      (a, b) => a + b,
      0,
    )
    expect(totalTraffic).toBeGreaterThan(0)
  })
})
