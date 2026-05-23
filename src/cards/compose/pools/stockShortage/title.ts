// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Title pool for the stock_shortage compositional template. No display
// prefix — the template renders the snippet verbatim because the
// situation, not a person, centres the card. All snippets ≤ 6 words.
// Voice-bounds gate forbids trailing "…" and immediate duplicate token.

import type { SnippetPool } from '../../types'

export const titlePool: SnippetPool = {
  slotId: 'title',
  snippets: [
    {
      id: 'title_fallback',
      text: 'a lean morning at the cellar',
      conditions: [],
    },
    {
      id: 'title_shortage_rising',
      text: 'the shelves keep thinning',
      conditions: [
        { kind: 'pressureRising', pressureId: 'stock_shortage' },
      ],
    },
    {
      id: 'title_high_demand',
      text: 'a thirsty room ahead',
      conditions: [
        { kind: 'hasTag', tag: 'high_demand' },
      ],
    },
    {
      id: 'title_high_severity',
      text: 'the cellar nearly bare',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'title_watered_memory',
      text: 'last week was already stretched',
      conditions: [
        { kind: 'memoryPresent', tag: 'deception' },
      ],
    },
  ],
}
