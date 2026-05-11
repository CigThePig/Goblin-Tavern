import type { SimContext } from '../../../core/context'
import type { PressureCalculationResult, PressureCauseRef } from '../pressureTypes'
import type { EntityRef } from '../../../state/TavernState'
import {
  combineToValue,
  pushCause,
  severityFromValue,
  urgencyFromSeverity,
} from './helpers'

// Phase 18 §18.3 — Inspection pressure.
//
// Reacts to multiple systems, not just one stat:
//   - food safety pressure
//   - privy smell / cleanliness
//   - kitchen cleanliness
//   - merchant complaints / satisfaction
//   - filthy reputation
//   - recent inspection warnings / memories

const FOOD_SAFETY_HIGH = 18
const FOOD_SAFETY_MED = 8
const PRIVY_STINK = 14
const KITCHEN_FILTHY = 12
const MERCHANT_UNHAPPY = 8
const FILTHY_REP = 8
const RELIABLE_REP = -6
const WARNING_MEMORY = 14
const SUSPICION_FROM_MONTHLY = 12

// Phase 28 §28.8 — `inspection_sensitive` is the trait an inspector
// notices first. Apply a small bump when a sensitive area is also
// objectively dirty, so the trait reinforces existing cleanliness signals
// instead of duplicating them.
const INSPECTION_SENSITIVE_DIRTY = 6

type MonthlySlice = {
  inspection?: { suspicion?: number }
}

export function calculateInspection(ctx: SimContext): PressureCalculationResult {
  const causes: PressureCauseRef[] = []
  const locations: EntityRef[] = []

  const foodSafety = ctx.state.pressures['food_safety']
  if (foodSafety) {
    if (foodSafety.value >= 60) {
      pushCause(causes, {
        id: 'food_safety_high',
        readable: `Food safety pressure high (${foodSafety.value}).`,
        amount: FOOD_SAFETY_HIGH,
        tags: ['food_safety', 'pressure'],
        relatedSystems: ['pressures', 'food_safety'],
      })
    } else if (foodSafety.value >= 40) {
      pushCause(causes, {
        id: 'food_safety_med',
        readable: `Food safety pressure elevated (${foodSafety.value}).`,
        amount: FOOD_SAFETY_MED,
        tags: ['food_safety', 'pressure'],
        relatedSystems: ['pressures', 'food_safety'],
      })
    }
  }

  const privy = ctx.state.areas['privy']
  if (privy) {
    locations.push({ kind: 'area', id: privy.id })
    if (privy.smell >= 65) {
      pushCause(causes, {
        id: 'privy_smell',
        readable: `Privy smell above acceptable (${privy.smell}).`,
        amount: PRIVY_STINK,
        tags: ['privy', 'smell'],
        relatedLocations: [{ kind: 'area', id: privy.id }],
        relatedSystems: ['areas'],
      })
    }
  }

  const kitchen = ctx.state.areas['kitchen']
  if (kitchen && kitchen.cleanliness <= 35) {
    locations.push({ kind: 'area', id: kitchen.id })
    pushCause(causes, {
      id: 'kitchen_filthy',
      readable: `Kitchen cleanliness very low (${kitchen.cleanliness}).`,
      amount: KITCHEN_FILTHY,
      tags: ['kitchen', 'cleanliness'],
      relatedLocations: [{ kind: 'area', id: kitchen.id }],
      relatedSystems: ['areas'],
    })
  }

  const merchants = ctx.state.customerGroups['merchants']
  if (merchants && merchants.satisfaction <= 35) {
    pushCause(causes, {
      id: 'merchants_unhappy',
      readable: `Merchants dissatisfied (${merchants.satisfaction}).`,
      amount: MERCHANT_UNHAPPY,
      tags: ['customer', 'merchants', 'satisfaction'],
      relatedSystems: ['customers'],
    })
  }

  if (ctx.state.reputation.filthy >= 55) {
    pushCause(causes, {
      id: 'filthy_reputation',
      readable: `Filthy reputation drawing inspector interest (${ctx.state.reputation.filthy}).`,
      amount: FILTHY_REP,
      tags: ['reputation', 'filthy'],
      relatedSystems: ['reputation'],
    })
  }
  if (ctx.state.reputation.reliable >= 60) {
    pushCause(causes, {
      id: 'reliable_reputation',
      readable: `Reliable reputation deflecting attention (${ctx.state.reputation.reliable}).`,
      amount: RELIABLE_REP,
      tags: ['reputation', 'reliable'],
      relatedSystems: ['reputation'],
    })
  }

  // Phase 28 §28.8 — area trait reinforcement. Inspection-sensitive
  // areas only matter when they are also dirty; otherwise the trait is
  // background flavour.
  for (const area of Object.values(ctx.state.areas)) {
    if (!area.traits.includes('inspection_sensitive')) continue
    if (area.cleanliness > 40 && area.smell < 65) continue
    pushCause(causes, {
      id: `inspection_sensitive_${area.id}`,
      readable: `${area.label} is inspection-sensitive and unclean (${area.cleanliness}).`,
      amount: INSPECTION_SENSITIVE_DIRTY,
      tags: ['trait', 'inspection_sensitive', area.id],
      relatedLocations: [{ kind: 'area', id: area.id }],
      relatedSystems: ['areas'],
    })
  }

  if (
    ctx.hasMemory('inspector_followup_possible') ||
    ctx.hasMemory('inspection_warning_recently')
  ) {
    pushCause(causes, {
      id: 'inspection_memory',
      readable: 'Recent inspection warning still in memory.',
      amount: WARNING_MEMORY,
      tags: ['memory', 'inspection'],
      relatedSystems: ['memories', 'inspection'],
    })
  }

  // The monthly module already tracks `inspection.suspicion`. When that
  // is high, mirror the same pressure here.
  const monthly = ctx.state.modules['monthly'] as MonthlySlice | undefined
  const suspicion = monthly?.inspection?.suspicion ?? 0
  if (suspicion >= 55) {
    pushCause(causes, {
      id: 'monthly_suspicion',
      readable: `Inspection suspicion accumulating (${Math.round(suspicion)}).`,
      amount: SUSPICION_FROM_MONTHLY,
      tags: ['monthly', 'inspection'],
      relatedSystems: ['monthly', 'inspection'],
    })
  }

  const value = combineToValue(0, causes)
  const severity = severityFromValue(value)
  const urgency = urgencyFromSeverity(severity, suspicion >= 65 ? 10 : 0)

  return {
    value,
    severity,
    urgency,
    causes,
    relatedLocations: locations,
    relatedSystems: ['inspection', 'monthly', 'areas'],
    tags: ['inspection', 'risk'],
    consequences:
      severity >= 60
        ? [
            'Inspector visit risk rises.',
            'Continued slips will produce warnings.',
          ]
        : [],
  }
}
