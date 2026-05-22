// Phase 127 / ISSUE-096 — Voiced Surface arc, Phase 1.
//
// One thin wrapper per numeric band signal. Each function reads the
// underlying number off `TavernState` for a given entity id and returns
// the band id via `bandOf` against the signal's threshold pair. Returns
// `undefined` when the entity isn't on state — the dispatcher in
// `query.ts` translates that into `{ missing: true }`.

import type { TavernState } from '../state/TavernState'
import { BAND_THRESHOLDS, bandOf } from './bands'
import type { BandId } from './types'

export function supplierReliabilityBand(
  state: TavernState,
  supplierId: string,
): BandId | undefined {
  const supplier = state.world.suppliers[supplierId]
  if (!supplier) return undefined
  return bandOf(supplier.reliability, BAND_THRESHOLDS['supplier.reliability'])
}

export function supplierRelationshipBand(
  state: TavernState,
  supplierId: string,
): BandId | undefined {
  const supplier = state.world.suppliers[supplierId]
  if (!supplier) return undefined
  return bandOf(supplier.relationship, BAND_THRESHOLDS['supplier.relationship'])
}

export function staffStressBand(
  state: TavernState,
  staffId: string,
): BandId | undefined {
  const staff = state.staff[staffId]
  if (!staff) return undefined
  return bandOf(staff.stress, BAND_THRESHOLDS['staff.stress'])
}

export function staffFatigueBand(
  state: TavernState,
  staffId: string,
): BandId | undefined {
  const staff = state.staff[staffId]
  if (!staff) return undefined
  return bandOf(staff.fatigue, BAND_THRESHOLDS['staff.fatigue'])
}

export function factionRelationshipBand(
  state: TavernState,
  factionId: string,
): BandId | undefined {
  const faction = state.world.factions[factionId]
  if (!faction) return undefined
  return bandOf(faction.relationship, BAND_THRESHOLDS['faction.relationship'])
}

export function factionInfluenceBand(
  state: TavernState,
  factionId: string,
): BandId | undefined {
  const faction = state.world.factions[factionId]
  if (!faction) return undefined
  return bandOf(faction.influence, BAND_THRESHOLDS['faction.influence'])
}

export function areaConditionBand(
  state: TavernState,
  areaId: string,
): BandId | undefined {
  const area = state.areas[areaId]
  if (!area) return undefined
  return bandOf(area.condition, BAND_THRESHOLDS['area.condition'])
}

export function areaCleanlinessBand(
  state: TavernState,
  areaId: string,
): BandId | undefined {
  const area = state.areas[areaId]
  if (!area) return undefined
  return bandOf(area.cleanliness, BAND_THRESHOLDS['area.cleanliness'])
}
