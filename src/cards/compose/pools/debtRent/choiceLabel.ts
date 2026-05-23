// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Voiced labels for the debt_rent template's response choices.
// Narrator-voiced — gated on `responseVerb` × `severityAtLeast` /
// `hasTag` / `memoryPresent`, never on actor voice. The synthetic slot
// is optional so an unmatched seed falls back to the sim's verbatim
// `slot.labelHint`.
//
// The debt_rent allowedVerbs surface at `issueSeedGenerators.ts:2406-2439`
// — pay / borrow / delay / raise_price.

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    {
      id: 'label_pay_rent_due',
      text: 'Settle it before the week ends',
      conditions: [
        { kind: 'responseVerb', anyOf: ['pay'] },
        { kind: 'hasTag', tag: 'rent_due_soon' },
      ],
    },
    {
      id: 'label_pay_default',
      text: 'Pay it down clean',
      conditions: [
        { kind: 'responseVerb', anyOf: ['pay'] },
      ],
    },
    {
      id: 'label_borrow_severity',
      text: 'Borrow against next month',
      conditions: [
        { kind: 'responseVerb', anyOf: ['borrow'] },
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'label_borrow_default',
      text: 'Take a short loan',
      conditions: [
        { kind: 'responseVerb', anyOf: ['borrow'] },
      ],
    },
    {
      id: 'label_delay_landlord_memory',
      text: 'Buy another week',
      conditions: [
        { kind: 'responseVerb', anyOf: ['delay'] },
        { kind: 'memoryPresent', tag: 'landlord' },
      ],
    },
    {
      id: 'label_raise_price_default',
      text: 'Lift the prices to cover it',
      conditions: [
        { kind: 'responseVerb', anyOf: ['raise_price'] },
      ],
    },
  ],
}
