// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Title pool for the inspection compositional template. Template glue
// prepends the inspector's display (faction label or notable-NPC name)
// as `${display}: ${snippet}`. Faction labels run 1–3 words; NPC names
// 1–2 words. Snippet text stays ≤ 3 words so a 3-word faction label
// ("Outer Watch Guild") keeps the final composed title within the
// legacy 6-word total budget. The voice-bounds gate caps snippets at
// the slot wordBudget of 6 and forbids trailing "…" / immediate
// duplicate tokens in title-role slots.

import type { SnippetPool } from '../../types'

export const titlePool: SnippetPool = {
  slotId: 'title',
  snippets: [
    {
      id: 'title_fallback',
      text: 'a word at the door',
      conditions: [],
    },
    {
      id: 'title_terse',
      text: 'an inspection',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'title_formal',
      text: 'a formal call',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'title_florid',
      text: 'a stern morning visit',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
    {
      id: 'title_severity',
      text: 'a full inspection due',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
  ],
}
