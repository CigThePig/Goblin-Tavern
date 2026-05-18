// Complaint template — a regular has something to say. Centres the card
// on the named complainant when one is supplied via `namedEntities`.
// Mirrors cards-contract §7 Template 2.
//
// Phase 95 — Voice pass.

import {
  buildChoicesFromSeed,
  buildStakes,
  familyTag,
  makeCardView,
} from '../cardHelpers'
import { composeBody, composeTitle, type ComposeOpts } from '../voice/index'
import type { CardDefinition } from '../types'

const DEFINITION_TONES = ['personal', 'customer'] as const

export const customerComplaintCard: CardDefinition = {
  id: 'customer_complaint.complaint.relational',
  appliesTo: {
    seedFamilies: ['customer_complaint', 'regular_customer'],
    seedTypes: ['complaint'],
    timings: ['during_service', 'closing'],
  },
  priority: 70,
  toneHints: [...DEFINITION_TONES],
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

    const opts: ComposeOpts = {
      toneHints: [...DEFINITION_TONES, ...seed.toneHints],
      key: seed.id,
    }

    return makeCardView({
      title: composeTitle([`${display}:`, subject], opts),
      body: composeBody(
        [
          firstOpinion ?? ti.sensoryDetails[0],
          ti.relevantMemories?.[0],
          ti.recentContext[0],
        ],
        opts,
      ),
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
