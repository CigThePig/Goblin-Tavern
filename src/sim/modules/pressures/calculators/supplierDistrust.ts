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

const COLD_SUPPLIER_RELATIONSHIP_FLOOR = 35
const COLD_SUPPLIER_RELATIONSHIP_AMOUNT = 6
const LOW_RELIABILITY_FLOOR = 35
const LOW_RELIABILITY_AMOUNT = 6
const PUBLIC_BLAME_DIVISOR = 5
const LATE_PAYMENT_MEMORY_DIVISOR = 4
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
    const avgRelationship = 100 - inverseSum / suppliers.length
    if (avgRelationship < COLD_SUPPLIER_RELATIONSHIP_FLOOR) {
      pushCause(causes, {
        id: 'avg_relationship_cold',
        readable: `Supplier contacts are cold on average (${Math.round(avgRelationship)}).`,
        amount: COLD_SUPPLIER_RELATIONSHIP_AMOUNT,
        tags: ['supplier', 'relationship'],
        relatedSystems: ['suppliers'],
        origin: 'discovered',
      })
    }
    const avgReliability = 100 - lowReliabilitySum / suppliers.length
    if (avgReliability < LOW_RELIABILITY_FLOOR) {
      pushCause(causes, {
        id: 'avg_reliability_low',
        readable: `Supplier reliability is weak on average (${Math.round(avgReliability)}).`,
        amount: LOW_RELIABILITY_AMOUNT,
        tags: ['supplier', 'reliability'],
        relatedSystems: ['suppliers'],
        origin: 'external',
      })
    }
  }

  // Per-supplier blame, memories, and relief.
  for (const supplier of suppliers) {
    const ref: EntityRef = { kind: 'supplier', id: supplier.id }
    const blame = publicBlameStrengthAgainst(ctx.state, ref)
    if (blame >= 25) {
      pushActor(ref)
      pushCause(causes, {
        id: `blame_${supplier.id}`,
        readable: `${supplier.label} is publicly blamed (strength ${Math.round(blame)}).`,
        amount: Math.round(blame / PUBLIC_BLAME_DIVISOR),
        tags: ['supplier', 'blame', 'attribution'],
        relatedActors: [ref],
        origin: 'discovered',
        relatedSystems: ['suppliers', 'attribution'],
      })
    }
    const lateMem = memoryStrengthAboutByTags(ctx, ref, ['late_payment'])
    if (lateMem >= 25) {
      pushActor(ref)
      pushCause(causes, {
        id: `late_payment_mem_${supplier.id}`,
        readable: `${supplier.label} remembers late payment (strength ${Math.round(lateMem)}).`,
        amount: Math.round(lateMem / LATE_PAYMENT_MEMORY_DIVISOR),
        tags: ['supplier', 'memory', 'late_payment'],
        relatedActors: [ref],
        origin: 'player_caused',
        relatedSystems: ['suppliers', 'memories'],
      })
    }
    const disputeMem = memoryStrengthAboutByTags(ctx, ref, ['delivery_dispute'])
    if (disputeMem >= 25) {
      pushActor(ref)
      pushCause(causes, {
        id: `delivery_dispute_mem_${supplier.id}`,
        readable: `${supplier.label} remembers delivery disputes (strength ${Math.round(disputeMem)}).`,
        amount: Math.round(disputeMem / DELIVERY_DISPUTE_MEMORY_DIVISOR),
        tags: ['supplier', 'memory', 'delivery_dispute'],
        relatedActors: [ref],
        origin: 'player_caused',
        relatedSystems: ['suppliers', 'memories'],
      })
    }
    const fairDeal = memoryStrengthAboutByTags(ctx, ref, ['fair_deal'])
    const paidOnTime = memoryStrengthAboutByTags(ctx, ref, ['paid_on_time'])
    const gratitude = gratitudeStrengthAgainst(ctx.state, ref)
    const reliefScore = fairDeal + paidOnTime + gratitude
    if (reliefScore >= 25) {
      pushActor(ref)
      pushCause(causes, {
        id: `relief_${supplier.id}`,
        readable: `${supplier.label} remembers good treatment (relief ${Math.round(reliefScore)}).`,
        amount: -Math.round(reliefScore / GRATITUDE_RELIEF_DIVISOR),
        tags: ['supplier', 'relief'],
        relatedActors: [ref],
        origin: 'memory',
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
      origin: 'external',
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
      origin: 'external',
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
