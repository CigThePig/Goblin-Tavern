import type { SimContext } from '../../../core/context'
import type { FeedbackEvidence, FeedbackLoopDetectorResult } from '../feedbackLoopTypes'
import { evidenceWeightTotal, pushEvidence } from './helpers'

// cheap_low_quality_reputation_loop
//
// Pattern: low prices / watered-down ale → cheap reputation entrenches
// → quality-sensitive customers leave → tavern leans further into low
// margins to survive.

export function detectCheapLowQualityReputation(
  ctx: SimContext,
): FeedbackLoopDetectorResult {
  const evidence: FeedbackEvidence[] = []

  if (ctx.state.reputation.cheap >= 70) {
    pushEvidence(evidence, {
      id: 'cheap_rep',
      readable: `Cheap reputation entrenched (${ctx.state.reputation.cheap}).`,
      weight: 16,
      tags: ['reputation', 'cheap'],
    })
  }
  if (ctx.state.reputation.tasty <= 30) {
    pushEvidence(evidence, {
      id: 'low_tasty',
      readable: `Tasty reputation low (${ctx.state.reputation.tasty}).`,
      weight: 14,
      tags: ['reputation', 'tasty'],
    })
  }
  const ale = ctx.state.stock['ale']
  if (ale && ale.quality <= 35) {
    pushEvidence(evidence, {
      id: 'ale_quality_low',
      readable: `Ale quality low (${Math.round(ale.quality)}).`,
      weight: 12,
      tags: ['stock', 'ale'],
    })
  }
  if (ctx.hasMemory('watered_ale_recently')) {
    pushEvidence(evidence, {
      id: 'watered_ale',
      readable: 'Watered-down ale remembered.',
      weight: 12,
      tags: ['memory', 'deception'],
    })
  }
  const merchants = ctx.state.customerGroups['merchants']
  if (merchants && merchants.patronage <= 30) {
    pushEvidence(evidence, {
      id: 'merchants_left',
      readable: `Merchants thin (${merchants.patronage}).`,
      weight: 10,
      tags: ['customers', 'merchants'],
    })
  }

  const strength = Math.min(100, evidenceWeightTotal(evidence))
  const active = evidence.length >= 2
  return {
    active,
    strength,
    risk: active ? Math.min(100, strength) : strength,
    speed: 'slow',
    evidence,
    nodes: ['prices', 'quality', 'reputation', 'customer_mix'],
    relatedSystems: ['stock', 'reputation', 'customers'],
    tags: ['identity', 'economy'],
    readable:
      'cheap pricing / low quality → cheap reputation entrenches → quality-sensitive customers leave',
  }
}
