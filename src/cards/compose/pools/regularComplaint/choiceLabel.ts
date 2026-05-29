// Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8 (Regulars & Complaints).
//
// Voiced labels for the regular_complaint template's response choices.
// Voice register `tavern_floor`. Verb-gated × voice-axis combinations
// cover appease, discount, ignore, ban, blame. The synthetic slot is
// `optional: true` so an unmatched seed falls back to the sim's verbatim
// `slot.labelHint`.

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    {
      id: 'label_appease_warm',
      text: 'Sit with them a moment',
      conditions: [
        { kind: 'responseVerb', anyOf: ['appease'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'label_appease_terse',
      text: 'Hear them out',
      conditions: [
        { kind: 'responseVerb', anyOf: ['appease'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'label_discount_warm',
      text: 'Comp their next round',
      conditions: [
        { kind: 'responseVerb', anyOf: ['discount'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'label_ignore_cold',
      text: 'Let them stew',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ignore'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    // Phase 165 / ISSUE-133 — Faithful Surface arc, Phase 3 (Distinguishable
    // Choices). `refuse_request` (verb `blame`/`ignore`) matched the `ignore`
    // snippet and collided with the `ignore_regular` slot. Discriminate on its
    // distinct shape `relationship_sacrifice`.
    {
      id: 'label_refuse_request',
      text: 'Turn the request down flat',
      specificity: 3,
      conditions: [{ kind: 'responseShape', anyOf: ['relationship_sacrifice'] }],
    },
    {
      id: 'label_ban_cold',
      text: 'Show them the door',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ban'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'label_blame_terse',
      text: 'Refuse the request',
      conditions: [
        { kind: 'responseVerb', anyOf: ['blame'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
  ],
}
