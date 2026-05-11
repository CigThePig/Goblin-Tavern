import { createInitialCalendar } from '../modules/calendar/index'
import {
  areaRegistry,
  ensureRequiredAreasRegistered,
} from '../registries/areaRegistry'
import {
  ensureRequiredStockRegistered,
  stockRegistry,
} from '../registries/stockRegistry'
import {
  customerRegistry,
  ensureRequiredCustomerGroupsRegistered,
} from '../registries/customerRegistry'
import {
  ensureRequiredStaffRolesRegistered,
  staffRegistry,
} from '../registries/staffRegistry'
import { createInitialStockModuleState } from '../modules/stock/state'
import { createInitialOwnerActionsModuleState } from '../modules/ownerActions/ownerActionsModule'
import { createInitialWeeklyModuleState } from '../modules/weekly/state'
import { createInitialMonthlyModuleState } from '../modules/monthly/monthlyModule'
import type {
  AreaState,
  CustomerGroupState,
  PressureState,
  ReputationState,
  StaffState,
  StockState,
  TavernState,
} from './TavernState'

// Phase 8 §8.1 — Area defaults are sourced from `areaRegistry` rather than
// inlined. The registry holds the same Phase 5 numbers, so this is a
// consolidation rather than a value change. Importing the registry has the
// side effect of self-registering the five required areas via
// `ensureRequiredAreasRegistered`.
function createInitialAreas(): Record<string, AreaState> {
  ensureRequiredAreasRegistered()
  const areas: Record<string, AreaState> = {}
  for (const def of areaRegistry.all()) {
    areas[def.id] = {
      id: def.id,
      label: def.label,
      tags: [...def.tags],
      ...def.defaultState,
      activeProblems: [...def.defaultState.activeProblems],
    }
  }
  return areas
}

// Phase 9 §9.1 — Stock defaults are sourced from `stockRegistry` rather
// than inlined. The registry holds the Phase 5 quantity/quality/spoilage
// numbers plus the new Phase 9 price/storage fields. Importing the
// registry has the side effect of self-registering the six required
// items via `ensureRequiredStockRegistered`.
function createInitialStock(): Record<string, StockState> {
  ensureRequiredStockRegistered()
  const stock: Record<string, StockState> = {}
  for (const def of stockRegistry.all()) {
    stock[def.id] = {
      id: def.id,
      label: def.label,
      tags: [...def.tags],
      ...def.defaultState,
    }
  }
  return stock
}

// Phase 11 §11.1 — Staff defaults are sourced from `staffRegistry`
// rather than inlined. Each registered role declares the canonical
// staff member it seeds (id, name, base meters, wage) so the engine
// can spawn a working tavern without hard-coded literals. Importing
// the registry has the side effect of self-registering the three
// required roles via `ensureRequiredStaffRolesRegistered`.
function createInitialStaff(): Record<string, StaffState> {
  ensureRequiredStaffRolesRegistered()
  const staff: Record<string, StaffState> = {}
  for (const def of staffRegistry.all()) {
    staff[def.defaultStaffId] = {
      id: def.defaultStaffId,
      name: def.defaultStaffName,
      role: def.id,
      tags: [...def.defaultTags],
      ...def.defaultState,
      activeFlags: [...def.defaultState.activeFlags],
    }
  }
  return staff
}

// Phase 10 §10.1 — Customer-group defaults are sourced from
// `customerRegistry` rather than inlined. The registry holds the Phase 5
// numbers for the existing fields plus the new Phase 10 fields
// (`loyalty`, `preferredStockTags`, `dislikedTags`). Importing the
// registry has the side effect of self-registering the five required
// groups via `ensureRequiredCustomerGroupsRegistered`.
function createInitialCustomerGroups(): Record<string, CustomerGroupState> {
  ensureRequiredCustomerGroupsRegistered()
  const groups: Record<string, CustomerGroupState> = {}
  for (const def of customerRegistry.all()) {
    groups[def.id] = {
      id: def.id,
      label: def.label,
      tags: [...def.tags],
      ...def.defaultState,
      preferredStockTags: [...def.defaultState.preferredStockTags],
      dislikedTags: [...def.defaultState.dislikedTags],
      activeGrudges: [...def.defaultState.activeGrudges],
    }
  }
  return groups
}

function createInitialReputation(): ReputationState {
  return {
    cheap: 60,
    tasty: 35,
    filthy: 65,
    dangerous: 40,
    cozy: 20,
    strange: 35,
    reliable: 30,
    goblinAuthentic: 70,
    // Phase 15 §15.5 — `respectable` joins the canonical axis set. The
    // seed value is intentionally low: the Crooked Keg starts dirty,
    // cheap, and rough — the player must earn respectability.
    respectable: 25,
  }
}

function createInitialPressures(): Record<string, PressureState> {
  const baseValues: Record<string, number> = {
    inspection: 25,
    staff_burnout: 25,
    pests: 35,
    food_safety: 35,
    debt: 10,
    violence: 30,
    structural_decay: 35,
    reputation_drift: 20,
  }

  const labels: Record<string, string> = {
    inspection: 'Inspection',
    staff_burnout: 'Staff Burnout',
    pests: 'Pests',
    food_safety: 'Food Safety',
    debt: 'Debt',
    violence: 'Violence',
    structural_decay: 'Structural Decay',
    reputation_drift: 'Reputation Drift',
  }

  const pressures: Record<string, PressureState> = {}
  for (const id of Object.keys(baseValues)) {
    pressures[id] = {
      id,
      label: labels[id] ?? id,
      value: baseValues[id] ?? 0,
      trend: 0,
      tags: [],
      topCauses: [],
    }
  }
  return pressures
}

export function createInitialTavernState(overrides?: Partial<TavernState>): TavernState {
  const base: TavernState = {
    meta: {
      tavernId: 'the_crooked_keg',
      tavernName: 'The Crooked Keg',
      simVersion: '0.1.0',
      createdAtDay: 0,
    },
    calendar: createInitialCalendar(),
    coin: 100,
    areas: createInitialAreas(),
    stock: createInitialStock(),
    staff: createInitialStaff(),
    customerGroups: createInitialCustomerGroups(),
    reputation: createInitialReputation(),
    memories: [],
    history: [],
    causes: [],
    pressures: createInitialPressures(),
    // Phase 9 §9.3 — `state.modules.stock` is seeded with an empty ledger
    // and an empty shortage list. The slot is owned by the stock module;
    // its state schema (registered on the module) validates this shape via
    // Phase 6 §6.1.1 composition.
    modules: {
      stock: createInitialStockModuleState(),
      // Phase 13 §13.1 — seed an empty owner-actions slice so the
      // module's schema validation passes even on day zero before any
      // input has been processed.
      ownerActions: createInitialOwnerActionsModuleState(),
      // Phase 14 §14.1 — seed an empty weekly slice so the module's
      // schema validates on day zero before any week has accumulated.
      weekly: createInitialWeeklyModuleState(),
      // Phase 15 §15.1 — seed an empty monthly slice (rent, landlord,
      // inspection, rival, accumulator) so the schema validates on day
      // zero before any month has begun.
      monthly: createInitialMonthlyModuleState(),
    },
  }

  if (!overrides) {
    return base
  }

  return { ...base, ...overrides }
}

export function cloneTavernState(state: TavernState): TavernState {
  return structuredClone(state)
}
