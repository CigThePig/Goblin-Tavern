// Phase 98 — Reactive preferences store.
//
// Singleton `prefsStore` owns the in-memory copy of `Preferences` and
// is the SOLE writer to the prefs localStorage slot. Each setter writes
// synchronously — preference changes are individually low-frequency
// (a tap on a toggle, a font-scale chip), so debouncing isn't worth
// the latency.
//
// `hydrate()` runs in `App.svelte#onMount` BEFORE `loadSession()` so
// CSS-variable wiring is in place by the first render. The values
// are pushed onto `document.documentElement` via a `$effect` in
// App.svelte.
//
// `claimHintSlot` / `releaseHintSlot` serialize first-encounter
// tooltips so only one is on screen at a time (prevents a viewport
// full of `TermLabel`s from pulsing in unison).

import {
  getDefaultPreferences,
  loadPreferences,
  savePreferences,
  type FontScale,
  type Preferences,
  type ReducedMotionMode,
  type ThemeMode,
} from './preferences'
import type { DifficultyId } from '../../../../src/sim/state/difficulty'

class PrefsStore {
  preferences: Preferences = $state(getDefaultPreferences())

  /**
   * The id of the term whose first-encounter hint is currently visible,
   * or undefined if no hint is on screen. Used to serialize hints
   * across multiple `TermLabel` instances in the same viewport.
   */
  currentlyShowingHint: string | undefined = $state(undefined)

  /** True after the first hydrate from storage. Read-only outside. */
  hydrated: boolean = $state(false)

  hydrate(): void {
    if (this.hydrated) return
    const outcome = loadPreferences()
    this.preferences = outcome.prefs
    this.hydrated = true
  }

  setFontScale(scale: FontScale): void {
    this.preferences = { ...this.preferences, fontScale: scale }
    savePreferences(this.preferences)
  }

  setReducedMotion(mode: ReducedMotionMode): void {
    this.preferences = { ...this.preferences, reducedMotion: mode }
    savePreferences(this.preferences)
  }

  setTheme(mode: ThemeMode): void {
    this.preferences = { ...this.preferences, theme: mode }
    savePreferences(this.preferences)
  }

  toggleSeedTags(): void {
    this.preferences = {
      ...this.preferences,
      showSeedTags: !this.preferences.showSeedTags,
    }
    savePreferences(this.preferences)
  }

  toggleConfirmEndDay(): void {
    this.preferences = {
      ...this.preferences,
      confirmEndDay: !this.preferences.confirmEndDay,
    }
    savePreferences(this.preferences)
  }

  toggleFirstEncounterHints(): void {
    this.preferences = {
      ...this.preferences,
      showFirstEncounterHints: !this.preferences.showFirstEncounterHints,
    }
    savePreferences(this.preferences)
  }

  markTermSeen(termId: string): void {
    if (this.preferences.seenTerms.includes(termId)) return
    this.preferences = {
      ...this.preferences,
      seenTerms: [...this.preferences.seenTerms, termId],
    }
    savePreferences(this.preferences)
  }

  setLastDifficulty(id: DifficultyId): void {
    this.preferences = { ...this.preferences, lastDifficulty: id }
    savePreferences(this.preferences)
  }

  /**
   * Try to claim the single first-encounter hint slot. Returns true
   * if this caller now owns the slot, false if another hint is
   * already visible. Callers must call `releaseHintSlot()` when their
   * hint dismisses.
   */
  claimHintSlot(termId: string): boolean {
    if (this.currentlyShowingHint !== undefined && this.currentlyShowingHint !== termId) {
      return false
    }
    this.currentlyShowingHint = termId
    return true
  }

  releaseHintSlot(): void {
    this.currentlyShowingHint = undefined
  }

  /** Reset preferences to defaults. Used by the More > Settings reset button. */
  reset(): void {
    this.preferences = getDefaultPreferences()
    savePreferences(this.preferences)
  }
}

export const prefsStore = new PrefsStore()
