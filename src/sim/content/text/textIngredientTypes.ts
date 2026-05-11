// Phase 22 §"Text Ingredient Types" — shared vocabulary for the later
// card-text-ingredient layer. The Phase 19 issue-seed system already
// carries a `textIngredients`-style concept; these types are a shared
// vocabulary for the Phase 39 expansion, not a replacement.

export type TextIngredientKind =
  | 'staff'
  | 'regular'
  | 'supplier'
  | 'faction'
  | 'culture'
  | 'customer_group'
  | 'area'
  | 'stock'
  | 'calendar_tag'
  | 'market_condition'
  | 'memory'
  | 'cause'
  | 'pressure'

export type TextIngredient = {
  kind: TextIngredientKind
  id: string
  label: string
  tags: string[]
}
