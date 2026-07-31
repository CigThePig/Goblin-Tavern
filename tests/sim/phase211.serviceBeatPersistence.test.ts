// Expansion Phase 4 (repo phase 211) / ISSUE-174 — §5.9 and §5.10 for the
// service flow, patron tabs and the regular visit lifecycle.
//
// The work protocol makes two standing demands of every phase:
//
//   §5.9  full-day versus segmented equivalence for affected routes
//   §5.10 at least one save/reload at every day beat the new lifecycle crosses
//
// Phase 4's lifecycle crosses four beats:
//
//   regularCustomerUpdate  who intends to come in tonight, and what they want
//                          (segment A, before the player plans)
//   service                the whole wave loop — arrivals, seating, ordering,
//                          prep, delivery, payment, the slates it opens
//                          (segment B)
//   afterService           the groups' satisfaction, the regulars' outcomes and
//                          memories, and the scene builder reading it all back
//                          (segment B)
//   wrap_up / endDay       the service scheduled events — a brawl warned about,
//                          an apology never given, a grudge acted on
//                          (segment C)
//
// A reload at each of the five player beats covers all four, and this file does
// it against a LIVE SERVICE SITUATION rather than a day-zero shell: a tavern
// mid-week with slates outstanding, regulars who have learned a usual seat and
// dish, and at least one regular carrying service memory. A reload with an
// empty room proves nothing about the flow.

import { describe, expect, it } from 'vitest'

import {
  SAVE_VERSION,
  loadSession,
  saveSession,
  setStorageForTesting,
  type PersistedSession,
  type StorageLike,
} from '../../web/src/lib/sim/persistence'
import type { Beat, DaySegment } from '../../web/src/lib/sim/daySession'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { advanceDaySegment, simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import type { TavernState } from '../../src/sim/state/TavernState'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import { getServiceModuleState } from '../../src/sim/modules/service/index'
import { listPatronTabs } from '../../src/sim/modules/service/tabs'
import { getRegularModuleState } from '../../src/sim/modules/regulars/index'
import {
  ensureRegularServiceFields,
  ensureModuleSlices,
} from '../../src/sim/state/migrations'
import { safeValidateState } from '../../src/sim/state/validation'

class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>()
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v)
  }
  removeItem(k: string): void {
    this.map.delete(k)
  }
}

const SEED = 'phase211/service-beats'

const BEATS: ReadonlyArray<{ beat: Beat; segment: DaySegment }> = [
  { beat: 'morning', segment: 'A' },
  { beat: 'plan', segment: 'A' },
  { beat: 'service', segment: 'B' },
  { beat: 'closing', segment: 'B' },
  { beat: 'report', segment: 'C' },
]

function input(day: number, actions?: SimInput['ownerActions']): SimInput {
  return {
    seed: `${SEED}-d${day}`,
    ...(actions && actions.length > 0 ? { ownerActions: [...actions] } : {}),
  }
}

function stocked(state: TavernState): TavernState {
  return withStock(
    withStock(withStock(state, 'ale', { quantity: 2000 }), 'stew', {
      quantity: 2000,
    }),
    'mushrooms',
    { quantity: 2000 },
  )
}

function sessionAt(
  state: TavernState,
  beat: Beat,
  segment: DaySegment,
): PersistedSession {
  return {
    saveVersion: SAVE_VERSION,
    savedAt: '2026-07-31T00:00:00.000Z',
    simSeed: SEED,
    state,
    picks: [],
    staffPriorities: {},
    pendingBySeedId: {},
    daySession: {
      beat,
      segment,
      serviceComplete: segment !== 'A',
      closingComplete: segment === 'C',
    },
    route: 'day',
  }
}

function roundTrip(state: TavernState, beat: Beat, segment: DaySegment): TavernState {
  setStorageForTesting(new MemoryStorage())
  try {
    const saved = saveSession(sessionAt(state, beat, segment))
    expect(saved.ok, saved.ok ? '' : saved.reason).toBe(true)
    const outcome = loadSession()
    expect(outcome.kind).toBe('loaded')
    if (outcome.kind !== 'loaded') throw new Error('load failed')
    return outcome.save.state
  } finally {
    setStorageForTesting(undefined)
  }
}

function plain(state: TavernState): unknown {
  return JSON.parse(JSON.stringify(state))
}

/**
 * A tavern mid-week with a live service situation.
 *
 * Built entirely by trading: a week of real days leaves slates on the board,
 * regulars who have learned a usual seat and dish, and service memory on at
 * least one of them.
 */
function tavernMidService(): TavernState {
  let state = withCoin(stocked(createInitialTavernState()), 800)
  for (let day = 0; day < 8; day += 1) {
    state = withCoin(stocked(simulateDay(state, input(day), FULL_PIPELINE).state), 800)
  }

  expect(listPatronTabs(state).length).toBeGreaterThan(0)
  expect(getServiceModuleState(state).patronTabs.length).toBeGreaterThan(0)
  const learned = Object.values(state.world.regulars).filter(
    (regular) => regular.favoriteAreaId !== undefined,
  )
  expect(learned.length).toBeGreaterThan(0)
  expect(
    Object.values(state.world.regulars).some(
      (regular) => (regular.serviceMemory ?? []).length > 0,
    ),
  ).toBe(true)
  return state
}

describe('Phase 211 §5.10 — reload at every beat the service lifecycle crosses', () => {
  it('round-trips a live service situation unchanged at each of the five beats', () => {
    const start = tavernMidService()
    const inp = input(9)
    const afterA = advanceDaySegment(start, inp, FULL_PIPELINE, 'A').state
    const afterB = advanceDaySegment(afterA, inp, FULL_PIPELINE, 'B', {
      dayBaseline: start,
    }).state
    const afterC = advanceDaySegment(afterB, inp, FULL_PIPELINE, 'C', {
      dayBaseline: start,
    }).state
    const stateFor: Record<DaySegment, TavernState> = {
      A: afterA,
      B: afterB,
      C: afterC,
    }

    for (const { beat, segment } of BEATS) {
      const restored = roundTrip(stateFor[segment], beat, segment)
      expect(plain(restored), `beat ${beat}`).toEqual(plain(stateFor[segment]))
    }
  })

  it('the migration neither invents nor loses a slate or a memory', () => {
    const state = tavernMidService()
    // The chain is a no-op on state the current code produced: everything the
    // migration fills in is already there.
    const migrated = ensureModuleSlices(ensureRegularServiceFields(state))
    expect(plain(migrated)).toEqual(plain(state))
    expect(safeValidateState(migrated, { modules: FULL_PIPELINE }).success).toBe(true)
  })

  it('a pre-Phase-4 regular loads with defaults rather than a hole', () => {
    const state = tavernMidService()
    const [id, regular] = Object.entries(state.world.regulars)[0]!
    // Strip the fields this phase added, the way an older save would have them.
    const legacy = {
      ...state,
      world: {
        ...state.world,
        regulars: {
          ...state.world.regulars,
          [id]: {
            ...regular,
            ownerStanding: undefined,
            serviceMemory: undefined,
            consecutiveBadVisits: undefined,
            wordOfMouth: undefined,
          },
        },
      },
    } as TavernState

    const repaired = ensureRegularServiceFields(legacy)
    const fixed = repaired.world.regulars[id]!
    expect(fixed.ownerStanding).toBeGreaterThan(0)
    expect(fixed.serviceMemory).toEqual([])
    expect(fixed.consecutiveBadVisits).toBe(0)
    expect(fixed.wordOfMouth).toEqual({ recommendations: 0, criticisms: 0 })
    // And nothing else moved.
    expect(Object.keys(repaired.world.regulars).length).toBe(
      Object.keys(state.world.regulars).length,
    )
  })
})

describe('Phase 211 §5.9 — the segmented route runs the same evening', () => {
  it('a fortnight of trading is identical run whole or run in three segments', () => {
    let batch = tavernMidService()
    let segmented = tavernMidService()

    for (let day = 9; day < 23; day += 1) {
      const inp = input(day)
      const before = segmented
      batch = withCoin(stocked(simulateDay(batch, inp, FULL_PIPELINE).state), 800)

      const a = advanceDaySegment(segmented, inp, FULL_PIPELINE, 'A').state
      const b = advanceDaySegment(a, inp, FULL_PIPELINE, 'B', {
        dayBaseline: before,
      }).state
      segmented = withCoin(
        stocked(
          advanceDaySegment(b, inp, FULL_PIPELINE, 'C', { dayBaseline: before })
            .state,
        ),
        800,
      )
    }

    expect(plain(segmented)).toEqual(plain(batch))
    // And the fortnight actually exercised the flow rather than idling.
    const flow = getServiceModuleState(batch).result.flow
    expect(flow.ran).toBe(true)
    expect(flow.parties.length).toBeGreaterThan(0)
  })

  it('the same day resolves the same substeps whichever way it is run', () => {
    const start = tavernMidService()
    const inp = input(9)

    const batch = simulateDay(start, inp, FULL_PIPELINE).state
    const a = advanceDaySegment(start, inp, FULL_PIPELINE, 'A').state
    const b = advanceDaySegment(a, inp, FULL_PIPELINE, 'B', {
      dayBaseline: start,
    }).state
    const segmented = advanceDaySegment(b, inp, FULL_PIPELINE, 'C', {
      dayBaseline: start,
    }).state

    const batchFlow = getServiceModuleState(batch).result.flow
    const segmentedFlow = getServiceModuleState(segmented).result.flow

    // Not just the totals: the same parties, in the same order, with the same
    // outcomes and the same waves.
    expect(segmentedFlow.parties).toEqual(batchFlow.parties)
    expect(segmentedFlow.waves).toEqual(batchFlow.waves)
    expect(segmentedFlow.bottleneck).toEqual(batchFlow.bottleneck)
    // And the regulars' outcomes were read back identically.
    expect(getRegularModuleState(segmented).outcomes).toEqual(
      getRegularModuleState(batch).outcomes,
    )
  })
})
