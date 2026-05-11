import type { SimContext } from '../../../core/context'
import type { PressureCalculationResult, PressureCauseRef } from '../pressureTypes'
import {
  combineToValue,
  pushCause,
  severityFromValue,
  urgencyFromSeverity,
} from './helpers'

// Phase 18 §18 (canonical pressures) — Landlord pressure.
//
// Phase 15's monthly module already tracks `landlord.pressure` and
// `landlord.opinion`. Phase 18 promotes that to a first-class pressure
// so reports, feedback loops, and Phase 19 seeds can read from a
// uniform interface. Inputs:
//   - monthly landlord pressure / opinion
//   - missed rent count
//   - missed-rent memory
//   - filthy/dangerous reputation (drawing the landlord's attention)

const MONTHLY_PRESSURE_FACTOR = 0.9
const MISSED_RENT_PER_MISS = 8
const RENT_MISSED_MEMORY = 12
const REPUTATION_PUSH = 6
const OPINION_RELIEF = -8

type MonthlySlice = {
  landlord?: {
    pressure?: number
    opinion?: number
    missedRentCount?: number
  }
  rent?: {
    paidThisMonth?: boolean
    arrears?: number
  }
}

export function calculateLandlord(ctx: SimContext): PressureCalculationResult {
  const causes: PressureCauseRef[] = []

  const monthly = ctx.state.modules['monthly'] as MonthlySlice | undefined
  const monthlyPressure = monthly?.landlord?.pressure ?? 20
  const opinion = monthly?.landlord?.opinion ?? 50
  const missedCount = monthly?.landlord?.missedRentCount ?? 0
  const paidThisMonth = monthly?.rent?.paidThisMonth ?? true
  const arrears = monthly?.rent?.arrears ?? 0

  if (monthlyPressure > 0) {
    pushCause(causes, {
      id: 'monthly_landlord_pressure',
      readable: `Monthly landlord pressure (${Math.round(monthlyPressure)}).`,
      amount: Math.round(monthlyPressure * MONTHLY_PRESSURE_FACTOR),
      tags: ['monthly', 'landlord'],
      relatedSystems: ['monthly', 'landlord'],
    })
  }

  if (missedCount > 0) {
    pushCause(causes, {
      id: 'missed_rent_count',
      readable: `${missedCount} missed rent payment(s).`,
      amount: MISSED_RENT_PER_MISS * missedCount,
      tags: ['rent', 'missed'],
      relatedSystems: ['monthly', 'rent'],
    })
  }
  if (!paidThisMonth && arrears > 0) {
    pushCause(causes, {
      id: 'rent_arrears',
      readable: `Rent arrears outstanding (${arrears} coin).`,
      amount: 10,
      tags: ['rent', 'arrears'],
      relatedSystems: ['monthly', 'rent'],
    })
  }

  if (ctx.hasMemory('rent_missed_recently')) {
    pushCause(causes, {
      id: 'rent_missed_memory',
      readable: 'Missed rent still in recent memory.',
      amount: RENT_MISSED_MEMORY,
      tags: ['memory', 'rent'],
      relatedSystems: ['memories', 'monthly'],
    })
  }

  if (ctx.state.reputation.filthy >= 65) {
    pushCause(causes, {
      id: 'filthy_reputation',
      readable: `Filthy reputation reaching the landlord (${ctx.state.reputation.filthy}).`,
      amount: REPUTATION_PUSH,
      tags: ['reputation', 'filthy'],
      relatedSystems: ['reputation'],
    })
  }
  if (ctx.state.reputation.dangerous >= 65) {
    pushCause(causes, {
      id: 'dangerous_reputation',
      readable: `Dangerous reputation reaching the landlord (${ctx.state.reputation.dangerous}).`,
      amount: REPUTATION_PUSH,
      tags: ['reputation', 'dangerous'],
      relatedSystems: ['reputation'],
    })
  }

  if (opinion >= 65) {
    pushCause(causes, {
      id: 'opinion_relief',
      readable: `Landlord opinion favourable (${Math.round(opinion)}).`,
      amount: OPINION_RELIEF,
      tags: ['landlord', 'opinion'],
      relatedSystems: ['monthly', 'landlord'],
    })
  }

  const value = combineToValue(0, causes)
  const severity = severityFromValue(value)
  const urgency = urgencyFromSeverity(severity, !paidThisMonth ? 10 : 0)

  return {
    value,
    severity,
    urgency,
    causes,
    relatedSystems: ['monthly', 'rent', 'landlord'],
    tags: ['landlord', 'rent'],
    consequences:
      severity >= 60
        ? [
            'Eviction risk rises.',
            'Landlord may demand additional concessions.',
          ]
        : [],
  }
}
