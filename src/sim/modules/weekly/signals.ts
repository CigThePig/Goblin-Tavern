import type { TavernState } from '../../state/TavernState'
import type { CoinLedgerEntry } from '../stock/types'
import type { WeeklySignalTotals } from './types'

// Phase 14 §14.8 — Reputation signal accumulation.
//
// These helpers compute one day's contribution to the weekly signal
// totals. The accumulators are pure: they receive the current daily
// state plus a few derived inputs and return integer deltas. The weekly
// module sums them across the week and Phase 15 will translate the
// totals into reputation axis shifts.

type DailyAccumInputs = {
  state: TavernState
  dailyLedger: ReadonlyArray<CoinLedgerEntry>
  shortageCount: number
  totalTraffic: number
  damageGained: number
  incidentCount: number
  averageAleSalePrice: number
}

function clampSignal(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(-12, Math.min(12, Math.round(value)))
}

function readAverageMainRoomCleanliness(state: TavernState): number {
  const room = state.areas['main_room']
  return room ? room.cleanliness : 50
}

function readKitchenCleanliness(state: TavernState): number {
  const kitchen = state.areas['kitchen']
  return kitchen ? kitchen.cleanliness : 50
}

function readAverageStewQuality(state: TavernState): number {
  const stew = state.stock['stew']
  if (!stew) return 0
  return stew.quality
}

function readAverageAleQuality(state: TavernState): number {
  const ale = state.stock['ale']
  if (!ale) return 0
  return ale.quality
}

function totalSalesCoin(ledger: ReadonlyArray<CoinLedgerEntry>): number {
  let total = 0
  for (const entry of ledger) {
    if (entry.category === 'sales') total += entry.amount
  }
  return total
}

export function computeDailySignals(
  inputs: DailyAccumInputs,
): { deltas: WeeklySignalTotals; notes: string[] } {
  const notes: string[] = []
  const deltas: WeeklySignalTotals = {
    cheap: 0,
    filthy: 0,
    dangerous: 0,
    tasty: 0,
    reliable: 0,
  }

  // ----- cheap -----
  // Below-average sale prices + nontrivial traffic + actual sales = cheap signal.
  const sales = totalSalesCoin(inputs.dailyLedger)
  if (sales > 0 && inputs.totalTraffic >= 10) {
    if (inputs.averageAleSalePrice <= 2) {
      deltas.cheap += 2
      notes.push('Low ale price drew cheap reputation.')
    } else if (inputs.averageAleSalePrice <= 3) {
      deltas.cheap += 1
    }
  }
  // High traffic across the day with positive sales nudges cheap.
  if (inputs.totalTraffic >= 30 && sales > 0) {
    deltas.cheap += 1
  }

  // ----- filthy -----
  const mainCleanliness = readAverageMainRoomCleanliness(inputs.state)
  const kitchenCleanliness = readKitchenCleanliness(inputs.state)
  if (mainCleanliness < 30) {
    deltas.filthy += 3
    notes.push('Main room cleanliness very low.')
  } else if (mainCleanliness < 50) {
    deltas.filthy += 1
  }
  if (kitchenCleanliness < 30) {
    deltas.filthy += 2
  } else if (kitchenCleanliness < 50) {
    deltas.filthy += 1
  }

  // ----- dangerous -----
  if (inputs.damageGained >= 4) {
    deltas.dangerous += 2
    notes.push('Damage rose noticeably today.')
  } else if (inputs.damageGained >= 1) {
    deltas.dangerous += 1
  }
  if (inputs.incidentCount >= 2) {
    deltas.dangerous += 2
  } else if (inputs.incidentCount === 1) {
    deltas.dangerous += 1
  }

  // ----- tasty -----
  const stewQ = readAverageStewQuality(inputs.state)
  const aleQ = readAverageAleQuality(inputs.state)
  const foodQuality = (stewQ + aleQ) / 2
  if (foodQuality >= 70) {
    deltas.tasty += 2
    notes.push('Stew and ale quality stayed high.')
  } else if (foodQuality >= 55) {
    deltas.tasty += 1
  } else if (foodQuality <= 25) {
    deltas.tasty -= 1
  }

  // ----- reliable -----
  if (inputs.shortageCount === 0 && inputs.totalTraffic > 0) {
    deltas.reliable += 1
  }
  if (inputs.shortageCount >= 1) {
    deltas.reliable -= 1
  }
  if (inputs.shortageCount >= 3) {
    deltas.reliable -= 1
    notes.push('Multiple shortages hurt reliability.')
  }

  // Clamp each axis so a single wild day cannot dominate.
  for (const key of Object.keys(deltas) as Array<keyof WeeklySignalTotals>) {
    deltas[key] = clampSignal(deltas[key])
  }

  return { deltas, notes }
}

export function addSignalTotals(
  target: WeeklySignalTotals,
  patch: WeeklySignalTotals,
): WeeklySignalTotals {
  return {
    cheap: target.cheap + patch.cheap,
    filthy: target.filthy + patch.filthy,
    dangerous: target.dangerous + patch.dangerous,
    tasty: target.tasty + patch.tasty,
    reliable: target.reliable + patch.reliable,
  }
}
