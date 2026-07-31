import type { TavernState } from '../../state/TavernState'
import type { RegularModuleState } from './types'

// Phase 30 §30.6 — Regulars module state helpers.
//
// The regulars module owns `state.modules.regulars`. The slice starts
// every day empty; the `regularCustomerUpdate` hook fills it with the
// candidates considered, the regulars created, and the regulars who
// visited. Reports and (later) issue seeds read this slice rather than
// recomputing emergence math.

export const REGULARS_MODULE_ID = 'regulars'

export function createInitialRegularModuleState(): RegularModuleState {
  return {
    candidatesToday: [],
    createdToday: [],
    visitedToday: [],
    decayedToday: [],
    // Expansion Phase 4 §4.3 — the visit lifecycle's per-day scratch.
    visitIntents: [],
    outcomes: [],
    stoppedToday: [],
    returnedToday: [],
    requestsOpened: [],
    requestsResolved: [],
  }
}

export function getRegularModuleState(state: TavernState): RegularModuleState {
  const slice = state.modules[REGULARS_MODULE_ID] as RegularModuleState | undefined
  if (!slice) return createInitialRegularModuleState()
  return slice
}
