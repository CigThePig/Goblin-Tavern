// Phase 4b (teleology) — title pool for the staff_arc compositional card.
//
// The template renders the title as `${arcLabel}: ${snippet}` (the
// rivalTavern / seasonalArc pattern) — the arc's stored label anchors the
// character; the snippet contextualises the current stage. Narrator-voiced
// (the seed's primaryActor is a `system` ref `arc:<id>`, which carries no
// castAttributes), so snippets gate only on the seed's live stage tags,
// never on actor voice. All ≤ 6 words; no trailing "…", no duplicate token.

import type { SnippetPool } from '../../types'

export const titlePool: SnippetPool = {
  slotId: 'title',
  snippets: [
    {
      id: 'title_fallback',
      text: 'a path takes its shape',
      conditions: [],
    },
    {
      id: 'title_apprentice',
      text: 'the apprentice finds their feet',
      conditions: [{ kind: 'hasTag', tag: 'stage:apprentice' }],
    },
    {
      id: 'title_journeyman',
      text: 'a journeyman comes into their own',
      conditions: [{ kind: 'hasTag', tag: 'stage:journeyman' }],
    },
    {
      id: 'title_steady',
      text: 'a steady hand settles in',
      conditions: [{ kind: 'hasTag', tag: 'stage:steady' }],
    },
    {
      id: 'title_proven',
      text: 'they have proven themselves',
      conditions: [{ kind: 'hasTag', tag: 'proven' }],
    },
  ],
}
