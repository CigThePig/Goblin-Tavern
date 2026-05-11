// Phase 27 §27.4 — Supplier module type surface.
//
// Phase 29 §29.4 expands this with active market conditions,
// delivery records, price adjustments, and missed deliveries. Phase
// 27 keeps the slice empty but reserved.

export type SupplierModuleState = Record<string, never>
