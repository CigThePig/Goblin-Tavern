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

    // Phase 18 repair: unconditional narrator beats at spec 0 so the
    // body fires SOMETHING when no state gate above matches.
    {
      id: 'mnr_mild_pen',
      text: 'The pen rests in the crease of the ledger.',
      conditions: [],
      specificity: 0,
    },
    {
      id: 'mnr_mild_lamp',
      text: 'The desk lamp burns lower than the room asks.',
      conditions: [],
      specificity: 0,
    },
    {
      id: 'mnr_mild_quiet',
      text: 'The back office sits quiet around the figures.',
      conditions: [],
      specificity: 0,
    },
  ],
}
