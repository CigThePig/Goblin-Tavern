// Phase 98 — First-encounter hint logic, isolated as a pure function
// so it's directly unit-testable without a Svelte test harness.
//
// The rule (from `docs/plans/game-loop-and-ux.md §9.4`): show a small
// inline definition the first time a glossary term renders in the
// player's view, during the introductory week of play. After the
// player has seen the term once OR after day 7, the hint stops
// auto-appearing — the glossary chip remains a tap-to-open affordance.

import type { Preferences } from './preferences'

export const FIRST_ENCOUNTER_AUTO_DISMISS_MS = 8_000
export const FIRST_ENCOUNTER_DAY_THRESHOLD = 7

/**
 * Returns true when a `TermLabel` for `termId` should auto-open its
 * first-encounter hint on first viewport intersection.
 *
 * The check returns false if:
 *   - the player has disabled the feature,
 *   - the term has already been shown to them, or
 *   - the calendar day is past the introductory threshold.
 *
 * Callers must additionally serialize hints via
 * `prefsStore.claimHintSlot()` so multiple labels in one viewport
 * don't pulse simultaneously.
 */
export function shouldShowFirstEncounterHint(
  termId: string,
  prefs: Preferences,
  day: number,
  dayThreshold: number = FIRST_ENCOUNTER_DAY_THRESHOLD,
): boolean {
  if (!prefs.showFirstEncounterHints) return false
  if (prefs.seenTerms.includes(termId)) return false
  if (day > dayThreshold) return false
  return true
}
