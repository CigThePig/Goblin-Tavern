// Phase 98 — Truth-table tests for the first-encounter hint helper.
//
// The Svelte popover component just renders. The decision of WHEN to
// render is the helper, which is a pure boolean function — exactly the
// shape that benefits from isolated unit tests.

import { describe, expect, it } from 'vitest'

import {
  FIRST_ENCOUNTER_AUTO_DISMISS_MS,
  FIRST_ENCOUNTER_DAY_THRESHOLD,
  shouldShowFirstEncounterHint,
} from '../../web/src/lib/prefs/firstEncounter'
import { getDefaultPreferences } from '../../web/src/lib/prefs/preferences'

describe('shouldShowFirstEncounterHint', () => {
  it('returns true on day 1 for an unseen term with hints enabled', () => {
    const prefs = getDefaultPreferences()
    expect(shouldShowFirstEncounterHint('food_safety', prefs, 1)).toBe(true)
  })

  it('returns true at the threshold day exactly', () => {
    const prefs = getDefaultPreferences()
    expect(
      shouldShowFirstEncounterHint(
        'pressure',
        prefs,
        FIRST_ENCOUNTER_DAY_THRESHOLD,
      ),
    ).toBe(true)
  })

  it('returns false past the threshold day', () => {
    const prefs = getDefaultPreferences()
    expect(
      shouldShowFirstEncounterHint(
        'pressure',
        prefs,
        FIRST_ENCOUNTER_DAY_THRESHOLD + 1,
      ),
    ).toBe(false)
  })

  it('returns false when the term has already been seen', () => {
    const prefs = {
      ...getDefaultPreferences(),
      seenTerms: ['food_safety'],
    }
    expect(shouldShowFirstEncounterHint('food_safety', prefs, 1)).toBe(false)
  })

  it('returns false when the preference is disabled', () => {
    const prefs = {
      ...getDefaultPreferences(),
      showFirstEncounterHints: false,
    }
    expect(shouldShowFirstEncounterHint('food_safety', prefs, 1)).toBe(false)
  })

  it('honours an overridden day threshold', () => {
    const prefs = getDefaultPreferences()
    // With threshold 3, day 4 is past
    expect(shouldShowFirstEncounterHint('food_safety', prefs, 4, 3)).toBe(false)
    expect(shouldShowFirstEncounterHint('food_safety', prefs, 3, 3)).toBe(true)
  })

  it('exposes a sensible auto-dismiss timeout constant', () => {
    expect(FIRST_ENCOUNTER_AUTO_DISMISS_MS).toBeGreaterThan(2_000)
    expect(FIRST_ENCOUNTER_AUTO_DISMISS_MS).toBeLessThan(15_000)
  })
})
