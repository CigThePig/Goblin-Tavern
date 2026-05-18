// Phase 89 / ISSUE-049 — Persistence contract + migration framework +
// save-slot safety tests.
//
// Covers:
//   - saveSession returns a typed result; a throwing storage write
//     surfaces ok:false without losing the latest-write contract.
//   - Old saves missing the `recipes` slice migrate forward.
//   - Old saves missing the `expeditions` slice migrate forward.
//   - Old saves missing module-state slots migrate forward.
//   - Malformed picks are dropped at load time.
//   - Orphan snapshot payloads are listed and recoverable.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  SAVE_STORAGE_KEY,
  SAVE_VERSION,
  loadSession,
  saveSession,
  setStorageForTesting,
  type PersistedSession,
  type StorageLike,
} from '../../web/src/lib/sim/persistence'
import {
  SNAPSHOT_INDEX_KEY,
  SNAPSHOT_PAYLOAD_PREFIX,
  findOrphanSnapshots,
  recoverOrphanSnapshots,
  setStorageForTesting as setSnapshotStorage,
  listSnapshots,
} from '../../web/src/lib/sim/snapshots'
import {
  sanitizePicks,
  type PickedAction,
} from '../../web/src/lib/sim/actionBuilder'
import { createInitialTavernState } from '../../src/sim/state/defaults'

class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>()
  public length = 0
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v)
    this.length = this.map.size
  }
  removeItem(k: string): void {
    this.map.delete(k)
    this.length = this.map.size
  }
  key(i: number): string | null {
    const keys = [...this.map.keys()]
    return keys[i] ?? null
  }
}

class ThrowingStorage implements StorageLike {
  getItem(): string | null {
    return null
  }
  setItem(): void {
    const err = new Error('QuotaExceededError')
    ;(err as Error & { name: string }).name = 'QuotaExceededError'
    throw err
  }
  removeItem(): void {}
}

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
  setStorageForTesting(storage)
  setSnapshotStorage(storage)
})

afterEach(() => {
  setStorageForTesting(undefined)
  setSnapshotStorage(undefined)
})

function basicSession(): PersistedSession {
  const state = createInitialTavernState()
  return {
    saveVersion: SAVE_VERSION,
    savedAt: '2026-05-18T12:00:00.000Z',
    simSeed: 'tests/phase89',
    state,
    picks: [],
    staffPriorities: {},
    pendingBySeedId: {},
    daySession: {
      beat: 'morning',
      serviceComplete: false,
      closingComplete: false,
    },
    route: 'day',
  }
}

describe('Phase 89 — saveSession typed result', () => {
  it('returns ok:true with savedAt on success', () => {
    const session = basicSession()
    const result = saveSession(session)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.savedAt).toBe(session.savedAt)
  })

  it('returns ok:false with reason:quota when the storage throws QuotaExceededError', () => {
    setStorageForTesting(new ThrowingStorage())
    const result = saveSession(basicSession())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('quota')
  })

  it('does not leak the failed write through to the lastSavedAt contract', () => {
    // The persistence layer must report failure; the caller (App.svelte)
    // is responsible for pinning lastSavedAt. We only need to verify
    // the typed result is what the caller will read.
    setStorageForTesting(new ThrowingStorage())
    const result = saveSession(basicSession())
    expect(result.ok).toBe(false)
  })
})

describe('Phase 89 — old-save migration', () => {
  it('migrates a save with no recipes slice forward', () => {
    const session = basicSession()
    // Strip recipes — pre-Phase-65 saves do not carry this slice.
    const { recipes, ...stateWithoutRecipes } = session.state as TavernState & {
      recipes: unknown
    }
    void recipes
    const corrupted = {
      ...session,
      state: stateWithoutRecipes,
    }
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(corrupted))
    const outcome = loadSession()
    expect(outcome.kind).toBe('loaded')
    if (outcome.kind === 'loaded') {
      expect(typeof outcome.save.state.recipes).toBe('object')
      expect(Object.keys(outcome.save.state.recipes).length).toBeGreaterThan(0)
    }
  })

  it('migrates a save with no expeditions slice forward', () => {
    const session = basicSession()
    const { expeditions, ...stateWithoutExpeditions } = session.state as TavernState & {
      expeditions: unknown
    }
    void expeditions
    const corrupted = {
      ...session,
      state: stateWithoutExpeditions,
    }
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(corrupted))
    const outcome = loadSession()
    expect(outcome.kind).toBe('loaded')
    if (outcome.kind === 'loaded') {
      expect(outcome.save.state.expeditions).toEqual({
        active: [],
        completed: [],
      })
    }
  })

  it('migrates a save missing a late module-state slot forward', () => {
    const session = basicSession()
    // Drop `responses` (Phase 41 module slice) — sim that's been around
    // longer than the slot would otherwise bounce.
    const { responses, ...modulesWithoutResponses } = session.state
      .modules as Record<string, unknown>
    void responses
    const corrupted = {
      ...session,
      state: {
        ...session.state,
        modules: modulesWithoutResponses,
      },
    }
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(corrupted))
    const outcome = loadSession()
    expect(outcome.kind).toBe('loaded')
    if (outcome.kind === 'loaded') {
      expect(outcome.save.state.modules.responses).toBeDefined()
    }
  })
})

describe('Phase 89 — pick sanitisation', () => {
  it('drops a pick whose actionId is not registered', () => {
    const state = createInitialTavernState()
    const raw: unknown[] = [
      {
        pickId: 'p1',
        actionId: 'definitely_not_an_action',
        label: 'fake',
        category: 'immediate',
        targetType: 'global',
        actionPointCost: 1,
      },
    ]
    const result = sanitizePicks(raw, state)
    expect(result.picks).toEqual([])
    expect(result.droppedCount).toBe(1)
  })

  it('drops a pick missing required fields', () => {
    const state = createInitialTavernState()
    const raw: unknown[] = [
      { pickId: 'p1', actionId: 'restock_item' }, // missing everything else
    ]
    const result = sanitizePicks(raw, state)
    expect(result.picks).toEqual([])
    expect(result.droppedCount).toBe(1)
  })

  it('keeps a well-formed pick whose target exists', () => {
    const state = createInitialTavernState()
    const stockId = Object.keys(state.stock)[0]!
    const raw: PickedAction[] = [
      {
        pickId: 'p1',
        actionId: 'restock_item',
        label: 'Restock',
        category: 'immediate',
        targetType: 'stock',
        actionPointCost: 1,
        targetId: stockId,
        targetLabel: state.stock[stockId]!.label,
      },
    ]
    const result = sanitizePicks(raw, state)
    expect(result.picks).toHaveLength(1)
    expect(result.picks[0]!.actionId).toBe('restock_item')
    expect(result.droppedCount).toBe(0)
  })

  it('drops malformed picks during loadSession', () => {
    const session = basicSession()
    const corrupted = {
      ...session,
      picks: [
        { pickId: 'p1', actionId: 'unknown_action' },
        'totally not an object',
        null,
      ] as unknown as PickedAction[],
    }
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(corrupted))
    const outcome = loadSession()
    expect(outcome.kind).toBe('loaded')
    if (outcome.kind === 'loaded') {
      expect(outcome.save.picks).toEqual([])
    }
  })
})

describe('Phase 89 — orphan snapshot recovery', () => {
  it('lists payload keys not represented in the index', () => {
    // Write a payload with no matching index entry.
    const orphanId = 'ghostid'
    const session = basicSession()
    storage.setItem(
      `${SNAPSHOT_PAYLOAD_PREFIX}${orphanId}`,
      JSON.stringify(session),
    )
    // Empty index
    storage.setItem(
      SNAPSHOT_INDEX_KEY,
      JSON.stringify({ version: 1, entries: [] }),
    )

    const orphans = findOrphanSnapshots()
    expect(orphans).toHaveLength(1)
    expect(orphans[0]!.id).toBe(orphanId)
    expect(orphans[0]!.name).toBe('Recovered')
  })

  it('recovers orphan payloads back into the index', () => {
    const orphanId = 'ghostid'
    const session = basicSession()
    storage.setItem(
      `${SNAPSHOT_PAYLOAD_PREFIX}${orphanId}`,
      JSON.stringify(session),
    )
    storage.setItem(
      SNAPSHOT_INDEX_KEY,
      JSON.stringify({ version: 1, entries: [] }),
    )

    const adopted = recoverOrphanSnapshots()
    expect(adopted).toBe(1)
    const list = listSnapshots()
    expect(list).toHaveLength(1)
    expect(list[0]!.id).toBe(orphanId)
  })
})

// Type helper for the destructuring trick above.
type TavernState = ReturnType<typeof createInitialTavernState>
