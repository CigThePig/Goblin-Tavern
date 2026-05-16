import type { SimulationHook, SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ValidationIssue } from '../../state/types'

import { HISTORY_SUMMARY_MAX_LENGTH } from './historyLog'

// Phase 16 §16.8 — History module.
//
// The history log itself lives at the root of `TavernState`
// (`state.history`) so it can be written by any module via
// `ctx.addHistory`. This module exists to:
//
//   1. Give the history log a versioned identity in the module
//      registry (matches the placeholder declared in Phase 2).
//   2. Run a lightweight validator that catches obviously malformed
//      entries (over-long summaries, blank category, etc.).
//   3. Phase 62 / ISSUE-022 — bound the log on monthly ticks so the
//      `state.history` array does not grow unboundedly with simulation
//      length.

export const HISTORY_MODULE_ID = 'history'

// Phase 62 / ISSUE-022 — Pruning policy.
//
// Keep up to `HISTORY_MAX_ENTRIES` entries OR every entry within the
// last `HISTORY_MIN_AGE_DAYS`, whichever covers MORE. The rule
// preserves the most recent entries always (they're chronologically
// at the end of the array) and is cheap to evaluate once a month.
//
// History is intentionally debug-grade — no cause emission, no
// change-tracker entry. See `context.ts` "History entries are
// append-only debug records describing what happened."
export const HISTORY_MAX_ENTRIES = 500
export const HISTORY_MIN_AGE_DAYS = 90

function validateHistory(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (let i = 0; i < ctx.state.history.length; i += 1) {
    const entry = ctx.state.history[i]!
    if (entry.summary.length === 0) {
      issues.push({
        path: `history[${i}].summary`,
        message: `History entry '${entry.id}' has an empty summary`,
        code: 'history_blank_summary',
      })
    } else if (entry.summary.length > HISTORY_SUMMARY_MAX_LENGTH) {
      issues.push({
        path: `history[${i}].summary`,
        message: `History entry '${entry.id}' summary exceeds ${HISTORY_SUMMARY_MAX_LENGTH} chars`,
        code: 'history_summary_too_long',
      })
    }
  }
  return issues
}

const pruneHistoryHook: SimulationHook = (ctx: SimContext): void => {
  const history = ctx.state.history
  if (history.length <= HISTORY_MAX_ENTRIES) return

  const today = ctx.state.calendar.totalDaysElapsed
  const ageCutoff = today - HISTORY_MIN_AGE_DAYS

  // Compute the cutoff day from the size cap. History entries are
  // appended in chronological order, so the entry at index
  // `length - HISTORY_MAX_ENTRIES` is the oldest one we'd keep if we
  // used the size cap alone.
  const sizeCapEntry = history[history.length - HISTORY_MAX_ENTRIES]!
  const sizeCutoff = sizeCapEntry.timestamp.absoluteDay

  // Whichever rule keeps MORE entries wins → pick the LOWER cutoff
  // (a lower cutoff filter retains more entries).
  const cutoff = Math.min(ageCutoff, sizeCutoff)
  if (cutoff <= 0) return
  ctx.pruneHistoryBefore(cutoff)
}

export const historyModule: SimulationModule = {
  id: HISTORY_MODULE_ID,
  version: '0.2.0',
  validate: validateHistory,
  hooks: {
    endMonth: [pruneHistoryHook],
  },
}
