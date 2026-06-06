import type { SimContext } from '../../../core/context'
import type { DayType } from '../../calendar/types'
import type { PressureCalculationResult, PressureCauseRef } from '../pressureTypes'
import {
  combineToValue,
  pushCause,
  severityFromValue,
  urgencyFromSeverity,
} from './helpers'

// Phase 18 §18.10 — Stock shortage pressure.
//
// Inputs:
//   - stock quantity relative to per-item thresholds
//   - recent shortage memories
//   - upcoming day type (the same ale level urgency before Payday vs
//     before a Quiet Day must differ)
//
// Day-type multipliers come from the recurring weekly calendar — Payday
// and Brawl Night spike traffic, Quiet Day suppresses it.

const ALE_VERY_LOW = 20
const ALE_LOW = 10
const STEW_VERY_LOW = 14
const STEW_LOW = 6
const MUSHROOMS_LOW = 6
const RECENT_SHORTAGE_MEMORY = 10

const HIGH_DEMAND_DAY_TYPES: ReadonlyArray<DayType> = ['payday', 'brawl_night']
const LOW_DEMAND_DAY_TYPES: ReadonlyArray<DayType> = ['quiet_day']

function dayTypeMultiplier(dayType: DayType): number {
  if (HIGH_DEMAND_DAY_TYPES.includes(dayType)) return 1.6
  if (LOW_DEMAND_DAY_TYPES.includes(dayType)) return 0.6
  return 1
}

function relatedSystemsCommon(): string[] {
  return ['stock', 'customers']
}

export function calculateStockShortage(
  ctx: SimContext,
): PressureCalculationResult {
  const causes: PressureCauseRef[] = []

  const dayType = ctx.getDayType()
  const multiplier = dayTypeMultiplier(dayType)

  const ale = ctx.state.stock['ale']
  if (ale) {
    if (ale.quantity <= 15) {
      pushCause(causes, {
        id: 'ale_very_low',
        readable: `Ale stock very low (${Math.round(ale.quantity)}).`,
        amount: Math.round(ALE_VERY_LOW * multiplier),
        tags: ['stock', 'ale', 'shortage'],
        relatedSystems: relatedSystemsCommon(),
        origin: 'decay',
      })
    } else if (ale.quantity <= 45) {
      pushCause(causes, {
        id: 'ale_low',
        readable: `Ale stock low (${Math.round(ale.quantity)}).`,
        amount: Math.round(ALE_LOW * multiplier),
        tags: ['stock', 'ale', 'shortage'],
        relatedSystems: relatedSystemsCommon(),
        origin: 'decay',
      })
    }
  }

  const stew = ctx.state.stock['stew']
  if (stew) {
    if (stew.quantity <= 6) {
      pushCause(causes, {
        id: 'stew_very_low',
        readable: `Stew stock very low (${Math.round(stew.quantity)}).`,
        amount: Math.round(STEW_VERY_LOW * multiplier),
        tags: ['stock', 'stew', 'shortage'],
        relatedSystems: relatedSystemsCommon(),
        origin: 'decay',
      })
    } else if (stew.quantity <= 15) {
      pushCause(causes, {
        id: 'stew_low',
        readable: `Stew stock low (${Math.round(stew.quantity)}).`,
        amount: Math.round(STEW_LOW * multiplier),
        tags: ['stock', 'stew', 'shortage'],
        relatedSystems: relatedSystemsCommon(),
        origin: 'decay',
      })
    }
  }

  const mushrooms = ctx.state.stock['mushrooms']
  if (mushrooms && mushrooms.quantity <= 8) {
    pushCause(causes, {
      id: 'mushrooms_low',
      readable: `Mushroom stock low (${Math.round(mushrooms.quantity)}).`,
      amount: Math.round(MUSHROOMS_LOW * multiplier),
      tags: ['stock', 'mushrooms', 'shortage'],
      relatedSystems: relatedSystemsCommon(),
      origin: 'decay',
    })
  }

  if (
    ctx.hasMemory('ale_shortage_recently') ||
    ctx.hasMemory('stew_shortage_recently') ||
    ctx.hasMemory('repeated_ale_shortages')
  ) {
    pushCause(causes, {
      id: 'shortage_memory',
      readable: 'Recent shortage memories still in effect.',
      amount: RECENT_SHORTAGE_MEMORY,
      tags: ['memory', 'shortage'],
      relatedSystems: ['memories', 'stock'],
      origin: 'memory',
    })
  }

  const value = combineToValue(0, causes)
  const severity = severityFromValue(value)
  // High-demand day boosts urgency on top of severity so a 40-value
  // shortage before Payday outranks the same shortage before Quiet Day.
  const imminence = HIGH_DEMAND_DAY_TYPES.includes(dayType)
    ? 15
    : LOW_DEMAND_DAY_TYPES.includes(dayType)
      ? -10
      : 0
  const urgency = urgencyFromSeverity(severity, imminence)

  return {
    value,
    severity,
    urgency,
    causes,
    relatedSystems: ['stock', 'customers'],
    tags: ['stock', 'shortage', dayType],
    consequences:
      severity >= 50
        ? [
            'Customers may leave dissatisfied.',
            'Reliable reputation will drop.',
          ]
        : [],
  }
}
