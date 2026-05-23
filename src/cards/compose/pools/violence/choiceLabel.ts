// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Voiced labels for the violence template's response choices.
// Voice-axis gating reads through the customer group's
// `castAttributes`. The synthetic slot is optional so an unmatched
// seed falls back to the sim's verbatim `slot.labelHint`.
//
// The violence allowedVerbs surface at `issueSeedGenerators.ts:2147-2180`:
//   - pay  / safe_costly (target: security system ref) — "Hire security"
//   - ban  / relationship_sacrifice (target: the rowdy group) — "Ban"
//   - rebrand / reputation_play (target: reputation system) — "Embrace"
//   - repair / short_term_patch (target: area picker) — "Repair damage"

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    {
      id: 'label_pay_default',
      text: 'Bring shoulders in tonight',
      conditions: [
        { kind: 'responseVerb', anyOf: ['pay'] },
      ],
    },
    {
      id: 'label_pay_severity',
      text: 'Get hired muscle on the door',
      conditions: [
        { kind: 'responseVerb', anyOf: ['pay'] },
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'label_ban_default',
      text: 'Bar them at the door',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ban'] },
      ],
    },
    {
      id: 'label_ban_cold',
      text: 'Cut them off from the house',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ban'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'label_rebrand_default',
      text: 'Make a virtue of the chaos',
      conditions: [
        { kind: 'responseVerb', anyOf: ['rebrand'] },
      ],
    },
    {
      id: 'label_rebrand_florid',
      text: 'Lean into the wild house',
      conditions: [
        { kind: 'responseVerb', anyOf: ['rebrand'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
    {
      id: 'label_repair_default',
      text: 'Patch what is broken',
      conditions: [
        { kind: 'responseVerb', anyOf: ['repair'] },
      ],
    },
    {
      id: 'label_repair_terse',
      text: 'Fix the room',
      conditions: [
        { kind: 'responseVerb', anyOf: ['repair'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
  ],
}
