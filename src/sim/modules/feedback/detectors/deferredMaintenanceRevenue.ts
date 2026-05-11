import type { SimContext } from '../../../core/context'
import type { FeedbackEvidence, FeedbackLoopDetectorResult } from '../feedbackLoopTypes'
import { evidenceWeightTotal, pushEvidence } from './helpers'

// deferred_maintenance_revenue_spiral
//
// Pattern: low coin → skipped repairs → damaged/dirty areas →
// customer loss → lower coin. Active when multiple areas have visible
// damage AND coin trend is poor AND repairs were skipped or low.

type WeeklySlice = {
  economy?: { repairs?: number; net?: number }
}

export function detectDeferredMaintenance(
  ctx: SimContext,
): FeedbackLoopDetectorResult {
  const evidence: FeedbackEvidence[] = []
  let damagedAreas = 0
  for (const area of Object.values(ctx.state.areas)) {
    if (area.damage >= 45) damagedAreas += 1
  }
  if (damagedAreas >= 2) {
    pushEvidence(evidence, {
      id: 'damaged_areas',
      readable: `${damagedAreas} areas show visible damage.`,
      weight: 20 + 5 * damagedAreas,
      tags: ['areas', 'damage'],
    })
  }

  const weekly = ctx.state.modules['weekly'] as WeeklySlice | undefined
  const repairs = weekly?.economy?.repairs ?? 0
  const net = weekly?.economy?.net ?? 0
  if (repairs < 15) {
    pushEvidence(evidence, {
      id: 'low_repair_spend',
      readable: `Weekly repair spend low (${Math.round(repairs)}).`,
      weight: 15,
      tags: ['economy', 'repairs'],
    })
  }
  if (net <= 0 && damagedAreas >= 1) {
    pushEvidence(evidence, {
      id: 'negative_week',
      readable: `Weekly net non-positive (${Math.round(net)}) with damaged areas.`,
      weight: 20,
      tags: ['economy', 'weekly'],
    })
  }
  if (ctx.state.coin <= 50 && damagedAreas >= 1) {
    pushEvidence(evidence, {
      id: 'low_coin',
      readable: `Coin reserves low (${ctx.state.coin}).`,
      weight: 15,
      tags: ['coin'],
    })
  }

  const strength = Math.min(100, evidenceWeightTotal(evidence))
  const active = evidence.length >= 2
  return {
    active,
    strength,
    risk: active ? Math.min(100, strength + 10) : strength,
    speed: 'medium',
    evidence,
    nodes: ['coin', 'repairs', 'areas', 'customers'],
    relatedSystems: ['economy', 'areas', 'customers'],
    tags: ['maintenance', 'economy'],
    readable:
      'low coin → skipped repairs → dirty/damaged tavern → customer loss → lower revenue',
  }
}
