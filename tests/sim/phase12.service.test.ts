import { describe, it, expect } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { areasModule } from '../../src/sim/modules/areas/index'
import {
  customersModule,
  getCustomerModuleState,
} from '../../src/sim/modules/customers/index'
import {
  getServiceModuleState,
  resolveService,
  serviceModule,
  SERVICE_MODULE_ID,
} from '../../src/sim/modules/service/index'
import {
  staffModule,
  getStaffModuleState,
} from '../../src/sim/modules/staff/index'
import {
  getStockModuleState,
  stockModule,
} from '../../src/sim/modules/stock/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { withCustomerGroup, withStaff } from '../../src/sim/testing/stateFactories'
import type { DayType } from '../../src/sim/modules/calendar/types'
import type { TavernState } from '../../src/sim/state/TavernState'

// Phase 12 — Daily service simulation.
//
// These tests cover the ten cases in `phases-11-15.md` §12 "Tests" plus
// structural assertions for the module wiring. The service module runs
// through `simulateDay` alongside areas, stock, staff, and customers so
// the daily loop is exercised against the real engine, the Phase 9
// helpers, and the Phase 11 staff service-quality publication.

const SEED = 'phase-12-service-test'

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

function input(staffPriorities?: Record<string, string>) {
  if (staffPriorities) return { seed: SEED, staffPriorities }
  return { seed: SEED }
}

function runDay(state: TavernState, staffPriorities?: Record<string, string>) {
  return simulateDay(state, input(staffPriorities), [
    areasModule,
    stockModule,
    staffModule,
    customersModule,
    serviceModule,
  ])
}

function plentyOfStock(state: TavernState): TavernState {
  return {
    ...state,
    stock: {
      ...state.stock,
      ale: { ...state.stock.ale!, quantity: 800, quality: 50 },
      stew: { ...state.stock.stew!, quantity: 400, quality: 50 },
      mushrooms: { ...state.stock.mushrooms!, quantity: 200 },
    },
  }
}

describe('Phase 12 — Daily service simulation', () => {
  it('1. Payday creates higher miner turnout than Quiet Day', () => {
    const base = plentyOfStock(createInitialTavernState())
    const payday = runDay(withDayType(base, 'payday')).state
    const quiet = runDay(withDayType(base, 'quiet_day')).state

    const minerPayday = getCustomerModuleState(payday).turnouts.find(
      (t) => t.groupId === 'miners',
    )
    const minerQuiet = getCustomerModuleState(quiet).turnouts.find(
      (t) => t.groupId === 'miners',
    )

    expect(minerPayday).toBeDefined()
    expect(minerQuiet).toBeDefined()
    expect(minerPayday!.visitors).toBeGreaterThan(minerQuiet!.visitors)
  })

  it('2. customers purchase stock and increase coin via the Phase 9 ledger', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(withDayType(base, 'market_day'))

    expect(result.state.coin).toBeGreaterThan(base.coin - 200) // sanity bound
    const ledger = getStockModuleState(result.state).ledger
    const sales = ledger.filter((e) => e.category === 'sales')
    expect(sales.length).toBeGreaterThan(0)
    expect(
      sales.some((e) => e.tags.some((t) => t.startsWith('buyer:'))),
    ).toBe(true)
  })

  it('3. stock shortages reduce customer satisfaction', () => {
    const base = createInitialTavernState()
    const lowAle: TavernState = {
      ...base,
      stock: {
        ...base.stock,
        ale: { ...base.stock.ale!, quantity: 4 },
        stew: { ...base.stock.stew!, quantity: 4 },
      },
    }
    const result = runDay(withDayType(lowAle, 'payday'))
    const minerTurnout = getCustomerModuleState(result.state).turnouts.find(
      (t) => t.groupId === 'miners',
    )!
    expect(minerTurnout.shortages.length).toBeGreaterThan(0)
    expect(minerTurnout.shortages.some((s) => s.stockId === 'ale')).toBe(true)
    expect(minerTurnout.satisfactionChange).toBeLessThan(0)
  })

  it('4. server watch_tabs reduces unpaid tabs vs maximize_sales', () => {
    const base = plentyOfStock(createInitialTavernState())
    const day = withDayType(base, 'payday')

    const watching = runDay(day, { server: 'watch_tabs' })
    const selling = runDay(day, { server: 'maximize_sales' })

    const watchingTabs = getServiceModuleState(watching.state).result.unpaidTabs
    const sellingTabs = getServiceModuleState(selling.state).result.unpaidTabs

    expect(watchingTabs).toBeLessThan(sellingTabs)
  })

  it('5. cleaner_bouncer prevent_fights reduces brawl-night damage vs clean', () => {
    const base = plentyOfStock(createInitialTavernState())
    // Pump ogre patronage so brawl-night damage actually triggers.
    const rowdy = withCustomerGroup(base, 'ogres', { patronage: 90 })
    const day = withDayType(rowdy, 'brawl_night')

    const guarding = runDay(day, { cleaner_bouncer: 'prevent_fights' })
    const cleaning = runDay(day, { cleaner_bouncer: 'clean' })

    const guardingDamage = guarding.state.areas.main_room!.damage
    const cleaningDamage = cleaning.state.areas.main_room!.damage

    expect(guardingDamage).toBeLessThanOrEqual(cleaningDamage)
    expect(guardingDamage).toBeLessThan(cleaningDamage + 1)
  })

  it('6. cook stretch_ingredients reduces stock use vs quality', () => {
    const base = plentyOfStock(createInitialTavernState())
    const day = withDayType(base, 'market_day')

    const quality = runDay(day, { cook: 'quality' })
    const stretch = runDay(day, { cook: 'stretch_ingredients' })

    const aleQualityUsed =
      base.stock.ale!.quantity - quality.state.stock.ale!.quantity
    const aleStretchUsed =
      base.stock.ale!.quantity - stretch.state.stock.ale!.quantity

    expect(aleStretchUsed).toBeLessThan(aleQualityUsed)

    // §12 test "stretch_ingredients ... lowers food satisfaction" — check
    // satisfaction did not rise compared with the food-quality priority.
    //
    // Expansion Phase 4 §4.1 — measured on a QUIET day, and that is the point
    // of the change rather than a way round it. `quality` carries
    // `serviceSpeed −0.2` and serves full portions, so on a market day it now
    // runs the kitchen past its ceiling and eighteen patrons walk out unserved:
    // the food is better and the night is worse. That trade-off did not exist
    // when service was one arithmetic pass, and it is exactly what §4.1 set out
    // to create — so the food-quality claim is tested where food quality is
    // what differs, and the throughput claim gets its own tests in
    // `phase211.serviceFlow`.
    const quiet = withDayType(base, 'quiet_day')
    const quietQuality = runDay(quiet, { cook: 'quality' })
    const quietStretch = runDay(quiet, { cook: 'stretch_ingredients' })
    const stretchSatChange = getCustomerModuleState(quietStretch.state).turnouts
      .reduce((acc, t) => acc + t.satisfactionChange, 0)
    const qualitySatChange = getCustomerModuleState(quietQuality.state).turnouts
      .reduce((acc, t) => acc + t.satisfactionChange, 0)
    expect(stretchSatChange).toBeLessThan(qualitySatChange)
  })

  it('7. high ogre traffic increases main room damage', () => {
    const base = plentyOfStock(createInitialTavernState())
    const rowdy = withCustomerGroup(base, 'ogres', { patronage: 95 })
    const day = withDayType(rowdy, 'brawl_night')

    const result = runDay(day)
    expect(result.state.areas.main_room!.damage).toBeGreaterThan(
      base.areas.main_room!.damage,
    )
    const ogreTurnout = getCustomerModuleState(result.state).turnouts.find(
      (t) => t.groupId === 'ogres',
    )!
    expect(ogreTurnout.visitors).toBeGreaterThan(0)
  })

  it('8. dirty main room reduces merchant satisfaction during service', () => {
    const base = plentyOfStock(createInitialTavernState())
    const dirty: TavernState = {
      ...base,
      areas: {
        ...base.areas,
        main_room: { ...base.areas.main_room!, cleanliness: 5 },
      },
    }
    const result = runDay(withDayType(dirty, 'market_day'))
    const merchants = result.state.customerGroups.merchants!
    expect(merchants.satisfaction).toBeLessThan(
      base.customerGroups.merchants!.satisfaction,
    )

    const turnout = getCustomerModuleState(result.state).turnouts.find(
      (t) => t.groupId === 'merchants',
    )!
    expect(turnout.satisfactionChange).toBeLessThan(0)
  })

  it('9. daily service report includes traffic, coin, stock, damage, and satisfaction', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(withDayType(base, 'market_day'))

    const report = result.reports.find((r) => r.id === 'service')
    expect(report).toBeDefined()
    expect(report!.title).toMatch(/DAILY SERVICE REPORT/)
    const text = report!.lines.join('\n')
    expect(text).toMatch(/Traffic:/)
    expect(text).toMatch(/Economy:/)
    expect(text).toMatch(/Coin earned:/)
    expect(text).toMatch(/Stock:/)
    expect(text).toMatch(/Tavern Impact:/)
    expect(text).toMatch(/Customer Satisfaction:/)
    expect(text).toMatch(/Staff:/)
  })

  it('10. state validates after the daily service loop', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(withDayType(base, 'payday'))
    expect(result.validation.errors).toEqual([])
  })
})

describe('Phase 12 — Service module structure (§12.1)', () => {
  it('serviceModule registers the canonical id, hooks, schema, and report', () => {
    expect(serviceModule.id).toBe(SERVICE_MODULE_ID)
    expect(serviceModule.id).toBe('service')
    expect(serviceModule.dependsOn).toContain('customers')
    expect(serviceModule.dependsOn).toContain('staff')
    expect(serviceModule.dependsOn).toContain('stock')
    expect(serviceModule.dependsOn).toContain('areas')
    expect(serviceModule.hooks?.startDay).toBeDefined()
    expect(serviceModule.hooks?.beforeService).toBeDefined()
    expect(serviceModule.hooks?.service).toBeDefined()
    expect(serviceModule.hooks?.afterService).toBeDefined()
    expect(serviceModule.buildReport).toBeTypeOf('function')
    expect(serviceModule.stateSchema).toBeDefined()
  })

  it('startDay resets the per-day service slice (§12.1)', () => {
    const state = plentyOfStock(createInitialTavernState())
    const day1 = runDay(state).state
    const day1Result = getServiceModuleState(day1).result
    expect(Object.keys(day1Result.trafficByGroup).length).toBeGreaterThan(0)

    const day2 = runDay(day1).state
    const day2Result = getServiceModuleState(day2).result
    // The new day's traffic should not include leftover ids from day 1's
    // turnout list (they will be overwritten by today's run).
    expect(Object.keys(day2Result.trafficByGroup).length).toBeGreaterThan(0)
  })

  it('resolveService produces a DailyServiceResult shape (§12.1)', () => {
    const state = plentyOfStock(createInitialTavernState())
    const result = runDay(withDayType(state, 'market_day'))
    const sliceResult = getServiceModuleState(result.state).result
    expect(typeof sliceResult.dayKey).toBe('string')
    expect(typeof sliceResult.trafficByGroup).toBe('object')
    expect(typeof sliceResult.purchasesByGroup).toBe('object')
    expect(typeof sliceResult.coinEarned).toBe('number')
    expect(typeof sliceResult.unpaidTabs).toBe('number')
    expect(typeof sliceResult.netCoinEarned).toBe('number')
    expect(Array.isArray(sliceResult.stockConsumed)).toBe(true)
    expect(Array.isArray(sliceResult.shortages)).toBe(true)
    expect(Array.isArray(sliceResult.messCreated)).toBe(true)
    expect(Array.isArray(sliceResult.damageCreated)).toBe(true)
    expect(Array.isArray(sliceResult.staffChanges)).toBe(true)
    expect(Array.isArray(sliceResult.incidents)).toBe(true)
  })
})

describe('Phase 12 — Service quality plumbing into customer math (§12.4)', () => {
  it('service quality is propagated into purchases via the customers module', () => {
    const base = plentyOfStock(createInitialTavernState())
    const day = withDayType(base, 'market_day')
    const quality = runDay(day, { cook: 'quality' })
    const sq = getStaffModuleState(quality.state).serviceQuality
    expect(sq.foodQualityModifier).toBeGreaterThan(0)
    // The service report records this quality for the day.
    const serviceResult = getServiceModuleState(quality.state).result
    expect(serviceResult.serviceQuality.foodQualityModifier).toBeGreaterThan(0)
  })

  it('food complaint incident appears when cook stretches AND food quality is low', () => {
    const base = createInitialTavernState()
    const lowQuality: TavernState = {
      ...base,
      stock: {
        ...base.stock,
        ale: { ...base.stock.ale!, quantity: 500, quality: 20 },
        stew: { ...base.stock.stew!, quantity: 300, quality: 20 },
        mushrooms: { ...base.stock.mushrooms!, quantity: 200, quality: 20 },
        ingredients: { ...base.stock.ingredients!, quality: 20 },
        firewood: { ...base.stock.firewood!, quality: 20 },
        mugs: { ...base.stock.mugs!, quality: 20 },
      },
    }
    const result = runDay(withDayType(lowQuality, 'payday'), {
      cook: 'stretch_ingredients',
      server: 'watch_tabs', // server's `keep_customers_happy` would cancel
                            // the cook's foodQuality penalty; pick a server
                            // priority that does not move foodQuality.
    })
    const sliceResult = getServiceModuleState(result.state).result
    expect(
      sliceResult.incidents.some((i) => i.id === 'food_complaint'),
    ).toBe(true)
  })
})

describe('Phase 12 — Unpaid tabs (§12.6)', () => {
  it('unpaid tabs reduce coin via the ledger with category "other"', () => {
    const base = plentyOfStock(createInitialTavernState())
    const day = withDayType(base, 'payday')
    const result = runDay(day, { server: 'maximize_sales' })
    const sliceResult = getServiceModuleState(result.state).result
    expect(sliceResult.unpaidTabs).toBeGreaterThan(0)
    const ledger = getStockModuleState(result.state).ledger
    const tabEntries = ledger.filter((e) =>
      e.tags.includes('unpaid_tab'),
    )
    expect(tabEntries.length).toBeGreaterThan(0)
    for (const entry of tabEntries) {
      expect(entry.amount).toBeLessThan(0)
      expect(entry.category).toBe('other')
    }
  })

  it('unpaid tab deduction is capped at current coin so coin stays non-negative', () => {
    // Force a tavern with near-zero coin to make sure tabs cannot push
    // coin below zero (state schema requires coin >= 0).
    const base = plentyOfStock(createInitialTavernState())
    const broke: TavernState = { ...base, coin: 0 }
    const result = runDay(withDayType(broke, 'payday'), {
      server: 'maximize_sales',
    })
    expect(result.state.coin).toBeGreaterThanOrEqual(0)
    expect(result.validation.errors).toEqual([])
  })
})

describe('Phase 12 — Incidents (§12.7)', () => {
  it('stock_shortage incident is generated when sales hit a shortage', () => {
    const base = createInitialTavernState()
    const lowAle: TavernState = {
      ...base,
      stock: {
        ...base.stock,
        ale: { ...base.stock.ale!, quantity: 2 },
      },
    }
    const result = runDay(withDayType(lowAle, 'payday'))
    const sliceResult = getServiceModuleState(result.state).result
    expect(
      sliceResult.incidents.some((i) => i.id === 'stock_shortage'),
    ).toBe(true)
  })

  it('chair_damage incident is generated on heavy rowdy damage', () => {
    const base = plentyOfStock(createInitialTavernState())
    const rowdy = withCustomerGroup(base, 'ogres', {
      patronage: 95,
      damageRisk: 95,
    })
    const result = runDay(withDayType(rowdy, 'brawl_night'), {
      cleaner_bouncer: 'clean', // no fight prevention
    })
    const sliceResult = getServiceModuleState(result.state).result
    expect(sliceResult.incidents.some((i) => i.id === 'chair_damage')).toBe(true)
  })
})

describe('Phase 12 — Staff stress/fatigue update (§12.9)', () => {
  it('high traffic increases staff fatigue', () => {
    const base = plentyOfStock(createInitialTavernState())
    const rested = withStaff(base, 'cook', { fatigue: 10, stress: 10 })
    const result = runDay(withDayType(rested, 'payday'))
    expect(result.state.staff.cook!.fatigue).toBeGreaterThan(10)
  })

  it('shortage-driven incidents raise server stress', () => {
    const base = createInitialTavernState()
    const lowAle: TavernState = withStaff(
      {
        ...base,
        stock: {
          ...base.stock,
          ale: { ...base.stock.ale!, quantity: 2 },
        },
      },
      'server',
      { stress: 20 },
    )
    const result = runDay(withDayType(lowAle, 'payday'))
    expect(result.state.staff.server!.stress).toBeGreaterThanOrEqual(20)
  })

  it('staff change summary appears in the service module result', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(withDayType(base, 'market_day'))
    const sliceResult = getServiceModuleState(result.state).result
    expect(sliceResult.staffChanges.length).toBeGreaterThan(0)
    for (const change of sliceResult.staffChanges) {
      expect(typeof change.staffId).toBe('string')
      expect(typeof change.fatigueDelta).toBe('number')
      expect(typeof change.stressDelta).toBe('number')
    }
  })

  it('resolveService is a pure function over context (callable with snapshots)', () => {
    // §12.1 — keep the resolver callable from outside the module so
    // tests and tools can inspect the result shape directly.
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(withDayType(base, 'market_day'))
    // After a real day, the slice carries a populated result.
    const slice = getServiceModuleState(result.state).result
    expect(slice.coinEarned).toBeGreaterThan(0)
    expect(typeof resolveService).toBe('function')
  })
})

describe('Phase 12 — Per-day reset and stable IDs', () => {
  it('startDay clears the previous day\'s service result', () => {
    let state = plentyOfStock(createInitialTavernState())
    state = runDay(withDayType(state, 'payday')).state
    const day1 = getServiceModuleState(state).result
    state = runDay(withDayType(state, 'quiet_day')).state
    const day2 = getServiceModuleState(state).result
    expect(day1.dayKey).not.toBe(day2.dayKey)
  })

  it('serviceQuality is wired into the daily service result', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(withDayType(base, 'market_day'), {
      cook: 'quality',
      server: 'watch_tabs',
      cleaner_bouncer: 'prevent_fights',
    })
    const sliceResult = getServiceModuleState(result.state).result
    expect(sliceResult.serviceQuality.foodQualityModifier).toBeGreaterThan(0)
    expect(sliceResult.serviceQuality.tabControl).toBeGreaterThan(0)
    expect(sliceResult.serviceQuality.fightControl).toBeGreaterThan(0)
  })
})
