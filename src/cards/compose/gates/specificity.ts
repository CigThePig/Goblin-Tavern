// Phase 124 / ISSUE-093 — Living Cast arc, Phase D.
//
// Specificity-gradient gate (framework §6 #2). Each REQUIRED slot's pool
// must contain BOTH (a) at least one unconditional fallback and (b) at
// least one conditioned snippet. Pools with only the fallback collapse
// onto one line in play (functionally flat); pools with no fallback have
// no safety net (assembler returns `undefined` whenever no condition
// matches). Phase B's exemplar gradient — fallback + single-axis middle
// rung + two-axis top rung + tic rung — exists precisely to clear this
// bar.
//
// Optional slots are exempt from BOTH halves: an optional slot's pool
// may be entirely conditioned (silence is the fallback), or entirely
// unconditional (degenerate but legal — a single always-on aside).

import type { CompositionalCardTemplate } from '../types'
import { failReport, type GateReport, type GateViolation } from './types'

export function checkSpecificityGradient(
  template: CompositionalCardTemplate,
): GateReport {
  const violations: GateViolation[] = []
  for (const slot of template.slots) {
    if (slot.optional === true) continue
    const hasFallback = slot.pool.snippets.some(
      (s) => s.conditions.length === 0,
    )
    const hasConditioned = slot.pool.snippets.some(
      (s) => s.conditions.length > 0,
    )
    if (!hasFallback) {
      violations.push({
        slotId: slot.id,
        reason: 'no_fallback',
        detail: 'pool lacks an unconditional snippet (specificity 0)',
      })
    }
    if (!hasConditioned) {
      violations.push({
        slotId: slot.id,
        reason: 'no_conditioned_snippet',
        detail: 'pool is all-fallback — no gradient to climb',
      })
    }
  }
  return failReport(violations)
}
