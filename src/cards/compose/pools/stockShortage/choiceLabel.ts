// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Voiced labels for the stock_shortage template's response choices.
// Narrator-voiced — gated on `responseVerb` × `responseShape` /
// `severityAtLeast` / `hasTag`, never on actor voice (no actor resolves
// for this template). The synthetic slot is optional so an unmatched seed
// falls back to the sim's verbatim `slot.labelHint`.
//
// The stock_shortage allowedVerbs surface at `issueSeedGenerators.ts:443-484`
// — buy / raise_price / serve / delay / ignore.

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    {
      id: 'label_buy_high_demand',
      text: 'Refill before the room fills',
      conditions: [
        { kind: 'responseVerb', anyOf: ['buy'] },
        { kind: 'hasTag', tag: 'high_demand' },
      ],
    },
    {
      id: 'label_buy_default',
      text: 'Send for a fresh load',
      conditions: [
        { kind: 'responseVerb', anyOf: ['buy'] },
      ],
    },
    {
      id: 'label_raise_price_severity',
      text: 'Mark the slate higher',
      conditions: [
        { kind: 'responseVerb', anyOf: ['raise_price'] },
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'label_serve_watered',
      text: 'Stretch what is left',
      conditions: [
        { kind: 'responseVerb', anyOf: ['serve'] },
      ],
    },
    {
      id: 'label_delay_limit',
      text: 'Ration the pours',
      conditions: [
        { kind: 'responseVerb', anyOf: ['delay'] },
      ],
    },
    {
      id: 'label_ignore_quiet',
      text: 'Leave it for tomorrow',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ignore'] },
      ],
    },
  ],
}
