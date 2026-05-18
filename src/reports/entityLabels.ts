// Shared entity-label resolution helpers for report-layer projections.
//
// Originally a private pair of functions inside `worldOverviewProjection.ts`.
// Lifted out at Phase 94 so the Tavern Log projection can reuse the same
// `EntityRef` → display-string mapping that the World screen uses. Pure
// helpers — no DOM, no globals, no mutation; same `(state, ref)` ⇒ same
// output.

import { stockRegistry } from '../sim/registries/stockRegistry'
import type { EntityRef, TavernState } from '../sim/state/TavernState'

/**
 * Resolve any `EntityRef` to a readable display string. Falls back to
 * the raw id rather than the word "unknown" — debuggable in dev, and
 * makes mis-typed refs obvious instead of silently disappearing.
 */
export function resolveEntityLabel(state: TavernState, ref: EntityRef): string {
  switch (ref.kind) {
    case 'staff':
      return state.staff[ref.id]?.name.display ?? ref.id
    case 'area':
      return state.areas[ref.id]?.label ?? ref.id
    case 'stock':
      return (
        state.stock[ref.id]?.label ??
        (stockRegistry.has(ref.id) ? stockRegistry.get(ref.id).label : ref.id)
      )
    case 'customer_group':
      return state.customerGroups[ref.id]?.label ?? ref.id
    case 'regular':
      return state.world.regulars[ref.id]?.name.display ?? ref.id
    case 'supplier':
      return (
        state.world.suppliers[ref.id]?.name?.display ??
        state.world.suppliers[ref.id]?.label ??
        ref.id
      )
    case 'faction':
      return state.world.factions[ref.id]?.label ?? ref.id
    case 'culture':
      return state.world.cultures[ref.id]?.label ?? ref.id
    case 'notable_npc':
      return state.world.notableNpcs[ref.id]?.name.display ?? ref.id
    case 'local_event':
      return state.world.localEvents[ref.id]?.label ?? ref.id
    case 'rumour':
      return state.world.socialRumours[ref.id]?.label ?? ref.id
    case 'tavern_identity':
      return 'the tavern'
    case 'recipe':
      return state.recipes[ref.id]?.label ?? ref.id
    case 'role':
      return ref.id
    case 'system':
      return 'the system'
    case 'other':
      return ref.id
    default:
      return ref.id
  }
}

/**
 * Resolve a bare id (no `EntityRef.kind`) against every world slice and
 * staff/customer/area indexes. Used for `SocialRumourState.sourceEntityId`
 * and `targetEntityId`, which store ids without a kind tag. Returns the
 * raw id when no match is found.
 */
export function resolveBareEntityId(state: TavernState, id: string): string {
  return (
    state.world.regulars[id]?.name.display ??
    state.world.notableNpcs[id]?.name.display ??
    state.world.suppliers[id]?.name?.display ??
    state.world.suppliers[id]?.label ??
    state.world.factions[id]?.label ??
    state.world.cultures[id]?.label ??
    state.staff[id]?.name.display ??
    state.customerGroups[id]?.label ??
    state.areas[id]?.label ??
    id
  )
}
