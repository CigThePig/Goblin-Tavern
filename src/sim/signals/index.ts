// Phase 127 / ISSUE-096 — Voiced Surface arc, Phase 1.
//
// Single import surface for the signal layer. The snippet DSL imports
// from here; new signals add a re-export below + a switch arm in
// `query.ts`. Everything exported is pure, deterministic over
// `TavernState`, and free of context / RNG dependencies.

export {
  ALL_BAND_IDS,
  SIGNAL_ENTITY_KIND,
  type BandId,
  type SignalId,
  type SignalResult,
} from './types'
export { BAND_THRESHOLDS, bandOf } from './bands'
export {
  areaCleanlinessBand,
  areaConditionBand,
  areaDamageBand,
  cultureComfortBand,
  cultureFamiliarityBand,
  cultureTensionBand,
  customerGroupLoyaltyBand,
  customerGroupRowdinessBand,
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
export { DEFAULT_REPEAT_WINDOW_DAYS, repeatCountByTag } from './repeats'
export {
  pressureIsRising,
  pressureTrend,
  type PressureTrend,
} from './pressures'
export { querySignal } from './query'
