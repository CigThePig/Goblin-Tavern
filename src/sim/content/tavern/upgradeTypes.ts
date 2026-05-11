// Phase 22 §"Tavern Atmosphere and Upgrade Types" — upgrade shape.
//
// Phase 28 hooks these into area mechanics; Phase 22 reserves the type
// surface so later phases can register concrete upgrades.

export type AreaUpgradeDefinition = {
  id: string
  label: string
  areaId?: string
  areaTags?: string[]
  tags: string[]
  effects: string[]
}
