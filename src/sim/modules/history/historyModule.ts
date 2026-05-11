import type { SimulationModule } from '../../core/module'
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
//
// We intentionally do not add hooks or per-day slices here. Phase 17
// will likely fold this into the cause-tracking pipeline; this stub
// keeps the module shape stable in the meantime.

export const HISTORY_MODULE_ID = 'history'

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

export const historyModule: SimulationModule = {
  id: HISTORY_MODULE_ID,
  version: '0.1.0',
  validate: validateHistory,
}
