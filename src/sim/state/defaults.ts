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
import { createInitialCauseModuleState } from '../modules/causes/causeModule'
import { createInitialPressureModuleState } from '../modules/pressures/pressureModule'
import { createInitialFeedbackModuleState } from '../modules/feedback/feedbackLoopModule'
import { createInitialIssueSeedModuleState } from '../modules/issues/issueSeedTypes'
import { createInitialSupplierModuleState } from '../modules/suppliers/state'
import {
  ensureRequiredSuppliersRegistered,
  supplierRegistry,
} from '../content/suppliers/supplierRegistry'
import type {
  AreaState,
  CustomerGroupState,
  PressureState,
  ReputationState,
  StaffState,
  StockState,
  SupplierWorldState,
  TavernState,
  WorldState,
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

// Phase 18 §"Naming reconciliation" — the canonical pressure id set drops
// the `_pressure` suffix used in the Phase 18 doc shorthand. Phase 18
// also folds in `stock_shortage` and `landlord`, and replaces the Phase
// 5 placeholder `structural_decay` with `maintenance` (the broader
// concept covering damage, cleanliness, and repair backlog).
function createInitialPressures(): Record<string, PressureState> {
  const baseValues: Record<string, number> = {
    food_safety: 35,
    inspection: 25,
    staff_burnout: 25,
    pests: 35,
    debt: 10,
    maintenance: 35,
    violence: 30,
    reputation_drift: 20,
    stock_shortage: 20,
    landlord: 20,
  }

  const labels: Record<string, string> = {
    food_safety: 'Food Safety',
    inspection: 'Inspection',
    staff_burnout: 'Staff Burnout',
    pests: 'Pests',
    debt: 'Debt',
    maintenance: 'Maintenance',
    violence: 'Violence',
    reputation_drift: 'Reputation Drift',
    stock_shortage: 'Stock Shortage',
    landlord: 'Landlord',
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

// Phase 29 §29.2 — Seed `state.world.suppliers` from the supplier
// registry. The Phase 22 skeleton reserved the slot empty; Phase 29 fills
// it with the registered starter suppliers so the rest of the simulation
// can read them as persistent world entities. Names are static and
// generated-name-shaped (per §29.2 "Determinism Note") because default
// state generation does not currently accept a seed — true random names
// will be produced later during `identityGeneration` when `ctx.rng` is
// available.
function createInitialSuppliers(): Record<string, SupplierWorldState> {
  ensureRequiredSuppliersRegistered()
  const suppliers: Record<string, SupplierWorldState> = {}
  for (const def of supplierRegistry.all()) {
    suppliers[def.id] = {
      id: def.id,
      label: def.label,
      name: {
        display: def.label,
        profileId: def.namingProfileId,
        parts: {},
        patternId: 'given_family',
        generatedBy: 'supplier_registry',
      },
      supplierType: def.supplierType,
      reliability: def.defaultReliability,
      relationship: def.defaultRelationship,
      debtTolerance: def.defaultDebtTolerance,
      priceBias: def.defaultPriceBias,
      goodsProvided: [...def.goodsProvided],
      ...(def.factionId !== undefined ? { factionId: def.factionId } : {}),
      ...(def.cultureId !== undefined ? { cultureId: def.cultureId } : {}),
      tags: [...def.tags],
      activeFlags: [],
    }
  }
  return suppliers
}

// Phase 25 §"Default World State" / Phase 29 §29.2 — containers for the
// top-level `world` branch. Phase 25 deliberately left every record
// empty; Phase 29 starts seeding the supplier branch from the registry
// so suppliers are persistent simulation facts from day zero. Other
// branches (cultures, factions, regulars, …) fill in later phases.
export function createInitialWorldState(): WorldState {
  return {
    cultures: {},
    factions: {},
    suppliers: createInitialSuppliers(),
    regulars: {},
    notableNpcs: {},
    localEvents: {},
    tavernIdentity: {
      foundingDay: 0,
      knownFor: [],
      houseRules: [],
      atmosphereTags: [],
    },
    socialRumours: {},
  }
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
    // Phase 25 §"Default World State" — empty `world` branch seeded so
    // schemas validate from day zero. Cultures, factions, suppliers,
    // regulars, etc. are added by later phases.
    world: createInitialWorldState(),
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
      // Phase 17 §17.2 — seed an empty causes slice so the schema
      // validates on day zero before any cause has been added.
      causes: createInitialCauseModuleState(),
      // Phase 18 §18.1 — seed empty pressure-module and feedback-loop
      // slices. The first end-of-day pass fills them with snapshots.
      pressures: createInitialPressureModuleState(),
      feedback: createInitialFeedbackModuleState(),
      // Phase 19 — seed an empty issue-seeds slice so the schema
      // validates on day zero before any seed has been generated.
      issueSeeds: createInitialIssueSeedModuleState(),
      // Phase 29 §29.4 — seed an empty supplier slice (no active market
      // conditions, no deliveries today, no price adjustments) so the
      // module's schema validates from day zero.
      suppliers: createInitialSupplierModuleState(),
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
