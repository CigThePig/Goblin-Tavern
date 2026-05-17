// Crisis template — immediate, high-severity floor-safety situation.
// Mirrors cards-contract §7 Template 1 (foodSafetyCrisisCard).

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

export const foodSafetyCrisisCard: CardDefinition = {
  id: 'food_safety.crisis.serviceFloor',
  appliesTo: {
    seedFamilies: ['food_safety'],
    seedTypes: ['crisis'],
    timings: ['during_service'],
    minSeverity: 60,
  },
  priority: 90,
  toneHints: ['urgent', 'visceral'],
  render: (seed) => {
    const adj = pickSeverityAdjective(seed.severity, seed.id)
    const ti = seed.textIngredients
    return makeCardView({
      title: formatTitle([adj, ti.subject]),
      body: buildBody([ti.sensoryDetails[0], ti.recentContext[0], ti.stakesReadable[0]]),
      stakes: buildStakes(seed),
      choices: buildChoicesFromSeed(seed),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}
