import type { SimContext } from '../../../core/context'
import type { PressureCalculationResult, PressureCauseRef } from '../pressureTypes'

import {
  combineToValue,
  pushCause,
  severityFromValue,
  urgencyFromSeverity,
} from './helpers'
import { getAttributions, totalMemoryStrengthByTags } from './expandedHelpers'

// Phase 38 §38.11 — Rumour pressure.

const RUMOUR_PER_STRENGTH = 0.3
const FALSE_RUMOUR_BONUS = 0.2
const PUBLIC_ATTRIBUTION_DIVISOR = 12
const FALSE_BLAME_MEMORY_DIVISOR = 10
const REPUTATION_DRIFT_DIVISOR = 10
const FACTION_ANGER_DIVISOR = 12

export function calculateRumourPressure(
  ctx: SimContext,
): PressureCalculationResult {
  const causes: PressureCauseRef[] = []

  // Social rumours.
  let totalStrength = 0
  let falseStrength = 0
  for (const rumour of Object.values(ctx.state.world.socialRumours)) {
    totalStrength += rumour.strength
    if (rumour.accuracy === 'false' || rumour.accuracy === 'partial') {
      falseStrength += rumour.strength
    }
  }
  if (totalStrength > 0) {
    pushCause(causes, {
      id: 'active_rumours',
      readable: `Active rumours total strength ${Math.round(totalStrength)}.`,
      amount: Math.round(totalStrength * RUMOUR_PER_STRENGTH),
      tags: ['rumour'],
      relatedSystems: ['rumours'],
    })
  }
  if (falseStrength >= 20) {
    pushCause(causes, {
      id: 'false_rumours',
      readable: `False or partial rumours circulating (strength ${Math.round(falseStrength)}).`,
      amount: Math.round(falseStrength * FALSE_RUMOUR_BONUS),
      tags: ['rumour', 'false'],
      relatedSystems: ['rumours'],
    })
  }

  // Highly public attributions amplify rumours.
  let publicAttributionScore = 0
  for (const attribution of getAttributions(ctx.state)) {
    if (attribution.publicness >= 60) {
      publicAttributionScore += (attribution.publicness * attribution.strength) / 100
    }
  }
  if (publicAttributionScore >= 30) {
    pushCause(causes, {
      id: 'public_attributions',
      readable: `Highly public attributions (strength ${Math.round(publicAttributionScore)}).`,
      amount: Math.round(publicAttributionScore / PUBLIC_ATTRIBUTION_DIVISOR),
      tags: ['attribution', 'public'],
      relatedSystems: ['attribution'],
    })
  }

  // False blame memories.
  const falseBlame = totalMemoryStrengthByTags(ctx, ['false_blame'])
  if (falseBlame >= 25) {
    pushCause(causes, {
      id: 'false_blame_memories',
      readable: `False-blame memories (strength ${Math.round(falseBlame)}).`,
      amount: Math.round(falseBlame / FALSE_BLAME_MEMORY_DIVISOR),
      tags: ['memory', 'false_blame'],
      relatedSystems: ['memories'],
    })
  }

  // Reputation drift and faction anger amplify.
  const repDrift = ctx.state.pressures['reputation_drift']
  if (repDrift && repDrift.value >= 35) {
    pushCause(causes, {
      id: 'rep_drift_amplifies',
      readable: `Reputation drift (${repDrift.value}) makes rumours stick.`,
      amount: Math.round(repDrift.value / REPUTATION_DRIFT_DIVISOR),
      tags: ['reputation', 'web'],
      relatedSystems: ['reputation', 'pressures'],
    })
  }
  const factionAnger = ctx.state.pressures['faction_anger']
  if (factionAnger && factionAnger.value >= 30) {
    pushCause(causes, {
      id: 'faction_anger_amplifies',
      readable: `Faction anger (${factionAnger.value}) seeds rumours.`,
      amount: Math.round(factionAnger.value / FACTION_ANGER_DIVISOR),
      tags: ['faction', 'web'],
      relatedSystems: ['factions', 'pressures'],
    })
  }

  const value = combineToValue(0, causes)
  const severity = severityFromValue(value)
  const urgency = urgencyFromSeverity(severity)

  return {
    value,
    severity,
    urgency,
    causes,
    relatedSystems: ['rumours', 'attribution', 'memories'],
    tags: ['rumour', 'social'],
    consequences:
      severity >= 40
        ? [
            'Reputation shift seeds become likely.',
            'False accusation seeds may appear.',
            'Apology / social-action response slots open up.',
          ]
        : [],
  }
}
