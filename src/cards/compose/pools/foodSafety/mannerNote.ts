// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Optional third-person sensory beat for the food_safety template —
// the cook wiping a hand, setting down a tasting spoon, the apron
// knotted twice. Voice-axis-gated only; no checkable claim.

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'mnr_warm',
      text: 'She wipes her hands and meets your eye, waiting.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_cold',
      text: 'She sets the tasting spoon down without looking up.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'mnr_formal',
      text: 'She squares the apron and waits for your decision.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_terse',
      text: 'She holds up the spoon and says nothing else.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_terse_cold',
      text: 'She keeps one hand on the prep block, watching.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'mnr_tic_qualifies',
      text: 'She tugs her cuff straight, twice, then once more.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'qualifies_everything' },
      ],
    },
  ],
}
