// Phase 131 / ISSUE-100 — Voiced Surface arc, Phase 5.
//
// Title slot for the staff_aside template. Replaces the old
// `formatTitle([display, 'a word before opening'])` glue + 6-word
// ellipsis clamp with a composed snippet pool. Template glue keeps
// prepending the staff member's display name; this pool supplies the
// situational phrase. Voice register `staff_quarters` — pre-shift,
// back-of-house, owner-facing — so phrasing leans toward private
// professional address rather than the bar floor.

import type { SnippetPool } from '../../types'

export const titlePool: SnippetPool = {
  slotId: 'title',
  snippets: [
    {
      id: 'title_fallback',
      text: 'a word before opening',
      conditions: [],
    },
    {
      id: 'title_terse',
      text: 'needs a quick word',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'title_warm',
      text: 'checks in before service',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'title_formal',
      text: 'requests a moment',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'title_florid',
      text: 'lingers with something to say',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
  ],
}
