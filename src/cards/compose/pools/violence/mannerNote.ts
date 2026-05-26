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

    // Phase 18 repair: spec-0 fillers so neutral-voiced cohorts fire.
    {
      id: 'mnr_mild_warm',
      text: 'They settle their weight onto the nearest stool.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_formal',
      text: 'They straighten before turning to address you.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_terse',
      text: 'A hand drums once on the bench top.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_florid',
      text: 'They turn a cuff back to free the wrist.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 1 },
      ],
      specificity: 0,
    },

    // Phase 154 / ISSUE-122 — Legible Surface arc, Phase 9.
    // Spec-1 state-keyed sensory beats so the cohort's manner
    // reflects its actual standing rather than standing fixed on
    // voice axes alone. Third-person framing ("they" / "a noun
    // action"); no role-claim words.
    {
      id: 'mnr_state_high_rowdiness',
      text: 'A fist pounds the bench in steady rhythm.',
      conditions: [
        { kind: 'signalEquals', signal: 'customer_group.rowdiness', role: 'primaryActor', equals: 'high' },
      ],
    },
    {
      id: 'mnr_state_low_satisfaction',
      text: 'A tankard is set down with deliberate force.',
      conditions: [
        { kind: 'signalEquals', signal: 'customer_group.satisfaction', role: 'primaryActor', equals: 'low' },
      ],
    },
    {
      id: 'mnr_state_high_damage',
      text: 'A regular steps wide around the splintered bench.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
      ],
    },
    {
      id: 'mnr_state_rowdy_damage',
      text: 'A fresh crack underfoot near their table.',
      conditions: [
        { kind: 'signalEquals', signal: 'customer_group.rowdiness', role: 'primaryActor', equals: 'high' },
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
      ],
    },
    {
      id: 'mnr_state_pressure_warning',
      text: 'A head turns at the door, listening hard.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'violence' },
        { kind: 'memoryPresent', tag: 'warning' },
      ],
    },
  ],
}
