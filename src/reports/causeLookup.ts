// Phase 89 — Cause lookup helpers for the report layer.
//
// Translates a diff `path` (e.g. `reputation.tasty`) or a pressure id
// into the `CauseEntry.target` shape the sim uses (`reputation:tasty`,
// `pressure:food_safety`), then filters `state.causes` to that target
// for "today" and ranks by weight. Pure functions; no DOM.

import type { CauseEntry, TavernState } from '../sim/state/TavernState'

export type CauseLookupOptions = {
  /** Absolute day to filter on. Defaults to "the day just closed". */
  absoluteDay?: number
  /** Cap on returned causes. */
  limit?: number
}

/**
 * Convert a diff `path` into the `target` string the cause layer uses.
 *
 * The sim uses colon-delimited targets like `reputation:tasty` and
 * `stock:ale`; diffs use dotted paths like `reputation.tasty` and
 * `stock.ale.quantity`. This handles the common cases; uncommon paths
 * fall through to the path itself, which still works as a coarse
 * filter when callers want a fuzzy match.
 */
export function pathToCauseTarget(path: string): string {
  if (path === 'coin') return 'coin'
  if (path.startsWith('reputation.')) {
    const axis = path.slice('reputation.'.length)
    return `reputation:${axis}`
  }
  if (path.startsWith('stock.')) {
    // stock.ale.quantity → stock:ale ; stock.ale → stock:ale
    const rest = path.slice('stock.'.length)
    const stockId = rest.split('.')[0] ?? rest
    return `stock:${stockId}`
  }
  if (path.startsWith('staff.')) {
    const rest = path.slice('staff.'.length)
    const staffId = rest.split('.')[0] ?? rest
    return `staff:${staffId}`
  }
  if (path.startsWith('areas.')) {
    const rest = path.slice('areas.'.length)
    const areaId = rest.split('.')[0] ?? rest
    return `area:${areaId}`
  }
  if (path.startsWith('pressures.')) {
    const rest = path.slice('pressures.'.length)
    const pressureId = rest.split('.')[0] ?? rest
    return `pressure:${pressureId}`
  }
  return path
}

/**
 * Causes that contributed to a given diff path on (by default) the
 * most recently simulated day. Sorted by `weight` desc.
 */
export function causesForPath(
  state: TavernState,
  path: string,
  opts: CauseLookupOptions = {},
): CauseEntry[] {
  const target = pathToCauseTarget(path)
  const day = opts.absoluteDay ?? closedDayAbsolute(state)
  const limit = opts.limit ?? 6
  const matched = state.causes.filter(
    (c) => c.target === target && c.timestamp.absoluteDay === day,
  )
  matched.sort((a, b) => b.weight - a.weight)
  return matched.slice(0, limit)
}

/**
 * Same as `causesForPath` but keyed off a pressure id directly. The
 * report's "what's building" rows pass this rather than re-encoding the
 * pressure-target convention each call site.
 */
export function causesForPressure(
  state: TavernState,
  pressureId: string,
  opts: CauseLookupOptions = {},
): CauseEntry[] {
  return causesForPath(state, `pressures.${pressureId}`, opts)
}

/**
 * The absolute day the most recent simulateDay covered. Because
 * `advanceCalendar` runs as the final phase, the post-day calendar
 * holds `totalDaysElapsed = N` and the day just simulated had
 * `absoluteDay = N - 1`. When the game has never run a day this
 * returns `-1` (callers should treat empty results gracefully).
 */
export function closedDayAbsolute(state: TavernState): number {
  return state.calendar.totalDaysElapsed - 1
}
