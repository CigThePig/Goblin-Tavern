import type { SimContext } from '../../../core/context'
import type { PressureCalculationResult, PressureCauseRef } from '../pressureTypes'
import {
  combineToValue,
  pushCause,
  severityFromValue,
  urgencyFromSeverity,
} from './helpers'

// Phase 18 §18.9 — Reputation drift pressure.
//
// "This pressure does not mean good or bad. It means the tavern identity
// is shifting strongly." Inputs:
//   - magnitude of dominant reputation axes
//   - customer patronage shifts (a single dominant group counts)
//   - recent memories (e.g. merchant decline pattern)

const STRONG_AXIS_PER_AXIS = 8
const VERY_DOMINANT_AXIS = 14
const SINGLE_DOMINANT_CUSTOMER_GROUP = 10
const MERCHANT_DECLINE_PATTERN = 12

export function calculateReputationDrift(
  ctx: SimContext,
): PressureCalculationResult {
  const causes: PressureCauseRef[] = []

  const reputation = ctx.state.reputation
  const entries = Object.entries(reputation) as [keyof typeof reputation, number][]
  let strongAxes = 0
  let dominantAxis: { id: string; value: number } | undefined
  for (const [axis, value] of entries) {
    if (value >= 70) strongAxes += 1
    if (!dominantAxis || value > dominantAxis.value) {
      dominantAxis = { id: String(axis), value }
    }
  }
  if (strongAxes >= 1) {
    pushCause(causes, {
      id: 'strong_axes',
      readable: `${strongAxes} reputation axis/axes pushing past 70.`,
      amount: STRONG_AXIS_PER_AXIS * Math.min(strongAxes, 3),
      tags: ['reputation', 'identity'],
      relatedSystems: ['reputation'],
    })
  }
  if (dominantAxis && dominantAxis.value >= 80) {
    pushCause(causes, {
      id: 'very_dominant_axis',
      readable: `${dominantAxis.id} reputation extreme (${dominantAxis.value}).`,
      amount: VERY_DOMINANT_AXIS,
      tags: ['reputation', dominantAxis.id],
      relatedSystems: ['reputation'],
    })
  }

  const groups = Object.values(ctx.state.customerGroups)
  let topGroup: { id: string; patronage: number } | undefined
  let totalPatronage = 0
  for (const group of groups) {
    totalPatronage += group.patronage
    if (!topGroup || group.patronage > topGroup.patronage) {
      topGroup = { id: group.id, patronage: group.patronage }
    }
  }
  if (topGroup && totalPatronage > 0) {
    const share = topGroup.patronage / totalPatronage
    if (share >= 0.4) {
      pushCause(causes, {
        id: 'single_group_dominant',
        readable: `${topGroup.id} dominate patronage (${Math.round(share * 100)}%).`,
        amount: SINGLE_DOMINANT_CUSTOMER_GROUP,
        tags: ['customer', 'identity'],
        relatedActors: [{ kind: 'customer_group', id: topGroup.id }],
        relatedSystems: ['customers'],
      })
    }
  }

  if (ctx.hasMemory('merchant_decline_pattern')) {
    pushCause(causes, {
      id: 'merchant_decline',
      readable: 'Merchant decline pattern is active.',
      amount: MERCHANT_DECLINE_PATTERN,
      tags: ['pattern', 'merchants'],
      relatedSystems: ['memories', 'customers'],
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
    relatedSystems: ['reputation', 'customers'],
    tags: ['reputation', 'identity'],
    consequences:
      severity >= 60
        ? [
            'The tavern is locking into an identity.',
            'Some customer groups may stop coming.',
          ]
        : [],
  }
}
