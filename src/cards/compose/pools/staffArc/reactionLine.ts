// Phase 4b (teleology) — flavor reaction line for the staff_arc card.
// Narrator register: the room's read of a character coming into themselves.
// Gated on the seed's live stage tags; no actor voice, no invented facts.
// ≤ 12 words.

import type { SnippetPool } from '../../types'

export const reactionLinePool: SnippetPool = {
  slotId: 'reaction_line',
  snippets: [
    {
      id: 'rxn_fallback',
      text: 'The room shapes the people who work inside it.',
      conditions: [],
    },
    {
      id: 'rxn_apprentice',
      text: 'The early days leave the deepest marks on a worker.',
      conditions: [{ kind: 'hasTag', tag: 'stage:apprentice' }],
    },
    {
      id: 'rxn_journeyman',
      text: 'Confidence like that quietly changes how the floor runs.',
      conditions: [{ kind: 'hasTag', tag: 'stage:journeyman' }],
    },
    {
      id: 'rxn_steady',
      text: 'Not every path climbs; some simply hold and endure.',
      conditions: [{ kind: 'hasTag', tag: 'stage:steady' }],
    },
    {
      id: 'rxn_proven',
      text: 'What they have shown will not be undone soon.',
      conditions: [{ kind: 'hasTag', tag: 'proven' }],
    },
  ],
}
