// Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8 (Regulars & Complaints).
//
// Optional third-person sensory beat for the regular_complaint template
// — posture, hands, the mug, the bench. Omitted rather than weak. All
// snippets are flavor; voice-axis-gated only.

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'mnr_warm',
      text: 'They lean across the bar like an old friend.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_cold',
      text: 'They push the mug away without looking up.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'mnr_formal',
      text: 'They sit straighter than the bench asks.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_florid',
      text: 'Their fingers tap the table like a slow drum.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_terse_cold',
      text: 'They fold their arms and wait.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'mnr_tic_qualifies',
      text: 'They smooth the same edge of the cloth twice.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'qualifies_everything' },
      ],
    },

    // Phase 18 repair: spec-0 fillers so neutral regulars fire.
    {
      id: 'mnr_mild_warm',
      text: 'They rest their elbow on the bartop.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_formal',
      text: 'They wait until the mug is set down.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_terse',
      text: 'They tap a finger on the bench.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_florid',
      text: 'They turn the coaster between their hands.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 1 },
      ],
      specificity: 0,
    },

    // ─── Phase 151 / ISSUE-119 — state-keyed sensory beats ──────────
    // Same pattern as the reaction pool: spec-1 state-keyed snippets
    // fire when state matches but voice is neutral. The voice/tic-
    // gated snippets above stay; the new snippets sit alongside them.

    {
      id: 'mnr_state_high_irritation',
      text: 'A flat hand spreads slow across the bar.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.irritation', equals: 'high' },
      ],
    },
    {
      id: 'mnr_state_low_loyalty',
      text: 'One foot already turned toward the door.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.loyalty', equals: 'low' },
      ],
    },
    {
      id: 'mnr_state_loss_rising',
      text: 'A glance to where their friends used to sit.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'regular_customer_loss' },
      ],
    },
    {
      id: 'mnr_state_grudge_memory',
      text: 'The same hard line settles at the mouth.',
      conditions: [
        { kind: 'memoryPresent', tag: 'grudge' },
      ],
    },
    {
      id: 'mnr_state_repeat',
      text: 'The words come without thinking now.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'regular', atLeast: 3 },
      ],
    },
  ],
}
