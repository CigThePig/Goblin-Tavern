import { describe, it, expect } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { areasModule } from '../../src/sim/modules/areas/index'
import {
  customersModule,
  getCustomerModuleState,
} from '../../src/sim/modules/customers/index'
import {
  actionRegistry,
  DAY_MINUTES,
  ensureRequiredOwnerActionsRegistered,
  getOwnerActionsModuleState,
  ownerActionsModule,
  OWNER_ACTIONS_MODULE_ID,
} from '../../src/sim/modules/ownerActions/index'
import {
  getServiceModuleState,
  serviceModule,
} from '../../src/sim/modules/service/index'
import { staffModule } from '../../src/sim/modules/staff/index'
import {
  getStockModuleState,
  stockModule,
} from '../../src/sim/modules/stock/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  withArea,
  withCoin,
  withStaff,
  withStock,
} from '../../src/sim/testing/stateFactories'
import type { DayType } from '../../src/sim/modules/calendar/types'
import type { TavernState } from '../../src/sim/state/TavernState'
import type {
  SimInputOwnerAction,
} from '../../src/sim/core/context'

// Phase 13 — Owner Action System.
//
// Tests cover the cases in `phases-11-15.md` §13 "Tests" plus
// structural assertions for the module wiring. Each action gets at
// least one mutation test; the budget cap, validation, report, and
// same-day service impact are exercised end-to-end against the real
// engine and the Phase 9 ledger.

const SEED = 'phase-13-owner-actions-test'

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

function input(actions?: ReadonlyArray<SimInputOwnerAction>) {
  if (actions) return { seed: SEED, ownerActions: actions }
  return { seed: SEED }
}

function runDay(
  state: TavernState,
  actions?: ReadonlyArray<SimInputOwnerAction>,
) {
  return simulateDay(state, input(actions), [
    areasModule,
    stockModule,
    staffModule,
    ownerActionsModule,
  ])
}

function runServiceDay(
  state: TavernState,
  actions?: ReadonlyArray<SimInputOwnerAction>,
) {
  // Used for the "actions affect same-day service" test — the full
  // service pipeline runs after `applyOwnerActions` (Phase 7 §7.1).
  return simulateDay(state, input(actions), [
    areasModule,
    stockModule,
    staffModule,
    customersModule,
    ownerActionsModule,
    serviceModule,
  ])
}

describe('Phase 13 — Owner action registry', () => {
  it('registers all ten required actions with action-point cost 1', () => {
    ensureRequiredOwnerActionsRegistered()
    // Phase 33 widens the registry with project, policy, and social
    // definitions. The Phase 13 set must still be present; the
    // assertion now uses containment so Phase 33 + later additions do
    // not require re-listing every action here.
    const ids = new Set(actionRegistry.all().map((a) => a.id))
    for (const id of [
      'clean_area',
      'repair_area',
      'restock_item',
      'adjust_prices',
      'pay_staff_bonus',
      'water_down_ale',
      'improve_stew',
      'patch_roof',
      'fumigate_cellar',
      'buy_mugs',
    ]) {
      expect(ids.has(id)).toBe(true)
    }
    for (const def of actionRegistry.all()) {
      // Phase 92 added `toggle_recipe_menu` as a zero-time logistical
      // toggle (flipping `RecipeState.onMenu` doesn't represent owner
      // labor). Every other action costs a positive span of minutes
      // (Phase 186 Cluster 3 — the AP economy is now time).
      if (def.id === 'toggle_recipe_menu') {
        expect(def.actionPointCost).toBe(0)
      } else {
        expect(def.actionPointCost).toBeGreaterThanOrEqual(1)
      }
      expect(typeof def.label).toBe('string')
      expect(Array.isArray(def.tags)).toBe(true)
      expect(typeof def.canApply).toBe('function')
      expect(typeof def.apply).toBe('function')
      expect(typeof def.getValidTargets).toBe('function')
    }
  })

  it('default day length is 360 minutes', () => {
    expect(DAY_MINUTES).toBe(360)
  })
})

describe('Phase 186 Cluster 3 — Daily time budget (§3.8)', () => {
  it('owner actions cannot exceed the daily time budget', () => {
    // clean_area costs TIME_COST_STANDARD (120m); three fill the
    // 360m day exactly, the fourth is rejected over-budget.
    const base = createInitialTavernState()
    const actions: SimInputOwnerAction[] = [
      { actionId: 'clean_area', targetId: 'kitchen' },
      { actionId: 'clean_area', targetId: 'main_room' },
      { actionId: 'clean_area', targetId: 'privy' },
      { actionId: 'clean_area', targetId: 'cellar' }, // over-budget
    ]
    const result = runDay(base, actions)
    const slice = getOwnerActionsModuleState(result.state)
    expect(slice.actionPointsUsed).toBe(360)
    expect(slice.applied).toHaveLength(3)
    expect(slice.rejected).toHaveLength(1)
    expect(slice.rejected[0]!.code).toBe('over_budget')
    expect(slice.rejected[0]!.targetId).toBe('cellar')
  })

  it('time spent resets between days', () => {
    const base = createInitialTavernState()
    const day1 = runDay(base, [{ actionId: 'clean_area', targetId: 'kitchen' }])
    expect(getOwnerActionsModuleState(day1.state).actionPointsUsed).toBe(120)
    const day2 = runDay(day1.state)
    expect(getOwnerActionsModuleState(day2.state).actionPointsUsed).toBe(0)
  })
})

describe('Phase 13 — clean_area (§13.3)', () => {
  it('clean_area improves cleanliness', () => {
    const base = withArea(createInitialTavernState(), 'kitchen', {
      cleanliness: 20,
      smell: 60,
    })
    const result = runDay(base, [{ actionId: 'clean_area', targetId: 'kitchen' }])
    expect(result.state.areas.kitchen!.cleanliness).toBeGreaterThan(20)
    expect(result.state.areas.kitchen!.smell).toBeLessThan(60)
  })
})

describe('Phase 13 — repair_area (§13.4)', () => {
  it('repair_area reduces damage and costs coin', () => {
    const base = withArea(createInitialTavernState(), 'main_room', {
      damage: 40,
      condition: 40,
    })
    const before = base.coin
    const result = runDay(base, [
      { actionId: 'repair_area', targetId: 'main_room' },
    ])
    expect(result.state.areas.main_room!.damage).toBeLessThan(40)
    expect(result.state.areas.main_room!.condition).toBeGreaterThan(40)
    expect(result.state.coin).toBeLessThan(before)
    const ledger = getStockModuleState(result.state).ledger
    expect(ledger.some((e) => e.category === 'repair')).toBe(true)
  })

  it('repair_area is rejected when coin is insufficient', () => {
    const base = withCoin(
      withArea(createInitialTavernState(), 'main_room', { damage: 80 }),
      0,
    )
    const result = runDay(base, [
      { actionId: 'repair_area', targetId: 'main_room' },
    ])
    const slice = getOwnerActionsModuleState(result.state)
    expect(slice.applied).toHaveLength(0)
    expect(slice.rejected[0]!.code).toBe('insufficient_coin')
    expect(result.state.areas.main_room!.damage).toBe(80)
  })

  it('repair_area is rejected when the area has no damage', () => {
    const base = withArea(createInitialTavernState(), 'roof', { damage: 0 })
    const result = runDay(base, [
      { actionId: 'repair_area', targetId: 'roof' },
    ])
    const slice = getOwnerActionsModuleState(result.state)
    expect(slice.rejected[0]!.code).toBe('nothing_to_repair')
  })
})

describe('Phase 13 — restock_item (§13.5)', () => {
  it('restock_item increases stock and costs coin', () => {
    const base = withCoin(
      withStock(createInitialTavernState(), 'ale', { quantity: 12 }),
      80,
    )
    const result = runDay(base, [
      { actionId: 'restock_item', targetId: 'ale', amount: 30 },
    ])
    expect(result.state.stock.ale!.quantity).toBe(42)
    expect(result.state.coin).toBeLessThan(80)
    const ledger = getStockModuleState(result.state).ledger
    expect(ledger.some((e) => e.category === 'purchase' && e.tags.includes('ale'))).toBe(
      true,
    )
  })

  it('restock_item is rejected when coin is insufficient', () => {
    const base = withCoin(createInitialTavernState(), 1)
    const result = runDay(base, [
      { actionId: 'restock_item', targetId: 'ale', amount: 40 },
    ])
    const slice = getOwnerActionsModuleState(result.state)
    expect(slice.rejected[0]!.code).toBe('insufficient_coin')
  })
})

describe('Phase 13 — adjust_prices (§13.6)', () => {
  it('adjust_prices changes the sale price', () => {
    const base = createInitialTavernState()
    const before = base.stock.ale!.salePrice
    const result = runDay(base, [
      { actionId: 'adjust_prices', targetId: 'ale', amount: 1 },
    ])
    expect(result.state.stock.ale!.salePrice).toBe(before + 1)
  })

  it('adjust_prices respects the minimum price of 1', () => {
    const base = withStock(createInitialTavernState(), 'ale', { salePrice: 1 })
    const result = runDay(base, [
      { actionId: 'adjust_prices', targetId: 'ale', amount: -5 },
    ])
    expect(result.state.stock.ale!.salePrice).toBe(1)
  })

  it('adjust_prices is rejected without an amount delta', () => {
    const base = createInitialTavernState()
    const result = runDay(base, [
      { actionId: 'adjust_prices', targetId: 'ale' },
    ])
    expect(getOwnerActionsModuleState(result.state).rejected[0]!.code).toBe(
      'missing_amount',
    )
  })
})

describe('Phase 13 — pay_staff_bonus (§13.7)', () => {
  it('pay_staff_bonus raises morale and costs coin', () => {
    const base = withCoin(
      withStaff(createInitialTavernState(), 'cook', {
        morale: 40,
        stress: 60,
      }),
      50,
    )
    const result = runDay(base, [
      { actionId: 'pay_staff_bonus', targetId: 'cook', amount: 10 },
    ])
    expect(result.state.staff.cook!.morale).toBeGreaterThan(40)
    expect(result.state.staff.cook!.stress).toBeLessThan(60)
    expect(result.state.coin).toBe(40)
  })

  it('pay_staff_bonus is rejected when coin is insufficient', () => {
    const base = withCoin(createInitialTavernState(), 1)
    const result = runDay(base, [
      { actionId: 'pay_staff_bonus', targetId: 'cook', amount: 10 },
    ])
    expect(getOwnerActionsModuleState(result.state).rejected[0]!.code).toBe(
      'insufficient_coin',
    )
  })
})

describe('Phase 13 — water_down_ale (§13.8)', () => {
  it('water_down_ale increases quantity but lowers quality', () => {
    const base = withStock(createInitialTavernState(), 'ale', {
      quantity: 50,
      quality: 60,
    })
    const result = runDay(base, [{ actionId: 'water_down_ale' }])
    expect(result.state.stock.ale!.quantity).toBeGreaterThan(50)
    expect(result.state.stock.ale!.quality).toBeLessThan(60)
    expect(result.state.stock.ale!.tags).toContain('watered_down')
  })
})

describe('Phase 13 — improve_stew (§13.9)', () => {
  it('improve_stew raises stew quality and consumes ingredients', () => {
    const base = createInitialTavernState()
    const beforeIng = base.stock.ingredients!.quantity
    const beforeStew = base.stock.stew!.quality
    const result = runDay(base, [{ actionId: 'improve_stew' }])
    expect(result.state.stock.stew!.quality).toBeGreaterThan(beforeStew)
    expect(result.state.stock.ingredients!.quantity).toBe(beforeIng - 5)
  })

  it('improve_stew is rejected when ingredients are too low', () => {
    const base = withStock(createInitialTavernState(), 'ingredients', {
      quantity: 2,
    })
    const result = runDay(base, [{ actionId: 'improve_stew' }])
    expect(getOwnerActionsModuleState(result.state).rejected[0]!.code).toBe(
      'insufficient_ingredients',
    )
  })
})

describe('Phase 13 — patch_roof (§13.10)', () => {
  it('patch_roof reduces damage and lifts condition', () => {
    const base = withArea(createInitialTavernState(), 'roof', {
      damage: 40,
      condition: 30,
    })
    const result = runDay(base, [{ actionId: 'patch_roof' }])
    expect(result.state.areas.roof!.damage).toBeLessThan(40)
    expect(result.state.areas.roof!.condition).toBeGreaterThan(30)
  })
})

describe('Phase 13 — fumigate_cellar (§13.11)', () => {
  it('fumigate_cellar reduces risk but raises smell', () => {
    const base = withArea(createInitialTavernState(), 'cellar', {
      risk: 60,
      smell: 40,
    })
    const result = runDay(base, [{ actionId: 'fumigate_cellar' }])
    expect(result.state.areas.cellar!.risk).toBeLessThan(60)
    expect(result.state.areas.cellar!.smell).toBeGreaterThan(40)
  })
})

describe('Phase 13 — buy_mugs (§13.12)', () => {
  it('buy_mugs increases the mug stock', () => {
    const base = withStock(createInitialTavernState(), 'mugs', { quantity: 5 })
    const result = runDay(base, [
      { actionId: 'buy_mugs', amount: 12 },
    ])
    expect(result.state.stock.mugs!.quantity).toBe(17)
  })
})

describe('Phase 13 — Validation errors', () => {
  it('invalid target rejects action', () => {
    const base = createInitialTavernState()
    const result = runDay(base, [
      { actionId: 'clean_area', targetId: 'kitchen_of_chaos' },
    ])
    const slice = getOwnerActionsModuleState(result.state)
    expect(slice.applied).toHaveLength(0)
    expect(slice.rejected[0]!.code).toBe('unknown_target')
  })

  it('unknown actionId is rejected', () => {
    const base = createInitialTavernState()
    const result = runDay(base, [
      { actionId: 'summon_dragon' },
    ])
    const slice = getOwnerActionsModuleState(result.state)
    expect(slice.rejected[0]!.code).toBe('unknown_action')
    expect(slice.actionPointsUsed).toBe(0)
  })

  it('rejected actions do not consume time', () => {
    const base = createInitialTavernState()
    const result = runDay(base, [
      { actionId: 'clean_area', targetId: 'nonexistent' },
      { actionId: 'clean_area', targetId: 'kitchen' },
      { actionId: 'summon_dragon' },
      { actionId: 'clean_area', targetId: 'main_room' },
    ])
    const slice = getOwnerActionsModuleState(result.state)
    expect(slice.applied).toHaveLength(2)
    expect(slice.actionPointsUsed).toBe(240) // two clean_area chores at 120m
    expect(slice.rejected).toHaveLength(2)
  })
})

describe('Phase 13 — Owner action report (§13.13)', () => {
  it('owner action report includes applied and rejected actions', () => {
    const base = createInitialTavernState()
    const result = runDay(base, [
      { actionId: 'clean_area', targetId: 'kitchen' },
      { actionId: 'summon_dragon' },
    ])
    const report = result.reports.find((r) => r.id === 'ownerActions')
    expect(report).toBeDefined()
    expect(report!.title).toMatch(/OWNER ACTION REPORT/)
    const text = report!.lines.join('\n')
    expect(text).toMatch(/Time Spent: 2h \/ 6h/)
    expect(text).toMatch(/Cleaned Kitchen/)
    expect(text).toMatch(/Rejected/)
    expect(text).toMatch(/summon_dragon/)
  })

  it('report data payload exposes applied entries with before/after data', () => {
    const base = createInitialTavernState()
    const result = runDay(base, [
      { actionId: 'clean_area', targetId: 'kitchen' },
    ])
    const report = result.reports.find((r) => r.id === 'ownerActions')!
    const data = report.data as {
      applied: Array<{ actionId: string; data: Record<string, unknown> }>
    }
    expect(data.applied[0]!.actionId).toBe('clean_area')
    expect(data.applied[0]!.data.cleanliness).toBeDefined()
  })
})

describe('Phase 13 — Same-day service impact', () => {
  it('restocking ale before payday eliminates the ale shortage that would otherwise hit', () => {
    // 200 coin is enough to afford an 80-unit ale restock at basePrice 2.
    const base = withCoin(
      withStock(
        withDayType(createInitialTavernState(), 'payday'),
        'ale',
        { quantity: 4 },
      ),
      200,
    )

    const noAction = runServiceDay(base)
    const withRestock = runServiceDay(base, [
      { actionId: 'restock_item', targetId: 'ale', amount: 80 },
    ])

    const noActionAleShortages = getServiceModuleState(noAction.state)
      .result.shortages.filter((s) => s.stockId === 'ale').length
    const withRestockAleShortages = getServiceModuleState(withRestock.state)
      .result.shortages.filter((s) => s.stockId === 'ale').length

    expect(noActionAleShortages).toBeGreaterThan(0)
    expect(withRestockAleShortages).toBeLessThan(noActionAleShortages)

    // Sanity: the restock action was actually accepted (and not blocked
    // by, e.g., insufficient coin).
    expect(
      getOwnerActionsModuleState(withRestock.state).applied.some(
        (a) => a.actionId === 'restock_item',
      ),
    ).toBe(true)
  })

  it('cleaning the main room before market day lifts merchant satisfaction', () => {
    const base = withArea(
      withDayType(createInitialTavernState(), 'market_day'),
      'main_room',
      { cleanliness: 5 },
    )

    const dirty = runServiceDay(base)
    const cleaned = runServiceDay(base, [
      { actionId: 'clean_area', targetId: 'main_room' },
    ])

    const dirtyMerchant = getCustomerModuleState(dirty.state).turnouts.find(
      (t) => t.groupId === 'merchants',
    )!
    const cleanedMerchant = getCustomerModuleState(cleaned.state).turnouts.find(
      (t) => t.groupId === 'merchants',
    )!
    expect(cleanedMerchant.satisfactionChange).toBeGreaterThan(
      dirtyMerchant.satisfactionChange,
    )
  })
})

describe('Phase 13 — State safety', () => {
  it('state validates after owner actions', () => {
    const base = createInitialTavernState()
    const result = runDay(base, [
      { actionId: 'clean_area', targetId: 'kitchen' },
      { actionId: 'restock_item', targetId: 'ale', amount: 10 },
      { actionId: 'pay_staff_bonus', targetId: 'server', amount: 5 },
    ])
    expect(result.validation.errors).toEqual([])
  })

  it('coin never goes negative even with chained spending actions', () => {
    const base = withCoin(createInitialTavernState(), 8)
    const result = runDay(base, [
      { actionId: 'restock_item', targetId: 'ale', amount: 3 },
      { actionId: 'fumigate_cellar' },
      { actionId: 'patch_roof' },
    ])
    expect(result.state.coin).toBeGreaterThanOrEqual(0)
    expect(result.validation.errors).toEqual([])
  })

  it('validate flags applied actions that reference unregistered ids', () => {
    // The `startDay` hook resets the slice every day, so a stale
    // applied entry cannot survive into validation through a real
    // engine run. Call the validate hook directly on a hand-built
    // state to assert the contract.
    const base = createInitialTavernState()
    const broken: TavernState = {
      ...base,
      modules: {
        ...base.modules,
        [OWNER_ACTIONS_MODULE_ID]: {
          actionPointsUsed: 1,
          actionPointBudget: 3,
          applied: [
            {
              actionId: 'unknown_thing',
              label: 'Unknown',
              actionPointCost: 1,
              effects: [],
              data: {},
            },
          ],
          rejected: [],
          // Phase 33 §33.3 — empty persistent slices are valid; only
          // the unknown applied action should trigger the assertion.
          projects: {},
          policies: {},
          recentSocialActions: [],
        },
      },
    }
    const issues = ownerActionsModule.validate!({ state: broken } as never)
    expect(issues.some((i) => i.code === 'unknown_applied_action')).toBe(true)
  })
})

describe('Phase 13 — Module shape', () => {
  it('ownerActionsModule registers id, hooks, schema, report, and validator', () => {
    expect(ownerActionsModule.id).toBe(OWNER_ACTIONS_MODULE_ID)
    expect(ownerActionsModule.id).toBe('ownerActions')
    expect(ownerActionsModule.hooks?.startDay).toBeDefined()
    expect(ownerActionsModule.hooks?.applyOwnerActions).toBeDefined()
    expect(ownerActionsModule.buildReport).toBeTypeOf('function')
    expect(ownerActionsModule.validate).toBeTypeOf('function')
    expect(ownerActionsModule.stateSchema).toBeDefined()
    expect(ownerActionsModule.dependsOn).toContain('stock')
  })

  it('createInitialTavernState seeds an empty ownerActions slice', () => {
    const state = createInitialTavernState()
    const slice = getOwnerActionsModuleState(state)
    expect(slice.actionPointsUsed).toBe(0)
    expect(slice.actionPointBudget).toBe(DAY_MINUTES)
    expect(slice.applied).toEqual([])
    expect(slice.rejected).toEqual([])
  })
})
