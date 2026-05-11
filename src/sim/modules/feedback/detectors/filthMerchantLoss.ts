import type { SimContext } from '../../../core/context'
import type { FeedbackEvidence, FeedbackLoopDetectorResult } from '../feedbackLoopTypes'
import { evidenceWeightTotal, pushEvidence } from './helpers'

// filth_merchant_loss_loop
//
// Pattern: low cleanliness → merchant dissatisfaction → merchant
// patronage falls → revenue falls → fewer repairs/cleaning → still
// lower cleanliness.

export function detectFilthMerchantLoss(
  ctx: SimContext,
): FeedbackLoopDetectorResult {
  const evidence: FeedbackEvidence[] = []

  const mainRoom = ctx.state.areas['main_room']
  const kitchen = ctx.state.areas['kitchen']
  if (mainRoom && mainRoom.cleanliness <= 35) {
    pushEvidence(evidence, {
      id: 'main_room_filthy',
      readable: `Main room cleanliness low (${mainRoom.cleanliness}).`,
      weight: 16,
      tags: ['areas', 'main_room', 'cleanliness'],
    })
  }
  if (kitchen && kitchen.cleanliness <= 35) {
    pushEvidence(evidence, {
      id: 'kitchen_filthy',
      readable: `Kitchen cleanliness low (${kitchen.cleanliness}).`,
      weight: 14,
      tags: ['areas', 'kitchen', 'cleanliness'],
    })
  }
  const merchants = ctx.state.customerGroups['merchants']
  if (merchants) {
    if (merchants.satisfaction <= 40) {
      pushEvidence(evidence, {
        id: 'merchants_unhappy',
        readable: `Merchant satisfaction low (${merchants.satisfaction}).`,
        weight: 14,
        tags: ['customers', 'merchants'],
      })
    }
    if (merchants.patronage <= 35) {
      pushEvidence(evidence, {
        id: 'merchants_thin',
        readable: `Merchant patronage low (${merchants.patronage}).`,
        weight: 12,
        tags: ['customers', 'merchants'],
      })
    }
  }
  if (ctx.state.reputation.filthy >= 55) {
    pushEvidence(evidence, {
      id: 'filthy_rep',
      readable: `Filthy reputation ${ctx.state.reputation.filthy}.`,
      weight: 10,
      tags: ['reputation', 'filthy'],
    })
  }
  if (ctx.hasMemory('merchant_decline_pattern')) {
    pushEvidence(evidence, {
      id: 'merchant_decline',
      readable: 'Merchant decline pattern memory active.',
      weight: 12,
      tags: ['memory', 'pattern'],
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
    nodes: ['cleanliness', 'merchant_satisfaction', 'patronage', 'revenue'],
    relatedSystems: ['areas', 'customers', 'reputation'],
    tags: ['filth', 'merchants'],
    readable:
      'low cleanliness → merchant dissatisfaction → merchant patronage falls → revenue falls → fewer repairs/cleaning → cleanliness drops further',
  }
}
