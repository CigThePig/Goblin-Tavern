import { clampPercent } from '../../state/normalize'
import type { TavernState } from '../../state/TavernState'

import type {
  InspectionResolution,
  InspectionState,
  MonthlyAccumulator,
} from './types'

// Phase 15 §15.4 — Inspection suspicion.
//
// Suspicion accumulates from cleanliness slips, privy smell, food
// spoilage, merchant dissatisfaction, and filthy reputation. It falls
// when the kitchen and privy stay clean and the reliable axis is strong.
//
// Phase 15 §"Inspector Visit Event Deferral" — there is no inspection
// event yet. Pressure is allowed to rise without a discharging event;
// the warningCount surfaces when suspicion crosses the threshold so a
// future Phase 19 seed has a place to anchor.

const WARNING_THRESHOLD = 70

const KITCHEN_FILTHY_HEAVY = 12
const KITCHEN_FILTHY_LIGHT = 5
const PRIVY_STINK_HEAVY = 10
const PRIVY_STINK_LIGHT = 4
const SPOILAGE_RISK = 6
const MERCHANT_UNHAPPY = 5
const FILTHY_REPUTATION_PUSH = 6

const KITCHEN_CLEAN_RELIEF = 6
const PRIVY_CLEAN_RELIEF = 5
const RELIABLE_RELIEF = 5
const REPAIR_BUDGET_RELIEF = 3

export function resolveInspection(
  state: TavernState,
  inspection: InspectionState,
  accumulator: MonthlyAccumulator,
  monthNumber: number,
): { next: InspectionState; resolution: InspectionResolution } {
  const notes: string[] = []
  let delta = 0

  const kitchen = state.areas['kitchen']
  if (kitchen) {
    if (kitchen.cleanliness < 30) {
      delta += KITCHEN_FILTHY_HEAVY
      notes.push(`Kitchen cleanliness very low (${kitchen.cleanliness}).`)
    } else if (kitchen.cleanliness < 50) {
      delta += KITCHEN_FILTHY_LIGHT
      notes.push(`Kitchen cleanliness slipping (${kitchen.cleanliness}).`)
    } else if (kitchen.cleanliness >= 70) {
      delta -= KITCHEN_CLEAN_RELIEF
      notes.push(`Kitchen stayed clean (${kitchen.cleanliness}).`)
    }
  }

  const privy = state.areas['privy']
  if (privy) {
    if (privy.smell >= 75) {
      delta += PRIVY_STINK_HEAVY
      notes.push(`Privy smell very high (${privy.smell}).`)
    } else if (privy.smell >= 60) {
      delta += PRIVY_STINK_LIGHT
      notes.push(`Privy smell elevated (${privy.smell}).`)
    } else if (privy.cleanliness >= 60 && privy.smell <= 40) {
      delta -= PRIVY_CLEAN_RELIEF
      notes.push(`Privy was kept passable.`)
    }
  }

  // Spoilage signal — any food stock with high spoilage flags the kitchen.
  let spoiledCount = 0
  for (const item of Object.values(state.stock)) {
    if (item.spoilage >= 60 && item.tags.includes('food')) spoiledCount += 1
  }
  if (spoiledCount > 0) {
    delta += SPOILAGE_RISK * spoiledCount
    notes.push(`Food spoilage detected on ${spoiledCount} stock item(s).`)
  }

  const merchants = state.customerGroups['merchants']
  if (merchants && merchants.satisfaction < 30) {
    delta += MERCHANT_UNHAPPY
    notes.push(`Merchant complaints (satisfaction ${merchants.satisfaction}).`)
  }

  if (state.reputation.filthy >= 60) {
    delta += FILTHY_REPUTATION_PUSH
    notes.push('Filthy reputation drew inspector interest.')
  }
  if (state.reputation.reliable >= 60) {
    delta -= RELIABLE_RELIEF
    notes.push('Reliable reputation deflected inspector interest.')
  }

  if (accumulator.economy.repairs >= 30) {
    delta -= REPAIR_BUDGET_RELIEF
    notes.push('Repair spending soothed inspection scrutiny.')
  }

  const nextSuspicion = clampPercent(inspection.suspicion + delta)
  const crossedNow =
    inspection.suspicion < WARNING_THRESHOLD && nextSuspicion >= WARNING_THRESHOLD
  const nextWarningCount = crossedNow
    ? inspection.warningCount + 1
    : inspection.warningCount

  if (crossedNow) {
    notes.push(`Inspection suspicion crossed the warning threshold (${WARNING_THRESHOLD}).`)
  }

  return {
    next: {
      suspicion: nextSuspicion,
      lastInspectionMonth: monthNumber,
      warningCount: nextWarningCount,
    },
    resolution: {
      suspicionBefore: inspection.suspicion,
      suspicionAfter: nextSuspicion,
      warningCount: nextWarningCount,
      warningIssuedThisMonth: crossedNow,
      notes,
    },
  }
}
