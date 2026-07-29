// Phase 207 / ISSUE-170 — Expansion Phase 0: save/load at every day beat.
//
// `docs/plans/GOBLIN_TAVERN_SIMULATION_EXPANSION_WORK_PLAN.md` § "Phase 0 →
// Required tests" asks for a save/load at Morning, Plan, Service, Closing
// and Report, and § "Work protocol" makes it a standing requirement: every
// later phase must perform at least one save/reload at every day beat its
// new lifecycle crosses. This file is the baseline that pins the behavior
// those phases must preserve — a reload at any beat must not change the
// deterministic outcome of the rest of the day.
//
// The five beats sit on the three engine segments (`web/src/lib/sim/daySession.ts`):
//
//   morning / plan   → Segment A has run; the player is at Pause 1
//   service / closing→ Segment B has run; the player is at Pause 2
//   report           → Segment C has run; the day is closed

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
import { advanceDaySegment } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import type { TavernState } from '../../src/sim/state/TavernState'
import { createInitialTavernState } from '../../src/sim/state/defaults'

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

const SEED = 'phase207/day-beats'

/** The five beats, and which segment has finished when the player is on it. */
const BEATS: ReadonlyArray<{ beat: Beat; segment: DaySegment }> = [
  { beat: 'morning', segment: 'A' },
  { beat: 'plan', segment: 'A' },
  { beat: 'service', segment: 'B' },
  { beat: 'closing', segment: 'B' },
  { beat: 'report', segment: 'C' },
]

function input(day: number): SimInput {
  return { seed: `${SEED}-d${day}` }
}

function sessionAt(
  state: TavernState,
  beat: Beat,
  segment: DaySegment,
): PersistedSession {
  return {
    saveVersion: SAVE_VERSION,
    savedAt: '2026-07-29T00:00:00.000Z',
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

/** Save at the given beat, load it back, and return the restored state. */
function roundTrip(state: TavernState, beat: Beat, segment: DaySegment): TavernState {
  setStorageForTesting(new MemoryStorage())
  try {
    const saved = saveSession(sessionAt(state, beat, segment))
    expect(saved.ok).toBe(true)
    const outcome = loadSession()
    expect(outcome.kind).toBe('loaded')
    if (outcome.kind !== 'loaded') throw new Error('load failed')
    expect(outcome.save.daySession.beat).toBe(beat)
    expect(outcome.save.daySession.segment).toBe(segment)
    return outcome.save.state
  } finally {
    setStorageForTesting(undefined)
  }
}

/** Run a whole day segment by segment, optionally reloading after `after`. */
function runDayWithReload(
  start: TavernState,
  day: number,
  reloadAfter?: DaySegment,
  beat?: Beat,
): TavernState {
  const inp = input(day)
  let baseline = start
  let state = start

  const a = advanceDaySegment(state, inp, FULL_PIPELINE, 'A')
  state = a.state
  if (reloadAfter === 'A') {
    state = roundTrip(state, beat!, 'A')
    // The start-of-day baseline is reconstructed by the loader; mid-day it
    // IS the previous day's closing state, which is what `start` holds.
    baseline = start
  }

  const b = advanceDaySegment(state, inp, FULL_PIPELINE, 'B', { dayBaseline: baseline })
  state = b.state
  if (reloadAfter === 'B') {
    state = roundTrip(state, beat!, 'B')
    baseline = start
  }

  const c = advanceDaySegment(state, inp, FULL_PIPELINE, 'C', { dayBaseline: baseline })
  state = c.state
  if (reloadAfter === 'C') state = roundTrip(state, beat!, 'C')

  return state
}

/** JSON both sides so reference identity and undefined-vs-absent don't
 *  masquerade as a behavior change. */
function plain(state: TavernState): unknown {
  return JSON.parse(JSON.stringify(state))
}

describe('Phase 207 — save/load at every day beat', () => {
  // Warm the tavern up a little so the save carries real memories, causes,
  // rumours and issue seeds rather than a day-zero shell.
  function warmState(): TavernState {
    let state = createInitialTavernState()
    for (let day = 0; day < 3; day += 1) {
      state = runDayWithReload(state, day)
    }
    return state
  }

  it('round-trips the state unchanged at each of the five beats', () => {
    const start = warmState()
    const inp = input(99)
    const afterA = advanceDaySegment(start, inp, FULL_PIPELINE, 'A').state
    const afterB = advanceDaySegment(afterA, inp, FULL_PIPELINE, 'B', {
      dayBaseline: start,
    }).state
    const afterC = advanceDaySegment(afterB, inp, FULL_PIPELINE, 'C', {
      dayBaseline: start,
    }).state
    const stateFor: Record<DaySegment, TavernState> = { A: afterA, B: afterB, C: afterC }

    for (const { beat, segment } of BEATS) {
      const restored = roundTrip(stateFor[segment], beat, segment)
      expect(plain(restored)).toEqual(plain(stateFor[segment]))
    }
  })

  it('does not change the rest of the day when the player reloads mid-day', () => {
    const start = warmState()
    const noReload = runDayWithReload(start, 10)

    for (const { beat, segment } of BEATS) {
      const withReload = runDayWithReload(start, 10, segment, beat)
      expect(plain(withReload)).toEqual(plain(noReload))
    }
  })

  it('does not change the NEXT day either', () => {
    const start = warmState()
    const noReload = runDayWithReload(runDayWithReload(start, 20), 21)

    for (const { beat, segment } of BEATS) {
      const reloaded = runDayWithReload(start, 20, segment, beat)
      expect(plain(runDayWithReload(reloaded, 21))).toEqual(plain(noReload))
    }
  })
})
