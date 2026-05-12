import { Registry } from '../../registries/Registry'
import type { SimContext } from '../../core/context'
import type { FeedbackLoopDetectorResult } from './feedbackLoopTypes'
import { detectDeferredMaintenance } from './detectors/deferredMaintenanceRevenue'
import { detectStaffBurnoutDecline } from './detectors/staffBurnoutServiceDecline'
import { detectRowdyDamageIdentity } from './detectors/rowdyDamageIdentity'
import { detectCheapLowQualityReputation } from './detectors/cheapLowQualityReputation'
import { detectStockShortageReliability } from './detectors/stockShortageReliability'
import { detectFilthMerchantLoss } from './detectors/filthMerchantLoss'
import {
  detectFestivalUnreadinessLoop,
  detectPolicyBacklashLoop,
  detectRegularLossSpiral,
  detectRivalPressureLoop,
  detectRumourBlameLoop,
  detectStaffScapegoatLoop,
  detectSupplierDistrustSpiral,
} from './detectors/expandedLoops'

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

// Phase 38 §38.15 — Expanded feedback loops layered on top of the
// canonical Phase 18 set. Each detector inspects expanded pressures and
// emits evidence-tagged with the pressure id so the feedback report can
// surface the spiral. Registered through the same registry so existing
// `feedbackLoopRegistry.all()` consumers pick them up without changes.
export const EXPANDED_FEEDBACK_LOOPS: FeedbackLoopDefinition[] = [
  {
    id: 'supplier_distrust_spiral',
    label: 'Supplier Distrust Spiral',
    detect: detectSupplierDistrustSpiral,
    tags: ['supplier', 'market', 'stock', 'expanded'],
  },
  {
    id: 'regular_loss_spiral',
    label: 'Regular Loss Spiral',
    detect: detectRegularLossSpiral,
    tags: ['regulars', 'reputation', 'expanded'],
  },
  {
    id: 'staff_scapegoat_loop',
    label: 'Staff Scapegoat Loop',
    detect: detectStaffScapegoatLoop,
    tags: ['staff', 'attribution', 'expanded'],
  },
  {
    id: 'policy_backlash_loop',
    label: 'Policy Backlash Loop',
    detect: detectPolicyBacklashLoop,
    tags: ['policy', 'faction', 'culture', 'expanded'],
  },
  {
    id: 'rival_pressure_loop',
    label: 'Rival Pressure Loop',
    detect: detectRivalPressureLoop,
    tags: ['rival', 'reputation', 'regulars', 'expanded'],
  },
  {
    id: 'festival_unreadiness_loop',
    label: 'Festival Unreadiness Loop',
    detect: detectFestivalUnreadinessLoop,
    tags: ['festival', 'arc', 'expanded'],
  },
  {
    id: 'rumour_blame_loop',
    label: 'Rumour Blame Loop',
    detect: detectRumourBlameLoop,
    tags: ['rumour', 'attribution', 'reputation', 'expanded'],
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
  for (const def of EXPANDED_FEEDBACK_LOOPS) {
    if (!feedbackLoopRegistry.has(def.id)) {
      feedbackLoopRegistry.register(def)
    }
  }
  initialized = true
}

ensureRequiredFeedbackLoopsRegistered()
