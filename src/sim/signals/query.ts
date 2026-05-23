// Phase 127 / ISSUE-096 — Voiced Surface arc, Phase 1.
//
// The unified dispatcher the snippet DSL calls. One switch arm per
// `SignalId`. The dispatcher validates the entity-ref kind against
// `SIGNAL_ENTITY_KIND` and falls through to `{ missing: true }` whenever
// the entity isn't on state — the snippet condition treats that as "no
// match", so unresolvable signals never assert truth.

import type { EntityRef, TavernState } from '../state/TavernState'
import {
  areaCleanlinessBand,
  areaConditionBand,
  areaDamageBand,
  cultureComfortBand,
  cultureFamiliarityBand,
  cultureTensionBand,
  customerGroupLoyaltyBand,
  customerGroupSatisfactionBand,
  factionInfluenceBand,
  factionRelationshipBand,
  regularIrritationBand,
  regularLoyaltyBand,
  staffFatigueBand,
  staffStressBand,
  supplierRelationshipBand,
  supplierReliabilityBand,
} from './numeric'
import { SIGNAL_ENTITY_KIND, type SignalId, type SignalResult } from './types'

export function querySignal(
  state: TavernState,
  signal: SignalId,
  ref: EntityRef,
): SignalResult {
  if (ref.kind !== SIGNAL_ENTITY_KIND[signal]) return { missing: true }
  const band = readBand(state, signal, ref.id)
  if (band === undefined) return { missing: true }
  return { band }
}

function readBand(
  state: TavernState,
  signal: SignalId,
  id: string,
): ReturnType<typeof supplierReliabilityBand> {
  switch (signal) {
    case 'supplier.reliability':
      return supplierReliabilityBand(state, id)
    case 'supplier.relationship':
      return supplierRelationshipBand(state, id)
    case 'staff.stress':
      return staffStressBand(state, id)
    case 'staff.fatigue':
      return staffFatigueBand(state, id)
    case 'faction.relationship':
      return factionRelationshipBand(state, id)
    case 'faction.influence':
      return factionInfluenceBand(state, id)
    case 'area.condition':
      return areaConditionBand(state, id)
    case 'area.cleanliness':
      return areaCleanlinessBand(state, id)
    case 'regular.irritation':
      return regularIrritationBand(state, id)
    case 'regular.loyalty':
      return regularLoyaltyBand(state, id)
    case 'customer_group.satisfaction':
      return customerGroupSatisfactionBand(state, id)
    case 'customer_group.loyalty':
      return customerGroupLoyaltyBand(state, id)
    case 'culture.tension':
      return cultureTensionBand(state, id)
    case 'culture.comfort':
      return cultureComfortBand(state, id)
    case 'culture.familiarity':
      return cultureFamiliarityBand(state, id)
    case 'area.damage':
      return areaDamageBand(state, id)
  }
}
