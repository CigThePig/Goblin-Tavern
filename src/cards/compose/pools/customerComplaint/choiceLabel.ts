// Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8 (Regulars & Complaints).
//
// Voiced labels for the customer_complaint template's response choices
// (cohort case). The customer_complaint seed carries up to nine
// response slots (discount, fix_root, mock, rebrand, public_apology,
// side_with_staff, side_with_regular, house_rule_change, comp_table);
// the pool covers the most common verb-gated × voice-axis combinations.
// Unmatched seeds fall back to the sim's verbatim `slot.labelHint`.

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    {
      id: 'label_discount_warm',
      text: 'Comp the round',
      conditions: [
        { kind: 'responseVerb', anyOf: ['discount'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'label_discount_terse',
      text: 'Drop the price',
      conditions: [
        { kind: 'responseVerb', anyOf: ['discount'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'label_appease_formal',
      text: 'Apologise in full',
      conditions: [
        { kind: 'responseVerb', anyOf: ['appease'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'label_blame_cold',
      text: 'Side with the house',
      conditions: [
        { kind: 'responseVerb', anyOf: ['blame'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'label_rebrand_florid',
      text: 'Reframe the night',
      conditions: [
        { kind: 'responseVerb', anyOf: ['rebrand'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
    {
      id: 'label_clean_terse',
      text: 'Sort the room',
      conditions: [
        { kind: 'responseVerb', anyOf: ['clean'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
  ],
}
