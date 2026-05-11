import { Registry } from '../../registries/Registry'
import type { SimContext } from '../../core/context'
import type { FeedbackLoopDetectorResult } from './feedbackLoopTypes'
import { detectDeferredMaintenance } from './detectors/deferredMaintenanceRevenue'
import { detectStaffBurnoutDecline } from './detectors/staffBurnoutServiceDecline'
import { detectRowdyDamageIdentity } from './detectors/rowdyDamageIdentity'
import { detectCheapLowQualityReputation } from './detectors/cheapLowQualityReputation'
import { detectStockShortageReliability } from './detectors/stockShortageReliability'
import { detectFilthMerchantLoss } from './detectors/filthMerchantLoss'

// Phase 18 §18.12 — Feedback loop registry.

export type FeedbackLoopDefinition = {
  id: string
  label: string
  detect(ctx: SimContext): FeedbackLoopDetectorResult
  tags: string[]
}

export const feedbackLoopRegistry = new Registry<FeedbackLoopDefinition>()

export const REQUIRED_FEEDBACK_LOOPS: FeedbackLoopDefinition[] = [
  {
    id: 'deferred_maintenance_revenue_spiral',
    label: 'Deferred Maintenance / Revenue Spiral',
    detect: detectDeferredMaintenance,
    tags: ['maintenance', 'economy'],
  },
  {
    id: 'staff_burnout_service_decline_loop',
    label: 'Staff Burnout / Service Decline',
    detect: detectStaffBurnoutDecline,
    tags: ['staff', 'service'],
  },
  {
    id: 'rowdy_damage_identity_loop',
    label: 'Rowdy Damage / Identity Drift',
    detect: detectRowdyDamageIdentity,
    tags: ['identity', 'violence'],
  },
  {
    id: 'cheap_low_quality_reputation_loop',
    label: 'Cheap / Low Quality Reputation',
    detect: detectCheapLowQualityReputation,
    tags: ['identity', 'economy'],
  },
  {
    id: 'stock_shortage_reliability_loop',
    label: 'Stock Shortage / Reliability',
    detect: detectStockShortageReliability,
    tags: ['stock', 'reliability'],
  },
  {
    id: 'filth_merchant_loss_loop',
    label: 'Filth / Merchant Loss',
    detect: detectFilthMerchantLoss,
    tags: ['filth', 'merchants'],
  },
]

let initialized = false

export function ensureRequiredFeedbackLoopsRegistered(): void {
  if (initialized) return
  for (const def of REQUIRED_FEEDBACK_LOOPS) {
    if (!feedbackLoopRegistry.has(def.id)) {
      feedbackLoopRegistry.register(def)
    }
  }
  initialized = true
}

ensureRequiredFeedbackLoopsRegistered()
