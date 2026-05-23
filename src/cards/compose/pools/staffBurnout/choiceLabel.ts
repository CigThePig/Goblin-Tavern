// Phase 133 / ISSUE-102 — Voiced Surface arc, Phase 7 (Staff & Personnel).
//
// Voiced labels for the staff_burnout template's response choices. Voice
// register `staff_quarters`. Verb-gated × voice-axis combinations cover
// pay (bonus), delegate (lighten load / reassign), and ignore
// (push through). The synthetic slot is `optional: true` so an
// unmatched seed falls back to the sim's verbatim `slot.labelHint`.

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    {
      id: 'label_pay_warm',
      text: 'Slip them a bonus',
      conditions: [
        { kind: 'responseVerb', anyOf: ['pay'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'label_pay_terse',
      text: 'Pay the bonus',
      conditions: [
        { kind: 'responseVerb', anyOf: ['pay'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'label_delegate_terse',
      text: 'Shift the rota',
      conditions: [
        { kind: 'responseVerb', anyOf: ['delegate'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'label_delegate_warm',
      text: 'Lighten the load for them',
      conditions: [
        { kind: 'responseVerb', anyOf: ['delegate'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'label_ignore_terse',
      text: 'Push through',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ignore'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'label_ignore_cold',
      text: 'Let them sweat it',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ignore'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
  ],
}
