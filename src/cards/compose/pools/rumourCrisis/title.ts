// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Title pool for the rumour_crisis compositional template. Template
// glue prepends the target's display name as `${display}: ${snippet}`.
// Display names run 1–3 words across supplier / regular / faction /
// customer_group / staff / notable_npc; snippet text stays ≤ 3 words
// so a 3-word display keeps the final composed title within the
// legacy 6-word total budget.

import type { SnippetPool } from '../../types'

export const titlePool: SnippetPool = {
  slotId: 'title',
  snippets: [
    {
      id: 'title_fallback',
      text: 'a word travelling',
      conditions: [],
    },
    {
      id: 'title_terse',
      text: 'whispers',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'title_cold',
      text: 'a sharper tale',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'title_formal',
      text: 'a matter abroad',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'title_florid',
      text: 'a story in the wind',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
    {
      id: 'title_false_severity',
      text: 'a lie doing rounds',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.false' },
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
  ],
}
