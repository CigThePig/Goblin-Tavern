import { clampPercent } from '../../state/normalize'
import type { TavernState } from '../../state/TavernState'

import type {
  LandlordResolution,
  LandlordState,
  MonthlyAccumulator,
  RentResolution,
} from './types'

// Phase 15 §15.3 — Landlord pressure.
//
// Pressure and opinion are 0–100 meters. Pressure rises when rent slips,
// damage stays visible, reputation drifts dangerous/filthy, or the
// inspection window opens. It falls when rent is paid on time and the
// building looks well-kept. Opinion drifts more slowly than pressure;
// it's the long-term relationship, not the immediate temperature.

const PRESSURE_RENT_MISSED = 25
const PRESSURE_PAID = -6
const PRESSURE_DAMAGE_HEAVY = 6
const PRESSURE_DAMAGE_LIGHT = 3
const PRESSURE_FILTHY = 4
const PRESSURE_DANGEROUS = 4
const PRESSURE_INSPECTION = 5
const PRESSURE_BACKLOG = 3

const OPINION_PAID = 3
const OPINION_MISSED = -5
const OPINION_REPAIR = 4
const OPINION_DAMAGE = -3

function damageSnapshot(state: TavernState): { average: number; max: number } {
  const areas = Object.values(state.areas)
  if (areas.length === 0) return { average: 0, max: 0 }
  let total = 0
  let max = 0
  for (const area of areas) {
    total += area.damage
    if (area.damage > max) max = area.damage
  }
  return { average: total / areas.length, max }
}

export function resolveLandlord(
  state: TavernState,
  landlord: LandlordState,
  rent: RentResolution,
  accumulator: MonthlyAccumulator,
  inspectionSuspicion: number,
): { next: LandlordState; resolution: LandlordResolution } {
  let pressureDelta = 0
  let opinionDelta = 0
  const notes: string[] = []

  if (rent.paid) {
    pressureDelta += PRESSURE_PAID
    opinionDelta += OPINION_PAID
    notes.push('Rent was paid in full.')
  } else {
    pressureDelta += PRESSURE_RENT_MISSED
    opinionDelta += OPINION_MISSED
    notes.push(`Rent was not paid (${rent.amountDue} coin owed).`)
  }

  const damage = damageSnapshot(state)
  // §15.3 — "high damage" means either the average is bad or the most
  // visible room (the worst-damaged area) is past the threshold. A
  // single rotted main room is enough to draw the landlord's eye even
  // if the rest of the building is fine.
  if (damage.average >= 50 || damage.max >= 70) {
    pressureDelta += PRESSURE_DAMAGE_HEAVY
    opinionDelta += OPINION_DAMAGE
    notes.push(
      `Building damage is heavy (avg ${Math.round(damage.average)}, worst ${damage.max}).`,
    )
  } else if (damage.max >= 50) {
    pressureDelta += PRESSURE_DAMAGE_LIGHT
    notes.push(`Visible damage (worst ${damage.max}).`)
  }

  if (state.reputation.filthy >= 60) {
    pressureDelta += PRESSURE_FILTHY
    notes.push('Filthy reputation reached the landlord.')
  }
  if (state.reputation.dangerous >= 60) {
    pressureDelta += PRESSURE_DANGEROUS
    notes.push('Dangerous reputation reached the landlord.')
  }
  if (inspectionSuspicion >= 60) {
    pressureDelta += PRESSURE_INSPECTION
    notes.push('Inspection suspicion attracts the landlord\'s attention.')
  }

  if (accumulator.economy.repairs >= 30) {
    opinionDelta += OPINION_REPAIR
    notes.push(
      `Repairs spent this month (${Math.round(accumulator.economy.repairs)} coin) reassured the landlord.`,
    )
  }

  if (landlord.missedRentCount >= 2) {
    pressureDelta += PRESSURE_BACKLOG
    notes.push(`Backlog of ${landlord.missedRentCount} missed payments.`)
  }

  const nextOpinion = clampPercent(landlord.opinion + opinionDelta)
  const nextPressure = clampPercent(landlord.pressure + pressureDelta)
  const nextMissed = rent.paid
    ? landlord.missedRentCount
    : landlord.missedRentCount + 1

  return {
    next: {
      opinion: nextOpinion,
      pressure: nextPressure,
      missedRentCount: nextMissed,
    },
    resolution: {
      opinionBefore: landlord.opinion,
      opinionAfter: nextOpinion,
      pressureBefore: landlord.pressure,
      pressureAfter: nextPressure,
      notes,
    },
  }
}
