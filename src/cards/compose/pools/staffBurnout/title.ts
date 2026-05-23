// Phase 133 / ISSUE-102 — Voiced Surface arc, Phase 7 (Staff & Personnel).
//
// Title pool for the staff_burnout compositional template. Template glue
// prepends the actor display as `${display}: ${snippet}`; the snippet
// fills the role of the previous `composeTitle` ingredient. All snippets
// ≤ 6 words. The voice-bounds gate forbids trailing "…" and immediate
// duplicate token in title-role slots (Phase 5 / ISSUE-100).

import type { SnippetPool } from '../../types'

export const titlePool: SnippetPool = {
  slotId: 'title',
  snippets: [
    {
      id: 'title_fallback',
      text: 'a word before the day',
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
      text: 'a word, if I may',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'title_florid',
      text: 'before the day begins',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
  ],
}
