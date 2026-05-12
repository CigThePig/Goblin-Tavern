import type { TavernState } from '../../state/TavernState'
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
  }
}

export function getLocalArcsModuleState(state: TavernState): LocalArcsModuleState {
  const slice = state.modules[LOCAL_ARCS_MODULE_ID] as
    | LocalArcsModuleState
    | undefined
  if (!slice) return createInitialLocalArcsModuleState()
  return slice
}
