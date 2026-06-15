// Phase 4b (teleology) — effect-preview lines for the staff_arc card.
//
// Both arc choices carry a single `cause`-kind effect (the arc advances on
// its own; the choices only record the owner's reaction). Cause effects
// carry no player-facing magnitude — the legibility magnitude / meter /
// cost / risk rules all skip `cause` — so these snippets only need to give
// each choice a distinct, readable line. Gated on the cause's `effectTag`
// so the two choices never collapse to the same line. ≤ 10 words.

import type { SnippetPool } from '../../types'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    {
      // The "let them be" choice carries a `quiet` tag — higher
      // specificity so it reliably wins over the shared `staff_arc` tag.
      id: 'pre_quiet',
      text: 'The moment would pass without a word',
      specificity: 2,
      conditions: [{ kind: 'effectTag', tag: 'quiet' }],
    },
    {
      id: 'pre_recognise',
      text: 'The growth would be quietly noted',
      conditions: [{ kind: 'effectTag', tag: 'staff_arc' }],
    },
  ],
}
