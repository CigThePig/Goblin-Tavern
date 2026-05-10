import { cloneTavernState, createInitialTavernState } from '../state/defaults'
import type {
  AreaState,
  CustomerGroupState,
  StaffState,
  StockState,
  TavernState,
} from '../state/TavernState'

// Phase 6 §6 (Agent Execution Checklist step 7) — test state factories.
//
// Build partial test states layered on top of `createInitialTavernState`.
// The point is to construct *just-broken-enough* states for validation
// tests without rewriting the whole default tree by hand.

export function makeTavernState(overrides?: Partial<TavernState>): TavernState {
  return createInitialTavernState(overrides)
}

export function withArea(
  state: TavernState,
  areaId: string,
  patch: Partial<AreaState>,
): TavernState {
  const cloned = cloneTavernState(state)
  const area = cloned.areas[areaId]
  if (!area) {
    throw new Error(`withArea: unknown area '${areaId}'`)
  }
  cloned.areas[areaId] = { ...area, ...patch }
  return cloned
}

export function withStock(
  state: TavernState,
  stockId: string,
  patch: Partial<StockState>,
): TavernState {
  const cloned = cloneTavernState(state)
  const item = cloned.stock[stockId]
  if (!item) {
    throw new Error(`withStock: unknown stock id '${stockId}'`)
  }
  cloned.stock[stockId] = { ...item, ...patch }
  return cloned
}

export function withStaff(
  state: TavernState,
  staffId: string,
  patch: Partial<StaffState>,
): TavernState {
  const cloned = cloneTavernState(state)
  const member = cloned.staff[staffId]
  if (!member) {
    throw new Error(`withStaff: unknown staff id '${staffId}'`)
  }
  cloned.staff[staffId] = { ...member, ...patch }
  return cloned
}

export function withCustomerGroup(
  state: TavernState,
  groupId: string,
  patch: Partial<CustomerGroupState>,
): TavernState {
  const cloned = cloneTavernState(state)
  const group = cloned.customerGroups[groupId]
  if (!group) {
    throw new Error(`withCustomerGroup: unknown group id '${groupId}'`)
  }
  cloned.customerGroups[groupId] = { ...group, ...patch }
  return cloned
}

export function withCoin(state: TavernState, coin: number): TavernState {
  return { ...cloneTavernState(state), coin }
}

export function withModuleState(
  state: TavernState,
  moduleId: string,
  moduleState: unknown,
): TavernState {
  const cloned = cloneTavernState(state)
  cloned.modules = { ...cloned.modules, [moduleId]: moduleState }
  return cloned
}
