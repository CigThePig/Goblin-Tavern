import { describe, it, expect } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { areasModule } from '../../src/sim/modules/areas/index'
import {
  addCoin,
  consumeStockItem,
  createInitialStockModuleState,
  effectiveQuality,
  getDailyProfitLoss,
  getStockModuleState,
  isPerishable,
  restockItem,
  sellStockItem,
  spendCoin,
  stockModule,
  stockRegistry,
  wasteStockItem,
} from '../../src/sim/modules/stock/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { validateState } from '../../src/sim/state/validation'
import type { SimulationModule } from '../../src/sim/core/module'
import type { SimContext } from '../../src/sim/core/context'
import type { TavernState } from '../../src/sim/state/TavernState'

// Phase 9 — Stock & Economy system.
//
// These tests cover the ten numbered cases in `phases-06-10.md` §9
// "Testing Requirements". The stock module runs through `simulateDay` so
// the helpers are exercised against the real engine pipeline, including
// the per-day ledger reset performed by the module's `startDay` hook.

const SEED = 'phase-9-stock-test'

function defaultInput() {
  return { seed: SEED }
}

/** Build a one-shot service-phase hook that runs `fn(ctx)` once. */
function serviceHook(id: string, fn: (ctx: SimContext) => void): SimulationModule {
  return {
    id,
    version: '0.0.0',
    dependsOn: ['stock'],
    hooks: {
      service: [(ctx) => fn(ctx)],
    },
  }
}

function runWithStock(state: TavernState, extra: SimulationModule[] = []) {
  return simulateDay(state, defaultInput(), [stockModule, ...extra])
}

describe('Phase 9 — Stock & Economy', () => {
  it('1. default stock items exist after createInitialTavernState', () => {
    const state = createInitialTavernState()
    // Phase 66 / ISSUE-026 — the registry now spans common through
    // legendary, so we check by id rather than by exact set match.
    for (const id of ['ale', 'stew', 'ingredients', 'mushrooms', 'firewood', 'mugs']) {
      expect(state.stock[id]).toBeDefined()
    }
    expect(() => validateState(state)).not.toThrow()
  })

  it('2. stock cannot go negative — overselling clamps and produces a shortage', () => {
    const state = createInitialTavernState()
    const ale = state.stock.ale!
    const requested = ale.quantity + 25

    const result = runWithStock(state, [
      serviceHook('test.oversell', (ctx) => {
        const sale = sellStockItem(ctx, 'ale', requested)
        expect(sale.sold).toBe(ale.quantity)
        expect(sale.shortage).toBeDefined()
      }),
    ])

    expect(result.state.stock.ale!.quantity).toBe(0)
    expect(result.state.stock.ale!.quantity).toBeGreaterThanOrEqual(0)

    const moduleState = getStockModuleState(result.state)
    const shortage = moduleState.shortages.find((s) => s.stockId === 'ale')
    expect(shortage).toBeDefined()
    expect(shortage?.requested).toBe(requested)
    expect(shortage?.available).toBe(ale.quantity)
  })

  it('3. sellStockItem increases coin by quantity × salePrice and decreases stock', () => {
    const state = createInitialTavernState()
    const ale = state.stock.ale!
    const N = 5
    const expectedEarnings = N * ale.salePrice

    const result = runWithStock(state, [
      serviceHook('test.sell', (ctx) => {
        const sale = sellStockItem(ctx, 'ale', N)
        expect(sale.sold).toBe(N)
        expect(sale.earned).toBe(expectedEarnings)
      }),
    ])

    expect(result.state.coin).toBe(state.coin + expectedEarnings)
    expect(result.state.stock.ale!.quantity).toBe(ale.quantity - N)

    const ledger = getStockModuleState(result.state).ledger
    const saleEntry = ledger.find(
      (e) => e.category === 'sales' && e.tags.includes('ale'),
    )
    expect(saleEntry).toBeDefined()
    expect(saleEntry?.amount).toBe(expectedEarnings)
  })

  it('4. restockItem decreases coin by totalCost and increases stock', () => {
    const state = createInitialTavernState()
    const ale = state.stock.ale!
    const N = 10
    const totalCost = 12

    const result = runWithStock(state, [
      serviceHook('test.restock', (ctx) => {
        restockItem(ctx, 'ale', N, totalCost)
      }),
    ])

    expect(result.state.coin).toBe(state.coin - totalCost)
    expect(result.state.stock.ale!.quantity).toBe(ale.quantity + N)

    const ledger = getStockModuleState(result.state).ledger
    const purchase = ledger.find(
      (e) => e.category === 'purchase' && e.tags.includes('ale'),
    )
    expect(purchase).toBeDefined()
    expect(purchase?.amount).toBe(-totalCost)
  })

  it('5. consuming more than available creates a ShortageRecord with the delta', () => {
    const state = createInitialTavernState()
    const stew = state.stock.stew!
    const requested = stew.quantity + 7

    const result = runWithStock(state, [
      serviceHook('test.consume', (ctx) => {
        const out = consumeStockItem(ctx, 'stew', requested, 'kitchen.cook')
        expect(out.consumed).toBe(stew.quantity)
        expect(out.shortage).toBeDefined()
        expect(out.shortage?.requested).toBe(requested)
        expect(out.shortage?.available).toBe(stew.quantity)
        expect(out.shortage?.reason).toBe('kitchen.cook')
      }),
    ])

    expect(result.state.stock.stew!.quantity).toBe(0)
    const shortage = getStockModuleState(result.state).shortages.find(
      (s) => s.stockId === 'stew',
    )
    expect(shortage).toBeDefined()
    expect((shortage?.requested ?? 0) - (shortage?.available ?? 0)).toBe(7)
  })

  it('6. perishables (stew, mushrooms, ingredients) gain spoilage over consecutive days', () => {
    const state = createInitialTavernState()
    let current = state
    for (let i = 0; i < 8; i += 1) {
      current = runWithStock(current).state
    }
    expect(current.stock.stew!.spoilage).toBeGreaterThan(state.stock.stew!.spoilage)
    expect(current.stock.mushrooms!.spoilage).toBeGreaterThan(
      state.stock.mushrooms!.spoilage,
    )
    expect(current.stock.ingredients!.spoilage).toBeGreaterThan(
      state.stock.ingredients!.spoilage,
    )
    // Sanity: each perishable is actually tagged perishable.
    expect(isPerishable(current.stock.stew!)).toBe(true)
    expect(isPerishable(current.stock.mushrooms!)).toBe(true)
    expect(isPerishable(current.stock.ingredients!)).toBe(true)
  })

  it('7. non-perishable mugs do not gain spoilage', () => {
    const state = createInitialTavernState()
    let current = state
    for (let i = 0; i < 20; i += 1) {
      current = runWithStock(current).state
    }
    expect(isPerishable(current.stock.mugs!)).toBe(false)
    expect(current.stock.mugs!.spoilage).toBe(state.stock.mugs!.spoilage)
  })

  it('8. bad cellar cleanliness increases mushroom spoilage faster than a clean cellar', () => {
    const base = createInitialTavernState()
    const dirty: TavernState = {
      ...base,
      areas: {
        ...base.areas,
        cellar: { ...base.areas.cellar!, cleanliness: 5, condition: 30 },
      },
      stock: {
        ...base.stock,
        mushrooms: { ...base.stock.mushrooms!, spoilage: 20 },
      },
    }
    const clean: TavernState = {
      ...base,
      areas: {
        ...base.areas,
        cellar: { ...base.areas.cellar!, cleanliness: 95, condition: 95 },
      },
      stock: {
        ...base.stock,
        mushrooms: { ...base.stock.mushrooms!, spoilage: 20 },
      },
    }

    let dirtyState = dirty
    let cleanState = clean
    for (let i = 0; i < 5; i += 1) {
      dirtyState = runWithStock(dirtyState).state
      cleanState = runWithStock(cleanState).state
    }

    expect(dirtyState.stock.mushrooms!.spoilage).toBeGreaterThan(
      cleanState.stock.mushrooms!.spoilage,
    )
  })

  it('9. getDailyProfitLoss matches the net coin change for the day', () => {
    const state = createInitialTavernState()

    const result = runWithStock(state, [
      serviceHook('test.profit', (ctx) => {
        sellStockItem(ctx, 'ale', 4)
        sellStockItem(ctx, 'stew', 2)
        restockItem(ctx, 'ingredients', 5, 4)
        wasteStockItem(ctx, 'mushrooms', 1, 'spoiled')
        addCoin(ctx, 7, { source: 'test.tip', category: 'other', tags: ['tip'] })
        spendCoin(ctx, 3, { source: 'test.repair', category: 'repair', tags: ['repair'] })
      }),
    ])

    const ledgerNet = getDailyProfitLoss(result.state)
    const coinDelta = result.state.coin - state.coin
    expect(ledgerNet).toBe(coinDelta)
  })

  it('10. stock report includes shortage records produced that day', () => {
    const state = createInitialTavernState()

    const result = runWithStock(state, [
      serviceHook('test.shortage', (ctx) => {
        sellStockItem(ctx, 'ale', ctx.state.stock.ale!.quantity + 5)
        consumeStockItem(ctx, 'stew', ctx.state.stock.stew!.quantity + 3, 'kitchen.cook')
      }),
    ])

    const report = result.reports.find((r) => r.id === 'stock')
    expect(report).toBeDefined()
    expect(report!.lines.join('\n')).toMatch(/Shortages:/)
    expect(report!.lines.join('\n')).toContain('ale')
    expect(report!.lines.join('\n')).toContain('stew')

    const shortages = (report?.data?.shortages ?? []) as Array<{ stockId: string }>
    expect(shortages.length).toBeGreaterThanOrEqual(2)
    expect(shortages.map((s) => s.stockId).sort()).toEqual(['ale', 'stew'].sort())
  })
})

describe('Phase 9 — Registry, helpers, and module shape', () => {
  it('stockRegistry exposes the six required items with default state', () => {
    // Phase 66 / ISSUE-026 — the registry has grown beyond the six
    // common starters; check by id rather than full-set equality.
    for (const id of ['ale', 'firewood', 'ingredients', 'mugs', 'mushrooms', 'stew']) {
      expect(stockRegistry.has(id)).toBe(true)
    }
    for (const def of stockRegistry.all()) {
      expect(def.defaultState.basePrice).toBeGreaterThanOrEqual(0)
      expect(def.defaultState.salePrice).toBeGreaterThanOrEqual(0)
      expect(def.defaultState.quantity).toBeGreaterThanOrEqual(0)
      expect(def.defaultState.quality).toBeGreaterThanOrEqual(0)
      expect(def.defaultState.quality).toBeLessThanOrEqual(100)
    }
  })

  it('createInitialStockModuleState returns an empty ledger and shortage list', () => {
    const initial = createInitialStockModuleState()
    expect(initial.ledger).toEqual([])
    expect(initial.shortages).toEqual([])
  })

  it('default tavern state seeds state.modules.stock with the empty module state', () => {
    const state = createInitialTavernState()
    expect(getStockModuleState(state)).toEqual({ ledger: [], shortages: [] })
  })

  it('effectiveQuality applies the spoilage penalty', () => {
    const sample = {
      id: 'sample',
      label: 'Sample',
      quantity: 10,
      quality: 60,
      spoilage: 40,
      basePrice: 1,
      salePrice: 2,
      tags: ['food', 'perishable'],
      rarity: 'common' as const,
    }
    // 60 - 40 * 0.5 = 40.
    expect(effectiveQuality(sample)).toBe(40)
  })

  it('stockModule registers the canonical id, hooks, schema, report builder', () => {
    expect(stockModule.id).toBe('stock')
    expect(stockModule.version).toBeTypeOf('string')
    expect(stockModule.hooks?.startDay).toBeDefined()
    expect(stockModule.hooks?.endDay).toBeDefined()
    expect(stockModule.buildReport).toBeTypeOf('function')
    expect(stockModule.stateSchema).toBeDefined()
  })

  it('simulateDay leaves state valid when the stock module runs', () => {
    const state = createInitialTavernState()
    const result = simulateDay(state, defaultInput(), [areasModule, stockModule])
    expect(result.validation.errors).toEqual([])
    expect(result.reports.find((r) => r.id === 'stock')).toBeDefined()
  })

  it('startDay resets the ledger so cross-day entries do not accumulate', () => {
    const state = createInitialTavernState()
    // Day 1: record a sale.
    const day1 = runWithStock(state, [
      serviceHook('test.sell-day1', (ctx) => {
        sellStockItem(ctx, 'ale', 3)
      }),
    ]).state
    expect(getStockModuleState(day1).ledger.length).toBeGreaterThan(0)

    // Day 2: stock module's startDay should reset the ledger before any
    // new sale records are added.
    const day2 = runWithStock(day1).state
    expect(getStockModuleState(day2).ledger).toEqual([])
  })
})
