// Phase 93 / ISSUE-053 — Subroute persistence + envelope sanitation.
//
// Covers:
//   - A save written with subroutes round-trips through
//     validatePersistedSession.
//   - Unknown subroute enum values fall back to defaults (or are
//     dropped) rather than corrupting the session.
//   - An older save without `subroutes` still loads cleanly.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  SAVE_STORAGE_KEY,
  SAVE_VERSION,
  loadSession,
  setStorageForTesting,
  type PersistedSession,
  type StorageLike,
} from '../../web/src/lib/sim/persistence'
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

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
  setStorageForTesting(storage)
})

afterEach(() => {
  setStorageForTesting(undefined)
})

function basicSession(extra: Partial<PersistedSession> = {}): PersistedSession {
  const state = createInitialTavernState()
  return {
    saveVersion: SAVE_VERSION,
    savedAt: '2026-05-18T12:00:00.000Z',
    simSeed: 'tests/phase93',
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
    ...extra,
  }
}

describe('Phase 93 — subroute persistence', () => {
  it('round-trips reports/tavern/world subroutes', () => {
    const session = basicSession({
      subroutes: {
        reports: 'monthly',
        tavern: 'projects',
        world: 'rumours',
      },
    })
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(session))
    const outcome = loadSession()
    expect(outcome.kind).toBe('loaded')
    if (outcome.kind === 'loaded') {
      expect(outcome.save.subroutes).toEqual({
        reports: 'monthly',
        tavern: 'projects',
        world: 'rumours',
      })
    }
  })

  it('drops unknown subroute enum values', () => {
    const session = basicSession({
      subroutes: {
        reports: 'monthly',
        // @ts-expect-error — intentionally bogus value
        tavern: 'nonsense_tab',
        world: 'rumours',
      },
    })
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(session))
    const outcome = loadSession()
    expect(outcome.kind).toBe('loaded')
    if (outcome.kind === 'loaded') {
      // tavern dropped; reports and world preserved
      expect(outcome.save.subroutes).toEqual({
        reports: 'monthly',
        world: 'rumours',
      })
    }
  })

  it('loads cleanly when subroutes is missing entirely (old save)', () => {
    const session = basicSession()
    delete (session as { subroutes?: unknown }).subroutes
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(session))
    const outcome = loadSession()
    expect(outcome.kind).toBe('loaded')
    if (outcome.kind === 'loaded') {
      expect(outcome.save.subroutes).toBeUndefined()
    }
  })
})
