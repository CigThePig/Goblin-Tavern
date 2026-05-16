import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'

import { FULL_PIPELINE } from '../../src/sim/testing/simRunner'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import type { ResponseIntent } from '../../src/sim/modules/issues/issueSeedTypes'
import { getIssueSeeds } from '../../src/sim/modules/issues/issueSeedQueries'
import type { ResponsesModuleState } from '../../src/sim/modules/responses/types'
import { RESPONSES_MODULE_ID } from '../../src/sim/modules/responses/types'

// Phase 55 / ISSUE-015 — `reputation_shift` family rewrite.
//
// Asserts:
//   1. Picker rotates across reputation axes (not always the strongest).
//   2. Each of 4 slots produces distinct treatment-vs-control mutation.
//   3. Each slot enqueues a pending entry (delayedEffect / futureHook).

const SEED = 'phase-55-reputation-shift'

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

function getResponsesSlice(state: TavernState): ResponsesModuleState {
  return state.modules[RESPONSES_MODULE_ID] as ResponsesModuleState
}

/**
 * Set up a state where reputation_drift pressure clears its >= 35
 * threshold AND two reputation axes are strongly off-neutral, so the
 * picker has real choices to rotate across. The calculator at
 * `pressures/calculators/reputationDrift.ts` adds 8 per axis ≥70
 * (capped at 3) + 14 for any axis ≥80 + 10 for a single customer group
 * dominating ≥40% patronage. Three axes ≥70 plus a dominant axis ≥80
 * yields 38 — clears the family's ≥35 gate.
 */
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

describe('Phase 55 §ISSUE-015 — Axis rotation', () => {
  it('rotates the picked axis across multiple days when two axes are off-neutral', () => {
    let state = reputationShiftState()
    const pickedAxes = new Set<string>()
    for (let i = 0; i < 14; i += 1) {
      const result = runDay(state)
      state = result.state
      const seeds = getIssueSeeds(state, { family: 'reputation_shift' })
      for (const seed of seeds) {
        // The picked axis surfaces in the seed.id as
        // `seed-reputation_shift-${axisId}-d{n}`.
        const match = seed.id.match(/seed-reputation_shift-([a-zA-Z_]+)-d/)
        if (match) pickedAxes.add(match[1]!)
      }
    }
    expect(pickedAxes.size).toBeGreaterThanOrEqual(2)
  })
})

describe('Phase 55 §ISSUE-015 — Per-slot mutations', () => {
  function setup(): { baseAfterDay1: TavernState; seedId: string; axisId: string } {
    const base = reputationShiftState()
    const day1 = runDay(base)
    const seed = getIssueSeeds(day1.state, { family: 'reputation_shift' })[0]
    expect(seed).toBeDefined()
    const match = seed!.id.match(/seed-reputation_shift-([a-zA-Z_]+)-d/)
    return {
      baseAfterDay1: day1.state,
      seedId: seed!.id,
      axisId: match![1]!,
    }
  }

  function compareSlot(
    slotId: string,
    verb: ResponseIntent['verb'],
    shape: ResponseIntent['shape'],
  ) {
    const { baseAfterDay1, seedId, axisId } = setup()
    const intent: ResponseIntent = {
      id: `r-${slotId}`,
      seedId,
      verb,
      shape,
      tags: [],
      intensity: 50,
      metadata: { responseSlotId: slotId },
    }
    const control = runDay(baseAfterDay1).state
    const treatment = runDay(baseAfterDay1, { responseIntents: [intent] }).state
    return { control, treatment, axisId }
  }

  it('embrace raises the picked axis vs control', () => {
    const { control, treatment, axisId } = compareSlot('embrace', 'rebrand', 'reputation_play')
    expect(
      (treatment.reputation as Record<string, number>)[axisId]!,
    ).toBeGreaterThan((control.reputation as Record<string, number>)[axisId]!)
  })

  it('correct lowers the picked axis and spends coin vs control', () => {
    const { control, treatment, axisId } = compareSlot('correct', 'clean', 'long_term_investment')
    expect(
      (treatment.reputation as Record<string, number>)[axisId]!,
    ).toBeLessThan((control.reputation as Record<string, number>)[axisId]!)
    expect(treatment.coin).toBeLessThan(control.coin)
  })

  it('advertise raises miners patronage vs control', () => {
    const { control, treatment } = compareSlot('advertise', 'invite', 'compromise')
    expect(treatment.customerGroups.miners!.patronage).toBeGreaterThan(
      control.customerGroups.miners!.patronage,
    )
  })

  it('diversify lowers the picked axis and raises merchants patronage vs control', () => {
    const { control, treatment, axisId } = compareSlot('diversify', 'rebrand', 'compromise')
    expect(
      (treatment.reputation as Record<string, number>)[axisId]!,
    ).toBeLessThan((control.reputation as Record<string, number>)[axisId]!)
    expect(treatment.customerGroups.merchants!.patronage).toBeGreaterThan(
      control.customerGroups.merchants!.patronage,
    )
  })
})

describe('Phase 55 §ISSUE-015 — Delayed scheduling', () => {
  it('every slot enqueues at least one pending entry', () => {
    const slots: Array<[string, ResponseIntent['verb'], ResponseIntent['shape']]> = [
      ['embrace', 'rebrand', 'reputation_play'],
      ['correct', 'clean', 'long_term_investment'],
      ['advertise', 'invite', 'compromise'],
      ['diversify', 'rebrand', 'compromise'],
    ]
    for (const [slotId, verb, shape] of slots) {
      const base = reputationShiftState()
      const day1 = runDay(base)
      const seed = getIssueSeeds(day1.state, { family: 'reputation_shift' })[0]
      expect(seed).toBeDefined()
      const intent: ResponseIntent = {
        id: `r-${slotId}`,
        seedId: seed!.id,
        verb,
        shape,
        tags: [],
        intensity: 50,
        metadata: { responseSlotId: slotId },
      }
      const day2 = runDay(day1.state, { responseIntents: [intent] })
      const slice = getResponsesSlice(day2.state)
      expect(
        slice.pending.length,
        `slot ${slotId} should enqueue at least one pending entry`,
      ).toBeGreaterThanOrEqual(1)
    }
  })
})
