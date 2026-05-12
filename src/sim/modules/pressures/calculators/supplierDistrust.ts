import type { SimContext } from '../../../core/context'
import type { EntityRef } from '../../../state/TavernState'
import type { PressureCalculationResult, PressureCauseRef } from '../pressureTypes'

import {
  combineToValue,
  pushCause,
  severityFromValue,
  urgencyFromSeverity,
} from './helpers'
import {
  gratitudeStrengthAgainst,
  memoryStrengthAboutByTags,
  publicBlameStrengthAgainst,
} from './expandedHelpers'

// Phase 38 §38.3 — Supplier distrust pressure.
//
// Inputs (per §38.3):
//   - supplier relationship state from `state.world.suppliers`
//   - supplier memories from Phase 36
//   - supplier blame attributions from Phase 37
//   - late payment causes
//   - supplier reliability
//   - active market shortages

const INVERSE_RELATIONSHIP_PER_SUPPLIER = 0.4
const LOW_RELIABILITY_PER_SUPPLIER = 0.5
const PUBLIC_BLAME_DIVISOR = 6
const LATE_PAYMENT_MEMORY_DIVISOR = 10
const DELIVERY_DISPUTE_MEMORY_DIVISOR = 10
const MARKET_SHORTAGE_PER_CONDITION = 6
const GRATITUDE_RELIEF_DIVISOR = 8

type SupplierSlice = {
  activeMarketConditions?: Array<{ id: string; tags: string[]; intensity: number }>
  missedDeliveriesToday?: Array<{ supplierId: string }>
}

export function calculateSupplierDistrust(
  ctx: SimContext,
): PressureCalculationResult {
  const causes: PressureCauseRef[] = []
  const relatedActors: EntityRef[] = []
  const seenActorKeys = new Set<string>()
  const pushActor = (ref: EntityRef) => {
    const key = `${ref.kind}:${ref.id}`
    if (seenActorKeys.has(key)) return
    seenActorKeys.add(key)
    relatedActors.push(ref)
  }

  const suppliers = Object.values(ctx.state.world.suppliers)

  if (suppliers.length > 0) {
    let inverseSum = 0
    let lowReliabilitySum = 0
    for (const supplier of suppliers) {
      inverseSum += 100 - supplier.relationship
      lowReliabilitySum += 100 - supplier.reliability
    }
    const avgInverse = inverseSum / suppliers.length
    if (avgInverse >= 30) {
      pushCause(causes, {
        id: 'avg_relationship_low',
        readable: `Suppliers feel underappreciated (avg relationship ${Math.round(100 - avgInverse)}).`,
        amount: Math.round(avgInverse * INVERSE_RELATIONSHIP_PER_SUPPLIER),
        tags: ['supplier', 'relationship'],
        relatedSystems: ['suppliers'],
      })
    }
    const avgLowRel = lowReliabilitySum / suppliers.length
    if (avgLowRel >= 25) {
      pushCause(causes, {
        id: 'avg_reliability_low',
        readable: `Suppliers unreliable on average (reliability ${Math.round(100 - avgLowRel)}).`,
        amount: Math.round(avgLowRel * LOW_RELIABILITY_PER_SUPPLIER),
        tags: ['supplier', 'reliability'],
        relatedSystems: ['suppliers'],
      })
    }
  }

  // Per-supplier blame, memories, and relief.
  for (const supplier of suppliers) {
    const ref: EntityRef = { kind: 'supplier', id: supplier.id }
    const blame = publicBlameStrengthAgainst(ctx.state, ref)
    if (blame >= 30) {
      pushActor(ref)
      pushCause(causes, {
        id: `blame_${supplier.id}`,
        readable: `${supplier.label} is publicly blamed (strength ${Math.round(blame)}).`,
        amount: Math.round(blame / PUBLIC_BLAME_DIVISOR),
        tags: ['supplier', 'blame', 'attribution'],
        relatedActors: [ref],
        relatedSystems: ['suppliers', 'attribution'],
      })
    }
    const lateMem = memoryStrengthAboutByTags(ctx, ref, ['late_payment'])
    if (lateMem >= 30) {
      pushActor(ref)
      pushCause(causes, {
        id: `late_payment_mem_${supplier.id}`,
        readable: `${supplier.label} remembers late payment (strength ${Math.round(lateMem)}).`,
        amount: Math.round(lateMem / LATE_PAYMENT_MEMORY_DIVISOR),
        tags: ['supplier', 'memory', 'late_payment'],
        relatedActors: [ref],
        relatedSystems: ['suppliers', 'memories'],
      })
    }
    const disputeMem = memoryStrengthAboutByTags(ctx, ref, ['delivery_dispute'])
    if (disputeMem >= 30) {
      pushActor(ref)
      pushCause(causes, {
        id: `delivery_dispute_mem_${supplier.id}`,
        readable: `${supplier.label} remembers delivery disputes (strength ${Math.round(disputeMem)}).`,
        amount: Math.round(disputeMem / DELIVERY_DISPUTE_MEMORY_DIVISOR),
        tags: ['supplier', 'memory', 'delivery_dispute'],
        relatedActors: [ref],
        relatedSystems: ['suppliers', 'memories'],
      })
    }
    const fairDeal = memoryStrengthAboutByTags(ctx, ref, ['fair_deal'])
    const paidOnTime = memoryStrengthAboutByTags(ctx, ref, ['paid_on_time'])
    const gratitude = gratitudeStrengthAgainst(ctx.state, ref)
    const reliefScore = fairDeal + paidOnTime + gratitude
    if (reliefScore >= 30) {
      pushActor(ref)
      pushCause(causes, {
        id: `relief_${supplier.id}`,
        readable: `${supplier.label} remembers good treatment (relief ${Math.round(reliefScore)}).`,
        amount: -Math.round(reliefScore / GRATITUDE_RELIEF_DIVISOR),
        tags: ['supplier', 'relief'],
        relatedActors: [ref],
        relatedSystems: ['suppliers', 'memories'],
      })
    }
  }

  const supplierSlice = ctx.state.modules['suppliers'] as SupplierSlice | undefined
  const conditions = supplierSlice?.activeMarketConditions ?? []
  let shortageConditions = 0
  for (const cond of conditions) {
    if (cond.tags.includes('shortage') || cond.id.includes('shortage')) {
      shortageConditions += 1
    }
  }
  if (shortageConditions > 0) {
    pushCause(causes, {
      id: 'market_shortage',
      readable: `${shortageConditions} active market shortage condition(s).`,
      amount: MARKET_SHORTAGE_PER_CONDITION * shortageConditions,
      tags: ['market', 'shortage'],
      relatedSystems: ['suppliers', 'market'],
    })
  }

  const missedToday = supplierSlice?.missedDeliveriesToday ?? []
  if (missedToday.length > 0) {
    pushCause(causes, {
      id: 'missed_deliveries_today',
      readable: `${missedToday.length} missed deliveries today.`,
      amount: 6 * missedToday.length,
      tags: ['supplier', 'delivery'],
      relatedSystems: ['suppliers'],
    })
  }

  const value = combineToValue(0, causes)
  const severity = severityFromValue(value)
  const urgency = urgencyFromSeverity(severity, shortageConditions > 0 ? 6 : 0)

  return {
    value,
    severity,
    urgency,
    causes,
    relatedActors,
    relatedSystems: ['suppliers', 'memories', 'attribution', 'market'],
    tags: ['supplier', 'distrust', 'social'],
    consequences:
      severity >= 50
        ? [
            'Late deliveries become more likely.',
            'Price hikes from suppliers may follow.',
            'Supplier-related issue seeds become more likely.',
          ]
        : [],
  }
}
