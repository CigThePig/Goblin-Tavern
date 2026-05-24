// Phase 123 / ISSUE-092 — Living Cast arc, Phase C.
//
// Committed snippet pool for the `manner_note` slot — an optional
// physical-beat companion to the `order_line`. No fallback: when no
// snippet matches the actor's voice, the slot omits silently (framework
// §2.4 "silence beats weak copy"). Verbatim from
// `docs/plans/living-cast-arc-phase-b.md`.

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'manner_warm_coin',
      text: 'Their grin arrives before the coin.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'manner_cold_coin',
      text: 'They tap two coins once.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'manner_formal_wait',
      text: 'They wait with careful hands.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'manner_florid_smile',
      text: 'They smile like a locked chest.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'manner_nervous_count',
      text: 'They count the price twice.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'qualifies_everything' },
      ],
    },

    // Phase 18 repair: `atLeast: 1` mid-rung fillers at explicit spec 0
    // so neutral-voiced regulars fire SOMETHING rather than have the
    // body collapse to 2 lines.
    {
      id: 'manner_mild_warm',
      text: 'They glance along the bar before settling.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'manner_mild_formal',
      text: 'They wait until the tankard is set down.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'manner_mild_terse',
      text: 'They turn a coin between two fingers.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'manner_mild_florid',
      text: 'They tilt their head as they say it.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 1 },
      ],
      specificity: 0,
    },
  ],
}
