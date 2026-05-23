// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Title pool for the reputation_shift compositional template. Template
// glue prepends a fixed `'Reputation'` prefix as `Reputation: ${snippet}`.
// The prefix itself is one word, so snippet text stays ≤ 5 words to keep
// the final composed title within the legacy 6-word total budget — the
// voice-bounds gate caps individual snippets at the slot wordBudget of 6
// and forbids trailing "…" / immediate duplicate tokens in title-role
// slots.

import type { SnippetPool } from '../../types'

export const titlePool: SnippetPool = {
  slotId: 'title',
  snippets: [
    {
      id: 'title_fallback',
      text: 'tilting this week',
      conditions: [],
    },
    {
      id: 'title_drift_rising',
      text: 'a sharper edge',
      conditions: [
        { kind: 'pressureRising', pressureId: 'reputation_drift' },
      ],
    },
    {
      id: 'title_cozy',
      text: 'a cozier name',
      conditions: [
        { kind: 'hasTag', tag: 'reputation.cozy' },
      ],
    },
    {
      id: 'title_tasty',
      text: 'a tastier name',
      conditions: [
        { kind: 'hasTag', tag: 'reputation.tasty' },
      ],
    },
    {
      id: 'title_dangerous',
      text: 'a rougher name',
      conditions: [
        { kind: 'hasTag', tag: 'reputation.dangerous' },
      ],
    },
    {
      id: 'title_high_severity',
      text: 'a hard turn',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
  ],
}
