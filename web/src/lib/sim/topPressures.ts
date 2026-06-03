// Phase 192 / ISSUE-159 — shared top-pressure selection.
//
// Single source of truth for "which pressures matter right now", read by
// both the `PressureRibbon` (top 3 rows) and the `TopBar` stakes chip
// (the #1 row). Extracted from the inline ribbon logic so the topbar
// summary can never drift from the ribbon it summarises.
//
// Pure: no DOM, no store. Selection is the ribbon's original rule —
// surface a pressure once it is notable (value ≥ 10) or moving at all
// (non-zero trend); order by value, breaking ties by trend magnitude.

import type { PressureState } from '../../../../src/sim/state/TavernState'

/** Notable enough to surface: meaningful standing value or any movement. */
function isNotable(p: PressureState): boolean {
  return p.value >= 10 || p.trend !== 0
}

/**
 * The top `limit` pressures by value (ties broken by |trend|), filtered to
 * the notable ones. Returns a fresh array; the input map is not mutated.
 */
export function topPressures(
  pressures: Record<string, PressureState>,
  limit = 3,
): PressureState[] {
  return Object.values(pressures)
    .filter(isNotable)
    .sort((a, b) => b.value - a.value || Math.abs(b.trend) - Math.abs(a.trend))
    .slice(0, limit)
}
