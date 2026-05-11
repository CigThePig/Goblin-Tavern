import { describe, it, expect } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import {
  SIMULATION_PHASES,
  type SimulationPhase,
} from '../../src/sim/core/phases'
import type { SimContext } from '../../src/sim/core/context'
import type {
  SimulationHook,
  SimulationModule,
} from '../../src/sim/core/module'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { FULL_PIPELINE } from '../../src/sim/testing/simRunner'
import { worldModule } from '../../src/sim/modules/world/index'
import { cultureModule } from '../../src/sim/modules/cultures/index'
import { factionModule } from '../../src/sim/modules/factions/index'
import { supplierModule } from '../../src/sim/modules/suppliers/index'
import { regularModule } from '../../src/sim/modules/regulars/index'
import type {
  CultureWorldState,
  FactionWorldState,
  RegularWorldState,
  SupplierWorldState,
  TavernState,
} from '../../src/sim/state/TavernState'

// Phase 27 — Expanded engine hooks.
//
// These tests cover:
//   1. The new Phase 27 phases exist in SIMULATION_PHASES.
//   2. The Phase 13 contract (applyOwnerActions → beforeService →
//      service) is unchanged after the Phase 27 widening.
//   3. identityGeneration runs before forecastTraffic.
//   4. cultureUpdate, supplierUpdate, factionUpdate,
//      regularCustomerUpdate, localEventUpdate, and rumourUpdate all
//      run before forecastTraffic.
//   5. A test module can register a hook against any of the new
//      phases and have it run.
//   6. The new world mutation helpers actually modify state.
//   7. World mutations record causes via the existing cause contract.
//   8. The new world query helpers read the same record the mutation
//      helpers wrote.
//   9. The Phase 27 skeleton modules import and register cleanly.
//  10. The full Phase 19 pipeline still validates cleanly (regression
//      guard for the surrounding pipeline order).

const SEED = 'phase-27-engine-test'

function defaultInput() {
  return { seed: SEED }
}

const NEW_PHASES: ReadonlyArray<SimulationPhase> = [
  'identityGeneration',
  'cultureUpdate',
  'supplierUpdate',
  'factionUpdate',
  'regularCustomerUpdate',
  'localEventUpdate',
  'rumourUpdate',
]

function recorderModule(
  id: string,
  log: string[],
  options: Partial<SimulationModule> = {},
): SimulationModule {
  const hooks: SimulationModule['hooks'] = {}
  for (const phase of SIMULATION_PHASES) {
    const hook: SimulationHook = () => log.push(`${id}:${phase}`)
    hooks[phase] = [hook]
  }
  return { id, version: '0.0.1', hooks, ...options }
}

function sampleCulture(
  overrides: Partial<CultureWorldState> = {},
): CultureWorldState {
  return {
    id: 'goblin_common',
    label: 'Goblin Common',
    familiarity: 60,
    comfort: 40,
    tension: 20,
    namingProfileId: 'goblin_common',
    preferredStockTags: ['cheap'],
    dislikedTags: ['fancy'],
    importantCalendarTags: [],
    tags: ['goblin'],
    ...overrides,
  }
}

function sampleFaction(
  overrides: Partial<FactionWorldState> = {},
): FactionWorldState {
  return {
    id: 'iron_pick_guild',
    label: 'Iron Pick Guild',
    relationship: 50,
    influence: 30,
    trust: 40,
    fear: 20,
    tags: ['miner'],
    activeFlags: [],
    ...overrides,
  }
}

function sampleSupplier(
  overrides: Partial<SupplierWorldState> = {},
): SupplierWorldState {
  return {
    id: 'brakka_mushroom_cart',
    label: 'Brakka Mushroom Cart',
    supplierType: 'food_cart',
    reliability: 50,
    relationship: 45,
    debtTolerance: 30,
    priceBias: 0,
    goodsProvided: ['ale'],
    tags: ['cheap'],
    activeFlags: [],
    ...overrides,
  }
}

function sampleRegular(
  overrides: Partial<RegularWorldState> = {},
): RegularWorldState {
  return {
    id: 'nib_the_quick',
    name: {
      display: 'Nib Cracket',
      profileId: 'goblin_common',
      parts: { given: 'Nib', family: 'Cracket' },
      patternId: 'given_family',
      generatedBy: 'phase27-test',
    },
    customerGroupId: 'local_goblins',
    loyalty: 50,
    irritation: 10,
    visits: 3,
    firstSeenDay: 1,
    lastSeenDay: 3,
    knownIncidentIds: [],
    tags: [],
    activeFlags: [],
    ...overrides,
  }
}

function withWorldRecord<K extends keyof TavernState['world']>(
  state: TavernState,
  branch: K,
  id: string,
  record: TavernState['world'][K] extends Record<string, infer V> ? V : never,
): TavernState {
  const current = state.world[branch] as Record<string, unknown>
  return {
    ...state,
    world: {
      ...state.world,
      [branch]: { ...current, [id]: record },
    },
  }
}

describe('Phase 27 — Expanded simulation phases', () => {
  it('1. SIMULATION_PHASES contains every new Phase 27 phase', () => {
    for (const phase of NEW_PHASES) {
      expect(SIMULATION_PHASES).toContain(phase)
    }
  })

  it('2. Phase 13 contract is unchanged: applyOwnerActions → beforeService → service', () => {
    const idx = (p: SimulationPhase) => SIMULATION_PHASES.indexOf(p)
    expect(idx('beforeOwnerActions')).toBeLessThan(idx('applyOwnerActions'))
    expect(idx('applyOwnerActions')).toBeLessThan(idx('afterOwnerActions'))
    expect(idx('afterOwnerActions')).toBeLessThan(idx('assignStaffPriorities'))
    expect(idx('assignStaffPriorities')).toBeLessThan(idx('beforeService'))
    expect(idx('beforeService')).toBeLessThan(idx('service'))
    expect(idx('service')).toBeLessThan(idx('afterService'))
  })

  it('3. identityGeneration runs before forecastTraffic', () => {
    const idx = (p: SimulationPhase) => SIMULATION_PHASES.indexOf(p)
    expect(idx('identityGeneration')).toBeLessThan(idx('forecastTraffic'))
    // Identity generation also runs after startDay so existing
    // start-of-day hooks see a stable baseline first.
    expect(idx('startDay')).toBeLessThan(idx('identityGeneration'))
  })

  it('4. all per-domain world updates run before forecastTraffic', () => {
    const idx = (p: SimulationPhase) => SIMULATION_PHASES.indexOf(p)
    const updates: SimulationPhase[] = [
      'cultureUpdate',
      'supplierUpdate',
      'factionUpdate',
      'regularCustomerUpdate',
      'localEventUpdate',
      'rumourUpdate',
    ]
    for (const phase of updates) {
      expect(idx(phase)).toBeLessThan(idx('forecastTraffic'))
      // World updates run after identityGeneration so they can see
      // identities created earlier in the same day.
      expect(idx('identityGeneration')).toBeLessThan(idx(phase))
    }
  })

  it('5. a test module can register a hook for each new phase and have it run', () => {
    const log: string[] = []
    const mod = recorderModule('probe', log)
    simulateDay(createInitialTavernState(), defaultInput(), [mod])
    for (const phase of NEW_PHASES) {
      expect(log).toContain(`probe:${phase}`)
    }
    // The new phases run in the declared order across the day.
    const sequence = NEW_PHASES.map((p) => log.indexOf(`probe:${p}`))
    const sorted = [...sequence].sort((a, b) => a - b)
    expect(sequence).toEqual(sorted)
  })
})

describe('Phase 27 — World mutation helpers', () => {
  it('6a. modifyCulture clones the branch and applies the partial change', () => {
    const before = withWorldRecord(
      createInitialTavernState(),
      'cultures',
      'goblin_common',
      sampleCulture(),
    )
    const mod: SimulationModule = {
      id: 'culture-mutator',
      version: '0.0.1',
      hooks: {
        cultureUpdate: [
          (ctx: SimContext) => {
            ctx.modifyCulture(
              'goblin_common',
              { tension: 75 },
              { source: 'cultures.test', readable: 'tension spike' },
            )
          },
        ],
      },
    }
    const result = simulateDay(before, defaultInput(), [mod])
    expect(result.state.world.cultures['goblin_common']?.tension).toBe(75)
    // Untouched fields survive the merge.
    expect(result.state.world.cultures['goblin_common']?.familiarity).toBe(60)
  })

  it('6b. modifyFaction updates a faction relationship', () => {
    const before = withWorldRecord(
      createInitialTavernState(),
      'factions',
      'iron_pick_guild',
      sampleFaction(),
    )
    const mod: SimulationModule = {
      id: 'faction-mutator',
      version: '0.0.1',
      hooks: {
        factionUpdate: [
          (ctx: SimContext) => {
            ctx.modifyFaction(
              'iron_pick_guild',
              { relationship: 30 },
              { source: 'factions.test', readable: 'tension after brawl' },
            )
          },
        ],
      },
    }
    const result = simulateDay(before, defaultInput(), [mod])
    expect(result.state.world.factions['iron_pick_guild']?.relationship).toBe(30)
  })

  it('6c. modifySupplier updates supplier reliability', () => {
    const before = withWorldRecord(
      createInitialTavernState(),
      'suppliers',
      'brakka_mushroom_cart',
      sampleSupplier(),
    )
    const mod: SimulationModule = {
      id: 'supplier-mutator',
      version: '0.0.1',
      hooks: {
        supplierUpdate: [
          (ctx: SimContext) => {
            ctx.modifySupplier(
              'brakka_mushroom_cart',
              { reliability: 25, lastDeliveryDay: 1 },
              { source: 'suppliers.test', readable: 'wagon broke' },
            )
          },
        ],
      },
    }
    const result = simulateDay(before, defaultInput(), [mod])
    const supplier = result.state.world.suppliers['brakka_mushroom_cart']
    expect(supplier?.reliability).toBe(25)
    expect(supplier?.lastDeliveryDay).toBe(1)
  })

  it('6d. modifyRegular, modifyNotableNpc, modifyLocalEvent, modifySocialRumour, and modifyTavernIdentity all mutate state', () => {
    let before = createInitialTavernState()
    before = withWorldRecord(before, 'regulars', 'nib_the_quick', sampleRegular())
    before.world.notableNpcs['npc_1'] = {
      id: 'npc_1',
      name: {
        display: 'Famous Goblin',
        profileId: 'goblin_common',
        parts: { given: 'Snit' },
        patternId: 'given_family',
        generatedBy: 'phase27-test',
      },
      kind: 'visiting_dignitary',
      firstSeenDay: 1,
      tags: [],
      activeFlags: [],
    }
    before.world.localEvents['event_1'] = {
      id: 'event_1',
      definitionId: 'mushroom_festival',
      label: 'Mushroom Festival',
      startedDay: 1,
      intensity: 30,
      relatedFactionIds: [],
      relatedCultureIds: [],
      tags: [],
      activeFlags: [],
    }
    before.world.socialRumours['rumour_1'] = {
      id: 'rumour_1',
      label: 'Cook never sleeps',
      strength: 25,
      accuracy: 'partial',
      firstHeardDay: 1,
      lastSpreadDay: 1,
      tags: [],
    }

    const mod: SimulationModule = {
      id: 'world-mutator',
      version: '0.0.1',
      hooks: {
        regularCustomerUpdate: [
          (ctx: SimContext) => {
            ctx.modifyRegular(
              'nib_the_quick',
              { irritation: 70, lastSeenDay: 5 },
              { source: 'regulars.test', readable: 'angry visit' },
            )
            ctx.modifyNotableNpc(
              'npc_1',
              { lastSeenDay: 5 },
              { source: 'regulars.test' },
            )
          },
        ],
        localEventUpdate: [
          (ctx: SimContext) => {
            ctx.modifyLocalEvent(
              'event_1',
              { intensity: 80 },
              { source: 'localEvents.test', readable: 'event escalates' },
            )
          },
        ],
        rumourUpdate: [
          (ctx: SimContext) => {
            ctx.modifySocialRumour(
              'rumour_1',
              { strength: 60, lastSpreadDay: 2 },
              { source: 'rumours.test', readable: 'rumour spreads' },
            )
          },
        ],
        identityGeneration: [
          (ctx: SimContext) => {
            ctx.modifyTavernIdentity(
              { atmosphereTags: ['lively', 'crowded'] },
              { source: 'world.identity', readable: 'identity shift' },
            )
          },
        ],
      },
    }

    const result = simulateDay(before, defaultInput(), [mod])
    expect(result.state.world.regulars['nib_the_quick']?.irritation).toBe(70)
    expect(result.state.world.regulars['nib_the_quick']?.lastSeenDay).toBe(5)
    expect(result.state.world.notableNpcs['npc_1']?.lastSeenDay).toBe(5)
    expect(result.state.world.localEvents['event_1']?.intensity).toBe(80)
    expect(result.state.world.socialRumours['rumour_1']?.strength).toBe(60)
    expect(result.state.world.tavernIdentity.atmosphereTags).toEqual([
      'lively',
      'crowded',
    ])
  })

  it('7. world mutations append causes that target the mutated entity', () => {
    const before = withWorldRecord(
      createInitialTavernState(),
      'suppliers',
      'brakka_mushroom_cart',
      sampleSupplier(),
    )
    const mod: SimulationModule = {
      id: 'cause-probe',
      version: '0.0.1',
      hooks: {
        supplierUpdate: [
          (ctx: SimContext) => {
            ctx.modifySupplier(
              'brakka_mushroom_cart',
              { relationship: 20 },
              {
                source: 'suppliers.relationship_drift',
                readable: 'late payment',
                amount: -25,
                tags: ['supplier', 'relationship'],
              },
            )
          },
        ],
      },
    }
    const result = simulateDay(before, defaultInput(), [mod])
    const cause = result.state.causes.find(
      (c) => c.target === 'brakka_mushroom_cart',
    )
    expect(cause).toBeDefined()
    expect(cause?.targetType).toBe('supplier')
    expect(cause?.sourceType).toBe('supplier')
    expect(cause?.tags).toContain('supplier')
    expect(cause?.tags).toContain('relationship')
    expect(cause?.amount).toBe(-25)
    expect(cause?.direction).toBe('decrease')
  })

  it('8. world query helpers read the same record the mutation helpers wrote', () => {
    let observed: SupplierWorldState | undefined
    const before = withWorldRecord(
      createInitialTavernState(),
      'suppliers',
      'brakka_mushroom_cart',
      sampleSupplier(),
    )
    const mod: SimulationModule = {
      id: 'query-probe',
      version: '0.0.1',
      hooks: {
        supplierUpdate: [
          (ctx: SimContext) => {
            ctx.modifySupplier(
              'brakka_mushroom_cart',
              { reliability: 10 },
              { source: 'suppliers.test' },
            )
            observed = ctx.getSupplier('brakka_mushroom_cart')
          },
        ],
      },
    }
    simulateDay(before, defaultInput(), [mod])
    expect(observed?.reliability).toBe(10)
    // Unknown ids resolve to undefined rather than throwing.
    const otherMod: SimulationModule = {
      id: 'query-miss',
      version: '0.0.1',
      hooks: {
        identityGeneration: [
          (ctx: SimContext) => {
            expect(ctx.getCulture('phantom')).toBeUndefined()
            expect(ctx.getFaction('phantom')).toBeUndefined()
            expect(ctx.getRegular('phantom')).toBeUndefined()
            expect(ctx.getNotableNpc('phantom')).toBeUndefined()
            expect(ctx.getLocalEvent('phantom')).toBeUndefined()
            expect(ctx.getSocialRumour('phantom')).toBeUndefined()
          },
        ],
      },
    }
    simulateDay(createInitialTavernState(), defaultInput(), [otherMod])
  })

  it('modifyCulture throws on unknown id', () => {
    const mod: SimulationModule = {
      id: 'bad',
      version: '0.0.1',
      hooks: {
        cultureUpdate: [
          (ctx: SimContext) => {
            ctx.modifyCulture(
              'no_such_culture',
              { tension: 0 },
              { source: 'cultures.test' },
            )
          },
        ],
      },
    }
    expect(() =>
      simulateDay(createInitialTavernState(), defaultInput(), [mod]),
    ).toThrow(/no_such_culture/)
  })
})

describe('Phase 27 — Skeleton modules and pipeline integration', () => {
  it('9a. each skeleton module exports a SimulationModule with the expected hook slot', () => {
    expect(worldModule.id).toBe('world')
    expect(worldModule.hooks?.identityGeneration?.length ?? 0).toBeGreaterThan(0)
    expect(worldModule.hooks?.localEventUpdate?.length ?? 0).toBeGreaterThan(0)
    expect(worldModule.hooks?.rumourUpdate?.length ?? 0).toBeGreaterThan(0)

    expect(cultureModule.id).toBe('cultures')
    expect(cultureModule.hooks?.cultureUpdate?.length ?? 0).toBeGreaterThan(0)

    expect(factionModule.id).toBe('factions')
    expect(factionModule.hooks?.factionUpdate?.length ?? 0).toBeGreaterThan(0)

    expect(supplierModule.id).toBe('suppliers')
    expect(supplierModule.hooks?.supplierUpdate?.length ?? 0).toBeGreaterThan(0)

    expect(regularModule.id).toBe('regulars')
    expect(regularModule.hooks?.regularCustomerUpdate?.length ?? 0).toBeGreaterThan(0)
  })

  it('9b. FULL_PIPELINE includes the new skeleton modules', () => {
    const ids = FULL_PIPELINE.map((m) => m.id)
    expect(ids).toContain('world')
    expect(ids).toContain('cultures')
    expect(ids).toContain('factions')
    expect(ids).toContain('suppliers')
    expect(ids).toContain('regulars')
  })

  it('10. FULL_PIPELINE still validates cleanly for the default starting state', () => {
    const result = simulateDay(
      createInitialTavernState(),
      defaultInput(),
      FULL_PIPELINE,
    )
    expect(result.validation.errors).toEqual([])
  })
})
