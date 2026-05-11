import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'

// Phase 27 §27.4 — Supplier report skeleton. Phase 29 §29.7 fills this
// with active market conditions, unreliable suppliers, missed
// deliveries, and notable price changes.
export function buildSupplierReport(_ctx: SimContext): ReportSection | null {
  return null
}
