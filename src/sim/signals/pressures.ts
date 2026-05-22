// Phase 127 / ISSUE-096 — Voiced Surface arc, Phase 1.
//
// Thin trend lookup over the pressure module's twin storage shapes. The
// snippet DSL's existing `pressureRising` condition (conditions.ts) and
// this helper read the same data — the signal-surface tests assert
// they agree on every transition, so both surfaces stay consistent.
//
// Storage shapes (canonical source: pressureModule.ts):
//   - `state.modules.pressures.snapshots[id].trend` — enum
//     'rising' | 'stable' | 'falling' set by the pressure module at
//     end-of-day. Authoritative when present.
//   - `state.pressures[id].trend` — number with the same sign semantics
//     (positive ⇒ rising). The lightweight on-state mirror.

import type { TavernState } from '../state/TavernState'

export type PressureTrend = 'rising' | 'stable' | 'falling' | 'unknown'

export function pressureTrend(
  state: TavernState,
  pressureId: string,
): PressureTrend {
  const snapshot = readSnapshot(state, pressureId)
  if (snapshot && snapshot.trend) {
    if (snapshot.trend === 'rising') return 'rising'
    if (snapshot.trend === 'falling') return 'falling'
    if (snapshot.trend === 'stable') return 'stable'
  }
  const pressure = state.pressures[pressureId]
  if (!pressure) return 'unknown'
  if (pressure.trend > 0) return 'rising'
  if (pressure.trend < 0) return 'falling'
  return 'stable'
}

export function pressureIsRising(
  state: TavernState,
  pressureId: string,
): boolean {
  return pressureTrend(state, pressureId) === 'rising'
}

function readSnapshot(
  state: TavernState,
  pressureId: string,
): { trend?: string } | undefined {
  const modules = state.modules as {
    pressures?: { snapshots?: Record<string, { trend?: string }> }
  } | undefined
  return modules?.pressures?.snapshots?.[pressureId]
}
