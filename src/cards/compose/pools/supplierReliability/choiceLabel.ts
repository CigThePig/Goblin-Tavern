// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Voiced labels for the supplier_reliability template's response choices.
// Voice register `trade_floor`. Verb-gated × voice-axis combinations cover
// pay, negotiate, blame, ignore, fire (switch supplier), buy (accept
// suspicious goods). The synthetic slot is `optional: true` so an
// unmatched seed falls back to the sim's verbatim `slot.labelHint`.
//
// The supplier's allowedVerbs surface at `expandedSeedGenerators.ts:1189-1255`
// — pay / negotiate / blame / fire / buy / ignore / inspect. Six rungs
// cover the dramatic spread; the rest take the fallback.

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    {
      id: 'label_pay_formal',
      text: 'Settle their account',
      conditions: [
        { kind: 'responseVerb', anyOf: ['pay'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'label_negotiate_warm',
      text: 'Find common ground',
      conditions: [
        { kind: 'responseVerb', anyOf: ['negotiate'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'label_negotiate_terse',
      text: 'Cut the terms shorter',
      conditions: [
        { kind: 'responseVerb', anyOf: ['negotiate'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'label_blame_cold',
      text: 'Pin it on the wagon',
      conditions: [
        { kind: 'responseVerb', anyOf: ['blame'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'label_ignore_terse',
      text: 'Wave the offer off',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ignore'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'label_fire_cold',
      text: 'Send them down the road',
      conditions: [
        { kind: 'responseVerb', anyOf: ['fire'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
  ],
}
