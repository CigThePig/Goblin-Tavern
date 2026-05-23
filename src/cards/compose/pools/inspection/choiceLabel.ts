// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Voiced labels for the inspection template's response choices. The
// inspection seed carries the longest response-slot roster in the
// codebase (8 slots, 7 distinct verbs at
// `issueSeedGenerators.ts:2724-2793`). The pool covers each verb's
// fallback plus a voice-axis-conditioned variant where it differentiates.
//
// Verb roster:
//   - clean    / long_term_investment (areas)
//   - bribe    / risky_profitable     (faction/system)
//   - hide     / deception            (cellar)
//   - discard  / safe_costly          (stock items, alt verb of clean)
//   - ignore   / ignore               (none)
//   - delegate / long_term_investment (cleaner staff)
//   - invite   / safe_costly          (walkthrough)
//   - negotiate/ safe_costly          (guidance)

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    {
      id: 'label_clean_default',
      text: 'Scour the worst corners',
      conditions: [
        { kind: 'responseVerb', anyOf: ['clean'] },
      ],
    },
    {
      id: 'label_clean_terse',
      text: 'Scrub it',
      conditions: [
        { kind: 'responseVerb', anyOf: ['clean'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'label_bribe_default',
      text: 'Slide coin across the bar',
      conditions: [
        { kind: 'responseVerb', anyOf: ['bribe'] },
      ],
    },
    {
      id: 'label_hide_default',
      text: 'Tuck it out of sight',
      conditions: [
        { kind: 'responseVerb', anyOf: ['hide'] },
      ],
    },
    {
      id: 'label_discard_default',
      text: 'Throw out the worst stock',
      conditions: [
        { kind: 'responseVerb', anyOf: ['discard'] },
      ],
    },
    {
      id: 'label_ignore_default',
      text: 'Let it ride',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ignore'] },
      ],
    },
    {
      id: 'label_delegate_default',
      text: 'Set a cleaning roster',
      conditions: [
        { kind: 'responseVerb', anyOf: ['delegate'] },
      ],
    },
    {
      id: 'label_invite_default',
      text: 'Walk them through',
      conditions: [
        { kind: 'responseVerb', anyOf: ['invite'] },
      ],
    },
    {
      id: 'label_invite_formal',
      text: 'Receive them with due form',
      conditions: [
        { kind: 'responseVerb', anyOf: ['invite'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'label_negotiate_default',
      text: 'Ask their guidance plainly',
      conditions: [
        { kind: 'responseVerb', anyOf: ['negotiate'] },
      ],
    },
  ],
}
