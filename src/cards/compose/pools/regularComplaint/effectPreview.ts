// Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8 (Regulars & Complaints).
//
// Voiced effect-preview lines for the regular_complaint template. Each
// composed line corresponds 1-to-1 to a real EffectPreview by
// construction (composeChoicesFromSeed iterates profile.immediateEffects
// per choice); the snippet replaces only the readable string, never
// the kind / target / amount / tags. Synthetic slot is optional;
// unmatched effects fall back to the sim's verbatim `effect.readable`.

import type { SnippetPool } from '../../types'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    {
      id: 'pre_state_warm',
      text: "They'd warm back up by closing",
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'pre_state_cold',
      text: "They'd walk before the next round",
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'pre_coin_terse',
      text: 'Coin out, regular kept',
      conditions: [
        { kind: 'effectTag', tag: 'coin' },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'pre_regular_warm',
      text: "They'd carry that kindness for weeks",
      conditions: [
        { kind: 'effectTag', tag: 'regular' },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'pre_future_florid',
      text: 'A grudge would ripple back round',
      conditions: [
        { kind: 'effectKind', anyOf: ['future_hook'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
    {
      id: 'pre_cause_formal',
      text: 'Their loyalty would shift accordingly',
      conditions: [
        { kind: 'effectKind', anyOf: ['cause'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
  ],
}
