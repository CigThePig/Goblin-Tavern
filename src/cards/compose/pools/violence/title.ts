// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Title pool for the violence compositional template. Template glue
// prepends the customer group's label as `${group.label}: ${snippet}`.
// Customer group labels run 1–2 words ("Ogres", "Adventurers",
// "Merchants", "Miners"); snippet text stays ≤ 4 words to keep the
// final composed title within the legacy 6-word total budget. The
// voice-bounds gate caps snippets at the slot wordBudget of 6 and
// forbids trailing "…" / immediate duplicate tokens in title-role
// slots.

import type { SnippetPool } from '../../types'

export const titlePool: SnippetPool = {
  slotId: 'title',
  snippets: [
    {
      id: 'title_fallback',
      text: 'tempers fraying',
      conditions: [],
    },
    {
      id: 'title_terse',
      text: 'trouble',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'title_cold',
      text: 'spoiling for trouble',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'title_formal',
      text: 'a grievance to settle',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'title_florid',
      text: 'blood up across the room',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
  ],
}
