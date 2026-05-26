// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Optional third-person sensory beat for the rumour_crisis template —
// a tightened shoulder, eyes flicking sideways, hands settling on the
// bar, a sudden silence at the next table. Voice-axis-gated only; no
// checkable claim.

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'mnr_warm',
      text: 'They offer the open hand even as they speak.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_cold',
      text: 'A long look settles, then breaks deliberately away.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'mnr_formal',
      text: 'They square their shoulders before answering.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_terse',
      text: 'A small shake of the head, no more.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_florid',
      text: 'Their hand turns palm-up as if to catch the story.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_terse_cold',
      text: 'They turn back to the bar without a word.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'mnr_tic_italicises',
      text: 'A finger taps the wood to mark the claim.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'italicises_stakes' },
      ],
    },

    // Phase 18 repair: spec-0 fillers so neutral-voiced actors fire.
    {
      id: 'mnr_mild_warm',
      text: 'They glance toward the bar before answering.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_formal',
      text: 'They settle their stance before speaking.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_terse',
      text: 'A finger taps the table edge.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_florid',
      text: 'They turn their cup between their hands.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 1 },
      ],
      specificity: 0,
    },

    // Phase 155 / ISSUE-123 — Legible Surface arc, Phase 10. State-
    // keyed sensory beats so the manner line varies with accuracy /
    // pressure / memory reads, not just on voice axes. Third-person
    // narrator-observed; reachable across all six target kinds because
    // these gate on rumour-state reads, not actor castAttributes.
    {
      id: 'mnr_state_false_pressure',
      text: 'Their jaw sets at the false tale and rising slate.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.false' },
        { kind: 'pressureRising', pressureId: 'rumour_pressure' },
      ],
    },
    {
      id: 'mnr_state_supplier_bribe',
      text: 'The supplier’s hand strays once toward an inside pocket.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.target.supplier' },
        { kind: 'memoryPresent', tag: 'bribe' },
      ],
    },
    {
      id: 'mnr_state_severity_repeat',
      text: 'Their shoulders carry the third closing of the same whisper.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'repeatCount', subjectTag: 'rumour', atLeast: 3 },
      ],
    },
  ],
}
