import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { createStateDiff } from '../../src/sim/core/diff'
import type { SimContext } from '../../src/sim/core/context'
import type { SimulationModule } from '../../src/sim/core/module'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { findUnexplainedSignificantChanges } from '../../src/sim/modules/causes/index'
import type {
  CultureWorldState,
  FactionWorldState,
  LocalEventWorldState,
  RegularWorldState,
  SocialRumourState,
  SupplierWorldState,
  TavernState,
} from '../../src/sim/state/TavernState'

// Phase 42 — ISSUE-002: World mutator cause emission + state diff coverage.
//
// Two halves under test:
//   1. The eight world mutators (`modifyCulture`, `modifyFaction`,
//      `modifySupplier`, `modifyRegular`, `modifyNotableNpc`,
//      `modifyLocalEvent`, `modifySocialRumour`, `modifyTavernIdentity`)
//      emit one cause per changed numeric field instead of one aggregate
//      cause. Non-numeric-only updates retain the aggregate cause as a
//      fallback so existing call sites keep their attribution.
//   2. `createStateDiff` walks `state.world.*` per record-typed slice
//      and `state.modules.*` per top-level key. The flat per-field cause
//      targets (`cultures.foo.familiarity`) match the diff paths, so
//      `findUnexplainedSignificantChanges` finds a matching cause for
//      every significant world-entity change.

const SEED = 'phase-42-world-coverage-test'

function defaultInput() {
  return { seed: SEED }
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
    preferredStockTags: [],
    dislikedTags: [],
    importantCalendarTags: [],
    tags: [],
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
    tags: [],
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
    goodsProvided: ['mushrooms'],
    tags: [],
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
      generatedBy: 'phase42-test',
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

function sampleLocalEvent(
  overrides: Partial<LocalEventWorldState> = {},
): LocalEventWorldState {
  return {
    id: 'event_1',
    definitionId: 'mushroom_festival',
    label: 'Mushroom Festival',
    startedDay: 1,
    intensity: 30,
    relatedFactionIds: [],
    relatedCultureIds: [],
    tags: [],
    activeFlags: [],
    ...overrides,
  }
}

function sampleRumour(
  overrides: Partial<SocialRumourState> = {},
): SocialRumourState {
  return {
    id: 'rumour_1',
    label: 'Cook never sleeps',
    strength: 25,
    accuracy: 'partial',
    firstHeardDay: 1,
    lastSpreadDay: 1,
    tags: [],
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

describe('Phase 42 / ISSUE-002 — Per-field cause emission on world mutators', () => {
  it('modifyCulture emits one cause per changed numeric field', () => {
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
              { familiarity: 70, tension: 35, comfort: 40 },
              { source: 'cultures.test', readable: 'culture shift' },
            )
          },
        ],
      },
    }
    const result = simulateDay(before, defaultInput(), [mod])

    const familiarityCause = result.state.causes.find(
      (c) => c.target === 'culture:goblin_common.familiarity',
    )
    const tensionCause = result.state.causes.find(
      (c) => c.target === 'culture:goblin_common.tension',
    )
    expect(familiarityCause).toBeDefined()
    expect(familiarityCause?.targetType).toBe('culture')
    expect(familiarityCause?.amount).toBe(10)
    expect(familiarityCause?.direction).toBe('increase')
    expect(familiarityCause?.tags).toContain('culture')
    expect(familiarityCause?.tags).toContain('familiarity')

    expect(tensionCause).toBeDefined()
    expect(tensionCause?.amount).toBe(15)

    // `comfort` didn't actually change (40 → 40) so no cause for it.
    const comfortCause = result.state.causes.find(
      (c) => c.target === 'culture:goblin_common.comfort',
    )
    expect(comfortCause).toBeUndefined()
  })

  it('modifyFaction emits per-field causes', () => {
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
              { relationship: 30, trust: 25 },
              { source: 'factions.test', readable: 'fallout' },
            )
          },
        ],
      },
    }
    const result = simulateDay(before, defaultInput(), [mod])
    const factionCauses = result.state.causes.filter(
      (c) => c.targetType === 'faction',
    )
    const paths = factionCauses.map((c) => c.target).sort()
    expect(paths).toEqual([
      'faction:iron_pick_guild.relationship',
      'faction:iron_pick_guild.trust',
    ])
    expect(factionCauses.find((c) => c.target.endsWith('.relationship'))?.amount).toBe(-20)
    expect(factionCauses.find((c) => c.target.endsWith('.trust'))?.amount).toBe(-15)
  })

  it('modifySupplier emits per-field causes; aggregate fallback fires on non-numeric-only updates', () => {
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
              { reliability: 35, relationship: 30 },
              { source: 'suppliers.test', readable: 'late delivery' },
            )
            // Non-numeric-only update — should fall back to aggregate.
            ctx.modifySupplier(
              'brakka_mushroom_cart',
              { goodsProvided: ['mushrooms', 'cheese'] },
              { source: 'suppliers.expand', readable: 'new line of goods' },
            )
          },
        ],
      },
    }
    const result = simulateDay(before, defaultInput(), [mod])

    const numericCauses = result.state.causes.filter(
      (c) =>
        c.target === 'supplier:brakka_mushroom_cart.reliability' ||
        c.target === 'supplier:brakka_mushroom_cart.relationship',
    )
    expect(numericCauses.map((c) => c.target).sort()).toEqual([
      'supplier:brakka_mushroom_cart.relationship',
      'supplier:brakka_mushroom_cart.reliability',
    ])

    // Aggregate fallback from the non-numeric-only update.
    const aggregate = result.state.causes.find(
      (c) =>
        c.target === 'brakka_mushroom_cart' &&
        c.source === 'suppliers.expand',
    )
    expect(aggregate).toBeDefined()
    expect(aggregate?.targetType).toBe('supplier')
  })

  it('modifyTavernIdentity falls back to aggregate cause when only arrays change', () => {
    const before = createInitialTavernState()
    const mod: SimulationModule = {
      id: 'identity-mutator',
      version: '0.0.1',
      hooks: {
        identityGeneration: [
          (ctx: SimContext) => {
            ctx.modifyTavernIdentity(
              { atmosphereTags: ['lively'] },
              { source: 'identity.test', readable: 'atmosphere shift' },
            )
          },
        ],
      },
    }
    const result = simulateDay(before, defaultInput(), [mod])
    const cause = result.state.causes.find(
      (c) => c.targetType === 'tavern_identity',
    )
    expect(cause).toBeDefined()
    // Aggregate fallback target — engine.modifyTavernIdentity uses
    // `runtime.meta.tavernId` when no numeric field moved.
    expect(cause?.target).toBe(result.state.meta.tavernId)
  })
})

describe('Phase 42 / ISSUE-002 — createStateDiff walks world slices and modules', () => {
  it('diffCultures emits one StateChange per moved numeric field', () => {
    const before = withWorldRecord(
      createInitialTavernState(),
      'cultures',
      'goblin_common',
      sampleCulture(),
    )
    const after = withWorldRecord(
      before,
      'cultures',
      'goblin_common',
      sampleCulture({ familiarity: 78, tension: 50 }),
    )
    const diff = createStateDiff(before, after)
    const familiarity = diff.changes.find(
      (c) => c.path === 'cultures.goblin_common.familiarity',
    )
    const tension = diff.changes.find(
      (c) => c.path === 'cultures.goblin_common.tension',
    )
    expect(familiarity?.delta).toBe(18)
    expect(tension?.delta).toBe(30)
    // Both deltas exceed the meter threshold (5).
    expect(
      diff.significantChanges.some(
        (c) => c.path === 'cultures.goblin_common.familiarity',
      ),
    ).toBe(true)
  })

  it('diffSuppliers includes meter fields but skips timestamp fields', () => {
    const before = withWorldRecord(
      createInitialTavernState(),
      'suppliers',
      'brakka_mushroom_cart',
      sampleSupplier({ lastDeliveryDay: 1 }),
    )
    const after = withWorldRecord(
      before,
      'suppliers',
      'brakka_mushroom_cart',
      sampleSupplier({ reliability: 30, lastDeliveryDay: 5 }),
    )
    const diff = createStateDiff(before, after)
    expect(
      diff.changes.find(
        (c) => c.path === 'suppliers.brakka_mushroom_cart.reliability',
      ),
    ).toBeDefined()
    // lastDeliveryDay is intentionally skipped.
    expect(
      diff.changes.find(
        (c) => c.path === 'suppliers.brakka_mushroom_cart.lastDeliveryDay',
      ),
    ).toBeUndefined()
  })

  it('diffRegulars emits loyalty/irritation/visits but skips timestamp stamps', () => {
    const before = withWorldRecord(
      createInitialTavernState(),
      'regulars',
      'nib_the_quick',
      sampleRegular(),
    )
    const after = withWorldRecord(
      before,
      'regulars',
      'nib_the_quick',
      sampleRegular({ loyalty: 70, irritation: 40, visits: 4, lastSeenDay: 10 }),
    )
    const diff = createStateDiff(before, after)
    expect(
      diff.changes.find((c) => c.path === 'regulars.nib_the_quick.loyalty'),
    ).toBeDefined()
    expect(
      diff.changes.find((c) => c.path === 'regulars.nib_the_quick.lastSeenDay'),
    ).toBeUndefined()
  })

  it('diffLocalEvents handles undefined → number transitions on optional fields', () => {
    // `ageDays` is undefined in `sampleLocalEvent()`'s default — the
    // typeof guard in `diffRecordNumerics` must skip the
    // `undefined ↔ number` transition rather than emit a NaN delta.
    const before = withWorldRecord(
      createInitialTavernState(),
      'localEvents',
      'event_1',
      sampleLocalEvent(),
    )
    const after = withWorldRecord(
      before,
      'localEvents',
      'event_1',
      sampleLocalEvent({ intensity: 60, ageDays: 4 }),
    )
    const diff = createStateDiff(before, after)
    expect(
      diff.changes.find((c) => c.path === 'localEvents.event_1.intensity'),
    ).toBeDefined()
    // ageDays moved from undefined → 4; the typeof guard skips that
    // transition (numericDelta-style guard) so no diff entry appears.
    expect(
      diff.changes.find((c) => c.path === 'localEvents.event_1.ageDays'),
    ).toBeUndefined()
  })

  it('diffSocialRumours surfaces strength and accuracy', () => {
    const before = withWorldRecord(
      createInitialTavernState(),
      'socialRumours',
      'rumour_1',
      sampleRumour(),
    )
    const after = withWorldRecord(
      before,
      'socialRumours',
      'rumour_1',
      sampleRumour({ strength: 60, accuracy: 'true' }),
    )
    const diff = createStateDiff(before, after)
    expect(
      diff.changes.find((c) => c.path === 'socialRumours.rumour_1.strength'),
    ).toBeDefined()
    expect(
      diff.changes.find((c) => c.path === 'socialRumours.rumour_1.accuracy'),
    ).toBeDefined()
  })

  it('diffTavernIdentity emits foundingDay when it moves', () => {
    const before = createInitialTavernState()
    const after: TavernState = {
      ...before,
      world: {
        ...before.world,
        tavernIdentity: { ...before.world.tavernIdentity, foundingDay: 42 },
      },
    }
    const diff = createStateDiff(before, after)
    expect(
      diff.changes.find((c) => c.path === 'tavernIdentity.foundingDay'),
    ).toBeDefined()
  })

  it('diffModules walks shallowly per top-level key', () => {
    const before = createInitialTavernState()
    const after: TavernState = {
      ...before,
      modules: {
        ...before.modules,
        demo: { foo: 1, bar: 'unchanged' },
      },
    }
    // Seed the prior side with a matching `demo` slice so the walk
    // compares keys rather than slice presence.
    const beforeWithDemo: TavernState = {
      ...before,
      modules: { ...before.modules, demo: { foo: 0, bar: 'unchanged' } },
    }
    const diff = createStateDiff(beforeWithDemo, after)
    expect(
      diff.changes.find((c) => c.path === 'modules.demo.foo'),
    ).toBeDefined()
    expect(
      diff.changes.find((c) => c.path === 'modules.demo.bar'),
    ).toBeUndefined()
  })
})

describe('Phase 42 / ISSUE-002 — Cause-coverage credits world mutations', () => {
  it('a culture mutation produces a matching diff entry and is not "unexplained"', () => {
    const before = withWorldRecord(
      createInitialTavernState(),
      'cultures',
      'goblin_common',
      sampleCulture(),
    )
    const mod: SimulationModule = {
      id: 'culture-coverage',
      version: '0.0.1',
      hooks: {
        cultureUpdate: [
          (ctx: SimContext) => {
            ctx.modifyCulture(
              'goblin_common',
              { familiarity: 80 },
              { source: 'cultures.test', readable: 'culture shift' },
            )
          },
        ],
      },
    }
    const result = simulateDay(before, defaultInput(), [mod])
    const dayDiff = result.diffs.find((d) => d.boundary === 'day')
    expect(dayDiff).toBeDefined()
    const familiarityChange = dayDiff!.changes.find(
      (c) => c.path === 'cultures.goblin_common.familiarity',
    )
    expect(familiarityChange).toBeDefined()
    expect(familiarityChange?.delta).toBe(20)

    const unexplained = findUnexplainedSignificantChanges(
      dayDiff,
      result.state.causes,
    )
    expect(
      unexplained.find(
        (c) => c.path === 'cultures.goblin_common.familiarity',
      ),
    ).toBeUndefined()
  })

  it('faction + supplier mutations in one day are both credited', () => {
    let before = createInitialTavernState()
    before = withWorldRecord(before, 'factions', 'iron_pick_guild', sampleFaction())
    before = withWorldRecord(
      before,
      'suppliers',
      'brakka_mushroom_cart',
      sampleSupplier(),
    )
    const mod: SimulationModule = {
      id: 'multi-coverage',
      version: '0.0.1',
      hooks: {
        factionUpdate: [
          (ctx: SimContext) => {
            ctx.modifyFaction(
              'iron_pick_guild',
              { trust: 56 },
              { source: 'factions.test', readable: 'trust bump' },
            )
          },
        ],
        supplierUpdate: [
          (ctx: SimContext) => {
            ctx.modifySupplier(
              'brakka_mushroom_cart',
              { relationship: 37 },
              { source: 'suppliers.test', readable: 'relationship drop' },
            )
          },
        ],
      },
    }
    const result = simulateDay(before, defaultInput(), [mod])
    const dayDiff = result.diffs.find((d) => d.boundary === 'day')
    const unexplained = findUnexplainedSignificantChanges(
      dayDiff,
      result.state.causes,
    )
    expect(
      unexplained.find((c) => c.path.startsWith('factions.')),
    ).toBeUndefined()
    expect(
      unexplained.find((c) => c.path.startsWith('suppliers.')),
    ).toBeUndefined()
  })
})
