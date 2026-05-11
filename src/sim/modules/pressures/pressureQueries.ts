import type { TavernState } from '../../state/TavernState'
import { PRESSURES_MODULE_ID } from './pressureModule'
import type {
  PressureModuleState,
} from './pressureModule'
import type {
  PressureCauseRef,
  PressureSnapshot,
  PressureTrend,
} from './pressureTypes'

// Phase 18 — Pressure queries.
//
// Pure functions that read the latest pressure snapshots from
// `state.modules.pressures`. They never mutate state and never depend
// on the engine; modules and tests can call them directly.

function readSlice(state: TavernState): PressureModuleState | undefined {
  return state.modules[PRESSURES_MODULE_ID] as PressureModuleState | undefined
}

export function getPressureSnapshot(
  state: TavernState,
  id: string,
): PressureSnapshot | undefined {
  return readSlice(state)?.snapshots[id]
}

export function getAllPressureSnapshots(
  state: TavernState,
): PressureSnapshot[] {
  const slice = readSlice(state)
  if (!slice) return []
  return Object.values(slice.snapshots)
}

export function getPressureTrend(
  state: TavernState,
  id: string,
): PressureTrend {
  return getPressureSnapshot(state, id)?.trend ?? 'stable'
}

export function getDominantPressures(
  state: TavernState,
  limit: number = 3,
): PressureSnapshot[] {
  const all = getAllPressureSnapshots(state)
  all.sort((a, b) => b.value - a.value)
  if (limit <= 0) return []
  return all.slice(0, limit)
}

export function getRisingPressures(
  state: TavernState,
): PressureSnapshot[] {
  return getAllPressureSnapshots(state).filter((p) => p.trend === 'rising')
}

export function getMostUrgentPressures(
  state: TavernState,
  limit: number = 3,
): PressureSnapshot[] {
  const all = getAllPressureSnapshots(state)
  all.sort((a, b) => b.urgency - a.urgency)
  if (limit <= 0) return []
  return all.slice(0, limit)
}

export function getPressureCauses(
  state: TavernState,
  id: string,
): PressureCauseRef[] {
  const snapshot = getPressureSnapshot(state, id)
  if (!snapshot) return []
  return snapshot.causes
}

export function getPressureHistory(
  state: TavernState,
  id: string,
): number[] {
  return readSlice(state)?.history[id] ?? []
}
