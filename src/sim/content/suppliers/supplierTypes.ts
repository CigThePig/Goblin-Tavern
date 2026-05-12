// Phase 22 §"Supplier Types" — supplier definition shape.
// Phase 29 §29.1 — extended with operational fields.
//
// `goodsProvided` IDs reference `state.stock` keys such as `ale`, `stew`,
// or `mushrooms` (see `stockRegistry`). Phase 26 cross-reference
// validation rejects suppliers that provide unknown stock ids.
//
// `supplierType` is a free string label (e.g. `food_cart`, `brewer`,
// `caravan`, `peddler`, `butcher_or_salvage_food`). It is not registry-
// backed in Phase 29; later phases may introduce a `supplierTypeRegistry`
// if behaviour starts to fork by type.
//
// `deliveryPattern` is likewise a free string. Phase 29 only records it
// on the definition; future phases will read it from
// `supplierModule.supplierUpdate` to schedule deliveries.

export type SupplierTypeId = string
export type DeliveryPatternId = string

export type SupplierDefinition = {
  id: string
  label: string
  supplierType: SupplierTypeId
  namingProfileId: string
  goodsProvided: string[]
  defaultReliability: number
  defaultRelationship: number
  defaultDebtTolerance: number
  defaultPriceBias: number
  deliveryPattern: DeliveryPatternId
  factionId?: string
  cultureId?: string
  tags: string[]
}
