// Monthly-review template — surfaces top pressures so the player reads
// the month, then offers any strategic choices the seed presents.
// Mirrors cards-contract §7 Template 8.

import {
  buildBody,
  buildChoicesFromSeed,
  buildStakes,
  familyTag,
  formatTitle,
  makeCardView,
} from '../cardHelpers'
import type { CardDefinition } from '../types'

export const monthlyReviewCard: CardDefinition = {
  id: 'monthly_review.strategic',
  appliesTo: {
    seedFamilies: ['monthly_review'],
    seedTypes: ['monthly_review'],
    timings: ['end_month'],
  },
  priority: 40,
  toneHints: ['strategic', 'reflective'],
  render: (seed, state) => {
    const ti = seed.textIngredients
    const topPressures = Object.values(state.pressures)
      .filter((p) => p.value >= 40)
      .slice()
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)

    return makeCardView({
      title: formatTitle(['Month in review:', ti.subject]),
      body: buildBody([
        ti.calendarContext?.[0],
        ...topPressures.map(
          (p) => `${p.label} ${p.value} (${p.trend >= 0 ? '+' : ''}${p.trend})`,
        ),
      ]),
      stakes: buildStakes(seed),
      choices: buildChoicesFromSeed(seed, {
        overrides: () => ({ includeDelayed: true }),
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}
