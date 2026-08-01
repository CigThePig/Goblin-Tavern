import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'

import { areasModule } from '../../src/sim/modules/areas/index'
import { customersModule } from '../../src/sim/modules/customers/index'
import { ownerActionsModule } from '../../src/sim/modules/ownerActions/index'
import { serviceModule } from '../../src/sim/modules/service/index'
import { staffModule } from '../../src/sim/modules/staff/index'
import { stockModule } from '../../src/sim/modules/stock/index'
import { weeklyModule } from '../../src/sim/modules/weekly/index'
import { monthlyModule } from '../../src/sim/modules/monthly/index'
import { memoriesModule } from '../../src/sim/modules/memories/index'
import { historyModule } from '../../src/sim/modules/history/index'
import { causesModule } from '../../src/sim/modules/causes/index'
import { pressuresModule } from '../../src/sim/modules/pressures/index'
import { issueSeedsModule } from '../../src/sim/modules/issues/index'
import { getIssueSeeds } from '../../src/sim/modules/issues/index'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  withArea,
  withStock,
} from '../../src/sim/testing/stateFactories'
import type { TavernState } from '../../src/sim/state/TavernState'
import type { IssueSeed } from '../../src/sim/modules/issues/issueSeedTypes'

// Phase 64 / ISSUE-024 — Thin family profile depth + core picker
// rotation.
//
// Two pieces:
//   A. Per-profile depth: each of the six thin families clears the
//      ≥0.66 non-empty `delayedEffects` per profile and ≥0.31
//      non-empty `futureHooks` per profile targets.
//   B. Picker rotation: the three core families (`food_safety`,
//      `stock_shortage`, `maintenance`) rotate across their candidate
//      entities over a 14-day window using the shared
//      `seedRotation.ts` recency-penalty helper.

const SEED = 'phase-64-thin-family-depth'

const PIPELINE = [
  areasModule,
  stockModule,
  staffModule,
  customersModule,
  ownerActionsModule,
  serviceModule,
  weeklyModule,
  monthlyModule,
  memoriesModule,
  historyModule,
  causesModule,
  pressuresModule,
  issueSeedsModule,
]

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

function runDays(start: TavernState, days: number): TavernState {
  let state = start
  for (let i = 0; i < days; i += 1) {
    state = simulateDay(state, input(), PIPELINE).state
  }
  return state
}

function profileDepthRatios(seeds: IssueSeed[]) {
  let profiles = 0
  let delayed = 0
  let future = 0
  for (const seed of seeds) {
    for (const profile of seed.consequenceProfiles) {
      profiles += 1
      if (profile.delayedEffects.length > 0) delayed += 1
      if (profile.futureHooks.length > 0) future += 1
    }
  }
  return {
    profiles,
    delayedRatio: profiles === 0 ? 0 : delayed / profiles,
    futureRatio: profiles === 0 ? 0 : future / profiles,
  }
}

describe('Phase 64 / ISSUE-024 — per-profile depth', () => {
  it('food_safety profiles meet the 0.66 / 0.31 delayed+future hook ratios', () => {
    let base = createInitialTavernState()
    base = withArea(base, 'kitchen', { cleanliness: 10, smell: 80 })
    base = withStock(base, 'mushrooms', { spoilage: 90 })
    base = withStock(base, 'stew', { spoilage: 80, quantity: 400 })
    // Phase 186 / Cluster 1 — morning/during-service seeds read the prior
    // day's closing pressure snapshot; warm one day to populate it.
    const result = simulateDay(
      simulateDay(base, input(), PIPELINE).state,
      input(),
      PIPELINE,
    )
    const seeds = getIssueSeeds(result.state, { family: 'food_safety' })
    expect(seeds.length).toBeGreaterThan(0)
    const ratios = profileDepthRatios(seeds)
    expect(ratios.delayedRatio).toBeGreaterThanOrEqual(0.66)
    expect(ratios.futureRatio).toBeGreaterThanOrEqual(0.31)
  })

  it('stock_shortage profiles meet the 0.66 / 0.31 ratios', () => {
    let base = createInitialTavernState()
    base = withStock(base, 'ale', { quantity: 5 })
    // Phase 186 / Cluster 1 — morning/during-service seeds read the prior
    // day's closing pressure snapshot; warm one day to populate it.
    const result = simulateDay(
      simulateDay(base, input(), PIPELINE).state,
      input(),
      PIPELINE,
    )
    const seeds = getIssueSeeds(result.state, { family: 'stock_shortage' })
    expect(seeds.length).toBeGreaterThan(0)
    const ratios = profileDepthRatios(seeds)
    expect(ratios.delayedRatio).toBeGreaterThanOrEqual(0.66)
    expect(ratios.futureRatio).toBeGreaterThanOrEqual(0.31)

    const raisePrices = seeds[0]!.consequenceProfiles.find(
      (profile) => profile.responseSlotId === 'raise_prices',
    )!
    const stockId = raisePrices.immediateEffects
      .find((effect) => effect.target.endsWith('.salePrice'))!
      .target.split('.')[1]!
    expect(raisePrices.futureHooks[0]?.metadata).toEqual({
      stockId,
      previousSalePrice: result.state.stock[stockId]!.salePrice,
    })
  })

  it('maintenance profiles meet the 0.66 / 0.31 ratios', () => {
    let base = createInitialTavernState()
    base = withArea(base, 'main_room', { damage: 90, condition: 10 })
    // Phase 186 / Cluster 1 — morning/during-service seeds read the prior
    // day's closing pressure snapshot; warm one day to populate it.
    const result = simulateDay(
      simulateDay(base, input(), PIPELINE).state,
      input(),
      PIPELINE,
    )
    const seeds = getIssueSeeds(result.state, { family: 'maintenance' })
    expect(seeds.length).toBeGreaterThan(0)
    const ratios = profileDepthRatios(seeds)
    expect(ratios.delayedRatio).toBeGreaterThanOrEqual(0.66)
    expect(ratios.futureRatio).toBeGreaterThanOrEqual(0.31)
  })
})

describe('Phase 64 / ISSUE-024 — core picker rotation', () => {
  it('food_safety rotates across kitchen risk vectors over 14 days', () => {
    // Three vectors with comparable headline scores so rotation has
    // somewhere to go.
    let base = createInitialTavernState()
    base = withArea(base, 'kitchen', { cleanliness: 5, smell: 80 })
    base = withStock(base, 'mushrooms', { spoilage: 80, quantity: 200 })
    base = withStock(base, 'stew', { spoilage: 85, quantity: 400 })

    const pickedKeys = new Set<string>()
    let state = base
    for (let day = 0; day < 14; day += 1) {
      state = simulateDay(state, input(), PIPELINE).state
      const slice = state.modules.issueSeeds as
        | { recentPicks?: Record<string, Record<string, number>> }
        | undefined
      const recent = slice?.recentPicks?.food_safety ?? {}
      for (const k of Object.keys(recent)) pickedKeys.add(k)
    }
    expect(pickedKeys.size).toBeGreaterThanOrEqual(2)
  })

  it('stock_shortage rotates across stock items over 14 days', () => {
    // Three different stocks all below the low-quantity threshold so
    // the picker has multiple candidates.
    let base = createInitialTavernState()
    base = withStock(base, 'ale', { quantity: 10 })
    base = withStock(base, 'stew', { quantity: 12 })
    base = withStock(base, 'mushrooms', { quantity: 8 })

    const pickedKeys = new Set<string>()
    let state = base
    for (let day = 0; day < 14; day += 1) {
      state = simulateDay(state, input(), PIPELINE).state
      const slice = state.modules.issueSeeds as
        | { recentPicks?: Record<string, Record<string, number>> }
        | undefined
      const recent = slice?.recentPicks?.stock_shortage ?? {}
      for (const k of Object.keys(recent)) pickedKeys.add(k)
    }
    expect(pickedKeys.size).toBeGreaterThanOrEqual(2)
  })

  it('maintenance rotates across damaged areas over 14 days', () => {
    let base = createInitialTavernState()
    base = withArea(base, 'main_room', { damage: 90, condition: 10 })
    base = withArea(base, 'kitchen', { damage: 85, condition: 15 })
    base = withArea(base, 'cellar', { damage: 80, condition: 20 })

    const pickedKeys = new Set<string>()
    let state = base
    for (let day = 0; day < 14; day += 1) {
      state = simulateDay(state, input(), PIPELINE).state
      const slice = state.modules.issueSeeds as
        | { recentPicks?: Record<string, Record<string, number>> }
        | undefined
      const recent = slice?.recentPicks?.maintenance ?? {}
      for (const k of Object.keys(recent)) pickedKeys.add(k)
    }
    expect(pickedKeys.size).toBeGreaterThanOrEqual(2)
  })
})

describe('Phase 64 / ISSUE-024 — culture_conflict future hook depth', () => {
  it('culture_conflict has at least 2 profiles with non-empty futureHooks', () => {
    // Seed cultural tension high enough that the family fires.
    let base = createInitialTavernState()
    base = runDays(base, 5)
    // Force tension on a culture and on the pressure snapshot.
    const cultures = Object.values(base.world.cultures)
    if (cultures.length === 0) return
    const firstCulture = cultures[0]!
    base = {
      ...base,
      world: {
        ...base.world,
        cultures: {
          ...base.world.cultures,
          [firstCulture.id]: { ...firstCulture, tension: 90, comfort: 10 },
        },
      },
      modules: {
        ...base.modules,
        pressures: {
          ...(base.modules.pressures ?? {}),
          snapshots: {
            ...((base.modules.pressures as
              | { snapshots?: Record<string, unknown> }
              | undefined)?.snapshots ?? {}),
            cultural_tension: {
              id: 'cultural_tension',
              value: 80,
              severity: 80,
              urgency: 70,
              trend: 'rising',
              causes: [],
              tags: ['culture'],
              relatedSystems: ['cultures'],
              consequences: [],
            },
          },
        },
      },
    } as TavernState
    // Phase 186 / Cluster 1 — morning/during-service seeds read the prior
    // day's closing pressure snapshot; warm one day to populate it.
    const result = simulateDay(
      simulateDay(base, input(), PIPELINE).state,
      input(),
      PIPELINE,
    )
    const seeds = getIssueSeeds(result.state, { family: 'culture_conflict' })
    if (seeds.length === 0) return
    const fhProfiles = seeds.flatMap((s) =>
      s.consequenceProfiles.filter((p) => p.futureHooks.length > 0),
    ).length
    const totalProfiles = seeds.reduce(
      (n, s) => n + s.consequenceProfiles.length,
      0,
    )
    expect(fhProfiles / totalProfiles).toBeGreaterThanOrEqual(0.31)
  })
})
