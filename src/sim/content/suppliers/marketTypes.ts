// Phase 29 §29.3 — Market condition definition shape.
//
// A market condition is a registry-driven, content-side description of a
// temporary force that bends supplier behaviour: shortages, taxes, road
// hazards, festivals. Runtime instances live on the supplier module
// slice as `ActiveMarketCondition` records and reference these
// definitions by id.
//
// `priceMultiplier` and `availabilityMultiplier` are multiplicative (1 =
// no change). `qualityModifier` is additive on the 0–100 quality scale.
// `affectedStockTags` / `affectedStockIds` are optional filters — a
// condition that omits both targets every supplier good.

export type MarketConditionDefinition = {
  id: string
  label: string
  description: string
  affectedStockTags?: string[]
  affectedStockIds?: string[]
  priceMultiplier?: number
  availabilityMultiplier?: number
  qualityModifier?: number
  pressureTags: string[]
  calendarTags?: string[]
  tags: string[]
}
