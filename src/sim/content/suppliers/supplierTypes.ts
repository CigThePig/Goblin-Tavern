// Phase 22 §"Supplier Types" — supplier definition shape.
//
// `goodsProvided` IDs are intended to reference `state.stock` keys such
// as `ale`, `stew`, or `mushrooms` (see `stockRegistry`). Phase 29
// extends this skeleton with `supplierType`, `namingProfileId`,
// `defaultDebtTolerance`, `defaultPriceBias`, and `deliveryPattern`. The
// `label` field stays stable — Phase 29 only adds, never renames.

export type SupplierDefinition = {
  id: string
  label: string
  tags: string[]
  goodsProvided: string[]
  factionId?: string
  cultureId?: string
  defaultReliability: number
  defaultRelationship: number
}
