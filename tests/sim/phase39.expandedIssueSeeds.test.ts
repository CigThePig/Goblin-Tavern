import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'

import { areasModule } from '../../src/sim/modules/areas/index'
import { attributionModule } from '../../src/sim/modules/attribution/index'
import { causesModule } from '../../src/sim/modules/causes/index'
import { cultureModule } from '../../src/sim/modules/cultures/index'
import { customersModule } from '../../src/sim/modules/customers/index'
import { factionModule } from '../../src/sim/modules/factions/index'
import { feedbackModule } from '../../src/sim/modules/feedback/index'
import { historyModule } from '../../src/sim/modules/history/index'
import { issueSeedsModule } from '../../src/sim/modules/issues/index'
import { localArcsModule } from '../../src/sim/modules/localArcs/index'
import { memoriesModule } from '../../src/sim/modules/memories/index'
import { monthlyModule } from '../../src/sim/modules/monthly/index'
import { ownerActionsModule } from '../../src/sim/modules/ownerActions/index'
import { pressuresModule } from '../../src/sim/modules/pressures/index'
import { regularModule } from '../../src/sim/modules/regulars/index'
import { serviceModule } from '../../src/sim/modules/service/index'
import { staffModule } from '../../src/sim/modules/staff/index'
import { stockModule } from '../../src/sim/modules/stock/index'
import { supplierModule } from '../../src/sim/modules/suppliers/index'
import { weeklyModule } from '../../src/sim/modules/weekly/index'
import { worldModule } from '../../src/sim/modules/world/index'

import {
  CORE_ISSUE_SEED_FAMILIES,
  EXPANDED_ISSUE_SEED_FAMILIES,
  TEXT_INGREDIENT_LIMITS,
  buildIssueSeedReport,
  buildTextIngredients,
  computeCardWorthiness,
  getIssueSeeds,
  issueSeedGeneratorRegistry,
  validateSeed,
  validateSeedAgainstState,
  validateTextIngredients,
} from '../../src/sim/modules/issues/index'
import type {
  CooldownEntry,
  IssueSeed,
  TextIngredients,
} from '../../src/sim/modules/issues/issueSeedTypes'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import type {
  AttributionState,
  AttributionType,
} from '../../src/sim/modules/attribution/index'
import type {
  CalendarStamp,
  MemoryState,
  RegularWorldState,
  TavernState,
} from '../../src/sim/state/TavernState'

const SEED = 'phase-39-expanded-issue-seeds-test'

const FULL_PIPELINE = [
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
  monthlyModule,
  localArcsModule,
  memoriesModule,
  historyModule,
  causesModule,
  attributionModule,
  pressuresModule,
  feedbackModule,
  issueSeedsModule,
]

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

function runDay(state: TavernState, overrides: Partial<SimInput> = {}) {
  return simulateDay(state, input(overrides), FULL_PIPELINE)
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

function stampOf(state: TavernState): CalendarStamp {
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
  memories: MemoryState[],
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
  // Audit fixes pass 1 §1.3 — `createInitialTavernState` now seeds a
  // small starter regulars roster. The Phase 39 regular-customer seed
  // tests want a single high-irritation injected regular to dominate
  // the calculator's avg-irritation term, so clear the starters first.
  return {
    ...state,
    world: {
      ...state.world,
      regulars: { [regular.id]: regular },
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
      generatedBy: 'phase39_test',
    },
    customerGroupId: 'miners',
    loyalty: 25,
    irritation: 75,
    visits: 5,
    knownIncidentIds: [],
    firstSeenDay: 1,
    lastSeenDay: 1,
    tags: ['regular'],
    activeFlags: [],
    ...overrides,
  }
}

function attribution(
  state: TavernState,
  override: Partial<AttributionState> & {
    target: AttributionState['target']
    attributionType: AttributionType
    readable: string
  },
): AttributionState {
  return {
    id: `attr-${override.target.kind}-${override.target.id}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: stampOf(state),
    sourceCauseIds: [],
    sourceMemoryIds: [],
    sourceSceneIds: [],
    perceivedBy: { kind: 'customer_group', id: 'miners' },
    accuracy: 'partial',
    strength: 80,
    confidence: 80,
    publicness: 90,
    volatility: 30,
    tags: ['blame'],
    relatedSystems: [],
    ageDays: 0,
    ...override,
  }
}

// ----------------------------------------------------------------------
// 39.1 — Expanded family registration
// ----------------------------------------------------------------------

describe('Phase 39 §39.1 — Expanded family registration', () => {
  it('original ten families remain registered', () => {
    // Trigger registration via a day-run.
    runDay(plentyOfStock(createInitialTavernState()))
    const families = new Set(issueSeedGeneratorRegistry.all().map((g) => g.family))
    for (const fam of CORE_ISSUE_SEED_FAMILIES) {
      expect(families).toContain(fam)
    }
  })

  it('expanded families are registered', () => {
    runDay(plentyOfStock(createInitialTavernState()))
    const families = new Set(issueSeedGeneratorRegistry.all().map((g) => g.family))
    for (const fam of EXPANDED_ISSUE_SEED_FAMILIES) {
      expect(families).toContain(fam)
    }
  })
})

// ----------------------------------------------------------------------
// 39.5 — staff_identity
// ----------------------------------------------------------------------

describe('Phase 39 §39.5 — Staff identity seed', () => {
  it('generates from public blame attribution and loyalty deficit', () => {
    const base = plentyOfStock(createInitialTavernState())
    const staffId = Object.keys(base.staff)[0]!
    const staffRef = { kind: 'staff' as const, id: staffId }
    const stamp = stampOf(base)
    const weakened: TavernState = {
      ...base,
      staff: {
        ...base.staff,
        [staffId]: {
          ...base.staff[staffId]!,
          loyalty: 20,
          morale: 25,
          paidThisWeek: false,
          stress: 70,
          fatigue: 70,
        },
      },
    }
    const seeded = seedAttributions(weakened, [
      attribution(weakened, {
        target: staffRef,
        attributionType: 'blame',
        readable: 'Cook publicly blamed for botched service.',
        publicness: 90,
        strength: 85,
        tags: ['staff', 'blame'],
      }),
    ])
    const withMemory = seedMemories(seeded, [
      {
        id: 'mem-staff-scapegoat-1',
        type: 'grudge',
        strength: 80,
        ageDays: 0,
        createdAt: stamp,
        actors: [staffRef],
        locations: [],
        relatedSystems: ['staff'],
        tags: ['staff', 'scapegoat'],
        metadata: { owner: staffRef },
        label: 'scapegoat memory',
      },
    ])
    const result = runDay(withMemory)
    const seeds = getIssueSeeds(result.state, { family: 'staff_identity' })
    expect(seeds.length).toBeGreaterThan(0)
    const seed = seeds[0]!
    expect(seed.primaryActor?.kind).toBe('staff')
    expect(seed.textIngredients.namedEntities?.length).toBeGreaterThan(0)
    expect(seed.textIngredients.perceivedBlame?.length).toBeGreaterThan(0)
    expect(seed.responseSlots.length).toBeGreaterThanOrEqual(2)
  })
})

// ----------------------------------------------------------------------
// 39.6 — regular_customer
// ----------------------------------------------------------------------

describe('Phase 39 §39.6 — Regular customer seed', () => {
  it('generates from ignored regular complaint memory', () => {
    const base = plentyOfStock(createInitialTavernState())
    const stamp = stampOf(base)
    const regular = makeRegular({ loyalty: 20, irritation: 80 })
    const regularRef = { kind: 'regular' as const, id: regular.id }
    let state = injectRegular(base, regular)
    state = seedMemories(state, [
      {
        id: 'mem-regular-ignored',
        type: 'grudge',
        strength: 80,
        ageDays: 0,
        createdAt: stamp,
        actors: [regularRef],
        locations: [],
        relatedSystems: ['regulars'],
        tags: ['regular', 'ignored_complaint', 'memory'],
        metadata: { owner: regularRef },
        label: 'ignored regular complaint',
      },
    ])
    const result = runDay(state)
    const seeds = getIssueSeeds(result.state, { family: 'regular_customer' })
    expect(seeds.length).toBeGreaterThan(0)
    const seed = seeds[0]!
    expect(seed.primaryActor?.kind).toBe('regular')
    expect(seed.textIngredients.namedEntities?.[0]?.displayName).toBe(
      'Brik Tallowmug',
    )
  })
})

// ----------------------------------------------------------------------
// 39.7 — supplier_relationship
// ----------------------------------------------------------------------

describe('Phase 39 §39.7 — Supplier relationship seed', () => {
  it('generates from supplier blame attribution and grudge memory', () => {
    const base = plentyOfStock(createInitialTavernState())
    const supplierId = Object.keys(base.world.suppliers)[0]!
    const supplierRef = { kind: 'supplier' as const, id: supplierId }
    const stamp = stampOf(base)
    let state = seedAttributions(base, [
      attribution(base, {
        target: supplierRef,
        attributionType: 'blame',
        readable: 'Supplier blamed publicly for spoiled goods.',
        strength: 85,
        publicness: 85,
        tags: ['supplier', 'blame'],
      }),
    ])
    state = seedMemories(state, [
      {
        id: 'mem-supplier-late-1',
        type: 'grudge',
        strength: 80,
        ageDays: 0,
        createdAt: stamp,
        actors: [supplierRef],
        locations: [],
        relatedSystems: ['suppliers'],
        tags: ['supplier', 'late_payment'],
        metadata: { subjects: [supplierRef] },
        label: 'supplier late payment',
      },
    ])
    const result = runDay(state)
    const seeds = getIssueSeeds(result.state, { family: 'supplier_relationship' })
    expect(seeds.length).toBeGreaterThan(0)
    const seed = seeds[0]!
    expect(seed.primaryActor?.kind).toBe('supplier')
    expect(seed.textIngredients.namedEntities?.length).toBeGreaterThan(0)
  })
})

// ----------------------------------------------------------------------
// 39.9 — culture_conflict
// ----------------------------------------------------------------------

describe('Phase 39 §39.9 — Cultural conflict seed', () => {
  it('generates from cultural tension', () => {
    const base = plentyOfStock(createInitialTavernState())
    const cultureId = Object.keys(base.world.cultures)[0]!
    const elevated: TavernState = {
      ...base,
      world: {
        ...base.world,
        cultures: {
          ...base.world.cultures,
          [cultureId]: {
            ...base.world.cultures[cultureId]!,
            tension: 80,
          },
        },
      },
      pressures: {
        ...base.pressures,
        cultural_tension: {
          ...base.pressures['cultural_tension']!,
          value: 60,
        },
      },
    }
    const result = runDay(elevated)
    const seeds = getIssueSeeds(result.state, { family: 'culture_conflict' })
    expect(seeds.length).toBeGreaterThan(0)
    expect(seeds[0]!.primaryActor?.kind).toBe('culture')
  })
})

// ----------------------------------------------------------------------
// 39.11 — seasonal_arc
// ----------------------------------------------------------------------

describe('Phase 39 §39.11 — Seasonal arc seed', () => {
  it('generates from an active arc with rising escalation', () => {
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
            label: 'Mushroom Festival',
            startedDay: today,
            intensity: 70,
            relatedFactionIds: [],
            relatedCultureIds: [],
            tags: ['festival', 'arc'],
            activeFlags: [],
            type: 'festival',
            stage: 'active',
            lastUpdatedDay: today,
          },
        },
      },
      pressures: {
        ...base.pressures,
        arc_escalation: {
          ...base.pressures['arc_escalation']!,
          value: 60,
        },
        festival_readiness: {
          ...base.pressures['festival_readiness']!,
          value: 55,
        },
      },
    }
    const result = runDay(seeded)
    const seeds = getIssueSeeds(result.state, { family: 'seasonal_arc' })
    expect(seeds.length).toBeGreaterThan(0)
    const seed = seeds[0]!
    expect(seed.primaryActor?.id).toBe('mushroom_festival_arc')
    expect(seed.textIngredients.arcContext?.length).toBeGreaterThan(0)
  })
})

// ----------------------------------------------------------------------
// 39.13 — rumour_crisis
// ----------------------------------------------------------------------

describe('Phase 39 §39.13 — Rumour crisis seed', () => {
  it('generates from a public false attribution and an active rumour', () => {
    const base = plentyOfStock(createInitialTavernState())
    const supplierId = Object.keys(base.world.suppliers)[0]!
    const supplierRef = { kind: 'supplier' as const, id: supplierId }
    const stamp = stampOf(base)
    const withAttributions = seedAttributions(base, [
      attribution(base, {
        target: supplierRef,
        attributionType: 'blame',
        accuracy: 'false',
        readable: 'False rumour blames supplier.',
        publicness: 95,
        strength: 90,
        tags: ['rumour', 'supplier'],
      }),
      attribution(base, {
        target: supplierRef,
        attributionType: 'distrust',
        accuracy: 'partial',
        readable: 'Supplier distrusted by miners.',
        publicness: 90,
        strength: 90,
        tags: ['rumour', 'supplier'],
      }),
    ])
    const withRumour: TavernState = {
      ...withAttributions,
      world: {
        ...withAttributions.world,
        socialRumours: {
          ...withAttributions.world.socialRumours,
          rumour_spoiled_goods: {
            id: 'rumour_spoiled_goods',
            label: 'Spoiled goods rumour spreads',
            strength: 80,
            accuracy: 'false',
            sourceEntityId: 'miners',
            targetEntityId: supplierId,
            subject: supplierRef,
            firstHeardDay: stamp.absoluteDay,
            lastSpreadDay: stamp.absoluteDay,
            tags: ['rumour', 'supplier'],
          },
        },
      },
    }
    const result = runDay(withRumour)
    const seeds = getIssueSeeds(result.state, { family: 'rumour_crisis' })
    expect(seeds.length).toBeGreaterThan(0)
    expect(seeds[0]!.textIngredients.perceivedBlame?.length).toBeGreaterThan(0)
  })
})

// ----------------------------------------------------------------------
// 39.3 / 39.16 — Text ingredient validation
// ----------------------------------------------------------------------

describe('Phase 39 §39.3 — Expanded text ingredient budgets', () => {
  it('buildTextIngredients trims expanded arrays to their budgets', () => {
    const ingredients: TextIngredients = buildTextIngredients({
      subject: 'subject',
      namedEntities: Array.from({ length: 8 }, (_, i) => ({
        role: 'staff',
        ref: { kind: 'staff' as const, id: `s${i}` },
        displayName: `Name ${i}`,
      })),
      socialContext: Array.from({ length: 10 }, (_, i) => `social ${i}`),
      relevantMemories: Array.from({ length: 10 }, (_, i) => `mem ${i}`),
      arcContext: Array.from({ length: 5 }, (_, i) => `arc ${i}`),
    })
    expect(ingredients.namedEntities?.length).toBe(
      TEXT_INGREDIENT_LIMITS.namedEntities.maxEntries,
    )
    expect(ingredients.socialContext?.length).toBe(
      TEXT_INGREDIENT_LIMITS.socialContext.maxEntries,
    )
    expect(ingredients.relevantMemories?.length).toBe(
      TEXT_INGREDIENT_LIMITS.relevantMemories.maxEntries,
    )
    expect(ingredients.arcContext?.length).toBe(
      TEXT_INGREDIENT_LIMITS.arcContext.maxEntries,
    )
  })

  it('validateTextIngredients reports over-long words in expanded arrays', () => {
    const overlong = 'this is a very long social context phrase that overflows the budget by far'
    const ingredients: TextIngredients = {
      subject: 'subject',
      sensoryDetails: [],
      actorOpinions: {},
      recentContext: [],
      stakesReadable: [],
      socialContext: [overlong],
    }
    const result = validateTextIngredients(ingredients)
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})

// ----------------------------------------------------------------------
// 39.15 — Contradiction guards
// ----------------------------------------------------------------------

describe('Phase 39 §39.15 — Contradiction guards reject missing refs', () => {
  it('does not generate a supplier seed when the supplier no longer exists', () => {
    const base = plentyOfStock(createInitialTavernState())
    const ghostSupplier = { kind: 'supplier' as const, id: 'never_existed' }
    const seeded = seedAttributions(base, [
      attribution(base, {
        target: ghostSupplier,
        attributionType: 'blame',
        readable: 'Ghost supplier blamed.',
        strength: 90,
        publicness: 90,
      }),
    ])
    const result = runDay(seeded)
    const seeds = getIssueSeeds(result.state, { family: 'supplier_relationship' })
    // No seed should reference the ghost supplier id.
    for (const seed of seeds) {
      expect(seed.primaryActor?.id).not.toBe('never_existed')
    }
  })

  it('rejects seasonal arc seeds whose primaryActor names a missing arc', () => {
    // Phase 40 audit pass 2 §6 — The generator now also emits
    // anticipation seeds when no arc is yet active in localEvents,
    // keyed on calendar tags / market conditions. Those anticipation
    // seeds intentionally omit `primaryActor` (since the arc isn't a
    // real local_event yet), so the validator never lands the
    // "references missing arc" error on them. This test guards the
    // narrower invariant: any seasonal_arc seed that DOES carry a
    // local_event primaryActor must point at a live arc.
    const base = plentyOfStock(createInitialTavernState())
    const seeded: TavernState = {
      ...base,
      pressures: {
        ...base.pressures,
        arc_escalation: {
          ...base.pressures['arc_escalation']!,
          value: 60,
        },
      },
    }
    const result = runDay(seeded)
    const seeds = getIssueSeeds(result.state, { family: 'seasonal_arc' })
    for (const seed of seeds) {
      if (seed.primaryActor?.kind === 'local_event') {
        expect(result.state.world.localEvents[seed.primaryActor.id]).toBeDefined()
      }
    }
  })
})

// ----------------------------------------------------------------------
// 39.16 — validateSeedAgainstState
// ----------------------------------------------------------------------

describe('Phase 39 §39.16 — Expanded validation', () => {
  it('rejects seeds whose named entity refs do not resolve', () => {
    const base = plentyOfStock(createInitialTavernState())
    const ghostRegular = { kind: 'regular' as const, id: 'ghost' }
    const fakeSeed: IssueSeed = {
      id: 'fake_regular',
      family: 'regular_customer',
      type: 'complaint',
      timing: 'during_service',
      domain: ['regulars'],
      severity: 50,
      urgency: 40,
      novelty: 80,
      cardWorthiness: 60,
      primaryActor: ghostRegular,
      affectedActors: [ghostRegular],
      causes: [
        {
          id: 'c1',
          timestamp: stampOf(base),
          source: 'test',
          sourceType: 'system',
          target: 'regular:ghost',
          targetType: 'regular',
          amount: 1,
          direction: 'increase',
          weight: 10,
          readable: 'test cause',
          tags: ['regular'],
          relatedActors: [],
          relatedLocations: [],
          relatedSystems: [],
          ageDays: 0,
        },
      ],
      pressures: [
        {
          id: 'regular_customer_loss',
          label: 'Regular loss',
          value: 50,
          previousValue: 40,
          delta: 10,
          trend: 'rising',
          severity: 50,
          urgency: 40,
          volatility: 10,
          causes: [],
          relatedActors: [],
          relatedLocations: [],
          relatedSystems: [],
          tags: [],
          consequences: [],
          lastUpdated: stampOf(base),
        },
      ],
      stakes: [
        {
          id: 's',
          target: 'regular:ghost',
          readable: 'ghost may walk',
          direction: 'loss',
          tags: ['regular'],
        },
      ],
      responseSlots: [
        {
          id: 'a',
          labelHint: 'apologise',
          allowedVerbs: ['appease'],
          shape: 'safe_costly',
          targetOptions: [ghostRegular],
          expectedEffects: ['raise loyalty'],
        },
        {
          id: 'b',
          labelHint: 'ignore',
          allowedVerbs: ['ignore'],
          shape: 'ignore',
          targetOptions: [],
          expectedEffects: ['no cost'],
        },
      ],
      consequenceProfiles: [
        {
          id: 'a',
          responseSlotId: 'a',
          immediateEffects: [],
          delayedEffects: [],
          memories: [{ id: 'mem' }],
          futureHooks: [],
          impactScore: 30,
        },
        {
          id: 'b',
          responseSlotId: 'b',
          immediateEffects: [],
          delayedEffects: [],
          memories: [{ id: 'mem2' }],
          futureHooks: [],
          impactScore: 20,
        },
      ],
      memoriesCreated: [],
      futureHooks: [],
      toneHints: [],
      textIngredients: {
        subject: 'ghost',
        sensoryDetails: [],
        actorOpinions: {},
        recentContext: [],
        stakesReadable: ['ghost may walk'],
        namedEntities: [
          { role: 'regular', ref: ghostRegular, displayName: 'Ghost' },
        ],
        relevantMemories: ['some grudge'],
      },
      validation: { valid: true, errors: [], warnings: [], contractChecks: {} },
      generatedAt: stampOf(base),
    }
    const v = validateSeedAgainstState(fakeSeed, { state: base })
    expect(v.valid).toBe(false)
    expect(v.errors.some((e) => e.includes('does not resolve'))).toBe(true)
  })
})

// ----------------------------------------------------------------------
// 39.17 — Ranking penalises overused actors
// ----------------------------------------------------------------------

describe('Phase 39 §39.17 — Ranking penalises overused actors', () => {
  it('weekly overuse subtracts from cardWorthiness', () => {
    const base = plentyOfStock(createInitialTavernState())
    const stamp = stampOf(base)
    const actorRef = { kind: 'staff' as const, id: 'overused' }
    const cooldowns: Record<string, CooldownEntry> = {
      template_a: {
        templateId: 'template_a',
        family: 'staff_identity',
        lastGeneratedDay: stamp.absoluteDay,
        lastSelectedDay: -1,
        timesSelected: 0,
        timesGenerated: 3,
        actorIds: ['overused'],
        locationIds: [],
      },
      template_b: {
        templateId: 'template_b',
        family: 'staff_identity',
        lastGeneratedDay: stamp.absoluteDay - 1,
        lastSelectedDay: -1,
        timesSelected: 0,
        timesGenerated: 2,
        actorIds: ['overused'],
        locationIds: [],
      },
      template_c: {
        templateId: 'template_c',
        family: 'staff_identity',
        lastGeneratedDay: stamp.absoluteDay - 2,
        lastSelectedDay: -1,
        timesSelected: 0,
        timesGenerated: 1,
        actorIds: ['overused'],
        locationIds: [],
      },
    }
    const baseSeed: IssueSeed = {
      id: 'seed_new',
      family: 'staff_identity',
      type: 'relationship_test',
      timing: 'morning_prep',
      domain: ['staff'],
      severity: 50,
      urgency: 50,
      novelty: 80,
      cardWorthiness: 0,
      primaryActor: actorRef,
      affectedActors: [actorRef],
      causes: [],
      pressures: [],
      stakes: [],
      responseSlots: [],
      consequenceProfiles: [],
      memoriesCreated: [],
      futureHooks: [],
      toneHints: [],
      textIngredients: {
        subject: 'overused',
        sensoryDetails: [],
        actorOpinions: {},
        recentContext: [],
        stakesReadable: [],
      },
      validation: { valid: true, errors: [], warnings: [], contractChecks: {} },
      generatedAt: stamp,
    }
    const overusedScore = computeCardWorthiness({
      seed: baseSeed,
      templateId: 'template_new',
      cooldowns,
      absoluteDay: stamp.absoluteDay,
    })
    const cleanScore = computeCardWorthiness({
      seed: { ...baseSeed, primaryActor: { kind: 'staff', id: 'fresh' }, affectedActors: [{ kind: 'staff', id: 'fresh' }] },
      templateId: 'template_new',
      cooldowns,
      absoluteDay: stamp.absoluteDay,
    })
    expect(overusedScore).toBeLessThan(cleanScore)
  })
})

// ----------------------------------------------------------------------
// 39.18 — Report summary
// ----------------------------------------------------------------------

describe('Phase 39 §39.18 — Report summary includes expanded families', () => {
  it('expanded family counts surface in the issue seed report data', () => {
    const base = plentyOfStock(createInitialTavernState())
    const cultureId = Object.keys(base.world.cultures)[0]!
    const elevated: TavernState = {
      ...base,
      world: {
        ...base.world,
        cultures: {
          ...base.world.cultures,
          [cultureId]: { ...base.world.cultures[cultureId]!, tension: 85 },
        },
      },
      pressures: {
        ...base.pressures,
        cultural_tension: { ...base.pressures['cultural_tension']!, value: 60 },
      },
    }
    const result = runDay(elevated)
    const ctxLike = {
      state: result.state,
    } as unknown as Parameters<typeof buildIssueSeedReport>[0]
    const report = buildIssueSeedReport(ctxLike)
    const data = report.data as
      | { expandedFamilyCounts?: Record<string, number>; expandedSeedCount?: number }
      | undefined
    expect(data?.expandedFamilyCounts).toBeDefined()
    expect((data?.expandedSeedCount ?? 0)).toBeGreaterThanOrEqual(1)
  })
})

// ----------------------------------------------------------------------
// 39.19 — Determinism
// ----------------------------------------------------------------------

describe('Phase 39 §39.19 — Determinism with expanded seeds', () => {
  it('same seed + same state produces identical expanded seeds', () => {
    const base = plentyOfStock(createInitialTavernState())
    const cultureId = Object.keys(base.world.cultures)[0]!
    const elevated: TavernState = {
      ...base,
      world: {
        ...base.world,
        cultures: {
          ...base.world.cultures,
          [cultureId]: { ...base.world.cultures[cultureId]!, tension: 80 },
        },
      },
      pressures: {
        ...base.pressures,
        cultural_tension: { ...base.pressures['cultural_tension']!, value: 60 },
      },
    }
    const a = runDay(elevated)
    const b = runDay(elevated)
    const aIds = getIssueSeeds(a.state, { family: 'culture_conflict' })
      .map((s) => s.id)
      .sort()
    const bIds = getIssueSeeds(b.state, { family: 'culture_conflict' })
      .map((s) => s.id)
      .sort()
    expect(aIds).toEqual(bIds)
  })
})

// Use the standard contract checks coverage to ensure existing validators
// keep tracking the ten contract checks even on an expanded seed.
describe('Phase 39 — Backwards compatibility', () => {
  it('validateSeed (without state) still works on expanded seeds', () => {
    const base = plentyOfStock(createInitialTavernState())
    const stamp = stampOf(base)
    const minimalSeed: IssueSeed = {
      id: 'minimal',
      family: 'staff_identity',
      type: 'relationship_test',
      timing: 'morning_prep',
      domain: ['staff'],
      severity: 50,
      urgency: 40,
      novelty: 80,
      cardWorthiness: 60,
      affectedActors: [{ kind: 'staff', id: 'x' }],
      causes: [
        {
          id: 'c1',
          timestamp: stamp,
          source: 'test',
          sourceType: 'system',
          target: 'staff:x',
          targetType: 'staff',
          amount: 1,
          direction: 'increase',
          weight: 10,
          readable: 'cause',
          tags: ['staff'],
          relatedActors: [],
          relatedLocations: [],
          relatedSystems: [],
          ageDays: 0,
        },
      ],
      pressures: [],
      stakes: [
        {
          id: 's',
          target: 'staff:x',
          readable: 'x may quit',
          direction: 'loss',
          tags: ['staff'],
        },
      ],
      responseSlots: [
        {
          id: 'a',
          labelHint: 'a',
          allowedVerbs: ['appease'],
          shape: 'safe_costly',
          targetOptions: [],
          expectedEffects: [],
        },
        {
          id: 'b',
          labelHint: 'b',
          allowedVerbs: ['ignore'],
          shape: 'ignore',
          targetOptions: [],
          expectedEffects: [],
        },
      ],
      consequenceProfiles: [
        {
          id: 'a',
          responseSlotId: 'a',
          immediateEffects: [],
          delayedEffects: [],
          memories: [{ id: 'mem' }],
          futureHooks: [],
          impactScore: 30,
        },
        {
          id: 'b',
          responseSlotId: 'b',
          immediateEffects: [],
          delayedEffects: [],
          memories: [{ id: 'mem2' }],
          futureHooks: [],
          impactScore: 20,
        },
      ],
      memoriesCreated: [],
      futureHooks: [],
      toneHints: [],
      textIngredients: {
        subject: 'subject',
        sensoryDetails: [],
        actorOpinions: {},
        recentContext: [],
        stakesReadable: ['x may quit'],
      },
      validation: { valid: true, errors: [], warnings: [], contractChecks: {} },
      generatedAt: stamp,
    }
    const v = validateSeed(minimalSeed)
    expect(v.contractChecks.reason_now).toBe(true)
  })
})
