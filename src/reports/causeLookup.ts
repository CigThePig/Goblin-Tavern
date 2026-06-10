// Phase 89 — Cause lookup helpers for the report layer.
//
// Translates a diff `path` (e.g. `reputation.tasty`) or a pressure id
// into the `CauseEntry.target` shape the sim uses (`reputation:tasty`,
// `pressure:food_safety`), then filters `state.causes` to that target
// for "today" and ranks by weight. Pure functions; no DOM.

import type { CauseEntry, TavernState } from '../sim/state/TavernState'
import { canonicalCauseTarget, targetMatches } from '../sim/modules/causes/causeTargets'

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
  // Phase 190a / ISSUE-157a — `inventory.<itemId>` is a MetricLink alias
  // for a stock item; resolve it before the canonical mapping.
  if (path.startsWith('inventory.')) {
    const rest = path.slice('inventory.'.length)
    const stockId = rest.split('.')[0] ?? rest
    return `stock:${stockId}`
  }
  // Phase 197 / ISSUE-164 — delegate to the shared canonicalizer so this
  // function and causeReport.targetForChange share one mapping.
  return canonicalCauseTarget(path) ?? path
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
    (c) => targetMatches(c.target, target) && c.timestamp.absoluteDay === day,
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
 * Phase 190a / ISSUE-157a — thin metric-cause helpers that mirror
 * `causesForPressure`, so `MetricLink` call sites don't re-encode the
 * path convention. Each is a one-liner over `causesForPath`; they make
 * the drilldown-path surface explicit and independently testable.
 */
export function causesForCoin(
  state: TavernState,
  opts: CauseLookupOptions = {},
): CauseEntry[] {
  return causesForPath(state, 'coin', opts)
}

export function causesForReputationAxis(
  state: TavernState,
  axis: string,
  opts: CauseLookupOptions = {},
): CauseEntry[] {
  return causesForPath(state, `reputation.${axis}`, opts)
}

export function causesForInventory(
  state: TavernState,
  itemId: string,
  opts: CauseLookupOptions = {},
): CauseEntry[] {
  return causesForPath(state, `inventory.${itemId}`, opts)
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
