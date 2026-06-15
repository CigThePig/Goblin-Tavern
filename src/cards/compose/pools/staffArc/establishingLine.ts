// Phase 4b (teleology) — establishing line for the staff_arc card.
//
// Narrator-voiced body line that names the character's current point on
// their trajectory. The arc seed flows its LIVE stage through
// `seed.toneHints` (`stage:apprentice` / `stage:journeyman` /
// `stage:steady`, plus `proven`), read here by `hasTag` — so the line
// always reads the entry's real milestone, never a hardcoded stage. Flavor
// slot: no invented names, roles, history, or felt-state claims. ≤ 14 words.

import type { SnippetPool } from '../../types'

export const establishingLinePool: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    {
      id: 'est_fallback',
      text: 'A character at the tavern is growing into who they will become.',
      conditions: [],
    },
    {
      id: 'est_apprentice',
      text: 'An apprentice is still learning the rhythm of the room.',
      conditions: [{ kind: 'hasTag', tag: 'stage:apprentice' }],
    },
    {
      id: 'est_journeyman',
      text: 'A journeyman now carries the work with real confidence.',
      conditions: [{ kind: 'hasTag', tag: 'stage:journeyman' }],
    },
    {
      id: 'est_steady',
      text: 'A steady hand has settled into a dependable place here.',
      conditions: [{ kind: 'hasTag', tag: 'stage:steady' }],
    },
    {
      // Top rung: two seed-shape conditions for the proven journeyman who
      // is closing on mastery.
      id: 'est_proven_journeyman',
      text: 'A proven journeyman is close to mastering the craft entirely.',
      conditions: [
        { kind: 'hasTag', tag: 'stage:journeyman' },
        { kind: 'hasTag', tag: 'proven' },
      ],
    },
  ],
}
