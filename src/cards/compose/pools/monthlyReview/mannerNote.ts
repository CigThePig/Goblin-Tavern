// Phase 140 / ISSUE-109 — Voiced Surface arc, Phase 14 (Periodic & Narrative Beats).
//
// Optional third-person sensory beat for the monthly_review template —
// the lamp, the ledger, the desk, the coin stack at month's end.
// Narrator-voiced; gated on prior monthly memories, calendar tags, and
// severity (no actor axes).

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'mnr_rent_due_soon',
      text: 'A landlord note sits weighted under the lamp base.',
      conditions: [
        { kind: 'hasTag', tag: 'rent_due_soon' },
      ],
    },
    {
      id: 'mnr_high_severity',
      text: 'The coin stack looks shorter today by a wide measure.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'mnr_rent_memory',
      text: 'Last month rent paid is circled twice in the margin.',
      conditions: [
        { kind: 'memoryPresent', tag: 'rent' },
      ],
    },
    {
      id: 'mnr_cellar_memory',
      text: 'A cellar entry from before still earns a slow nod.',
      conditions: [
        { kind: 'memoryPresent', tag: 'cellar' },
      ],
    },
    {
      id: 'mnr_monthly_repeat',
      text: 'Three months of the same shortfall mark the page.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'monthly', atLeast: 3 },
      ],
    },

    // Phase 18 repair: spec-0 unconditional fillers so the body fires.
    {
      id: 'mnr_mild_lamp',
      text: 'The desk lamp throws long shadows across the page.',
      conditions: [],
      specificity: 0,
    },
    {
      id: 'mnr_mild_pen',
      text: 'The pen rests in the crease of the ledger.',
      conditions: [],
      specificity: 0,
    },
    {
      id: 'mnr_mild_chair',
      text: 'The chair creaks as you settle to the work.',
      conditions: [],
      specificity: 0,
    },

    // ─── Phase 156 / ISSUE-124 — state-keyed manner beats ───────────
    // Spec-1 / spec-2 narrator sensory beats tied to monthly_review
    // state. Flavor slot (history-claim detector active).
    {
      id: 'mnr_rival_memory',
      text: 'A rival-house entry is circled twice in the ledger margin.',
      conditions: [
        { kind: 'memoryPresent', tag: 'rival' },
      ],
    },
    {
      id: 'mnr_debt_landlord_dual',
      text: 'Two columns of the page have both thinned tonight.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'debt' },
        { kind: 'pressureRising', pressureId: 'landlord' },
      ],
    },
    {
      id: 'mnr_customer_complaint',
      text: 'A small stack of complaint notes leans beside the lamp.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'customer_complaint' },
      ],
    },
  ],
}
