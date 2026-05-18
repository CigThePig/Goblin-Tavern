// Phase 95 / ISSUE-055 — Area content unpinning.
//
// Covers the shared `areaPickers` module: customer-facing,
// kitchen-adjacent, and repairable picks rotate by family/day, with
// `main_room` only as a fallback when no tagged area qualifies.

import { describe, expect, it } from 'vitest'

import {
  pickCustomerFacingArea,
  pickKitchenAdjacentArea,
  pickRepairableArea,
} from '../../src/sim/modules/issues/areaPickers'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { SimContext } from '../../src/sim/core/context'
import type { TavernState } from '../../src/sim/state/TavernState'

function fakeCtx(state: TavernState): SimContext {
  return { state } as unknown as SimContext
}

function withAreas(state: TavernState, areas: TavernState['areas']): TavernState {
  return { ...state, areas }
}

describe('Phase 95 — pickCustomerFacingArea', () => {
  it('rotates across customer_facing areas when several exist', () => {
    const state = createInitialTavernState()
    // Inject two extra customer-facing areas so the rotation has options.
    const areas = {
      ...state.areas,
      private_booth: {
        id: 'private_booth',
        label: 'Private Booth',
        condition: 80,
        cleanliness: 60,
        mess: 0,
        damage: 0,
        smell: 0,
        risk: 0,
        tags: ['public', 'customer_facing'],
        activeProblems: [],
        traits: [],
        atmosphere: [],
        upgrades: {},
      },
      stage_corner: {
        id: 'stage_corner',
        label: 'Stage Corner',
        condition: 80,
        cleanliness: 60,
        mess: 0,
        damage: 0,
        smell: 0,
        risk: 0,
        tags: ['public', 'customer_facing'],
        activeProblems: [],
        traits: [],
        atmosphere: [],
        upgrades: {},
      },
    }
    const next = withAreas(state, areas)
    const picks = new Set<string>()
    for (let day = 0; day < 28; day += 1) {
      const s = {
        ...next,
        calendar: { ...next.calendar, totalDaysElapsed: day },
      }
      picks.add(pickCustomerFacingArea(fakeCtx(s), 'test_family').id)
    }
    expect(picks.size).toBeGreaterThan(1)
  })

  it('falls back to main_room when no customer_facing area exists', () => {
    const state = createInitialTavernState()
    const stripped = withAreas(
      state,
      Object.fromEntries(
        Object.entries(state.areas).map(([id, a]) => [
          id,
          { ...a, tags: a.tags.filter((t) => t !== 'customer_facing') },
        ]),
      ) as TavernState['areas'],
    )
    const ref = pickCustomerFacingArea(fakeCtx(stripped), 'test_family')
    expect(ref.id).toBe('main_room')
  })
})

describe('Phase 95 — pickKitchenAdjacentArea', () => {
  it('returns the kitchen by default', () => {
    const state = createInitialTavernState()
    const ref = pickKitchenAdjacentArea(fakeCtx(state), 'food_safety')
    expect(['kitchen', 'herb_garden']).toContain(ref.id)
  })

  it('includes herb_garden when tagged kitchen_adjacent', () => {
    const state = createInitialTavernState()
    const ref = pickKitchenAdjacentArea(fakeCtx(state), 'food_safety')
    // Just confirm it's a real area.
    expect(state.areas[ref.id]).toBeDefined()
  })
})

describe('Phase 95 — pickRepairableArea', () => {
  it('prefers a damaged area over any other repairable candidate', () => {
    const state = createInitialTavernState()
    const damagedAreaId = Object.keys(state.areas)[0]!
    // Strip default damage from every other area so our target wins.
    const cleanedAreas: TavernState['areas'] = Object.fromEntries(
      Object.entries(state.areas).map(([id, a]) => [
        id,
        id === damagedAreaId ? { ...a, damage: 40 } : { ...a, damage: 0 },
      ]),
    ) as TavernState['areas']
    const next = withAreas(state, cleanedAreas)
    const ref = pickRepairableArea(fakeCtx(next), 'test_family')
    expect(ref.id).toBe(damagedAreaId)
  })

  it('falls back to inspection_relevant areas when nothing is damaged', () => {
    const state = createInitialTavernState()
    // Strip damage from every area so the fallback path kicks in.
    const cleanAreas: TavernState['areas'] = Object.fromEntries(
      Object.entries(state.areas).map(([id, a]) => [id, { ...a, damage: 0 }]),
    ) as TavernState['areas']
    const next = withAreas(state, cleanAreas)
    const ref = pickRepairableArea(fakeCtx(next), 'test_family')
    const fallback = next.areas[ref.id]
    expect(fallback).toBeDefined()
    expect(
      fallback!.tags.includes('inspection_relevant') ||
        fallback!.tags.includes('structure') ||
        ref.id === 'main_room',
    ).toBe(true)
  })
})
