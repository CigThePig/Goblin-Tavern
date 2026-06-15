// Phase 4b (teleology) — optional sensory beat for the staff_arc card.
// Narrator-voiced gesture/scene notes. Optional slot (silence beats weak
// copy), so it carries both stage-gated beats and a couple of
// unconditional fillers so the body usually fires a third line. ≤ 10 words.

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'mnr_apprentice',
      text: 'They watch the older hands a little longer now.',
      conditions: [{ kind: 'hasTag', tag: 'stage:apprentice' }],
    },
    {
      id: 'mnr_journeyman',
      text: 'Their movements at the work have lost their hesitation.',
      conditions: [{ kind: 'hasTag', tag: 'stage:journeyman' }],
    },
    {
      id: 'mnr_proven',
      text: 'Others have started to take their lead.',
      conditions: [{ kind: 'hasTag', tag: 'proven' }],
    },
    {
      id: 'mnr_mild_floor',
      text: 'The work goes on around them all the same.',
      conditions: [],
      specificity: 0,
    },
    {
      id: 'mnr_mild_light',
      text: 'Morning light falls across the same worn boards.',
      conditions: [],
      specificity: 0,
    },
  ],
}
