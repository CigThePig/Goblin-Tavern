// Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8 (Regulars & Complaints).
//
// Flavor reaction line for the customer_complaint template (cohort
// case). A representative voice from the cohort speaking to the owner;
// first-person plural ("we") where natural. Voice driven by
// `voiceAxis` and `verbalTic` only. Must not name a specific
// individual within the cohort.

import type { SnippetPool } from '../../types'

export const reactionLinePool: SnippetPool = {
  slotId: 'reaction_line',
  snippets: [
    {
      id: 'rxn_fallback',
      text: 'The mugs grow cold while the silence grows louder.',
      conditions: [],
    },

    {
      id: 'rxn_terse',
      text: 'Make it right. Now.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_warm',
      text: "We come here for a reason. Help us keep doing it.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_cold',
      text: "Don't dress it up, owner. Just fix it.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'rxn_formal',
      text: 'We would speak to the management on a matter.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_florid',
      text: 'The ale here used to taste like welcome.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },

    {
      id: 'rxn_terse_cold',
      text: "We've waited long enough. Settle it.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'rxn_warm_informal',
      text: "Look, we like this place. Don't make us walk.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atMost: 0 },
      ],
    },
    {
      id: 'rxn_formal_restrained',
      text: 'We raise this without ornament, owner; the matter is plain.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atMost: 0 },
      ],
    },

    {
      id: 'rxn_tic_qualifies',
      text: 'Some of us, mostly, would like an answer. Maybe.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'qualifies_everything' },
      ],
    },
    {
      id: 'rxn_tic_interrupts',
      text: 'We came to drink — never mind, just listen a minute.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'interrupts_self' },
      ],
    },
    {
      id: 'rxn_tic_understates',
      text: 'A small thing, all things considered, but worth a word.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'understates' },
      ],
    },
    {
      id: 'rxn_tic_repeats',
      text: "We're saying it. We're saying it, owner, plainly.",
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'repeats_for_emphasis' },
      ],
    },
    {
      id: 'rxn_tic_trails_off',
      text: 'We came in for the usual, but…',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'trails_off' },
      ],
    },
    {
      id: 'rxn_tic_italicises',
      text: 'This matters to us. That part should count.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'italicises_stakes' },
      ],
    },
    {
      id: 'rxn_tic_quotes',
      text: 'My grandmother said — silence is the longest reply.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'quotes_someone_else' },
      ],
    },
  ],
}
