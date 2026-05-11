// Phase 22 §"Event Types" — seasonal and local event definition shapes.
//
// `activeCalendarTags` is intended to align with the calendar tags
// introduced in Phase 23. Phase 35+ will activate these as live event
// arcs in the simulation.

export type SeasonalEventDefinition = {
  id: string
  label: string
  tags: string[]
  activeMonths: number[]
  activeCalendarTags: string[]
}

export type LocalEventDefinition = {
  id: string
  label: string
  tags: string[]
  relatedFactionIds?: string[]
  relatedCultureIds?: string[]
}
