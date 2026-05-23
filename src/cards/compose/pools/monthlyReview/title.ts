// Phase 140 / ISSUE-109 — Voiced Surface arc, Phase 14 (Periodic & Narrative Beats).
//
// Title pool for the monthly_review compositional template. The template
// renders the title as `Month in review: ${snippet}` — preserving the
// fixed legacy header prefix while the snippet supplies the month's
// character. All snippets ≤ 6 words. Voice-bounds gate forbids trailing
// "…" and immediate duplicate token.

import type { SnippetPool } from '../../types'

export const titlePool: SnippetPool = {
  slotId: 'title',
  snippets: [
    {
      id: 'title_fallback',
      text: 'the ledger closes for the month',
      conditions: [],
    },
    {
      id: 'title_landlord_rising',
      text: 'rent weighs on the page',
      conditions: [
        { kind: 'pressureRising', pressureId: 'landlord' },
      ],
    },
    {
      id: 'title_debt_rising',
      text: 'the shortfall lengthens',
      conditions: [
        { kind: 'pressureRising', pressureId: 'debt' },
      ],
    },
    {
      id: 'title_reputation_drift',
      text: 'reputation drifts on the books',
      conditions: [
        { kind: 'pressureRising', pressureId: 'reputation_drift' },
      ],
    },
    {
      id: 'title_rent_due_soon',
      text: 'rent week looms tomorrow',
      conditions: [
        { kind: 'hasTag', tag: 'rent_due_soon' },
      ],
    },
    {
      id: 'title_high_severity',
      text: 'a hard month to close',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
  ],
}
