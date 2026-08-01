import type { TavernState } from '../../state/TavernState'
import type {
  WeeklyEconomyTotals,
  WeeklyModuleState,
  WeeklySignalTotals,
} from './types'
import { emptyEconomyAccounting } from '../economy/state'

// Phase 14 — weekly module state lives at `state.modules.weekly`. The
// shape mirrors how the Phase 9 stock module owns `state.modules.stock`
// and the Phase 11 staff module owns `state.modules.staff`: a single
// typed slice with a creator helper for `createInitialTavernState` to
// seed and a read accessor for callers that need the latest snapshot.

export const WEEKLY_MODULE_ID = 'weekly'

/**
 * Phase 90 — bounded buffer length for `WeeklyModuleState.weeklyHistory`.
 * Keeps the most recent ~3 months on state so the Reports → Weekly
 * screen and future analytics can compare across weeks without
 * unbounded save growth.
 */
export const MAX_WEEKLY_HISTORY = 12

export function emptyEconomyTotals(): WeeklyEconomyTotals {
  return {
    sales: 0,
    purchases: 0,
    repairs: 0,
    wages: 0,
    rent: 0,
    waste: 0,
    other: 0,
    net: 0,
  }
}

export function emptySignalTotals(): WeeklySignalTotals {
  return {
    cheap: 0,
    filthy: 0,
    dangerous: 0,
    tasty: 0,
    reliable: 0,
  }
}

export function createInitialWeeklyModuleState(): WeeklyModuleState {
  return {
    weekKey: '',
    weekNumber: 0,
    monthNumber: 0,
    yearNumber: 0,
    startedOnDay: 0,
    startingSatisfaction: {},
    startingPatronage: {},
    trafficByGroup: {},
    satisfactionSumByGroup: {},
    satisfactionSamplesByGroup: {},
    shortageCountByGroup: {},
    shortageCountByStock: {},
    dayTypeCounts: {},
    economy: emptyEconomyTotals(),
    accounting: emptyEconomyAccounting(),
    salesByStockId: {},
    signals: emptySignalTotals(),
    signalNotes: [],
    weeklyHistory: [],
    supplierInvoices: [],
    weekFinalized: false,
    // Phase 34 §34.1 — community accumulators.
    regularVisitsById: {},
    regularSceneCounts: {},
    groupSceneCounts: {},
    sceneTypeCounts: {},
  }
}

export function getWeeklyModuleState(
  state: { modules: Record<string, unknown> },
): WeeklyModuleState {
  const slice = state.modules[WEEKLY_MODULE_ID] as WeeklyModuleState | undefined
  if (!slice) return createInitialWeeklyModuleState()
  return slice
}

export function formatWeekKey(state: TavernState): string {
  const { year, month, week } = state.calendar
  return `Y${year}-M${month}-W${week}`
}
