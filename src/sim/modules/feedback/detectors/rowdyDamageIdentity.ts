import type { SimContext } from '../../../core/context'
import type { FeedbackEvidence, FeedbackLoopDetectorResult } from '../feedbackLoopTypes'
import { evidenceWeightTotal, pushEvidence } from './helpers'

// rowdy_damage_identity_loop
//
// Pattern: rowdy patrons → brawls / damage → respectable customers
// leave → dangerous reputation rises → more rowdy patrons.

export function detectRowdyDamageIdentity(
  ctx: SimContext,
): FeedbackLoopDetectorResult {
  const evidence: FeedbackEvidence[] = []

  const ogres = ctx.state.customerGroups['ogres']
  if (ogres && ogres.patronage >= 55) {
    pushEvidence(evidence, {
      id: 'ogres_present',
      readable: `Ogres patronage ${ogres.patronage}.`,
      weight: 14,
      tags: ['customers', 'ogres'],
    })
  }
  const mainRoom = ctx.state.areas['main_room']
  if (mainRoom && mainRoom.damage >= 50) {
    pushEvidence(evidence, {
      id: 'main_room_damage',
      readable: `Main room damaged (${mainRoom.damage}).`,
      weight: 16,
      tags: ['areas', 'main_room', 'damage'],
    })
  }
  if (ctx.state.reputation.dangerous >= 55) {
    pushEvidence(evidence, {
      id: 'dangerous_rep',
      readable: `Dangerous reputation ${ctx.state.reputation.dangerous}.`,
      weight: 12,
      tags: ['reputation', 'dangerous'],
    })
  }
  const merchants = ctx.state.customerGroups['merchants']
  if (merchants && merchants.patronage <= 30) {
    pushEvidence(evidence, {
      id: 'merchants_gone',
      readable: `Merchants thin on the ground (${merchants.patronage}).`,
      weight: 12,
      tags: ['customers', 'merchants'],
    })
  }
  if (ctx.hasMemory('recent_brawl')) {
    pushEvidence(evidence, {
      id: 'recent_brawl',
      readable: 'Recent brawl in memory.',
      weight: 10,
      tags: ['memory', 'brawl'],
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
    nodes: ['rowdy_traffic', 'main_room', 'reputation', 'customer_mix'],
    relatedSystems: ['customers', 'areas', 'reputation'],
    tags: ['identity', 'violence'],
    readable:
      'rowdy patrons → brawls / damage → respectable customers leave → dangerous reputation rises → more rowdy patrons',
  }
}
