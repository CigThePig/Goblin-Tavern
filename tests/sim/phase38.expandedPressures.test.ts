import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'

import { areasModule } from '../../src/sim/modules/areas/index'
import { attributionModule } from '../../src/sim/modules/attribution/index'
import { causesModule } from '../../src/sim/modules/causes/index'
import { cultureModule } from '../../src/sim/modules/cultures/index'
import { customersModule } from '../../src/sim/modules/customers/index'
import { factionModule } from '../../src/sim/modules/factions/index'
import { historyModule } from '../../src/sim/modules/history/index'
import { memoriesModule } from '../../src/sim/modules/memories/index'
import { ownerActionsModule } from '../../src/sim/modules/ownerActions/index'
import { regularModule } from '../../src/sim/modules/regulars/index'
import { serviceModule } from '../../src/sim/modules/service/index'
import { staffModule } from '../../src/sim/modules/staff/index'
import { stockModule } from '../../src/sim/modules/stock/index'
import { supplierModule } from '../../src/sim/modules/suppliers/index'
import { weeklyModule } from '../../src/sim/modules/weekly/index'
import { worldModule } from '../../src/sim/modules/world/index'
import {
  EXPANDED_PRESSURE_DEFINITIONS,
  EXPANDED_PRESSURE_IDS,
  PRESSURE_IDS,
  PRESSURES_MODULE_ID,
  buildPressureReport,
  getAllPressureSnapshots,
  getPressureModuleState,
  getPressureSnapshot,
  pressureRegistry,
  pressuresModule,
} from '../../src/sim/modules/pressures/index'
import {
  EXPANDED_FEEDBACK_LOOPS,
  feedbackLoopRegistry,
  feedbackModule,
  getFeedbackModuleState,
} from '../../src/sim/modules/feedback/index'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { AttributionState } from '../../src/sim/modules/attribution/index'
import type {
  RegularWorldState,
  TavernState,
} from '../../src/sim/state/TavernState'

const SEED = 'phase-38-expanded-pressures-test'

const MODULE_SLICE = [
  areasModule,
  stockModule,
  staffModule,
  customersModule,
  worldModule,
  cultureModule,
  factionModule,
  supplierModule,
  regularModule,
  ownerActionsModule,
  serviceModule,
  weeklyModule,
  memoriesModule,
  historyModule,
  causesModule,
  attributionModule,
  pressuresModule,
  feedbackModule,
]

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

function runDay(state: TavernState, overrides: Partial<SimInput> = {}) {
  return simulateDay(state, input(overrides), MODULE_SLICE)
}

function plentyOfStock(state: TavernState): TavernState {
  return {
    ...state,
    stock: {
      ...state.stock,
      ale: { ...state.stock.ale!, quantity: 800, quality: 60 },
      stew: { ...state.stock.stew!, quantity: 400, quality: 60 },
      mushrooms: { ...state.stock.mushrooms!, quantity: 200 },
    },
  }
}

function stampOf(state: TavernState) {
  return {
    year: state.calendar.year,
    month: state.calendar.month,
    week: state.calendar.week,
    day: state.calendar.day,
    absoluteDay: state.calendar.totalDaysElapsed,
  }
}

function seedAttributions(
  state: TavernState,
  attributions: AttributionState[],
): TavernState {
  const existing = (state.modules['attribution'] as
    | {
        attributions: AttributionState[]
        generatedToday: string[]
        lastUpdatedDay: number
      }
    | undefined) ?? {
    attributions: [],
    generatedToday: [],
    lastUpdatedDay: -1,
  }
  return {
    ...state,
    modules: {
      ...state.modules,
      attribution: {
        ...existing,
        attributions: [...existing.attributions, ...attributions],
      },
    },
  }
}

function seedMemories(
  state: TavernState,
  memories: TavernState['memories'],
): TavernState {
  return {
    ...state,
    memories: [...state.memories, ...memories],
  }
}

function injectRegular(
  state: TavernState,
  regular: RegularWorldState,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      regulars: { ...state.world.regulars, [regular.id]: regular },
    },
  }
}

function makeRegular(overrides: Partial<RegularWorldState>): RegularWorldState {
  return {
    id: 'test_regular_brik',
    name: {
      display: 'Brik Tallowmug',
      profileId: 'goblin_common',
      parts: { given: 'Brik', family: 'Tallowmug' },
      patternId: 'given_family',
      generatedBy: 'phase38_test',
    },
    customerGroupId: 'miners',
    loyalty: 65,
    irritation: 30,
    visits: 3,
    knownIncidentIds: [],
    firstSeenDay: 1,
    lastSeenDay: 1,
    tags: ['regular'],
    activeFlags: [],
    ...overrides,
  }
}

// ----------------------------------------------------------------------

describe('Phase 38 §38.1 — Expanded pressure ids', () => {
  it('expanded pressure ids register without removing the canonical ten', () => {
    const allIds = pressureRegistry.all().map((p) => p.id)
    for (const id of PRESSURE_IDS) {
      expect(allIds).toContain(id)
    }
    for (const id of EXPANDED_PRESSURE_IDS) {
      expect(allIds).toContain(id)
    }
    expect(EXPANDED_PRESSURE_DEFINITIONS.length).toBe(EXPANDED_PRESSURE_IDS.length)
  })

  it('initial state seeds expanded pressure ids on state.pressures', () => {
    const state = createInitialTavernState()
    for (const id of EXPANDED_PRESSURE_IDS) {
      expect(state.pressures[id]).toBeDefined()
      expect(state.pressures[id]!.value).toBeGreaterThanOrEqual(0)
    }
  })

  it('after running a day, snapshots exist for every expanded pressure', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(base)
    const slice = getPressureModuleState(result.state)
    for (const id of EXPANDED_PRESSURE_IDS) {
      expect(slice.snapshots[id]).toBeDefined()
    }
  })
})

describe('Phase 38 §38.3 — Supplier distrust pressure', () => {
  it('rises from supplier blame and late-payment memories', () => {
    const base = plentyOfStock(createInitialTavernState())
    const stamp = stampOf(base)
    const supplierId = Object.keys(base.world.suppliers)[0]
    expect(supplierId).toBeDefined()
    const supplierRef = { kind: 'supplier' as const, id: supplierId! }

    const seeded = seedAttributions(base, [
      {
        id: 'attr-supplier-blame-1',
        timestamp: stamp,
        sourceCauseIds: [],
        sourceMemoryIds: [],
        sourceSceneIds: [],
        perceivedBy: { kind: 'customer_group', id: 'miners' },
        target: supplierRef,
        attributionType: 'blame',
        accuracy: 'partial',
        strength: 80,
        confidence: 80,
        publicness: 90,
        volatility: 30,
        readable: 'Suppliers blamed publicly for spoiled goods.',
        tags: ['supplier', 'blame'],
        relatedSystems: ['suppliers'],
        ageDays: 0,
      },
    ])
    const withMemory = seedMemories(seeded, [
      {
        id: 'mem-late-payment-1',
        type: 'grudge',
        strength: 80,
        ageDays: 0,
        createdAt: stamp,
        actors: [supplierRef],
        locations: [],
        relatedSystems: ['suppliers'],
        tags: ['supplier', 'late_payment', 'memory'],
        metadata: {
          subjects: [supplierRef],
          blamed: [{ kind: 'tavern_identity', id: base.meta.tavernId }],
        },
      },
    ])

    const result = runDay(withMemory)
    const snapshot = getPressureSnapshot(result.state, 'supplier_distrust')!
    expect(snapshot).toBeDefined()
    expect(snapshot.value).toBeGreaterThan(0)
    // Should include named-actor causes attached to the supplier.
    const causeReadables = snapshot.causes.map((c) => c.readable).join(' | ')
    expect(causeReadables.toLowerCase()).toMatch(/blame|late payment|delivery|relationship|reliab/)
  })
})

describe('Phase 38 §38.5 — Staff loyalty risk pressure', () => {
  it('rises from public blame and low loyalty', () => {
    const base = plentyOfStock(createInitialTavernState())
    const stamp = stampOf(base)
    const staffId = Object.keys(base.staff)[0]
    expect(staffId).toBeDefined()
    const staffRef = { kind: 'staff' as const, id: staffId! }

    // Lower the staff member's loyalty and morale.
    const withWeakStaff: TavernState = {
      ...base,
      staff: {
        ...base.staff,
        [staffId!]: {
          ...base.staff[staffId!]!,
          loyalty: 20,
          morale: 25,
          paidThisWeek: false,
        },
      },
    }
    const seeded = seedAttributions(withWeakStaff, [
      {
        id: 'attr-staff-blame-1',
        timestamp: stamp,
        sourceCauseIds: [],
        sourceMemoryIds: [],
        sourceSceneIds: [],
        perceivedBy: { kind: 'customer_group', id: 'miners' },
        target: staffRef,
        attributionType: 'blame',
        accuracy: 'partial',
        strength: 80,
        confidence: 80,
        publicness: 90,
        volatility: 30,
        readable: 'Cook publicly blamed for botched service.',
        tags: ['staff', 'blame'],
        relatedSystems: ['staff'],
        ageDays: 0,
      },
    ])

    const result = runDay(seeded)
    const snapshot = getPressureSnapshot(result.state, 'staff_loyalty_risk')!
    expect(snapshot).toBeDefined()
    expect(snapshot.value).toBeGreaterThan(15)
    // Named-entity cause for the staff member should appear.
    expect(
      snapshot.relatedActors.some(
        (a) => a.kind === 'staff' && a.id === staffId,
      ),
    ).toBe(true)
  })
})

describe('Phase 38 §38.4 — Regular customer loss pressure', () => {
  it('rises from ignored regular complaints', () => {
    const base = plentyOfStock(createInitialTavernState())
    const stamp = stampOf(base)
    const regular = makeRegular({ loyalty: 25, irritation: 70 })
    const regularRef = { kind: 'regular' as const, id: regular.id }
    let state = injectRegular(base, regular)
    state = seedMemories(state, [
      {
        id: 'mem-ignored-1',
        type: 'grudge',
        strength: 80,
        ageDays: 0,
        createdAt: stamp,
        actors: [regularRef],
        locations: [],
        relatedSystems: ['regulars'],
        tags: ['regular', 'ignored_complaint', 'memory'],
        metadata: { owner: regularRef },
      },
    ])
    const result = runDay(state)
    const snapshot = getPressureSnapshot(result.state, 'regular_customer_loss')!
    expect(snapshot).toBeDefined()
    expect(snapshot.value).toBeGreaterThan(10)
    expect(
      snapshot.relatedActors.some((a) => a.kind === 'regular' && a.id === regular.id),
    ).toBe(true)
  })
})

describe('Phase 38 §38.6 — Faction anger pressure', () => {
  it('rises when policy backlash is high', () => {
    const base = plentyOfStock(createInitialTavernState())
    // Stamp the policy backlash on-state value so the bleed-in fires.
    const seeded: TavernState = {
      ...base,
      pressures: {
        ...base.pressures,
        policy_backlash: {
          ...base.pressures['policy_backlash']!,
          value: 60,
        },
      },
    }
    const result = runDay(seeded)
    const snapshot = getPressureSnapshot(result.state, 'faction_anger')!
    expect(snapshot).toBeDefined()
    // Confirm a policy-backlash cause appears in the breakdown.
    expect(
      snapshot.causes.some((c) => c.id === 'policy_backlash_bleed'),
    ).toBe(true)
  })
})

describe('Phase 38 §38.9 — Festival readiness pressure', () => {
  it('responds to active festival arc and preparation state', () => {
    const base = plentyOfStock(createInitialTavernState())
    const today = base.calendar.totalDaysElapsed
    const seeded: TavernState = {
      ...base,
      world: {
        ...base.world,
        localEvents: {
          ...base.world.localEvents,
          mushroom_festival_arc: {
            id: 'mushroom_festival_arc',
            definitionId: 'mushroom_festival',
            label: 'Mushroom Festival Approaches',
            startedDay: today,
            intensity: 70,
            relatedFactionIds: [],
            relatedCultureIds: [],
            tags: ['festival'],
            activeFlags: [],
            type: 'festival',
            stage: 'rising',
          },
        },
      },
      // Stock is plenty so we should see arc-driven readiness rather than
      // stock-driven. Then we starve stock to confirm preparation state
      // dominates the breakdown.
      stock: {
        ...base.stock,
        ale: { ...base.stock['ale']!, quantity: 10 },
        stew: { ...base.stock['stew']!, quantity: 5 },
      },
    }
    const result = runDay(seeded)
    const snapshot = getPressureSnapshot(result.state, 'festival_readiness')!
    expect(snapshot).toBeDefined()
    expect(snapshot.value).toBeGreaterThan(0)
    // Arc + low-stock causes should be present.
    expect(
      snapshot.causes.some((c) => c.id === 'festival_arc_active'),
    ).toBe(true)
    expect(
      snapshot.causes.some(
        (c) => c.id === 'low_ale_for_festival' || c.id === 'low_stew_for_festival',
      ),
    ).toBe(true)
  })
})

describe('Phase 38 §38.16 — Pressure report', () => {
  it('renders categorized buckets with named entity causes for expanded pressures', () => {
    const base = plentyOfStock(createInitialTavernState())
    const stamp = stampOf(base)
    const supplierId = Object.keys(base.world.suppliers)[0]!
    const supplierRef = { kind: 'supplier' as const, id: supplierId }
    const seeded = seedAttributions(base, [
      {
        id: 'attr-supplier-blame-2',
        timestamp: stamp,
        sourceCauseIds: [],
        sourceMemoryIds: [],
        sourceSceneIds: [],
        perceivedBy: { kind: 'customer_group', id: 'miners' },
        target: supplierRef,
        attributionType: 'blame',
        accuracy: 'true',
        strength: 90,
        confidence: 80,
        publicness: 95,
        volatility: 20,
        readable: 'Suppliers blamed publicly.',
        tags: ['supplier', 'blame'],
        relatedSystems: ['suppliers'],
        ageDays: 0,
      },
    ])
    const withMemory = seedMemories(seeded, [
      {
        id: 'mem-late-payment-report',
        type: 'grudge',
        strength: 90,
        ageDays: 0,
        createdAt: stamp,
        actors: [supplierRef],
        locations: [],
        relatedSystems: ['suppliers'],
        tags: ['supplier', 'late_payment', 'delivery_dispute', 'memory'],
        metadata: {
          subjects: [supplierRef],
        },
      },
    ])
    const result = runDay(withMemory)
    const report = buildPressureReport({
      state: result.state,
    } as Parameters<typeof buildPressureReport>[0])
    // Should contain at least one category heading and a Market Pressures
    // section because supplier distrust crosses the meaningful threshold.
    const joined = report.lines.join('\n')
    expect(joined).toMatch(/Core Pressures/)
    expect(joined).toMatch(/Market Pressures|Social Pressures/)
    // Report data carries categories.
    const data = report.data as { categories: Record<string, string[]> }
    expect(data.categories.market).toContain('supplier_distrust')
  })
})

describe('Phase 38 §38.15 — Expanded feedback loops', () => {
  it('expanded feedback loops register without removing the canonical six', () => {
    const ids = feedbackLoopRegistry.all().map((l) => l.id)
    for (const def of EXPANDED_FEEDBACK_LOOPS) {
      expect(ids).toContain(def.id)
    }
  })

  it('detects at least one expanded feedback loop when expanded pressures are high', () => {
    // Pressures are recomputed by the pressure module before feedback
    // runs, so seeding state.pressures directly gets overwritten. Seed
    // the underlying world/memory/attribution facts instead, then run
    // until the cascade activates at least one expanded loop.
    let state = plentyOfStock(createInitialTavernState())
    const supplierId = Object.keys(state.world.suppliers)[0]!
    const supplierRef = { kind: 'supplier' as const, id: supplierId }

    // Slash supplier relationships so the calculator produces a high
    // supplier_distrust value.
    state = {
      ...state,
      world: {
        ...state.world,
        suppliers: Object.fromEntries(
          Object.entries(state.world.suppliers).map(([id, supplier]) => [
            id,
            { ...supplier, relationship: 10, reliability: 10 },
          ]),
        ),
      },
      // Starve ale + stew so stock_shortage rises.
      stock: {
        ...state.stock,
        ale: { ...state.stock['ale']!, quantity: 5 },
        stew: { ...state.stock['stew']!, quantity: 2 },
        mushrooms: { ...state.stock['mushrooms']!, quantity: 1 },
      },
    }
    const stamp = stampOf(state)
    state = seedAttributions(state, [
      {
        id: 'attr-cascade-supplier',
        timestamp: stamp,
        sourceCauseIds: [],
        sourceMemoryIds: [],
        sourceSceneIds: [],
        perceivedBy: { kind: 'customer_group', id: 'miners' },
        target: supplierRef,
        attributionType: 'blame',
        accuracy: 'true',
        strength: 100,
        confidence: 90,
        publicness: 100,
        volatility: 30,
        readable: 'Supplier blamed cascade.',
        tags: ['supplier', 'blame'],
        relatedSystems: ['suppliers'],
        ageDays: 0,
      },
    ])
    state = seedMemories(state, [
      {
        id: 'mem-cascade-late',
        type: 'grudge',
        strength: 100,
        ageDays: 0,
        createdAt: stamp,
        actors: [supplierRef],
        locations: [],
        relatedSystems: ['suppliers'],
        tags: ['supplier', 'late_payment', 'delivery_dispute', 'memory'],
        metadata: { subjects: [supplierRef] },
      },
    ])

    // Run a couple of days so the feedback module sees on-state pressure
    // values updated by the previous day's pressure pass.
    let result = runDay(state)
    result = runDay(result.state)
    const feedback = getFeedbackModuleState(result.state)
    expect(feedback.activeLoopIds.length).toBeGreaterThan(0)
    const expandedIds = new Set(EXPANDED_FEEDBACK_LOOPS.map((d) => d.id))
    const anyExpandedActive = feedback.activeLoopIds.some((id) =>
      expandedIds.has(id),
    )
    expect(anyExpandedActive).toBe(true)
  })
})

describe('Phase 38 §38.17 — Determinism', () => {
  it('full simulation remains deterministic across two runs with the same seed', () => {
    const base = plentyOfStock(createInitialTavernState())
    let a = base
    let b = base
    for (let i = 0; i < 5; i += 1) {
      a = runDay(a).state
      b = runDay(b).state
    }
    const snapshotsA = getAllPressureSnapshots(a)
      .map((s) => [s.id, s.value])
      .sort()
    const snapshotsB = getAllPressureSnapshots(b)
      .map((s) => [s.id, s.value])
      .sort()
    expect(snapshotsA).toEqual(snapshotsB)
    // Module slice id stable.
    expect(PRESSURES_MODULE_ID).toBe('pressures')
  })
})
