// Phase 127 / ISSUE-096 — Voiced Surface arc, Phase 1.
//
// Boundary tests for every numeric band signal in `src/sim/signals/`.
// Each signal is exercised at the low/mid cut-point and at the
// mid/high cut-point so the inclusive-of-lower-bound semantics are
// pinned. Determinism is asserted by `structuredClone` round-trip on
// the same state.

import { describe, expect, it } from 'vitest'

import {
  ALL_BAND_IDS,
  BAND_THRESHOLDS,
  areaCleanlinessBand,
  areaConditionBand,
  bandOf,
  customerGroupLoyaltyBand,
  customerGroupSatisfactionBand,
  factionInfluenceBand,
  factionRelationshipBand,
  querySignal,
  regularIrritationBand,
  regularLoyaltyBand,
  staffFatigueBand,
  staffStressBand,
  supplierRelationshipBand,
  supplierReliabilityBand,
  type BandId,
  type SignalId,
} from '../../src/sim/signals'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'

describe('bandOf — pure bander', () => {
  it('lands < lowMax in low; >= midMax in high; otherwise mid', () => {
    expect(bandOf(0, [40, 70])).toBe<BandId>('low')
    expect(bandOf(39, [40, 70])).toBe<BandId>('low')
    expect(bandOf(40, [40, 70])).toBe<BandId>('mid')
    expect(bandOf(69, [40, 70])).toBe<BandId>('mid')
    expect(bandOf(70, [40, 70])).toBe<BandId>('high')
    expect(bandOf(100, [40, 70])).toBe<BandId>('high')
  })

  it('all SignalIds have threshold tables', () => {
    const ids: SignalId[] = [
      'supplier.reliability',
      'supplier.relationship',
      'staff.stress',
      'staff.fatigue',
      'faction.relationship',
      'faction.influence',
      'area.condition',
      'area.cleanliness',
      'regular.irritation',
      'regular.loyalty',
      'customer_group.satisfaction',
      'customer_group.loyalty',
    ]
    for (const id of ids) {
      expect(BAND_THRESHOLDS[id]).toBeDefined()
      const [low, mid] = BAND_THRESHOLDS[id]
      expect(low).toBeLessThan(mid)
    }
  })

  it('ALL_BAND_IDS lists every band id exactly once', () => {
    expect([...ALL_BAND_IDS].sort()).toEqual(['high', 'low', 'mid'])
  })
})

describe('supplier signals', () => {
  function withSupplier(
    base: TavernState,
    id: string,
    overrides: Partial<{ reliability: number; relationship: number }>,
  ): TavernState {
    const existing = base.world.suppliers[id]
    if (!existing) throw new Error(`fixture expects supplier ${id}`)
    return {
      ...base,
      world: {
        ...base.world,
        suppliers: {
          ...base.world.suppliers,
          [id]: { ...existing, ...overrides },
        },
      },
    }
  }

  const base = createInitialTavernState()
  const supplierId = Object.keys(base.world.suppliers)[0]!

  it('reliabilityBand bands across the cut-points', () => {
    expect(
      supplierReliabilityBand(withSupplier(base, supplierId, { reliability: 0 }), supplierId),
    ).toBe('low')
    expect(
      supplierReliabilityBand(withSupplier(base, supplierId, { reliability: 39 }), supplierId),
    ).toBe('low')
    expect(
      supplierReliabilityBand(withSupplier(base, supplierId, { reliability: 40 }), supplierId),
    ).toBe('mid')
    expect(
      supplierReliabilityBand(withSupplier(base, supplierId, { reliability: 69 }), supplierId),
    ).toBe('mid')
    expect(
      supplierReliabilityBand(withSupplier(base, supplierId, { reliability: 70 }), supplierId),
    ).toBe('high')
    expect(
      supplierReliabilityBand(withSupplier(base, supplierId, { reliability: 100 }), supplierId),
    ).toBe('high')
  })

  it('relationshipBand bands across the cut-points', () => {
    expect(
      supplierRelationshipBand(withSupplier(base, supplierId, { relationship: 40 }), supplierId),
    ).toBe('mid')
  })

  it('returns undefined for unknown supplier id', () => {
    expect(supplierReliabilityBand(base, 'no_such_supplier')).toBeUndefined()
    expect(supplierRelationshipBand(base, 'no_such_supplier')).toBeUndefined()
  })
})

describe('staff signals', () => {
  function withStaff(
    base: TavernState,
    id: string,
    overrides: Partial<{ stress: number; fatigue: number }>,
  ): TavernState {
    const existing = base.staff[id]
    if (!existing) throw new Error(`fixture expects staff ${id}`)
    return {
      ...base,
      staff: { ...base.staff, [id]: { ...existing, ...overrides } },
    }
  }

  const base = createInitialTavernState()
  const staffId = Object.keys(base.staff)[0]!

  it('stressBand at the cut-points', () => {
    expect(staffStressBand(withStaff(base, staffId, { stress: 39 }), staffId)).toBe('low')
    expect(staffStressBand(withStaff(base, staffId, { stress: 40 }), staffId)).toBe('mid')
    expect(staffStressBand(withStaff(base, staffId, { stress: 70 }), staffId)).toBe('high')
  })

  it('fatigueBand at the cut-points', () => {
    expect(staffFatigueBand(withStaff(base, staffId, { fatigue: 39 }), staffId)).toBe('low')
    expect(staffFatigueBand(withStaff(base, staffId, { fatigue: 70 }), staffId)).toBe('high')
  })

  it('returns undefined for unknown staff id', () => {
    expect(staffStressBand(base, 'no_such_staff')).toBeUndefined()
    expect(staffFatigueBand(base, 'no_such_staff')).toBeUndefined()
  })
})

describe('faction signals', () => {
  const base = createInitialTavernState()
  const factionId = Object.keys(base.world.factions)[0]

  it('returns undefined when no faction is registered', () => {
    expect(factionRelationshipBand(base, 'no_such_faction')).toBeUndefined()
    expect(factionInfluenceBand(base, 'no_such_faction')).toBeUndefined()
  })

  if (factionId) {
    it('bands an existing faction by relationship/influence', () => {
      const adjusted: TavernState = {
        ...base,
        world: {
          ...base.world,
          factions: {
            ...base.world.factions,
            [factionId]: {
              ...base.world.factions[factionId]!,
              relationship: 80,
              influence: 25,
            },
          },
        },
      }
      expect(factionRelationshipBand(adjusted, factionId)).toBe('high')
      expect(factionInfluenceBand(adjusted, factionId)).toBe('low')
    })
  }
})

describe('area signals', () => {
  const base = createInitialTavernState()
  const areaId = Object.keys(base.areas)[0]!

  it('condition + cleanliness bands respect the cut-points', () => {
    const adjusted: TavernState = {
      ...base,
      areas: {
        ...base.areas,
        [areaId]: {
          ...base.areas[areaId]!,
          condition: 39,
          cleanliness: 70,
        },
      },
    }
    expect(areaConditionBand(adjusted, areaId)).toBe('low')
    expect(areaCleanlinessBand(adjusted, areaId)).toBe('high')
  })

  it('returns undefined for unknown area id', () => {
    expect(areaConditionBand(base, 'no_such_area')).toBeUndefined()
    expect(areaCleanlinessBand(base, 'no_such_area')).toBeUndefined()
  })
})

// Phase 134 / ISSUE-103 — Voiced Surface Phase 8 (Regulars & Complaints).
describe('regular signals', () => {
  const base = createInitialTavernState()
  const regularIds = Object.keys(base.world.regulars)

  it('returns undefined when no regular is registered', () => {
    expect(regularIrritationBand(base, 'no_such_regular')).toBeUndefined()
    expect(regularLoyaltyBand(base, 'no_such_regular')).toBeUndefined()
  })

  if (regularIds[0]) {
    const regularId = regularIds[0]
    function withRegular(
      overrides: Partial<{ irritation: number; loyalty: number }>,
    ): TavernState {
      const existing = base.world.regulars[regularId]!
      return {
        ...base,
        world: {
          ...base.world,
          regulars: {
            ...base.world.regulars,
            [regularId]: { ...existing, ...overrides },
          },
        },
      }
    }

    it('irritationBand at the cut-points', () => {
      expect(regularIrritationBand(withRegular({ irritation: 39 }), regularId)).toBe('low')
      expect(regularIrritationBand(withRegular({ irritation: 40 }), regularId)).toBe('mid')
      expect(regularIrritationBand(withRegular({ irritation: 69 }), regularId)).toBe('mid')
      expect(regularIrritationBand(withRegular({ irritation: 70 }), regularId)).toBe('high')
    })

    it('loyaltyBand at the cut-points', () => {
      expect(regularLoyaltyBand(withRegular({ loyalty: 39 }), regularId)).toBe('low')
      expect(regularLoyaltyBand(withRegular({ loyalty: 40 }), regularId)).toBe('mid')
      expect(regularLoyaltyBand(withRegular({ loyalty: 70 }), regularId)).toBe('high')
    })
  }
})

describe('customer_group signals', () => {
  const base = createInitialTavernState()
  const groupId = Object.keys(base.customerGroups)[0]!

  function withGroup(
    overrides: Partial<{ satisfaction: number; loyalty: number }>,
  ): TavernState {
    const existing = base.customerGroups[groupId]!
    return {
      ...base,
      customerGroups: {
        ...base.customerGroups,
        [groupId]: { ...existing, ...overrides },
      },
    }
  }

  it('satisfactionBand at the cut-points', () => {
    expect(customerGroupSatisfactionBand(withGroup({ satisfaction: 39 }), groupId)).toBe('low')
    expect(customerGroupSatisfactionBand(withGroup({ satisfaction: 40 }), groupId)).toBe('mid')
    expect(customerGroupSatisfactionBand(withGroup({ satisfaction: 70 }), groupId)).toBe('high')
  })

  it('loyaltyBand at the cut-points', () => {
    expect(customerGroupLoyaltyBand(withGroup({ loyalty: 39 }), groupId)).toBe('low')
    expect(customerGroupLoyaltyBand(withGroup({ loyalty: 70 }), groupId)).toBe('high')
  })

  it('returns undefined for unknown group id', () => {
    expect(customerGroupSatisfactionBand(base, 'no_such_group')).toBeUndefined()
    expect(customerGroupLoyaltyBand(base, 'no_such_group')).toBeUndefined()
  })
})

describe('querySignal — dispatcher', () => {
  const base = createInitialTavernState()
  const supplierId = Object.keys(base.world.suppliers)[0]!
  const supplierState: TavernState = {
    ...base,
    world: {
      ...base.world,
      suppliers: {
        ...base.world.suppliers,
        [supplierId]: { ...base.world.suppliers[supplierId]!, reliability: 80 },
      },
    },
  }

  it('returns a band for matching kind + signal', () => {
    const result = querySignal(supplierState, 'supplier.reliability', {
      kind: 'supplier',
      id: supplierId,
    })
    expect(result).toEqual({ band: 'high' })
  })

  it('returns missing for mismatched ref kind', () => {
    const result = querySignal(supplierState, 'supplier.reliability', {
      kind: 'staff',
      id: supplierId,
    })
    expect(result).toEqual({ missing: true })
  })

  it('returns missing for unknown entity id', () => {
    const result = querySignal(supplierState, 'supplier.reliability', {
      kind: 'supplier',
      id: 'no_such_supplier',
    })
    expect(result).toEqual({ missing: true })
  })

  it('is deterministic under structuredClone', () => {
    const cloned = structuredClone(supplierState)
    const a = querySignal(supplierState, 'supplier.reliability', {
      kind: 'supplier',
      id: supplierId,
    })
    const b = querySignal(cloned, 'supplier.reliability', {
      kind: 'supplier',
      id: supplierId,
    })
    expect(a).toEqual(b)
  })

  // Phase 134 / ISSUE-103 — Voiced Surface Phase 8.
  it('dispatches regular signals and rejects wrong kinds', () => {
    const regularIds = Object.keys(base.world.regulars)
    if (regularIds[0]) {
      const regularId = regularIds[0]
      const adjusted: TavernState = {
        ...base,
        world: {
          ...base.world,
          regulars: {
            ...base.world.regulars,
            [regularId]: { ...base.world.regulars[regularId]!, irritation: 85 },
          },
        },
      }
      expect(
        querySignal(adjusted, 'regular.irritation', { kind: 'regular', id: regularId }),
      ).toEqual({ band: 'high' })
      expect(
        querySignal(adjusted, 'regular.irritation', { kind: 'staff', id: regularId }),
      ).toEqual({ missing: true })
      expect(
        querySignal(adjusted, 'regular.loyalty', { kind: 'regular', id: 'nope' }),
      ).toEqual({ missing: true })
    }
  })

  it('dispatches customer_group signals and rejects wrong kinds', () => {
    const groupId = Object.keys(base.customerGroups)[0]!
    const adjusted: TavernState = {
      ...base,
      customerGroups: {
        ...base.customerGroups,
        [groupId]: { ...base.customerGroups[groupId]!, satisfaction: 25 },
      },
    }
    expect(
      querySignal(adjusted, 'customer_group.satisfaction', {
        kind: 'customer_group',
        id: groupId,
      }),
    ).toEqual({ band: 'low' })
    expect(
      querySignal(adjusted, 'customer_group.satisfaction', {
        kind: 'regular',
        id: groupId,
      }),
    ).toEqual({ missing: true })
    expect(
      querySignal(adjusted, 'customer_group.loyalty', {
        kind: 'customer_group',
        id: 'no_such_group',
      }),
    ).toEqual({ missing: true })
  })
})
