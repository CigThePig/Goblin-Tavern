// Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8 (Regulars & Complaints).
//
// Voiced effect-preview lines for the customer_complaint template
// (cohort case). Each composed line corresponds 1-to-1 to a real
// EffectPreview; the snippet replaces only the readable string.

import type { SnippetPool } from '../../types'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    {
      id: 'pre_state_warm',
      text: "They'd settle back into the room",
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'pre_state_cold',
      text: "They'd walk before the next pour",
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'pre_coin_terse',
      text: 'Coin out, group kept',
      conditions: [
        { kind: 'effectTag', tag: 'coin' },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'pre_customer_warm',
      text: "They'd carry the goodwill for weeks",
      conditions: [
        { kind: 'effectTag', tag: 'customer' },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'pre_pressure_formal',
      text: 'The reputation meter would still ride',
      conditions: [
        { kind: 'effectKind', anyOf: ['pressure'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'pre_cause_florid',
      text: "The room's mood would tilt either way",
      conditions: [
        { kind: 'effectKind', anyOf: ['cause'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
  ],
}
