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
}

/** All band ids enumerated. The gates use this to walk every reachable
 *  band of a signal without having to know the BandId union shape. */
export const ALL_BAND_IDS: readonly BandId[] = ['low', 'mid', 'high']
