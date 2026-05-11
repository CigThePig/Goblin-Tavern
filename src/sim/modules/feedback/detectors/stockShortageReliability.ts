import type { SimContext } from '../../../core/context'
import type { FeedbackEvidence, FeedbackLoopDetectorResult } from '../feedbackLoopTypes'
import { evidenceWeightTotal, pushEvidence } from './helpers'

// stock_shortage_reliability_loop
//
// Pattern: shortages → customers leave dissatisfied → reliable
// reputation drops → fewer regulars → buying less → harder to keep
// stock topped up.

export function detectStockShortageReliability(
  ctx: SimContext,
): FeedbackLoopDetectorResult {
  const evidence: FeedbackEvidence[] = []

  if (
    ctx.hasMemory('repeated_ale_shortages') ||
    ctx.hasMemory('ale_shortage_recently') ||
    ctx.hasMemory('stew_shortage_recently')
  ) {
    pushEvidence(evidence, {
      id: 'shortage_memory',
      readable: 'Shortage memory active.',
      weight: 14,
      tags: ['memory', 'shortage'],
    })
  }
  const ale = ctx.state.stock['ale']
  if (ale && ale.quantity <= 20) {
    pushEvidence(evidence, {
      id: 'ale_low',
      readable: `Ale stock low (${Math.round(ale.quantity)}).`,
      weight: 14,
      tags: ['stock', 'ale'],
    })
  }
  if (ctx.state.reputation.reliable <= 35) {
    pushEvidence(evidence, {
      id: 'reliable_rep_low',
      readable: `Reliable reputation low (${ctx.state.reputation.reliable}).`,
      weight: 12,
      tags: ['reputation', 'reliable'],
    })
  }
  let dissatisfied = 0
  for (const group of Object.values(ctx.state.customerGroups)) {
    if (group.satisfaction <= 35) dissatisfied += 1
  }
  if (dissatisfied >= 1) {
    pushEvidence(evidence, {
      id: 'dissatisfied_groups',
      readable: `${dissatisfied} customer groups dissatisfied.`,
      weight: 10,
      tags: ['customers', 'satisfaction'],
    })
  }

  const strength = Math.min(100, evidenceWeightTotal(evidence))
  const active = evidence.length >= 2
  return {
    active,
    strength,
    risk: active ? Math.min(100, strength + 5) : strength,
    speed: 'medium',
    evidence,
    nodes: ['stock', 'customer_satisfaction', 'reputation', 'patronage'],
    relatedSystems: ['stock', 'reputation', 'customers'],
    tags: ['stock', 'shortage'],
    readable:
      'shortages → dissatisfied customers → reliable reputation drops → fewer regulars → harder to restock',
  }
}
