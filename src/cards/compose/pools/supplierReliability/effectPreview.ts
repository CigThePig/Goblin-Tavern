// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Voiced effect-preview lines for the supplier_reliability template. Each
// composed line corresponds 1-to-1 to a real EffectPreview by construction
// (composeChoicesFromSeed iterates profile.immediateEffects per choice);
// the snippet replaces only the readable string, never the kind / target
// / amount / tags. Synthetic slot is optional; unmatched effects fall
// back to the sim's verbatim `effect.readable`.

import type { SnippetPool } from '../../types'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    {
      id: 'pre_state_warm',
      text: "They'd run the line with care after",
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'pre_state_cold',
      text: "They'd keep their distance from then on",
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'pre_supplier_warm',
      text: 'The partnership would hold steady',
      conditions: [
        { kind: 'effectTag', tag: 'supplier' },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'pre_coin_terse',
      text: 'Coin out, the route stays open',
      conditions: [
        { kind: 'effectTag', tag: 'coin' },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'pre_pressure_formal',
      text: 'The market pressure would ease accordingly',
      conditions: [
        { kind: 'effectKind', anyOf: ['pressure'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'pre_cause_florid',
      text: 'Trust would settle like dust on the road',
      conditions: [
        { kind: 'effectKind', anyOf: ['cause'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
  ],
}
