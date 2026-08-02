// Phase 195 / ISSUE-162 — Reports → Action conversion.
//
// Maps a `CauseDrilldown` path (the metric or pressure the player is
// looking at) to the context needed to open the ActionPicker against it:
// which category tab to preselect and whether the Suggested section
// should be scrolled into view. Pure + deterministic so the drilldown
// CTA wiring is testable without a DOM.
//
// Honest by omission (arc §Cross-cutting constraints; acceptance #6): a
// path with no owner action that relieves it returns `undefined`, and the
// drilldown renders NO CTA rather than a dead/disabled button. Today only
// pressure paths map — coin and reputation carry no owner-action affinity
// in the model, so they stay silent (silence over noise).

import type { TavernState } from '../../../../src/sim/state/TavernState'
import type {
  ActionPressureId,
  OwnerActionCategory,
} from '../../../../src/sim/modules/ownerActions/types'
import {
  actionRegistry,
  type OwnerActionDefinition,
} from '../../../../src/sim/registries/actionRegistry'
import { getPressureSnapshot } from '../../../../src/sim/modules/pressures/pressureQueries'
import { shortageRemedyFor } from '../../../../src/sim/modules/suppliers/quote'

export type PlanActionCta = {
  /** The action category tab the ActionPicker should open on. */
  tab: OwnerActionCategory
  /**
   * True when a Plan-beat suggestion maps to this source — i.e. the
   * pressure is in its danger band (non-empty `consequences`), which is
   * exactly the gate `suggestActions` uses. The picker then scrolls its
   * Suggested section into view so the recommended remedy is the first
   * thing the player sees.
   */
  focusSuggested: boolean
  /**
   * Phase 203 / audit Wave 4 (`P7-EXP-006`) — the entity the drilldown is
   * about, when the path names one. Carried through the picker request so
   * a shortage in Mushrooms opens the Mushrooms quote instead of a
   * twenty-row stock list the player must search.
   */
  preferredTargetId?: string
  preferredTargetLabel?: string
}

/** The two actions a stock-level drilldown can point at. */
const RESTOCK_ACTION_ID = 'restock_item'
const ORDER_ACTION_ID = 'place_supplier_order'

/**
 * Context for a "Plan an action against this" drilldown CTA, or
 * `undefined` when nothing the player can do maps to this path.
 */
export function planActionCtaForPath(
  path: string | undefined,
  state: TavernState,
): PlanActionCta | undefined {
  if (!path) return undefined
  if (path.startsWith('pressures.')) {
    const id = path.slice('pressures.'.length)
    if (!id) return undefined
    const actions = actionsForPressure(id)
    if (actions.length === 0) return undefined
    const snapshot = getPressureSnapshot(state, id)
    const focusSuggested = (snapshot?.consequences.length ?? 0) > 0
    return { tab: actions[0]!.category, focusSuggested }
  }
  // Phase 203 / audit Wave 4 (`P7-EXP-006`) — a stock path DOES name an
  // owner action, and names the item too. This returned `undefined` for
  // inventory paths, so the audit's shortage route reached the picker
  // through the Suggested list and arrived with the item stripped off.
  //
  // Expansion Phase 6 — which action, though, is the sim's call: the spot
  // market carries common goods only, so an uncommon ingredient's drilldown
  // has to hand off to the supplier order it can actually be bought with,
  // and a rare one with no open channel stays silent rather than opening a
  // picker on a target that always rejects.
  if (path.startsWith('stock.')) {
    const itemId = path.split('.')[1]
    if (!itemId || !state.stock[itemId]) return undefined
    const label = state.stock[itemId]!.label
    const remedy = shortageRemedyFor(state, itemId)
    if (remedy.kind === 'spot_market' && actionRegistry.has(RESTOCK_ACTION_ID)) {
      return {
        tab: actionRegistry.get(RESTOCK_ACTION_ID).category,
        focusSuggested: false,
        preferredTargetId: itemId,
        preferredTargetLabel: label,
      }
    }
    if (remedy.kind === 'supplier_order' && actionRegistry.has(ORDER_ACTION_ID)) {
      return {
        tab: actionRegistry.get(ORDER_ACTION_ID).category,
        focusSuggested: false,
        preferredTargetId: `${remedy.supplierId}:${itemId}`,
        preferredTargetLabel: `${label} from ${remedy.supplierLabel}`,
      }
    }
    return undefined
  }
  // coin / reputation paths: no owner-action affinity in the model maps to
  // them, so there is nothing honest to suggest. Omit.
  return undefined
}

/** Registered actions tagged as relieving `pressureId`, cheapest first.
 *  Mirrors `suggestActions`' ordering so the preselected tab matches the
 *  suggestion the picker will surface. */
function actionsForPressure(pressureId: string): OwnerActionDefinition[] {
  return actionRegistry
    .all()
    .filter((a) => a.pressureAffinity?.includes(pressureId as ActionPressureId))
    .sort((a, b) => a.timeCost - b.timeCost || a.id.localeCompare(b.id))
}
