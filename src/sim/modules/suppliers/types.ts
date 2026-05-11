// Phase 29 §29.4 — Supplier module state shape.
//
// The supplier module owns a slice at `state.modules.suppliers`. The
// slice tracks runtime market conditions and the per-day delivery /
// price / missed-delivery summaries the supplier report consumes.
//
// Phase 27 reserved an empty slice; Phase 29 widens it. Module schema
// composition (Phase 6 §6.1.1) handles validation: `supplierModule`
// registers `SupplierModuleStateSchema` and the engine wires it into
// the full state schema for every module in the running pipeline.

export type ActiveMarketCondition = {
  /** Definition id from `marketConditionRegistry`. */
  id: string
  startedAtDay: number
  expiresAtDay?: number
  intensity: number
  tags: string[]
}

export type SupplierDeliveryRecord = {
  supplierId: string
  stockId: string
  quantity: number
  quality: number
  coinCost: number
  causeId?: string
  tags: string[]
}

export type SupplierPriceAdjustment = {
  supplierId: string
  stockId: string
  basePrice: number
  effectivePrice: number
  conditionIds: string[]
  tags: string[]
}

export type SupplierMissedDelivery = {
  supplierId: string
  stockId: string
  reason: string
  tags: string[]
}

export type SupplierModuleState = {
  activeMarketConditions: ActiveMarketCondition[]
  deliveriesToday: SupplierDeliveryRecord[]
  priceAdjustmentsToday: SupplierPriceAdjustment[]
  missedDeliveriesToday: SupplierMissedDelivery[]
}
