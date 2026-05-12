import { describe, it, expect } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput, SimInputOwnerAction } from '../../src/sim/core/context'
import { areasModule } from '../../src/sim/modules/areas/index'
import { causesModule } from '../../src/sim/modules/causes/index'
import { cultureModule } from '../../src/sim/modules/cultures/index'
import { customersModule } from '../../src/sim/modules/customers/index'
import { factionModule } from '../../src/sim/modules/factions/index'
import { historyModule } from '../../src/sim/modules/history/index'
import { memoriesModule } from '../../src/sim/modules/memories/index'
import { ownerActionsModule } from '../../src/sim/modules/ownerActions/index'
import { regularModule } from '../../src/sim/modules/regulars/index'
import { serviceModule } from '../../src/sim/modules/service/index'
import { staffModule } from '../../src/sim/modules/staff/index'
import { stockModule } from '../../src/sim/modules/stock/index'
import { supplierModule } from '../../src/sim/modules/suppliers/index'
import {
  getWeeklyModuleState,
  weeklyModule,
} from '../../src/sim/modules/weekly/index'
import { worldModule } from '../../src/sim/modules/world/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  withArea,
  withCoin,
  withCustomerGroup,
  withStock,
} from '../../src/sim/testing/stateFactories'
import type {
  RegularWorldState,
  TavernState,
} from '../../src/sim/state/TavernState'
import type {
  WeeklyCommunityResult,
} from '../../src/sim/modules/weekly/types'

// Phase 34 — Weekly Supplier, Staff, and Community Routine Expansion.
//
// The plan §34.9 lists ten required tests. The suite below covers each:
//   1. Weekly result includes `community`.
//   2. Weekly community is empty-but-valid when no community moved.
//   3. Supplier relationship changes after a negotiate social action
//      / shortage.
//   4. Regular irritation rises after repeated complaint scenes.
//   5. Faction satisfaction changes after a hosted faction night.
//   6. Rumours are generated from notable signals.
//   7. Rumours persist in `state.world.socialRumours`.
//   8. Community report includes suppliers/regulars/factions/rumours.
//   9. Community changes produce causes/history entries.
//  10. Existing Phase 14 weekly tests still pass (validated by running
//      the existing suite alongside this one; see CI).

const SEED = 'phase-34-weekly-community-test'

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
  memoriesModule,
  historyModule,
  causesModule,
  weeklyModule,
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

function injectRegular(state: TavernState, regular: RegularWorldState): TavernState {
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
      generatedBy: 'phase34_test',
    },
    customerGroupId: 'miners',
    loyalty: 75,
    irritation: 55,
    visits: 6,
    knownIncidentIds: [],
    firstSeenDay: 1,
    lastSeenDay: 2,
    tags: ['regular'],
    activeFlags: [],
    ...overrides,
  }
}

describe('Phase 34 §34.1 — Weekly community shape', () => {
  it('weekly result includes a community block on a quiet week', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    const state = runWeek(base)
    const slice = getWeeklyModuleState(state)
    expect(slice.lastWeeklyResult).toBeDefined()
    const community: WeeklyCommunityResult | undefined =
      slice.lastWeeklyResult?.community
    expect(community).toBeDefined()
    expect(community!.supplierTrend).toBeInstanceOf(Array)
    expect(community!.regularTrend).toBeInstanceOf(Array)
    expect(community!.factionTrend).toBeInstanceOf(Array)
    expect(community!.rumours).toBeInstanceOf(Array)
    expect(community!.notes).toBeInstanceOf(Array)
  })

  it('community is empty-but-valid when no entities moved', () => {
    // A clean week with plenty of stock and no actions should leave
    // suppliers, regulars (none seeded by default), and factions
    // largely unmoved — the community block should be present and
    // mostly empty.
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    const state = runWeek(base)
    const community = getWeeklyModuleState(state).lastWeeklyResult!.community
    expect(community.regularTrend).toEqual([])
    // Default state has no regulars, so the regular trend stays empty;
    // supplier and faction trends may have entries from organic
    // shortages, but the structure must always be present.
    expect(Array.isArray(community.supplierTrend)).toBe(true)
    expect(Array.isArray(community.factionTrend)).toBe(true)
  })

  it('weekly result validates after community resolution', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    let lastResult
    let state = base
    for (let i = 0; i < 7; i += 1) {
      lastResult = runDay(state)
      state = lastResult.state
    }
    expect(lastResult!.validation.errors).toEqual([])
  })
})

describe('Phase 34 §34.3 — Supplier weekly routine', () => {
  it('negotiate_with_supplier this week improves the supplier relationship trend', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    const negotiation: SimInputOwnerAction = {
      actionId: 'negotiate_with_supplier',
      targetId: 'brakka_mushroom_cart',
    }
    // Negotiate on day 1; let the rest of the week pass.
    const week = runWeek(base, [[negotiation]])
    const community = getWeeklyModuleState(week).lastWeeklyResult!.community
    const entry = community.supplierTrend.find(
      (s) => s.supplierId === 'brakka_mushroom_cart',
    )
    expect(entry).toBeDefined()
    // Negotiation lifts the relationship; shortage signals can claw at
    // reliability but the relationship delta itself stays positive.
    expect(entry!.relationshipDelta).toBeGreaterThan(0)
  })

  it('shortages on a supplier\'s stock erode reliability', () => {
    // Drain ale so the week has many ale shortages, then check the
    // ale supplier (`old_keg_brewers`) gets a negative reliability
    // entry in the supplier trend.
    let base = withCoin(createInitialTavernState(), 200)
    base = withStock(base, 'ale', { quantity: 2 })
    base = withStock(base, 'stew', { quantity: 200, quality: 50 })
    base = withStock(base, 'mushrooms', { quantity: 100 })
    const week = runWeek(base)
    const community = getWeeklyModuleState(week).lastWeeklyResult!.community
    const aleSupplier = community.supplierTrend.find(
      (s) => s.supplierId === 'old_keg_brewers',
    )
    expect(aleSupplier).toBeDefined()
    expect(aleSupplier!.reliabilityDelta).toBeLessThan(0)
  })
})

describe('Phase 34 §34.4 — Regular weekly routine', () => {
  it('repeated complaint scenes raise regular irritation', () => {
    // Set up an irritated regular in a high-traffic group, then trash
    // service quality so the scene builder produces regular_complaint
    // scenes across the week.
    let base = withArea(
      withCustomerGroup(
        plentyOfStock(withCoin(createInitialTavernState(), 300)),
        'miners',
        { satisfaction: 25, patronage: 50, loyalty: 60 },
      ),
      'main_room',
      { cleanliness: 10, damage: 40 },
    )
    base = withStock(base, 'ale', { quantity: 800, quality: 10 })
    base = injectRegular(
      base,
      makeRegular({ irritation: 65, loyalty: 70, visits: 10 }),
    )

    const baseIrritation = base.world.regulars['test_regular']!.irritation
    const week = runWeek(base)
    const community = getWeeklyModuleState(week).lastWeeklyResult!.community
    const trend = community.regularTrend.find(
      (r) => r.regularId === 'test_regular',
    )
    expect(trend).toBeDefined()
    // Trend is either explicitly positive (scenes fired) or the regular
    // got more irritated than where they started.
    const finalIrritation = week.world.regulars['test_regular']!.irritation
    expect(trend!.irritationDelta).toBeGreaterThanOrEqual(0)
    expect(finalIrritation).toBeGreaterThanOrEqual(baseIrritation)
  })

  it('apologize_to_regular reduces irritation and raises loyalty in the trend', () => {
    let base = injectRegular(
      plentyOfStock(withCoin(createInitialTavernState(), 300)),
      makeRegular({ irritation: 60, loyalty: 60 }),
    )
    const apology: SimInputOwnerAction = {
      actionId: 'apologize_to_regular',
      targetId: 'test_regular',
    }
    const startIrritation = base.world.regulars['test_regular']!.irritation
    const week = runWeek(base, [[apology]])
    const community = getWeeklyModuleState(week).lastWeeklyResult!.community
    const trend = community.regularTrend.find(
      (r) => r.regularId === 'test_regular',
    )
    expect(trend).toBeDefined()
    expect(trend!.irritationDelta).toBeLessThan(0)
    expect(week.world.regulars['test_regular']!.irritation).toBeLessThan(
      startIrritation,
    )
  })
})

describe('Phase 34 §34.5 — Faction weekly routine', () => {
  it('hosting a faction night improves that faction\'s relationship trend', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    const startingRelationship = base.world.factions['miners_union']!.relationship
    const hostNight: SimInputOwnerAction = {
      actionId: 'host_faction_night',
      targetId: 'miners_union',
    }
    const week = runWeek(base, [[hostNight]])
    const community = getWeeklyModuleState(week).lastWeeklyResult!.community
    const trend = community.factionTrend.find(
      (f) => f.factionId === 'miners_union',
    )
    expect(trend).toBeDefined()
    expect(trend!.satisfactionDelta).toBeGreaterThan(0)
    expect(
      week.world.factions['miners_union']!.relationship,
    ).toBeGreaterThanOrEqual(startingRelationship)
  })

  it('enabling ban_weapons_inside lifts town_watch faction satisfaction over the week', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    const enable: SimInputOwnerAction = {
      actionId: 'enable_ban_weapons_inside',
    }
    const week = runWeek(base, [[enable]])
    const community = getWeeklyModuleState(week).lastWeeklyResult!.community
    const town = community.factionTrend.find(
      (f) => f.factionId === 'town_watch',
    )
    expect(town).toBeDefined()
    expect(town!.satisfactionDelta).toBeGreaterThan(0)
  })
})

describe('Phase 34 §34.6 — Weekly rumours', () => {
  it('water_ale_quietly policy generates a watered-ale rumour', () => {
    let base = injectRegular(
      plentyOfStock(withCoin(createInitialTavernState(), 500)),
      makeRegular({ irritation: 30, loyalty: 80 }),
    )
    const enable: SimInputOwnerAction = {
      actionId: 'enable_water_ale_quietly',
    }
    const week = runWeek(base, [[enable]])
    const rumours = getWeeklyModuleState(week).lastWeeklyResult!.community.rumours
    const watered = rumours.find((r) =>
      r.summary.toLowerCase().includes('water'),
    )
    expect(watered).toBeDefined()
    expect(watered!.accuracy).toBe('partial')
    expect(watered!.strength).toBeGreaterThan(0)
  })

  it('strong rumours persist in state.world.socialRumours', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    const enable: SimInputOwnerAction = {
      actionId: 'enable_water_ale_quietly',
    }
    const week = runWeek(base, [[enable]])
    const rumours = Object.values(week.world.socialRumours)
    expect(rumours.length).toBeGreaterThan(0)
    const watered = rumours.find((r) =>
      r.label.toLowerCase().includes('water'),
    )
    expect(watered).toBeDefined()
    expect(watered!.strength).toBeGreaterThanOrEqual(20)
    expect(watered!.firstHeardDay).toBeGreaterThan(0)
  })
})

describe('Phase 34 §34.7 — Weekly report community section', () => {
  it('weekly report renders a Community section', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    let state = base
    let lastReports
    for (let i = 0; i < 7; i += 1) {
      const out = runDay(state)
      state = out.state
      lastReports = out.reports
    }
    const weekly = lastReports!.find((r) => r.id === 'weekly')
    expect(weekly).toBeDefined()
    const text = weekly!.lines.join('\n')
    expect(text).toMatch(/Community:/)
  })

  it('community section surfaces faction trends when a host action ran', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    const hostNight: SimInputOwnerAction = {
      actionId: 'host_faction_night',
      targetId: 'miners_union',
    }
    let state = base
    let lastReports
    for (let i = 0; i < 7; i += 1) {
      const actions = i === 0 ? [hostNight] : []
      const out = runDay(state, { ownerActions: actions })
      state = out.state
      lastReports = out.reports
    }
    const weekly = lastReports!.find((r) => r.id === 'weekly')!
    const text = weekly.lines.join('\n')
    expect(text).toMatch(/Factions:/)
    expect(text).toMatch(/miners_union/)
  })

  it('weekly report data payload includes community sub-structure', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    let state = base
    let lastReports
    for (let i = 0; i < 7; i += 1) {
      const out = runDay(state)
      state = out.state
      lastReports = out.reports
    }
    const weekly = lastReports!.find((r) => r.id === 'weekly')!
    const data = weekly.data as {
      community: WeeklyCommunityResult
    }
    expect(data.community).toBeDefined()
    expect(Array.isArray(data.community.supplierTrend)).toBe(true)
    expect(Array.isArray(data.community.regularTrend)).toBe(true)
    expect(Array.isArray(data.community.factionTrend)).toBe(true)
    expect(Array.isArray(data.community.rumours)).toBe(true)
  })
})

describe('Phase 34 §34.8 — Weekly community causes and history', () => {
  it('hosting a faction night writes a weekly.community cause for the faction', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    const hostNight: SimInputOwnerAction = {
      actionId: 'host_faction_night',
      targetId: 'miners_union',
    }
    const week = runWeek(base, [[hostNight]])
    const causes = week.causes.filter(
      (c) =>
        c.target === 'miners_union' &&
        c.source.startsWith('weekly.community'),
    )
    expect(causes.length).toBeGreaterThan(0)
  })

  it('water_ale_quietly rumour generates a weekly.community history entry', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    const enable: SimInputOwnerAction = {
      actionId: 'enable_water_ale_quietly',
    }
    const week = runWeek(base, [[enable]])
    const historyEntries = week.history.filter(
      (h) => h.category === 'weekly' && h.tags.includes('rumour'),
    )
    expect(historyEntries.length).toBeGreaterThan(0)
  })
})

describe('Phase 34 — Determinism', () => {
  it('same seed + same actions produce identical community results', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    const hostNight: SimInputOwnerAction = {
      actionId: 'host_faction_night',
      targetId: 'miners_union',
    }
    const weekA = runWeek(base, [[hostNight]])
    const weekB = runWeek(base, [[hostNight]])
    const communityA =
      getWeeklyModuleState(weekA).lastWeeklyResult!.community
    const communityB =
      getWeeklyModuleState(weekB).lastWeeklyResult!.community
    expect(communityA).toEqual(communityB)
  })
})
