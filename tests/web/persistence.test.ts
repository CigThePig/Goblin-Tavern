// Phase 96 — Persistence round-trip tests.
//
// Drives the real `persistence.ts` module from the web layer through
// an in-memory storage adapter (so we don't need jsdom). Tests verify:
//   - empty-slot → 'fresh' outcome
//   - serialize → write → read → 'loaded' outcome with byte-identical
//     state under deep-equal
//   - version-mismatch → 'incompatible'
//   - malformed JSON / schema-invalid payloads → 'invalid'
//   - `clearSession` clears the slot
//   - `relativeTime` returns sensible phrasing across the threshold
//     bands

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  SAVE_STORAGE_KEY,
  SAVE_VERSION,
  clearSession,
  loadSession,
  relativeTime,
  saveSession,
  setStorageForTesting,
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
  has(k: string): boolean {
    return this.map.has(k)
  }
}

function makeBasicSession(): PersistedSession {
  const state = createInitialTavernState()
  return {
    saveVersion: SAVE_VERSION,
    savedAt: '2026-05-18T12:00:00.000Z',
    simSeed: 'tests/persistence.basic',
    state,
    picks: [],
    staffPriorities: {},
    pendingBySeedId: {},
    daySession: { beat: 'morning', serviceComplete: false, closingComplete: false },
    route: 'day',
  }
}

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
  setStorageForTesting(storage)
})

afterEach(() => {
  setStorageForTesting(undefined)
})

describe('persistence — empty slot', () => {
  it('loadSession returns fresh when storage is empty', () => {
    const outcome = loadSession()
    expect(outcome.kind).toBe('fresh')
  })
})

describe('persistence — round-trip', () => {
  it('save → load yields a structurally-equal state', () => {
    const session = makeBasicSession()
    saveSession(session)
    const out = loadSession()
    expect(out.kind).toBe('loaded')
    if (out.kind !== 'loaded') return
    expect(out.save.saveVersion).toBe(SAVE_VERSION)
    expect(out.save.simSeed).toBe('tests/persistence.basic')
    expect(out.save.route).toBe('day')
    // Deep structural equality through JSON round-trip — proof the
    // state survived stringification and re-validation.
    expect(JSON.parse(JSON.stringify(out.save.state))).toEqual(
      JSON.parse(JSON.stringify(session.state)),
    )
  })

  it('round-trips a state produced by a real simulated day', () => {
    const initial = createInitialTavernState()
    const result = runOneDay(initial, { seed: 'tests/persistence.day' })
    const session: PersistedSession = {
      saveVersion: SAVE_VERSION,
      savedAt: '2026-05-18T14:00:00.000Z',
      simSeed: 'tests/persistence.day',
      state: result.state,
      latestResultLite: {
        reports: result.reports,
        logs: result.logs,
        validation: result.validation,
        diffs: result.diffs,
      },
      picks: [],
      staffPriorities: {},
      pendingBySeedId: {},
      daySession: { beat: 'report', serviceComplete: false, closingComplete: false },
      route: 'day',
    }
    saveSession(session)
    const out = loadSession()
    expect(out.kind).toBe('loaded')
    if (out.kind !== 'loaded') return
    expect(out.save.daySession.beat).toBe('report')
    expect(out.save.latestResultLite).toBeDefined()
    expect(JSON.parse(JSON.stringify(out.save.state))).toEqual(
      JSON.parse(JSON.stringify(result.state)),
    )
    // `seedsToday` survives the trip.
    const slot = (out.save.state.modules['issueSeeds'] as
      | { seedsToday?: unknown[] }
      | undefined)?.seedsToday
    expect(Array.isArray(slot)).toBe(true)
  })

  it('preserves picks, pendingBySeedId, and the staff priority map', () => {
    const base = makeBasicSession()
    const session: PersistedSession = {
      ...base,
      picks: [
        {
          pickId: 'pick-test-1',
          actionId: 'clean_area',
          label: 'Clean an area',
          category: 'immediate',
          targetType: 'area',
          targetId: 'main_room',
          targetLabel: 'Main Room',
          actionPointCost: 1,
        },
      ],
      staffPriorities: { 'staff-cook': 'work_kitchen' },
      pendingBySeedId: {
        'seed-1': { kind: 'ignore' },
        'seed-2': {
          kind: 'choice',
          slotId: 'slot-1',
          verb: 'repair',
          choice: {
            slotId: 'slot-1',
            label: 'Repair it',
            verb: 'repair',
            shape: 'safe_costly',
            previewEffects: ['coin -5', 'maintenance -10'],
          },
        },
      },
    }
    saveSession(session)
    const out = loadSession()
    expect(out.kind).toBe('loaded')
    if (out.kind !== 'loaded') return
    expect(out.save.picks).toHaveLength(1)
    expect(out.save.picks[0]?.actionId).toBe('clean_area')
    expect(out.save.staffPriorities['staff-cook']).toBe('work_kitchen')
    expect(out.save.pendingBySeedId['seed-1']).toEqual({ kind: 'ignore' })
    const choice = out.save.pendingBySeedId['seed-2']
    expect(choice?.kind).toBe('choice')
    if (choice?.kind === 'choice') {
      expect(choice.verb).toBe('repair')
      expect(choice.choice.previewEffects).toEqual(['coin -5', 'maintenance -10'])
    }
  })
})

describe('persistence — failure modes', () => {
  it('returns incompatible when saveVersion differs', () => {
    const session = makeBasicSession()
    saveSession(session)
    const raw = storage.getItem(SAVE_STORAGE_KEY)!
    const blob = JSON.parse(raw)
    blob.saveVersion = SAVE_VERSION + 99
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(blob))
    const out = loadSession()
    expect(out.kind).toBe('incompatible')
    if (out.kind === 'incompatible') {
      expect(out.saveVersion).toBe(SAVE_VERSION + 99)
    }
  })

  it('returns invalid for malformed JSON', () => {
    storage.setItem(SAVE_STORAGE_KEY, '{not json')
    const out = loadSession()
    expect(out.kind).toBe('invalid')
  })

  it('returns invalid when the payload has no saveVersion', () => {
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ state: {} }))
    const out = loadSession()
    expect(out.kind).toBe('invalid')
  })

  it('returns invalid when the state fails schema validation', () => {
    const session = makeBasicSession()
    saveSession(session)
    const raw = storage.getItem(SAVE_STORAGE_KEY)!
    const blob = JSON.parse(raw)
    // Wreck a load-bearing field — coin is a number, not a string.
    blob.state.coin = 'not-a-number'
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(blob))
    const out = loadSession()
    expect(out.kind).toBe('invalid')
  })

  it('returns invalid when state is missing entirely', () => {
    storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify({ saveVersion: SAVE_VERSION }),
    )
    const out = loadSession()
    expect(out.kind).toBe('invalid')
  })
})

describe('persistence — dismissed missed opportunities (Phase 97)', () => {
  it('round-trips a non-empty dismissed-ids array', () => {
    const base = makeBasicSession()
    const ids = [
      'missed_opp:3:pressure_remedy:clean_area:kitchen',
      'missed_opp:3:ignored_seed:buy:seed-shortage',
    ]
    const session: PersistedSession = {
      ...base,
      dismissedMissedOpportunityIds: ids,
    }
    saveSession(session)
    const out = loadSession()
    expect(out.kind).toBe('loaded')
    if (out.kind !== 'loaded') return
    expect(out.save.dismissedMissedOpportunityIds).toEqual(ids)
  })

  it('an old save with no field hydrates with an empty array', () => {
    const session = makeBasicSession()
    saveSession(session)
    const raw = storage.getItem(SAVE_STORAGE_KEY)!
    const blob = JSON.parse(raw)
    // Explicitly remove the field to simulate a pre-Phase-97 save.
    delete blob.dismissedMissedOpportunityIds
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(blob))
    const out = loadSession()
    expect(out.kind).toBe('loaded')
    if (out.kind !== 'loaded') return
    expect(out.save.dismissedMissedOpportunityIds).toEqual([])
  })

  it('ignores non-string entries in the persisted array', () => {
    const session = makeBasicSession()
    saveSession(session)
    const raw = storage.getItem(SAVE_STORAGE_KEY)!
    const blob = JSON.parse(raw)
    blob.dismissedMissedOpportunityIds = ['valid-id', 123, null, 'another-id']
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(blob))
    const out = loadSession()
    expect(out.kind).toBe('loaded')
    if (out.kind !== 'loaded') return
    expect(out.save.dismissedMissedOpportunityIds).toEqual([
      'valid-id',
      'another-id',
    ])
  })
})

describe('persistence — route (Phase 98)', () => {
  it("round-trips a save with route: 'more'", () => {
    const base = makeBasicSession()
    const session: PersistedSession = { ...base, route: 'more' }
    saveSession(session)
    const out = loadSession()
    expect(out.kind).toBe('loaded')
    if (out.kind !== 'loaded') return
    expect(out.save.route).toBe('more')
  })

  it("a pre-Phase-98 save with route: 'day' still loads cleanly", () => {
    const session = makeBasicSession()
    saveSession(session)
    const out = loadSession()
    expect(out.kind).toBe('loaded')
    if (out.kind !== 'loaded') return
    expect(out.save.route).toBe('day')
  })

  it('falls back to day when route is unknown (defensive sanitization)', () => {
    const session = makeBasicSession()
    saveSession(session)
    const raw = storage.getItem(SAVE_STORAGE_KEY)!
    const blob = JSON.parse(raw)
    blob.route = 'unicorn'
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(blob))
    const out = loadSession()
    expect(out.kind).toBe('loaded')
    if (out.kind !== 'loaded') return
    expect(out.save.route).toBe('day')
  })
})

describe('persistence — clearSession', () => {
  it('clears the stored save and returns fresh on the next load', () => {
    const session = makeBasicSession()
    saveSession(session)
    expect(storage.has(SAVE_STORAGE_KEY)).toBe(true)
    clearSession()
    expect(storage.has(SAVE_STORAGE_KEY)).toBe(false)
    expect(loadSession().kind).toBe('fresh')
  })
})

describe('persistence — relativeTime', () => {
  const savedAt = '2026-05-18T12:00:00.000Z'

  it('returns undefined when gap < 4h', () => {
    const now = new Date('2026-05-18T15:30:00.000Z')
    expect(relativeTime(savedAt, now)).toBeUndefined()
  })

  it('returns hours bucket at exactly 4h', () => {
    const now = new Date('2026-05-18T16:00:00.000Z')
    const r = relativeTime(savedAt, now)
    expect(r).toBeDefined()
    expect(r!.hours).toBe(4)
    expect(r!.phrase).toBe('~4h')
  })

  it('returns hours bucket at 23h', () => {
    const now = new Date('2026-05-19T11:00:00.000Z')
    const r = relativeTime(savedAt, now)
    expect(r!.hours).toBe(23)
    expect(r!.phrase).toBe('~23h')
  })

  it('switches to day bucket at 24h', () => {
    const now = new Date('2026-05-19T12:00:00.000Z')
    const r = relativeTime(savedAt, now)
    expect(r!.days).toBe(1)
    expect(r!.phrase).toBe('1d')
  })

  it('reports days for multi-day gaps', () => {
    const now = new Date('2026-05-20T12:00:00.000Z')
    const r = relativeTime(savedAt, now)
    expect(r!.days).toBe(2)
    expect(r!.phrase).toBe('2d')
  })

  it('flattens to "2+ weeks" beyond 14 days', () => {
    const now = new Date('2026-06-15T12:00:00.000Z')
    const r = relativeTime(savedAt, now)
    expect(r!.phrase).toBe('2+ weeks')
  })

  it('handles negative gaps gracefully', () => {
    const now = new Date('2026-05-18T08:00:00.000Z')
    expect(relativeTime(savedAt, now)).toBeUndefined()
  })

  it('handles malformed timestamps gracefully', () => {
    expect(relativeTime('not-a-date', new Date())).toBeUndefined()
  })
})
