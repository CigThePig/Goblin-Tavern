import { describe, expect, it } from 'vitest'

import {
  ensureRequiredSuppliersRegistered,
  supplierRegistry,
} from '../../src/sim/content/suppliers/supplierRegistry'
import { stockRegistry } from '../../src/sim/registries/stockRegistry'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { validateState } from '../../src/sim/state/validation'

// Phase 68 / ISSUE-028 — Specialty supplier expansion.
//
// Covers the per-issue test approach from `docs/ISSUE_TRACKER.md`:
//   - cross-reference validation passes (every goodsProvided id
//     exists in stockRegistry)
//   - each existing category has ≥ 2 suppliers
//   - the new `specialty_goods` category exists with ≥ 1 supplier
//     carrying ≥ 2 uncommon-tier ingredients

describe('Phase 68 — specialty supplier expansion', () => {
  it('supplier registry has ≥ 9 entries spread across ≥ 5 categories', () => {
    ensureRequiredSuppliersRegistered()
    const all = supplierRegistry.all()
    expect(all.length).toBeGreaterThanOrEqual(9)
    const types = new Set(all.map((s) => s.supplierType))
    expect(types.size).toBeGreaterThanOrEqual(5)
  })

  it('every existing category now has ≥ 2 suppliers', () => {
    ensureRequiredSuppliersRegistered()
    const byCategory: Record<string, number> = {}
    for (const def of supplierRegistry.all()) {
      byCategory[def.supplierType] = (byCategory[def.supplierType] ?? 0) + 1
    }
    expect(byCategory['food_cart']).toBeGreaterThanOrEqual(2)
    expect(byCategory['brewer']).toBeGreaterThanOrEqual(2)
    expect(byCategory['caravan']).toBeGreaterThanOrEqual(2)
    expect(byCategory['butcher_or_salvage_food']).toBeGreaterThanOrEqual(2)
  })

  it('specialty_goods category exists with ≥ 2 uncommon ingredients on its supplier', () => {
    ensureRequiredSuppliersRegistered()
    const specialty = supplierRegistry
      .all()
      .filter((s) => s.supplierType === 'specialty_goods')
    expect(specialty.length).toBeGreaterThanOrEqual(1)
    const goods = specialty.flatMap((s) => s.goodsProvided)
    let uncommonCount = 0
    for (const id of goods) {
      if (!stockRegistry.has(id)) continue
      if (stockRegistry.get(id).defaultState.rarity === 'uncommon') {
        uncommonCount += 1
      }
    }
    expect(uncommonCount).toBeGreaterThanOrEqual(2)
  })

  it('at least two non-specialty alternates carry uncommon-tier ingredients', () => {
    ensureRequiredSuppliersRegistered()
    let uncommonCarriers = 0
    for (const def of supplierRegistry.all()) {
      if (def.supplierType === 'specialty_goods') continue
      const hasUncommon = def.goodsProvided.some(
        (g) =>
          stockRegistry.has(g) &&
          stockRegistry.get(g).defaultState.rarity === 'uncommon',
      )
      if (hasUncommon) uncommonCarriers += 1
    }
    expect(uncommonCarriers).toBeGreaterThanOrEqual(2)
  })

  it('cross-reference validation passes — every goodsProvided id is a real stock id', () => {
    const state = createInitialTavernState()
    const validated = validateState(state)
    for (const supplier of Object.values(validated.world.suppliers)) {
      for (const stockId of supplier.goodsProvided) {
        expect(state.stock[stockId]).toBeDefined()
      }
    }
  })

  it('state.world.suppliers seeds from the registry including the new entries', () => {
    const state = createInitialTavernState()
    expect(state.world.suppliers['crystalspine_traders']).toBeDefined()
    expect(state.world.suppliers['marsh_root_peddler']).toBeDefined()
    expect(state.world.suppliers['gildlock_brewhouse']).toBeDefined()
    expect(state.world.suppliers['silken_road_caravan']).toBeDefined()
    expect(state.world.suppliers['north_pier_smokehouse']).toBeDefined()
  })
})
