import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput, SimInputOwnerAction } from '../../src/sim/core/context'

import { areasModule } from '../../src/sim/modules/areas/index'
import { causesModule } from '../../src/sim/modules/causes/index'
import { cultureModule } from '../../src/sim/modules/cultures/index'
import { customersModule } from '../../src/sim/modules/customers/index'
import { factionModule } from '../../src/sim/modules/factions/index'
import { historyModule } from '../../src/sim/modules/history/index'
import {
  detectPatterns,
  memoriesAboutEntity,
  memoriesForOwner,
  memoriesModule,
  memoryBelongsTo,
  memoryOwner,
  withEntityMemoryMetadata,
  type EntityMemoryMetadata,
} from '../../src/sim/modules/memories/index'
import { ownerActionsModule } from '../../src/sim/modules/ownerActions/index'
import { regularModule } from '../../src/sim/modules/regulars/index'
import { serviceModule } from '../../src/sim/modules/service/index'
import { staffModule } from '../../src/sim/modules/staff/index'
import { stockModule } from '../../src/sim/modules/stock/index'
import { supplierModule } from '../../src/sim/modules/suppliers/index'
import { weeklyModule } from '../../src/sim/modules/weekly/index'
import { worldModule } from '../../src/sim/modules/world/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  withCoin,
  withStock,
} from '../../src/sim/testing/stateFactories'
import type {
  EntityRef,
  MemoryState,
  RegularWorldState,
  TavernState,
} from '../../src/sim/state/TavernState'
import { buildMemoryReport } from '../../src/sim/modules/memories/memoryReport'

// Phase 36 — Character, Faction, and Relationship Memory.
//
// The plan §36.8 lists eight required tests. The suite below maps each:
//   1. addEntityMemory stores owner metadata and preserves existing fields.
//   2. memoriesForOwner returns memories owned by a staff member.
//   3. memoriesAboutEntity finds memories where an entity is blamed or credited.
//   4. Expired / weak memories can be filtered out.
//   5. Pattern detection creates `staff_feels_scapegoated` when repeated.
//   6. Supplier distrust pattern emerges from repeated supplier memories.
//   7. Memory report exposes important named-entity memories without dumping
//      every low-strength entry.
//   8. Full simulation remains deterministic with entity memory creation.

const SEED = 'phase-36-entity-memory-test'

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
  memoriesModule,
  historyModule,
  causesModule,
  weeklyModule,
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

function runWeek(
  state: TavernState,
  perDayActions?: ReadonlyArray<ReadonlyArray<SimInputOwnerAction>>,
): TavernState {
  let current = state
  for (let i = 0; i < 7; i += 1) {
    const actions = perDayActions?.[i] ?? []
    current = runDay(current, { ownerActions: actions }).state
  }
  return current
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
    id: 'test_regular',
    name: {
      display: 'Brik Tallowmug',
      profileId: 'goblin_common',
      parts: { given: 'Brik', family: 'Tallowmug' },
      patternId: 'given_family',
      generatedBy: 'phase36_test',
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

// Inject a synthetic memory into the on-state memory list. Used by tests
// that want to exercise pattern detection without driving the simulation
// long enough to fire the underlying signals organically.
function injectMemory(state: TavernState, memory: MemoryState): TavernState {
  return { ...state, memories: [...state.memories, memory] }
}

function makeMemory(overrides: Partial<MemoryState> & { id: string }): MemoryState {
  return {
    type: 'timed',
    strength: 50,
    ageDays: 0,
    createdAt: {
      year: 0,
      month: 0,
      week: 0,
      day: 0,
      absoluteDay: 0,
    },
    actors: [],
    locations: [],
    relatedSystems: [],
    tags: [],
    ...overrides,
  } as MemoryState
}

const COOK_REF: EntityRef = { kind: 'staff', id: 'cook' }
const TAVERN_REF: EntityRef = { kind: 'tavern_identity', id: 'goblin_tavern' }

describe('Phase 36 §36.1 — withEntityMemoryMetadata', () => {
  it('attaches owner metadata and preserves existing draft fields', () => {
    const draft = withEntityMemoryMetadata(
      {
        id: 'staff_publicly_blamed',
        tags: ['staff'],
        metadata: { existing: 'value' },
      },
      {
        owner: COOK_REF,
        blamed: [COOK_REF],
        targets: [TAVERN_REF],
      },
    )
    const meta = draft.metadata as EntityMemoryMetadata & {
      existing: string
    }
    expect(meta.owner).toEqual(COOK_REF)
    expect(meta.blamed).toEqual([COOK_REF])
    expect(meta.targets).toEqual([TAVERN_REF])
    expect(meta.existing).toBe('value')
    expect(draft.tags).toEqual(['staff'])
  })
})

describe('Phase 36 §36.2 — entity memory queries', () => {
  it('memoriesForOwner returns memories owned by a staff member', () => {
    const memories: MemoryState[] = [
      makeMemory({
        id: 'staff_publicly_blamed',
        actors: [COOK_REF],
        metadata: { owner: COOK_REF } satisfies EntityMemoryMetadata,
        tags: ['staff', 'blame'],
      }),
      makeMemory({
        id: 'random_tavern_memory',
        tags: ['system'],
      }),
    ]
    const matches = memoriesForOwner(memories, COOK_REF)
    expect(matches.map((m) => m.id)).toEqual(['staff_publicly_blamed'])
    expect(memoryBelongsTo(matches[0]!, COOK_REF)).toBe(true)
    expect(memoryOwner(matches[0]!)).toEqual(COOK_REF)
  })

  it('memoriesAboutEntity finds memories where the entity is blamed or credited', () => {
    const supplier: EntityRef = { kind: 'supplier', id: 'brakka_mushroom_cart' }
    const memories: MemoryState[] = [
      makeMemory({
        id: 'supplier_blamed_for_bad_stock',
        actors: [supplier],
        metadata: {
          owner: supplier,
          blamed: [TAVERN_REF],
          subjects: [supplier],
        } satisfies EntityMemoryMetadata,
        tags: ['supplier', 'blame'],
      }),
      makeMemory({
        id: 'supplier_given_fair_deal',
        actors: [supplier],
        metadata: {
          owner: supplier,
          credited: [TAVERN_REF],
        } satisfies EntityMemoryMetadata,
        tags: ['supplier', 'gratitude'],
      }),
    ]
    const tavernMatches = memoriesAboutEntity(memories, TAVERN_REF)
    expect(tavernMatches.map((m) => m.id).sort()).toEqual(
      ['supplier_blamed_for_bad_stock', 'supplier_given_fair_deal'].sort(),
    )
    const supplierMatches = memoriesAboutEntity(memories, supplier)
    expect(supplierMatches.length).toBe(2)
  })

  it('filters out expired or low-strength memories by default', () => {
    const memories: MemoryState[] = [
      makeMemory({
        id: 'fresh_memory',
        strength: 60,
        durationDays: 14,
        ageDays: 5,
        actors: [COOK_REF],
        tags: ['staff'],
      }),
      makeMemory({
        id: 'expired_memory',
        strength: 60,
        durationDays: 5,
        ageDays: 10,
        actors: [COOK_REF],
        tags: ['staff'],
      }),
      makeMemory({
        id: 'weak_memory',
        strength: 10,
        actors: [COOK_REF],
        tags: ['staff'],
      }),
    ]
    const defaults = memoriesForOwner(memories, COOK_REF).map((m) => m.id)
    expect(defaults).toContain('fresh_memory')
    expect(defaults).not.toContain('expired_memory')

    const withExpired = memoriesForOwner(memories, COOK_REF, {
      includeExpired: true,
    }).map((m) => m.id)
    expect(withExpired).toContain('expired_memory')

    const strong = memoriesForOwner(memories, COOK_REF, {
      minStrength: 40,
    }).map((m) => m.id)
    expect(strong).toContain('fresh_memory')
    expect(strong).not.toContain('weak_memory')
  })
})

describe('Phase 36 §36.4 — ctx.addEntityMemory wiring', () => {
  it('stores owner metadata and adds the owner to actors via the context helper', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 200))
    const apology: SimInputOwnerAction = {
      actionId: 'apologize_to_regular',
      targetId: 'test_regular',
    }
    const seeded = injectRegular(
      base,
      makeRegular({ irritation: 60, loyalty: 60 }),
    )
    const week = runWeek(seeded, [[apology]])
    const regularRef: EntityRef = { kind: 'regular', id: 'test_regular' }
    const matches = memoriesForOwner(week, regularRef)
    expect(matches.length).toBeGreaterThan(0)
    const helped = matches.find((m) => m.definitionId === 'regular_helped_by_owner')
    expect(helped).toBeDefined()
    expect(memoryOwner(helped!)).toEqual(regularRef)
    // The helper should also append the owner ref to `actors` so the
    // legacy actor query keeps working.
    expect(
      helped!.actors.some(
        (a) => a.kind === regularRef.kind && a.id === regularRef.id,
      ),
    ).toBe(true)
  })
})

describe('Phase 36 §36.6 — Entity-focused pattern detection', () => {
  it('emits staff_feels_scapegoated when a staff member is repeatedly blamed', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 200))
    const owner: EntityMemoryMetadata = { owner: COOK_REF }
    const blame1 = makeMemory({
      id: 'staff_publicly_blamed__cook_a',
      definitionId: 'staff_publicly_blamed',
      type: 'grudge',
      strength: 45,
      actors: [COOK_REF],
      tags: ['staff', 'blame', 'morale'],
      relatedSystems: ['staff'],
      metadata: owner,
      createdAt: {
        year: 0,
        month: 0,
        week: 0,
        day: 0,
        absoluteDay: base.calendar.totalDaysElapsed,
      },
    })
    const blame2 = makeMemory({
      id: 'staff_publicly_blamed__cook_b',
      definitionId: 'staff_publicly_blamed',
      type: 'grudge',
      strength: 45,
      actors: [COOK_REF],
      tags: ['staff', 'blame', 'morale'],
      relatedSystems: ['staff'],
      metadata: owner,
      createdAt: {
        year: 0,
        month: 0,
        week: 0,
        day: 0,
        absoluteDay: base.calendar.totalDaysElapsed,
      },
    })
    const seeded = injectMemory(injectMemory(base, blame1), blame2)
    const drafts = detectPatterns(seeded)
    const scapegoatDraft = drafts.find((d) =>
      d.id.startsWith('staff_feels_scapegoated__'),
    )
    expect(scapegoatDraft).toBeDefined()
    expect(scapegoatDraft!.actors).toEqual([COOK_REF])
  })

  it('emits supplier_distrust_pattern when a supplier accumulates multiple negative signals', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 200))
    const supplier: EntityRef = {
      kind: 'supplier',
      id: 'brakka_mushroom_cart',
    }
    const ownerMeta: EntityMemoryMetadata = { owner: supplier }
    const m1 = makeMemory({
      id: 'supplier_paid_late__brakka',
      definitionId: 'supplier_paid_late',
      type: 'grudge',
      strength: 45,
      actors: [supplier],
      tags: ['supplier', 'payment', 'relationship'],
      metadata: ownerMeta,
    })
    const m2 = makeMemory({
      id: 'supplier_blamed_for_bad_stock__brakka',
      definitionId: 'supplier_blamed_for_bad_stock',
      type: 'grudge',
      strength: 50,
      actors: [supplier],
      tags: ['supplier', 'blame', 'stock'],
      metadata: ownerMeta,
    })
    const m3 = makeMemory({
      id: 'supplier_exclusive_offer_refused__brakka',
      definitionId: 'supplier_exclusive_offer_refused',
      type: 'grudge',
      strength: 35,
      actors: [supplier],
      tags: ['supplier', 'relationship'],
      metadata: ownerMeta,
    })
    const seeded = injectMemory(injectMemory(injectMemory(base, m1), m2), m3)
    const drafts = detectPatterns(seeded)
    const distrust = drafts.find((d) =>
      d.id.startsWith('supplier_distrust_pattern__'),
    )
    expect(distrust).toBeDefined()
    expect(distrust!.actors).toEqual([supplier])
  })
})

describe('Phase 36 §36.7 — Memory report entity sections', () => {
  it('includes named-entity sections for strong memories and skips low-strength noise', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 200))
    const cookGrudge = makeMemory({
      id: 'staff_publicly_blamed__cook',
      definitionId: 'staff_publicly_blamed',
      type: 'grudge',
      strength: 75,
      label: 'Staff Publicly Blamed',
      actors: [COOK_REF],
      tags: ['staff', 'blame'],
      metadata: { owner: COOK_REF } satisfies EntityMemoryMetadata,
    })
    const weakStaff = makeMemory({
      id: 'staff_minor__cook',
      type: 'timed',
      strength: 10,
      actors: [COOK_REF],
      tags: ['staff'],
      metadata: { owner: COOK_REF } satisfies EntityMemoryMetadata,
    })
    const seeded = injectMemory(injectMemory(base, cookGrudge), weakStaff)

    const section = buildMemoryReport({
      state: seeded,
      newToday: [],
      expiredToday: [],
    })
    const titles = section.lines
    expect(titles.some((line) => line.includes('Important Staff Memories'))).toBe(
      true,
    )
    const staffLines = titles.filter((line) =>
      line.includes('staff:cook'),
    )
    expect(staffLines.length).toBeGreaterThan(0)
    // Weak memory should be filtered out.
    expect(
      staffLines.some((line) => line.includes('staff_minor__cook')),
    ).toBe(false)
  })
})

describe('Phase 36 §36.8 — Determinism under entity memory creation', () => {
  it('produces the same memory snapshot for the same seed and state', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 300))
    const seeded = injectRegular(
      withStock(base, 'ale', { quantity: 5 }),
      makeRegular({ irritation: 55, loyalty: 60, visits: 4 }),
    )

    const runOnce = runWeek(seeded)
    const runTwice = runWeek(seeded)

    const snapshot = (state: TavernState) =>
      state.memories
        .map((m) => ({
          id: m.id,
          definitionId: m.definitionId,
          strength: Math.round(m.strength),
          tags: [...m.tags].sort(),
        }))
        .sort((a, b) => a.id.localeCompare(b.id))

    expect(snapshot(runOnce)).toEqual(snapshot(runTwice))
  })
})
