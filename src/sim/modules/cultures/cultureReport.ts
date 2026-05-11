import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'

// Phase 27 §27.4 — Culture report skeleton.
//
// The culture module does not currently build a report section.
// Phase 30 §30.10 fills this with tension/comfort/calendar summaries.
// The function exists so domain modules have a consistent surface.
export function buildCultureReport(_ctx: SimContext): ReportSection | null {
  return null
}
