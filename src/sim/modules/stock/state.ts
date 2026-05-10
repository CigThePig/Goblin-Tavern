import type { TavernState } from '../../state/TavernState'
import type { StockModuleState } from './types'

// Phase 9 §9.3 — Stock module state lives at `state.modules.stock`.
//
// Phase 6 §6.1.1 deliberately keeps `state.modules` opaque at the type
// level (`Record<string, unknown>`); modules are responsible for the
// shape of their own slice and for registering a schema. This helper
// pair gives the stock module a typed read of its slice, and a fresh
// default for `createInitialTavernState` to seed.

export const STOCK_MODULE_ID = 'stock'

export function createInitialStockModuleState(): StockModuleState {
  return {
    ledger: [],
    shortages: [],
  }
}

export function getStockModuleState(state: TavernState): StockModuleState {
  const slice = state.modules[STOCK_MODULE_ID] as StockModuleState | undefined
  if (!slice) {
    return createInitialStockModuleState()
  }
  return slice
}
