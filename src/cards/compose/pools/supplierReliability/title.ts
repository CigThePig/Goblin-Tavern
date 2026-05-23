// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Title pool for the supplier_reliability compositional template. Template
// glue prepends the supplier's display name as `${display}: ${snippet}`.
// Supplier display names from the registry are commonly 3 words (e.g.
// "Brakka Mushroom Cart"), and the legacy 6-word title budget that
// `assertTitleBudget` enforces in `tests/cards/templates.test.ts` applies
// to the FINAL composed title — so snippet text stays ≤ 3 words. The
// voice-bounds gate caps individual snippets at 6 words. Phase 5
// forbids trailing "…" and immediate duplicate tokens in title-role slots.

import type { SnippetPool } from '../../types'

export const titlePool: SnippetPool = {
  slotId: 'title',
  snippets: [
    {
      id: 'title_fallback',
      text: 'morning trade',
      conditions: [],
    },
    {
      id: 'title_terse',
      text: 'terms to settle',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'title_warm',
      text: 'an old account',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'title_formal',
      text: 'a trade matter',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'title_florid',
      text: 'the road calling',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
  ],
}
