// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Voiced labels for the food_safety template's response choices.
// Voice-axis gating reads through the cook's `castAttributes`, but the
// labels are addressed to the owner (the player), so they read as the
// cook's framing of the four options — not the owner's. The synthetic
// slot is optional so an unmatched seed falls back to the sim's
// verbatim `slot.labelHint`.
//
// The food_safety allowedVerbs surface at `issueSeedGenerators.ts:160-200`:
//   - discard / safe_costly (target: mushrooms or stew)
//   - clean / long_term_investment (target: kitchen)
//   - serve / risky_profitable (target: stew)
//   - blame / relationship_sacrifice (target: supplier)

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    {
      id: 'label_discard_default',
      text: 'Bin the bad stock',
      conditions: [
        { kind: 'responseVerb', anyOf: ['discard'] },
      ],
    },
    {
      id: 'label_discard_severity',
      text: 'Throw out anything questionable',
      conditions: [
        { kind: 'responseVerb', anyOf: ['discard'] },
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'label_clean_default',
      text: 'Scour the kitchen down',
      conditions: [
        { kind: 'responseVerb', anyOf: ['clean'] },
      ],
    },
    {
      id: 'label_clean_terse',
      text: 'Scrub it',
      conditions: [
        { kind: 'responseVerb', anyOf: ['clean'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'label_serve_default',
      text: 'Run it through service',
      conditions: [
        { kind: 'responseVerb', anyOf: ['serve'] },
      ],
    },
    {
      id: 'label_serve_severity',
      text: 'Send it out anyway',
      conditions: [
        { kind: 'responseVerb', anyOf: ['serve'] },
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'label_blame_default',
      text: 'Pin it on the supplier',
      conditions: [
        { kind: 'responseVerb', anyOf: ['blame'] },
      ],
    },
    {
      id: 'label_blame_cold',
      text: 'Shift the blame outward',
      conditions: [
        { kind: 'responseVerb', anyOf: ['blame'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
  ],
}
