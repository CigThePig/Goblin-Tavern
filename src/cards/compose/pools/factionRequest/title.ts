// Phase 136 / ISSUE-105 — Voiced Surface arc, Phase 10 (Factions & Culture).
//
// Title pool for the faction_request compositional template. Template
// glue prepends the faction's label as `${faction.label}: ${snippet}`.
// Faction labels in the registry run 1–3 words ("Town Watch",
// "Market Caravan Circle"); snippet text stays ≤ 6 words so the
// voice-bounds gate's title cap holds for the snippet alone. Phase 5
// forbids trailing "…" and immediate duplicate tokens in title-role slots.

import type { SnippetPool } from '../../types'

export const titlePool: SnippetPool = {
  slotId: 'title',
  snippets: [
    {
      id: 'title_fallback',
      text: 'a word about terms',
      conditions: [],
    },
    {
      id: 'title_terse',
      text: 'business at the door',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'title_warm',
      text: 'a friendly call',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'title_formal',
      text: 'a formal request',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'title_florid',
      text: 'banners at the threshold',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
  ],
}
