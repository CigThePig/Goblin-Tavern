// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Optional third-person sensory beat for the debt_rent template — the
// ledger, the coin stack, the desk, the door. Narrator-voiced; gated on
// prior-choice memories, calendar tags, and severity (no actor axes).

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'mnr_rent_due_soon',
      text: 'A note from the landlord lies open on the desk.',
      conditions: [
        { kind: 'hasTag', tag: 'rent_due_soon' },
      ],
    },
    {
      id: 'mnr_high_severity',
      text: 'The coin stack would not cover a wide hand.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'mnr_landlord_memory',
      text: 'The door has been watched for a knock all week.',
      conditions: [
        { kind: 'memoryPresent', tag: 'landlord' },
      ],
    },
    {
      id: 'mnr_debt_memory',
      text: 'The borrowed sum is circled twice in the margin.',
      conditions: [
        { kind: 'memoryPresent', tag: 'debt' },
      ],
    },
    {
      id: 'mnr_debt_repeat',
      text: 'Three months of the same shortfall mark the page.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'debt', atLeast: 3 },
      ],
    },
  ],
}
