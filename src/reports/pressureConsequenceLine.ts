import type { TavernState } from '../sim/state/TavernState'
import { getPressureSnapshot } from '../sim/modules/pressures/pressureQueries'

// Phase 191 / ISSUE-158 — Pressure stakes projection.
//
// A thin, read-only projection over the pressure module's *existing*
// per-pressure `consequences` — the same data `pressureReport.ts` renders
// in its "If ignored:" block. It authors no new copy.
//
// Why reading `consequences` is the danger-band test (no invented
// threshold): each pressure calculator gates its own `consequences` array
// on its own severity threshold (food safety / debt / violence at
// `severity >= 60`, stock shortage at `>= 50`, market instability at
// `>= 40`, …). Below that band the array is empty. So a non-empty
// `consequences` array *is* the sim's "this pressure is now a danger"
// signal, per-pressure — there is no global `70` to invent, and the web
// layer must not introduce one.

/**
 * The single top consequence line for a pressure — the bad outcome the
 * player is racing against once the pressure enters its danger band.
 *
 * Returns `undefined` when the pressure is unknown or has no authored
 * consequences (i.e. it is below its danger band). Deterministic: the same
 * pressure id and state always yield the same line. No copy is authored
 * here — the line is the sim's `consequences[0]` verbatim.
 */
export function buildPressureConsequenceLine(
  pressureId: string,
  state: TavernState,
): string | undefined {
  const snapshot = getPressureSnapshot(state, pressureId)
  if (!snapshot) return undefined
  const top = snapshot.consequences[0]
  return top && top.length > 0 ? top : undefined
}

/**
 * All authored consequence lines for a pressure, in the sim's order. Used
 * by the drilldown callout, which has room for the full picture where the
 * ribbon shows only the top line. Empty array when the pressure is unknown
 * or below its danger band. Returns a copy so callers cannot mutate state.
 */
export function buildPressureConsequenceLines(
  pressureId: string,
  state: TavernState,
): string[] {
  const snapshot = getPressureSnapshot(state, pressureId)
  if (!snapshot) return []
  return snapshot.consequences.filter((line) => line.length > 0)
}
