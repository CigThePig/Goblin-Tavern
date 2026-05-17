// Phase 88 — Catch-all card.
//
// Ensures every valid seed surfaces with something the player can play.
// The 8 starter templates cover the high-traffic archetypes; everything
// else (the long tail of expanded families, low-severity warnings,
// arc milestones with no dedicated template yet) routes here.
//
// The fallback is the lowest-priority card. The selection algorithm
// only picks it when nothing else applies, but `pickCard` looks it up
// by id rather than re-running selection — keeping it priority -1 just
// documents that intent for future readers.

import { pickSeverityAdjective } from '../../sim/content/text/descriptors'
import {
  buildBody,
  buildChoicesFromSeed,
  buildStakes,
  familyTag,
  formatTitle,
  makeCardView,
} from '../cardHelpers'
import type { CardDefinition } from '../types'

export const FALLBACK_CARD_ID = 'fallback.everySeed'

export const fallbackCard: CardDefinition = {
  id: FALLBACK_CARD_ID,
  appliesTo: {
    // Empty constraints = matches every seed (selection algorithm
    // confirms with all-fields-undefined → true). Priority below 0
    // keeps it last after the registered templates.
  },
  priority: -1,
  toneHints: ['neutral'],
  render: (seed) => {
    const ti = seed.textIngredients
    const adj = pickSeverityAdjective(seed.severity, seed.id)
    return makeCardView({
      title: formatTitle([adj, ti.subject || seed.family]),
      body: buildBody([
        ti.sensoryDetails[0],
        ti.recentContext[0],
        ti.pressureContext?.[0] ?? ti.stakesReadable[0],
      ]),
      stakes: buildStakes(seed),
      choices: buildChoicesFromSeed(seed),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}
