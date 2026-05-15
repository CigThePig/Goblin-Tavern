import type { SimContext } from '../../../core/context'
import type { EntityRef } from '../../../state/TavernState'
import type { PressureCalculationResult, PressureCauseRef } from '../pressureTypes'

import {
  combineToValue,
  pushCause,
  severityFromValue,
  urgencyFromSeverity,
} from './helpers'
import { ownerPolicies, publicBlameStrengthForKind } from './expandedHelpers'

// Phase 38 §38.12 — Policy backlash pressure.

const ACTIVE_POLICIES_PER_POLICY = 4
const DISLIKE_PER_GROUP = 5
const REGULAR_IRRITATION_DIVISOR = 12
const TAVERN_BLAME_DIVISOR = 8

export function calculatePolicyBacklash(
  ctx: SimContext,
): PressureCalculationResult {
  const causes: PressureCauseRef[] = []
  const relatedActors: EntityRef[] = []

  const policies = Object.values(ownerPolicies(ctx.state))
  const activePolicies = policies.filter((p) => p.enabled)
  if (activePolicies.length === 0) {
    return {
      value: 0,
      severity: 0,
      urgency: 0,
      causes,
      relatedSystems: ['policies'],
      tags: ['policy', 'social'],
    }
  }

  pushCause(causes, {
    id: 'active_policies',
    readable: `${activePolicies.length} active owner policy/policies.`,
    amount: ACTIVE_POLICIES_PER_POLICY * activePolicies.length,
    tags: ['policy'],
    relatedSystems: ['policies'],
  })

  // Customer-group dislikes against policy tags.
  let dislikingGroups = 0
  const dislikingActors: EntityRef[] = []
  for (const group of Object.values(ctx.state.customerGroups)) {
    if (group.patronage < 25) continue
    for (const policy of activePolicies) {
      for (const tag of policy.tags) {
        if (group.dislikedTags.includes(tag)) {
          dislikingGroups += 1
          const ref: EntityRef = { kind: 'customer_group', id: group.id }
          relatedActors.push(ref)
          dislikingActors.push(ref)
          break
        }
      }
    }
  }
  if (dislikingGroups > 0) {
    pushCause(causes, {
      id: 'disliking_groups',
      readable: `${dislikingGroups} group/policy dislike pair(s).`,
      amount: DISLIKE_PER_GROUP * dislikingGroups,
      tags: ['customers', 'policy'],
      relatedActors: dislikingActors,
      relatedSystems: ['customers', 'policies'],
    })
  }

  // Regular irritation aggregate.
  const regulars = Object.values(ctx.state.world.regulars)
  if (regulars.length > 0) {
    let irritationSum = 0
    const irritatedRegularActors: EntityRef[] = []
    for (const reg of regulars) {
      irritationSum += reg.irritation
      if (reg.irritation >= 25) {
        const ref: EntityRef = { kind: 'regular', id: reg.id }
        irritatedRegularActors.push(ref)
      }
    }
    const avgIrritation = irritationSum / regulars.length
    if (avgIrritation >= 25) {
      for (const ref of irritatedRegularActors) relatedActors.push(ref)
      pushCause(causes, {
        id: 'regular_irritation',
        readable: `Average regular irritation ${Math.round(avgIrritation)}.`,
        amount: Math.round(avgIrritation / REGULAR_IRRITATION_DIVISOR) * 5,
        tags: ['regulars', 'irritation'],
        relatedActors: irritatedRegularActors,
        relatedSystems: ['regulars'],
      })
    }
  }

  // Blame attributions targeting the tavern identity / owner role.
  const tavernBlame =
    publicBlameStrengthForKind(ctx.state, 'tavern_identity') +
    publicBlameStrengthForKind(ctx.state, 'role')
  if (tavernBlame >= 25) {
    const tavernActor: EntityRef = {
      kind: 'tavern_identity',
      id: ctx.state.meta.tavernId,
    }
    relatedActors.push(tavernActor)
    pushCause(causes, {
      id: 'tavern_blame',
      readable: `Owner/tavern carries blame attributions (strength ${Math.round(tavernBlame)}).`,
      amount: Math.round(tavernBlame / TAVERN_BLAME_DIVISOR),
      tags: ['attribution', 'tavern'],
      relatedActors: [tavernActor],
      relatedSystems: ['attribution'],
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
    relatedSystems: ['policies', 'customers', 'attribution', 'regulars'],
    tags: ['policy', 'social'],
    consequences:
      severity >= 40
        ? [
            'Policy protest seeds become likely.',
            'Regular complaint seeds may rise.',
            'Faction objection seeds may rise.',
            'Compromise response slots open up.',
          ]
        : [],
  }
}
