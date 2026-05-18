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
//
// Phase 95 — Voice pass. Fallback still uses neutral tone but folds in
// any tones the seed itself emitted so the long-tail families read with
// at least some flavour.

import { pickSeverityAdjective } from '../../sim/content/text/descriptors'
import {
  buildChoicesFromSeed,
  buildStakes,
  familyTag,
  makeCardView,
} from '../cardHelpers'
import { composeBody, composeTitle, type ComposeOpts } from '../voice/index'
import type { CardDefinition } from '../types'

export const FALLBACK_CARD_ID = 'fallback.everySeed'

const DEFINITION_TONES = ['neutral'] as const

export const fallbackCard: CardDefinition = {
  id: FALLBACK_CARD_ID,
  appliesTo: {
    // Empty constraints = matches every seed (selection algorithm
    // confirms with all-fields-undefined → true). Priority below 0
    // keeps it last after the registered templates.
  },
  priority: -1,
  toneHints: [...DEFINITION_TONES],
  render: (seed) => {
    const ti = seed.textIngredients
    const adj = pickSeverityAdjective(seed.severity, seed.id)
    const opts: ComposeOpts = {
      toneHints: [...seed.toneHints, ...DEFINITION_TONES],
      key: seed.id,
    }
    return makeCardView({
      title: composeTitle([adj, ti.subject || seed.family], opts),
      body: composeBody(
        [
          ti.sensoryDetails[0],
          ti.recentContext[0],
          ti.pressureContext?.[0] ?? ti.stakesReadable[0],
        ],
        opts,
      ),
      stakes: buildStakes(seed),
      choices: buildChoicesFromSeed(seed),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}
