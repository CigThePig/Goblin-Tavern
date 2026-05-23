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
  ],
}
