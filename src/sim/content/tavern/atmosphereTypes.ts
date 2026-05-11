// Phase 22 §"Tavern Atmosphere and Upgrade Types" — area trait shapes.
//
// Phase 28 wires these into actual area behaviour; Phase 22 only
// prepares the content type space.

export type AreaTraitId = string

export type AreaTraitDefinition = {
  id: AreaTraitId
  label: string
  tags: string[]
  affectedAreaTags: string[]
}
