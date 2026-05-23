// Phase 127 / ISSUE-096 — Voiced Surface arc, Phase 1.
//
// Types for the read-only signal surface — the small, pure layer the
// snippet condition DSL queries to gate on real sim facts. Lives outside
// `SimContext` because the card layer is the consumer, not the modules.
// Every signal is a function of (state, entityId) only; no closures, no
// RNG, no calendar mutation, no module dependencies.

import type { EntityRef } from '../state/TavernState'

/** Identifier for a band signal. New band signals add a string here and
 *  a switch arm in `query.ts`. The set is small on purpose — every entry
 *  is a stat the snippet layer might gate a sim-backed line on. */
export type SignalId =
  | 'supplier.reliability'
  | 'supplier.relationship'
  | 'staff.stress'
  | 'staff.fatigue'
  | 'faction.relationship'
  | 'faction.influence'
  | 'area.condition'
  | 'area.cleanliness'
  // Phase 134 / ISSUE-103 — Voiced Surface Phase 8 (Regulars & Complaints)
  // additive loopback. Regulars and customer-group cohorts carry the
  // meters that trigger their respective complaint seeds; the snippet
  // DSL needs bands on them to anchor sim-backed establishing lines.
  | 'regular.irritation'
  | 'regular.loyalty'
  | 'customer_group.satisfaction'
  | 'customer_group.loyalty'
  // Phase 136 / ISSUE-105 — Voiced Surface Phase 10 (Factions & Culture)
  // additive loopback. Cultures carry tension / comfort / familiarity
  // meters: tension fires the seed; the response profiles move all
  // three. The narrator-voiced cultureConflict establishing line gates
  // on these bands so it can state the culture's actual standing.
  | 'culture.tension'
  | 'culture.comfort'
  | 'culture.familiarity'
  // Phase 137 / ISSUE-106 — Voiced Surface Phase 11 (Premises & Atmosphere)
  // additive loopback. The maintenance seed generator picks its target
  // area by `damage + (60 - condition)`; `area.condition` is already a
  // band signal but `area.damage` is not. Without it the establishing
  // line can only state condition, so the broken-floorboards case and
  // the dim-corner case land on the same snippet rung. `area.cleanliness`
  // already covers the atmosphere card's primary meter; smell / risk /
  // mess fold into reaction-line flavor and severityAtLeast.
  | 'area.damage'
  // Phase 138 / ISSUE-107 — Voiced Surface Phase 12 (Crises & Safety)
  // additive loopback. The violence seed picker scores each customer
  // group by `patronage + rowdiness`, so rowdiness is the meter that
  // *triggers* a violence seed. Phase 134 banded satisfaction + loyalty,
  // but neither is what fires the brawl; without a band on rowdiness the
  // violence establishing line can only state pressure or satisfaction
  // proxies. With the band the line can name the room's actual
  // temperature ("the dwarves are seething tonight").
  | 'customer_group.rowdiness'

/** Three-band tiering. Boundaries live in `bands.ts` as data so gates
 *  can enumerate them. Snippets decide what `low` / `high` *means* per
 *  signal (high reliability is good; high stress is bad). */
export type BandId = 'low' | 'mid' | 'high'

/** The dispatcher returns `missing: true` when the entity can't be
 *  resolved, the ref kind doesn't match the signal, or the underlying
 *  field is absent. The snippet condition treats `missing` as "no
 *  match" — never as truth. */
export type SignalResult = { band: BandId } | { missing: true }

/** Convenience: the EntityRef kinds a band signal applies to. The
 *  dispatcher rejects mismatched kinds with `{ missing: true }`. */
export const SIGNAL_ENTITY_KIND: Record<SignalId, EntityRef['kind']> = {
  'supplier.reliability': 'supplier',
  'supplier.relationship': 'supplier',
  'staff.stress': 'staff',
  'staff.fatigue': 'staff',
  'faction.relationship': 'faction',
  'faction.influence': 'faction',
  'area.condition': 'area',
  'area.cleanliness': 'area',
  'regular.irritation': 'regular',
  'regular.loyalty': 'regular',
  'customer_group.satisfaction': 'customer_group',
  'customer_group.loyalty': 'customer_group',
  'culture.tension': 'culture',
  'culture.comfort': 'culture',
  'culture.familiarity': 'culture',
  'area.damage': 'area',
  'customer_group.rowdiness': 'customer_group',
}

/** All band ids enumerated. The gates use this to walk every reachable
 *  band of a signal without having to know the BandId union shape. */
export const ALL_BAND_IDS: readonly BandId[] = ['low', 'mid', 'high']
