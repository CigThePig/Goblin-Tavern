import type { SimContext } from '../../../core/context'
import type { PressureCalculationResult, PressureCauseRef } from '../pressureTypes'
import {
  combineToValue,
  pushCause,
  severityFromValue,
  urgencyFromSeverity,
} from './helpers'

// Phase 18 §18.6 — Debt pressure.
//
// Inputs:
//   - current coin
//   - weekly profit/loss (from `state.modules.weekly.economy.net`)
//   - rent due / missed (from `state.modules.monthly.rent`)
//   - wage risk (unpaid staff this week)

const COIN_VERY_LOW = 26
const COIN_LOW = 14
const COIN_HEALTHY = -10
const WEEKLY_LOSS_HEAVY = 18
const WEEKLY_LOSS_LIGHT = 8
const RENT_OWED = 22
const RENT_MISSED_HISTORY_PER_MISS = 6
const UNPAID_WAGES_RISK = 8
const ARREARS_PER_HUNDRED = 6

type WeeklySlice = {
  economy?: { net?: number }
}
type MonthlySlice = {
  rent?: {
    monthlyAmount?: number
    paidThisMonth?: boolean
    missedPayments?: number
    arrears?: number
  }
}

export function calculateDebt(ctx: SimContext): PressureCalculationResult {
  const causes: PressureCauseRef[] = []

  const coin = ctx.state.coin
  if (coin <= 30) {
    pushCause(causes, {
      id: 'coin_very_low',
      readable: `Coin reserves very low (${coin}).`,
      amount: COIN_VERY_LOW,
      tags: ['coin'],
      relatedSystems: ['economy'],
    })
  } else if (coin <= 75) {
    pushCause(causes, {
      id: 'coin_low',
      readable: `Coin reserves low (${coin}).`,
      amount: COIN_LOW,
      tags: ['coin'],
      relatedSystems: ['economy'],
    })
  } else if (coin >= 250) {
    pushCause(causes, {
      id: 'coin_healthy',
      readable: `Coin reserves healthy (${coin}).`,
      amount: COIN_HEALTHY,
      tags: ['coin'],
      relatedSystems: ['economy'],
    })
  }

  const weekly = ctx.state.modules['weekly'] as WeeklySlice | undefined
  const net = weekly?.economy?.net ?? 0
  if (net <= -50) {
    pushCause(causes, {
      id: 'weekly_loss_heavy',
      readable: `Weekly net loss ${Math.round(net)} coin.`,
      amount: WEEKLY_LOSS_HEAVY,
      tags: ['economy', 'weekly'],
      relatedSystems: ['weekly', 'economy'],
    })
  } else if (net < 0) {
    pushCause(causes, {
      id: 'weekly_loss_light',
      readable: `Weekly net loss ${Math.round(net)} coin.`,
      amount: WEEKLY_LOSS_LIGHT,
      tags: ['economy', 'weekly'],
      relatedSystems: ['weekly', 'economy'],
    })
  }

  const monthly = ctx.state.modules['monthly'] as MonthlySlice | undefined
  const rent = monthly?.rent
  const rentAmount = rent?.monthlyAmount ?? 0
  const arrears = rent?.arrears ?? 0
  const missed = rent?.missedPayments ?? 0
  if (rentAmount > 0 && coin < rentAmount + arrears) {
    pushCause(causes, {
      id: 'rent_at_risk',
      readable: `Rent (${rentAmount + arrears}) exceeds coin (${coin}).`,
      amount: RENT_OWED,
      tags: ['rent', 'monthly'],
      relatedSystems: ['monthly', 'rent'],
    })
  }
  if (missed > 0) {
    pushCause(causes, {
      id: 'rent_missed_history',
      readable: `Missed-rent history: ${missed}.`,
      amount: RENT_MISSED_HISTORY_PER_MISS * missed,
      tags: ['rent', 'history'],
      relatedSystems: ['monthly', 'rent'],
    })
  }
  if (arrears > 0) {
    const buckets = Math.ceil(arrears / 100)
    pushCause(causes, {
      id: 'arrears',
      readable: `Arrears outstanding (${arrears} coin).`,
      amount: ARREARS_PER_HUNDRED * buckets,
      tags: ['rent', 'arrears'],
      relatedSystems: ['monthly', 'rent'],
    })
  }

  let unpaidStaff = 0
  for (const member of Object.values(ctx.state.staff)) {
    if (!member.paidThisWeek) unpaidStaff += 1
  }
  if (unpaidStaff > 0) {
    pushCause(causes, {
      id: 'unpaid_wages_risk',
      readable: `${unpaidStaff} staff with unpaid wages.`,
      amount: UNPAID_WAGES_RISK * unpaidStaff,
      tags: ['staff', 'wages'],
      relatedSystems: ['staff', 'economy'],
    })
  }

  const value = combineToValue(0, causes)
  const severity = severityFromValue(value)
  const urgency = urgencyFromSeverity(severity, rent?.paidThisMonth === false ? 10 : 0)

  return {
    value,
    severity,
    urgency,
    causes,
    relatedSystems: ['economy', 'monthly'],
    tags: ['economy', 'debt'],
    consequences:
      severity >= 60
        ? [
            'Rent slippage becomes likely.',
            'Landlord pressure will rise.',
          ]
        : [],
  }
}
