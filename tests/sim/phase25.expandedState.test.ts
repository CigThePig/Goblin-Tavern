import { describe, it, expect } from 'vitest'

import {
  cloneTavernState,
  createInitialTavernState,
  createInitialWorldState,
} from '../../src/sim/state/defaults'
import { ensureWorldBranch } from '../../src/sim/state/migrations'
import { normalizeTavernState } from '../../src/sim/state/normalize'
import {
  EntityRefSchema,
  WorldStateSchema,
} from '../../src/sim/state/schemas'
import { safeValidateState } from '../../src/sim/state/validation'
import type {
  CultureWorldState,
  FactionWorldState,
  RegularWorldState,
  TavernState,
  WorldState,
} from '../../src/sim/state/TavernState'

// Phase 25 — Expanded world and social state model.
//
// These tests cover:
//   1. `createInitialTavernState()` includes a top-level `world` branch.
//   2. Default world branches are empty records (or empty arrays for
//      `tavernIdentity`).
//   3. `cloneTavernState()` deep-clones `world`.
//   4. JSON round-trip preserves the new state shape.
//   5. `safeValidateState()` accepts the default tavern state.
//   6. Invalid world meter values fail validation.
//   7. `EntityRefSchema` accepts the new world-entity kinds.
//   8. `normalizeTavernState()` clamps world meter fields without
//      inventing missing records.
//   9. `ensureWorldBranch()` attaches an empty world to pre-Phase-25
//      states without disturbing existing fields.
//  10. Memories can reference world entities via the widened EntityRef.

const SAMPLE_NAME = {
  display: 'Nib Cracket',
  profileId: 'goblin_common',
  parts: { given: 'Nib', family: 'Cracket' },
  patternId: 'given_family',
  generatedBy: 'phase25-test',
}

function sampleCulture(overrides: Partial<CultureWorldState> = {}): CultureWorldState {
  return {
    id: 'goblin_common',
    label: 'Goblin Common',
    familiarity: 60,
    comfort: 40,
    tension: 20,
    namingProfileId: 'goblin_common',
    preferredStockTags: ['cheap'],
    dislikedTags: ['fancy'],
    importantCalendarTags: ['mushroom_festival'],
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

function sampleRegular(overrides: Partial<RegularWorldState> = {}): RegularWorldState {
  return {
    id: 'regular_1',
    name: { ...SAMPLE_NAME },
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

describe('Phase 25 — Expanded world and social state', () => {
  it('1. createInitialTavernState() includes a top-level world branch', () => {
    const state = createInitialTavernState()
    expect(state.world).toBeDefined()
    expect(Object.keys(state).sort()).toContain('world')
  })

  it('2. every world branch defaults to an empty record except tavernIdentity', () => {
    const state = createInitialTavernState()
    expect(state.world.cultures).toEqual({})
    expect(state.world.factions).toEqual({})
    expect(state.world.suppliers).toEqual({})
    expect(state.world.regulars).toEqual({})
    expect(state.world.notableNpcs).toEqual({})
    expect(state.world.localEvents).toEqual({})
    expect(state.world.socialRumours).toEqual({})
    expect(state.world.tavernIdentity).toEqual({
      foundingDay: 0,
      knownFor: [],
      houseRules: [],
      atmosphereTags: [],
    })
  })

  it('3. tavernIdentity defaults are serializable arrays and foundingDay 0', () => {
    const state = createInitialTavernState()
    expect(state.world.tavernIdentity.foundingDay).toBe(0)
    expect(Array.isArray(state.world.tavernIdentity.knownFor)).toBe(true)
    expect(Array.isArray(state.world.tavernIdentity.houseRules)).toBe(true)
    expect(Array.isArray(state.world.tavernIdentity.atmosphereTags)).toBe(true)
  })

  it('4. cloneTavernState() deep-clones the world branch', () => {
    const state = createInitialTavernState()
    state.world.cultures['goblin_common'] = sampleCulture()
    const clone = cloneTavernState(state)
    expect(clone.world).not.toBe(state.world)
    expect(clone.world.cultures).not.toBe(state.world.cultures)
    expect(clone.world.cultures['goblin_common']).not.toBe(
      state.world.cultures['goblin_common'],
    )
    expect(clone.world).toEqual(state.world)

    // Mutating the clone must not bleed into the original.
    const cloneCulture = clone.world.cultures['goblin_common']
    if (cloneCulture) {
      cloneCulture.familiarity = 0
    }
    expect(state.world.cultures['goblin_common']?.familiarity).toBe(60)
  })

  it('5. JSON.stringify and parse roundtrip preserve the new state shape', () => {
    const state = createInitialTavernState()
    state.world.factions['iron_pick_guild'] = sampleFaction()
    const roundTripped = JSON.parse(JSON.stringify(state)) as TavernState
    expect(roundTripped.world).toEqual(state.world)
    expect(Object.keys(roundTripped).sort()).toEqual(Object.keys(state).sort())
  })

  it('6. safeValidateState(createInitialTavernState()) succeeds', () => {
    const result = safeValidateState(createInitialTavernState())
    expect(result.success).toBe(true)
  })

  it('7. invalid world meter values fail validation', () => {
    const state = createInitialTavernState()
    // Out-of-range familiarity on a culture should fail.
    state.world.cultures['goblin_common'] = sampleCulture({ familiarity: 1234 })
    const result = safeValidateState(state)
    expect(result.success).toBe(false)
    if (!result.success) {
      const culturePath = result.errors.find((e) =>
        e.path.includes('world.cultures'),
      )
      expect(culturePath).toBeDefined()
    }
  })

  it('8. EntityRefSchema accepts supplier, regular, faction, and culture refs', () => {
    expect(
      EntityRefSchema.safeParse({ kind: 'supplier', id: 'mushroom_cartel' }).success,
    ).toBe(true)
    expect(
      EntityRefSchema.safeParse({ kind: 'regular', id: 'regular_1' }).success,
    ).toBe(true)
    expect(
      EntityRefSchema.safeParse({ kind: 'faction', id: 'iron_pick_guild' }).success,
    ).toBe(true)
    expect(
      EntityRefSchema.safeParse({ kind: 'culture', id: 'goblin_common' }).success,
    ).toBe(true)
    expect(
      EntityRefSchema.safeParse({ kind: 'notable_npc', id: 'npc_1' }).success,
    ).toBe(true)
    expect(
      EntityRefSchema.safeParse({ kind: 'local_event', id: 'event_1' }).success,
    ).toBe(true)
    expect(
      EntityRefSchema.safeParse({ kind: 'rumour', id: 'rumour_1' }).success,
    ).toBe(true)
    expect(
      EntityRefSchema.safeParse({
        kind: 'tavern_identity',
        id: 'the_crooked_keg',
      }).success,
    ).toBe(true)
    // Unknown kinds still rejected.
    expect(
      EntityRefSchema.safeParse({ kind: 'dragon', id: 'smaug' }).success,
    ).toBe(false)
  })

  it('9. normalizeTavernState clamps world meter fields without inventing records', () => {
    const state = createInitialTavernState()
    state.world.cultures['goblin_common'] = sampleCulture({
      familiarity: 250,
      comfort: -30,
    })
    state.world.factions['iron_pick_guild'] = sampleFaction({ relationship: 999 })
    state.world.regulars['regular_1'] = sampleRegular({
      loyalty: 300,
      irritation: -10,
    })

    const before = JSON.parse(JSON.stringify(state.world)) as WorldState
    const normalized = normalizeTavernState(state)

    expect(normalized.world.cultures['goblin_common']?.familiarity).toBe(100)
    expect(normalized.world.cultures['goblin_common']?.comfort).toBe(0)
    expect(normalized.world.factions['iron_pick_guild']?.relationship).toBe(100)
    expect(normalized.world.regulars['regular_1']?.loyalty).toBe(100)
    expect(normalized.world.regulars['regular_1']?.irritation).toBe(0)

    // Normalization must not invent new records or remove existing ones.
    expect(Object.keys(normalized.world.cultures).sort()).toEqual(
      Object.keys(before.cultures).sort(),
    )
    expect(Object.keys(normalized.world.regulars).sort()).toEqual(
      Object.keys(before.regulars).sort(),
    )
    // Empty containers stay empty.
    expect(normalized.world.suppliers).toEqual({})
    expect(normalized.world.notableNpcs).toEqual({})
    expect(normalized.world.socialRumours).toEqual({})
  })

  it('10. ensureWorldBranch fills in a missing world without touching other fields', () => {
    const state = createInitialTavernState()
    // Simulate an older save with no `world` branch.
    const legacy = { ...state } as Partial<TavernState>
    delete legacy.world
    expect((legacy as { world?: WorldState }).world).toBeUndefined()

    const migrated = ensureWorldBranch(legacy)
    expect(migrated.world).toEqual(createInitialWorldState())
    // Other top-level fields untouched.
    expect(migrated.coin).toBe(state.coin)
    expect(migrated.areas).toBe(state.areas)

    // If world already exists, it is preserved untouched.
    const withWorld: TavernState = {
      ...state,
      world: { ...state.world, cultures: { goblin_common: sampleCulture() } },
    }
    const passthrough = ensureWorldBranch(withWorld)
    expect(passthrough.world).toBe(withWorld.world)
  })

  it('11. WorldStateSchema independently validates the world branch', () => {
    const ok = WorldStateSchema.safeParse(createInitialWorldState())
    expect(ok.success).toBe(true)

    const populated: WorldState = {
      ...createInitialWorldState(),
      cultures: { goblin_common: sampleCulture() },
      factions: { iron_pick_guild: sampleFaction() },
      regulars: { regular_1: sampleRegular() },
    }
    const populatedResult = WorldStateSchema.safeParse(populated)
    expect(populatedResult.success).toBe(true)
  })
})
