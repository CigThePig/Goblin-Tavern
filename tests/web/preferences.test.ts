// Phase 98 — Player preferences round-trip + sanitization tests.
//
// Mirrors `persistence.test.ts` in shape: in-memory storage adapter
// drives the real `preferences.ts` module, exercises save → load
// round-trip, default fallback, malformed input, and version mismatch.
//
// Preferences are intentionally forgiving: corrupt or version-mismatched
// payloads fall back to defaults silently. There's no "preferences
// invalid" UI; losing a slider position to a partial decode would be
// a bad UX, so we resist it.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  PREFS_STORAGE_KEY,
  PREFS_VERSION,
  clearPreferences,
  getDefaultPreferences,
  loadPreferences,
  savePreferences,
  setStorageForTesting,
  type Preferences,
  type StorageLike,
} from '../../web/src/lib/prefs/preferences'

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

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
  setStorageForTesting(storage)
})

afterEach(() => {
  setStorageForTesting(undefined)
})

describe('preferences — defaults', () => {
  it('returns fresh defaults when storage is empty', () => {
    const out = loadPreferences()
    expect(out.kind).toBe('fresh')
    expect(out.prefs.version).toBe(PREFS_VERSION)
    expect(out.prefs.fontScale).toBe('md')
    expect(out.prefs.reducedMotion).toBe('auto')
    expect(out.prefs.showSeedTags).toBe(true)
    expect(out.prefs.confirmEndDay).toBe(false)
    expect(out.prefs.showFirstEncounterHints).toBe(true)
    expect(out.prefs.seenTerms).toEqual([])
    expect(out.prefs.lastDifficulty).toBe('standard')
  })

  it('getDefaultPreferences produces a fresh, owned object each call', () => {
    const a = getDefaultPreferences()
    const b = getDefaultPreferences()
    a.seenTerms.push('mutated-by-test')
    expect(b.seenTerms).toEqual([])
  })
})

describe('preferences — round-trip', () => {
  it('save → load yields the saved values', () => {
    const prefs: Preferences = {
      ...getDefaultPreferences(),
      fontScale: 'lg',
      reducedMotion: 'on',
      showSeedTags: false,
      confirmEndDay: true,
      showFirstEncounterHints: false,
      seenTerms: ['food_safety', 'pressure'],
      lastDifficulty: 'hard',
    }
    savePreferences(prefs)
    const out = loadPreferences()
    expect(out.kind).toBe('loaded')
    expect(out.prefs).toEqual(prefs)
  })

  it('seenTerms is preserved verbatim across saves (order + content)', () => {
    const prefs: Preferences = {
      ...getDefaultPreferences(),
      seenTerms: ['z', 'a', 'm', 'q'],
    }
    savePreferences(prefs)
    const out = loadPreferences()
    expect(out.prefs.seenTerms).toEqual(['z', 'a', 'm', 'q'])
  })
})

describe('preferences — sanitization', () => {
  it('falls back to defaults on malformed JSON', () => {
    storage.setItem(PREFS_STORAGE_KEY, '{not json')
    const out = loadPreferences()
    expect(out.kind).toBe('fresh')
    expect(out.prefs).toEqual(getDefaultPreferences())
  })

  it('falls back to defaults on version mismatch', () => {
    const prefs = getDefaultPreferences()
    savePreferences(prefs)
    const raw = storage.getItem(PREFS_STORAGE_KEY)!
    const blob = JSON.parse(raw)
    blob.version = 99
    storage.setItem(PREFS_STORAGE_KEY, JSON.stringify(blob))
    const out = loadPreferences()
    expect(out.kind).toBe('fresh')
  })

  it('drops invalid enum values and uses defaults for those fields', () => {
    storage.setItem(
      PREFS_STORAGE_KEY,
      JSON.stringify({
        version: PREFS_VERSION,
        fontScale: 'extra-large',
        reducedMotion: 'sometimes',
        lastDifficulty: 'goblin',
        showSeedTags: 'yes',
        seenTerms: ['ok', 123, null, 'also-ok'],
      }),
    )
    const out = loadPreferences()
    expect(out.kind).toBe('loaded')
    expect(out.prefs.fontScale).toBe('md')
    expect(out.prefs.reducedMotion).toBe('auto')
    expect(out.prefs.lastDifficulty).toBe('standard')
    // showSeedTags came in as a string — typeof check rejects, default
    // (true) wins.
    expect(out.prefs.showSeedTags).toBe(true)
    expect(out.prefs.seenTerms).toEqual(['ok', 'also-ok'])
  })

  it('falls back when root is not an object', () => {
    storage.setItem(PREFS_STORAGE_KEY, JSON.stringify([1, 2, 3]))
    const out = loadPreferences()
    expect(out.kind).toBe('fresh')
  })
})

describe('preferences — clearPreferences', () => {
  it('removes the stored prefs and returns fresh on the next load', () => {
    savePreferences(getDefaultPreferences())
    expect(storage.has(PREFS_STORAGE_KEY)).toBe(true)
    clearPreferences()
    expect(storage.has(PREFS_STORAGE_KEY)).toBe(false)
    expect(loadPreferences().kind).toBe('fresh')
  })
})
