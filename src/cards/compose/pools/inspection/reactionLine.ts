// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Flavor reaction line for the inspection template. The inspector
// (primaryActor — faction or notable_npc) speaking in first-person
// voice via `voiceAxis` and `verbalTic` only. May show authority,
// cold professionalism, courtesy, dryness. Must not assert specific
// past incidents or invent named NPCs.
//
// Four rungs:
//   - base   (specificity 0) one unconditional fallback
//   - middle (specificity 1) single-axis snippets
//   - top    (specificity 2) two-axis snippets
//   - tic    (specificity 1) one snippet per registered verbal tic

import type { SnippetPool } from '../../types'

export const reactionLinePool: SnippetPool = {
  slotId: 'reaction_line',
  snippets: [
    {
      id: 'rxn_fallback',
      text: 'I will need to walk the room with you this morning.',
      conditions: [],
    },

    {
      id: 'rxn_terse',
      text: 'A walk. Then a word.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_formal',
      text: 'I present myself in the duty of the office, by your leave.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_informal',
      text: 'Look, you know how it goes; show me the back.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atMost: 0 },
      ],
    },
    {
      id: 'rxn_florid',
      text: 'I bring the morning, and a long ledger of expectations.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },

    {
      id: 'rxn_terse_formal',
      text: 'A short walk. By the book.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_formal_florid',
      text: 'I trust the house will receive the inspection in due form.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },

    {
      id: 'rxn_tic_understates',
      text: 'A small visit. Surely the house can spare a glance.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'understates' },
      ],
    },
    {
      id: 'rxn_tic_qualifies',
      text: 'I think — likely — a few items want discussing today.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'qualifies_everything' },
      ],
    },
    {
      id: 'rxn_tic_italicises',
      text: 'This matters. The office does not turn a blind eye.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'italicises_stakes' },
      ],
    },
    {
      id: 'rxn_tic_repeats',
      text: 'Plain. Plain words. Show me the back.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'repeats_for_emphasis' },
      ],
    },
    {
      id: 'rxn_tic_quotes',
      text: 'The old code holds — "a tidy house, a quiet inspector."',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'quotes_someone_else' },
      ],
    },
  ],
}
