import type { TavernState } from '../../state/TavernState'

import type { MonthlyAccumulator, UpgradeReadinessEntry } from './types'

// Phase 15 §15.7 — Upgrade readiness.
//
// Surface possible future improvements based on observed pressures from
// this month. Report-only; no real upgrade purchase system here.

const RELEVANCE_MAJOR = 75
const RELEVANCE_MODERATE = 55
const RELEVANCE_LIGHT = 35

function averageMeter(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function computeUpgradeReadiness(
  state: TavernState,
  accumulator: MonthlyAccumulator,
): UpgradeReadinessEntry[] {
  const entries: UpgradeReadinessEntry[] = []

  // §15.7 — main room upgrade if coin healthy and main_room condition stable
  const mainRoom = state.areas['main_room']
  if (mainRoom && state.coin >= 80 && mainRoom.condition >= 50) {
    entries.push({
      id: 'main_room_upgrade',
      label: 'Main Room Upgrade',
      rationale: `Coin reserves ${state.coin}, main room condition ${mainRoom.condition}.`,
      relevance: RELEVANCE_LIGHT,
    })
  }

  // Reinforced Furniture — heavy damage to main room over the month.
  const damageAverage = averageMeter(accumulator.damageSamples)
  if (damageAverage >= 40 || (mainRoom?.damage ?? 0) >= 50) {
    entries.push({
      id: 'reinforced_furniture',
      label: 'Reinforced Furniture',
      rationale:
        `Average damage across the month was ${Math.round(damageAverage)}; ` +
        `main room damage is ${mainRoom?.damage ?? 0}.`,
      relevance: RELEVANCE_MAJOR,
    })
  }

  // Better Kitchen Tools — heavy stew sales and cook fatigue.
  const cook = state.staff['cook']
  if (cook && cook.fatigue >= 60) {
    entries.push({
      id: 'better_kitchen_tools',
      label: 'Better Kitchen Tools',
      rationale: `Cook fatigue is high (${cook.fatigue}).`,
      relevance: RELEVANCE_MODERATE,
    })
  }

  // Extra Cellar Shelving — recurring shortages.
  if (accumulator.shortageCount >= 8) {
    entries.push({
      id: 'extra_cellar_shelving',
      label: 'Extra Cellar Shelving',
      rationale: `Shortages this month: ${accumulator.shortageCount}.`,
      relevance: RELEVANCE_MAJOR,
    })
  }

  // Larger Ale Storage — ale specifically.
  const ale = state.stock['ale']
  if (ale && ale.quantity <= 20 && accumulator.shortageCount >= 4) {
    entries.push({
      id: 'larger_ale_storage',
      label: 'Larger Ale Storage',
      rationale: `Ale stock is thin (${ale.quantity}); shortages compounded.`,
      relevance: RELEVANCE_MODERATE,
    })
  }

  // Extra Staff — sustained high fatigue across the team.
  const staffArr = Object.values(state.staff)
  const fatigueAvg =
    staffArr.length > 0
      ? staffArr.reduce((sum, s) => sum + s.fatigue, 0) / staffArr.length
      : 0
  if (fatigueAvg >= 60) {
    entries.push({
      id: 'extra_staff',
      label: 'Extra Staff',
      rationale: `Team-wide fatigue average is ${Math.round(fatigueAvg)}.`,
      relevance: RELEVANCE_MODERATE,
    })
  }

  // Security Upgrade — repeated incidents/dangerous reputation.
  if (
    accumulator.incidentCount >= 4 ||
    state.reputation.dangerous >= 60
  ) {
    entries.push({
      id: 'security_upgrade',
      label: 'Security Upgrade',
      rationale:
        `Incidents this month: ${accumulator.incidentCount}; ` +
        `dangerous reputation ${state.reputation.dangerous}.`,
      relevance: RELEVANCE_MAJOR,
    })
  }

  // Sort most-relevant first.
  entries.sort((a, b) => b.relevance - a.relevance)
  return entries
}
