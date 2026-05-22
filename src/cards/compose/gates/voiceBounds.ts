// Phase 124 / ISSUE-093 — Living Cast arc, Phase D.
// Phase 131 / ISSUE-100 — Voiced Surface arc, Phase 5: extended with
// `trailing_ellipsis` and `duplicate_token` checks so a snippet can
// never reintroduce the clamping symptoms the title path used to
// produce. The framing rule "titles are authored short, never clamped"
// is structurally enforced from here.
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

/** Stable failure reasons emitted by the voice-bounds gate. Tests match
 *  against these by name; Phase E's retry attribution reads the same
 *  strings. Frozen so a typo at a call site is a typecheck failure. */
export const VOICE_BOUNDS_REASONS = Object.freeze({
  overBudget: 'over_budget',
  trailingEllipsis: 'trailing_ellipsis',
  duplicateToken: 'duplicate_token',
} as const)

const TRAILING_ELLIPSIS_PATTERN = /(?:…|\.{3,})\s*$/
const DUPLICATE_TOKEN_PATTERN = /\b(\w+)\s+\1\b/i

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
    // Phase 131 / ISSUE-100 — the two new symptom checks are scoped to
    // slots whose advisory role is `'title'` (framework §2.4). The
    // verbal-tic snippets on body slots — e.g. the `trails_off` tic on
    // `aside_line` — legitimately use a trailing "…" as the *character's*
    // speech pattern, which is fine in a body line but never honest in
    // a card title (the original symptom was the framework clamping
    // mid-phrase, never an authored character flourish). Same for an
    // intentional duplication like "Time! Time, gentlemen!" in body
    // prose — fine there, broken in a title.
    const isTitleSlot = slot.role === 'title'
    for (const snippet of slot.pool.snippets) {
      const words = wordCount(snippet.text)
      if (words > budget) {
        violations.push({
          slotId: slot.id,
          snippetId: snippet.id,
          reason: VOICE_BOUNDS_REASONS.overBudget,
          detail: `${words} words > ${budget} budget`,
        })
      }
      if (isTitleSlot && TRAILING_ELLIPSIS_PATTERN.test(snippet.text)) {
        violations.push({
          slotId: slot.id,
          snippetId: snippet.id,
          reason: VOICE_BOUNDS_REASONS.trailingEllipsis,
          detail: 'title snippet ends with "…" — titles are authored short, never clamped',
        })
      }
      if (isTitleSlot) {
        const dup = DUPLICATE_TOKEN_PATTERN.exec(snippet.text)
        if (dup) {
          violations.push({
            slotId: slot.id,
            snippetId: snippet.id,
            reason: VOICE_BOUNDS_REASONS.duplicateToken,
            detail: `immediate duplicate token "${dup[1]}" in title snippet`,
          })
        }
      }
    }
  }
  return failReport(violations)
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}
