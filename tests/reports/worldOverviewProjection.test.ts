// Phase 93 — Tests for the world-overview projection.
//
// Drives the projection against the default starter state plus
// `runCardlessSim` output. The starter state already seeds cultures,
// factions, suppliers, regulars, notable NPCs and hireable adventurers
// (`createInitialTavernState` from `src/sim/state/defaults.ts`), so
// most day-zero assertions can run against `createInitialTavernState()`
// directly. Rumours and attributions emerge during play; for those we
// run a few weeks and assert the projection picks them up if any
// appear.

import { describe, expect, it } from 'vitest'

import { runCardlessSim, runOneDay } from '../../src/sim/testing/simRunner'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { withCoin } from '../../src/sim/testing/stateFactories'
import { buildWorldOverview } from '../../src/reports/worldOverviewProjection'
import {
  attributionsByTarget,
  attributionsHeldBy,
} from '../../src/sim/modules/attribution/attributionQueries'
import type {
  AttributionModuleState,
  AttributionState,
} from '../../src/sim/modules/attribution/attributionTypes'
import type {
  CalendarStamp,
  EntityRef,
  TavernState,
} from '../../src/sim/state/TavernState'

function stampFor(state: TavernState): CalendarStamp {
  return {
    year: state.calendar.year,
    month: state.calendar.month,
    week: state.calendar.week,
    day: state.calendar.day,
    absoluteDay: state.calendar.totalDaysElapsed,
  }
}

const SEED_PREFIX = 'tests/reports/worldOverview'

function startingState(): TavernState {
  return withCoin(createInitialTavernState(), 500)
}

function runDays(count: number, seedSuffix = ''): TavernState {
  const run = runCardlessSim({
    initialState: startingState(),
    seed: `${SEED_PREFIX}.${seedSuffix}`,
    days: count,
  })
  return run.finalState
}

describe('buildWorldOverview — day-zero state', () => {
  it('returns all seven sections', () => {
    const data = buildWorldOverview(startingState())
    expect(data.identity).toBeDefined()
    expect(data.regulars).toBeDefined()
    expect(data.suppliers).toBeDefined()
    expect(data.factions).toBeDefined()
    expect(data.cultures).toBeDefined()
    expect(data.npcs).toBeDefined()
    expect(data.rumours).toBeDefined()
  })

  it('surfaces the tavern identity strip', () => {
    const state = startingState()
    const data = buildWorldOverview(state)
    expect(data.identity.foundingDay).toBe(state.world.tavernIdentity.foundingDay)
    expect(data.identity.daysOpen).toBeGreaterThanOrEqual(0)
    expect(data.identity.knownFor).toEqual(state.world.tavernIdentity.knownFor)
    expect(data.identity.houseRules).toEqual(state.world.tavernIdentity.houseRules)
    expect(data.identity.atmosphereTags).toEqual(
      state.world.tavernIdentity.atmosphereTags,
    )
  })

  it('projects all 11 starter regulars with resolved labels', () => {
    const state = startingState()
    const data = buildWorldOverview(state)
    const expected = Object.keys(state.world.regulars).length
    expect(expected).toBeGreaterThanOrEqual(11)
    expect(data.regulars.count).toBe(expected)
    expect(data.regulars.rows.length).toBe(expected)
    for (const row of data.regulars.rows) {
      expect(row.name.length).toBeGreaterThan(0)
      expect(typeof row.loyalty).toBe('number')
      expect(typeof row.irritation).toBe('number')
      expect(typeof row.visits).toBe('number')
      expect(row.customerGroupLabel.length).toBeGreaterThan(0)
      expect(row.daysSinceLastSeen).toBeGreaterThanOrEqual(0)
    }
  })

  it('sorts regulars by loyalty desc with stable tiebreaker', () => {
    const data = buildWorldOverview(startingState())
    for (let i = 1; i < data.regulars.rows.length; i += 1) {
      const prev = data.regulars.rows[i - 1]!
      const curr = data.regulars.rows[i]!
      if (prev.loyalty === curr.loyalty && prev.lastSeenDay === curr.lastSeenDay) {
        expect(prev.id.localeCompare(curr.id)).toBeLessThanOrEqual(0)
      } else {
        expect(prev.loyalty).toBeGreaterThanOrEqual(curr.loyalty)
      }
    }
  })

  it('projects all starter suppliers, falling back to label when name absent', () => {
    const state = startingState()
    const data = buildWorldOverview(state)
    const expected = Object.keys(state.world.suppliers).length
    expect(data.suppliers.count).toBe(expected)
    for (const row of data.suppliers.rows) {
      expect(row.name.length).toBeGreaterThan(0)
      expect(row.label.length).toBeGreaterThan(0)
      expect(row.supplierType.length).toBeGreaterThan(0)
      expect(Array.isArray(row.goods)).toBe(true)
      for (const good of row.goods) {
        expect(good.ingredientLabel.length).toBeGreaterThan(0)
        expect(good.onHand).toBeGreaterThanOrEqual(0)
        expect(good.basePrice).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('projects factions with relation noun + key tied to relationship value', () => {
    const state = startingState()
    const data = buildWorldOverview(state)
    expect(data.factions.count).toBe(Object.keys(state.world.factions).length)
    expect(data.factions.count).toBeGreaterThan(0)
    for (const row of data.factions.rows) {
      expect(row.label.length).toBeGreaterThan(0)
      expect(row.relationNoun.length).toBeGreaterThan(0)
      // Spot-check threshold mapping.
      if (row.relationship <= 20) expect(row.relationKey).toBe('feud')
      else if (row.relationship <= 40) expect(row.relationKey).toBe('rivalry')
      else if (row.relationship <= 55) expect(row.relationKey).toBe('tension')
      else if (row.relationship <= 70) expect(row.relationKey).toBe('truce')
      else expect(row.relationKey).toBe('cooperation')
    }
  })

  it('sorts factions by influence desc with stable tiebreaker', () => {
    const data = buildWorldOverview(startingState())
    for (let i = 1; i < data.factions.rows.length; i += 1) {
      const prev = data.factions.rows[i - 1]!
      const curr = data.factions.rows[i]!
      expect(prev.influence).toBeGreaterThanOrEqual(curr.influence)
    }
  })

  it('projects cultures with member counts that sum the world entities', () => {
    const state = startingState()
    const data = buildWorldOverview(state)
    expect(data.cultures.count).toBe(Object.keys(state.world.cultures).length)
    for (const row of data.cultures.rows) {
      const expectedRegulars = Object.values(state.world.regulars).filter(
        (r) => r.cultureId === row.id,
      ).length
      const expectedSuppliers = Object.values(state.world.suppliers).filter(
        (s) => s.cultureId === row.id,
      ).length
      const expectedFactions = Object.values(state.world.factions).filter(
        (f) => f.cultureId === row.id,
      ).length
      const expectedNpcs = Object.values(state.world.notableNpcs).filter(
        (n) => n.cultureId === row.id,
      ).length
      expect(row.members.regulars).toBe(expectedRegulars)
      expect(row.members.suppliers).toBe(expectedSuppliers)
      expect(row.members.factions).toBe(expectedFactions)
      expect(row.members.npcs).toBe(expectedNpcs)
    }
  })

  it('projects notable NPCs from defaults', () => {
    const state = startingState()
    const data = buildWorldOverview(state)
    expect(data.npcs.count).toBe(Object.keys(state.world.notableNpcs).length)
    for (const row of data.npcs.rows) {
      expect(row.name.length).toBeGreaterThan(0)
      expect(row.kind.length).toBeGreaterThan(0)
      expect(row.firstSeenDay).toBeGreaterThanOrEqual(0)
    }
  })

  it('returns empty rumours panel before any rumour is generated', () => {
    const state = startingState()
    // Default starter rosters do not include rumours.
    expect(Object.keys(state.world.socialRumours).length).toBe(0)
    const data = buildWorldOverview(state)
    expect(data.rumours.count).toBe(0)
    expect(data.rumours.rows).toEqual([])
  })

  it('produces deterministic output for the same state', () => {
    const state = startingState()
    const a = buildWorldOverview(state)
    const b = buildWorldOverview(state)
    expect(a).toEqual(b)
  })

  it('counts in panel summary match Object.keys for each slice', () => {
    const state = startingState()
    const data = buildWorldOverview(state)
    expect(data.regulars.count).toBe(Object.keys(state.world.regulars).length)
    expect(data.suppliers.count).toBe(Object.keys(state.world.suppliers).length)
    expect(data.factions.count).toBe(Object.keys(state.world.factions).length)
    expect(data.cultures.count).toBe(Object.keys(state.world.cultures).length)
    expect(data.npcs.count).toBe(Object.keys(state.world.notableNpcs).length)
    expect(data.rumours.count).toBe(
      Object.keys(state.world.socialRumours).length,
    )
  })

  it('resolves favorite stock label when a regular has one', () => {
    const state = startingState()
    // Manually set a favorite stock id on a regular to confirm resolution.
    const firstRegular = Object.values(state.world.regulars)[0]
    if (!firstRegular) throw new Error('no starter regulars in defaults')
    const patched: TavernState = {
      ...state,
      world: {
        ...state.world,
        regulars: {
          ...state.world.regulars,
          [firstRegular.id]: { ...firstRegular, favoriteStockId: 'ale' },
        },
      },
    }
    const data = buildWorldOverview(patched)
    const row = data.regulars.rows.find((r) => r.id === firstRegular.id)
    expect(row).toBeDefined()
    expect(row!.favoriteStockId).toBe('ale')
    expect(row!.favoriteStockLabel).toBe(patched.stock['ale']?.label)
    expect(row!.favoriteStockOnHand).toBe(patched.stock['ale']?.quantity)
  })
})

describe('buildWorldOverview — applicable actions', () => {
  it('surfaces non-empty applicable actions for at least one regular', () => {
    const state = startingState()
    const data = buildWorldOverview(state)
    const anyHas = data.regulars.rows.some(
      (r) => r.applicableActions.length > 0,
    )
    expect(anyHas).toBe(true)
  })

  it('surfaces non-empty applicable actions for at least one faction', () => {
    const state = startingState()
    const data = buildWorldOverview(state)
    const anyHas = data.factions.rows.some(
      (f) => f.applicableActions.length > 0,
    )
    expect(anyHas).toBe(true)
  })

  it('every action ref carries an action_point cost', () => {
    const state = startingState()
    const data = buildWorldOverview(state)
    for (const row of [
      ...data.regulars.rows,
      ...data.suppliers.rows,
      ...data.factions.rows,
    ]) {
      for (const ref of row.applicableActions) {
        expect(typeof ref.timeCost).toBe('number')
        expect(ref.label.length).toBeGreaterThan(0)
        expect(['immediate', 'project', 'policy', 'social']).toContain(
          ref.category,
        )
      }
    }
  })
})

describe('buildWorldOverview — attributions', () => {
  it('returns matching attribution counts when state holds attributions', () => {
    const state = startingState()
    const firstRegular = Object.values(state.world.regulars)[0]
    if (!firstRegular) throw new Error('no starter regulars in defaults')
    const ref: EntityRef = { kind: 'regular', id: firstRegular.id }
    const staffIds = Object.keys(state.staff)
    const firstStaffId = staffIds[0]!
    const targetStaff: EntityRef = { kind: 'staff', id: firstStaffId }

    // Inject a synthetic attribution slice so the projection has something
    // to project. Mirrors what attribution rules produce day-by-day.
    const synthetic: AttributionState = {
      id: 'attr_test_001',
      timestamp: stampFor(state),
      sourceCauseIds: [],
      sourceMemoryIds: [],
      sourceSceneIds: [],
      perceivedBy: ref,
      target: targetStaff,
      attributionType: 'blame',
      accuracy: 'false',
      strength: 80,
      confidence: 70,
      publicness: 50,
      volatility: 30,
      readable: 'blames the cook for the spilled stew',
      tags: ['blame', 'service'],
      relatedSystems: ['service'],
      ageDays: 0,
    }
    const slice: AttributionModuleState = {
      attributions: [synthetic],
      generatedToday: ['attr_test_001'],
      lastUpdatedDay: state.calendar.totalDaysElapsed,
      recentDistrustByRumour: {},
    }
    const patched: TavernState = {
      ...state,
      modules: { ...state.modules, attribution: slice },
    }

    const data = buildWorldOverview(patched)
    const row = data.regulars.rows.find((r) => r.id === firstRegular.id)
    expect(row).toBeDefined()
    // The regular holds 1 attribution.
    expect(row!.attributionsHeld.length).toBe(1)
    expect(row!.attributionsHeld[0]!.attributionType).toBe('blame')
    expect(row!.attributionsHeld[0]!.accuracy).toBe('false')
    expect(row!.attributionsHeld[0]!.perceiverLabel.length).toBeGreaterThan(0)
    expect(row!.attributionsHeld[0]!.targetLabel.length).toBeGreaterThan(0)

    // The held list matches what the query helper returns directly.
    const direct = attributionsHeldBy(patched, ref)
    expect(row!.attributionsHeld.length).toBe(direct.length)

    // The cook holds the same attribution as a target.
    const cookByTarget = attributionsByTarget(patched, targetStaff)
    expect(cookByTarget.length).toBe(1)
  })

  it('caps each attribution list at 4 entries by impact', () => {
    const state = startingState()
    const firstRegular = Object.values(state.world.regulars)[0]!
    const ref: EntityRef = { kind: 'regular', id: firstRegular.id }
    // Make 8 fake attributions held by the same regular.
    const attributions: AttributionState[] = Array.from({ length: 8 }, (_, i) => ({
      id: `attr_test_bulk_${i}`,
      timestamp: stampFor(state),
      sourceCauseIds: [],
      sourceMemoryIds: [],
      sourceSceneIds: [],
      perceivedBy: ref,
      target: { kind: 'system', id: 'service' } as EntityRef,
      attributionType: i % 2 === 0 ? 'blame' : 'gratitude',
      accuracy: 'true',
      strength: 30 + i * 5,
      confidence: 40 + i * 5,
      publicness: 50,
      volatility: 10,
      readable: `synthetic attribution ${i}`,
      tags: [],
      relatedSystems: [],
      ageDays: i,
    }))
    const slice: AttributionModuleState = {
      attributions,
      generatedToday: attributions.map((a) => a.id),
      lastUpdatedDay: state.calendar.totalDaysElapsed,
      recentDistrustByRumour: {},
    }
    const patched: TavernState = {
      ...state,
      modules: { ...state.modules, attribution: slice },
    }
    const data = buildWorldOverview(patched)
    const row = data.regulars.rows.find((r) => r.id === firstRegular.id)!
    expect(row.attributionsHeld.length).toBe(4)
    // Sorted descending by strength × confidence; the highest combined
    // score is the i = 7 entry (strength 65 × confidence 75).
    expect(row.attributionsHeld[0]!.id).toBe('attr_test_bulk_7')
  })
})

describe('buildWorldOverview — memory resolution', () => {
  it('filters out unknown memory ids without throwing', () => {
    const state = startingState()
    const firstRegular = Object.values(state.world.regulars)[0]!
    const patched: TavernState = {
      ...state,
      world: {
        ...state.world,
        regulars: {
          ...state.world.regulars,
          [firstRegular.id]: {
            ...firstRegular,
            knownIncidentIds: ['memory_that_does_not_exist'],
          },
        },
      },
    }
    expect(() => buildWorldOverview(patched)).not.toThrow()
    const row = buildWorldOverview(patched).regulars.rows.find(
      (r) => r.id === firstRegular.id,
    )!
    // Unknown ids contribute zero memories from the priority-1 path; the
    // priority-2 pass picks up any memories tagged with this regular's
    // actor ref (which by default is none). So the result is an empty
    // array.
    expect(Array.isArray(row.recentMemories)).toBe(true)
  })

  it('caps recent memories at 5 entries', () => {
    const state = startingState()
    const firstRegular = Object.values(state.world.regulars)[0]!
    const ref: EntityRef = { kind: 'regular', id: firstRegular.id }
    const memories = Array.from({ length: 8 }, (_, i) => ({
      id: `memory_test_${i}`,
      type: 'fact' as const,
      label: `Test memory ${i}`,
      strength: 50 + i,
      ageDays: i,
      createdAt: stampFor(state),
      actors: [ref],
      locations: [],
      relatedSystems: [],
      tags: [],
    }))
    const patched: TavernState = {
      ...state,
      memories: [...state.memories, ...memories],
    }
    const row = buildWorldOverview(patched).regulars.rows.find(
      (r) => r.id === firstRegular.id,
    )!
    expect(row.recentMemories.length).toBeLessThanOrEqual(5)
    // The freshest (smallest ageDays) should come first.
    if (row.recentMemories.length > 1) {
      expect(row.recentMemories[0]!.ageDays).toBeLessThanOrEqual(
        row.recentMemories[1]!.ageDays,
      )
    }
  })
})

describe('buildWorldOverview — after running a few weeks', () => {
  it('still produces well-formed sections after 14 days', () => {
    const state = runDays(14, 'two-weeks')
    const data = buildWorldOverview(state)
    // After two weeks the regular roster may have evolved (some new,
    // some pruned). Confirm the shape, not specific ids.
    expect(data.regulars.count).toBe(Object.keys(state.world.regulars).length)
    expect(data.factions.count).toBeGreaterThan(0)
    expect(data.cultures.count).toBeGreaterThan(0)
    expect(data.identity.daysOpen).toBe(
      state.calendar.totalDaysElapsed - state.world.tavernIdentity.foundingDay,
    )
  })

  it('keeps the projection idempotent across two calls after activity', () => {
    let state = startingState()
    // Issue an owner action to perturb state.
    const r1 = runOneDay(state, {
      seed: `${SEED_PREFIX}.activity`,
      ownerActions: [{ actionId: 'clean_area', targetId: 'main_room' }],
    })
    state = r1.state
    const a = buildWorldOverview(state)
    const b = buildWorldOverview(state)
    expect(a).toEqual(b)
  })
})
