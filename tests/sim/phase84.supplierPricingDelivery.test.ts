import { describe, expect, it } from 'vitest'

import { runOneDay } from '../../src/sim/testing/simRunner'
import {
  getEffectiveBasePrice,
  getMissedDeliveryProbability,
  getRelationshipPriceMultiplier,
} from '../../src/sim/modules/suppliers/pricing'
import { getSupplierModuleState } from '../../src/sim/modules/suppliers/state'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { stockRegistry } from '../../src/sim/registries/stockRegistry'
import type {
  StockState,
  SupplierWorldState,
  TavernState,
} from '../../src/sim/state/TavernState'

// Phase 84 — ISSUE-044: supplier reliability + relationship affect
// pricing and delivery.
//
// Before this phase, `supplier.reliability` only influenced the
// supplierModule's tiny relationship-drift loop, and
// `supplier.relationship` had no operational consumer at all. The
// supplier report surfaced both meters to the player while neither
// fed any pricing, delivery, or stock decision.

const SEED = 'phase-84-supplier-test'

function makeSupplier(
  id: string,
  overrides: Partial<SupplierWorldState> = {},
): SupplierWorldState {
  return {
    id,
    label: id,
    supplierType: 'food_cart',
    reliability: 50,
    relationship: 50,
    debtTolerance: 30,
    priceBias: 0,
    goodsProvided: ['ale'],
    tags: [],
    activeFlags: [],
    ...overrides,
  }
}

function sampleStock(): StockState {
  // Pull a real stock entry from the registry to keep prices and
  // tags consistent with the production world. The registry splits
  // id/label/tags from defaultState; reassemble the full StockState.
  const def = stockRegistry.get('ale')
  return {
    ...def.defaultState,
    id: def.id,
    label: def.label,
    tags: [...def.tags],
  }
}

function withSuppliers(
  state: TavernState,
  suppliers: SupplierWorldState[],
): TavernState {
  const map: Record<string, SupplierWorldState> = {}
  for (const s of suppliers) map[s.id] = s
  return {
    ...state,
    world: { ...state.world, suppliers: map },
  }
}

describe('Phase 84 / ISSUE-044 — supplier relationship affects effective base price', () => {
  it('relationship 80 yields a lower effective base price than relationship 30', () => {
    const friendly = makeSupplier('friendly', { relationship: 80 })
    const strained = makeSupplier('strained', { relationship: 30 })
    const stock = sampleStock()
    const priceFriendly = getEffectiveBasePrice(stock, friendly, [])
    const priceStrained = getEffectiveBasePrice(stock, strained, [])
    expect(priceFriendly).toBeLessThan(priceStrained)
  })

  it('relationship 50 is the neutral mark (multiplier 1.0)', () => {
    const neutral = makeSupplier('neutral', { relationship: 50 })
    expect(getRelationshipPriceMultiplier(neutral)).toBe(1)
  })

  it('relationship effect is bounded at ±5%', () => {
    const max = makeSupplier('max', { relationship: 100 })
    const min = makeSupplier('min', { relationship: 0 })
    const multMax = getRelationshipPriceMultiplier(max)
    const multMin = getRelationshipPriceMultiplier(min)
    expect(multMax).toBeGreaterThanOrEqual(0.95)
    expect(multMin).toBeLessThanOrEqual(1.05)
  })
})

describe('Phase 84 / ISSUE-044 — supplier reliability affects missed-delivery rate', () => {
  it('getMissedDeliveryProbability is monotonic in reliability', () => {
    const high = makeSupplier('high', { reliability: 90 })
    const low = makeSupplier('low', { reliability: 40 })
    const lower = makeSupplier('lower', { reliability: 20 })
    expect(getMissedDeliveryProbability(high)).toBe(0)
    expect(getMissedDeliveryProbability(low)).toBeGreaterThan(0)
    expect(getMissedDeliveryProbability(lower)).toBeGreaterThan(
      getMissedDeliveryProbability(low),
    )
  })

  // Expansion Phase 6 §6.2 — "reliability rolls must occur on real orders".
  // Phase 84 rolled every supplier every day against nothing and recorded a
  // "missed delivery" that missed no delivery; that diagnostic is gone. The
  // property it was reaching for is still true and is now testable against
  // an actual promise: an unreliable supplier fails orders, a reliable one
  // keeps them, and the failure is a transaction rather than a log line.
  it('a low-reliability supplier fails real orders; a reliable one keeps them', () => {
    const reliable = makeSupplier('reliable_supplier', { reliability: 95 })
    const flaky = makeSupplier('flaky_supplier', { reliability: 20 })
    let current = withSuppliers(createInitialTavernState(), [reliable, flaky])
    current = { ...current, coin: 5_000 }

    let flakyFailures = 0
    let reliableFailures = 0
    let flakyDeliveries = 0
    let reliableDeliveries = 0

    for (let i = 0; i < 20; i += 1) {
      current = runOneDay(current, {
        seed: `${SEED}-orders-${i}`,
        ownerActions: [
          {
            actionId: 'place_supplier_order',
            targetId: 'reliable_supplier:ale',
            amount: 5,
          },
          {
            actionId: 'place_supplier_order',
            targetId: 'flaky_supplier:ale',
            amount: 5,
          },
        ],
      }).state
      const slice = getSupplierModuleState(current)
      for (const missed of slice.missedDeliveriesToday) {
        if (missed.supplierId === 'flaky_supplier') flakyFailures += 1
        if (missed.supplierId === 'reliable_supplier') reliableFailures += 1
      }
      for (const delivery of slice.deliveriesToday) {
        if (delivery.supplierId === 'flaky_supplier') flakyDeliveries += 1
        if (delivery.supplierId === 'reliable_supplier') reliableDeliveries += 1
      }
    }

    // Both suppliers actually traded — otherwise the comparison is vacuous.
    expect(reliableDeliveries).toBeGreaterThan(0)
    expect(reliableFailures).toBe(0)
    expect(flakyFailures).toBeGreaterThan(0)
    expect(flakyDeliveries).toBeGreaterThan(0)
  })
})

describe('Phase 84 / ISSUE-044 — supplier report surfaces the effective discount', () => {
  it('high-relationship supplier shows a discount tag in the report', () => {
    const friendly = makeSupplier('friendly_supplier', { relationship: 90 })
    const state = withSuppliers(createInitialTavernState(), [friendly])
    const result = runOneDay(state, { seed: `${SEED}-report-friendly` })
    const supplierReport = result.reports.find((r) => r.id === 'suppliers')
    expect(supplierReport).toBeDefined()
    expect(supplierReport!.lines.join('\n')).toMatch(/discount/i)
  })

  it('low-relationship supplier shows a surcharge tag in the report', () => {
    const strained = makeSupplier('strained_supplier', { relationship: 10 })
    const state = withSuppliers(createInitialTavernState(), [strained])
    const result = runOneDay(state, { seed: `${SEED}-report-strained` })
    const supplierReport = result.reports.find((r) => r.id === 'suppliers')
    expect(supplierReport).toBeDefined()
    expect(supplierReport!.lines.join('\n')).toMatch(/surcharge/i)
  })
})
