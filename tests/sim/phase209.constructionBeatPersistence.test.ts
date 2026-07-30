// Expansion Phase 2 (repo phase 209) / ISSUE-172 — §5.9 and §5.10 for the
// construction lifecycle.
//
// The work protocol makes two standing demands of every phase:
//
//   §5.9  full-day versus segmented equivalence for affected routes
//   §5.10 at least one save/reload at every day beat the new lifecycle crosses
//
// Phase 2's lifecycle crosses four beats:
//
//   morning       the per-day slice reset (schedule / construction / propagation
//                 / capacity lists), and the `area_project_completion` event
//   afterService  the capacity snapshot and the eight propagation edges
//   endDay        the work schedule, the construction tick, the upkeep tick
//   wrap_up       `failed_patch_possible` and `area_collapse_risk_*`
//
// On the engine's three segments those land as: `morning` in A, `afterService`
// in B, and `endDay` + `wrap_up` in C. So a reload at each of the five player
// beats covers all four, and this file does it with a LIVE BUILD in the tavern
// rather than a day-zero shell — a reload with nothing under construction
// proves nothing about construction.
//
// The route runs through the real persistence layer (`saveSession` /
// `loadSession`), not a JSON copy, so the migration chain and the schema are
// exercised on the way through.

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
import { getAreasModuleState } from '../../src/sim/modules/areas/state'

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

const SEED = 'phase209/construction-beats'

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

function sessionAt(
  state: TavernState,
  beat: Beat,
  segment: DaySegment,
): PersistedSession {
  return {
    saveVersion: SAVE_VERSION,
    savedAt: '2026-07-30T00:00:00.000Z',
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

/** A tavern mid-build: coin, materials, and one site running in the privy. */
function tavernMidBuild(): TavernState {
  let state = withCoin(createInitialTavernState(), 400)
  state = withStock(state, 'timber', { quantity: 40 })
  state = withStock(state, 'cut_stone', { quantity: 40 })
  // Two days of ordinary play, then start a long build so every beat below has
  // a live construction record to carry.
  for (let day = 0; day < 2; day += 1) {
    state = simulateDay(state, input(day), FULL_PIPELINE).state
  }
  state = simulateDay(
    state,
    input(2, [
      { actionId: 'start_area_upgrade', targetId: 'privy:stone_drainage' },
    ]),
    FULL_PIPELINE,
  ).state
  const record = state.areas['privy']!.upgrades['stone_drainage']
  expect(record?.status).toBe('in_progress')
  return state
}

describe('Phase 209 §5.10 — reload at every beat the construction lifecycle crosses', () => {
  it('round-trips a mid-build tavern unchanged at each of the five beats', () => {
    const start = tavernMidBuild()
    const inp = input(3)
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
      expect(plain(restored), `beat ${beat} did not round-trip`).toEqual(
        plain(stateFor[segment]),
      )
      // Spot-check the fields this phase added, so a future codec change that
      // drops one of them fails here rather than silently losing a build.
      const record = restored.areas['privy']!.upgrades['stone_drainage']!
      const expected = stateFor[segment].areas['privy']!.upgrades['stone_drainage']!
      expect(record.status).toBe(expected.status)
      expect(record.progress).toBe(expected.progress)
      expect(record.requiredProgress).toBe(expected.requiredProgress)
      expect(record.materialsUsed).toEqual(expected.materialsUsed)
      expect(record.coinInvested).toBe(expected.coinInvested)
    }
  })

  it('a reload at any beat leaves the rest of the day identical', () => {
    const start = tavernMidBuild()

    const run = (reloadAfter?: DaySegment, beat?: Beat): TavernState => {
      const inp = input(3)
      let state = start
      state = advanceDaySegment(state, inp, FULL_PIPELINE, 'A').state
      if (reloadAfter === 'A') state = roundTrip(state, beat!, 'A')
      state = advanceDaySegment(state, inp, FULL_PIPELINE, 'B', {
        dayBaseline: start,
      }).state
      if (reloadAfter === 'B') state = roundTrip(state, beat!, 'B')
      state = advanceDaySegment(state, inp, FULL_PIPELINE, 'C', {
        dayBaseline: start,
      }).state
      if (reloadAfter === 'C') state = roundTrip(state, beat!, 'C')
      return state
    }

    const clean = run()
    for (const { beat, segment } of BEATS) {
      const reloaded = run(segment, beat)
      expect(
        JSON.parse(JSON.stringify(reloaded.areas)),
        `a reload at ${beat} changed the day's area outcome`,
      ).toEqual(JSON.parse(JSON.stringify(clean.areas)))
      expect(getAreasModuleState(reloaded)).toEqual(getAreasModuleState(clean))
      expect(reloaded.coin).toBe(clean.coin)
    }
  })
})

describe('Phase 209 §5.9 — full-day versus segmented equivalence, with a build running', () => {
  it('agrees across a week of construction, upkeep and propagation', () => {
    let batch = tavernMidBuild()
    let segmented = tavernMidBuild()
    expect(plain(segmented)).toEqual(plain(batch))

    for (let day = 3; day < 10; day += 1) {
      const inp = input(day)
      batch = simulateDay(batch, inp, FULL_PIPELINE).state

      const dayStart = segmented
      for (const segment of ['A', 'B', 'C'] as const) {
        segmented = advanceDaySegment(segmented, inp, FULL_PIPELINE, segment, {
          dayBaseline: dayStart,
        }).state
      }
    }

    // The build finished somewhere in that week; both routes must agree on
    // when, on the fitting's condition and upkeep clock, and on the day's
    // schedule / construction / propagation bookkeeping.
    expect(JSON.parse(JSON.stringify(segmented.areas))).toEqual(
      JSON.parse(JSON.stringify(batch.areas)),
    )
    expect(getAreasModuleState(segmented)).toEqual(getAreasModuleState(batch))
    expect(segmented.coin).toBe(batch.coin)
    expect(
      segmented.areas['privy']!.upgrades['stone_drainage']!.status,
    ).toBe('installed')
  })
})
