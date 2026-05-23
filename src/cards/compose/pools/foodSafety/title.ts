// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Title pool for the food_safety compositional template. Template glue
// prepends the cook's display name as `${cook.display}: ${snippet}`.
// Staff display names are usually 1–2 words; snippet text stays ≤ 4
// words to keep the final composed title within the legacy 6-word
// total budget that `assertTitleBudget` enforces. The voice-bounds
// gate caps snippets at the slot wordBudget of 6 and forbids trailing
// "…" / immediate duplicate tokens in title-role slots.

import type { SnippetPool } from '../../types'

export const titlePool: SnippetPool = {
  slotId: 'title',
  snippets: [
    {
      id: 'title_fallback',
      text: 'a kitchen worry',
      conditions: [],
    },
    {
      id: 'title_terse',
      text: 'a problem',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'title_warm',
      text: 'a quick word',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'title_formal',
      text: 'a matter of safety',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'title_severity_ceiling',
      text: 'we cannot serve this',
      conditions: [
        { kind: 'severityAtLeast', value: 85 },
      ],
    },
  ],
}
