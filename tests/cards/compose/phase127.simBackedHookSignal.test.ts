// Phase 127 / ISSUE-096 — Voiced Surface arc, Phase 1.
//
// The drink_order spec's `sim_backed_hook` slot remained DISABLED
// because "the underlying sim signals do not yet exist." Phase 1 ships
// those signals. No snippet is authored yet (that's Phase 3's spike) —
// this test only proves the signals reach: a `signalEquals` snippet
// crafted against the slot's intended actor (a regular customer is the
// closest analogue; in practice the customer's repeat-visit count is
// what the slot would gate on) evaluates true under realistic state.
//
// Once Phase 3 authors a real snippet, the slot can be wired with
// confidence that its conditions hit data, not silence.

import { describe, expect, it } from 'vitest'

import { evalCondition } from '../../../src/cards/compose/conditions'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type {
  EntityRef,
  MemoryState,
  TavernState,
} from '../../../src/sim/state/TavernState'
import { makeSeed } from '../cardFactories'

function regularRef(id: string): EntityRef {
  return { kind: 'regular', id }
}

function memory(opts: {
  id: string
  tags: string[]
  absoluteDay: number
}): MemoryState {
  return {
    id: opts.id,
    type: 'fact',
    strength: 50,
    ageDays: 0,
    createdAt: {
      year: 1,
      month: 1,
      week: 1,
      day: 1,
      absoluteDay: opts.absoluteDay,
    },
    actors: [],
    locations: [],
    relatedSystems: [],
    tags: opts.tags,
  }
}

describe('drink_order.sim_backed_hook — signals reach', () => {
  const base = createInitialTavernState()
  const regularId = Object.keys(base.world.regulars)[0]
  if (!regularId) {
    it.skip('starter regulars seeded — needed for this signal', () => {})
    return
  }

  it('repeatCount resolves true for a recurring subject tag', () => {
    const today = base.calendar.totalDaysElapsed
    const state: TavernState = {
      ...base,
      memories: [
        memory({ id: 'm1', tags: ['drink_order'], absoluteDay: today }),
        memory({ id: 'm2', tags: ['drink_order'], absoluteDay: today - 3 }),
      ],
    }
    const seed = makeSeed({
      family: 'regular_customer',
      type: 'relationship_test',
      primaryActor: regularRef(regularId),
    })
    expect(
      evalCondition(
        { kind: 'repeatCount', subjectTag: 'drink_order', atLeast: 2 },
        seed,
        state,
      ),
    ).toBe(true)
  })

  it('pressureRising resolves true when a stock_shortage pressure rises', () => {
    const state: TavernState = {
      ...base,
      pressures: {
        ...base.pressures,
        stock_shortage: {
          id: 'stock_shortage',
          label: 'Stock shortage',
          value: 50,
          trend: 4,
          tags: [],
          topCauses: [],
        },
      },
    }
    const seed = makeSeed({
      family: 'regular_customer',
      primaryActor: regularRef(regularId),
    })
    expect(
      evalCondition(
        { kind: 'pressureRising', pressureId: 'stock_shortage' },
        seed,
        state,
      ),
    ).toBe(true)
  })

  it('hasNamedEntity + memoryPresent are inert-but-resolvable today', () => {
    // Demonstrates that all four state-lookup primitives the slot might
    // gate on are reachable; gives Phase 3 a known-good harness.
    const state: TavernState = {
      ...base,
      memories: [memory({ id: 'm', tags: ['drink_order'], absoluteDay: 0 })],
    }
    const seed = makeSeed({
      family: 'regular_customer',
      primaryActor: regularRef(regularId),
      textIngredients: {
        namedEntities: [
          {
            role: 'customer',
            ref: regularRef(regularId),
            displayName: 'Test Regular',
          },
        ],
      },
    })
    expect(
      evalCondition({ kind: 'hasNamedEntity', role: 'customer' }, seed, state),
    ).toBe(true)
    expect(
      evalCondition({ kind: 'memoryPresent', tag: 'drink_order' }, seed, state),
    ).toBe(true)
  })
})
