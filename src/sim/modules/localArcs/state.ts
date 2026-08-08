import type { TavernState } from '../../state/TavernState'
import { createInitialArcRunTotals } from './arcRuns'
import {
  LOCAL_ARCS_MODULE_ID,
  type LocalArcsModuleState,
} from './types'

// Phase 35 §35.3 — Module slice helpers. Mirrors the Phase 9 stock
// module pattern (read-through with a fresh empty default).

export function createInitialLocalArcsModuleState(): LocalArcsModuleState {
  return {
    lastMonthlyTickDay: 0,
    activeArcIds: [],
    activeArcTags: [],
    activeIssueSeedTags: [],
    activeMarketConditionIds: [],
    cooldowns: {},
    recentlyAppliedEffects: [],
    monthlyCalendarTagsSeen: [],
    // Expansion Phase 9 §9.2 — the run book.
    runs: {},
    runTotals: createInitialArcRunTotals(),
    earnedLabels: { knownFor: [], houseRules: [] },
  }
}

export function getLocalArcsModuleState(state: TavernState): LocalArcsModuleState {
  const slice = state.modules[LOCAL_ARCS_MODULE_ID] as
    | LocalArcsModuleState
    | undefined
  if (!slice) return createInitialLocalArcsModuleState()
  // Migration: older serialized slices may lack `monthlyCalendarTagsSeen`.
  // Fill in the default so the daily hook and monthly seeding pass can
  // always rely on the field.
  // Expansion Phase 9 §9.2 — and older ones lack the run book entirely.
  // Normalising on read rather than trusting the migration is the same
  // belt-and-braces the Phase 8 domains use: a slice that slipped past
  // `ensureArcProgression` must not throw on its first daily pass.
  if (
    slice.monthlyCalendarTagsSeen === undefined ||
    slice.runs === undefined ||
    slice.runTotals === undefined ||
    slice.earnedLabels === undefined
  ) {
    return {
      ...slice,
      monthlyCalendarTagsSeen: slice.monthlyCalendarTagsSeen ?? [],
      runs: slice.runs ?? {},
      runTotals: { ...createInitialArcRunTotals(), ...(slice.runTotals ?? {}) },
      earnedLabels: slice.earnedLabels ?? { knownFor: [], houseRules: [] },
    }
  }
  return slice
}
