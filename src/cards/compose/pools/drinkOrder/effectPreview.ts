// Phase 132 / ISSUE-101 — Voiced Surface arc, Phase 6.
//
// Voiced effect-preview lines for the drink_order template. The helper
// `composeChoicesFromSeed` threads each `EffectPreview` in as
// `ctx.currentEffect` so the `effectKind` / `effectTag` primitives can
// read it. Each composed line corresponds 1-to-1 to a real
// `EffectPreview` in the consequence profile — the snippet replaces only
// the readable string, never the kind / target / amount / tags carried to
// the simulation. That's the structural sim-coherence guarantee for
// previews.
//
// Synthetic slot is `optional: true`; with no match the helper falls
// back to the sim's verbatim `effect.readable`. 10-word budget per the
// voice-bounds gate.

import type { SnippetPool } from '../../types'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    // No unconditional fallback — synthetic slot is `optional: true`
    // and the helper passes `effect.readable` through when no snippet
    // matches.
    {
      id: 'preview_regulars_warm',
      text: 'they ease back into the room',
      conditions: [
        { kind: 'effectTag', tag: 'regulars' },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'preview_regulars_terse',
      text: 'tension drops',
      conditions: [
        { kind: 'effectTag', tag: 'regulars' },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'preview_regulars_formal',
      text: 'the regular acknowledges the courtesy',
      conditions: [
        { kind: 'effectTag', tag: 'regulars' },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'preview_state_change_terse',
      text: 'nothing changes',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'preview_state_change_florid',
      text: 'the room settles into its accustomed shape',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
    {
      id: 'preview_state_change_cold',
      text: 'the bar carries on without comment',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },

    // — Phase 18 repair: base rung of unconditional kind-only snippets —
    {
      id: 'pre_state_change_a',
      text: 'the room settles a beat',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_b',
      text: 'the bar absorbs the change',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_c',
      text: 'their mood lifts a measure',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_d',
      text: 'the count tilts a notch',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
  ],
}
