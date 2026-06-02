// Phase 190a / ISSUE-157a — Interconnection primitives: shared types.
//
// The UI is a graph, not a tree (ui-ux-intuitiveness-arc.md §Vision).
// `EntityLink` and `MetricLink` are the carriers: any structured
// reference to an entity (a staff member, a stock item, a faction) or a
// metric (coin, a pressure, a reputation axis) becomes a node the player
// can tap to land on the relevant detail surface.
//
// This module is pure data + pure resolution — no DOM, no Svelte, no
// store import — so both the components and `gameStore.setRoute` can pull
// the routing map without a cycle.

import { stockRegistry } from '../../../../../src/sim/registries/stockRegistry'
import { getOwnerActionsModuleState } from '../../../../../src/sim/modules/ownerActions/ownerActionsModule'
import type { EntityRef, TavernState } from '../../../../../src/sim/state/TavernState'
import type { OwnerActionTargetType } from '../../../../../src/sim/modules/ownerActions/types'
import type { TavernSubview, WorldSubview } from '../../sim/persistence'

/**
 * Every kind below has a confirmed detail surface under
 * `components/tavern/` or `components/world/`. Adding a kind means
 * adding a row to {@link ENTITY_ROUTING} and a branch to
 * {@link entityExists}.
 */
export type EntityKind =
  | 'staff'
  | 'area'
  | 'stock'
  | 'recipe'
  | 'project'
  | 'regular'
  | 'supplier'
  | 'faction'
  | 'culture'
  | 'npc'
  | 'rumour'

export type MetricKind = 'coin' | 'pressure' | 'reputation' | 'inventory'

/** Where each entity kind lives: a top-level route + its home sub-view. */
export type EntityDestination =
  | { route: 'tavern'; subview: TavernSubview }
  | { route: 'world'; subview: WorldSubview }

export const ENTITY_ROUTING: Record<EntityKind, EntityDestination> = {
  staff: { route: 'tavern', subview: 'staff' },
  area: { route: 'tavern', subview: 'areas' },
  stock: { route: 'tavern', subview: 'stock' },
  recipe: { route: 'tavern', subview: 'recipes' },
  project: { route: 'tavern', subview: 'projects' },
  regular: { route: 'world', subview: 'regulars' },
  supplier: { route: 'world', subview: 'suppliers' },
  faction: { route: 'world', subview: 'factions' },
  culture: { route: 'world', subview: 'cultures' },
  npc: { route: 'world', subview: 'npcs' },
  rumour: { route: 'world', subview: 'rumours' },
}

/**
 * True when a concrete entity with this id exists in state right now.
 *
 * The graceful-fallback rule (arc §Cross-cutting constraints): a link to
 * an entity that does not resolve — a staff member who left between
 * reports, or a Tier-4-gated entity that does not yet exist — renders as
 * plain text rather than throwing. An empty id is NOT an entity (callers
 * treat it as a "land on the home tab, no auto-open" navigation hint).
 */
export function entityExists(
  state: TavernState,
  kind: EntityKind,
  id: string,
): boolean {
  if (!id) return false
  try {
    switch (kind) {
      case 'staff':
        return Boolean(state.staff[id])
      case 'area':
        return Boolean(state.areas[id])
      case 'stock':
        return Boolean(state.stock[id]) || stockRegistry.has(id)
      case 'recipe':
        return Boolean(state.recipes?.[id])
      case 'project':
        return Boolean(getOwnerActionsModuleState(state).projects[id])
      case 'regular':
        return Boolean(state.world.regulars[id])
      case 'supplier':
        return Boolean(state.world.suppliers[id])
      case 'faction':
        return Boolean(state.world.factions[id])
      case 'culture':
        return Boolean(state.world.cultures[id])
      case 'npc':
        return Boolean(state.world.notableNpcs[id])
      case 'rumour':
        return Boolean(state.world.socialRumours[id])
      default:
        return false
    }
  } catch {
    // A malformed/partial state slice must never crash a link. Treat an
    // unresolvable reference as plain text.
    return false
  }
}

/**
 * Phase 190b / ISSUE-157b — map an owner-action target type to the
 * `EntityKind` that owns its detail surface. Returns `undefined` for
 * target types with no entity detail sheet (`customer_group`, `policy`,
 * `global`), so a queued-pick label for those falls back to plain text.
 */
export function entityKindFromTargetType(
  t: OwnerActionTargetType,
): EntityKind | undefined {
  switch (t) {
    case 'area':
      return 'area'
    case 'stock':
      return 'stock'
    case 'staff':
      return 'staff'
    case 'regular':
      return 'regular'
    case 'supplier':
      return 'supplier'
    case 'faction':
      return 'faction'
    case 'project':
      return 'project'
    case 'recipe':
      return 'recipe'
    case 'customer_group':
    case 'policy':
    case 'global':
      return undefined
    default:
      return undefined
  }
}

/**
 * Phase 190b / ISSUE-157b — map a sim `EntityRef.kind` to the `EntityKind`
 * that owns its detail surface. Lets a projection that already carries a
 * structured `{ kind, id }` reference (e.g. a seed's `namedEntities`)
 * become an `EntityLink` without re-deriving the kind from prose. Kinds
 * with no detail surface (`role`, `system`, `other`, `customer_group`,
 * `local_event`, `tavern_identity`) return `undefined`.
 */
export function entityKindFromRefKind(
  k: EntityRef['kind'],
): EntityKind | undefined {
  switch (k) {
    case 'staff':
      return 'staff'
    case 'area':
      return 'area'
    case 'stock':
      return 'stock'
    case 'recipe':
      return 'recipe'
    case 'regular':
      return 'regular'
    case 'supplier':
      return 'supplier'
    case 'faction':
      return 'faction'
    case 'culture':
      return 'culture'
    case 'notable_npc':
      return 'npc'
    case 'rumour':
      return 'rumour'
    case 'customer_group':
    case 'role':
    case 'system':
    case 'other':
    case 'local_event':
    case 'tavern_identity':
      return undefined
    default:
      return undefined
  }
}

/**
 * The `CauseDrilldown` path a metric reference opens. Mirrors the diff
 * path scheme the drilldown already understands; `pathToCauseTarget`
 * (src/reports/causeLookup.ts) maps each back to a cause `target`.
 *
 * Returns `undefined` when a kind that needs an id is given none — the
 * caller renders plain text instead of an inert tap target.
 */
export function metricDrilldownPath(
  kind: MetricKind,
  id?: string,
): string | undefined {
  switch (kind) {
    case 'coin':
      return 'coin'
    case 'pressure':
      return id ? `pressures.${id}` : undefined
    case 'reputation':
      return id ? `reputation.${id}` : undefined
    case 'inventory':
      // Aliased to the stock cause target by `pathToCauseTarget`.
      return id ? `inventory.${id}` : undefined
    default:
      return undefined
  }
}
