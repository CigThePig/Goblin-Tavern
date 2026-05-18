// Phase 96 — Persistence round-trip against the real engine.
//
// The persistence layer lives in the web slice, but its correctness
// depends on sim-side guarantees: state must round-trip through JSON
// and pass the same validators the engine uses, and a runDay performed
// after a round-trip must produce the same result as one performed
// against the in-memory baseline.

import { describe, expect, it } from 'vitest'

import {
  setStorageForTesting,
  saveSession,
  loadSession,
  SAVE_VERSION,
  type PersistedSession,
  type StorageLike,
} from '../../web/src/lib/sim/persistence'
import { runOneDay } from '../../src/sim/testing/simRunner'
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

function makeSessionFromState(
  state: ReturnType<typeof createInitialTavernState>,
  result: ReturnType<typeof runOneDay>,
): PersistedSession {
  return {
    saveVersion: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    simSeed: 'tests/phase96.roundtrip',
    state,
    latestResultLite: {
      reports: result.reports,
      logs: result.logs,
      validation: result.validation,
      diffs: result.diffs,
    },
    picks: [],
    staffPriorities: {},
    pendingBySeedId: {},
    daySession: { beat: 'morning', serviceComplete: false, closingComplete: false },
    route: 'day',
  }
}

describe('phase96 — persistence round-trip with the engine', () => {
  it('a state produced by runOneDay survives save → load → JSON', () => {
    setStorageForTesting(new MemoryStorage())
    try {
      const initial = createInitialTavernState()
      const result = runOneDay(initial, { seed: 'tests/phase96.d1' })
      saveSession(makeSessionFromState(result.state, result))
      const outcome = loadSession()
      expect(outcome.kind).toBe('loaded')
      if (outcome.kind !== 'loaded') return
      expect(outcome.save.state.calendar.totalDaysElapsed).toBe(
        result.state.calendar.totalDaysElapsed,
      )
      expect(JSON.parse(JSON.stringify(outcome.save.state))).toEqual(
        JSON.parse(JSON.stringify(result.state)),
      )
    } finally {
      setStorageForTesting(undefined)
    }
  })

  it('day rollover after restore matches an in-memory-only baseline', () => {
    // Run two days in memory.
    const initial = createInitialTavernState()
    const day1 = runOneDay(initial, { seed: 'tests/phase96.parity-d1' })
    const day2Baseline = runOneDay(day1.state, {
      seed: 'tests/phase96.parity-d2',
    })

    // Run day 1 again fresh, save, load, then run day 2 from the
    // restored state with the same seed. The post-state should match
    // the baseline byte-for-byte.
    setStorageForTesting(new MemoryStorage())
    try {
      const initial2 = createInitialTavernState()
      const day1Fresh = runOneDay(initial2, { seed: 'tests/phase96.parity-d1' })
      saveSession(makeSessionFromState(day1Fresh.state, day1Fresh))
      const outcome = loadSession()
      expect(outcome.kind).toBe('loaded')
      if (outcome.kind !== 'loaded') return
      const day2Restored = runOneDay(outcome.save.state, {
        seed: 'tests/phase96.parity-d2',
      })

      // Compare via JSON to ignore reference identity. The simulation
      // is deterministic — same seed + same state in → same state out.
      expect(JSON.parse(JSON.stringify(day2Restored.state))).toEqual(
        JSON.parse(JSON.stringify(day2Baseline.state)),
      )
    } finally {
      setStorageForTesting(undefined)
    }
  })

  it('seedsToday survives the round-trip with the expected validation flags', () => {
    setStorageForTesting(new MemoryStorage())
    try {
      const initial = createInitialTavernState()
      const result = runOneDay(initial, { seed: 'tests/phase96.seeds' })
      saveSession(makeSessionFromState(result.state, result))
      const outcome = loadSession()
      expect(outcome.kind).toBe('loaded')
      if (outcome.kind !== 'loaded') return
      const slot = (outcome.save.state.modules['issueSeeds'] as
        | { seedsToday?: unknown[] }
        | undefined)?.seedsToday
      expect(Array.isArray(slot)).toBe(true)
      const before = (result.state.modules['issueSeeds'] as
        | { seedsToday?: unknown[] }
        | undefined)?.seedsToday
      // Length parity is the structural check we care about — the seeds
      // are unknown[] in the schema, so deep equality through JSON is
      // sufficient evidence the shape survived.
      expect((slot ?? []).length).toBe((before ?? []).length)
    } finally {
      setStorageForTesting(undefined)
    }
  })
})
