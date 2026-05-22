// Phase 127 / ISSUE-096 — Voiced Surface arc, Phase 1.
//
// Coverage for the new `signalEquals` snippet condition. Exercises the
// happy path (band matches), the kind-mismatch fall-through, the
// missing-actor fall-through, and the unmatched-value path.

import { describe, expect, it } from 'vitest'

import { evalCondition } from '../../../src/cards/compose/conditions'
import type { SnippetCondition } from '../../../src/cards/compose/types'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type {
  EntityRef,
  TavernState,
} from '../../../src/sim/state/TavernState'
import { makeSeed } from '../cardFactories'

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

function supplierRef(id: string): EntityRef {
  return { kind: 'supplier', id }
}

describe('evalCondition — signalEquals', () => {
  const base = createInitialTavernState()
  const supplierId = Object.keys(base.world.suppliers)[0]!

  it('matches when the resolved band equals the condition', () => {
    const state = withSupplier(base, supplierId, { reliability: 80 })
    const seed = makeSeed({ primaryActor: supplierRef(supplierId) })
    const cond: SnippetCondition = {
      kind: 'signalEquals',
      role: 'primaryActor',
      signal: 'supplier.reliability',
      equals: 'high',
    }
    expect(evalCondition(cond, seed, state)).toBe(true)
  })

  it('fails when the resolved band differs from the condition', () => {
    const state = withSupplier(base, supplierId, { reliability: 50 })
    const seed = makeSeed({ primaryActor: supplierRef(supplierId) })
    expect(
      evalCondition(
        {
          kind: 'signalEquals',
          role: 'primaryActor',
          signal: 'supplier.reliability',
          equals: 'high',
        },
        seed,
        state,
      ),
    ).toBe(false)
  })

  it('fails silently when the seed has no actor in the role', () => {
    const seed = makeSeed() // no primaryActor by default
    expect(
      evalCondition(
        {
          kind: 'signalEquals',
          role: 'primaryActor',
          signal: 'supplier.reliability',
          equals: 'high',
        },
        seed,
        base,
      ),
    ).toBe(false)
  })

  it('fails silently when the entity kind does not match the signal', () => {
    const seed = makeSeed({
      primaryActor: { kind: 'staff', id: supplierId }, // wrong kind
    })
    expect(
      evalCondition(
        {
          kind: 'signalEquals',
          role: 'primaryActor',
          signal: 'supplier.reliability',
          equals: 'high',
        },
        seed,
        base,
      ),
    ).toBe(false)
  })

  it('fails silently when the entity id is not on state', () => {
    const seed = makeSeed({ primaryActor: supplierRef('no_such_supplier') })
    expect(
      evalCondition(
        {
          kind: 'signalEquals',
          role: 'primaryActor',
          signal: 'supplier.reliability',
          equals: 'high',
        },
        seed,
        base,
      ),
    ).toBe(false)
  })

  it('resolves named-entity roles (non-primaryActor lookups)', () => {
    const state = withSupplier(base, supplierId, { reliability: 20 })
    const seed = makeSeed({
      textIngredients: {
        namedEntities: [
          {
            role: 'vendor',
            ref: supplierRef(supplierId),
            displayName: 'Test Vendor',
          },
        ],
      },
    })
    expect(
      evalCondition(
        {
          kind: 'signalEquals',
          role: 'vendor',
          signal: 'supplier.reliability',
          equals: 'low',
        },
        seed,
        state,
      ),
    ).toBe(true)
  })

  it('reaches faction and area signals via the same arm', () => {
    const factionId = Object.keys(base.world.factions)[0]
    if (factionId) {
      const adjusted: TavernState = {
        ...base,
        world: {
          ...base.world,
          factions: {
            ...base.world.factions,
            [factionId]: {
              ...base.world.factions[factionId]!,
              relationship: 10,
            },
          },
        },
      }
      const seed = makeSeed({ primaryActor: { kind: 'faction', id: factionId } })
      expect(
        evalCondition(
          {
            kind: 'signalEquals',
            role: 'primaryActor',
            signal: 'faction.relationship',
            equals: 'low',
          },
          seed,
          adjusted,
        ),
      ).toBe(true)
    }

    const areaId = Object.keys(base.areas)[0]!
    const adjustedArea: TavernState = {
      ...base,
      areas: {
        ...base.areas,
        [areaId]: { ...base.areas[areaId]!, condition: 90 },
      },
    }
    const seedArea = makeSeed({ primaryActor: { kind: 'area', id: areaId } })
    expect(
      evalCondition(
        {
          kind: 'signalEquals',
          role: 'primaryActor',
          signal: 'area.condition',
          equals: 'high',
        },
        seedArea,
        adjustedArea,
      ),
    ).toBe(true)
  })
})
