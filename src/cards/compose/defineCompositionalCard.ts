// Phase 123 / ISSUE-092 — Living Cast arc, Phase C.
//
// The factory that turns a `CompositionalCardTemplate` into the existing
// `CardDefinition` shape (framework §2.5). The registry, selection
// algorithm, and renderer never learn that compositional cards exist —
// they consume `CardDefinition`s, and a wrapped template IS one.
//
// Migration is per-template and non-breaking: `REQUIRED_CARDS` can hold
// hand-written templates next to compositional templates indefinitely.
// Phase C only flips one template; the other eight stay hand-written
// until later phases migrate them individually.

import type { CardDefinition } from '../types'
import { withCardContext } from '../cardHelpers'
import { assembleSlots } from './assemble'
import type { CompositionalCardTemplate } from './types'

export function defineCompositionalCard(
  template: CompositionalCardTemplate,
): CardDefinition {
  const definition: CardDefinition = {
    id: template.id,
    appliesTo: template.appliesTo,
    toneHints: [template.voiceRegister],
    render: (seed, state) => {
      const filled = assembleSlots(template.slots, seed, state)
      return withCardContext(
        template.toCardView(filled, seed, state),
        seed,
        state,
      )
    },
  }
  if (template.priority !== undefined) definition.priority = template.priority
  return definition
}
