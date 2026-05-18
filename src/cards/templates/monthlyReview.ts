// Monthly-review template — surfaces top pressures so the player reads
// the month, then offers any strategic choices the seed presents.
// Mirrors cards-contract §7 Template 8.
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

const DEFINITION_TONES = ['strategic', 'reflective', 'summary', 'monthly'] as const

export const monthlyReviewCard: CardDefinition = {
  id: 'monthly_review.strategic',
  appliesTo: {
    seedFamilies: ['monthly_review'],
    seedTypes: ['monthly_review'],
    timings: ['end_month'],
  },
  priority: 40,
  toneHints: [...DEFINITION_TONES],
  render: (seed, state) => {
    const ti = seed.textIngredients
    const topPressures = Object.values(state.pressures)
      .filter((p) => p.value >= 40)
      .slice()
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)

    const opts: ComposeOpts = {
      toneHints: [...DEFINITION_TONES, ...seed.toneHints],
      key: seed.id,
    }

    return makeCardView({
      title: composeTitle(['Month in review:', ti.subject], opts),
      body: composeBody(
        [
          ti.calendarContext?.[0],
          ...topPressures.map(
            (p) => `${p.label} ${p.value} (${p.trend >= 0 ? '+' : ''}${p.trend})`,
          ),
        ],
        opts,
      ),
      stakes: buildStakes(seed),
      choices: buildChoicesFromSeed(seed, {
        overrides: () => ({ includeDelayed: true }),
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}
