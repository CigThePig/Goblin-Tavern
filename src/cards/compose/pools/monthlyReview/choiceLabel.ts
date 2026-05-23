// Phase 140 / ISSUE-109 — Voiced Surface arc, Phase 14 (Periodic & Narrative Beats).
//
// Voiced labels for the monthly_review template's response choices.
// Narrator-voiced — gated on `responseVerb` × `severityAtLeast` /
// `hasTag` / `memoryPresent`, never on actor voice. The synthetic slot
// is optional so an unmatched seed falls back to the sim's verbatim
// `slot.labelHint`.
//
// The monthly_review allowedVerbs surface at
// `issueSeedGenerators.ts:3628-3664` — pay / upgrade / delay / negotiate
// (the last when rival_taverns faction is seeded).

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    {
      id: 'label_pay_rent_due',
      text: 'Settle rent before the window closes',
      conditions: [
        { kind: 'responseVerb', anyOf: ['pay'] },
        { kind: 'hasTag', tag: 'rent_due_soon' },
      ],
    },
    {
      id: 'label_pay_default',
      text: 'Pay the landlord on the line',
      conditions: [
        { kind: 'responseVerb', anyOf: ['pay'] },
      ],
    },
    {
      id: 'label_upgrade_severity',
      text: 'Lay coin into the cellar instead',
      conditions: [
        { kind: 'responseVerb', anyOf: ['upgrade'] },
        { kind: 'severityAtLeast', value: 60 },
      ],
    },
    {
      id: 'label_upgrade_default',
      text: 'Invest in the cellar',
      conditions: [
        { kind: 'responseVerb', anyOf: ['upgrade'] },
      ],
    },
    {
      id: 'label_delay_landlord_memory',
      text: 'Hold the reserves another month',
      conditions: [
        { kind: 'responseVerb', anyOf: ['delay'] },
        { kind: 'memoryPresent', tag: 'landlord' },
      ],
    },
    {
      id: 'label_delay_default',
      text: 'Hold reserves through next month',
      conditions: [
        { kind: 'responseVerb', anyOf: ['delay'] },
      ],
    },
    {
      id: 'label_negotiate_default',
      text: 'Settle quietly with the rival',
      conditions: [
        { kind: 'responseVerb', anyOf: ['negotiate'] },
      ],
    },
  ],
}
