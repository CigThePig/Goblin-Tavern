import { createInitialCalendar } from '../modules/calendar/index'
import {
  areaRegistry,
  ensureRequiredAreasRegistered,
} from '../registries/areaRegistry'
import {
  ensureRequiredStockRegistered,
  stockRegistry,
} from '../registries/stockRegistry'
import { createInitialStockModuleState } from '../modules/stock/state'
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

function createInitialStaff(): Record<string, StaffState> {
  return {
    cook: {
      id: 'cook',
      name: 'Gribna',
      role: 'cook',
      skill: 55,
      morale: 45,
      stress: 35,
      fatigue: 20,
      loyalty: 50,
      wage: 12,
      tags: [],
      activeProblems: [],
    },
    server: {
      id: 'server',
      name: 'Nix',
      role: 'server',
      skill: 50,
      morale: 50,
      stress: 25,
      fatigue: 20,
      loyalty: 45,
      wage: 10,
      tags: [],
      activeProblems: [],
    },
    cleaner_bouncer: {
      id: 'cleaner_bouncer',
      name: 'Bruk',
      role: 'cleaner_bouncer',
      skill: 45,
      morale: 40,
      stress: 30,
      fatigue: 25,
      loyalty: 55,
      wage: 11,
      tags: [],
      activeProblems: [],
    },
  }
}

function createInitialCustomerGroups(): Record<string, CustomerGroupState> {
  return {
    local_goblins: {
      id: 'local_goblins',
      label: 'Local Goblins',
      patronage: 65,
      satisfaction: 55,
      wealth: 25,
      rowdiness: 50,
      dangerTolerance: 75,
      filthTolerance: 85,
      priceSensitivity: 80,
      damageRisk: 30,
      tabRisk: 35,
      tags: [],
      activeGrudges: [],
    },
    miners: {
      id: 'miners',
      label: 'Miners',
      patronage: 45,
      satisfaction: 50,
      wealth: 45,
      rowdiness: 70,
      dangerTolerance: 70,
      filthTolerance: 60,
      priceSensitivity: 50,
      damageRisk: 55,
      tabRisk: 30,
      tags: [],
      activeGrudges: [],
    },
    merchants: {
      id: 'merchants',
      label: 'Merchants',
      patronage: 25,
      satisfaction: 40,
      wealth: 75,
      rowdiness: 15,
      dangerTolerance: 20,
      filthTolerance: 20,
      priceSensitivity: 35,
      damageRisk: 10,
      tabRisk: 15,
      tags: [],
      activeGrudges: [],
    },
    ogres: {
      id: 'ogres',
      label: 'Ogres',
      patronage: 15,
      satisfaction: 45,
      wealth: 65,
      rowdiness: 90,
      dangerTolerance: 90,
      filthTolerance: 70,
      priceSensitivity: 30,
      damageRisk: 90,
      tabRisk: 25,
      tags: [],
      activeGrudges: [],
    },
    adventurers: {
      id: 'adventurers',
      label: 'Adventurers',
      patronage: 20,
      satisfaction: 50,
      wealth: 70,
      rowdiness: 65,
      dangerTolerance: 95,
      filthTolerance: 45,
      priceSensitivity: 25,
      damageRisk: 60,
      tabRisk: 20,
      tags: [],
      activeGrudges: [],
    },
  }
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
    causes: [],
    pressures: createInitialPressures(),
    // Phase 9 §9.3 — `state.modules.stock` is seeded with an empty ledger
    // and an empty shortage list. The slot is owned by the stock module;
    // its state schema (registered on the module) validates this shape via
    // Phase 6 §6.1.1 composition.
    modules: {
      stock: createInitialStockModuleState(),
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
