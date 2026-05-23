// Phase 132 / ISSUE-101 — Voiced Surface arc, Phase 6.
//
// Voiced labels for the staff_aside template's response choices. Voice
// register `staff_quarters` — back-of-house, pre-shift, owner-facing.
// Like the drinkOrder choice-label pool, the synthetic slot is
// `optional: true` so an unmatched seed falls back to the sim's verbatim
// `slot.labelHint`. 6-word budget; the voice-bounds gate enforces it.

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    {
      id: 'label_appease_warm',
      text: 'Hear them out before opening',
      conditions: [
        { kind: 'responseVerb', anyOf: ['appease'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'label_appease_terse',
      text: 'Address it',
      conditions: [
        { kind: 'responseVerb', anyOf: ['appease'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'label_appease_formal',
      text: 'Acknowledge the concern',
      conditions: [
        { kind: 'responseVerb', anyOf: ['appease'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'label_ignore_terse',
      text: 'Let it sit',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ignore'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'label_ignore_cold',
      text: 'Pretend nothing was said',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ignore'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'label_ignore_florid',
      text: 'Let the morning keep its rhythm',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ignore'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
  ],
}
