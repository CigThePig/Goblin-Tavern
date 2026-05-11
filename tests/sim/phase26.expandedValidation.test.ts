import { describe, it, expect, beforeAll } from 'vitest'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  validateEntityRef,
  validateWorldReferences,
} from '../../src/sim/state/referenceValidation'
import {
  validateRegistryId,
  validateUniqueIds,
} from '../../src/sim/state/registryValidation'
import {
  safeValidateState,
  validateState,
} from '../../src/sim/state/validation'
import { withModuleState } from '../../src/sim/testing/stateFactories'
import {
  ensureStarterNamingProfilesRegistered,
  namingProfileRegistry,
} from '../../src/sim/content/naming/namingProfiles'
import type {
  CultureWorldState,
  FactionWorldState,
  RegularWorldState,
  SupplierWorldState,
  TavernState,
} from '../../src/sim/state/TavernState'

// Phase 26 — Expanded schema validation and identity safety.
//
// These tests cover:
//   1. Default tavern state validates with the new `world` branch.
//   2. Supplier referencing an unknown stock id fails validation.
//   3. Regular referencing an unknown customer group id fails validation.
//   4. Faction referencing an unknown culture id fails validation.
//   5. Generated name with an unknown naming profile id fails validation.
//   6. Social rumour subject pointing at an unknown entity fails validation.
//   7. Existing Phase 6 schema validation behaviour still applies.
//   8. Unknown `state.modules` keys remain warnings rather than errors.
//   9. Registry validation helpers (membership / uniqueness) behave correctly.
//  10. `validateEntityRef` resolves all known kinds and rejects empty ids.

// Phase 24 §"Name Generator Starter" — register the starter `goblin_common`
// profile once for every test in this file. The naming profile registry is
// a module-level singleton; `ensureStarterNamingProfilesRegistered` is
// idempotent.
beforeAll(() => {
  ensureStarterNamingProfilesRegistered()
})

const VALID_NAMING_PROFILE = 'goblin_common'

function sampleCulture(overrides: Partial<CultureWorldState> = {}): CultureWorldState {
  return {
    id: 'goblin_common',
    label: 'Goblin Common',
    familiarity: 60,
    comfort: 40,
    tension: 20,
    namingProfileId: VALID_NAMING_PROFILE,
    preferredStockTags: ['cheap'],
    dislikedTags: ['fancy'],
    importantCalendarTags: [],
    tags: ['goblin'],
    ...overrides,
  }
}

function sampleFaction(overrides: Partial<FactionWorldState> = {}): FactionWorldState {
  return {
    id: 'iron_pick_guild',
    label: 'Iron Pick Guild',
    relationship: 50,
    influence: 30,
    trust: 40,
    fear: 20,
    cultureId: 'goblin_common',
    tags: ['miner'],
    activeFlags: [],
    ...overrides,
  }
}

function sampleSupplier(overrides: Partial<SupplierWorldState> = {}): SupplierWorldState {
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

function sampleRegular(overrides: Partial<RegularWorldState> = {}): RegularWorldState {
  return {
    id: 'nib_the_quick',
    name: {
      display: 'Nib Cracket',
      profileId: VALID_NAMING_PROFILE,
      parts: { given: 'Nib', family: 'Cracket' },
      patternId: 'given_family',
      generatedBy: 'phase26-test',
    },
    customerGroupId: 'local_goblins',
    cultureId: 'goblin_common',
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

function withWorldCulture(
  state: TavernState,
  culture: CultureWorldState,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      cultures: { ...state.world.cultures, [culture.id]: culture },
    },
  }
}

function withWorldFaction(
  state: TavernState,
  faction: FactionWorldState,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      factions: { ...state.world.factions, [faction.id]: faction },
    },
  }
}

function withWorldSupplier(
  state: TavernState,
  supplier: SupplierWorldState,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      suppliers: { ...state.world.suppliers, [supplier.id]: supplier },
    },
  }
}

function withWorldRegular(
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

describe('Phase 26 — Expanded validation and identity safety', () => {
  it('1. createInitialTavernState validates successfully with the world branch', () => {
    const state = createInitialTavernState()
    expect(() => validateState(state)).not.toThrow()
    const result = safeValidateState(state)
    expect(result.success).toBe(true)
  })

  it('2. supplier referencing an unknown stock id fails validation', () => {
    let state = createInitialTavernState()
    state = withWorldSupplier(
      state,
      sampleSupplier({ goodsProvided: ['ale', 'moon_cheese'] }),
    )
    const result = safeValidateState(state)
    expect(result.success).toBe(false)
    if (!result.success) {
      const stockError = result.errors.find((e) => e.code === 'unknown_stock_ref')
      expect(stockError).toBeDefined()
      expect(stockError?.path).toBe(
        'world.suppliers.brakka_mushroom_cart.goodsProvided[1]',
      )
      expect(stockError?.message).toContain("'moon_cheese'")
    }
    expect(() => validateState(state)).toThrow(/moon_cheese/)
  })

  it('3. regular referencing an unknown customer_group id fails validation', () => {
    let state = createInitialTavernState()
    const regular = sampleRegular({ customerGroupId: 'nonexistent_group' })
    delete regular.cultureId
    state = withWorldRegular(state, regular)
    const result = safeValidateState(state)
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.errors.find(
        (e) => e.code === 'unknown_customer_group_ref',
      )
      expect(issue).toBeDefined()
      expect(issue?.path).toBe(
        'world.regulars.nib_the_quick.customerGroupId',
      )
    }
  })

  it('4. faction referencing an unknown culture id fails validation', () => {
    let state = createInitialTavernState()
    state = withWorldFaction(
      state,
      sampleFaction({ cultureId: 'mystery_culture' }),
    )
    const result = safeValidateState(state)
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.errors.find((e) => e.code === 'unknown_culture_ref')
      expect(issue).toBeDefined()
      expect(issue?.path).toBe('world.factions.iron_pick_guild.cultureId')
      expect(issue?.message).toContain("'mystery_culture'")
    }
  })

  it('5. generated name with an unknown naming profile id fails validation', () => {
    let state = createInitialTavernState()
    state = withWorldCulture(
      state,
      sampleCulture({ namingProfileId: 'profile_that_does_not_exist' }),
    )
    const result = safeValidateState(state)
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.errors.find(
        (e) => e.code === 'unknown_naming_profile_ref',
      )
      expect(issue).toBeDefined()
      expect(issue?.path).toBe('world.cultures.goblin_common.namingProfileId')
    }
  })

  it('5b. regular with a generated name using an unknown profile fails validation', () => {
    let state = createInitialTavernState()
    state = withWorldCulture(state, sampleCulture())
    state = withWorldRegular(
      state,
      sampleRegular({
        name: {
          display: 'Mystery',
          profileId: 'unknown_profile',
          parts: { given: 'Mystery' },
          patternId: 'given_family',
          generatedBy: 'phase26-test',
        },
      }),
    )
    const result = safeValidateState(state)
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.errors.find(
        (e) =>
          e.code === 'unknown_naming_profile_ref' &&
          e.path === 'world.regulars.nib_the_quick.name.profileId',
      )
      expect(issue).toBeDefined()
    }
  })

  it('6. social rumour subject with an unknown entity id fails validation', () => {
    const state = createInitialTavernState()
    state.world.socialRumours['rumour_1'] = {
      id: 'rumour_1',
      label: 'Stew is suspicious',
      strength: 40,
      accuracy: 'partial',
      subject: { kind: 'supplier', id: 'phantom_supplier' },
      firstHeardDay: 1,
      lastSpreadDay: 2,
      tags: [],
    }
    const result = safeValidateState(state)
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.errors.find(
        (e) => e.code === 'unknown_supplier_ref',
      )
      expect(issue).toBeDefined()
      expect(issue?.path).toBe('world.socialRumours.rumour_1.subject.id')
    }
  })

  it('6b. social rumour involvedRefs are validated when present', () => {
    const state = createInitialTavernState()
    state.world.socialRumours['rumour_2'] = {
      id: 'rumour_2',
      label: 'Nobody saw it',
      strength: 30,
      accuracy: 'unknown',
      firstHeardDay: 1,
      lastSpreadDay: 1,
      tags: [],
      involvedRefs: [
        { kind: 'staff', id: 'cook' }, // exists
        { kind: 'regular', id: 'ghost_regular' }, // does not exist
      ],
    }
    const result = safeValidateState(state)
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.errors.find(
        (e) =>
          e.code === 'unknown_regular_ref' &&
          e.path === 'world.socialRumours.rumour_2.involvedRefs[1].id',
      )
      expect(issue).toBeDefined()
    }
  })

  it('7. existing Phase 6 schema validation still works', () => {
    const state = createInitialTavernState()
    const dirty = {
      ...state,
      areas: {
        ...state.areas,
        kitchen: { ...state.areas.kitchen!, cleanliness: 250 },
      },
    }
    expect(() => validateState(dirty)).toThrow(/areas\.kitchen\.cleanliness/)
    expect(() =>
      validateState({ ...state, coin: Number.NaN as unknown as number }),
    ).toThrow(/coin/)
  })

  it('8. unknown state.modules keys remain warnings, not hard failures', () => {
    const state = withModuleState(
      createInitialTavernState(),
      'unknown_mod',
      { foo: 1 },
    )
    const result = safeValidateState(state, { modules: [] })
    expect(result.success).toBe(true)
    if (result.success) {
      const warning = result.warnings.find(
        (w) => w.path === 'modules.unknown_mod',
      )
      expect(warning).toBeDefined()
      expect(warning?.code).toBe('unknown_module_key')
    }
  })

  it('9. valid populated world state passes both schema and reference checks', () => {
    let state = createInitialTavernState()
    state = withWorldCulture(state, sampleCulture())
    state = withWorldFaction(state, sampleFaction())
    state = withWorldSupplier(
      state,
      sampleSupplier({
        goodsProvided: ['ale', 'stew'],
        factionId: 'iron_pick_guild',
        cultureId: 'goblin_common',
      }),
    )
    state = withWorldRegular(
      state,
      sampleRegular({
        favoriteStockId: 'ale',
        cultureId: 'goblin_common',
        factionId: 'iron_pick_guild',
      }),
    )
    state.world.socialRumours['rumour_ok'] = {
      id: 'rumour_ok',
      label: 'A real rumour',
      strength: 20,
      accuracy: 'true',
      subject: { kind: 'regular', id: 'nib_the_quick' },
      firstHeardDay: 1,
      lastSpreadDay: 2,
      tags: [],
    }
    expect(() => validateState(state)).not.toThrow()
    const result = safeValidateState(state)
    expect(result.success).toBe(true)
  })
})

describe('Phase 26 — Cross-reference helpers', () => {
  it('validateEntityRef resolves each known kind against state', () => {
    let state = createInitialTavernState()
    state = withWorldCulture(state, sampleCulture())
    state = withWorldFaction(state, sampleFaction())
    state = withWorldSupplier(state, sampleSupplier())
    state = withWorldRegular(state, sampleRegular())
    state.world.notableNpcs['npc_1'] = {
      id: 'npc_1',
      name: {
        display: 'Famous Goblin',
        profileId: VALID_NAMING_PROFILE,
        parts: { given: 'Snit' },
        patternId: 'given_family',
        generatedBy: 'phase26-test',
      },
      kind: 'visiting_dignitary',
      cultureId: 'goblin_common',
      firstSeenDay: 1,
      tags: [],
      activeFlags: [],
    }
    state.world.localEvents['event_1'] = {
      id: 'event_1',
      definitionId: 'mushroom_festival',
      label: 'Mushroom Festival',
      startedDay: 1,
      intensity: 30,
      relatedFactionIds: [],
      relatedCultureIds: ['goblin_common'],
      tags: [],
      activeFlags: [],
    }
    state.world.socialRumours['rumour_x'] = {
      id: 'rumour_x',
      label: 'Hearsay',
      strength: 20,
      accuracy: 'partial',
      firstHeardDay: 1,
      lastSpreadDay: 1,
      tags: [],
    }

    // Known kinds with valid ids
    expect(
      validateEntityRef(state, { kind: 'staff', id: 'cook' }),
    ).toEqual([])
    expect(
      validateEntityRef(state, { kind: 'customer_group', id: 'local_goblins' }),
    ).toEqual([])
    expect(
      validateEntityRef(state, { kind: 'area', id: 'kitchen' }),
    ).toEqual([])
    expect(
      validateEntityRef(state, { kind: 'stock', id: 'ale' }),
    ).toEqual([])
    expect(
      validateEntityRef(state, { kind: 'role', id: 'cook' }),
    ).toEqual([])
    expect(
      validateEntityRef(state, { kind: 'culture', id: 'goblin_common' }),
    ).toEqual([])
    expect(
      validateEntityRef(state, { kind: 'faction', id: 'iron_pick_guild' }),
    ).toEqual([])
    expect(
      validateEntityRef(state, {
        kind: 'supplier',
        id: 'brakka_mushroom_cart',
      }),
    ).toEqual([])
    expect(
      validateEntityRef(state, { kind: 'regular', id: 'nib_the_quick' }),
    ).toEqual([])
    expect(
      validateEntityRef(state, { kind: 'notable_npc', id: 'npc_1' }),
    ).toEqual([])
    expect(
      validateEntityRef(state, { kind: 'local_event', id: 'event_1' }),
    ).toEqual([])
    expect(
      validateEntityRef(state, { kind: 'rumour', id: 'rumour_x' }),
    ).toEqual([])
    expect(
      validateEntityRef(state, {
        kind: 'tavern_identity',
        id: 'the_crooked_keg',
      }),
    ).toEqual([])
    expect(
      validateEntityRef(state, { kind: 'system', id: 'engine' }),
    ).toEqual([])
    expect(
      validateEntityRef(state, { kind: 'other', id: 'anything' }),
    ).toEqual([])
  })

  it('validateEntityRef rejects empty ids and unknown ids', () => {
    const state = createInitialTavernState()
    const emptyIssues = validateEntityRef(state, {
      kind: 'staff',
      id: '',
    })
    expect(emptyIssues.length).toBe(1)
    expect(emptyIssues[0]?.code).toBe('empty_ref_id')

    const unknownIssues = validateEntityRef(state, {
      kind: 'stock',
      id: 'phantom_stock',
    })
    expect(unknownIssues.length).toBe(1)
    expect(unknownIssues[0]?.code).toBe('unknown_stock_ref')
  })

  it('validateWorldReferences returns no issues for the default state', () => {
    const state = createInitialTavernState()
    expect(validateWorldReferences(state)).toEqual([])
  })
})

describe('Phase 26 — Registry validation helpers', () => {
  it('validateRegistryId reports missing ids with a stable code', () => {
    const exists = (id: string) => ['ale', 'stew'].includes(id)
    expect(validateRegistryId('p', 'stock', 'ale', exists)).toEqual([])
    const missing = validateRegistryId('p', 'stock', 'phantom', exists)
    expect(missing.length).toBe(1)
    expect(missing[0]?.code).toBe('unknown_registry_id')
    expect(missing[0]?.path).toBe('p')

    const empty = validateRegistryId('p', 'stock', '', exists)
    expect(empty.length).toBe(1)
    expect(empty[0]?.code).toBe('empty_registry_id')
  })

  it('validateUniqueIds flags duplicates with the same path', () => {
    expect(validateUniqueIds('p', ['a', 'b', 'c'])).toEqual([])
    const dups = validateUniqueIds('p', ['a', 'b', 'a', 'c', 'b'])
    expect(dups.length).toBe(2)
    expect(dups.every((i) => i.code === 'duplicate_id')).toBe(true)
    const ids = dups.map((i) => i.message)
    expect(ids.some((m) => m.includes("'a'"))).toBe(true)
    expect(ids.some((m) => m.includes("'b'"))).toBe(true)
  })

  it('naming profile registry holds the starter profile used by tests', () => {
    expect(namingProfileRegistry.has(VALID_NAMING_PROFILE)).toBe(true)
  })
})
