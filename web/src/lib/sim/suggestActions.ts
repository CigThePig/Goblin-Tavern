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
import { shortageRemedyFor } from '../../../../src/sim/modules/suppliers/quote'
import type { DailyReportData } from '../../../../src/reports/types'

export type SuggestedAction = {
  action: OwnerActionDefinition
  /** Short, literal trigger — e.g. "Food Safety rising", "lost ale yesterday". */
  reason: string
  /**
   * Phase 203 / audit Wave 4 (`P7-EXP-006`) — the entity the trigger names,
   * when it names one. A stock loss knows exactly which item ran out; the
   * suggestion used to put it in prose and then hand the picker a bare
   * action definition, so tapping it opened all twenty stock targets and
   * the player re-derived what the suggestion already knew.
   *
   * Pressure triggers carry no target: `pressureAffinity` maps an action to
   * a pressure, not to one room or one item, and inventing a target from
   * that would be the card layer asserting sim truth it does not have.
   */
  targetId?: string
  targetLabel?: string
}

/** At most three suggestions, so the section stays a pointer, not a list. */
const MAX_SUGGESTIONS = 3

/** The two channels a stock loss can point at. */
const RESTOCK_ACTION_ID = 'restock_item'
const ORDER_ACTION_ID = 'place_supplier_order'

type Candidate = {
  action: OwnerActionDefinition
  reason: string
  targetId?: string
  targetLabel?: string
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
  picks: ReadonlyArray<{ actionId: string; targetId?: string }>,
  previousReport?: DailyReportData,
): SuggestedAction[] {
  // Phase 203 / audit Wave 4 (`P7-EXP-006`) — identity is action AND
  // target. Two shortages need two remedies; de-duplicating by action id
  // alone collapsed them into one suggestion that named only the first
  // item, and a pick already queued for ale suppressed the suggestion to
  // restock stew.
  const key = (actionId: string, targetId?: string) =>
    targetId ? `${actionId}::${targetId}` : actionId
  const takenIds = new Set(picks.map((p) => key(p.actionId, p.targetId)))
  const seen = new Set<string>()
  const candidates: Candidate[] = []
  let order = 0

  const push = (
    action: OwnerActionDefinition,
    reason: string,
    severity: number,
    target?: { id: string; label: string },
  ) => {
    const k = key(action.id, target?.id)
    // A targeted suggestion is also suppressed by an untargeted pick of
    // the same action, and vice versa — either way the action is on the
    // day's list already.
    if (takenIds.has(k) || takenIds.has(action.id) || seen.has(k)) return
    seen.add(k)
    candidates.push({
      action,
      reason,
      severity,
      timeCost: action.timeCost,
      order: order++,
      ...(target ? { targetId: target.id, targetLabel: target.label } : {}),
    })
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
  //
  // Which remedy is offered comes from the sim (`shortageRemedyFor`), not
  // from this file: the local market only carries common goods, and only so
  // many a day, so an unconditional `restock_item` suggestion sent the
  // player at a `market_exhausted` rejection for every uncommon ingredient
  // and every rare expedition find. A good with no open channel gets no
  // suggestion at all.
  if (previousReport) {
    const losses = previousReport.groupedDiffs.stock
      .filter((d) => d.direction === 'loss' && d.path.endsWith('.quantity'))
      .sort((a, b) => a.delta - b.delta)
    for (const loss of losses) {
      const itemId = stockIdFromPath(loss.path)
      if (!itemId) continue
      const label = state.stock[itemId]?.label ?? itemId
      const reason = `lost ${label.toLowerCase()} yesterday`
      const remedy = shortageRemedyFor(state, itemId)
      if (remedy.kind === 'spot_market' && actionRegistry.has(RESTOCK_ACTION_ID)) {
        push(actionRegistry.get(RESTOCK_ACTION_ID), reason, 0, {
          id: itemId,
          label,
        })
      } else if (
        remedy.kind === 'supplier_order' &&
        actionRegistry.has(ORDER_ACTION_ID)
      ) {
        push(actionRegistry.get(ORDER_ACTION_ID), reason, 0, {
          id: `${remedy.supplierId}:${itemId}`,
          label: `${label} from ${remedy.supplierLabel}`,
        })
      }
    }
  }

  candidates.sort(
    (a, b) => b.severity - a.severity || a.timeCost - b.timeCost || a.order - b.order,
  )

  return candidates.slice(0, MAX_SUGGESTIONS).map((c) => ({
    action: c.action,
    reason: c.reason,
    ...(c.targetId !== undefined
      ? { targetId: c.targetId, targetLabel: c.targetLabel ?? c.targetId }
      : {}),
  }))
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
