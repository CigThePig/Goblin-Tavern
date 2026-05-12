import type { SimContext } from '../../../core/context'
import type { EntityRef } from '../../../state/TavernState'
import type { PressureCalculationResult, PressureCauseRef } from '../pressureTypes'

import {
  combineToValue,
  pushCause,
  severityFromValue,
  urgencyFromSeverity,
} from './helpers'
import {
  gratitudeStrengthAgainst,
  memoryStrengthForOwnerByTags,
} from './expandedHelpers'

// Phase 38 §38.4 — Regular customer loss pressure.

const IRRITATION_PER_REGULAR = 0.3
const LOW_LOYALTY_PER_REGULAR = 6
const IGNORED_COMPLAINT_DIVISOR = 8
const BAD_AREA_REPUTATION_DIVISOR = 12
const LOW_SATISFACTION_PER_GROUP = 5
const GRATITUDE_RELIEF_DIVISOR = 10

export function calculateRegularCustomerLoss(
  ctx: SimContext,
): PressureCalculationResult {
  const causes: PressureCauseRef[] = []
  const relatedActors: EntityRef[] = []
  const seen = new Set<string>()
  const pushActor = (ref: EntityRef) => {
    const key = `${ref.kind}:${ref.id}`
    if (seen.has(key)) return
    seen.add(key)
    relatedActors.push(ref)
  }

  const regulars = Object.values(ctx.state.world.regulars)

  if (regulars.length > 0) {
    let irritationSum = 0
    let lowLoyaltyCount = 0
    for (const regular of regulars) {
      irritationSum += regular.irritation
      if (regular.loyalty <= 35) lowLoyaltyCount += 1
    }
    const avgIrritation = irritationSum / regulars.length
    if (avgIrritation >= 25) {
      pushCause(causes, {
        id: 'avg_irritation',
        readable: `Average regular irritation ${Math.round(avgIrritation)}.`,
        amount: Math.round(avgIrritation * IRRITATION_PER_REGULAR),
        tags: ['regulars', 'irritation'],
        relatedSystems: ['regulars'],
      })
    }
    if (lowLoyaltyCount > 0) {
      pushCause(causes, {
        id: 'low_loyalty_regulars',
        readable: `${lowLoyaltyCount} regular(s) with low loyalty.`,
        amount: LOW_LOYALTY_PER_REGULAR * lowLoyaltyCount,
        tags: ['regulars', 'loyalty'],
        relatedSystems: ['regulars'],
      })
    }
  }

  for (const regular of regulars) {
    const ref: EntityRef = { kind: 'regular', id: regular.id }
    const ignoredMem = memoryStrengthForOwnerByTags(ctx, ref, ['ignored_complaint'])
    if (ignoredMem >= 20) {
      pushActor(ref)
      pushCause(causes, {
        id: `ignored_${regular.id}`,
        readable: `${regular.name.display} remembers ignored complaints (strength ${Math.round(ignoredMem)}).`,
        amount: Math.round(ignoredMem / IGNORED_COMPLAINT_DIVISOR),
        tags: ['regular', 'memory', 'ignored'],
        relatedActors: [ref],
        relatedSystems: ['regulars', 'memories'],
      })
    }
    const gratitude = gratitudeStrengthAgainst(ctx.state, ref)
    const favoriteMem = memoryStrengthForOwnerByTags(ctx, ref, ['favorite_order'])
    if (gratitude + favoriteMem >= 30) {
      pushActor(ref)
      pushCause(causes, {
        id: `gratitude_${regular.id}`,
        readable: `${regular.name.display} feels valued (relief ${Math.round(gratitude + favoriteMem)}).`,
        amount: -Math.round((gratitude + favoriteMem) / GRATITUDE_RELIEF_DIVISOR),
        tags: ['regular', 'relief'],
        relatedActors: [ref],
        relatedSystems: ['regulars', 'memories'],
      })
    }
  }

  for (const area of Object.values(ctx.state.areas)) {
    const ref: EntityRef = { kind: 'area', id: area.id }
    const badRep = memoryStrengthForOwnerByTags(ctx, ref, ['bad_reputation'])
    if (badRep >= 30) {
      pushCause(causes, {
        id: `area_bad_rep_${area.id}`,
        readable: `${area.id} has bad-reputation memories (${Math.round(badRep)}).`,
        amount: Math.round(badRep / BAD_AREA_REPUTATION_DIVISOR),
        tags: ['area', 'reputation'],
        relatedLocations: [ref],
        relatedSystems: ['areas', 'memories'],
      })
    }
  }

  let lowSatGroups = 0
  for (const group of Object.values(ctx.state.customerGroups)) {
    if (group.satisfaction <= 35 && group.patronage >= 20) lowSatGroups += 1
  }
  if (lowSatGroups > 0) {
    pushCause(causes, {
      id: 'low_group_satisfaction',
      readable: `${lowSatGroups} customer group(s) dissatisfied.`,
      amount: LOW_SATISFACTION_PER_GROUP * lowSatGroups,
      tags: ['customers', 'satisfaction'],
      relatedSystems: ['customers'],
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
    relatedActors,
    relatedSystems: ['regulars', 'customers', 'memories', 'areas'],
    tags: ['regulars', 'social'],
    consequences:
      severity >= 50
        ? [
            'Regulars may stop visiting.',
            'Reputation drift will rise.',
            'Customer complaint seeds become more likely.',
          ]
        : [],
  }
}
