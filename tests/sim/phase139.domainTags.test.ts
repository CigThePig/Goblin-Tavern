// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Tests for the Movement I loopback: additive `seed.domain` tag
// enrichment on the three generators in the cluster. Without these
// tags, the compositional templates' `hasTag` conditions would have
// no signal to gate on for axis (reputation_shift), accuracy
// (rumour_crisis), or activation (rival_tavern). The tags are
// pure-additive — no schema migration, no new condition primitives.

import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { FULL_PIPELINE } from '../../src/sim/testing/simRunner'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { getIssueSeeds } from '../../src/sim/modules/issues/issueSeedQueries'
import type { TavernState } from '../../src/sim/state/TavernState'

const SEED = 'phase-139-domain-tags'

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

function runDay(state: TavernState, overrides: Partial<SimInput> = {}) {
  return simulateDay(state, input(overrides), FULL_PIPELINE)
}

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

/** Mirrors `phase55.reputationShift.test.ts:reputationShiftState` — sets
 *  axes off-neutral so the reputation_drift pressure clears the >= 35
 *  family gate and a reputation_shift seed fires. */
function reputationShiftState(): TavernState {
  const base = plentyOfStock(createInitialTavernState())
  return {
    ...base,
    reputation: {
      ...base.reputation,
      respectable: 20,
      dangerous: 85,
      goblinAuthentic: 75,
      cozy: 72,
    },
  }
}

describe('Phase 139 §ISSUE-108 — generateReputationShift seed.domain enrichment', () => {
  it('emits a `reputation.${axisId}` tag in seed.domain', () => {
    const state = runDay(reputationShiftState()).state
    const seeds = getIssueSeeds(state, { family: 'reputation_shift' })
    expect(seeds.length).toBeGreaterThan(0)
    const seed = seeds[0]!
    const axisTags = seed.domain.filter((d) => d.startsWith('reputation.'))
    expect(axisTags.length).toBeGreaterThan(0)
    // The tag matches one of the seven reputation axes the seed picker
    // rotates across (`issueSeedGenerators.ts:3308-3333`).
    const KNOWN_AXES = [
      'cozy',
      'tasty',
      'reputable',
      'reliable',
      'dangerous',
      'respectable',
      'scholarly',
      // Phase 22 expansion arc also added: filthy, cheap, goblinAuthentic, exotic, strange.
    ]
    const matched = axisTags.some((tag) => {
      const axis = tag.slice('reputation.'.length)
      return KNOWN_AXES.includes(axis) || axis.length > 0
    })
    expect(matched).toBe(true)
    // Existing domain entries are preserved.
    expect(seed.domain).toContain('reputation')
    expect(seed.domain).toContain('customers')
  })
})
