import type { SimContext } from '../../core/context'
import { clampPercent } from '../../state/normalize'

import type {
  CustomerWeeklyTrendEntry,
  StaffWeeklyTrendEntry,
  WeeklyModuleState,
  WeeklyWageResolution,
} from './types'

// Phase 14 §14.6 — Staff weekly trend.
// Phase 14 §14.7 — Customer weekly trend.
//
// Both helpers consume the weekly accumulators owned by `weeklyModule`
// plus the just-resolved wage outcome. The numbers are intentionally
// modest — chronic patterns compound across weeks rather than detonating
// in one tick.

const STAFF_SOURCE = 'weekly.staffTrend'
const CUSTOMER_SOURCE = 'weekly.customerTrend'

const SHORTAGE_TOLERANCE = 0
const TRAFFIC_BUSY_THRESHOLD = 35

function totalTraffic(slice: WeeklyModuleState): number {
  let sum = 0
  for (const v of Object.values(slice.trafficByGroup)) sum += v
  return sum
}

function totalShortages(slice: WeeklyModuleState): number {
  let sum = 0
  for (const v of Object.values(slice.shortageCountByStock)) sum += v
  return sum
}

export function computeStaffTrend(
  ctx: SimContext,
  slice: WeeklyModuleState,
  wages: WeeklyWageResolution,
): StaffWeeklyTrendEntry[] {
  const entries: StaffWeeklyTrendEntry[] = []
  const profitable = slice.economy.net > 0
  const heavy = totalTraffic(slice) >= TRAFFIC_BUSY_THRESHOLD * 7
  const shortageCount = totalShortages(slice)

  for (const staff of Object.values(ctx.state.staff)) {
    const notes: string[] = []
    let morale = 0
    let stress = 0
    let fatigue = 0
    let loyalty = 0

    if (wages.paid && profitable) {
      morale += 3
      notes.push('Wages paid; week was profitable.')
    } else if (wages.paid) {
      morale += 1
      notes.push('Wages paid.')
    }

    if (!wages.paid) {
      // The wage resolution already shaved morale/stress; this is the
      // *trend* layer on top — sustained unpaid weeks compound here.
      morale -= 2
      loyalty -= 1
      notes.push('Unpaid wages weighing on morale.')
    }

    if (heavy) {
      fatigue += 3
      stress += 2
      notes.push('Heavy traffic added to fatigue and stress.')
    } else if (totalTraffic(slice) < TRAFFIC_BUSY_THRESHOLD * 2) {
      // A genuinely quiet week — staff catch their breath.
      fatigue -= 3
      stress -= 1
      notes.push('Quiet week allowed some recovery.')
    }

    if (shortageCount > SHORTAGE_TOLERANCE) {
      stress += 1
      notes.push('Frequent shortages strained the shift.')
    }

    if (staff.stress >= 80) {
      morale -= 2
      notes.push('Stress is critically high.')
    }
    if (staff.fatigue >= 80) {
      morale -= 1
      notes.push('Fatigue is critically high.')
    }

    const nextMorale = clampPercent(staff.morale + morale)
    const nextStress = clampPercent(staff.stress + stress)
    const nextFatigue = clampPercent(staff.fatigue + fatigue)
    const nextLoyalty = clampPercent(staff.loyalty + loyalty)

    if (
      nextMorale !== staff.morale ||
      nextStress !== staff.stress ||
      nextFatigue !== staff.fatigue ||
      nextLoyalty !== staff.loyalty
    ) {
      ctx.modifyStaff(
        staff.id,
        {
          morale: nextMorale,
          stress: nextStress,
          fatigue: nextFatigue,
          loyalty: nextLoyalty,
        },
        { source: STAFF_SOURCE, reason: 'weekly_trend' },
      )
    }

    entries.push({
      staffId: staff.id,
      moraleDelta: nextMorale - staff.morale,
      stressDelta: nextStress - staff.stress,
      fatigueDelta: nextFatigue - staff.fatigue,
      loyaltyDelta: nextLoyalty - staff.loyalty,
      notes,
    })
  }

  return entries
}

export function computeCustomerTrend(
  ctx: SimContext,
  slice: WeeklyModuleState,
): CustomerWeeklyTrendEntry[] {
  const entries: CustomerWeeklyTrendEntry[] = []

  for (const group of Object.values(ctx.state.customerGroups)) {
    const startingSatisfaction = slice.startingSatisfaction[group.id] ?? group.satisfaction
    const endingSatisfaction = group.satisfaction
    const samples = slice.satisfactionSamplesByGroup[group.id] ?? 0
    const sumSatisfaction = slice.satisfactionSumByGroup[group.id] ?? 0
    const average = samples > 0 ? sumSatisfaction / samples : endingSatisfaction
    const traffic = slice.trafficByGroup[group.id] ?? 0
    const groupShortages = slice.shortageCountByGroup[group.id] ?? 0

    let patronage = 0
    let loyalty = 0
    const notes: string[] = []

    // Successful repeated experience nudges patronage and loyalty up.
    if (average >= 60 && traffic >= 10) {
      patronage += 2
      loyalty += 1
      notes.push('Group had repeated positive experiences this week.')
    } else if (average >= 70) {
      patronage += 1
    }

    // Repeated dissatisfaction or many shortages erode patronage.
    if (average < 40) {
      patronage -= 2
      loyalty -= 1
      notes.push('Group was dissatisfied this week.')
    } else if (average < 50) {
      patronage -= 1
    }

    if (groupShortages >= 3) {
      patronage -= 1
      notes.push('Repeated shortages discouraged the group.')
    }

    // End-of-week vs start-of-week snapshot — a clear net drop trims
    // patronage even if the in-week average looked fine.
    const satisfactionDrift = endingSatisfaction - startingSatisfaction
    if (satisfactionDrift <= -10) {
      patronage -= 1
      notes.push('Satisfaction dropped sharply across the week.')
    } else if (satisfactionDrift >= 10) {
      loyalty += 1
    }

    const nextPatronage = clampPercent(group.patronage + patronage)
    const nextLoyalty = clampPercent(group.loyalty + loyalty)

    if (
      nextPatronage !== group.patronage ||
      nextLoyalty !== group.loyalty
    ) {
      ctx.modifyCustomerGroup(
        group.id,
        { patronage: nextPatronage, loyalty: nextLoyalty },
        { source: CUSTOMER_SOURCE, reason: 'weekly_trend' },
      )
    }

    entries.push({
      groupId: group.id,
      patronageDelta: nextPatronage - group.patronage,
      loyaltyDelta: nextLoyalty - group.loyalty,
      averageSatisfaction: Math.round(average),
      totalTraffic: traffic,
      shortageCount: groupShortages,
      notes,
    })
  }

  return entries
}
