import type { StockState } from '../../state/TavernState'

// Phase 9 — Stock module types.
//
// `StockDefinition` mirrors the area-registry pattern. `CoinLedgerEntry`
// and `ShortageRecord` are the explicit Phase 9 shapes from §9.3 and §9.6.
// `StockModuleState` is the shape of `state.modules.stock` (Phase 9 §9.3
// "Canonical naming" note).

export type StockDefaultState = Omit<StockState, 'id' | 'label' | 'tags'>

export type StockDefinition = {
  id: string
  label: string
  tags: string[]
  defaultState: StockDefaultState
}

export type CoinLedgerCategory =
  | 'sales'
  | 'purchase'
  | 'wage'
  | 'repair'
  | 'rent'
  | 'waste'
  | 'other'

export type CoinLedgerEntry = {
  source: string
  amount: number
  category: CoinLedgerCategory
  tags: string[]
}

export type ShortageRecord = {
  stockId: string
  requested: number
  available: number
  day: number
  reason: string
}

export type StockModuleState = {
  ledger: CoinLedgerEntry[]
  shortages: ShortageRecord[]
}
