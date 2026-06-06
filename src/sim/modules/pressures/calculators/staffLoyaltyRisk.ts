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
  publicBlameStrengthAgainst,
} from './expandedHelpers'

// Phase 38 §38.5 — Staff loyalty risk pressure.

const UNPROVEN_LOYALTY_FLOOR = 50
const MILD_LOYALTY_CONCERN_FLOOR = 40
const MILD_LOYALTY_CONCERN = 6
const REAL_LOYALTY_RISK_BASE = 12
const REAL_LOYALTY_RISK_PER_POINT_UNDER_40 = 1
const LOW_MORALE_PER_STAFF = 4
const UNPAID_WAGES_PER_STAFF = 7
const BURNOUT_CONTRIBUTION_DIVISOR = 5
const PUBLIC_BLAME_DIVISOR = 18
const SCAPEGOAT_MEMORY_DIVISOR = 10
const RELIEF_DIVISOR = 10

export function calculateStaffLoyaltyRisk(
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

  const staff = Object.values(ctx.state.staff)

  if (staff.length > 0) {
    let inverseLoyaltySum = 0
    let lowMoraleCount = 0
    let unpaidCount = 0
    for (const member of staff) {
      inverseLoyaltySum += 100 - member.loyalty
      if (member.morale <= 35) lowMoraleCount += 1
      if (!member.paidThisWeek) unpaidCount += 1
    }
    const avgLoyalty = 100 - inverseLoyaltySum / staff.length
    const pastOpeningGrace = ctx.state.calendar.totalDaysElapsed >= 4
    if (avgLoyalty < MILD_LOYALTY_CONCERN_FLOOR) {
      pushCause(causes, {
        id: 'avg_loyalty_low',
        readable: `Staff loyalty is fragile on average (${Math.round(avgLoyalty)}).`,
        amount: Math.round(
          REAL_LOYALTY_RISK_BASE +
            (MILD_LOYALTY_CONCERN_FLOOR - avgLoyalty) *
              REAL_LOYALTY_RISK_PER_POINT_UNDER_40,
        ),
        tags: ['staff', 'loyalty'],
        relatedSystems: ['staff'],
        origin: 'inherited',
      })
    } else if (avgLoyalty < UNPROVEN_LOYALTY_FLOOR && pastOpeningGrace) {
      pushCause(causes, {
        id: 'avg_loyalty_unproven',
        readable: `Staff trust remains unproven on average (${Math.round(avgLoyalty)}).`,
        amount: MILD_LOYALTY_CONCERN,
        tags: ['staff', 'loyalty'],
        relatedSystems: ['staff'],
        origin: 'discovered',
      })
    }
    if (lowMoraleCount > 0) {
      pushCause(causes, {
        id: 'low_morale_count',
        readable: `${lowMoraleCount} staff with low morale.`,
        amount: LOW_MORALE_PER_STAFF * lowMoraleCount,
        tags: ['staff', 'morale'],
        relatedSystems: ['staff'],
        origin: 'inherited',
      })
    }
    if (unpaidCount > 0) {
      pushCause(causes, {
        id: 'unpaid_wages',
        readable: `${unpaidCount} staff with unpaid wages.`,
        amount: UNPAID_WAGES_PER_STAFF * unpaidCount,
        tags: ['staff', 'wages'],
        relatedSystems: ['staff', 'weekly'],
        origin: 'player_caused',
      })
    }
  }

  // Per-staff: public blame, scapegoat memories, relief from comfort.
  for (const member of staff) {
    const ref: EntityRef = { kind: 'staff', id: member.id }
    const blame = publicBlameStrengthAgainst(ctx.state, ref)
    if (blame >= 25) {
      pushActor(ref)
      pushCause(causes, {
        id: `blame_${member.id}`,
        readable: `${member.name.display} is publicly blamed (strength ${Math.round(blame)}).`,
        amount: Math.round(blame / PUBLIC_BLAME_DIVISOR),
        tags: ['staff', 'blame', 'attribution'],
        relatedActors: [ref],
        origin: 'discovered',
        relatedSystems: ['staff', 'attribution'],
      })
    }
    const scapegoatMem = memoryStrengthForOwnerByTags(ctx, ref, ['scapegoat'])
    if (scapegoatMem >= 25) {
      pushActor(ref)
      pushCause(causes, {
        id: `scapegoat_${member.id}`,
        readable: `${member.name.display} remembers being scapegoated (strength ${Math.round(scapegoatMem)}).`,
        amount: Math.round(scapegoatMem / SCAPEGOAT_MEMORY_DIVISOR),
        tags: ['staff', 'memory', 'scapegoat'],
        relatedActors: [ref],
        origin: 'player_caused',
        relatedSystems: ['staff', 'memories'],
      })
    }
    const comforted = memoryStrengthForOwnerByTags(ctx, ref, ['comforted'])
    const protectedMem = memoryStrengthForOwnerByTags(ctx, ref, ['protected'])
    const bonus = memoryStrengthForOwnerByTags(ctx, ref, ['bonus'])
    const gratitude = gratitudeStrengthAgainst(ctx.state, ref)
    const relief = comforted + protectedMem + bonus + gratitude
    if (relief >= 25) {
      pushActor(ref)
      pushCause(causes, {
        id: `relief_${member.id}`,
        readable: `${member.name.display} remembers being protected/rewarded (relief ${Math.round(relief)}).`,
        amount: -Math.round(relief / RELIEF_DIVISOR),
        tags: ['staff', 'relief'],
        relatedActors: [ref],
        origin: 'memory',
        relatedSystems: ['staff', 'memories'],
      })
    }
  }

  // Burnout pressure contribution (pull from snapshot if available).
  const burnoutSnapshot = ctx.state.pressures['staff_burnout']
  if (burnoutSnapshot && burnoutSnapshot.value >= 40) {
    pushCause(causes, {
      id: 'burnout_contribution',
      readable: `Staff burnout pressure ${burnoutSnapshot.value} bleeds into loyalty risk.`,
      amount: Math.round(burnoutSnapshot.value / BURNOUT_CONTRIBUTION_DIVISOR),
      tags: ['staff', 'burnout', 'web'],
      relatedSystems: ['staff', 'pressures'],
      origin: 'decay',
    })
  }

  const value = combineToValue(0, causes)
  const severity = severityFromValue(value)
  const urgency = urgencyFromSeverity(severity, staff.some((m) => !m.paidThisWeek) ? 8 : 0)

  return {
    value,
    severity,
    urgency,
    causes,
    relatedActors,
    relatedSystems: ['staff', 'memories', 'attribution', 'pressures'],
    tags: ['staff', 'loyalty', 'social'],
    consequences:
      severity >= 50
        ? [
            'Staff request seeds become more likely.',
            'Staff quitting warnings appear.',
            'Service quality drops.',
            'Staff conflict scenes may follow.',
          ]
        : [],
  }
}
