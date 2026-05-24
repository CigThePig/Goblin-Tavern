// Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8 (Regulars & Complaints).
//
// Voiced effect-preview lines for the regular_complaint template. Each
// composed line corresponds 1-to-1 to a real EffectPreview by
// construction (composeChoicesFromSeed iterates profile.immediateEffects
// per choice); the snippet replaces only the readable string, never
// the kind / target / amount / tags. Synthetic slot is optional;
// unmatched effects fall back to the sim's verbatim `effect.readable`.

import type { SnippetPool } from '../../types'
import { narratorEffectPreviewBase } from '../_shared/effectPreviewBase'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    ...narratorEffectPreviewBase(),
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

    // — Phase 18 repair: base rung of unconditional kind-only snippets —
    {
      id: 'pre_state_change_a',
      text: 'their mood would shift a notch',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_b',
      text: 'the table would settle a beat',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_c',
      text: 'their irritation would tilt a measure',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_d',
      text: 'the count of their patience would move',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_future_thread_a',
      text: 'a thread would loop back to the bar',
      conditions: [{ kind: 'effectKind', anyOf: ['future_hook'] }],
    },
    {
      id: 'pre_future_thread_b',
      text: 'a reminder would sit on the slate',
      conditions: [{ kind: 'effectKind', anyOf: ['future_hook'] }],
    },
    {
      id: 'pre_cause_mark',
      text: 'the room would mark the choice quietly',
      conditions: [{ kind: 'effectKind', anyOf: ['cause'] }],
    },
  ],
}
