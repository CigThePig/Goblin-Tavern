// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Title pool for the debt_rent compositional template. No display prefix
// — the template renders the snippet verbatim because the situation, not
// a person, centres the card. All snippets ≤ 6 words. Voice-bounds gate
// forbids trailing "…" and immediate duplicate token.

import type { SnippetPool } from '../../types'

export const titlePool: SnippetPool = {
  slotId: 'title',
  snippets: [
    {
      id: 'title_fallback',
      text: 'a quiet hour with the ledger',
      conditions: [],
    },
    {
      id: 'title_rent_due_soon',
      text: 'rent week is here',
      conditions: [
        { kind: 'hasTag', tag: 'rent_due_soon' },
      ],
    },
    {
      id: 'title_landlord_rising',
      text: 'the landlord stirs',
      conditions: [
        { kind: 'pressureRising', pressureId: 'landlord' },
      ],
    },
    {
      id: 'title_high_severity',
      text: 'the coin pile runs thin',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'title_debt_rising',
      text: 'the debt column climbs',
      conditions: [
        { kind: 'pressureRising', pressureId: 'debt' },
      ],
    },
  ],
}
