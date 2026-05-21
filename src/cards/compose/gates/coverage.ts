// Phase 124 / ISSUE-093 — Living Cast arc, Phase D.
//
// Coverage gate (framework §6 #1). Every REQUIRED slot's pool must
// contain at least one snippet with `conditions: []` — the unconditional
// fallback that guarantees the slot always resolves. Optional slots are
// exempt: "silence beats weak copy" (framework §2.4).
//
// This is the simplest of the six gates, and it's load-bearing: without
// the coverage guarantee, a required slot can resolve to `undefined`,
// which would break templates that read `filled[slotId]` directly.

import type { CompositionalCardTemplate, SlotSpec } from '../types'
import { failReport, type GateReport, type GateViolation } from './types'

export function checkCoverage(
  template: CompositionalCardTemplate,
): GateReport {
  const violations: GateViolation[] = []
  for (const slot of template.slots) {
    if (slot.optional === true) continue
    if (!hasUnconditionalFallback(slot)) {
      violations.push({
        slotId: slot.id,
        reason: 'missing_unconditional_fallback',
        detail: 'required slot has no snippet with empty conditions',
      })
    }
  }
  return failReport(violations)
}

function hasUnconditionalFallback(slot: SlotSpec): boolean {
  return slot.pool.snippets.some((s) => s.conditions.length === 0)
}
