import type { SimContext } from '../../../core/context'
import type { FeedbackEvidence, FeedbackLoopDetectorResult } from '../feedbackLoopTypes'
import { evidenceWeightTotal, pushEvidence } from './helpers'

// staff_burnout_service_decline_loop
//
// Pattern: unpaid wages / heavy traffic → stress and fatigue rise →
// service quality drops → customer satisfaction falls → angry traffic
// stresses staff further.

export function detectStaffBurnoutDecline(
  ctx: SimContext,
): FeedbackLoopDetectorResult {
  const evidence: FeedbackEvidence[] = []

  let stressed = 0
  let fatigued = 0
  let lowMorale = 0
  let unpaid = 0
  for (const member of Object.values(ctx.state.staff)) {
    if (member.stress >= 60) stressed += 1
    if (member.fatigue >= 60) fatigued += 1
    if (member.morale <= 35) lowMorale += 1
    if (!member.paidThisWeek) unpaid += 1
  }
  if (stressed >= 1) {
    pushEvidence(evidence, {
      id: 'staff_stressed',
      readable: `${stressed} staff highly stressed.`,
      weight: 15 + 5 * stressed,
      tags: ['staff', 'stress'],
    })
  }
  if (fatigued >= 1) {
    pushEvidence(evidence, {
      id: 'staff_fatigued',
      readable: `${fatigued} staff fatigued.`,
      weight: 10 + 5 * fatigued,
      tags: ['staff', 'fatigue'],
    })
  }
  if (lowMorale >= 1) {
    pushEvidence(evidence, {
      id: 'low_morale',
      readable: `${lowMorale} staff with low morale.`,
      weight: 12,
      tags: ['staff', 'morale'],
    })
  }
  if (unpaid >= 1) {
    pushEvidence(evidence, {
      id: 'unpaid_wages',
      readable: `${unpaid} staff with unpaid wages.`,
      weight: 18,
      tags: ['staff', 'wages'],
    })
  }

  let dissatisfiedGroups = 0
  for (const group of Object.values(ctx.state.customerGroups)) {
    if (group.satisfaction <= 35 && group.patronage >= 30) dissatisfiedGroups += 1
  }
  if (dissatisfiedGroups >= 1) {
    pushEvidence(evidence, {
      id: 'dissatisfied_groups',
      readable: `${dissatisfiedGroups} customer group(s) dissatisfied.`,
      weight: 12 * dissatisfiedGroups,
      tags: ['customers', 'satisfaction'],
    })
  }

  const strength = Math.min(100, evidenceWeightTotal(evidence))
  const active = evidence.length >= 2 && (stressed > 0 || fatigued > 0 || unpaid > 0)
  return {
    active,
    strength,
    risk: active ? Math.min(100, strength + 5) : strength,
    speed: 'fast',
    evidence,
    nodes: ['wages', 'staff_health', 'service_quality', 'customer_satisfaction'],
    relatedSystems: ['staff', 'customers', 'weekly'],
    tags: ['staff', 'service'],
    readable:
      'unpaid wages / heavy traffic → staff burnout → service quality drops → angry customers → more pressure on staff',
  }
}
