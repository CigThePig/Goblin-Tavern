import type { TavernState } from '../../state/TavernState'
import type { SupplierModuleState } from './types'

// Phase 29 §29.4 — Supplier module slice helpers, mirroring the Phase 9
// stock module pattern. `createInitialSupplierModuleState` seeds an
// empty slice on day zero. `getSupplierModuleState` is the typed
// read-through used by reports and other modules; it returns a
// fresh empty default when the slice has not been seeded so callers
// never receive `undefined`.

export const SUPPLIERS_MODULE_ID = 'suppliers'

export function createInitialSupplierModuleState(): SupplierModuleState {
  return {
    activeMarketConditions: [],
    deliveriesToday: [],
    priceAdjustmentsToday: [],
    missedDeliveriesToday: [],
  }
}

export function getSupplierModuleState(state: TavernState): SupplierModuleState {
  const slice = state.modules[SUPPLIERS_MODULE_ID] as
    | SupplierModuleState
    | undefined
  if (!slice) {
    return createInitialSupplierModuleState()
  }
  return slice
}
