// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Optional third-person sensory beat for the violence template — a
// shoulder dropped, a tankard slammed, the bench creaking, a hand near
// the hilt. Voice-axis-gated only; no checkable claim.

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'mnr_warm',
      text: 'A chair is offered before the heavier hand goes up.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_cold',
      text: 'A tankard rings against the bench, deliberate.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'mnr_formal',
      text: 'They square the table before stating their grievance.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_florid',
      text: 'Their banner-cloak catches the lamplight as they rise.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_terse_cold',
      text: 'A hand drifts toward the table edge, unhurried.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'mnr_tic_italicises',
      text: 'A mug strikes the bench to mark the word.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'italicises_stakes' },
      ],
    },
  ],
}
