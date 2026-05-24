// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Optional third-person sensory beat for the stock_shortage template —
// the cellar shelves, the empty kegs, the slate at the bar, thirsty
// regulars at the door. Narrator-voiced; gated on prior-choice memories,
// tone tags, and severity (no actor axes).

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'mnr_high_demand',
      text: 'A line is already forming outside.',
      conditions: [
        { kind: 'hasTag', tag: 'high_demand' },
      ],
    },
    {
      id: 'mnr_watered_memory',
      text: 'A faint sour smell lingers from the stretched batch.',
      conditions: [
        { kind: 'memoryPresent', tag: 'deception' },
      ],
    },
    {
      id: 'mnr_high_severity',
      text: 'Two of the kegs ring hollow when nudged.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'mnr_price_memory',
      text: 'The new price slate is still wet at the bar.',
      conditions: [
        { kind: 'memoryPresent', tag: 'price' },
      ],
    },
    {
      id: 'mnr_stock_repeat',
      text: 'Dust marks where the missing barrels used to stand.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'stock', atLeast: 3 },
      ],
    },

    // Phase 18 repair: spec-0 unconditional fillers so the body fires.
    {
      id: 'mnr_mild_shelf',
      text: 'A shelf sits emptier than it did at week start.',
      conditions: [],
      specificity: 0,
    },
    {
      id: 'mnr_mild_slate',
      text: 'The bar slate has been updated with a hasty hand.',
      conditions: [],
      specificity: 0,
    },
    {
      id: 'mnr_mild_lamp',
      text: 'The cellar lamp is set close over the count.',
      conditions: [],
      specificity: 0,
    },
  ],
}
