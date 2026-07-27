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

  const policies = Object.entries(ownerPolicies(ctx.state)).map(([id, p]) => ({
    ...p,
    id,
  }))
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
  //
  // Phase 201 / audit Wave 2 (`P5-PLAY-003`) — this used to emit ONE
  // aggregate "N group/policy dislike pair(s)" cause naming no policy at
  // all. The policy_backlash card wants to name the policy that is
  // actually driving the pressure, and with no per-policy evidence it
  // was reaching for any cause that merely carried the generic `policy`
  // tag — so it named a policy on no evidence. The breakdown is now one
  // line per policy, tagged and attributed with that policy's id, which
  // is real linkage the card can cite. Each group is still counted once
  // (against the first policy it objects to), so the pressure VALUE is
  // unchanged.
  const groupsByPolicy = new Map<string, EntityRef[]>()
  for (const group of Object.values(ctx.state.customerGroups)) {
    if (group.patronage < 25) continue
    for (const policy of activePolicies) {
      const objects = policy.tags.some((tag) => group.dislikedTags.includes(tag))
      if (!objects) continue
      const ref: EntityRef = { kind: 'customer_group', id: group.id }
      relatedActors.push(ref)
      const existing = groupsByPolicy.get(policy.id) ?? []
      existing.push(ref)
      groupsByPolicy.set(policy.id, existing)
      break
    }
  }
  for (const policy of activePolicies) {
    const objectors = groupsByPolicy.get(policy.id)
    if (!objectors || objectors.length === 0) continue
    pushCause(causes, {
      id: `disliking_groups_${policy.id}`,
      readable: `${objectors.length} group(s) object to ${policy.label}.`,
      amount: DISLIKE_PER_GROUP * objectors.length,
      tags: ['customers', 'policy', 'backlash', policy.id],
      relatedActors: objectors,
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
