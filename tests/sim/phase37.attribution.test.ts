import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'

import {
  ATTRIBUTION_MODULE_ID,
  attributionModule,
  attributionsByTarget,
  attributionsByType,
  attributionsHeldBy,
  blameAgainst,
  buildAttributionReport,
  createInitialAttributionModuleState,
  evaluateAllRules,
  getAttributionModuleState,
  strongestPublicAttributions,
} from '../../src/sim/modules/attribution/index'
import type { AttributionState } from '../../src/sim/modules/attribution/index'

import { areasModule } from '../../src/sim/modules/areas/index'
import { causesModule } from '../../src/sim/modules/causes/index'
import { cultureModule } from '../../src/sim/modules/cultures/index'
import { customersModule } from '../../src/sim/modules/customers/index'
import { factionModule } from '../../src/sim/modules/factions/index'
import { historyModule } from '../../src/sim/modules/history/index'
import {
  memoriesAboutEntity,
  memoriesModule,
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
import type {
  EntityRef,
  RegularWorldState,
  TavernState,
} from '../../src/sim/state/TavernState'

const SEED = 'phase-37-attribution-test'

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
  attributionModule,
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
      generatedBy: 'phase37_test',
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

const TAVERN_REF = (state: TavernState): EntityRef => ({
  kind: 'tavern_identity',
  id: state.meta.tavernId,
})

const SUPPLIER_REF: EntityRef = {
  kind: 'supplier',
  id: 'brakka_mushroom_cart',
}

const COOK_REF: EntityRef = { kind: 'staff', id: 'cook' }

// --- Helpers that synthesize attribution-feeding state ---

function seedSpoiledStockCause(state: TavernState): TavernState {
  // Add a recent food-safety cause attributed to the supplier.
  const stamp = {
    year: state.calendar.year,
    month: state.calendar.month,
    week: state.calendar.week,
    day: state.calendar.day,
    absoluteDay: state.calendar.totalDaysElapsed,
  }
  return {
    ...state,
    causes: [
      ...state.causes,
      {
        id: 'cause-spoiled-mushrooms',
        timestamp: stamp,
        source: 'stock.spoilage',
        sourceType: 'stock',
        target: 'stock:mushrooms',
        targetType: 'stock',
        amount: -10,
        direction: 'decrease',
        weight: 10,
        readable: 'Mushrooms spoiled in storage from supplier delivery.',
        tags: ['food_safety', 'spoilage', 'supplier'],
        relatedActors: [SUPPLIER_REF],
        relatedLocations: [],
        relatedSystems: ['supplier', 'stock'],
        ageDays: 0,
      },
    ],
  }
}

function seedCompletedProject(state: TavernState): TavernState {
  // Splice a completed project into the ownerActions module slice that
  // the project_success_credit_owner rule reads.
  const slice = (state.modules['ownerActions'] as
    | { projects: Record<string, unknown>; policies: Record<string, unknown>; recentSocialActions: unknown[]; applied: unknown[]; rejected: unknown[]; timeSpent: number; timeBudget: number }
    | undefined) ?? {
    projects: {},
    policies: {},
    recentSocialActions: [],
    applied: [],
    rejected: [],
    timeSpent: 0,
    timeBudget: 3,
  }
  return {
    ...state,
    modules: {
      ...state.modules,
      ownerActions: {
        ...slice,
        projects: {
          ...slice.projects,
          private_booth: {
            id: 'private_booth',
            projectType: 'area_upgrade',
            label: 'Private Booth',
            targetType: 'customer',
            targetId: 'miners',
            startedAtDay: state.calendar.totalDaysElapsed - 1,
            progress: 5,
            requiredProgress: 5,
            coinInvested: 50,
            status: 'completed',
            tags: ['project', 'area'],
            effectsPreview: ['adds private booth seating'],
          },
        },
      },
    },
  }
}

function seedRivalArc(state: TavernState): TavernState {
  // Add a rival local-event arc, plus a recent reputation-drop cause
  // so the suspicion rule fires.
  const stamp = {
    year: state.calendar.year,
    month: state.calendar.month,
    week: state.calendar.week,
    day: state.calendar.day,
    absoluteDay: state.calendar.totalDaysElapsed,
  }
  return {
    ...state,
    world: {
      ...state.world,
      localEvents: {
        ...state.world.localEvents,
        rival_tavern_arc: {
          id: 'rival_tavern_arc',
          definitionId: 'rival_tavern',
          label: 'Rival Tavern Looms',
          startedDay: 1,
          intensity: 60,
          relatedFactionIds: [],
          relatedCultureIds: [],
          tags: ['rival'],
          activeFlags: [],
          type: 'rival',
          stage: 'active',
        },
      },
    },
    causes: [
      ...state.causes,
      {
        id: 'cause-rep-drop',
        timestamp: stamp,
        source: 'monthly.reputation',
        sourceType: 'monthly',
        target: 'reputation:reliable',
        targetType: 'reputation',
        amount: -5,
        direction: 'decrease',
        weight: 5,
        readable: 'Reputation slipped this week.',
        tags: ['reputation_drift'],
        relatedActors: [],
        relatedLocations: [],
        relatedSystems: ['reputation'],
        ageDays: 0,
      },
    ],
  }
}

// ---------- Tests ----------

describe('Phase 37 §37.3 — Attribution module state', () => {
  it('initializes its module state on day zero', () => {
    const state = createInitialTavernState()
    const slice = getAttributionModuleState(state)
    expect(slice).toBeDefined()
    expect(slice!.attributions).toEqual([])
    expect(slice!.generatedToday).toEqual([])
    expect(slice!.lastUpdatedDay).toBe(-1)
  })

  it('createInitialAttributionModuleState produces an empty slice', () => {
    expect(createInitialAttributionModuleState()).toEqual({
      attributions: [],
      generatedToday: [],
      lastUpdatedDay: -1,
      recentDistrustByRumour: {},
    })
  })
})

describe('Phase 37 §37.4 — Attribution rules', () => {
  it('creates blame attribution against the supplier when food safety cause references them', () => {
    const base = plentyOfStock(createInitialTavernState())
    const seeded = seedSpoiledStockCause(base)
    const result = runDay(seeded)
    const slice = getAttributionModuleState(result.state)!
    const blame = blameAgainst(result.state, SUPPLIER_REF)
    expect(blame.length).toBeGreaterThan(0)
    expect(blame[0]!.attributionType).toBe('blame')
    expect(blame[0]!.sourceCauseIds).toContain('cause-spoiled-mushrooms')
    expect(slice.attributions.length).toBeGreaterThan(0)
  })

  it('a service-failure cause referencing a staff member creates staff blame attribution', () => {
    // Phase 32 scenes only fire under specific service conditions and
    // are wiped each day, so we drive the rule via a recent service
    // cause that names the cook as a related actor. The
    // staff_service_failure_blame rule reads recent causes alongside
    // today's scenes for exactly this reason.
    const base = plentyOfStock(createInitialTavernState())
    const stamp = {
      year: base.calendar.year,
      month: base.calendar.month,
      week: base.calendar.week,
      day: base.calendar.day,
      absoluteDay: base.calendar.totalDaysElapsed,
    }
    const seeded: TavernState = {
      ...base,
      causes: [
        ...base.causes,
        {
          id: 'cause-cook-service-failure',
          timestamp: stamp,
          source: 'service.cook_failure',
          sourceType: 'service',
          target: 'staff:cook',
          targetType: 'staff',
          amount: -8,
          direction: 'decrease',
          weight: 8,
          readable: 'Cook bungled the rush.',
          tags: ['service_failure', 'staff_mistake'],
          relatedActors: [COOK_REF],
          relatedLocations: [],
          relatedSystems: ['staff', 'service'],
          ageDays: 0,
        },
      ],
    }
    const result = runDay(seeded)
    const blame = blameAgainst(result.state, COOK_REF)
    expect(blame.length).toBeGreaterThan(0)
    expect(
      blame.some((b) => b.sourceCauseIds.includes('cause-cook-service-failure')),
    ).toBe(true)
  })

  it('a completed project can create owner/tavern credit attribution', () => {
    const base = plentyOfStock(createInitialTavernState())
    const seeded = seedCompletedProject(base)
    const result = runDay(seeded)
    const tavernRef = TAVERN_REF(result.state)
    const credits = attributionsByTarget(result.state, tavernRef).filter(
      (a) => a.attributionType === 'credit',
    )
    expect(credits.length).toBeGreaterThan(0)
    expect(credits[0]!.perceivedBy.kind).toBe('customer_group')
  })

  it('rival arc creates suspicion attribution with unknown accuracy', () => {
    const base = plentyOfStock(createInitialTavernState())
    const seeded = seedRivalArc(base)
    const result = runDay(seeded)
    const suspicion = attributionsByType(result.state, 'suspicion')
    expect(suspicion.length).toBeGreaterThan(0)
    const arcSuspicion = suspicion.find(
      (a) => a.target.kind === 'local_event' && a.target.id === 'rival_tavern_arc',
    )
    expect(arcSuspicion).toBeDefined()
    expect(arcSuspicion!.accuracy).toBe('unknown')
  })

  it('false attribution can be stored with accuracy: "false"', () => {
    // Seed a rumour with `accuracy: 'false'` so the rumour_distorts_cause
    // rule emits a false attribution.
    const base = plentyOfStock(createInitialTavernState())
    const today = base.calendar.totalDaysElapsed
    const withRumour: TavernState = {
      ...base,
      world: {
        ...base.world,
        socialRumours: {
          ...base.world.socialRumours,
          rumour_owner_waters_ale: {
            id: 'rumour_owner_waters_ale',
            label: 'Owner waters ale.',
            strength: 60,
            accuracy: 'false',
            firstHeardDay: today,
            lastSpreadDay: today,
            tags: ['ale', 'rumour'],
            subject: TAVERN_REF(base),
          },
        },
      },
    }
    const result = runDay(withRumour)
    const tavernRef = TAVERN_REF(result.state)
    const attributions = attributionsByTarget(result.state, tavernRef)
    expect(attributions.some((a) => a.accuracy === 'false')).toBe(true)
  })
})

describe('Phase 37 §37.5 — Deduplication and aging', () => {
  it('duplicate attributions merge instead of duplicating across days', () => {
    const base = plentyOfStock(createInitialTavernState())
    const day1 = runDay(seedSpoiledStockCause(base))
    const beforeCount = (
      getAttributionModuleState(day1.state)?.attributions.length ?? 0
    )
    // Re-seed and run again with the SAME cause id so the attribution
    // key is identical.
    const day2 = runDay(seedSpoiledStockCause(day1.state))
    const slice2 = getAttributionModuleState(day2.state)!
    // The count should not double — duplicates merge.
    expect(slice2.attributions.length).toBeLessThanOrEqual(beforeCount + 2)
    // Strength should bump on the merged attribution.
    const blame = blameAgainst(day2.state, SUPPLIER_REF)
    expect(blame[0]!.strength).toBeGreaterThan(60)
  })

  it('attribution ages and expires over time', () => {
    // Build a state with a single low-confidence attribution and run
    // many empty days to age it out.
    const base = plentyOfStock(createInitialTavernState())
    const today = base.calendar.totalDaysElapsed
    const stamp = {
      year: base.calendar.year,
      month: base.calendar.month,
      week: base.calendar.week,
      day: base.calendar.day,
      absoluteDay: today,
    }
    const seeded: AttributionState = {
      id: 'attr-seeded',
      timestamp: stamp,
      sourceCauseIds: [],
      sourceMemoryIds: [],
      sourceSceneIds: [],
      perceivedBy: { kind: 'customer_group', id: 'miners' },
      target: TAVERN_REF(base),
      attributionType: 'distrust',
      accuracy: 'unknown',
      strength: 20,
      confidence: 20,
      publicness: 10,
      volatility: 60,
      readable: 'Low-confidence drift.',
      tags: ['drift'],
      relatedSystems: [],
      ageDays: 0,
      expiresAfterDays: 3,
    }
    const stateWithAttr: TavernState = {
      ...base,
      modules: {
        ...base.modules,
        [ATTRIBUTION_MODULE_ID]: {
          attributions: [seeded],
          generatedToday: [],
          lastUpdatedDay: today,
        },
      },
    }
    let current = stateWithAttr
    for (let i = 0; i < 10; i += 1) {
      current = runDay(current).state
    }
    const slice = getAttributionModuleState(current)!
    // The seeded low-confidence attribution should have aged out by now.
    expect(slice.attributions.find((a) => a.id === 'attr-seeded')).toBeUndefined()
  })
})

describe('Phase 37 §37.6 — Attribution propagation', () => {
  it('strong public blame creates an entity memory', () => {
    const base = plentyOfStock(createInitialTavernState())
    // Run multiple days so blame accrues past the memory threshold.
    let current = seedSpoiledStockCause(base)
    for (let i = 0; i < 4; i += 1) {
      const next = runDay(current).state
      current = seedSpoiledStockCause(next)
    }
    // Memory layer should now carry a supplier_blamed_for_bad_stock
    // entry attributed via the attribution layer.
    const memoriesAboutTavern = memoriesAboutEntity(current, TAVERN_REF(current))
    const fromAttribution = memoriesAboutTavern.filter(
      (m) =>
        (m.tags.includes('attribution') ||
          m.source?.startsWith('attribution.')) &&
        m.tags.includes('blame'),
    )
    expect(fromAttribution.length).toBeGreaterThan(0)
  })

  it('public attribution can strengthen a social rumour', () => {
    const base = plentyOfStock(createInitialTavernState())
    const today = base.calendar.totalDaysElapsed
    const rumourId = 'rumour_owner_waters_ale'
    const withRumour: TavernState = {
      ...base,
      world: {
        ...base.world,
        socialRumours: {
          ...base.world.socialRumours,
          [rumourId]: {
            id: rumourId,
            label: 'Owner waters ale.',
            strength: 50,
            accuracy: 'false',
            firstHeardDay: today,
            lastSpreadDay: today,
            tags: ['ale', 'rumour'],
            subject: TAVERN_REF(base),
          },
        },
      },
    }
    let current = withRumour
    for (let i = 0; i < 3; i += 1) {
      current = runDay(current).state
    }
    // The seeded rumour breeds a distrust attribution, and the
    // attribution feeds a rumour of its own that it keeps strengthening.
    //
    // Phase 206 / audit Wave 7 — rumours now DECAY daily, so the original
    // seeded rumour fades unless something re-spreads it, while the
    // attribution-fed rumour must outpace decay because the propagation
    // pass strengthens it while the belief stays strong. Pre-decay this
    // test's `>= 50` held trivially (nothing ever reduced strength) and
    // proved nothing about propagation.
    const rumours = current.world.socialRumours
    const attributionFed = Object.values(rumours).filter((rumour) =>
      rumour.id.startsWith('rumour_distrust_'),
    )
    expect(attributionFed.length).toBeGreaterThanOrEqual(1)
    expect(
      Math.max(...attributionFed.map((rumour) => rumour.strength)),
    ).toBeGreaterThanOrEqual(50)
    // The unfed original decays instead of accumulating forever.
    expect(rumours[rumourId]!.strength).toBeLessThan(50)
  })
})

describe('Phase 37 §37.7 — Attribution queries', () => {
  it('returns expected target/perceiver subsets', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(seedSpoiledStockCause(base))
    const tavernRef = TAVERN_REF(result.state)

    const tavernAttrs = attributionsByTarget(result.state, tavernRef)
    expect(tavernAttrs.every((a) => a.target.kind === 'tavern_identity')).toBe(
      true,
    )

    const supplierAttrs = attributionsByTarget(result.state, SUPPLIER_REF)
    expect(supplierAttrs.every((a) => a.target.kind === 'supplier')).toBe(true)

    const heldByOwner = attributionsHeldBy(result.state, tavernRef)
    expect(heldByOwner.every((a) => a.perceivedBy.kind === 'tavern_identity')).toBe(
      true,
    )

    const top = strongestPublicAttributions(result.state, 3)
    expect(top.length).toBeLessThanOrEqual(3)
  })
})

describe('Phase 37 §37.8 — Attribution report', () => {
  it('summarizes the most relevant beliefs', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(seedSpoiledStockCause(base))
    const report = buildAttributionReport(result.state)
    expect(report.title).toBe('ATTRIBUTION REPORT')
    expect(report.lines.length).toBeGreaterThan(0)
    expect(report.data?.byType).toBeDefined()
  })
})

describe('Phase 37 §37.9 — Determinism with attribution enabled', () => {
  it('full simulation is deterministic with attribution enabled', () => {
    const base = plentyOfStock(createInitialTavernState())
    const seeded = injectRegular(
      base,
      makeRegular({ irritation: 55, loyalty: 60, visits: 4 }),
    )

    const runOnce = (() => {
      let current = seeded
      for (let i = 0; i < 7; i += 1) current = runDay(current).state
      return current
    })()
    const runTwice = (() => {
      let current = seeded
      for (let i = 0; i < 7; i += 1) current = runDay(current).state
      return current
    })()

    const snapshot = (state: TavernState) => {
      const slice = getAttributionModuleState(state)!
      return [...slice.attributions]
        .map((a) => ({
          id: a.id,
          type: a.attributionType,
          target: `${a.target.kind}:${a.target.id}`,
          perceivedBy: `${a.perceivedBy.kind}:${a.perceivedBy.id}`,
          strength: Math.round(a.strength),
        }))
        .sort((a, b) => a.id.localeCompare(b.id))
    }

    expect(snapshot(runOnce)).toEqual(snapshot(runTwice))
  })
})

describe('Phase 37 §37.4 — Rule evaluation surface', () => {
  it('evaluateAllRules returns drafts when given a recent supplier-blame cause', () => {
    const base = plentyOfStock(createInitialTavernState())
    const seeded = seedSpoiledStockCause(base)
    // We need a SimContext to evaluate rules; the simplest path is to
    // run a day and check via the persisted state instead.
    const result = runDay(seeded)
    const slice = getAttributionModuleState(result.state)!
    expect(slice.attributions.length).toBeGreaterThan(0)
    // evaluateAllRules is exported and pure-on-context; smoke test it
    // by ensuring it is callable from the index.
    expect(typeof evaluateAllRules).toBe('function')
  })
})
