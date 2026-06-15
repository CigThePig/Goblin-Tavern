// Phase 4b (teleology) — voiced labels for the staff_arc card's two
// acknowledgement choices. Gated on `responseVerb` (the arc seed emits a
// `promote` "mark the milestone" slot and a `delay` "let them be" slot).
// Optional synthetic slot — an unmatched verb falls back to the sim's
// verbatim `slot.labelHint`. ≤ 6 words.

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    {
      id: 'label_mark',
      text: "Mark how far they've come",
      conditions: [{ kind: 'responseVerb', anyOf: ['promote'] }],
    },
    {
      id: 'label_let_be',
      text: 'Let them find their own way',
      conditions: [{ kind: 'responseVerb', anyOf: ['delay'] }],
    },
  ],
}
