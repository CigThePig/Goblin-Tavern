// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Optional third-person sensory beat for the inspection template — a
// clipboard tapped, a slow walk along the bar, a glance to the
// kitchen door, a notebook flipped. Voice-axis-gated only; no
// checkable claim.

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'mnr_terse',
      text: 'A clipboard taps once against the counter.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_formal',
      text: 'They smooth the ledger before opening to a marked page.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_florid',
      text: 'The badge-cloth catches the morning lamp as they straighten.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_terse_formal',
      text: 'A glance to the back. A slow nod.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_severity',
      text: 'A pencil hovers over the page, ready to mark.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'mnr_tic_qualifies',
      text: 'They straighten the cuff twice, then once more.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'qualifies_everything' },
      ],
    },
  ],
}
