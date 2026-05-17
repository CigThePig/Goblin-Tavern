// Warning template — premises problem that will get worse. Always shows
// at least one delayed effect so the repair-or-pay-later tradeoff is
// legible. Mirrors cards-contract §7 Template 4.

import {
  pickAreaStateAdjective,
  type AreaConditionKey,
} from '../../sim/content/text/descriptors'
import type { AreaState } from '../../sim/state/TavernState'
import {
  buildBody,
  buildChoicesFromSeed,
  buildStakes,
  familyTag,
  formatTitle,
  makeCardView,
} from '../cardHelpers'
import type { CardDefinition } from '../types'

function pickAreaCondition(area: AreaState): AreaConditionKey {
  if (area.damage >= 50) return 'damaged'
  if (area.cleanliness <= 40) return 'dirty'
  if (area.smell >= 50) return 'smelly'
  if (area.risk >= 50) return 'risky'
  return 'clean'
}

export const maintenanceWarningCard: CardDefinition = {
  id: 'maintenance.warning.morning',
  appliesTo: {
    seedFamilies: ['maintenance', 'area_atmosphere'],
    seedTypes: ['warning', 'maintenance_problem'],
    timings: ['morning_prep'],
  },
  priority: 60,
  toneHints: ['premises', 'delayed_risk'],
  render: (seed, state) => {
    const ti = seed.textIngredients
    const areaRef = seed.location?.kind === 'area' ? seed.location : undefined
    const area = areaRef ? state.areas[areaRef.id] : undefined
    const adj = area ? pickAreaStateAdjective(pickAreaCondition(area), seed.id) : undefined

    return makeCardView({
      title: formatTitle(
        area ? [adj, `${area.label}:`, ti.subject] : [ti.subject],
      ),
      body: buildBody([
        ti.sensoryDetails[0],
        ti.pressureContext?.[0],
        ti.stakesReadable[0],
      ]),
      stakes: buildStakes(seed),
      choices: buildChoicesFromSeed(seed, {
        overrides: () => ({
          ...(areaRef?.id ? { targetId: areaRef.id } : {}),
          includeDelayed: true,
        }),
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}
