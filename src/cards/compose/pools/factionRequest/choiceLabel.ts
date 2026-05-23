// Phase 136 / ISSUE-105 — Voiced Surface arc, Phase 10 (Factions & Culture).
//
// Voiced labels for the faction_request template's response choices.
// Voice register `tavern_floor`. Verb-gated × voice-axis combinations
// cover appease, pay, negotiate, blame, ignore, threaten, invite. The
// synthetic slot is `optional: true` so an unmatched seed falls back to
// the sim's verbatim `slot.labelHint`.
//
// The faction_request verb surface at `expandedSeedGenerators.ts:1930-1979`
// — appease / pay / negotiate / blame / ignore / threaten / invite.

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    {
      id: 'label_appease_formal',
      text: 'Offer a formal concession',
      conditions: [
        { kind: 'responseVerb', anyOf: ['appease', 'pay'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'label_negotiate_warm',
      text: 'Talk it out with them',
      conditions: [
        { kind: 'responseVerb', anyOf: ['negotiate'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'label_negotiate_terse',
      text: 'Strike a quick bargain',
      conditions: [
        { kind: 'responseVerb', anyOf: ['negotiate'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'label_blame_cold',
      text: 'Lay the fault at their door',
      conditions: [
        { kind: 'responseVerb', anyOf: ['blame'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'label_ignore_terse',
      text: 'Refuse the petition',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ignore'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'label_threaten_cold',
      text: 'Send them off with a warning',
      conditions: [
        { kind: 'responseVerb', anyOf: ['threaten'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'label_invite_warm',
      text: 'Welcome them for the evening',
      conditions: [
        { kind: 'responseVerb', anyOf: ['invite'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
  ],
}
