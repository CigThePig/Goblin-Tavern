// Phase 22 §"Tavern Atmosphere and Upgrade Types" — area trait shapes.
//
// Phase 28 §28.2 widens this beyond the Phase 22 stub. A Phase 22
// `AreaTraitDefinition` only carried a label and an `affectedAreaTags`
// list; Phase 28 needs `mechanicalTags` so traits can feed reports,
// satisfaction, pressures, and issue seeds, and `allowedAreaTags` /
// `incompatibleTraits` so registration can refuse obviously-broken
// combinations. The Phase 22 field name `affectedAreaTags` is retained
// as an optional alias to keep older imports compiling — its meaning
// overlaps with the new `allowedAreaTags`.

import type { AreaTraitId } from '../../state/TavernState'

export type { AreaTraitId } from '../../state/TavernState'

export type AreaTraitDefinition = {
  id: AreaTraitId
  label: string
  description: string
  /** Area tags this trait can live on. If omitted, the trait is allowed
   *  on any area. */
  allowedAreaTags?: string[]
  /** Trait ids that cannot coexist with this trait on the same area. */
  incompatibleTraits?: AreaTraitId[]
  /** Mechanical tags consumed by reports, customers, pressures, and
   *  later issue seeds. Required because pure-prose traits are
   *  explicitly disallowed by Phase 28 §28.3. */
  mechanicalTags: string[]
  /** @deprecated Phase 22 placeholder retained for backwards-compatible
   *  imports. Prefer `allowedAreaTags`. */
  affectedAreaTags?: string[]
  /** Open tag list for grouping; used by helpers that surface trait
   *  metadata without consulting `mechanicalTags`. */
  tags?: string[]
}
