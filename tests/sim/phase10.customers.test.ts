import { describe, it, expect } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { areasModule } from '../../src/sim/modules/areas/index'
import {
  customersModule,
  customerRegistry,
  getCustomerModuleState,
} from '../../src/sim/modules/customers/index'
import {
  getStockModuleState,
  stockModule,
} from '../../src/sim/modules/stock/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { validateState } from '../../src/sim/state/validation'
import type { DayType } from '../../src/sim/modules/calendar/types'
import type { TavernState } from '../../src/sim/state/TavernState'

// Phase 10 — Customer Group system.
//
// These tests cover the eleven numbered cases in `phases-06-10.md` §10
// "Testing Requirements". The customer module runs through `simulateDay`
// alongside the stock and areas modules so the forecast/service/satisfaction
// pipeline is exercised against the real engine and the Phase 9 helpers.

const SEED = 'phase-10-customers-test'

function defaultInput() {
  return { seed: SEED }
}

const DAY_OF_WEEK_BY_TYPE: Record<DayType, number> = {
  supplier_day: 1,
  quiet_day: 2,
  market_day: 3,
  local_night: 4,
  payday: 5,
  brawl_night: 6,
  maintenance_day: 7,
}

function withDayType(state: TavernState, dayType: DayType): TavernState {
  return {
    ...state,
    calendar: {
      ...state.calendar,
      dayType,
      dayOfWeek: DAY_OF_WEEK_BY_TYPE[dayType],
    },
  }
}

function runDay(state: TavernState) {
  return simulateDay(state, defaultInput(), [
    areasModule,
    stockModule,
    customersModule,
  ])
}

function forecastFor(state: TavernState, groupId: string) {
  const moduleState = getCustomerModuleState(state)
  return moduleState.forecasts.find((f) => f.groupId === groupId)
}

function turnoutFor(state: TavernState, groupId: string) {
  const moduleState = getCustomerModuleState(state)
  return moduleState.turnouts.find((t) => t.groupId === groupId)
}

describe('Phase 10 — Customer Group system', () => {
  it('1. default customer groups exist after createInitialTavernState', () => {
    const state = createInitialTavernState()
    // Phase 72 / ISSUE-032 — niche groups join the registry but
    // start with patronage 0; check containment of the original
    // five rather than full-set equality.
    for (const id of ['adventurers', 'local_goblins', 'merchants', 'miners', 'ogres']) {
      expect(state.customerGroups[id]).toBeDefined()
    }
    for (const id of [
      'local_goblins',
      'miners',
      'merchants',
      'ogres',
      'adventurers',
    ]) {
      expect(state.customerGroups[id]).toBeDefined()
    }
    expect(() => validateState(state)).not.toThrow()
  })

  it('2. Market Day increases merchant forecast traffic vs Quiet Day baseline', () => {
    const base = createInitialTavernState()
    const market = runDay(withDayType(base, 'market_day')).state
    const quiet = runDay(withDayType(base, 'quiet_day')).state

    const marketForecast = forecastFor(market, 'merchants')
    const quietForecast = forecastFor(quiet, 'merchants')

    expect(marketForecast).toBeDefined()
    expect(quietForecast).toBeDefined()
    expect(marketForecast!.expected).toBeGreaterThan(quietForecast!.expected)
  })

  it('3. Payday increases miner forecast traffic vs Quiet Day baseline', () => {
    const base = createInitialTavernState()
    const payday = runDay(withDayType(base, 'payday')).state
    const quiet = runDay(withDayType(base, 'quiet_day')).state

    const paydayForecast = forecastFor(payday, 'miners')
    const quietForecast = forecastFor(quiet, 'miners')

    expect(paydayForecast!.expected).toBeGreaterThan(quietForecast!.expected)
  })

  it('4. Brawl Night increases ogre and adventurer forecast traffic vs Quiet Day baseline', () => {
    const base = createInitialTavernState()
    const brawl = runDay(withDayType(base, 'brawl_night')).state
    const quiet = runDay(withDayType(base, 'quiet_day')).state

    expect(forecastFor(brawl, 'ogres')!.expected).toBeGreaterThan(
      forecastFor(quiet, 'ogres')!.expected,
    )
    expect(forecastFor(brawl, 'adventurers')!.expected).toBeGreaterThan(
      forecastFor(quiet, 'adventurers')!.expected,
    )
  })

  it('5. dirty main room reduces merchant satisfaction in afterService', () => {
    const base = createInitialTavernState()
    const dirty: TavernState = withDayType(
      {
        ...base,
        areas: {
          ...base.areas,
          main_room: { ...base.areas.main_room!, cleanliness: 5 },
        },
      },
      'market_day',
    )

    const result = runDay(dirty)
    const merchants = result.state.customerGroups.merchants!
    expect(merchants.satisfaction).toBeLessThan(
      base.customerGroups.merchants!.satisfaction,
    )

    const turnout = turnoutFor(result.state, 'merchants')
    expect(turnout).toBeDefined()
    expect(turnout!.satisfactionChange).toBeLessThan(0)
  })

  it('6. same dirty main room produces a smaller satisfaction reduction for local_goblins', () => {
    const base = createInitialTavernState()
    const dirty: TavernState = withDayType(
      {
        ...base,
        areas: {
          ...base.areas,
          main_room: { ...base.areas.main_room!, cleanliness: 5 },
        },
      },
      'local_night',
    )

    const result = runDay(dirty)
    const localChange = turnoutFor(result.state, 'local_goblins')!.satisfactionChange
    const merchantChange = turnoutFor(result.state, 'merchants')!.satisfactionChange

    // Both should be negative; locals' negative magnitude should be
    // smaller than merchants'.
    expect(localChange).toBeGreaterThan(merchantChange)
    expect(Math.abs(localChange)).toBeLessThan(Math.abs(merchantChange))
  })

  it('7. ale shortage during a high-traffic day reduces miner satisfaction', () => {
    const base = createInitialTavernState()
    const lowAle: TavernState = withDayType(
      {
        ...base,
        stock: {
          ...base.stock,
          ale: { ...base.stock.ale!, quantity: 4 },
        },
      },
      'payday',
    )

    const result = runDay(lowAle)
    const minerTurnout = turnoutFor(result.state, 'miners')!
    expect(minerTurnout.visitors).toBeGreaterThan(0)
    expect(minerTurnout.shortages.length).toBeGreaterThan(0)
    expect(minerTurnout.shortages.some((s) => s.stockId === 'ale')).toBe(true)
    expect(minerTurnout.satisfactionChange).toBeLessThan(0)

    // Sanity: an ale shortage should also be recorded in the Phase 9 stock
    // ledger surface.
    const stockShortages = getStockModuleState(result.state).shortages
    expect(stockShortages.some((s) => s.stockId === 'ale')).toBe(true)
  })

  it('8. adequate ale stock lets miner sales complete without producing shortage records', () => {
    const base = createInitialTavernState()
    const plenty: TavernState = withDayType(
      {
        ...base,
        stock: {
          ...base.stock,
          ale: { ...base.stock.ale!, quantity: 500 },
          stew: { ...base.stock.stew!, quantity: 200 },
        },
      },
      'payday',
    )

    const result = runDay(plenty)
    const minerTurnout = turnoutFor(result.state, 'miners')!
    expect(minerTurnout.visitors).toBeGreaterThan(0)
    expect(minerTurnout.shortages.some((s) => s.stockId === 'ale')).toBe(false)
  })

  it('9. ogre traffic increases main_room.damage via ctx.modifyArea', () => {
    const base = createInitialTavernState()
    const brawl: TavernState = withDayType(
      {
        ...base,
        // Boost ogre patronage so the brawl-night forecast guarantees a
        // visit even with the deterministic ±2 jitter from `ctx.rng`.
        customerGroups: {
          ...base.customerGroups,
          ogres: { ...base.customerGroups.ogres!, patronage: 90 },
        },
        // Make sure ale is plentiful so the basket sells.
        stock: {
          ...base.stock,
          ale: { ...base.stock.ale!, quantity: 500 },
        },
      },
      'brawl_night',
    )

    const result = runDay(brawl)
    const ogreTurnout = turnoutFor(result.state, 'ogres')!
    expect(ogreTurnout.visitors).toBeGreaterThan(0)
    expect(result.state.areas.main_room!.damage).toBeGreaterThan(
      base.areas.main_room!.damage,
    )
  })

  it('10. customer purchases increase coin via the Phase 9 ledger', () => {
    const base = createInitialTavernState()
    const market = withDayType(
      {
        ...base,
        stock: {
          ...base.stock,
          ale: { ...base.stock.ale!, quantity: 500 },
          stew: { ...base.stock.stew!, quantity: 300 },
        },
      },
      'market_day',
    )

    const result = runDay(market)
    expect(result.state.coin).toBeGreaterThan(base.coin)

    const ledger = getStockModuleState(result.state).ledger
    expect(ledger.length).toBeGreaterThan(0)
    const sales = ledger.filter((e) => e.category === 'sales')
    expect(sales.length).toBeGreaterThan(0)
    // Some sale entries should carry the buyer tag from `sellStockItem`'s
    // `options.buyerGroupId` path.
    expect(sales.some((e) => e.tags.some((t) => t.startsWith('buyer:')))).toBe(
      true,
    )
  })

  it('11. customer report includes per-group traffic and satisfaction-change lines', () => {
    const base = createInitialTavernState()
    const result = runDay(withDayType(base, 'market_day'))

    const report = result.reports.find((r) => r.id === 'customers')
    expect(report).toBeDefined()
    const text = report!.lines.join('\n')
    for (const group of Object.values(result.state.customerGroups)) {
      expect(text).toContain(group.label)
    }
    expect(text).toMatch(/Traffic:/)
    expect(text).toMatch(/Satisfaction:/)
  })
})

describe('Phase 10 — Registry, module shape, and integration', () => {
  it('customerRegistry exposes the five required groups with default state', () => {
    // Phase 72 / ISSUE-032 — the registry has grown with niche
    // groups; check containment of the original five.
    for (const id of ['adventurers', 'local_goblins', 'merchants', 'miners', 'ogres']) {
      expect(customerRegistry.has(id)).toBe(true)
    }
    for (const def of customerRegistry.all()) {
      expect(def.defaultState.patronage).toBeGreaterThanOrEqual(0)
      expect(def.defaultState.patronage).toBeLessThanOrEqual(100)
      expect(def.defaultState.filthTolerance).toBeGreaterThanOrEqual(0)
      expect(def.defaultState.filthTolerance).toBeLessThanOrEqual(100)
      expect(def.defaultState.preferredStockTags).toBeInstanceOf(Array)
      expect(def.defaultState.dislikedTags).toBeInstanceOf(Array)
    }
  })

  it('customersModule registers the canonical id, hooks, schema, report builder', () => {
    expect(customersModule.id).toBe('customers')
    expect(customersModule.version).toBeTypeOf('string')
    expect(customersModule.dependsOn).toContain('stock')
    expect(customersModule.dependsOn).toContain('areas')
    expect(customersModule.hooks?.startDay).toBeDefined()
    expect(customersModule.hooks?.forecastTraffic).toBeDefined()
    expect(customersModule.hooks?.service).toBeDefined()
    expect(customersModule.hooks?.afterService).toBeDefined()
    expect(customersModule.buildReport).toBeTypeOf('function')
    expect(customersModule.stateSchema).toBeDefined()
  })

  it('simulateDay with areas + stock + customers leaves state valid', () => {
    const state = createInitialTavernState()
    const result = runDay(state)
    expect(result.validation.errors).toEqual([])
    expect(result.reports.find((r) => r.id === 'customers')).toBeDefined()
  })

  it('startDay resets per-day forecasts and turnouts', () => {
    const state = createInitialTavernState()
    const day1 = runDay(state).state
    expect(getCustomerModuleState(day1).forecasts.length).toBeGreaterThan(0)

    const day2 = runDay(day1).state
    // After day 2's startDay reset and forecastTraffic, forecasts exist
    // again — but they reflect day 2's run, not day 1's leftover.
    const day2Forecasts = getCustomerModuleState(day2).forecasts
    expect(day2Forecasts.length).toBeGreaterThan(0)
    // The day2 turnouts should not include zero-visitor stragglers from
    // day 1 (the reset path means turnouts are freshly produced).
    const day2Turnouts = getCustomerModuleState(day2).turnouts
    expect(day2Turnouts.length).toBeGreaterThan(0)
  })

  it('CustomerGroupState extends with loyalty, preferredStockTags, dislikedTags', () => {
    const state = createInitialTavernState()
    const merchants = state.customerGroups.merchants!
    expect(typeof merchants.loyalty).toBe('number')
    expect(merchants.loyalty).toBeGreaterThanOrEqual(0)
    expect(merchants.loyalty).toBeLessThanOrEqual(100)
    expect(merchants.preferredStockTags).toBeInstanceOf(Array)
    expect(merchants.dislikedTags).toBeInstanceOf(Array)
    expect(merchants.preferredStockTags.length).toBeGreaterThan(0)
  })
})
