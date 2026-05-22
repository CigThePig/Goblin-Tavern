// Phase 131 / ISSUE-100 — Voiced Surface arc, Phase 5.
//
// Title slot for the drink_order template. Replaces the old
// `formatTitle([display, 'orders a drink'])` glue + 6-word ellipsis
// clamp with a composed snippet pool. Template glue keeps prepending
// the regular's display name; this pool supplies the situational
// phrase. Every snippet is authored to fit the 6-word slot budget
// without trailing "…" and without immediate-duplicate-token symptoms
// the Phase-5 voice-bounds gate now forbids.

import type { SnippetPool } from '../../types'

export const titlePool: SnippetPool = {
  slotId: 'title',
  snippets: [
    // Unconditional fallback. Required by the coverage gate; reads
    // cleanly for any voice profile that doesn't match a rung below.
    {
      id: 'title_fallback',
      text: 'orders a drink',
      conditions: [],
    },
    {
      id: 'title_terse',
      text: 'wants ale',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'title_warm',
      text: 'comes for the usual',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'title_formal',
      text: 'requests refreshment',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'title_florid',
      text: 'settles in for something fine',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
  ],
}
