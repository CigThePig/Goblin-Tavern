// Phase 98 — Named-snapshot CRUD + budget tests.
//
// The snapshot module shares the localStorage adapter pattern with
// `persistence.ts` but owns its own keys (`goblin-tavern:saves:v1` for
// the index plus per-snapshot blobs). Tests drive a fresh in-memory
// store per case.
//
// The budget guard fires BEFORE the write attempt — we don't catch a
// QuotaExceededError mid-write, we refuse upfront. This test verifies
// that the projected-byte-count comparison works against a primed
// store.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  MAX_NAMED_SNAPSHOTS,
  SNAPSHOT_BUDGET_BYTES,
  SNAPSHOT_INDEX_KEY,
  SNAPSHOT_PAYLOAD_PREFIX,
  createSnapshot,
  deleteSnapshot,
  estimateStorageBytes,
  listSnapshots,
  loadSnapshot,
  renameSnapshot,
  setStorageForTesting,
  wouldExceedBudget,
} from '../../web/src/lib/sim/snapshots'
import {
  SAVE_VERSION,
  type PersistedSession,
  type StorageLike,
} from '../../web/src/lib/sim/persistence'
import { createInitialTavernState } from '../../src/sim/state/defaults'

class MemoryStorage implements StorageLike {
  readonly map = new Map<string, string>()
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v)
  }
  removeItem(k: string): void {
    this.map.delete(k)
  }
  // Real Storage exposes `.length` and `.key(i)` so the budget walker
  // can iterate without a special path. Mirror that here.
  get length(): number {
    return this.map.size
  }
  key(i: number): string | null {
    const keys = Array.from(this.map.keys())
    return keys[i] ?? null
  }
}

function makeSession(day = 1): PersistedSession {
  const state = createInitialTavernState()
  state.calendar.totalDaysElapsed = day
  return {
    saveVersion: SAVE_VERSION,
    savedAt: new Date(2026, 4, 18, 12, 0, 0).toISOString(),
    simSeed: 'tests/snapshots',
    state,
    picks: [],
    staffPriorities: {},
    pendingBySeedId: {},
    daySession: { beat: 'morning', serviceComplete: false, closingComplete: false },
    route: 'more',
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

describe('snapshots — empty list', () => {
  it('listSnapshots returns [] when the index slot is empty', () => {
    expect(listSnapshots()).toEqual([])
  })
})

describe('snapshots — CRUD lifecycle', () => {
  it('createSnapshot writes the index and the payload', () => {
    const session = makeSession(7)
    const out = createSnapshot('Before the big fight', session)
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.snapshot.name).toBe('Before the big fight')
    expect(out.snapshot.day).toBe(7)
    expect(out.snapshot.seedString).toBe('tests/snapshots')
    expect(out.snapshot.id).toMatch(/^snap_/)

    // Index slot
    const rawIndex = storage.getItem(SNAPSHOT_INDEX_KEY)
    expect(rawIndex).not.toBeNull()
    expect(JSON.parse(rawIndex!)).toEqual({
      version: 1,
      entries: [out.snapshot],
    })

    // Payload slot
    const rawPayload = storage.getItem(`${SNAPSHOT_PAYLOAD_PREFIX}${out.snapshot.id}`)
    expect(rawPayload).not.toBeNull()
  })

  it('listSnapshots returns the most-recently-created first', () => {
    const s1 = makeSession(1)
    const s2 = makeSession(2)
    const r1 = createSnapshot('First', s1)
    // Force differing timestamps via a tick — Date.now() should
    // monotonically advance even in tests.
    const t1 = Date.now()
    while (Date.now() === t1) {
      // spin briefly
    }
    const r2 = createSnapshot('Second', s2)
    expect(r1.ok && r2.ok).toBe(true)
    const list = listSnapshots()
    expect(list.map((e) => e.name)).toEqual(['Second', 'First'])
  })

  it('loadSnapshot rehydrates the session with the same shape as loadSession', () => {
    const session = makeSession(3)
    const created = createSnapshot('Mid-week', session)
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const outcome = loadSnapshot(created.snapshot.id)
    expect(outcome.kind).toBe('loaded')
    if (outcome.kind !== 'loaded') return
    expect(outcome.save.simSeed).toBe('tests/snapshots')
    expect(outcome.save.state.calendar.totalDaysElapsed).toBe(3)
    expect(outcome.save.route).toBe('more')
  })

  it('loadSnapshot returns invalid for a missing id', () => {
    const outcome = loadSnapshot('snap_does_not_exist')
    expect(outcome.kind).toBe('invalid')
  })

  it('renameSnapshot updates only the targeted entry', () => {
    const s1 = createSnapshot('A', makeSession())
    const s2 = createSnapshot('B', makeSession())
    expect(s1.ok && s2.ok).toBe(true)
    if (!s1.ok || !s2.ok) return
    expect(renameSnapshot(s1.snapshot.id, 'A updated')).toBe(true)
    const list = listSnapshots()
    const byId = new Map(list.map((e) => [e.id, e.name]))
    expect(byId.get(s1.snapshot.id)).toBe('A updated')
    expect(byId.get(s2.snapshot.id)).toBe('B')
  })

  it('renameSnapshot rejects empty / whitespace names', () => {
    const r = createSnapshot('A', makeSession())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(renameSnapshot(r.snapshot.id, '   ')).toBe(false)
    expect(renameSnapshot(r.snapshot.id, '')).toBe(false)
    // Original name unchanged
    expect(listSnapshots()[0]!.name).toBe('A')
  })

  it('deleteSnapshot removes the index entry and the payload', () => {
    const r = createSnapshot('To delete', makeSession())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(deleteSnapshot(r.snapshot.id)).toBe(true)
    expect(listSnapshots()).toEqual([])
    expect(
      storage.getItem(`${SNAPSHOT_PAYLOAD_PREFIX}${r.snapshot.id}`),
    ).toBeNull()
  })

  it('deleteSnapshot returns false for an unknown id', () => {
    expect(deleteSnapshot('snap_does_not_exist')).toBe(false)
  })
})

describe('snapshots — budget guard', () => {
  it('refuses to write when the projected total would exceed the budget', () => {
    // Prime the storage with a fixed slab close to the budget ceiling.
    const padding = 'x'.repeat(SNAPSHOT_BUDGET_BYTES - 5_000)
    storage.setItem('test-padding', padding)
    const r = createSnapshot('Too big', makeSession())
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toBe('storage_budget')
  })

  it('wouldExceedBudget reflects the current store', () => {
    expect(wouldExceedBudget(SNAPSHOT_BUDGET_BYTES + 1)).toBe(true)
    expect(wouldExceedBudget(0)).toBe(false)
  })

  it('estimateStorageBytes accumulates key + value lengths', () => {
    storage.setItem('a', 'hello')
    storage.setItem('bb', 'world!')
    // 'a' + 'hello' = 6, 'bb' + 'world!' = 8 → 14
    expect(estimateStorageBytes()).toBe(14)
  })
})

describe('snapshots — slot limit', () => {
  it(`refuses to create more than ${MAX_NAMED_SNAPSHOTS} named snapshots`, () => {
    for (let i = 0; i < MAX_NAMED_SNAPSHOTS; i += 1) {
      const r = createSnapshot(`Snapshot ${i}`, makeSession(i + 1))
      expect(r.ok).toBe(true)
    }
    const overflow = createSnapshot('One too many', makeSession(99))
    expect(overflow.ok).toBe(false)
    if (overflow.ok) return
    expect(overflow.reason).toBe('limit_reached')
  })
})

describe('snapshots — index resilience', () => {
  it('listSnapshots tolerates a corrupt index gracefully', () => {
    storage.setItem(SNAPSHOT_INDEX_KEY, '{not json')
    expect(listSnapshots()).toEqual([])
  })

  it('filters out malformed entries in the index', () => {
    storage.setItem(
      SNAPSHOT_INDEX_KEY,
      JSON.stringify({
        version: 1,
        entries: [
          { id: 'ok', name: 'good', createdAt: '2026-01-01', day: 1, seedString: 's', bytes: 0 },
          { name: 'missing-id' },
          'not-an-object',
        ],
      }),
    )
    const list = listSnapshots()
    expect(list).toHaveLength(1)
    expect(list[0]!.id).toBe('ok')
  })
})
