// Phase 193 / ISSUE-160 — Plan-beat action suggestions.
//
// A pure, deterministic recommender for the ActionPicker's "Suggested"
// section. It takes a stance on what matters *today* using two simple,
// data-driven triggers — it does not optimise, and it authors no copy
// beyond the literal trigger (the Core Design Rule: cards/UI reveal sim
// truth, they don't invent it).
//
//   1. Rising pressure — for each pressure in its danger band (the
//      phase-191 rule: a non-empty `consequences` array, gated by each
//      calculator's own severity threshold), suggest owner actions whose
//      `pressureAffinity` includes that pressure.
//   2. Yesterday's loss — for each stock-quantity loss in yesterday's
//      report, suggest restocking. The reason names the item from state.
//
// Suggestions already queued (in `picks`) are filtered out, so the list
// shrinks reactively as the player taps. Ordering is severity-of-source
// desc, then lowest time cost asc, then a stable insertion tiebreak.

import type { TavernState } from '../../../../src/sim/state/TavernState'
import type { ActionPressureId } from '../../../../src/sim/modules/ownerActions/types'
import {
  actionRegistry,
  type OwnerActionDefinition,
} from '../../../../src/sim/registries/actionRegistry'
import { getAllPressureSnapshots } from '../../../../src/sim/modules/pressures/pressureQueries'
import type { DailyReportData } from '../../../../src/reports/types'

export type SuggestedAction = {
  action: OwnerActionDefinition
  /** Short, literal trigger — e.g. "Food Safety rising", "lost ale yesterday". */
  reason: string
}

/** At most three suggestions, so the section stays a pointer, not a list. */
const MAX_SUGGESTIONS = 3

/** The restock action a stock loss points at. */
const RESTOCK_ACTION_ID = 'restock_item'

type Candidate = {
  action: OwnerActionDefinition
  reason: string
  /** Severity of the source pressure (0 for loss-triggered). Sort key 1, desc. */
  severity: number
  /** Sort key 2, asc — the day budget is time, never action points. */
  timeCost: number
  /** Stable insertion index — deterministic final tiebreak. */
  order: number
}

/**
 * Up to three suggested owner actions for the Plan beat. Pure and
 * deterministic: the same state, picks, and previous report always yield
 * the same list in the same order.
 */
export function suggestActions(
  state: TavernState,
  picks: ReadonlyArray<{ actionId: string }>,
  previousReport?: DailyReportData,
): SuggestedAction[] {
  const takenIds = new Set(picks.map((p) => p.actionId))
  const seen = new Set<string>()
  const candidates: Candidate[] = []
  let order = 0

  const push = (action: OwnerActionDefinition, reason: string, severity: number) => {
    if (takenIds.has(action.id) || seen.has(action.id)) return
    seen.add(action.id)
    candidates.push({ action, reason, severity, timeCost: action.timeCost, order: order++ })
  }

  // 1. Rising-pressure triggers, highest severity first so an action with
  //    affinity to several in-band pressures takes the most urgent reason.
  const inBand = getAllPressureSnapshots(state)
    .filter((s) => s.consequences.length > 0)
    .sort((a, b) => b.severity - a.severity || a.id.localeCompare(b.id))
  for (const snap of inBand) {
    for (const action of actionsForPressure(snap.id)) {
      push(action, `${snap.label} rising`, snap.severity)
    }
  }

  // 2. Yesterday-loss triggers — biggest stock loss first.
  if (previousReport) {
    const losses = previousReport.groupedDiffs.stock
      .filter((d) => d.direction === 'loss' && d.path.endsWith('.quantity'))
      .sort((a, b) => a.delta - b.delta)
    if (losses.length > 0 && actionRegistry.has(RESTOCK_ACTION_ID)) {
      const action = actionRegistry.get(RESTOCK_ACTION_ID)
      for (const loss of losses) {
        const itemId = stockIdFromPath(loss.path)
        if (!itemId) continue
        const label = state.stock[itemId]?.label ?? itemId
        push(action, `lost ${label.toLowerCase()} yesterday`, 0)
      }
    }
  }

  candidates.sort(
    (a, b) => b.severity - a.severity || a.timeCost - b.timeCost || a.order - b.order,
  )

  return candidates.slice(0, MAX_SUGGESTIONS).map((c) => ({ action: c.action, reason: c.reason }))
}

/** Registered actions tagged as relieving `pressureId`, cheapest first. */
function actionsForPressure(pressureId: string): OwnerActionDefinition[] {
  return actionRegistry
    .all()
    .filter((a) => a.pressureAffinity?.includes(pressureId as ActionPressureId))
    .sort((a, b) => a.timeCost - b.timeCost || a.id.localeCompare(b.id))
}

/** `stock.<id>.quantity` → `<id>`. */
function stockIdFromPath(path: string): string | undefined {
  const match = /^stock\.([^.]+)\./.exec(path)
  return match?.[1]
}
