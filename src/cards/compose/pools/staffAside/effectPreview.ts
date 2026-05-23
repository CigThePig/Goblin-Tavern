// Phase 132 / ISSUE-101 — Voiced Surface arc, Phase 6.
//
// Voiced effect-preview lines for the staff_aside template. Voice
// register `staff_quarters`. Each composed line corresponds 1-to-1 to a
// real `EffectPreview` in the consequence profile — the snippet replaces
// only the readable string. 10-word budget per the voice-bounds gate.

import type { SnippetPool } from '../../types'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    {
      id: 'preview_staff_warm',
      text: 'they settle into the shift',
      conditions: [
        { kind: 'effectTag', tag: 'staff' },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'preview_staff_terse',
      text: 'morale steadies',
      conditions: [
        { kind: 'effectTag', tag: 'staff' },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'preview_staff_formal',
      text: 'the matter is recorded as resolved',
      conditions: [
        { kind: 'effectTag', tag: 'staff' },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'preview_state_change_terse',
      text: 'nothing shifts',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'preview_state_change_florid',
      text: 'the kitchen keeps its quiet drumbeat',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
    {
      id: 'preview_state_change_cold',
      text: 'the prep continues without comment',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
  ],
}
