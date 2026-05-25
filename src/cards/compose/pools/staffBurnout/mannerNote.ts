// Phase 133 / ISSUE-102 — Voiced Surface arc, Phase 7 (Staff & Personnel).
//
// Optional third-person sensory beat for the staff_burnout template —
// posture, hands, breath, the kitchen. Omitted rather than weak. All
// snippets are flavor; voice-axis-gated only.

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'mnr_warm',
      text: 'They lean on the bar for half a breath.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_cold',
      text: 'They cross their arms before answering.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'mnr_formal',
      text: 'They stand straighter than the kitchen asks.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_florid',
      text: 'Their breath fogs in the cold kitchen.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_terse_cold',
      text: 'They roll their sleeves and wait.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'mnr_tic_qualifies',
      text: 'They wipe the same spot twice.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'qualifies_everything' },
      ],
    },

    // Phase 18 repair: `atLeast: 1` mid-rung snippets at explicit
    // specificity 0 so neutral staff fire SOMETHING rather than have
    // the body collapse to 2 lines. They never outrank the sharper
    // rungs above.
    {
      id: 'mnr_mild_warm',
      text: 'They lean their hip against the bench.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_formal',
      text: 'They settle their stance before answering.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_terse',
      text: 'They glance at the prep board once.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_florid',
      text: 'They smooth their apron pocket flat.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 1 },
      ],
      specificity: 0,
    },

    // ─── Phase 150 / ISSUE-118 — state-keyed sensory beats ───────────
    // The cook's body reflecting standing. Spec-1 state-keyed; fires
    // when state matches even on neutral voice profiles.

    {
      id: 'mnr_state_high_stress',
      text: 'Their grip on the counter sits white at the knuckles.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.stress', equals: 'high' },
      ],
    },
    {
      id: 'mnr_state_high_fatigue',
      text: 'They lean, shoulders rounded, eyes shadowed.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.fatigue', equals: 'high' },
      ],
    },
    {
      id: 'mnr_state_burnout',
      text: 'A pause too long before they look up.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'staff_burnout' },
      ],
    },
    {
      id: 'mnr_state_risk',
      text: 'Their eyes cut to the back door once.',
      conditions: [
        { kind: 'memoryPresent', tag: 'risk' },
      ],
    },
    {
      id: 'mnr_state_repeat',
      text: 'The same worn knot riding their shoulders again.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'staff', atLeast: 3 },
      ],
    },
  ],
}
