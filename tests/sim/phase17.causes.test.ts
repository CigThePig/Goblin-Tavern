import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import {
  DEFAULT_THRESHOLDS,
  createStateDiff,
  filterSignificantChanges,
} from '../../src/sim/core/diff'
import type { SimInput } from '../../src/sim/core/context'

import { areasModule } from '../../src/sim/modules/areas/index'
import { customersModule } from '../../src/sim/modules/customers/index'
import { ownerActionsModule } from '../../src/sim/modules/ownerActions/index'
import { serviceModule } from '../../src/sim/modules/service/index'
import { staffModule } from '../../src/sim/modules/staff/index'
import { stockModule } from '../../src/sim/modules/stock/index'
import { weeklyModule } from '../../src/sim/modules/weekly/index'
import { monthlyModule } from '../../src/sim/modules/monthly/index'
import {
  memoriesModule,
} from '../../src/sim/modules/memories/index'
import { historyModule } from '../../src/sim/modules/history/index'
import {
  CAUSES_MODULE_ID,
  causeRegistry,
  causesModule,
  ageCauses,
  DEFAULT_CAUSE_EXPIRY_DAYS,
  explainCustomerSatisfaction,
  explainPressure,
  findUnexplainedSignificantChanges,
  getCausesForTarget,
  getRecentCauses,
} from '../../src/sim/modules/causes/index'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  withArea,
  withCoin,
  withCustomerGroup,
  withStock,
} from '../../src/sim/testing/stateFactories'
import type { CauseEntry, TavernState } from '../../src/sim/state/TavernState'

// Phase 17 — Cause tracking & state diff tests.
//
// Covers the cases in `phases-16-20.md` §17 "Tests" plus a few
// structural assertions that mirror the Phase 16 precedents.

const SEED = 'phase-17-causes-test'

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

function findCause(
  state: TavernState,
  predicate: (c: CauseEntry) => boolean,
): CauseEntry | undefined {
  return state.causes.find(predicate)
}

describe('Phase 17 — Module shape', () => {
  it('causesModule registers id, hooks, schema, report, and validator', () => {
    expect(causesModule.id).toBe(CAUSES_MODULE_ID)
    expect(causesModule.id).toBe('causes')
    expect(causesModule.hooks?.startDay).toBeDefined()
    expect(causesModule.hooks?.endDay).toBeDefined()
    expect(causesModule.buildReport).toBeTypeOf('function')
    expect(causesModule.validate).toBeTypeOf('function')
    expect(causesModule.stateSchema).toBeDefined()
  })

  it('causeRegistry self-registers the Phase 17 base templates', () => {
    const required = [
      'rent_missed_landlord_pressure',
      'inspection_warning_inspection_pressure',
      'unpaid_wages_morale',
      'paid_wages_morale',
    ]
    for (const id of required) {
      expect(causeRegistry.has(id), `expected cause '${id}' to be registered`).toBe(
        true,
      )
    }
  })

  it('initial state seeds causes as an empty array', () => {
    const state = createInitialTavernState()
    expect(state.causes).toEqual([])
  })
})

describe('Phase 17 §17.1 — State diff', () => {
  it('detects numeric changes between snapshots', () => {
    const before = createInitialTavernState()
    let after = withCoin(before, before.coin + 12)
    after = withArea(after, 'kitchen', { cleanliness: 80 })
    const diff = createStateDiff(before, after)
    const coinChange = diff.changes.find((c) => c.path === 'coin')
    expect(coinChange).toBeDefined()
    expect(coinChange?.delta).toBe(12)
    const kitchenChange = diff.changes.find(
      (c) => c.path === 'areas.kitchen.cleanliness',
    )
    expect(kitchenChange).toBeDefined()
  })

  it('ignores tiny noisy changes when filtering significant', () => {
    const before = createInitialTavernState()
    const after = withArea(before, 'kitchen', {
      cleanliness: before.areas.kitchen!.cleanliness + 1,
    })
    const diff = createStateDiff(before, after)
    expect(diff.changes.length).toBe(1)
    const significant = filterSignificantChanges(diff, DEFAULT_THRESHOLDS)
    expect(significant.length).toBe(0)
  })

  it('large meter shifts cross the significance threshold', () => {
    const before = createInitialTavernState()
    const after = withArea(before, 'kitchen', {
      cleanliness: before.areas.kitchen!.cleanliness + 25,
    })
    const diff = createStateDiff(before, after)
    expect(diff.significantChanges.length).toBe(1)
    expect(diff.significantChanges[0]!.path).toBe('areas.kitchen.cleanliness')
  })

  it('reputation and pressure changes use their own thresholds', () => {
    const before = createInitialTavernState()
    const after: TavernState = {
      ...before,
      reputation: { ...before.reputation, filthy: before.reputation.filthy + 7 },
      pressures: {
        ...before.pressures,
        debt: { ...before.pressures.debt!, value: before.pressures.debt!.value + 10 },
      },
    }
    const diff = createStateDiff(before, after)
    const repChange = diff.significantChanges.find(
      (c) => c.path === 'reputation.filthy',
    )
    const pressureChange = diff.significantChanges.find(
      (c) => c.path === 'pressures.debt.value',
    )
    expect(repChange).toBeDefined()
    expect(pressureChange).toBeDefined()
  })
})

describe('Phase 17 §17.3 — Owner actions create causes', () => {
  it('clean_area creates a cause for area cleanliness increase', () => {
    const dirty = withArea(plentyOfStock(createInitialTavernState()), 'kitchen', {
      cleanliness: 10,
    })
    const result = runDay(dirty, {
      ownerActions: [{ actionId: 'clean_area', targetId: 'kitchen' }],
    })
    const cause = findCause(
      result.state,
      (c) =>
        c.tags.includes('clean_area') &&
        c.target === 'area:kitchen.cleanliness',
    )
    expect(cause).toBeDefined()
    expect(cause!.direction).toBe('increase')
    expect(cause!.amount).toBeGreaterThan(0)
    expect(cause!.sourceType).toBe('owner_action')
    expect(cause!.readable).toMatch(/cleaned/i)
  })

  it('water_down_ale creates a cause for ale quality decrease', () => {
    const result = runDay(plentyOfStock(createInitialTavernState()), {
      ownerActions: [{ actionId: 'water_down_ale' }],
    })
    const cause = findCause(
      result.state,
      (c) => c.tags.includes('water_down_ale') && c.target === 'stock:ale.quality',
    )
    expect(cause).toBeDefined()
    expect(cause!.direction).toBe('decrease')
    expect(cause!.amount).toBeLessThan(0)
    expect(cause!.tags).toContain('deception')
  })

  it('repair_area creates a cause attributing the damage drop', () => {
    const damaged = withArea(plentyOfStock(createInitialTavernState()), 'main_room', {
      damage: 60,
    })
    const withMoney = withCoin(damaged, 200)
    const result = runDay(withMoney, {
      ownerActions: [{ actionId: 'repair_area', targetId: 'main_room' }],
    })
    const cause = findCause(
      result.state,
      (c) => c.tags.includes('repair_area') && c.target === 'area:main_room.damage',
    )
    expect(cause).toBeDefined()
    expect(cause!.direction).toBe('decrease')
  })
})

describe('Phase 17 §17.4 — Service-time causes', () => {
  it('rowdy traffic creates a cause for main room damage', () => {
    // Boost rowdiness & damageRisk to guarantee main_room damage on day 1.
    let base = plentyOfStock(createInitialTavernState())
    base = withCustomerGroup(base, 'ogres', {
      patronage: 80,
      rowdiness: 90,
      damageRisk: 95,
    })
    const result = runDay(base)
    const damageCause = findCause(result.state, (c) =>
      c.target === 'area:main_room.damage',
    )
    expect(damageCause).toBeDefined()
    expect(damageCause!.sourceType).toBe('service')
    expect(damageCause!.direction).toBe('increase')
    expect(damageCause!.relatedActors.some((a) => a.kind === 'customer_group')).toBe(
      true,
    )
  })

  it('dirty main room creates a cause for merchant satisfaction drop', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'main_room', { cleanliness: 10 })
    base = withCustomerGroup(base, 'merchants', { patronage: 70 })
    const result = runDay(base)
    const cleanlinessCause = findCause(result.state, (c) =>
      c.target === 'customer:merchants.satisfaction' &&
      c.tags.includes('cleanliness'),
    )
    expect(cleanlinessCause).toBeDefined()
    expect(cleanlinessCause!.direction).toBe('decrease')
  })
})

describe('Phase 17 §17.5 — Weekly & monthly causes', () => {
  it('unpaid wages create a cause for morale drop', () => {
    let base = withCoin(createInitialTavernState(), 0)
    for (const id of Object.keys(base.stock)) {
      base = withStock(base, id, { quantity: 0 })
    }
    const final = runManyDays(base, 7)
    const cause = final.causes.find(
      (c) => c.tags.includes('unpaid') && c.tags.includes('morale'),
    )
    expect(cause).toBeDefined()
    expect(cause!.sourceType).toBe('weekly')
    expect(cause!.direction).toBe('decrease')
    expect(cause!.relatedActors.length).toBeGreaterThan(0)
  })

  it('missed rent creates a cause for landlord pressure increase', () => {
    let base = withCoin(createInitialTavernState(), 0)
    for (const id of Object.keys(base.stock)) {
      base = withStock(base, id, { quantity: 0 })
    }
    const final = runManyDays(base, 28)
    const cause = final.causes.find(
      (c) =>
        c.target === 'pressure:landlord' &&
        c.tags.includes('unpaid'),
    )
    expect(cause).toBeDefined()
    expect(cause!.direction).toBe('increase')
    expect(cause!.weight).toBeGreaterThan(0)
  })
})

describe('Phase 17 §17.6 — Cause aging', () => {
  it('causes age each day and expire after their configured duration', () => {
    const now = createInitialTavernState().calendar
    const cause: CauseEntry = {
      id: 'sample',
      timestamp: {
        year: now.year,
        month: now.month,
        week: now.week,
        day: now.day,
        absoluteDay: now.totalDaysElapsed,
      },
      source: 'test',
      sourceType: 'system',
      target: 'global',
      targetType: 'global',
      amount: 0,
      direction: 'neutral',
      weight: 10,
      readable: 'test',
      tags: [],
      relatedActors: [],
      relatedLocations: [],
      relatedSystems: [],
      ageDays: 0,
      expiresAfterDays: 2,
    }
    const after1 = ageCauses([cause], 1)
    expect(after1.next[0]!.ageDays).toBe(1)
    expect(after1.expired.length).toBe(0)
    const after2 = ageCauses(after1.next, 1)
    expect(after2.next.length).toBe(0)
    expect(after2.expired[0]?.id).toBe('sample')
  })

  it('causes fall off after the default lifespan when none is set', () => {
    let state = plentyOfStock(createInitialTavernState())
    state = runDay(state, {
      ownerActions: [{ actionId: 'clean_area', targetId: 'main_room' }],
    }).state
    const cause = state.causes.find(
      (c) => c.tags.includes('clean_area') && c.target === 'area:main_room.cleanliness',
    )
    expect(cause).toBeDefined()
    // Age past the default expiry window.
    for (let i = 0; i < DEFAULT_CAUSE_EXPIRY_DAYS + 1; i += 1) {
      state = runDay(state).state
    }
    const stillThere = state.causes.find(
      (c) => c.tags.includes('clean_area') && c.target === 'area:main_room.cleanliness',
    )
    expect(stillThere).toBeUndefined()
  })
})

describe('Phase 17 §17.7 — Explanation queries', () => {
  it('explainCustomerSatisfaction returns relevant causes', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'main_room', { cleanliness: 10 })
    base = withCustomerGroup(base, 'merchants', { patronage: 70 })
    const result = runDay(base)
    const causes = explainCustomerSatisfaction(result.state, 'merchants')
    expect(causes.length).toBeGreaterThan(0)
    expect(
      causes.some((c) => c.target === 'customer:merchants.satisfaction'),
    ).toBe(true)
  })

  it('explainPressure returns landlord causes after a missed rent month', () => {
    let base = withCoin(createInitialTavernState(), 0)
    for (const id of Object.keys(base.stock)) {
      base = withStock(base, id, { quantity: 0 })
    }
    const final = runManyDays(base, 28)
    const causes = explainPressure(final, 'landlord')
    expect(causes.length).toBeGreaterThan(0)
  })

  it('getRecentCauses respects the day window', () => {
    let state = plentyOfStock(createInitialTavernState())
    state = runDay(state, {
      ownerActions: [{ actionId: 'water_down_ale' }],
    }).state
    const today = getRecentCauses(state, 1)
    expect(today.length).toBeGreaterThan(0)
    expect(getRecentCauses(state, 0)).toEqual([])
  })

  it('getCausesForTarget filters by target string', () => {
    let state = plentyOfStock(createInitialTavernState())
    state = runDay(state, {
      ownerActions: [{ actionId: 'water_down_ale' }],
    }).state
    const causes = getCausesForTarget(state, 'stock:ale.quality')
    expect(causes.length).toBe(1)
    expect(causes[0]!.tags).toContain('water_down_ale')
  })
})

describe('Phase 17 §17.8 / ISSUE-036 — Day-boundary state diffs', () => {
  // Phase 76 (ISSUE-036): the tagged `owner_actions` / `service` /
  // `end_week` / `end_month` boundaries were removed — no production
  // consumer read them, and the `service` boundary was finalized five
  // phase slots before `generateReports`. The `'day'` boundary
  // surfaces the full mechanical movement of a simulated day.
  it('SimResult carries a single day-boundary diff per simulated day', () => {
    const result = runDay(plentyOfStock(createInitialTavernState()), {
      ownerActions: [{ actionId: 'water_down_ale' }],
    })
    const boundaries = result.diffs.map((d) => d.boundary)
    expect(boundaries).toEqual(['day'])
  })

  it('day diff captures the ale watered-down effect', () => {
    const result = runDay(plentyOfStock(createInitialTavernState()), {
      ownerActions: [{ actionId: 'water_down_ale' }],
    })
    const dayDiff = result.diffs.find((d) => d.boundary === 'day')
    expect(dayDiff).toBeDefined()
    const aleQuality = dayDiff!.changes.find(
      (c) => c.path === 'stock.ale.quality',
    )
    expect(aleQuality).toBeDefined()
    expect(aleQuality!.delta).toBeLessThan(0)
  })

  it('day diff still fires on week-closing days', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 600)
    let state = base
    let result = runDay(state)
    state = result.state
    for (let i = 1; i < 7; i += 1) {
      result = runDay(state)
      state = result.state
    }
    const dayDiff = result.diffs.find((d) => d.boundary === 'day')
    expect(dayDiff).toBeDefined()
  })
})

describe('Phase 17 §17.9 — Cause report & unexplained changes', () => {
  it('cause report flags unexplained significant changes', () => {
    // Construct a synthetic state diff with a change that has no cause.
    const before = createInitialTavernState()
    const after = withCoin(before, before.coin + 50)
    const diff = createStateDiff(before, after)
    const tagged = { ...diff, boundary: 'day' as const }
    const unexplained = findUnexplainedSignificantChanges(tagged, [])
    expect(unexplained.length).toBeGreaterThan(0)
    expect(unexplained.some((c) => c.path === 'coin')).toBe(true)
  })

  it('cause report appears in the SimResult reports list', () => {
    const result = runDay(plentyOfStock(createInitialTavernState()), {
      ownerActions: [{ actionId: 'water_down_ale' }],
    })
    const report = result.reports.find((r) => r.id === 'causes')
    expect(report).toBeDefined()
    expect(report!.lines.join('\n')).toMatch(/Top causes/i)
    expect(report!.lines.join('\n')).toMatch(/Unexplained/i)
  })

  it('cause report data payload exposes counts', () => {
    const result = runDay(plentyOfStock(createInitialTavernState()), {
      ownerActions: [{ actionId: 'water_down_ale' }],
    })
    const report = result.reports.find((r) => r.id === 'causes')
    const data = report!.data as {
      activeCount: number
      newTodayCount: number
      unexplainedCount: number
    }
    expect(data.activeCount).toBeGreaterThanOrEqual(1)
    expect(data.newTodayCount).toBeGreaterThanOrEqual(1)
  })
})

describe('Phase 17 §17.2.1 — Mutation contract & pressure helper', () => {
  it('modifyPressure clamps to 0–100 and refuses unknown ids', () => {
    expect(() =>
      simulateDay(
        plentyOfStock(createInitialTavernState()),
        { seed: SEED },
        [
          causesModule,
          {
            id: 'phase17-pressure-test',
            version: '0.0.0',
            dependsOn: ['causes'],
            hooks: {
              startDay: [
                (ctx) => {
                  ctx.modifyPressure('not_a_real_pressure', 5, {
                    source: 'test',
                    readable: 'test',
                  })
                },
              ],
            },
          },
        ],
      ),
    ).toThrow(/unknown pressure id/)
  })

  it('modifyPressure clamps and records direction on the state', () => {
    const result = simulateDay(
      plentyOfStock(createInitialTavernState()),
      { seed: SEED },
      [
        causesModule,
        {
          id: 'phase17-pressure-bump',
          version: '0.0.0',
          dependsOn: ['causes'],
          hooks: {
            startDay: [
              (ctx) => {
                ctx.modifyPressure('debt', 200, {
                  source: 'test',
                  readable: 'huge debt spike',
                  targetType: 'pressure',
                  target: 'pressure:debt',
                })
                ctx.addCause({
                  source: 'test',
                  target: 'pressure:debt',
                  targetType: 'pressure',
                  amount: 200,
                  readable: 'huge debt spike',
                })
              },
            ],
          },
        },
      ],
    )
    expect(result.state.pressures.debt!.value).toBeLessThanOrEqual(100)
    expect(result.state.pressures.debt!.value).toBeGreaterThanOrEqual(0)
  })

  it('ctx.addCause appends entries with valid Phase 17 shape', () => {
    const result = simulateDay(
      plentyOfStock(createInitialTavernState()),
      { seed: SEED },
      [
        causesModule,
        {
          id: 'phase17-addcause-test',
          version: '0.0.0',
          dependsOn: ['causes'],
          hooks: {
            startDay: [
              (ctx) => {
                ctx.addCause({
                  source: 'test',
                  target: 'global',
                  targetType: 'global',
                  amount: 0,
                  readable: 'a test cause',
                  tags: ['phase17'],
                })
              },
            ],
          },
        },
      ],
    )
    const cause = result.state.causes.find((c) => c.tags.includes('phase17'))
    expect(cause).toBeDefined()
    expect(cause!.timestamp.absoluteDay).toBeGreaterThanOrEqual(0)
    expect(cause!.weight).toBeGreaterThanOrEqual(0)
    expect(cause!.ageDays).toBe(1)
    expect(cause!.direction).toBe('neutral')
  })
})

describe('Phase 17 — State safety', () => {
  it('state validates after causes have been added and aged', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 600)
    const result = runDay(base, {
      ownerActions: [{ actionId: 'water_down_ale' }],
    })
    expect(result.validation.errors).toEqual([])
  })

  it('state validates after a full month with causes active', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 600)
    let state = base
    let lastResult
    for (let i = 0; i < 28; i += 1) {
      lastResult = runDay(state)
      state = lastResult.state
    }
    expect(lastResult!.validation.errors).toEqual([])
  })
})
