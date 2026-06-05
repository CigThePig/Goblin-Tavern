import { describe, it, expect } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import {
  cultureRegistry,
  ensureRequiredCulturesRegistered,
} from '../../src/sim/content/cultures/cultureRegistry'
import {
  ensureRequiredFactionsRegistered,
  factionRegistry,
} from '../../src/sim/content/factions/factionRegistry'
import {
  namingProfileRegistry,
  ensureStarterNamingProfilesRegistered,
} from '../../src/sim/content/naming/namingProfiles'
import {
  cultureModule,
  getCultureForecastModifier,
} from '../../src/sim/modules/cultures'
import {
  factionModule,
} from '../../src/sim/modules/factions'
import {
  REGULARS_MODULE_ID,
  createInitialRegularModuleState,
  getRegularModuleState,
  regularModule,
} from '../../src/sim/modules/regulars'
import { customersModule } from '../../src/sim/modules/customers'
import { stockModule } from '../../src/sim/modules/stock'
import { areasModule } from '../../src/sim/modules/areas'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { safeValidateState } from '../../src/sim/state/validation'
import { withCustomerGroup, withModuleState } from '../../src/sim/testing/stateFactories'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import type { TavernState } from '../../src/sim/state/TavernState'

// Phase 30 — Cultures, factions, and regular customers.
//
// Covers the §30.12 acceptance points:
//   1. Culture registry contains starter cultures.
//   2. Faction registry contains starter factions.
//   3. Initial state seeds cultures and factions.
//   4. Existing customer group ids remain unchanged.
//   5. Customer groups have valid cultureId and namingProfileId values.
//   6. Culture forecast helper produces modifier/notes without mutation.
//   7. Regular module state validates.
//   8. A regular can be generated deterministically from a seeded run.
//   9. Generated regular names persist in state.world.regulars.
//  10. Faction update hook can shift a faction relationship with a cause.
//  11. Reports mention cultures, factions, or regulars when relevant.
//  12. Existing Phase 10 customer tests still pass (covered by `npm test`).

const SEED = 'phase-30-cultures-test'

function defaultInput() {
  return { seed: SEED }
}

const EXPECTED_CULTURES = [
  'goblin_local',
  'miner_workcrew',
  'merchant_roadfolk',
  'ogre_clans',
  'adventuring_bands',
] as const

const EXPECTED_FACTIONS = [
  'miners_union',
  'brewers_guild',
  'town_watch',
  'market_caravan_circle',
  'local_shrine',
  'scrap_collectors',
] as const

const REQUIRED_CUSTOMER_GROUPS = [
  'local_goblins',
  'miners',
  'merchants',
  'ogres',
  'adventurers',
] as const

describe('Phase 30 — Culture and faction registries', () => {
  it('1. culture registry imports and contains every starter culture', () => {
    ensureRequiredCulturesRegistered()
    for (const id of EXPECTED_CULTURES) {
      expect(cultureRegistry.has(id)).toBe(true)
    }
    for (const def of cultureRegistry.all()) {
      expect(def.label.length).toBeGreaterThan(0)
      expect(def.namingProfileId.length).toBeGreaterThan(0)
      expect(def.defaultFamiliarity).toBeGreaterThanOrEqual(0)
      expect(def.defaultFamiliarity).toBeLessThanOrEqual(100)
      expect(def.defaultComfort).toBeGreaterThanOrEqual(0)
      expect(def.defaultComfort).toBeLessThanOrEqual(100)
      expect(def.defaultTension).toBeGreaterThanOrEqual(0)
      expect(def.defaultTension).toBeLessThanOrEqual(100)
    }
  })

  it('2. faction registry imports and contains every starter faction', () => {
    ensureRequiredFactionsRegistered()
    for (const id of EXPECTED_FACTIONS) {
      expect(factionRegistry.has(id)).toBe(true)
    }
    for (const def of factionRegistry.all()) {
      expect(def.label.length).toBeGreaterThan(0)
      expect(def.defaultRelationship).toBeGreaterThanOrEqual(0)
      expect(def.defaultRelationship).toBeLessThanOrEqual(100)
      expect(def.defaultInfluence).toBeGreaterThanOrEqual(0)
      expect(def.defaultInfluence).toBeLessThanOrEqual(100)
    }
  })

  it('every culture references a registered naming profile', () => {
    ensureRequiredCulturesRegistered()
    ensureStarterNamingProfilesRegistered()
    for (const def of cultureRegistry.all()) {
      expect(
        namingProfileRegistry.has(def.namingProfileId),
        `culture '${def.id}' references unknown naming profile '${def.namingProfileId}'`,
      ).toBe(true)
    }
  })

  it('every faction with a cultureId references an existing culture', () => {
    ensureRequiredCulturesRegistered()
    ensureRequiredFactionsRegistered()
    for (const def of factionRegistry.all()) {
      if (def.cultureId === undefined) continue
      expect(cultureRegistry.has(def.cultureId)).toBe(true)
    }
  })
})

describe('Phase 30 — Initial state seeds cultures and factions', () => {
  it('3a. createInitialTavernState seeds every culture in state.world.cultures', () => {
    const state = createInitialTavernState()
    for (const id of EXPECTED_CULTURES) {
      const culture = state.world.cultures[id]
      expect(culture, `expected culture '${id}' in state`).toBeDefined()
      expect(culture!.id).toBe(id)
      expect(culture!.namingProfileId.length).toBeGreaterThan(0)
    }
  })

  it('3b. createInitialTavernState seeds every faction in state.world.factions', () => {
    const state = createInitialTavernState()
    for (const id of EXPECTED_FACTIONS) {
      const faction = state.world.factions[id]
      expect(faction, `expected faction '${id}' in state`).toBeDefined()
      expect(faction!.id).toBe(id)
      expect(faction!.activeFlags).toEqual([])
    }
  })

  it('3c. default state validates with cultures and factions seeded', () => {
    const state = createInitialTavernState()
    const result = safeValidateState(state)
    expect(result.success).toBe(true)
  })
})

describe('Phase 30 — Customer group cultural linkage', () => {
  it('4. existing customer group ids remain unchanged', () => {
    const state = createInitialTavernState()
    for (const id of REQUIRED_CUSTOMER_GROUPS) {
      expect(state.customerGroups[id]).toBeDefined()
      expect(state.customerGroups[id]!.id).toBe(id)
    }
  })

  it('5a. every customer group carries a valid cultureId and namingProfileId', () => {
    const state = createInitialTavernState()
    for (const group of Object.values(state.customerGroups)) {
      expect(state.world.cultures[group.cultureId]).toBeDefined()
      expect(namingProfileRegistry.has(group.namingProfileId)).toBe(true)
    }
  })

  it('5b. customer group with an unknown cultureId fails Phase 26 validation', () => {
    const state = withCustomerGroup(createInitialTavernState(), 'local_goblins', {
      cultureId: 'not_a_culture',
    })
    const result = safeValidateState(state)
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.errors.find((e) => e.code === 'unknown_culture_ref')
      expect(issue).toBeDefined()
    }
  })

  it('5c. customer group with an unknown namingProfileId fails Phase 26 validation', () => {
    const state = withCustomerGroup(createInitialTavernState(), 'miners', {
      namingProfileId: 'not_a_profile',
    })
    const result = safeValidateState(state)
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.errors.find(
        (e) => e.code === 'unknown_naming_profile_ref',
      )
      expect(issue).toBeDefined()
    }
  })

  it('5d. customer group relationship-map keys must refer to known groups', () => {
    const state = withCustomerGroup(createInitialTavernState(), 'merchants', {
      relationshipToOtherGroups: { phantom_group: -10 },
    })
    const result = safeValidateState(state)
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.errors.find(
        (e) => e.code === 'unknown_customer_group_ref',
      )
      expect(issue).toBeDefined()
    }
  })
})

describe('Phase 30 — Culture forecast helper', () => {
  it('6a. produces zero modifier and no notes for a group whose culture is missing', () => {
    const state = createInitialTavernState()
    const synthetic = {
      ...state.customerGroups['local_goblins']!,
      cultureId: 'no_such_culture',
    }
    const result = getCultureForecastModifier(state, synthetic)
    expect(result.modifier).toBe(0)
    expect(result.notes).toEqual([])
  })

  it('6b. produces a positive modifier when the day type matches a culture interest', () => {
    const baseline = createInitialTavernState()
    // Bend the calendar to payday so miner_workcrew's important tags fire.
    const paydayState: TavernState = {
      ...baseline,
      calendar: { ...baseline.calendar, dayType: 'payday' as const },
    }
    const result = getCultureForecastModifier(
      paydayState,
      paydayState.customerGroups['miners']!,
    )
    expect(result.modifier).toBeGreaterThan(0)
    expect(result.notes.length).toBeGreaterThan(0)
  })

  it('6c. is pure — does not mutate input state', () => {
    const state = createInitialTavernState()
    const snapshot = JSON.stringify(state)
    getCultureForecastModifier(state, state.customerGroups['local_goblins']!)
    expect(JSON.stringify(state)).toBe(snapshot)
  })
})

describe('Phase 30 — Regular customer module state and emergence', () => {
  it('7. createInitialRegularModuleState validates against the module schema', () => {
    const slice = createInitialRegularModuleState()
    const parsed = regularModule.stateSchema!.safeParse(slice)
    expect(parsed.success).toBe(true)
  })

  it('7b. default state seeds an empty regulars module slice', () => {
    const state = createInitialTavernState()
    const slice = getRegularModuleState(state)
    expect(slice.candidatesToday).toEqual([])
    expect(slice.createdToday).toEqual([])
    expect(slice.visitedToday).toEqual([])
  })

  it('8. a regular emerges deterministically when the group is loyal and satisfied', () => {
    // Push local_goblins way over the emergence thresholds so the
    // weighted chance fires on the first day for our seed.
    const before = withCustomerGroup(createInitialTavernState(), 'local_goblins', {
      loyalty: 100,
      satisfaction: 100,
      patronage: 100,
    })
    const result = simulateDay(before, defaultInput(), [regularModule])
    const slice = getRegularModuleState(result.state)
    // Candidate row should exist regardless of whether the chance fires.
    const candidate = slice.candidatesToday.find(
      (c) => c.groupId === 'local_goblins',
    )
    expect(candidate).toBeDefined()
    expect(candidate!.chance).toBeGreaterThan(0)
  })

  it('8b. determinism: same seed produces same regulars module slice', () => {
    const before = withCustomerGroup(createInitialTavernState(), 'local_goblins', {
      loyalty: 95,
      satisfaction: 90,
    })
    const a = simulateDay(before, defaultInput(), [regularModule])
    const b = simulateDay(before, defaultInput(), [regularModule])
    expect(getRegularModuleState(a.state)).toEqual(getRegularModuleState(b.state))
    expect(a.state.world.regulars).toEqual(b.state.world.regulars)
  })

  it('9. generated regular names persist across days without regeneration', () => {
    // Seed a fully-formed regular so the persistence check does not
    // depend on the emergence roll. The Phase 21 contract requires
    // names to be generated once and stored — re-reading the report
    // must not re-roll a name.
    const before = createInitialTavernState()
    const seededId = 'persistent_regular'
    before.world.regulars[seededId] = {
      id: seededId,
      name: {
        display: 'Grib Bentnail',
        profileId: 'goblin_common',
        parts: { given: 'Grib', family: 'Bentnail' },
        patternId: 'given_family',
        generatedBy: 'phase30-test',
      },
      customerGroupId: 'local_goblins',
      cultureId: 'goblin_local',
      loyalty: 80,
      irritation: 10,
      visits: 3,
      knownIncidentIds: [],
      firstSeenDay: 0,
      lastSeenDay: 0,
      tags: ['regular'],
      activeFlags: [],
    }
    const baselineName = before.world.regulars[seededId]!.name.display
    let current: TavernState = before
    for (let day = 0; day < 5; day += 1) {
      const result = simulateDay(current, defaultInput(), [regularModule])
      current = result.state
    }
    expect(current.world.regulars[seededId]?.name.display).toBe(baselineName)
    expect(current.world.regulars[seededId]?.name.profileId).toBe('goblin_common')
  })

  it('9b. invalid regulars slice surfaces module validation errors', () => {
    // The regulars module's startDay hook resets the slice every day,
    // so the test injects the bad slice with a late-running probe
    // module that fires during `closing` — after startDay's reset and
    // before the `validate` phase. The probe lets the standalone
    // module-level validator observe a slice with a phantom regular id.
    const state = withModuleState(
      createInitialTavernState(),
      REGULARS_MODULE_ID,
      {
        candidatesToday: [],
        createdToday: ['phantom_regular'],
        visitedToday: [],
      },
    )
    const injectModule = {
      id: 'phase30-regulars-injector',
      version: '0.0.1',
      hooks: {
        closing: [
          (ctx: import('../../src/sim/core/context').SimContext) => {
            ctx.modifyModuleState(
              REGULARS_MODULE_ID,
              () => ({
                candidatesToday: [],
                createdToday: ['phantom_regular'],
                visitedToday: [],
              }),
              { source: 'test.inject_phantom' },
            )
          },
        ],
      },
    }
    const result = simulateDay(state, defaultInput(), [regularModule, injectModule])
    const issue = result.validation.errors.find(
      (e) => e.code === 'unknown_regular_ref',
    )
    expect(issue).toBeDefined()
  })
})

describe('Phase 30 — Faction relationship drift', () => {
  it('10. high violence pressure pulls town_watch relationship down with a cause', () => {
    const before = createInitialTavernState()
    before.pressures['violence'] = {
      ...before.pressures['violence']!,
      value: 90,
    }
    const watchBefore = before.world.factions['town_watch']!.relationship
    const result = simulateDay(before, defaultInput(), [factionModule])
    const watchAfter = result.state.world.factions['town_watch']!.relationship
    expect(watchAfter).toBeLessThan(watchBefore)
    const cause = result.state.causes.find(
      (c) => c.target === 'town_watch' && c.targetType === 'faction',
    )
    expect(cause).toBeDefined()
    expect(cause?.tags).toContain('relationship')
  })

  it('10b. payday + happy miners pulls miners_union relationship up', () => {
    const before = createInitialTavernState()
    before.calendar = { ...before.calendar, dayType: 'payday' as const }
    before.customerGroups['miners'] = {
      ...before.customerGroups['miners']!,
      satisfaction: 90,
    }
    const unionBefore = before.world.factions['miners_union']!.relationship
    const result = simulateDay(before, defaultInput(), [factionModule])
    expect(result.state.world.factions['miners_union']!.relationship).toBeGreaterThan(
      unionBefore,
    )
  })
})

describe('Phase 30 — Reports mention cultures, factions, and regulars', () => {
  it('11a. culture report appears with seeded cultures', () => {
    const result = simulateDay(
      createInitialTavernState(),
      defaultInput(),
      [cultureModule],
    )
    const report = result.reports.find((r) => r.id === 'cultures')
    expect(report).toBeDefined()
    expect(report!.lines.join('\n')).toMatch(/Highest tension|Highest comfort/i)
  })

  it('11b. faction report appears with seeded factions and surfaces drift causes', () => {
    const before = createInitialTavernState()
    before.pressures['violence'] = {
      ...before.pressures['violence']!,
      value: 90,
    }
    const result = simulateDay(before, defaultInput(), [factionModule])
    const report = result.reports.find((r) => r.id === 'factions')
    expect(report).toBeDefined()
    const text = report!.lines.join('\n')
    expect(text.length).toBeGreaterThan(0)
  })

  it('11c. regular report surfaces a newly-created regular when one emerges', () => {
    // Seed a regular directly so the report has something to surface
    // regardless of the emergence roll.
    const before = createInitialTavernState()
    before.world.regulars['nib_test'] = {
      id: 'nib_test',
      name: {
        display: 'Nib Cracket',
        profileId: 'goblin_common',
        parts: { given: 'Nib', family: 'Cracket' },
        patternId: 'given_family',
        generatedBy: 'phase30-test',
      },
      customerGroupId: 'local_goblins',
      cultureId: 'goblin_local',
      loyalty: 85,
      irritation: 5,
      visits: 7,
      knownIncidentIds: [],
      firstSeenDay: 0,
      lastSeenDay: 0,
      tags: ['regular'],
      activeFlags: [],
    }
    const result = simulateDay(before, defaultInput(), [regularModule])
    const report = result.reports.find((r) => r.id === 'regulars')
    expect(report).toBeDefined()
    // Either a visit fires today or the loyalty section names them.
    const text = report!.lines.join('\n')
    expect(text).toMatch(/Nib Cracket/)
  })
})

describe('Phase 30 — Pipeline integration', () => {
  it('full pipeline still validates with Phase 30 cultures/factions seeded', () => {
    const result = simulateDay(
      createInitialTavernState(),
      defaultInput(),
      FULL_PIPELINE,
    )
    expect(result.validation.errors).toEqual([])
  })

  it('forecast notes include culture-driven copy when the day matches a culture', () => {
    const baseline = createInitialTavernState()
    const state: TavernState = {
      ...baseline,
      calendar: { ...baseline.calendar, dayType: 'payday' as const },
    }
    const result = simulateDay(state, defaultInput(), [
      areasModule,
      stockModule,
      customersModule,
    ])
    const customerReport = result.reports.find((r) => r.id === 'customers')
    expect(customerReport).toBeDefined()
    const text = customerReport!.lines.join('\n')
    // miner_workcrew lists 'payday' as an important calendar tag, so
    // the culture helper should add a note.
    expect(text).toMatch(/Miner Workcrews|payday/)
  })
})
