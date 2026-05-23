// Phase 132 / ISSUE-101 — Voiced Surface arc, Phase 6.
//
// Voiced labels for the drink_order template's response choices. The
// helper `composeChoicesFromSeed` threads each `ResponseSlot` in as
// `ctx.currentResponseSlot` so the new `responseVerb` / `responseShape`
// primitives can read it. The pool is `optional: true` on the synthetic
// slot — when no snippet matches we fall back to the sim's verbatim
// `slot.labelHint`, never an invented string.
//
// Voice register: `tavern_floor`. Authored to fit a 6-word budget; the
// voice-bounds gate enforces this slot-by-slot.

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    // No unconditional fallback — the synthetic slot is `optional: true`
    // so `pickSnippet → undefined` is the design: the helper passes
    // through `slot.labelHint` exactly, preserving the sim's authored
    // wording when the voice pools have nothing better to offer.
    {
      id: 'label_appease_warm',
      text: 'Pour them one on the house',
      conditions: [
        { kind: 'responseVerb', anyOf: ['appease'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'label_appease_terse',
      text: 'Smooth it',
      conditions: [
        { kind: 'responseVerb', anyOf: ['appease'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'label_appease_formal',
      text: 'Offer a measured gesture',
      conditions: [
        { kind: 'responseVerb', anyOf: ['appease'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'label_ignore_terse',
      text: 'Move on',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ignore'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
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
    {
      id: 'label_ignore_florid',
      text: 'Let the moment pass',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ignore'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
  ],
}
