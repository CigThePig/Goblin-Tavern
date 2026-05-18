// Phase 97 — Pressure → owner-action remedy mapping.
//
// Single source of truth for "which owner action would relieve which
// pressure?". The missed-opportunity projection mines this table when a
// pressure rose without the matching remedial action being applied. The
// mapping is read-only data; tests prove every entry references a real
// action id and every pressure id is accounted for (no silent gaps).
//
// Pressures that have no clean owner-action remedy (violence, landlord,
// supplier_distrust, etc. — these are addressed via seed response slots
// or social actions instead of immediate-category actions) map to an
// empty array. The empty entry is a *tested invariant*: when the sim
// adds a new pressure, the test suite forces us to make a deliberate
// decision rather than silently drop coverage.

import type { EntityRef, TavernState } from '../sim/state/TavernState'
import type { PressureSnapshot } from '../sim/modules/pressures/pressureTypes'

/** A single remedial action paired with target-selection hints. */
export type RemedyEntry = {
  /** Owner-action id from `actionRegistry`. */
  actionId: string
  /** Kind of entity the action targets. `'global'` covers actions with
   *  no targetType (e.g. policies, projects). */
  targetKind: EntityRef['kind'] | 'global'
  /**
   * Hint: prefer a target whose id contains any of these tags/substrings.
   * Falls back to `preferTargetIds` and then any target of the matching
   * kind from the pressure's relatedLocations/relatedActors. Lower-case.
   */
  preferTargetTags?: string[]
  /** Hint: prefer a target with one of these exact ids. */
  preferTargetIds?: string[]
  /**
   * Optional impact multiplier (default 1). Use to bias which remedy
   * wins when multiple actions target the same pressure (e.g. fumigate
   * outranks generic clean when pests are the trigger).
   */
  impactWeight?: number
}

/**
 * Pressure id → ranked remedial actions. Order matters: the first
 * entry whose target is resolvable wins when multiple remedies would
 * apply.
 *
 * The empty arrays are intentional, not gaps:
 *   - `violence` — addressed via seed response slots (ban, threaten,
 *     appease) targeting customer groups, not via a standing immediate
 *     action.
 *   - `reputation_drift` — indirect; surfaced through specific rep diffs.
 *   - `landlord` / `debt_rent` — addressed via rent-due seed slots.
 *   - `supplier_distrust` / `regular_customer_loss` /
 *     `staff_loyalty_risk` / `faction_anger` — relationship-driven, so
 *     remedies are social actions (`comfort_stressed_staff`,
 *     `apologize_to_regular`, `negotiate_with_supplier`,
 *     `host_faction_night`). These are intentionally NOT in the table:
 *     the social-action surface is its own teaching moment via Beat 5's
 *     resolved-intent ledger, and conflating it with the missed-
 *     opportunity affordance would muddy the "you could have queued an
 *     immediate" signal.
 *   - `cultural_tension` / `rival_tavern_pressure` /
 *     `festival_readiness` / `market_instability` / `rumour_pressure` /
 *     `policy_backlash` / `arc_escalation` — strategic or arc-driven;
 *     no single immediate remedy.
 */
export const PRESSURE_REMEDIES: Record<string, readonly RemedyEntry[]> = {
  // ── Core 10 ─────────────────────────────────────────────────────
  food_safety: [
    {
      actionId: 'clean_area',
      targetKind: 'area',
      preferTargetTags: ['kitchen', 'cellar', 'main_room'],
      impactWeight: 1.0,
    },
  ],
  inspection: [
    {
      actionId: 'clean_area',
      targetKind: 'area',
      preferTargetTags: ['kitchen', 'main_room'],
      impactWeight: 0.8,
    },
    {
      actionId: 'repair_area',
      targetKind: 'area',
      impactWeight: 0.7,
    },
  ],
  staff_burnout: [
    {
      actionId: 'pay_staff_bonus',
      targetKind: 'staff',
      impactWeight: 1.0,
    },
  ],
  pests: [
    {
      actionId: 'fumigate_cellar',
      targetKind: 'area',
      preferTargetTags: ['cellar'],
      preferTargetIds: ['cellar'],
      impactWeight: 1.2,
    },
    {
      actionId: 'clean_area',
      targetKind: 'area',
      preferTargetTags: ['cellar', 'kitchen'],
      impactWeight: 0.6,
    },
  ],
  debt: [
    {
      actionId: 'adjust_prices',
      targetKind: 'stock',
      impactWeight: 0.6,
    },
  ],
  maintenance: [
    {
      actionId: 'repair_area',
      targetKind: 'area',
      impactWeight: 1.0,
    },
    {
      actionId: 'patch_roof',
      targetKind: 'area',
      preferTargetTags: ['roof', 'main_room'],
      preferTargetIds: ['main_room'],
      impactWeight: 0.9,
    },
  ],
  violence: [],
  reputation_drift: [],
  stock_shortage: [
    {
      actionId: 'restock_item',
      targetKind: 'stock',
      impactWeight: 1.0,
    },
    {
      actionId: 'buy_mugs',
      targetKind: 'stock',
      preferTargetTags: ['mugs'],
      preferTargetIds: ['mugs'],
      impactWeight: 0.6,
    },
  ],
  landlord: [],
  // ── Expanded 11 ─────────────────────────────────────────────────
  supplier_distrust: [],
  regular_customer_loss: [],
  staff_loyalty_risk: [],
  faction_anger: [],
  cultural_tension: [],
  rival_tavern_pressure: [],
  festival_readiness: [],
  market_instability: [],
  rumour_pressure: [],
  policy_backlash: [],
  arc_escalation: [],
}

/**
 * Resolve the best target for a remedy given a pressure snapshot and the
 * current state. Preference order:
 *   1. `preferTargetIds` if an id of the matching kind exists in state.
 *   2. `preferTargetTags` against the pressure's relatedLocations /
 *      relatedActors of the matching kind (substring match).
 *   3. The first relatedLocation / relatedActor of the matching kind.
 *   4. Any state entity of the matching kind (deterministic order:
 *      ids sorted ascending).
 *
 * Returns `undefined` for global remedies (no specific target) or when
 * no state entity of the matching kind exists.
 */
export function resolveRemedyTarget(
  state: TavernState,
  snapshot: Pick<
    PressureSnapshot,
    'relatedLocations' | 'relatedActors'
  >,
  remedy: RemedyEntry,
): EntityRef | undefined {
  if (remedy.targetKind === 'global') return undefined

  const kind = remedy.targetKind
  const stateIds = idsOfKind(state, kind)
  if (stateIds.length === 0) return undefined

  // 1. preferTargetIds — direct id match against state.
  if (remedy.preferTargetIds) {
    for (const id of remedy.preferTargetIds) {
      if (stateIds.includes(id)) return { kind, id }
    }
  }

  // 2/3. Walk pressure-related refs of the matching kind.
  const related: EntityRef[] = [
    ...snapshot.relatedLocations,
    ...snapshot.relatedActors,
  ]
  const relatedOfKind = related.filter(
    (ref) => ref.kind === kind && stateIds.includes(ref.id),
  )

  if (remedy.preferTargetTags && relatedOfKind.length > 0) {
    for (const tag of remedy.preferTargetTags) {
      const tagLower = tag.toLowerCase()
      const match = relatedOfKind.find((ref) =>
        ref.id.toLowerCase().includes(tagLower),
      )
      if (match) return match
    }
  }

  if (relatedOfKind.length > 0) {
    return relatedOfKind[0]
  }

  // 4. Fall back to a deterministically-picked state entity. Prefer one
  //    whose id matches preferTargetTags if any were given.
  if (remedy.preferTargetTags) {
    for (const tag of remedy.preferTargetTags) {
      const tagLower = tag.toLowerCase()
      const match = stateIds.find((id) => id.toLowerCase().includes(tagLower))
      if (match) return { kind, id: match }
    }
  }

  // Sorted ascending — keeps test output deterministic and predictable.
  const sorted = [...stateIds].sort()
  return { kind, id: sorted[0]! }
}

function idsOfKind(state: TavernState, kind: EntityRef['kind']): string[] {
  switch (kind) {
    case 'area':
      return Object.keys(state.areas)
    case 'stock':
      return Object.keys(state.stock)
    case 'staff':
      return Object.keys(state.staff)
    case 'customer_group':
      return Object.keys(state.customerGroups)
    case 'regular':
      return Object.keys(state.world.regulars)
    case 'supplier':
      return Object.keys(state.world.suppliers)
    case 'faction':
      return Object.keys(state.world.factions)
    case 'culture':
      return Object.keys(state.world.cultures)
    case 'notable_npc':
      return Object.keys(state.world.notableNpcs)
    case 'local_event':
      return Object.keys(state.world.localEvents)
    case 'rumour':
      return Object.keys(state.world.socialRumours)
    case 'recipe':
      return Object.keys(state.recipes)
    default:
      return []
  }
}
