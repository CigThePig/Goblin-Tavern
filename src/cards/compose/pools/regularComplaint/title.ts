// Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8 (Regulars & Complaints).
//
// Title pool for the regular_complaint compositional template. Template
// glue prepends the regular's display name as `${display}: ${snippet}`.
// All snippets ≤ 6 words. The voice-bounds gate forbids trailing "…"
// and immediate duplicate token in title-role slots (Phase 5).

import type { SnippetPool } from '../../types'

export const titlePool: SnippetPool = {
  slotId: 'title',
  snippets: [
    {
      id: 'title_fallback',
      text: 'a quiet word',
      conditions: [],
    },
    {
      id: 'title_terse',
      text: 'quick word',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'title_warm',
      text: 'owner, a moment',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'title_formal',
      text: 'a word, owner',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'title_florid',
      text: 'before I forget',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
  ],
}
