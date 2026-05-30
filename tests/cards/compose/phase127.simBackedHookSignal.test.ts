// Phase 127 / ISSUE-096 — Voiced Surface arc, Phase 1.
//
// The drink_order spec's `sim_backed_hook` slot remained DISABLED
// because "the underlying sim signals do not yet exist." Phase 1 shipped
// those signals; the three primitive tests below prove they reach.
//
// Phase 169 / ISSUE-137 — Complete Surface arc, Phase 2 (drinkOrder
// Parity). The slot is no longer "empty in the live pool." drinkOrder
// now carries a sim-backed `establishing_line` slot keyed on the
// `regular_customer` salience reads (irritation × loyalty bands, the
// family pressure, choice-affecting memories, the repeat pattern). The
// previously-skipped guard at the bottom of this file — `it.skip(...)`
// pending "starter regulars seeded" — is gone: `createInitialTavernState()`
// seeds eleven starter regulars, all with castAttributes, so the guard
// was dead. The render assertion this file's preamble promised "in
// principle" is now live: a real drink_order seed renders an establishing
// line composed from a state-keyed snippet, not the bare fallback.

import { describe, expect, it } from 'vitest'

import { drinkOrderCard } from '../../../src/cards/index'
import { evalCondition } from '../../../src/cards/compose/conditions'
import { resolveSalientReads } from '../../../src/cards/compose/salience'
import { drinkOrderEstablishingLinePool } from '../../../src/cards/compose/pools/drinkOrder'
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
  const regularId = Object.keys(base.world.regulars)[0]!

  it('starter regulars are seeded with cast attributes', () => {
    // The guard this test file used to `it.skip()` past: the slot needs a
    // real regular to voice. createInitialTavernState seeds them.
    expect(regularId).toBeDefined()
    expect(base.world.regulars[regularId]!.castAttributes).toBeDefined()
  })

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
    // gate on are reachable; gives the establishing pool a known-good harness.
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

  // Phase 169 / ISSUE-137 — the assertion Voiced Surface Phase 1 promised
  // "in principle": the sim-backed slot resolves a state-keyed line at
  // render, not the bare fallback.
  describe('the establishing slot resolves a salient line at render', () => {
    const seed = makeSeed({
      family: 'regular_customer',
      type: 'relationship_test',
      timing: 'during_service',
      primaryActor: regularRef(regularId),
    })

    it('the regular_customer salience reads resolve against the starter state', () => {
      const reads = resolveSalientReads(seed, base)
      // The starter regular sits at irritation=low (band low) and
      // loyalty>=70 (band high) — both signal reads resolve.
      expect(reads.length).toBeGreaterThan(0)
      const signals = reads.filter((r) => r.read.kind === 'signal')
      expect(signals.length).toBeGreaterThanOrEqual(2)
    })

    it('renders the establishing line from a sim-backed snippet, not the bare fallback', () => {
      const view = drinkOrderCard.render(seed, base)
      const fallback = drinkOrderEstablishingLinePool.snippets.find(
        (s) => s.id === 'est_fallback',
      )!
      // body[0] is the establishing line. The starter regular's
      // irritation=low × loyalty=high standing resolves the covering
      // combo, which out-ranks the fallback under saliencePolicy:'multi'.
      expect(view.body[0]).toBeDefined()
      expect(view.body[0]).not.toBe(fallback.text)
      const covering = drinkOrderEstablishingLinePool.snippets.find(
        (s) => s.id === 'est_low_irritation_high_loyalty',
      )!
      expect(view.body[0]).toBe(covering.text)
    })

    it('renders the same establishing line for the same seed + state (determinism)', () => {
      const a = drinkOrderCard.render(seed, base)
      const b = drinkOrderCard.render(seed, base)
      expect(a.body[0]).toBe(b.body[0])
    })
  })
})
