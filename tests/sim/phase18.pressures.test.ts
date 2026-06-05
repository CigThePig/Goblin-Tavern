import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'

import { areasModule } from '../../src/sim/modules/areas/index'
import { customersModule } from '../../src/sim/modules/customers/index'
import { ownerActionsModule } from '../../src/sim/modules/ownerActions/index'
import { serviceModule } from '../../src/sim/modules/service/index'
import { staffModule } from '../../src/sim/modules/staff/index'
import { stockModule } from '../../src/sim/modules/stock/index'
import { weeklyModule } from '../../src/sim/modules/weekly/index'
import { monthlyModule } from '../../src/sim/modules/monthly/index'
import { memoriesModule } from '../../src/sim/modules/memories/index'
import { historyModule } from '../../src/sim/modules/history/index'
import { causesModule } from '../../src/sim/modules/causes/index'
import {
  PRESSURE_IDS,
  PRESSURES_MODULE_ID,
  getPressureModuleState,
  getPressureSnapshot,
  getAllPressureSnapshots,
  getDominantPressures,
  getRisingPressures,
  pressureRegistry,
  pressuresModule,
  REQUIRED_PRESSURE_DEFINITIONS,
} from '../../src/sim/modules/pressures/index'
import {
  feedbackLoopRegistry,
  feedbackModule,
  getFeedbackModuleState,
} from '../../src/sim/modules/feedback/index'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  withArea,
  withCoin,
  withCustomerGroup,
  withStaff,
  withStock,
} from '../../src/sim/testing/stateFactories'
import type { TavernState } from '../../src/sim/state/TavernState'
import type {
  MonthlyModuleState,
  RentState,
} from '../../src/sim/modules/monthly/types'

const SEED = 'phase-18-pressures-test'

const MODULE_SLICE = [
  areasModule,
  stockModule,
  staffModule,
  customersModule,
  ownerActionsModule,
  serviceModule,
  weeklyModule,
  monthlyModule,
  memoriesModule,
  historyModule,
  causesModule,
  pressuresModule,
  feedbackModule,
]

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

function runDay(state: TavernState, overrides: Partial<SimInput> = {}) {
  return simulateDay(state, input(overrides), MODULE_SLICE)
}

function runManyDays(
  state: TavernState,
  days: number,
  overrides: Partial<SimInput> = {},
): TavernState {
  let current = state
  for (let i = 0; i < days; i += 1) {
    current = runDay(current, overrides).state
  }
  return current
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

function withDayType(state: TavernState, dayType: TavernState['calendar']['dayType']): TavernState {
  return {
    ...state,
    calendar: { ...state.calendar, dayType },
  }
}

function withLandlordPressure(state: TavernState, pressure: number, missedCount: number): TavernState {
  const monthly = (state.modules['monthly'] ?? null) as MonthlyModuleState | null
  if (!monthly) return state
  return {
    ...state,
    modules: {
      ...state.modules,
      monthly: {
        ...monthly,
        landlord: {
          ...monthly.landlord,
          pressure,
          missedRentCount: missedCount,
        },
      },
    },
  }
}

function withRentArrears(state: TavernState, arrears: number, paid: boolean): TavernState {
  const monthly = (state.modules['monthly'] ?? null) as MonthlyModuleState | null
  if (!monthly) return state
  const rent: RentState = {
    ...monthly.rent,
    arrears,
    paidThisMonth: paid,
    missedPayments: paid ? monthly.rent.missedPayments : monthly.rent.missedPayments + 1,
  }
  return {
    ...state,
    modules: {
      ...state.modules,
      monthly: { ...monthly, rent },
    },
  }
}

describe('Phase 18 — Module shape', () => {
  it('pressuresModule registers id, hooks, schema, report, and validator', () => {
    expect(pressuresModule.id).toBe(PRESSURES_MODULE_ID)
    expect(pressuresModule.id).toBe('pressures')
    expect(pressuresModule.hooks?.closing).toBeDefined()
    expect(pressuresModule.buildReport).toBeTypeOf('function')
    expect(pressuresModule.validate).toBeTypeOf('function')
    expect(pressuresModule.stateSchema).toBeDefined()
  })

  it('pressure registry self-registers the 10 canonical pressures', () => {
    // Phase 38 §38.1 — expanded pressures register alongside the canonical
    // ten, so check containment instead of exact equality.
    const ids = pressureRegistry.all().map((p) => p.id)
    for (const id of PRESSURE_IDS) {
      expect(ids).toContain(id)
    }
    expect(REQUIRED_PRESSURE_DEFINITIONS.length).toBe(10)
  })

  it('feedback loop registry self-registers the 6 required loops', () => {
    // Phase 38 §38.15 — expanded loops register alongside the canonical
    // six, so check containment instead of exact equality.
    const ids = feedbackLoopRegistry.all().map((l) => l.id)
    for (const required of [
      'deferred_maintenance_revenue_spiral',
      'staff_burnout_service_decline_loop',
      'rowdy_damage_identity_loop',
      'cheap_low_quality_reputation_loop',
      'stock_shortage_reliability_loop',
      'filth_merchant_loss_loop',
    ]) {
      expect(ids).toContain(required)
    }
  })

  it('initial state seeds the pressure & feedback module slices', () => {
    const state = createInitialTavernState()
    const slice = getPressureModuleState(state)
    expect(slice.snapshots).toEqual({})
    expect(slice.history).toEqual({})
    expect(slice.lastCalculatedDay).toBe(-1)
    const feedback = getFeedbackModuleState(state)
    expect(feedback.loops).toEqual({})
    expect(feedback.activeLoopIds).toEqual([])
  })
})

describe('Phase 18 §18.2 — Food safety pressure', () => {
  it('dirty kitchen raises food safety pressure', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'kitchen', { cleanliness: 15, smell: 70 })
    const result = runDay(base)
    const snapshot = getPressureSnapshot(result.state, 'food_safety')
    expect(snapshot).toBeDefined()
    expect(snapshot!.value).toBeGreaterThan(20)
    expect(snapshot!.causes.some((c) => c.id === 'kitchen_filthy_heavy')).toBe(true)
  })

  it('spoiled mushrooms raise food safety pressure', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withStock(base, 'mushrooms', { spoilage: 80 })
    const result = runDay(base)
    const snapshot = getPressureSnapshot(result.state, 'food_safety')
    expect(snapshot).toBeDefined()
    expect(snapshot!.causes.some((c) => c.id === 'mushrooms_spoiled')).toBe(true)
  })

  it('clean kitchen lowers food safety pressure', () => {
    let dirty = plentyOfStock(createInitialTavernState())
    dirty = withArea(dirty, 'kitchen', { cleanliness: 15 })
    let clean = plentyOfStock(createInitialTavernState())
    clean = withArea(clean, 'kitchen', { cleanliness: 90, smell: 10 })
    const dirtyResult = runDay(dirty)
    const cleanResult = runDay(clean)
    const dirtyValue = getPressureSnapshot(dirtyResult.state, 'food_safety')!.value
    const cleanValue = getPressureSnapshot(cleanResult.state, 'food_safety')!.value
    expect(cleanValue).toBeLessThan(dirtyValue)
  })
})

describe('Phase 18 §18.3 — Inspection pressure', () => {
  it('high food safety + privy smell raises inspection pressure', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'kitchen', { cleanliness: 15, smell: 75 })
    base = withArea(base, 'privy', { smell: 80 })
    base = withStock(base, 'mushrooms', { spoilage: 80 })
    base = withStock(base, 'stew', { spoilage: 80, quantity: 400 })
    const result = runDay(base)
    const snapshot = getPressureSnapshot(result.state, 'inspection')
    expect(snapshot).toBeDefined()
    expect(snapshot!.value).toBeGreaterThan(15)
    const causeIds = snapshot!.causes.map((c) => c.id)
    expect(causeIds.some((id) => id.startsWith('privy_'))).toBe(true)
  })
})

describe('Phase 18 §18.4 — Staff burnout pressure', () => {
  it('unpaid wages and high fatigue raise staff burnout pressure', () => {
    let base = plentyOfStock(createInitialTavernState())
    const staffIds = Object.keys(base.staff)
    for (const id of staffIds) {
      base = withStaff(base, id, {
        paidThisWeek: false,
        stress: 80,
        fatigue: 80,
        morale: 25,
      })
    }
    const result = runDay(base)
    const snapshot = getPressureSnapshot(result.state, 'staff_burnout')
    expect(snapshot).toBeDefined()
    expect(snapshot!.value).toBeGreaterThan(40)
    expect(snapshot!.causes.some((c) => c.id === 'unpaid_wages')).toBe(true)
  })
})

describe('Phase 18 §18.5 — Pest pressure', () => {
  it('dirty cellar raises pest pressure', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'cellar', { cleanliness: 15, smell: 75, risk: 65 })
    base = withStock(base, 'stew', { spoilage: 70, quantity: 400 })
    const result = runDay(base)
    const snapshot = getPressureSnapshot(result.state, 'pests')
    expect(snapshot).toBeDefined()
    expect(snapshot!.value).toBeGreaterThan(20)
    const causeIds = snapshot!.causes.map((c) => c.id)
    expect(causeIds.some((id) => id.startsWith('cellar_filthy_'))).toBe(true)
  })
})

describe('Phase 18 §18.6 — Debt pressure', () => {
  it('missed rent and arrears raise debt pressure above baseline', () => {
    const baseline = plentyOfStock(createInitialTavernState())
    let stressed = plentyOfStock(createInitialTavernState())
    stressed = withRentArrears(stressed, 250, false)
    stressed = withLandlordPressure(stressed, 30, 2)
    const baselineSnap = getPressureSnapshot(runDay(baseline).state, 'debt')!
    const stressedSnap = getPressureSnapshot(runDay(stressed).state, 'debt')!
    expect(stressedSnap.value).toBeGreaterThan(baselineSnap.value)
    expect(stressedSnap.causes.some((c) => c.id === 'arrears')).toBe(true)
    expect(
      stressedSnap.causes.some((c) => c.id === 'rent_missed_history'),
    ).toBe(true)
  })

  it('very low coin produces a debt cause', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withCoin(base, 5)
    // Suppress customer income so coin stays low through closing.
    for (const id of Object.keys(base.customerGroups)) {
      base = withCustomerGroup(base, id, { patronage: 0 })
    }
    // Also drain stock so any visitors that slip in cannot push coin up.
    for (const id of Object.keys(base.stock)) {
      base = withStock(base, id, { quantity: 0 })
    }
    const result = runDay(base)
    const snapshot = getPressureSnapshot(result.state, 'debt')!
    expect(
      snapshot.causes.some(
        (c) => c.id === 'coin_very_low' || c.id === 'coin_low',
      ),
    ).toBe(true)
  })
})

describe('Phase 18 §18.7 — Maintenance pressure', () => {
  it('damaged areas raise maintenance pressure', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'main_room', { damage: 75, condition: 25 })
    base = withArea(base, 'roof', { damage: 80, condition: 20 })
    base = withArea(base, 'privy', { condition: 25 })
    const result = runDay(base)
    const snapshot = getPressureSnapshot(result.state, 'maintenance')
    expect(snapshot).toBeDefined()
    expect(snapshot!.value).toBeGreaterThan(30)
    expect(snapshot!.causes.some((c) => c.id === 'roof_critical')).toBe(true)
  })
})

describe('Phase 18 §18.8 — Violence pressure', () => {
  it('ogre-heavy Brawl Night raises violence pressure', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withDayType(base, 'brawl_night')
    base = withCustomerGroup(base, 'ogres', { patronage: 80, rowdiness: 85 })
    const result = runDay(base)
    const snapshot = getPressureSnapshot(result.state, 'violence')
    expect(snapshot).toBeDefined()
    expect(snapshot!.value).toBeGreaterThan(20)
    const causeIds = snapshot!.causes.map((c) => c.id)
    expect(causeIds.some((id) => id === 'ogres_heavy' || id === 'ogres_rowdy')).toBe(true)
    expect(snapshot!.urgency).toBeGreaterThanOrEqual(snapshot!.severity)
  })
})

describe('Phase 18 §18.9 — Reputation drift pressure', () => {
  it('a single dominant customer group + extreme axes raise reputation drift', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withCustomerGroup(base, 'miners', { patronage: 90 })
    base = withCustomerGroup(base, 'merchants', { patronage: 5 })
    base = withCustomerGroup(base, 'ogres', { patronage: 5 })
    base = withCustomerGroup(base, 'adventurers', { patronage: 5 })
    base = withCustomerGroup(base, 'local_goblins', { patronage: 5 })
    base = {
      ...base,
      reputation: { ...base.reputation, cheap: 85, filthy: 90 },
    }
    const result = runDay(base)
    const snapshot = getPressureSnapshot(result.state, 'reputation_drift')
    expect(snapshot).toBeDefined()
    expect(snapshot!.value).toBeGreaterThan(15)
  })
})

describe('Phase 18 §18.10 — Stock shortage pressure', () => {
  it('ale shortage before Payday raises stock shortage urgency more than before Quiet Day', () => {
    let baseLow = plentyOfStock(createInitialTavernState())
    baseLow = withStock(baseLow, 'ale', { quantity: 10 })
    const payday = withDayType(baseLow, 'payday')
    const quiet = withDayType(baseLow, 'quiet_day')
    const paydayResult = runDay(payday)
    const quietResult = runDay(quiet)
    const paydaySnap = getPressureSnapshot(paydayResult.state, 'stock_shortage')!
    const quietSnap = getPressureSnapshot(quietResult.state, 'stock_shortage')!
    expect(paydaySnap.urgency).toBeGreaterThan(quietSnap.urgency)
    expect(paydaySnap.value).toBeGreaterThan(quietSnap.value)
  })
})

describe('Phase 18 §18 (canonical) — Landlord pressure', () => {
  it('missed rent history raises landlord pressure', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withLandlordPressure(base, 60, 2)
    base = withRentArrears(base, 250, false)
    const result = runDay(base)
    const snapshot = getPressureSnapshot(result.state, 'landlord')
    expect(snapshot).toBeDefined()
    expect(snapshot!.value).toBeGreaterThan(25)
    expect(snapshot!.causes.some((c) => c.id === 'missed_rent_count')).toBe(true)
  })
})

describe('Phase 18 §18.11 — Pressure trends', () => {
  it('pressure trend shows rising/falling correctly across multiple days', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'kitchen', { cleanliness: 90, smell: 10 })
    let state = base
    for (let i = 0; i < 3; i += 1) {
      state = runDay(state).state
    }
    // Now dirty it up — pressure should rise.
    state = withArea(state, 'kitchen', { cleanliness: 15, smell: 80 })
    state = withStock(state, 'mushrooms', { spoilage: 90 })
    state = withStock(state, 'stew', { spoilage: 80, quantity: 400 })
    for (let i = 0; i < 3; i += 1) {
      state = runDay(state).state
    }
    const snapshot = getPressureSnapshot(state, 'food_safety')!
    expect(snapshot.trend).toBe('rising')
  })

  it('cleaning lowers food safety pressure on subsequent days', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'kitchen', { cleanliness: 15, smell: 75 })
    base = withStock(base, 'mushrooms', { spoilage: 80 })
    base = withStock(base, 'stew', { spoilage: 80, quantity: 400 })
    let state = runDay(base).state
    const beforeClean = getPressureSnapshot(state, 'food_safety')!.value
    // Now clean & swap to fresh stock.
    state = withArea(state, 'kitchen', { cleanliness: 95, smell: 5 })
    state = withStock(state, 'mushrooms', { spoilage: 0 })
    state = withStock(state, 'stew', { spoilage: 0, quantity: 400 })
    state = runDay(state).state
    const afterClean = getPressureSnapshot(state, 'food_safety')!.value
    expect(afterClean).toBeLessThan(beforeClean)
  })
})

describe('Phase 18 §18.12 — Feedback loop detection', () => {
  it('filth_merchant_loss_loop activates under expected conditions', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'main_room', { cleanliness: 25 })
    base = withArea(base, 'kitchen', { cleanliness: 25 })
    base = withCustomerGroup(base, 'merchants', { satisfaction: 25, patronage: 25 })
    base = { ...base, reputation: { ...base.reputation, filthy: 70 } }
    const result = runDay(base)
    const feedback = getFeedbackModuleState(result.state)
    expect(feedback.activeLoopIds).toContain('filth_merchant_loss_loop')
    const loop = feedback.loops['filth_merchant_loss_loop']!
    expect(loop.strength).toBeGreaterThan(20)
  })

  it('staff_burnout_service_decline_loop activates under expected conditions', () => {
    let base = plentyOfStock(createInitialTavernState())
    const staffIds = Object.keys(base.staff)
    for (const id of staffIds) {
      base = withStaff(base, id, {
        paidThisWeek: false,
        stress: 80,
        fatigue: 80,
        morale: 20,
      })
    }
    base = withCustomerGroup(base, 'miners', { satisfaction: 20, patronage: 40 })
    const result = runDay(base)
    const feedback = getFeedbackModuleState(result.state)
    expect(feedback.activeLoopIds).toContain('staff_burnout_service_decline_loop')
  })

  it('feedback loops stay inactive on a clean baseline state', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withCoin(base, 600)
    for (const id of Object.keys(base.areas)) {
      base = withArea(base, id, { cleanliness: 85, damage: 10, condition: 90 })
    }
    for (const id of Object.keys(base.staff)) {
      base = withStaff(base, id, {
        paidThisWeek: true,
        stress: 30,
        fatigue: 30,
        morale: 75,
      })
    }
    const result = runDay(base)
    const feedback = getFeedbackModuleState(result.state)
    // We accept that 0–1 loops may glance active on the seed state, but
    // a full clean baseline must keep most loops dormant.
    expect(feedback.activeLoopIds.length).toBeLessThanOrEqual(1)
  })
})

describe('Phase 18 §18.13/18.14 — Reports', () => {
  it('pressure report lists dominant causes', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'kitchen', { cleanliness: 15, smell: 75 })
    const result = runDay(base)
    const report = result.reports.find((r) => r.id === 'pressures')
    expect(report).toBeDefined()
    const joined = report!.lines.join('\n')
    expect(joined).toMatch(/Pressure/i)
    expect(joined).toMatch(/Dominant causes/i)
    const data = report!.data as { snapshots?: unknown }
    expect(Array.isArray(data.snapshots)).toBe(true)
  })

  it('feedback loop report appears in the SimResult reports list', () => {
    const result = runDay(plentyOfStock(createInitialTavernState()))
    const report = result.reports.find((r) => r.id === 'feedback_loops')
    expect(report).toBeDefined()
    const data = report!.data as { totalCount?: number; activeIds?: string[] }
    // Phase 38 §38.15 — expanded loops join the registry. The canonical
    // six remain; assert at least that many are reported.
    expect(data.totalCount).toBeGreaterThanOrEqual(6)
    expect(Array.isArray(data.activeIds)).toBe(true)
  })

  it('pressure queries return sorted dominant pressures', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'kitchen', { cleanliness: 15, smell: 80 })
    base = withStock(base, 'mushrooms', { spoilage: 90 })
    base = withStock(base, 'stew', { spoilage: 90, quantity: 400 })
    const result = runDay(base)
    const dominant = getDominantPressures(result.state, 3)
    expect(dominant.length).toBe(3)
    expect(dominant[0]!.value).toBeGreaterThanOrEqual(dominant[1]!.value)
    // Phase 38 §38.1 — expanded pressures take the snapshot count above
    // the canonical ten; assert "at least ten" so the canonical
    // expectation still holds.
    expect(getAllPressureSnapshots(result.state).length).toBeGreaterThanOrEqual(10)
  })

  it('rising pressures helper returns only rising trends', () => {
    let base = plentyOfStock(createInitialTavernState())
    // Day 1: clean kitchen → low food safety.
    base = withArea(base, 'kitchen', { cleanliness: 95, smell: 5 })
    base = withStock(base, 'stew', { spoilage: 0, quantity: 400 })
    base = withStock(base, 'mushrooms', { spoilage: 0 })
    let state = runDay(base).state
    // Day 2+: dirty up.
    state = withArea(state, 'kitchen', { cleanliness: 10, smell: 80 })
    state = withStock(state, 'mushrooms', { spoilage: 90 })
    state = withStock(state, 'stew', { spoilage: 80, quantity: 400 })
    state = runDay(state).state
    state = runDay(state).state
    const rising = getRisingPressures(state).map((p) => p.id)
    expect(rising).toContain('food_safety')
  })
})

describe('Phase 18 — Pressure cause attribution', () => {
  it('a significant pressure shift adds a matching state cause', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'kitchen', { cleanliness: 10, smell: 80 })
    base = withStock(base, 'mushrooms', { spoilage: 90 })
    base = withStock(base, 'stew', { spoilage: 80, quantity: 400 })
    const result = runDay(base)
    const cause = result.state.causes.find(
      (c) => c.target === 'pressure:food_safety',
    )
    expect(cause).toBeDefined()
    expect(cause!.sourceType).toBe('pressure')
    expect(cause!.direction).toBe('increase')
  })

  it('pressure module records a history entry for significant shifts', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'kitchen', { cleanliness: 10, smell: 80 })
    base = withStock(base, 'mushrooms', { spoilage: 90 })
    base = withStock(base, 'stew', { spoilage: 80, quantity: 400 })
    const result = runDay(base)
    const entries = result.state.history.filter(
      (e) => e.category === 'pressure',
    )
    expect(entries.length).toBeGreaterThan(0)
    expect(entries.some((e) => e.tags.includes('food_safety'))).toBe(true)
  })
})

describe('Phase 18 — State safety', () => {
  it('state validates after pressure recalculation', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(base)
    expect(result.validation.errors).toEqual([])
  })

  it('state validates over a full month of pressure recalculations', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 600)
    const state = runManyDays(base, 28)
    void state
    // Re-run once more so we get a fresh SimResult to inspect.
    const result = runDay(state)
    expect(result.validation.errors).toEqual([])
  })

  it('pressure values stay clamped to 0–100 across many days', () => {
    let state = plentyOfStock(createInitialTavernState())
    state = withArea(state, 'kitchen', { cleanliness: 0, smell: 100 })
    state = withStock(state, 'mushrooms', { spoilage: 100 })
    for (let i = 0; i < 10; i += 1) {
      state = runDay(state).state
      for (const p of Object.values(state.pressures)) {
        expect(p.value).toBeGreaterThanOrEqual(0)
        expect(p.value).toBeLessThanOrEqual(100)
      }
    }
  })
})

