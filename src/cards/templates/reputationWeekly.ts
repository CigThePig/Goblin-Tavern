// End-of-week reputation-shift template — reads recent causes to explain
// the trend. Mirrors cards-contract §7 Template 7.

import type { CauseEntry, TavernState } from '../../sim/state/TavernState'
import {
  buildBody,
  buildChoicesFromSeed,
  buildStakes,
  familyTag,
  formatTitle,
  makeCardView,
} from '../cardHelpers'
import type { CardDefinition } from '../types'

function topCausesForReputationAxis(
  state: TavernState,
  axis: string,
  limit: number,
): CauseEntry[] {
  return state.causes
    .filter((c) => c.targetType === 'reputation' && c.target.endsWith(axis))
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
}

export const reputationShiftWeeklyCard: CardDefinition = {
  id: 'reputation_shift.weekly',
  appliesTo: {
    seedFamilies: ['reputation_shift'],
    seedTypes: ['reputation_shift'],
    timings: ['end_week'],
  },
  priority: 55,
  toneHints: ['reflective'],
  render: (seed, state) => {
    const ti = seed.textIngredients
    const axisTag = seed.domain.find((d) => d.startsWith('reputation.'))
    const axis = axisTag?.split('.')[1] ?? 'reputable'
    const topCauses = topCausesForReputationAxis(state, axis, 2)

    return makeCardView({
      title: formatTitle(['Weekly shift:', ti.subject]),
      body: buildBody([ti.recentContext[0], ...topCauses.map((c) => c.readable)]),
      stakes: buildStakes(seed, 2),
      choices: buildChoicesFromSeed(seed, { overrides: () => ({ maxPreview: 2 }) }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}
