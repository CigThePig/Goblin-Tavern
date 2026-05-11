// Phase 22 §"Tavern Atmosphere and Upgrade Types" — upgrade shape.
//
// Phase 28 §28.2 fills in the operational fields the Phase 22 stub
// reserved. An upgrade needs a coin cost so owner actions can charge
// for it, optional build days so multi-day projects are possible,
// added/removed traits and atmosphere so installing an upgrade actually
// shifts the room's identity, and meter effects so it can move
// condition/cleanliness/etc. without going through a separate effect
// table. `allowedAreaIds` and `allowedAreaTags` together gate where
// each upgrade is permitted.

export type AreaUpgradeId = string

export type AreaUpgradeMeterEffects = Partial<{
  condition: number
  cleanliness: number
  mess: number
  damage: number
  smell: number
  risk: number
}>

export type AreaUpgradeDefinition = {
  id: AreaUpgradeId
  label: string
  description: string
  /** Specific area ids this upgrade can be installed in. If omitted,
   *  `allowedAreaTags` is consulted; if both are omitted, the upgrade
   *  is allowed anywhere. */
  allowedAreaIds?: string[]
  allowedAreaTags?: string[]
  costCoin: number
  /** Days of construction before the upgrade flips from `in_progress`
   *  to `installed`. Omit for instant upgrades. */
  buildDays?: number
  addsTraits?: string[]
  removesTraits?: string[]
  addsAtmosphere?: string[]
  meterEffects?: AreaUpgradeMeterEffects
  /** Mechanical tags used by reports, customers, and pressure
   *  calculators after the upgrade is installed. */
  tags: string[]
  /** @deprecated Phase 22 placeholder — kept so older imports compile.
   *  Prefer the structured `meterEffects` / `addsTraits` fields. */
  effects?: string[]
  /** @deprecated Phase 22 placeholder — superseded by `allowedAreaIds`. */
  areaId?: string
  /** @deprecated Phase 22 placeholder — superseded by `allowedAreaTags`. */
  areaTags?: string[]
}
