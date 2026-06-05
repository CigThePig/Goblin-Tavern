import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type {
  RegularWorldState,
  TavernState,
} from '../../src/sim/state/TavernState'
import type { ResponseIntent } from '../../src/sim/modules/issues/issueSeedTypes'
import { getIssueSeeds } from '../../src/sim/modules/issues/issueSeedQueries'
import type { ResponsesModuleState } from '../../src/sim/modules/responses/types'
import { RESPONSES_MODULE_ID } from '../../src/sim/modules/responses/types'

// Phase 54 / ISSUE-014 — `regular_customer` family end-to-end.
//
// Asserts:
//   1. The relaxed gate lets a high-irritation regular without
//      memories surface a seed (previously blocked).
//   2. Rotation: with multiple regulars trending negative, the family
//      picker rotates across distinct primary actors.
//   3. Per-slot mutations differ between treatment and control.

const SEED = 'phase-54-regular-customer'

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

function makeRegular(
  id: string,
  overrides: Partial<RegularWorldState> = {},
): RegularWorldState {
  return {
    id,
    name: {
      display: `Regular ${id}`,
      profileId: 'goblin_common',
      parts: { given: id, family: 'Test' },
      patternId: 'given_family',
      generatedBy: 'phase54_test',
    },
    customerGroupId: 'miners',
    loyalty: 30,
    irritation: 70,
    visits: 5,
    knownIncidentIds: [],
    firstSeenDay: 1,
    lastSeenDay: 1,
    tags: ['regular'],
    activeFlags: [],
    ...overrides,
  }
}

function injectRegulars(
  state: TavernState,
  regulars: RegularWorldState[],
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      regulars: Object.fromEntries(regulars.map((r) => [r.id, r])),
    },
  }
}

describe('Phase 54 §ISSUE-014 — Relaxed gate', () => {
  it('surfaces a seed for a high-irritation regular even with zero memories', () => {
    const base = injectRegulars(
      plentyOfStock(createInitialTavernState()),
      [makeRegular('test_regular_1', { irritation: 70, loyalty: 30 })],
    )
    // Phase 186 / Cluster 1 — during-service seed reads the prior day's
    // closing pressure snapshot; warm one day to populate it.
    const warm = runDay(base)
    const day1 = runDay(warm.state)
    const seeds = getIssueSeeds(day1.state, { family: 'regular_customer' })
    expect(seeds.length).toBeGreaterThan(0)
    expect(seeds[0]!.primaryActor?.id).toBe('test_regular_1')
  })

  it('still gates out regulars who are healthy and have no memories', () => {
    const base = injectRegulars(
      plentyOfStock(createInitialTavernState()),
      [makeRegular('happy_regular', { irritation: 10, loyalty: 80 })],
    )
    const day1 = runDay(base)
    const seeds = getIssueSeeds(day1.state, { family: 'regular_customer' })
    expect(seeds.length).toBe(0)
  })
})

describe('Phase 54 §ISSUE-014 — Rotation', () => {
  it('rotates the primary actor across multiple trending-negative regulars', () => {
    const regulars = [
      makeRegular('regular_alpha', { irritation: 75, loyalty: 30 }),
      makeRegular('regular_beta', { irritation: 70, loyalty: 25 }),
      makeRegular('regular_gamma', { irritation: 65, loyalty: 35 }),
    ]
    let state = injectRegulars(
      plentyOfStock(createInitialTavernState()),
      regulars,
    )
    const pickedActors = new Set<string>()
    for (let i = 0; i < 14; i += 1) {
      const result = runDay(state)
      state = result.state
      const seeds = getIssueSeeds(state, { family: 'regular_customer' })
      const seed = seeds[0]
      if (seed?.primaryActor) {
        pickedActors.add(seed.primaryActor.id)
      }
    }
    expect(pickedActors.size).toBeGreaterThanOrEqual(2)
    const issueSeedsSlice = state.modules.issueSeeds as
      | { recentPicks?: Record<string, Record<string, number>> }
      | undefined
    expect(
      Object.keys(issueSeedsSlice?.recentPicks?.regular_customer ?? {}).length,
    ).toBeGreaterThanOrEqual(2)
  })
})

describe('Phase 54 §ISSUE-014 — Per-slot distinct mutations', () => {
  function setup(): { warmState: TavernState; seedId: string; regularId: string } {
    const regularId = 'test_regular_distinct'
    const base = injectRegulars(plentyOfStock(createInitialTavernState()), [
      makeRegular(regularId, { irritation: 75, loyalty: 25 }),
    ])
    // Phase 186 / Cluster 1 — warm one day so the during-service seed
    // regenerates the same day the response is issued (see setup notes).
    const warm = runDay(base)
    const probe = runDay(warm.state)
    const seed = getIssueSeeds(probe.state, { family: 'regular_customer' })[0]
    expect(seed).toBeDefined()
    return { warmState: warm.state, seedId: seed!.id, regularId }
  }

  function compareSlot(
    slotId: string,
    verb: ResponseIntent['verb'],
    shape: ResponseIntent['shape'],
  ) {
    const { warmState, seedId } = setup()
    const intent: ResponseIntent = {
      id: `r-${slotId}`,
      seedId,
      verb,
      shape,
      tags: [],
      intensity: 50,
      metadata: { responseSlotId: slotId },
    }
    const control = runDay(warmState).state
    const treatment = runDay(warmState, { responseIntents: [intent] }).state
    return { control, treatment, regularId: 'test_regular_distinct' }
  }

  function regularCauseDelta(state: TavernState, regularId: string): number {
    // Sum amounts of recent causes targeting this regular.
    return state.causes
      .filter((c) => c.target === `regular:${regularId}`)
      .reduce((acc, c) => acc + c.amount, 0)
  }

  it('apologize_to_regular raises the regular cause sum vs control', () => {
    const { control, treatment, regularId } = compareSlot(
      'apologize_to_regular',
      'appease',
      'safe_costly',
    )
    expect(regularCauseDelta(treatment, regularId)).toBeGreaterThan(
      regularCauseDelta(control, regularId),
    )
  })

  it('comp_regular_meal raises the regular cause sum and spends coin vs control', () => {
    const { control, treatment, regularId } = compareSlot(
      'comp_regular_meal',
      'discount',
      'safe_costly',
    )
    expect(regularCauseDelta(treatment, regularId)).toBeGreaterThan(
      regularCauseDelta(control, regularId),
    )
    expect(treatment.coin).toBeLessThan(control.coin)
  })

  it('refuse_request lowers the regular cause sum and enqueues a pending entry', () => {
    const { control, treatment, regularId } = compareSlot(
      'refuse_request',
      'blame',
      'relationship_sacrifice',
    )
    expect(regularCauseDelta(treatment, regularId)).toBeLessThan(
      regularCauseDelta(control, regularId),
    )
    const slice = getResponsesSlice(treatment)
    expect(slice.pending.length).toBeGreaterThanOrEqual(1)
  })

  it('ban_regular strongly lowers the regular cause sum vs control', () => {
    const { control, treatment, regularId } = compareSlot('ban_regular', 'ban', 'escalation')
    const ctrlSum = regularCauseDelta(control, regularId)
    const treatSum = regularCauseDelta(treatment, regularId)
    expect(ctrlSum - treatSum).toBeGreaterThanOrEqual(20)
  })

  it('ignore_regular enqueues a pending pressure entry', () => {
    const { treatment } = compareSlot('ignore_regular', 'ignore', 'ignore')
    const slice = getResponsesSlice(treatment)
    expect(slice.pending.length).toBeGreaterThanOrEqual(1)
    const today = treatment.calendar.totalDaysElapsed
    expect(slice.pending.every((p) => p.scheduledFor > today)).toBe(true)
  })

  it('ask_regular_to_spread_word raises the regular customer group loyalty vs control', () => {
    const { control, treatment } = compareSlot(
      'ask_regular_to_spread_word',
      'invite',
      'long_term_investment',
    )
    expect(treatment.customerGroups.miners!.loyalty).toBeGreaterThan(
      control.customerGroups.miners!.loyalty,
    )
  })
})
