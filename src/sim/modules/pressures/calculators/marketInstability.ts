import type { SimContext } from '../../../core/context'
import type { EntityRef } from '../../../state/TavernState'
import type { PressureCalculationResult, PressureCauseRef } from '../pressureTypes'

import {
  combineToValue,
  pushCause,
  severityFromValue,
  urgencyFromSeverity,
} from './helpers'
import { activeArcsByTypeOrTag } from './expandedHelpers'

// Phase 38 §38.10 — Market instability pressure.

const MARKET_CONDITION_PER_CONDITION = 8
const HIGH_PRICE_ADJUST_PER_RECORD = 3
const LOW_RELIABILITY_DIVISOR = 5
const SEASONAL_ARC_PER_INTENSITY = 0.3
const STOCK_SHORTAGE_DIVISOR = 6
const LOW_RELIABILITY_THRESHOLD = 75

type SupplierSlice = {
  activeMarketConditions?: Array<{ id: string; tags: string[]; intensity: number }>
  priceAdjustmentsToday?: Array<{
    supplierId: string
    basePrice: number
    effectivePrice: number
  }>
  missedDeliveriesToday?: Array<{ supplierId: string }>
}

export function calculateMarketInstability(
  ctx: SimContext,
): PressureCalculationResult {
  const causes: PressureCauseRef[] = []
  const relatedActors: EntityRef[] = []
  const seenActorKeys = new Set<string>()
  const addActor = (ref: EntityRef) => {
    const key = `${ref.kind}:${ref.id}`
    if (seenActorKeys.has(key)) return
    seenActorKeys.add(key)
    relatedActors.push(ref)
  }

  const supplierSlice = ctx.state.modules['suppliers'] as SupplierSlice | undefined
  const conditions = supplierSlice?.activeMarketConditions ?? []
  if (conditions.length > 0) {
    pushCause(causes, {
      id: 'active_market_conditions',
      readable: `${conditions.length} active market condition(s).`,
      amount: MARKET_CONDITION_PER_CONDITION * conditions.length,
      tags: ['market', 'condition'],
      relatedSystems: ['suppliers', 'market'],
    })
  }

  const adjustments = supplierSlice?.priceAdjustmentsToday ?? []
  let elevatedAdjustments = 0
  const adjustmentActors: EntityRef[] = []
  const seenAdjustmentKeys = new Set<string>()
  for (const adj of adjustments) {
    if (adj.effectivePrice > adj.basePrice * 1.2) {
      elevatedAdjustments += 1
      const key = `supplier:${adj.supplierId}`
      if (!seenAdjustmentKeys.has(key)) {
        seenAdjustmentKeys.add(key)
        adjustmentActors.push({ kind: 'supplier', id: adj.supplierId })
      }
    }
  }
  if (elevatedAdjustments > 0) {
    for (const ref of adjustmentActors) addActor(ref)
    pushCause(causes, {
      id: 'price_adjustments_high',
      readable: `${elevatedAdjustments} supplier price adjustment(s) +20%.`,
      amount: HIGH_PRICE_ADJUST_PER_RECORD * elevatedAdjustments,
      tags: ['market', 'price'],
      relatedActors: adjustmentActors,
      relatedSystems: ['suppliers', 'market'],
    })
  }

  // Low supplier reliability.
  const suppliers = Object.values(ctx.state.world.suppliers)
  if (suppliers.length > 0) {
    let inverseReliability = 0
    const lowReliabilityActors: EntityRef[] = []
    for (const supplier of suppliers) {
      inverseReliability += 100 - supplier.reliability
      if (supplier.reliability < LOW_RELIABILITY_THRESHOLD) {
        lowReliabilityActors.push({ kind: 'supplier', id: supplier.id })
      }
    }
    const avg = inverseReliability / suppliers.length
    if (avg >= 25) {
      for (const ref of lowReliabilityActors) addActor(ref)
      pushCause(causes, {
        id: 'avg_reliability_low',
        readable: `Supplier reliability low on average (${Math.round(100 - avg)}).`,
        amount: Math.round(avg / LOW_RELIABILITY_DIVISOR),
        tags: ['supplier', 'reliability'],
        relatedActors: lowReliabilityActors,
        relatedSystems: ['suppliers'],
      })
    }
  }

  // Seasonal arcs.
  const seasonalArcs = activeArcsByTypeOrTag(ctx.state, {
    types: ['seasonal_crisis', 'seasonal'],
    tags: ['seasonal'],
  })
  let seasonalIntensity = 0
  for (const arc of seasonalArcs) seasonalIntensity += arc.intensity
  if (seasonalArcs.length > 0) {
    const seasonalActors: EntityRef[] = seasonalArcs.map((arc) => ({
      kind: 'local_event',
      id: arc.id,
    }))
    for (const ref of seasonalActors) addActor(ref)
    pushCause(causes, {
      id: 'seasonal_arc_market',
      readable: `${seasonalArcs.length} seasonal arc(s) disturbing the market.`,
      amount: Math.round(seasonalIntensity * SEASONAL_ARC_PER_INTENSITY),
      tags: ['arc', 'seasonal'],
      relatedActors: seasonalActors,
      relatedSystems: ['localArcs'],
    })
  }

  // Stock shortage pressure bleed.
  const stockShortage = ctx.state.pressures['stock_shortage']
  if (stockShortage && stockShortage.value >= 30) {
    pushCause(causes, {
      id: 'stock_shortage_bleed',
      readable: `Stock shortage (${stockShortage.value}) signals market stress.`,
      amount: Math.round(stockShortage.value / STOCK_SHORTAGE_DIVISOR),
      tags: ['stock', 'web'],
      relatedSystems: ['stock', 'pressures'],
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
    relatedActors,
    relatedSystems: ['suppliers', 'market', 'localArcs', 'stock'],
    tags: ['market'],
    consequences:
      severity >= 40
        ? [
            'Supplier price hike seeds become likely.',
            'Suspicious goods seeds may appear.',
            'Stock shortage seeds may follow.',
            'Customer price complaints may rise.',
          ]
        : [],
  }
}
