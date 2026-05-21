// Phase 124 / ISSUE-093 — Living Cast arc, Phase D.
//
// Voice-bounds gate (framework §6 #3). Every snippet's `text` must fit
// its slot's word budget. Budget resolution order:
//
//   1. `config.perSlot[slot.id]`  — test-time override
//   2. `slot.wordBudget`          — authored on the SlotSpec (default
//                                   place; ships with drinkOrder)
//   3. `config.defaultWordBudget` — caller default
//   4. `DEFAULT_BODY_WORD_BUDGET` — framework §4 body cap (12 words)
//
// Word counting matches the pattern in `tests/cards/templates.voice.test.ts`
// (whitespace-split, filtered for empties). The gate is intentionally
// SLOT-LEVEL, not template-level: title-bound slots can carry
// `wordBudget: 6` and the same gate covers them.

import type { CompositionalCardTemplate } from '../types'
import { failReport, type GateReport, type GateViolation } from './types'

export const DEFAULT_BODY_WORD_BUDGET = 12

export type VoiceBoundsConfig = {
  defaultWordBudget?: number
  perSlot?: Record<string, number>
}

export function checkVoiceBounds(
  template: CompositionalCardTemplate,
  config?: VoiceBoundsConfig,
): GateReport {
  const violations: GateViolation[] = []
  const fallbackBudget = config?.defaultWordBudget ?? DEFAULT_BODY_WORD_BUDGET
  for (const slot of template.slots) {
    const override = config?.perSlot?.[slot.id]
    const budget = override ?? slot.wordBudget ?? fallbackBudget
    for (const snippet of slot.pool.snippets) {
      const words = wordCount(snippet.text)
      if (words > budget) {
        violations.push({
          slotId: slot.id,
          snippetId: snippet.id,
          reason: 'over_budget',
          detail: `${words} words > ${budget} budget`,
        })
      }
    }
  }
  return failReport(violations)
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}
