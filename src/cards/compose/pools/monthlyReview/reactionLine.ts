// Phase 140 / ISSUE-109 — Voiced Surface arc, Phase 14 (Periodic & Narrative Beats).
//
// Flavor reaction line for the monthly_review compositional template.
// Narrator-voiced — owner-at-the-ledger third-person register matching
// debtRent. No first-person address, no character voice (the month has
// no actor). Gated on `hasTag` (the seed's domain ∪ toneHints — `monthly`,
// `summary`, `rent_due_soon`, `economy`, `reputation`),
// `severityAtLeast`, and prior monthly memories.

import type { SnippetPool } from '../../types'

export const reactionLinePool: SnippetPool = {
  slotId: 'reaction_line',
  snippets: [
    {
      id: 'rxn_fallback',
      text: 'The month asks what the till can spare ahead.',
      conditions: [],
    },

    {
      id: 'rxn_rent_due_soon',
      text: 'Rent week sits inside the very next pass of the calendar.',
      conditions: [
        { kind: 'hasTag', tag: 'rent_due_soon' },
      ],
    },
    {
      id: 'rxn_high_severity',
      text: 'The shortfall will not soften on its own from here.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },

    {
      id: 'rxn_rent_memory',
      text: 'Last month closed clean; this one leans noticeably harder.',
      conditions: [
        { kind: 'memoryPresent', tag: 'rent' },
      ],
    },
    {
      id: 'rxn_reserves_memory',
      text: 'The reserves held last month are thinner reading today.',
      conditions: [
        { kind: 'memoryPresent', tag: 'reserves' },
      ],
    },
    {
      id: 'rxn_landlord_memory',
      text: 'The landlord will be back at the door before long.',
      conditions: [
        { kind: 'memoryPresent', tag: 'landlord' },
      ],
    },
    {
      id: 'rxn_cellar_memory',
      text: 'The cellar investment from before is showing in the ledger.',
      conditions: [
        { kind: 'memoryPresent', tag: 'cellar' },
      ],
    },
    {
      id: 'rxn_rival_memory',
      text: 'The settlement with the rival from before still echoes here.',
      conditions: [
        { kind: 'memoryPresent', tag: 'rival' },
      ],
    },
    {
      id: 'rxn_review_memory',
      text: 'The earlier month already asked this same hard question.',
      conditions: [
        { kind: 'memoryPresent', tag: 'review' },
      ],
    },
  ],
}
