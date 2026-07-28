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
      // Phase 205 / audit Wave 6 (`P5-PLAY-005`) — this snippet makes two
      // claims the old condition never checked: that a LAST WEEK exists,
      // and that the stretching was of THIS item. It rendered on day 4 of
      // week 1, about a Bog Truffle, off the back of a day-1 watered-ale
      // memory. `minAgeDays: 7` means a qualifying memory is necessarily
      // in a prior week; `sharesSeedTag` means it is about the item this
      // card is about.
      id: 'title_watered_memory',
      text: 'last week was already stretched',
      conditions: [
        {
          kind: 'memoryPresent',
          tag: 'deception',
          minAgeDays: 7,
          sharesSeedTag: true,
        },
      ],
    },
    {
      // Phase 205 / audit Wave 6 (`P5-PLAY-005`) — "already out" is a
      // different situation from "running low", and the generator now
      // tones the seed for it.
      id: 'title_already_out',
      text: 'the shelf is bare already',
      conditions: [{ kind: 'hasTag', tag: 'already_out' }],
    },
  ],
}
