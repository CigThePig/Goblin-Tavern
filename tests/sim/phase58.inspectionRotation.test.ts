import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import { getIssueSeeds } from '../../src/sim/modules/issues/issueSeedQueries'
import { withArea, withStock } from '../../src/sim/testing/stateFactories'

// Phase 58 / ISSUE-018 — `inspection` family un-pinning.

const SEED = 'phase-58-inspection'

function plentyOfStock(state: TavernState): TavernState {
  return {
    ...state,
    stock: {
      ...state.stock,
      ale: { ...state.stock.ale!, quantity: 800, quality: 60 },
      stew: { ...state.stock.stew!, quantity: 400, quality: 60 },
      mushrooms: { ...state.stock.mushrooms!, quantity: 200 },
    },
  }
}

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

function runDay(state: TavernState, overrides: Partial<SimInput> = {}) {
  return simulateDay(state, input(overrides), FULL_PIPELINE)
}

/**
 * Push inspection pressure past 35 by dirtying kitchen + privy +
 * spoiling stock — mirrors the existing phase19 inspection trigger
 * pattern.
 */
function inspectionState(): TavernState {
  let base = plentyOfStock(createInitialTavernState())
  base = withArea(base, 'kitchen', { cleanliness: 10, smell: 80 })
  base = withArea(base, 'privy', { cleanliness: 5, smell: 90 })
  base = withStock(base, 'mushrooms', { spoilage: 90 })
  base = withStock(base, 'stew', { spoilage: 80, quantity: 400 })
  return base
}

describe('Phase 58 §ISSUE-018 — Primary faction rotation', () => {
  it('rotates the primary faction across distinct ids over a 14-day window', () => {
    let state = inspectionState()
    const primaryIds = new Set<string>()
    for (let i = 0; i < 14; i += 1) {
      const result = runDay(state)
      state = result.state
      const seeds = getIssueSeeds(state, { family: 'inspection' })
      const seed = seeds[0]
      if (seed?.primaryActor) {
        // Primary actor may be a notable_npc (when bound) or a
        // faction ref. Notable NPCs are bound through the picked
        // primary faction — we count the underlying picked faction
        // via the seed's affectedActors (which includes the picked
        // support refs but NOT the primary — so we read the
        // primary's id from the picker's recordPick state instead).
        primaryIds.add(seed.primaryActor.id)
      }
    }
    // Even with the +20 inspection_authority bonus pinning town_watch
    // as the leading primary, the recency penalty should push at
    // least one other faction into rotation over 14 days.
    expect(primaryIds.size).toBeGreaterThanOrEqual(2)
  })

  it("town_watch's primary-pick count over 14 days drops below saturation", () => {
    let state = inspectionState()
    const issueSeedsTrack: string[] = []
    for (let i = 0; i < 14; i += 1) {
      const result = runDay(state)
      state = result.state
      const seeds = getIssueSeeds(state, { family: 'inspection' })
      const seed = seeds[0]
      if (seed?.primaryActor) issueSeedsTrack.push(seed.primaryActor.id)
    }
    // Read the recent-picks state to count how many distinct days
    // town_watch was picked as primary.
    const slice = state.modules.issueSeeds as
      | { recentPicks?: Record<string, Record<string, number>> }
      | undefined
    const inspectionPicks = slice?.recentPicks?.inspection ?? {}
    expect(inspectionPicks).toHaveProperty('faction:town_watch')
    // At least one OTHER faction must appear in the picks history.
    const otherFactionPicks = Object.keys(inspectionPicks).filter(
      (k) => k !== 'faction:town_watch' && k.startsWith('faction:'),
    )
    expect(otherFactionPicks.length).toBeGreaterThanOrEqual(1)
  })
})

describe('Phase 58 §ISSUE-018 — Non-regression on existing semantics', () => {
  it('the inspection seed still surfaces the canonical 8 response slots', () => {
    // Phase 186 / Cluster 1 — `inspection` is a morning seed that reads the
    // prior day's closing pressure snapshot, so warm one day to populate it.
    const day1 = runDay(runDay(inspectionState()).state)
    const seed = getIssueSeeds(day1.state, { family: 'inspection' })[0]
    expect(seed).toBeDefined()
    expect(seed!.responseSlots.length).toBe(8)
    const slotIds = seed!.responseSlots.map((s) => s.id).sort()
    expect(slotIds).toEqual(
      [
        'ask_town_watch_for_guidance',
        'bribe',
        'clean',
        'cleaning_roster',
        'hide',
        'ignore',
        'improve_food_safety',
        'preinspection_walkthrough',
      ],
    )
  })
})
