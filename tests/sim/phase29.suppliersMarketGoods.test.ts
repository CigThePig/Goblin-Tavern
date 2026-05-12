import { describe, it, expect } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import {
  supplierRegistry,
  ensureRequiredSuppliersRegistered,
} from '../../src/sim/content/suppliers/supplierRegistry'
import {
  marketConditionRegistry,
  ensureRequiredMarketConditionsRegistered,
} from '../../src/sim/content/suppliers/marketConditionRegistry'
import {
  SUPPLIERS_MODULE_ID,
  createInitialSupplierModuleState,
  getEffectiveBasePrice,
  getSupplierModuleState,
  supplierModule,
} from '../../src/sim/modules/suppliers'
import type {
  ActiveMarketCondition,
  SupplierModuleState,
} from '../../src/sim/modules/suppliers'
import { stockRegistry } from '../../src/sim/registries/stockRegistry'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { safeValidateState } from '../../src/sim/state/validation'
import { withModuleState } from '../../src/sim/testing/stateFactories'
import { FULL_PIPELINE } from '../../src/sim/testing/simRunner'
import type { SimContext } from '../../src/sim/core/context'
import type {
  SimulationHook,
  SimulationModule,
} from '../../src/sim/core/module'
import type {
  SupplierWorldState,
  TavernState,
} from '../../src/sim/state/TavernState'

// Phase 29 — Supplier, market, and goods expansion.
//
// Covers the nine §29.9 acceptance points:
//   1. Supplier registry imports and contains starter suppliers.
//   2. Every supplier `goodsProvided` id exists in stockRegistry / state.
//   3. Initial state contains seeded suppliers under `state.world.suppliers`.
//   4. Supplier module state validates.
//   5. `supplierUpdate` hook runs.
//   6. Active market conditions can affect effective base price.
//   7. Supplier reports mention active conditions or known suppliers.
//   8. Invalid supplier references fail Phase 26 validation.
//   9. Existing Phase 9 stock tests still pass (covered by `npm test`).

const SEED = 'phase-29-suppliers-test'

function defaultInput() {
  return { seed: SEED }
}

const EXPECTED_SUPPLIERS = [
  'brakka_mushroom_cart',
  'old_keg_brewers',
  'mudroad_grain_runner',
  'scrap_meat_vendor',
] as const

const EXPECTED_MARKET_CONDITIONS = [
  'grain_shortage',
  'cheap_mushrooms',
  'ale_tax',
  'road_bandits',
  'merchant_surplus',
  'winter_prices',
  'festival_demand',
  'spoiled_delivery_rumour',
] as const

describe('Phase 29 — Supplier definitions and registry', () => {
  it('1. supplier registry imports and contains every starter supplier', () => {
    ensureRequiredSuppliersRegistered()
    for (const id of EXPECTED_SUPPLIERS) {
      expect(supplierRegistry.has(id)).toBe(true)
    }
    for (const def of supplierRegistry.all()) {
      expect(def.supplierType.length).toBeGreaterThan(0)
      expect(def.namingProfileId.length).toBeGreaterThan(0)
      expect(def.deliveryPattern.length).toBeGreaterThan(0)
      expect(def.defaultReliability).toBeGreaterThanOrEqual(0)
      expect(def.defaultReliability).toBeLessThanOrEqual(100)
      expect(def.defaultRelationship).toBeGreaterThanOrEqual(0)
      expect(def.defaultRelationship).toBeLessThanOrEqual(100)
      expect(def.defaultDebtTolerance).toBeGreaterThanOrEqual(0)
      expect(def.defaultDebtTolerance).toBeLessThanOrEqual(100)
      expect(def.goodsProvided.length).toBeGreaterThan(0)
    }
  })

  it('2. every supplier goodsProvided id exists in stockRegistry', () => {
    ensureRequiredSuppliersRegistered()
    for (const def of supplierRegistry.all()) {
      for (const stockId of def.goodsProvided) {
        expect(
          stockRegistry.has(stockId),
          `supplier '${def.id}' provides unknown stock id '${stockId}'`,
        ).toBe(true)
      }
    }
  })
})

describe('Phase 29 — Initial state seeds suppliers', () => {
  it('3a. createInitialTavernState seeds every registry supplier into state.world.suppliers', () => {
    const state = createInitialTavernState()
    for (const id of EXPECTED_SUPPLIERS) {
      const supplier: SupplierWorldState | undefined = state.world.suppliers[id]
      expect(supplier, `expected supplier '${id}' in state`).toBeDefined()
      expect(supplier!.id).toBe(id)
      expect(supplier!.goodsProvided.length).toBeGreaterThan(0)
      expect(supplier!.activeFlags).toEqual([])
      expect(supplier!.name?.profileId).toBeDefined()
    }
  })

  it('3b. seeded supplier names are static and reference a registered naming profile', () => {
    const state = createInitialTavernState()
    for (const supplier of Object.values(state.world.suppliers)) {
      expect(supplier.name?.generatedBy).toBe('supplier_registry')
      expect(supplier.name?.display).toBe(supplier.label)
    }
  })

  it('3c. default state validates without throwing now that suppliers are seeded', () => {
    const state = createInitialTavernState()
    const result = safeValidateState(state)
    expect(result.success).toBe(true)
  })
})

describe('Phase 29 — Supplier module state and pipeline', () => {
  it('4. createInitialSupplierModuleState produces a slice that validates against the module schema', () => {
    const slice = createInitialSupplierModuleState()
    const parsed = supplierModule.stateSchema!.safeParse(slice)
    expect(parsed.success).toBe(true)
  })

  it('4b. default state seeds an empty supplier module slice', () => {
    const state = createInitialTavernState()
    const slice = getSupplierModuleState(state)
    expect(slice.activeMarketConditions).toEqual([])
    expect(slice.deliveriesToday).toEqual([])
    expect(slice.priceAdjustmentsToday).toEqual([])
    expect(slice.missedDeliveriesToday).toEqual([])
  })

  it('5. supplierUpdate hook runs and resets per-day arrays via startDay', () => {
    let supplierUpdateCalls = 0
    const probe: SimulationModule = {
      id: 'phase29-probe',
      version: '0.0.1',
      hooks: {
        supplierUpdate: [
          ((_ctx: SimContext) => {
            supplierUpdateCalls += 1
          }) satisfies SimulationHook,
        ],
      },
    }
    const before = createInitialTavernState()
    const dirty = withModuleState(before, SUPPLIERS_MODULE_ID, {
      ...createInitialSupplierModuleState(),
      deliveriesToday: [
        {
          supplierId: 'old_keg_brewers',
          stockId: 'ale',
          quantity: 10,
          quality: 50,
          coinCost: 20,
          tags: [],
        },
      ],
      priceAdjustmentsToday: [
        {
          supplierId: 'old_keg_brewers',
          stockId: 'ale',
          basePrice: 2,
          effectivePrice: 3,
          conditionIds: ['ale_tax'],
          tags: [],
        },
      ],
    } satisfies SupplierModuleState)
    const result = simulateDay(dirty, defaultInput(), [supplierModule, probe])
    expect(supplierUpdateCalls).toBe(1)
    const slice = getSupplierModuleState(result.state)
    expect(slice.deliveriesToday).toEqual([])
    expect(slice.priceAdjustmentsToday).toEqual([])
  })

  it('5b. supplier update prunes market conditions whose expiresAtDay has passed', () => {
    const before = createInitialTavernState()
    const today = before.calendar.totalDaysElapsed
    const slice: SupplierModuleState = {
      ...createInitialSupplierModuleState(),
      activeMarketConditions: [
        {
          id: 'cheap_mushrooms',
          startedAtDay: 0,
          expiresAtDay: today, // expired today
          intensity: 50,
          tags: [],
        },
        {
          id: 'ale_tax',
          startedAtDay: 0,
          intensity: 60,
          tags: [],
        },
      ],
    }
    const state = withModuleState(before, SUPPLIERS_MODULE_ID, slice)
    const result = simulateDay(state, defaultInput(), [supplierModule])
    const next = getSupplierModuleState(result.state)
    expect(next.activeMarketConditions.map((c) => c.id)).toEqual(['ale_tax'])
  })

  it('5c. supplier update drifts relationship downward for unreliable suppliers', () => {
    const before = createInitialTavernState()
    // Force scrap_meat_vendor to a known low reliability so drift kicks in.
    before.world.suppliers['scrap_meat_vendor'] = {
      ...before.world.suppliers['scrap_meat_vendor']!,
      reliability: 20,
      relationship: 40,
    }
    const result = simulateDay(before, defaultInput(), [supplierModule])
    const after = result.state.world.suppliers['scrap_meat_vendor']!
    expect(after.relationship).toBeLessThan(40)
    // A cause should attribute the drift.
    const drift = result.state.causes.find(
      (c) =>
        c.target === 'scrap_meat_vendor' && c.targetType === 'supplier',
    )
    expect(drift).toBeDefined()
    expect(drift?.tags).toContain('relationship')
  })

  it('5d. supplier update nudges pressure ids tagged by active market conditions', () => {
    ensureRequiredMarketConditionsRegistered()
    const before = createInitialTavernState()
    const today = before.calendar.totalDaysElapsed
    const slice: SupplierModuleState = {
      ...createInitialSupplierModuleState(),
      activeMarketConditions: [
        {
          id: 'ale_tax',
          startedAtDay: today,
          intensity: 50,
          tags: [],
        },
      ],
    }
    const state = withModuleState(before, SUPPLIERS_MODULE_ID, slice)
    const beforeDebt = before.pressures['debt']!.value
    const result = simulateDay(state, defaultInput(), [supplierModule])
    expect(result.state.pressures['debt']!.value).toBeGreaterThan(beforeDebt)
    const causes = result.state.causes.filter(
      (c) =>
        c.sourceType === 'supplier' &&
        c.tags.includes('market_condition') &&
        c.tags.includes('ale_tax'),
    )
    expect(causes.length).toBeGreaterThan(0)
  })
})

describe('Phase 29 — Market conditions and pricing', () => {
  it('market condition registry contains every starter condition', () => {
    ensureRequiredMarketConditionsRegistered()
    for (const id of EXPECTED_MARKET_CONDITIONS) {
      expect(marketConditionRegistry.has(id)).toBe(true)
    }
  })

  it('6. an active market condition shifts the effective base price', () => {
    ensureRequiredMarketConditionsRegistered()
    const state = createInitialTavernState()
    const ale = state.stock['ale']!
    const supplier = state.world.suppliers['old_keg_brewers']!
    const baseline = getEffectiveBasePrice(ale, supplier, [])
    const taxed: ActiveMarketCondition[] = [
      {
        id: 'ale_tax',
        startedAtDay: 0,
        intensity: 60,
        tags: [],
      },
    ]
    const taxedPrice = getEffectiveBasePrice(ale, supplier, taxed)
    expect(taxedPrice).toBeGreaterThan(baseline)
  })

  it('6b. cheap_mushrooms pulls the effective price down on mushrooms but not ale', () => {
    ensureRequiredMarketConditionsRegistered()
    const state = createInitialTavernState()
    // Build a synthetic stock entry with a non-zero base price so the
    // multiplier change is observable regardless of the seed registry.
    const mushrooms = { ...state.stock['mushrooms']!, basePrice: 10 }
    const ale = { ...state.stock['ale']!, basePrice: 10 }
    const conditions: ActiveMarketCondition[] = [
      { id: 'cheap_mushrooms', startedAtDay: 0, intensity: 50, tags: [] },
    ]
    const cheapMushrooms = getEffectiveBasePrice(mushrooms, undefined, conditions)
    expect(cheapMushrooms).toBeLessThan(
      getEffectiveBasePrice(mushrooms, undefined, []),
    )
    const aleUnchanged = getEffectiveBasePrice(ale, undefined, conditions)
    // ale is not tagged 'food' nor in mushroom's affected ids, so untouched.
    expect(aleUnchanged).toBe(getEffectiveBasePrice(ale, undefined, []))
  })

  it('6c. unknown market condition ids are ignored by the pricing helper', () => {
    const state = createInitialTavernState()
    const ale = state.stock['ale']!
    const supplier = state.world.suppliers['old_keg_brewers']!
    const baseline = getEffectiveBasePrice(ale, supplier, [])
    const phantom: ActiveMarketCondition[] = [
      { id: 'not_a_real_condition', startedAtDay: 0, intensity: 50, tags: [] },
    ]
    expect(getEffectiveBasePrice(ale, supplier, phantom)).toBe(baseline)
  })
})

describe('Phase 29 — Supplier reports', () => {
  it('7. supplier report lists seeded suppliers on day zero', () => {
    const state = createInitialTavernState()
    const result = simulateDay(state, defaultInput(), [supplierModule])
    const report = result.reports.find((r) => r.id === 'suppliers')
    expect(report).toBeDefined()
    const text = report!.lines.join('\n')
    expect(text).toContain('Suppliers:')
    expect(text).toContain('Brakka Mushroom Cart')
    expect(text).toContain('Old Keg Brewers')
  })

  it('7b. supplier report surfaces active market conditions and unreliable suppliers', () => {
    ensureRequiredMarketConditionsRegistered()
    const before = createInitialTavernState()
    before.world.suppliers['scrap_meat_vendor'] = {
      ...before.world.suppliers['scrap_meat_vendor']!,
      reliability: 25,
    }
    const today = before.calendar.totalDaysElapsed
    const slice: SupplierModuleState = {
      ...createInitialSupplierModuleState(),
      activeMarketConditions: [
        {
          id: 'road_bandits',
          startedAtDay: today,
          intensity: 70,
          tags: [],
        },
      ],
    }
    const state = withModuleState(before, SUPPLIERS_MODULE_ID, slice)
    const result = simulateDay(state, defaultInput(), [supplierModule])
    const text = result.reports.find((r) => r.id === 'suppliers')!.lines.join('\n')
    expect(text).toContain('Active market conditions:')
    expect(text).toContain('Road Bandits')
    expect(text).toContain('Unreliable suppliers:')
    expect(text).toContain('Scrap Meat Vendor')
  })
})

describe('Phase 29 — Cross-system validation and pipeline integration', () => {
  it('8. invalid supplier references fail Phase 26 cross-reference validation', () => {
    const state = createInitialTavernState()
    state.world.suppliers['phantom_supplier'] = {
      id: 'phantom_supplier',
      label: 'Phantom Supplier',
      name: {
        display: 'Phantom Supplier',
        profileId: 'goblin_common',
        parts: {},
        patternId: 'given_family',
        generatedBy: 'phase29-test',
      },
      supplierType: 'mystery',
      reliability: 50,
      relationship: 50,
      debtTolerance: 50,
      priceBias: 0,
      goodsProvided: ['unicorn_horn'],
      tags: [],
      activeFlags: [],
    }
    const result = safeValidateState(state)
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.errors.find((e) => e.code === 'unknown_stock_ref')
      expect(issue).toBeDefined()
      expect(issue?.path).toBe(
        'world.suppliers.phantom_supplier.goodsProvided[0]',
      )
    }
  })

  it('8b. supplier module surfaces unknown market condition ids as validation issues', () => {
    const before = createInitialTavernState()
    const slice: SupplierModuleState = {
      ...createInitialSupplierModuleState(),
      activeMarketConditions: [
        { id: 'not_a_real_condition', startedAtDay: 0, intensity: 0, tags: [] },
      ],
    }
    const state = withModuleState(before, SUPPLIERS_MODULE_ID, slice)
    const result = simulateDay(state, defaultInput(), [supplierModule])
    const issue = result.validation.errors.find(
      (e) => e.code === 'unknown_market_condition_id',
    )
    expect(issue).toBeDefined()
  })

  it('9. full pipeline still validates with Phase 29 seeded suppliers', () => {
    const result = simulateDay(
      createInitialTavernState(),
      defaultInput(),
      FULL_PIPELINE,
    )
    expect(result.validation.errors).toEqual([])
  })

  it('9b. determinism — two runs from the same seed converge', () => {
    const a = simulateDay(createInitialTavernState(), defaultInput(), FULL_PIPELINE)
    const b = simulateDay(createInitialTavernState(), defaultInput(), FULL_PIPELINE)
    // The supplier slice is purely state-driven so it should match exactly.
    expect(getSupplierModuleState(a.state)).toEqual(
      getSupplierModuleState(b.state),
    )
    expect(a.state.world.suppliers).toEqual(b.state.world.suppliers)
  })
})

describe('Phase 29 — Determinism note: supplier identity is stable across days', () => {
  it('seeded supplier names are not regenerated by daily ticks', () => {
    const before = createInitialTavernState()
    const baselineNames = Object.fromEntries(
      Object.values(before.world.suppliers).map((s) => [s.id, s.name?.display]),
    )
    let current: TavernState = before
    for (let day = 0; day < 5; day += 1) {
      const result = simulateDay(current, defaultInput(), [supplierModule])
      current = result.state
    }
    for (const supplier of Object.values(current.world.suppliers)) {
      expect(supplier.name?.display).toBe(baselineNames[supplier.id])
    }
  })
})
