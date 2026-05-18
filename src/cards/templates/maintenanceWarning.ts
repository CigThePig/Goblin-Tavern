// Warning template — premises problem that will get worse. Always shows
// at least one delayed effect so the repair-or-pay-later tradeoff is
// legible. Mirrors cards-contract §7 Template 4.
//
// Phase 95 — Voice pass.

import {
  pickAreaStateAdjective,
  type AreaConditionKey,
} from '../../sim/content/text/descriptors'
import type { AreaState } from '../../sim/state/TavernState'
import {
  buildChoicesFromSeed,
  buildStakes,
  familyTag,
  makeCardView,
} from '../cardHelpers'
import { composeBody, composeTitle, type ComposeOpts } from '../voice/index'
import type { CardDefinition } from '../types'

const DEFINITION_TONES = ['premises', 'delayed_risk', 'maintenance'] as const

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
  toneHints: [...DEFINITION_TONES],
  render: (seed, state) => {
    const ti = seed.textIngredients
    const areaRef = seed.location?.kind === 'area' ? seed.location : undefined
    const area = areaRef ? state.areas[areaRef.id] : undefined
    const adj = area ? pickAreaStateAdjective(pickAreaCondition(area), seed.id) : undefined

    const opts: ComposeOpts = {
      toneHints: [...DEFINITION_TONES, ...seed.toneHints],
      key: seed.id,
    }

    return makeCardView({
      title: composeTitle(
        area ? [adj, `${area.label}:`, ti.subject] : [ti.subject],
        opts,
      ),
      body: composeBody(
        [ti.sensoryDetails[0], ti.pressureContext?.[0], ti.stakesReadable[0]],
        opts,
      ),
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
