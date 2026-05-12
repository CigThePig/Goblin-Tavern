import { describe, expect, it } from 'vitest'

import {
  EXPANDED_READINESS_SECTION_IDS,
  EXPANDED_READINESS_THRESHOLDS,
  EXPANDED_SEED_FAMILIES,
  auditExpandedSeed,
  auditRunForExpandedContradictions,
  auditStateForExpandedContradictions,
  buildArcAndCalendarUseReport,
  buildAttributionQualityReport,
  buildEntityMemoryQualityReport,
  buildExpandedPressureQualityReport,
  buildExpandedReadinessReport,
  buildExpandedSeedCoverageReport,
  buildIdentityRichnessReport,
  buildNamedEntityRepetitionAudit,
  buildSocialConsequenceQualityReport,
  buildTextIngredientQualityReport,
  detectCardProseSmell,
  evaluateExpandedCardReadinessGate,
  formatExpandedReadinessReport,
  runMonths,
} from '../../src/sim/testing/index'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import type {
  EntityRef,
  MemoryState,
  RegularWorldState,
  SupplierWorldState,
  TavernState,
} from '../../src/sim/state/TavernState'
import type { IssueSeed } from '../../src/sim/modules/issues/issueSeedTypes'
import type { AttributionState } from '../../src/sim/modules/attribution/attributionTypes'

const SEED = 'phase-40-expanded-readiness-test'

// ----------------------------------------------------------------------
// Test helpers — fake state pieces for scorer tests
// ----------------------------------------------------------------------

const COOK_REF: EntityRef = { kind: 'staff', id: 'cook' }
const SUPPLIER_REF: EntityRef = { kind: 'supplier', id: 'brakka' }
const REGULAR_REF: EntityRef = { kind: 'regular', id: 'brik' }

function makeMemory(overrides: Partial<MemoryState> & { id: string }): MemoryState {
  return {
    type: 'timed',
    strength: 50,
    ageDays: 0,
    createdAt: { year: 0, month: 0, week: 0, day: 0, absoluteDay: 0 },
    actors: [],
    locations: [],
    relatedSystems: [],
    tags: [],
    ...overrides,
  } as MemoryState
}

function makeAttribution(
  overrides: Partial<AttributionState> & { id: string },
): AttributionState {
  return {
    timestamp: { year: 0, month: 0, week: 0, day: 0, absoluteDay: 0 },
    sourceCauseIds: [],
    sourceMemoryIds: [],
    sourceSceneIds: [],
    perceivedBy: COOK_REF,
    target: COOK_REF,
    attributionType: 'blame',
    accuracy: 'true',
    strength: 50,
    confidence: 50,
    publicness: 50,
    volatility: 30,
    readable: 'test attribution',
    tags: [],
    relatedSystems: [],
    ageDays: 0,
    ...overrides,
  }
}

function makeFakeSeed(overrides: Partial<IssueSeed> & { id: string; family: string }): IssueSeed {
  return {
    type: 'warning',
    domain: ['expanded'],
    timing: 'morning_prep',
    severity: 50,
    urgency: 50,
    novelty: 50,
    cardWorthiness: 50,
    affectedActors: [],
    causes: [],
    pressures: [],
    stakes: [],
    responseSlots: [],
    consequenceProfiles: [],
    memoriesCreated: [],
    futureHooks: [],
    toneHints: [],
    textIngredients: {
      subject: 'subject',
      sensoryDetails: [],
      actorOpinions: {},
      recentContext: [],
      stakesReadable: [],
    },
    validation: { valid: true, errors: [], warnings: [], contractChecks: {} },
    generatedAt: { year: 0, month: 0, week: 0, day: 0, absoluteDay: 0 },
    ...overrides,
  }
}

function injectMemory(state: TavernState, m: MemoryState): TavernState {
  return { ...state, memories: [...state.memories, m] }
}

function injectRegular(state: TavernState, reg: RegularWorldState): TavernState {
  return {
    ...state,
    world: { ...state.world, regulars: { ...state.world.regulars, [reg.id]: reg } },
  }
}

function injectSupplier(state: TavernState, sup: SupplierWorldState): TavernState {
  return {
    ...state,
    world: { ...state.world, suppliers: { ...state.world.suppliers, [sup.id]: sup } },
  }
}

function defaultSupplier(overrides: Partial<SupplierWorldState> = {}): SupplierWorldState {
  return {
    id: 'brakka',
    label: 'Brakka Mushroom Cart',
    supplierType: 'forager',
    reliability: 60,
    relationship: 60,
    debtTolerance: 40,
    priceBias: 0,
    goodsProvided: ['mushrooms'],
    tags: [],
    activeFlags: [],
    name: {
      display: 'Brakka',
      profileId: 'goblin_common',
      parts: { given: 'Brakka' },
      patternId: 'given',
      generatedBy: 'phase40_test',
    },
    ...overrides,
  }
}

function defaultRegular(overrides: Partial<RegularWorldState> = {}): RegularWorldState {
  return {
    id: 'brik',
    name: {
      display: 'Brik Tallowmug',
      profileId: 'goblin_common',
      parts: { given: 'Brik', family: 'Tallowmug' },
      patternId: 'given_family',
      generatedBy: 'phase40_test',
    },
    customerGroupId: 'miners',
    loyalty: 60,
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

// Wrap a state's seedsToday slice with synthetic seeds so we can test
// scorers without driving the full pipeline.
function withFakeSeeds(state: TavernState, seeds: IssueSeed[]): TavernState {
  return {
    ...state,
    modules: {
      ...state.modules,
      issueSeeds: {
        seedsToday: seeds,
        cooldowns: {},
        rejectedToday: [],
        totalGenerated: seeds.length,
        totalRejected: 0,
        lastGeneratedDay: 0,
      },
    },
  }
}

function makeSingleDayRun(state: TavernState) {
  const stateBefore = createInitialTavernState()
  return {
    config: { seed: 'test', days: 1 },
    initialState: stateBefore,
    finalState: state,
    days: [
      {
        index: 1,
        stateBefore,
        input: { seed: 'test' },
        result: {
          state,
          validation: { valid: true, errors: [], warnings: [] },
          reports: [],
          diffs: [],
          appliedEffects: [],
        } as unknown as import('../../src/sim/core/result').SimResult,
      },
    ],
    validatedThroughout: true,
  } as unknown as import('../../src/sim/testing/index').CardlessRunResult
}

// ----------------------------------------------------------------------
// §40.17 test 1 — Expanded readiness report builds without throwing.
// ----------------------------------------------------------------------

describe('Phase 40 §40.13 — buildExpandedReadinessReport', () => {
  it('builds without throwing on the default pipeline (84-day run)', () => {
    const report = buildExpandedReadinessReport({ seed: SEED, days: 28 })
    expect(report).toBeDefined()
    expect(typeof report.passed).toBe('boolean')
    expect(typeof report.coreReadinessPassed).toBe('boolean')
  })

  it('includes all expected expanded section ids', () => {
    const report = buildExpandedReadinessReport({ seed: SEED, days: 28 })
    const ids = report.sections.map((s) => s.id).sort()
    for (const id of EXPANDED_READINESS_SECTION_IDS) {
      expect(ids).toContain(id)
    }
    expect(report.sections.length).toBe(EXPANDED_READINESS_SECTION_IDS.length)
  })

  it('exposes thresholds for callers', () => {
    expect(EXPANDED_READINESS_THRESHOLDS.identity_richness).toBe(70)
    expect(EXPANDED_READINESS_THRESHOLDS.expanded_contradiction_safety).toBe(90)
  })
})

// ----------------------------------------------------------------------
// §40.17 test 3 — Identity richness scorer
// ----------------------------------------------------------------------

describe('Phase 40 §40.3 — Identity richness scorer', () => {
  it('detects named staff, regulars, suppliers, factions', () => {
    let state = createInitialTavernState()
    state = injectRegular(state, defaultRegular({ id: 'r1' }))
    state = injectRegular(state, defaultRegular({ id: 'r2' }))
    state = injectRegular(state, defaultRegular({ id: 'r3' }))
    state = injectSupplier(state, defaultSupplier({ id: 's1' }))
    state = injectSupplier(state, defaultSupplier({ id: 's2' }))

    const report = buildIdentityRichnessReport(state)
    expect(report.namedRegulars).toBeGreaterThanOrEqual(3)
    expect(report.namedSuppliers).toBeGreaterThanOrEqual(2)
    expect(report.namingProfilesUsed).toContain('goblin_common')
  })

  it('penalizes duplicate display names', () => {
    let state = createInitialTavernState()
    state = injectRegular(state, defaultRegular({ id: 'r1', name: defaultRegular({}).name }))
    state = injectRegular(state, defaultRegular({ id: 'r2', name: defaultRegular({}).name }))
    const report = buildIdentityRichnessReport(state)
    expect(report.duplicateDisplayNames.length).toBeGreaterThan(0)
  })
})

// ----------------------------------------------------------------------
// §40.17 test 4 — Entity memory quality scorer
// ----------------------------------------------------------------------

describe('Phase 40 §40.4 — Entity memory quality scorer', () => {
  it('counts owned memories and real-target memories', () => {
    let state = createInitialTavernState()
    state = injectMemory(
      state,
      makeMemory({
        id: 'mem-cook-1',
        actors: [COOK_REF],
        strength: 70,
        metadata: { owner: COOK_REF },
      }),
    )
    state = injectMemory(
      state,
      makeMemory({
        id: 'mem-cook-2',
        actors: [COOK_REF],
        strength: 65,
        metadata: { owner: COOK_REF, blamed: [COOK_REF] },
      }),
    )
    const report = buildEntityMemoryQualityReport(state)
    expect(report.totalEntityMemories).toBeGreaterThanOrEqual(2)
    expect(report.memoriesWithOwners).toBeGreaterThanOrEqual(2)
    expect(report.memoriesWithRealTargets).toBeGreaterThanOrEqual(2)
    expect(report.strongMemories).toBeGreaterThanOrEqual(2)
    expect(report.staffMemories).toBeGreaterThanOrEqual(2)
  })

  it('returns zero scores for an empty memory list', () => {
    const empty = createInitialTavernState()
    const report = buildEntityMemoryQualityReport(empty)
    expect(report.totalEntityMemories).toBe(0)
    expect(report.score).toBe(0)
  })
})

// ----------------------------------------------------------------------
// §40.17 test 5 — Attribution quality scorer
// ----------------------------------------------------------------------

describe('Phase 40 §40.5 — Attribution quality scorer', () => {
  it('detects blame, credit, false, and source coverage', () => {
    const state = createInitialTavernState()
    const slice = {
      attributions: [
        makeAttribution({
          id: 'a-blame',
          attributionType: 'blame',
          accuracy: 'true',
          publicness: 75,
          sourceCauseIds: ['c1'],
        }),
        makeAttribution({
          id: 'a-credit',
          attributionType: 'credit',
          accuracy: 'true',
          sourceMemoryIds: ['m1'],
        }),
        makeAttribution({
          id: 'a-false',
          attributionType: 'suspicion',
          accuracy: 'false',
          sourceSceneIds: ['s1'],
        }),
      ],
      generatedToday: [],
      lastUpdatedDay: 0,
    }
    const seeded: TavernState = {
      ...state,
      memories: [
        ...state.memories,
        makeMemory({
          id: 'mem-with-attribution',
          actors: [COOK_REF],
          metadata: { sourceAttributionIds: ['a-blame'] },
        }),
      ],
      modules: { ...state.modules, attribution: slice },
    }
    const report = buildAttributionQualityReport(seeded)
    expect(report.totalAttributions).toBe(3)
    expect(report.blameCount).toBeGreaterThanOrEqual(1)
    expect(report.creditCount).toBeGreaterThanOrEqual(1)
    expect(report.falseOrPartialCount).toBeGreaterThanOrEqual(1)
    expect(report.attributionsWithSources).toBe(3)
    expect(report.attributionsCreatingMemories).toBeGreaterThanOrEqual(1)
    expect(report.score).toBeGreaterThan(0)
  })

  it('returns score 0 when no attributions exist', () => {
    const empty = createInitialTavernState()
    const report = buildAttributionQualityReport(empty)
    expect(report.totalAttributions).toBe(0)
    expect(report.score).toBe(0)
  })
})

// ----------------------------------------------------------------------
// §40.17 test 6 — Expanded pressure quality scorer
// ----------------------------------------------------------------------

describe('Phase 40 §40.6 — Expanded pressure quality scorer', () => {
  it('detects moved expanded pressures', () => {
    const run = runMonths(1, { seed: SEED })
    const report = buildExpandedPressureQualityReport(run)
    expect(Array.isArray(report.expandedPressuresMoved)).toBe(true)
    expect(typeof report.score).toBe('number')
  })
})

// ----------------------------------------------------------------------
// §40.17 test 7 — Expanded seed coverage scorer
// ----------------------------------------------------------------------

describe('Phase 40 §40.7 — Expanded seed coverage scorer', () => {
  it('detects expanded seed families and counts named-entity coverage', () => {
    const base = createInitialTavernState()
    const seedWithEntity = makeFakeSeed({
      id: 'expanded-1',
      family: 'staff_identity',
      primaryActor: COOK_REF,
      affectedActors: [COOK_REF],
      responseSlots: [
        {
          id: 'r1',
          labelHint: 'r',
          allowedVerbs: ['serve'],
          shape: 'safe_costly',
          targetOptions: [],
          expectedEffects: [],
        },
        {
          id: 'r2',
          labelHint: 'r',
          allowedVerbs: ['ignore'],
          shape: 'ignore',
          targetOptions: [],
          expectedEffects: [],
        },
        {
          id: 'r3',
          labelHint: 'r',
          allowedVerbs: ['delegate'],
          shape: 'delay_problem',
          targetOptions: [],
          expectedEffects: [],
        },
      ],
      textIngredients: {
        subject: 'cook',
        sensoryDetails: [],
        actorOpinions: {},
        recentContext: [],
        stakesReadable: [],
        namedEntities: [
          { role: 'subject', ref: COOK_REF, displayName: 'Cook' },
        ],
      },
      pressures: [
        {
          id: 'staff_loyalty_risk',
          label: 'Staff Loyalty Risk',
          value: 60,
          severity: 60,
          urgency: 50,
          trend: 1,
          deltaSinceYesterday: 1,
          tags: [],
          topCauses: [],
        } as unknown as IssueSeed['pressures'][number],
      ],
    })
    const state = withFakeSeeds(base, [seedWithEntity])
    const run = makeSingleDayRun(state)
    const report = buildExpandedSeedCoverageReport(run)
    expect(report.totalExpandedSeeds).toBe(1)
    expect(report.expandedFamiliesProduced).toContain('staff_identity')
    expect(report.seedsWithNamedEntities).toBe(1)
    expect(report.seedsWithExpandedPressures).toBe(1)
    expect(report.averageResponseSlots).toBe(3)
    expect(report.missingExpandedFamilies.length).toBe(
      EXPANDED_SEED_FAMILIES.length - 1,
    )
  })
})

// ----------------------------------------------------------------------
// §40.17 test 8 — Text ingredient prose smell detector
// ----------------------------------------------------------------------

describe('Phase 40 §40.8 — Text ingredient prose smell detector', () => {
  it('flags over-long ingredients as prose-like', () => {
    expect(
      detectCardProseSmell(
        'Brik leans across the bar and whispers a long story about how the cook ruined his stew last week.',
      ),
    ).toBe(true)
  })

  it('flags quoted dialogue', () => {
    expect(detectCardProseSmell('She said "give me the gold"')).toBe(true)
  })

  it('flags second-person commands', () => {
    expect(detectCardProseSmell('You must pay the supplier')).toBe(true)
  })

  it('keeps short fragments unflagged', () => {
    expect(detectCardProseSmell('mushroom shortage')).toBe(false)
    expect(detectCardProseSmell('Brik')).toBe(false)
  })

  it('catches over-budget warnings via the report', () => {
    const base = createInitialTavernState()
    const longSubject =
      'Brik leans across the bar muttering bitterly at the cook again and again about the cold stew that arrived late tonight from the kitchen'
    const seed = makeFakeSeed({
      id: 'smell-1',
      family: 'staff_identity',
      textIngredients: {
        subject: longSubject,
        sensoryDetails: [],
        actorOpinions: {},
        recentContext: [],
        stakesReadable: [],
      },
    })
    const run = makeSingleDayRun(withFakeSeeds(base, [seed]))
    const report = buildTextIngredientQualityReport(run)
    expect(report.totalSeedsChecked).toBe(1)
    expect(report.seedsWithCardProseSmell).toBe(1)
  })
})

// ----------------------------------------------------------------------
// §40.17 test 9 — Named entity repetition audit
// ----------------------------------------------------------------------

describe('Phase 40 §40.9 — Named entity repetition audit', () => {
  it('penalises an overused entity', () => {
    const base = createInitialTavernState()
    const seeds: IssueSeed[] = []
    for (let i = 0; i < 8; i += 1) {
      seeds.push(
        makeFakeSeed({
          id: `repeat-${i}`,
          family: 'staff_identity',
          primaryActor: COOK_REF,
          affectedActors: [COOK_REF],
          textIngredients: {
            subject: 'cook',
            sensoryDetails: [],
            actorOpinions: {},
            recentContext: [],
            stakesReadable: [],
            namedEntities: [
              { role: 'subject', ref: COOK_REF, displayName: 'Cook' },
            ],
          },
        }),
      )
    }
    const run = makeSingleDayRun(withFakeSeeds(base, seeds))
    const audit = buildNamedEntityRepetitionAudit(run)
    expect(audit.totalNamedEntityUses).toBeGreaterThan(8)
    expect(audit.overusedEntities.length).toBeGreaterThan(0)
    expect(audit.overusedEntities[0]!.refKey).toContain('staff:cook')
    expect(audit.score).toBeLessThan(100)
  })
})

// ----------------------------------------------------------------------
// §40.17 test 10 — Expanded contradiction audit
// ----------------------------------------------------------------------

describe('Phase 40 §40.12 — Expanded contradiction audit', () => {
  it('catches a seed that references a missing supplier', () => {
    const base = createInitialTavernState()
    const seed = makeFakeSeed({
      id: 'missing-supplier-1',
      family: 'supplier_relationship',
      primaryActor: { kind: 'supplier', id: 'ghost_supplier' },
      affectedActors: [{ kind: 'supplier', id: 'ghost_supplier' }],
    })
    const result = auditExpandedSeed(seed, base)
    expect(result).not.toBeNull()
    expect(result!.reason).toMatch(/missing supplier/)
  })

  it('catches a seed referencing an inactive policy', () => {
    const base = createInitialTavernState()
    // No policy installed; the seed claims policy:no_such is active.
    const seed = makeFakeSeed({
      id: 'inactive-policy-1',
      family: 'policy_backlash',
      affectedActors: [{ kind: 'other', id: 'policy:no_such_policy' }],
    })
    const result = auditExpandedSeed(seed, base)
    expect(result).not.toBeNull()
    expect(result!.reason).toMatch(/inactive policy/)
  })

  it('catches a seed referencing an ended arc as active', () => {
    let base = createInitialTavernState()
    base = {
      ...base,
      world: {
        ...base.world,
        localEvents: {
          ...base.world.localEvents,
          ended_arc: {
            id: 'ended_arc',
            definitionId: 'ended',
            label: 'Ended arc',
            startedDay: 1,
            intensity: 0,
            relatedFactionIds: [],
            relatedCultureIds: [],
            tags: [],
            activeFlags: [],
            stage: 'resolved',
          },
        },
      },
    }
    const seed = makeFakeSeed({
      id: 'ended-arc-1',
      family: 'seasonal_arc',
      affectedActors: [{ kind: 'local_event', id: 'ended_arc' }],
    })
    const result = auditExpandedSeed(seed, base)
    expect(result).not.toBeNull()
    expect(result!.reason).toMatch(/ended arc/)
  })

  it('returns no contradictions for the canonical full-pipeline run', () => {
    const run = runMonths(1, { seed: SEED })
    const audit = auditRunForExpandedContradictions(run)
    expect(audit.contradictionsFound).toEqual([])
    expect(audit.score).toBe(100)
  })

  it('auditStateForExpandedContradictions audits the current day only', () => {
    const base = createInitialTavernState()
    const audit = auditStateForExpandedContradictions(base)
    expect(audit.totalExpandedSeedsAudited).toBe(0)
    expect(audit.contradictionsFound).toEqual([])
  })
})

// ----------------------------------------------------------------------
// §40.17 test 11 & 12 — Expanded readiness gate failure handling
// ----------------------------------------------------------------------

describe('Phase 40 §40.14 — Expanded card readiness gate', () => {
  it('fails when allExpansionTestsPass is false', () => {
    const result = evaluateExpandedCardReadinessGate({
      allExpansionTestsPass: false,
      seed: SEED,
      days: 28,
    })
    expect(result.passed).toBe(false)
    expect(
      result.failedReasons.some((r) => /expansion tests/.test(r)),
    ).toBe(true)
  })

  it('produces specific failure reasons rather than a blank verdict', () => {
    const result = evaluateExpandedCardReadinessGate({
      allExpansionTestsPass: false,
      seed: SEED,
      days: 28,
    })
    for (const reason of result.failedReasons) {
      expect(reason.length).toBeGreaterThan(20)
    }
    // The structured result still includes all condition keys.
    expect(typeof result.conditions.coreGatePasses).toBe('boolean')
    expect(typeof result.conditions.expandedReplayIdentical).toBe('boolean')
    expect(typeof result.conditions.expandedSeedsFromState).toBe('boolean')
  })

  it('returns a fully structured ExpandedReadinessReport in `.readiness`', () => {
    const result = evaluateExpandedCardReadinessGate({
      allExpansionTestsPass: true,
      seed: SEED,
      days: 28,
    })
    expect(result.readiness.sections.length).toBe(
      EXPANDED_READINESS_SECTION_IDS.length,
    )
    expect(typeof result.readiness.replayIdentical).toBe('boolean')
  })
})

// ----------------------------------------------------------------------
// §40.17 test 13 — Same seed expanded run is deterministic
// ----------------------------------------------------------------------

describe('Phase 40 §40.13 — Determinism', () => {
  it('same seed produces identical final state across runs', () => {
    const a = runMonths(1, { seed: SEED })
    const b = runMonths(1, { seed: SEED })
    expect(JSON.stringify(a.finalState)).toBe(JSON.stringify(b.finalState))
  })
})

// ----------------------------------------------------------------------
// §40.17 — Format and miscellaneous coverage
// ----------------------------------------------------------------------

describe('Phase 40 §40.10 / §40.11 / §40.15 — Misc coverage', () => {
  it('arc and calendar use report runs against a multi-month run', () => {
    const run = runMonths(1, { seed: SEED })
    const report = buildArcAndCalendarUseReport(run)
    expect(typeof report.score).toBe('number')
    expect(Array.isArray(report.activeArcsSeen)).toBe(true)
  })

  it('social consequence quality report tolerates an empty expanded seed set', () => {
    const base = createInitialTavernState()
    const run = makeSingleDayRun(base)
    const report = buildSocialConsequenceQualityReport(run)
    expect(report.responseProfilesChecked).toBe(0)
    expect(report.score).toBe(0)
  })

  it('formatExpandedReadinessReport produces a human-readable string', () => {
    const report = buildExpandedReadinessReport({ seed: SEED, days: 28 })
    const out = formatExpandedReadinessReport(report)
    expect(out).toContain('Expanded Card Fuel Readiness')
    for (const id of EXPANDED_READINESS_SECTION_IDS) {
      expect(out).toContain(id)
    }
  })
})
