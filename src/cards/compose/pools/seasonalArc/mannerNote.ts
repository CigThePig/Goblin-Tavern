// Phase 140 / ISSUE-109 — Voiced Surface arc, Phase 14 (Periodic & Narrative Beats).
//
// Optional third-person sensory beat for the seasonal_arc template —
// the flags, the crowd-edge, the boards, the morning light over the
// row. Narrator-voiced; gated on themes, prior arc memories, and
// severity (no actor axes).

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'mnr_festival',
      text: 'Flags above the row are already half-raised this morning.',
      conditions: [
        { kind: 'hasTag', tag: 'festival_approaching' },
      ],
    },
    {
      id: 'mnr_payday',
      text: 'The miner road is louder than the rest tonight.',
      conditions: [
        { kind: 'hasTag', tag: 'miner_payday_boom' },
      ],
    },
    {
      id: 'mnr_inspection',
      text: 'Pail handles clatter from every back door on the street.',
      conditions: [
        { kind: 'hasTag', tag: 'inspection_campaign' },
      ],
    },
    {
      id: 'mnr_high_severity',
      text: 'The whole row is on the same edge of attention.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'mnr_arc_memory',
      text: 'A faded earlier-arc notice still clings to the wall.',
      conditions: [
        { kind: 'memoryPresent', tag: 'arc' },
      ],
    },

    // Phase 18 repair: spec-0 unconditional fillers so the body fires.
    {
      id: 'mnr_mild_row',
      text: 'A neighbour leans out to glance down the row.',
      conditions: [],
      specificity: 0,
    },
    {
      id: 'mnr_mild_light',
      text: 'The morning light catches the dust above the bar.',
      conditions: [],
      specificity: 0,
    },
    {
      id: 'mnr_mild_quiet',
      text: 'The street has its own slow weather today.',
      conditions: [],
      specificity: 0,
    },
  ],
}
