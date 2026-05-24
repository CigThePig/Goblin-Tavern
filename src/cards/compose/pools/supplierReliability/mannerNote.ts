// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Optional third-person sensory beat for the supplier_reliability
// template — boots, ledger, hands, the road. All snippets are flavor;
// voice-axis-gated only. Emits the Phase-3 converged pool at
// `specs/cards/supplier_reliability.spec.yaml:473-501`.

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'mnr_warm',
      text: 'They sit with the ease of an old visitor.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_cold',
      text: 'They keep their cloak on while we talk.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'mnr_formal',
      text: 'They bow before settling at the counter.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_florid',
      text: 'The road is still on their boots.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_terse_cold',
      text: 'They lay the ledger down without a word.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'mnr_tic_qualifies',
      text: 'They straighten the ledger twice, then once more.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'qualifies_everything' },
      ],
    },

    // Phase 18 repair: spec-0 fillers so neutral-voiced suppliers fire.
    {
      id: 'mnr_mild_warm',
      text: 'They lean their satchel against the bar.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_formal',
      text: 'They smooth the cuff of their coat.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_terse',
      text: 'They tap a coin on the counter while waiting.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_florid',
      text: 'They turn a sample bottle toward the lamplight.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 1 },
      ],
      specificity: 0,
    },

    // ─── Phase 149 / ISSUE-117 — state-keyed sensory beats ──────────
    // The sensory beat should reflect the supplier's actual standing.
    // Spec-1 / spec-2 state-keyed snippets fire orthogonally on signal
    // bands / pressures / repeat / memory.

    {
      id: 'mnr_state_low_reliability',
      text: 'Their cart wheels still creaking in the yard.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.reliability', equals: 'low' },
      ],
    },
    {
      id: 'mnr_state_distrust',
      text: 'Their eyes on the ledger, not on yours.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'supplier_distrust' },
      ],
    },
    {
      id: 'mnr_state_market_memory',
      text: 'The road dust still on their coat.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'market_instability' },
        { kind: 'memoryPresent', tag: 'supplier' },
      ],
    },
    {
      id: 'mnr_state_repeat',
      text: 'The third pattern in their boots this season.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'supplier', atLeast: 3 },
      ],
    },
    {
      id: 'mnr_state_high_relationship',
      text: 'A small nod between merchants.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.relationship', equals: 'high' },
      ],
    },
  ],
}
