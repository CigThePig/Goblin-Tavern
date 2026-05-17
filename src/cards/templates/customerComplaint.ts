// Complaint template — a regular has something to say. Centres the card
// on the named complainant when one is supplied via `namedEntities`.
// Mirrors cards-contract §7 Template 2.

import {
  buildBody,
  buildChoicesFromSeed,
  buildStakes,
  familyTag,
  formatTitle,
  makeCardView,
} from '../cardHelpers'
import type { CardDefinition } from '../types'

export const customerComplaintCard: CardDefinition = {
  id: 'customer_complaint.complaint.relational',
  appliesTo: {
    seedFamilies: ['customer_complaint', 'regular_customer'],
    seedTypes: ['complaint'],
    timings: ['during_service', 'closing'],
  },
  priority: 70,
  toneHints: ['personal'],
  render: (seed, state) => {
    const ti = seed.textIngredients
    const namedRegular = ti.namedEntities?.find((n) => n.role === 'complainant')
      ?? ti.namedEntities?.[0]
    const regularRef = namedRegular?.ref
    const regular =
      regularRef?.kind === 'regular'
        ? state.world.regulars[regularRef.id]
        : undefined
    const display = regular?.name.display ?? namedRegular?.displayName ?? 'A patron'

    const firstOpinionKey = Object.keys(ti.actorOpinions)[0]
    const firstOpinion = firstOpinionKey ? ti.actorOpinions[firstOpinionKey] : undefined

    const subject = ti.problemNoun ?? ti.subject

    return makeCardView({
      title: formatTitle([`${display}:`, subject]),
      body: buildBody([
        firstOpinion ?? ti.sensoryDetails[0],
        ti.relevantMemories?.[0],
        ti.recentContext[0],
      ]),
      stakes: buildStakes(seed, 2),
      choices: buildChoicesFromSeed(seed, {
        // Relational cards favour "appease" / "delegate" if available;
        // when the slot doesn't allow those, fall through to whatever is.
        filter: (slot) =>
          slot.allowedVerbs.some((v) => v === 'appease' || v === 'delegate')
          || seed.responseSlots.every(
            (s) => !s.allowedVerbs.some((v) => v === 'appease' || v === 'delegate'),
          ),
        overrides: () => ({
          ...(regularRef?.id ? { targetId: regularRef.id } : {}),
          maxPreview: 2,
        }),
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}
