import { describe, it, expect } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { areasModule } from '../../src/sim/modules/areas/index'
import { causesModule } from '../../src/sim/modules/causes/index'
import { customersModule } from '../../src/sim/modules/customers/index'
import { memoriesModule } from '../../src/sim/modules/memories/index'
import { historyModule } from '../../src/sim/modules/history/index'
import { regularModule } from '../../src/sim/modules/regulars/index'
import {
  buildServiceScenes,
  getServiceModuleState,
  serviceModule,
  SERVICE_SCENE_LIMITS,
} from '../../src/sim/modules/service/index'
import type {
  CustomerSatisfactionChange,
  DailyServiceResult,
  ServiceScene,
} from '../../src/sim/modules/service/index'
import {
  staffModule,
} from '../../src/sim/modules/staff/index'
import { stockModule } from '../../src/sim/modules/stock/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  withCustomerGroup,
  withStaff,
  withStock,
} from '../../src/sim/testing/stateFactories'
import type { DayType } from '../../src/sim/modules/calendar/types'
import type {
  RegularWorldState,
  TavernState,
} from '../../src/sim/state/TavernState'

// Phase 32 — Expanded daily service scenes.
//
// The plan §32.7 lists ten required tests. The suite below covers each:
// scenes appear (even when quiet), determinism under fixed seed, scene
// generation from incidents/shortages/regulars/staff stress, entity-ref
// validity, the per-day cap, scene visibility in the report, and the
// rule that the layer never invents card text or card ids.

const SEED = 'phase-32-service-scenes-test'

const DAY_OF_WEEK_BY_TYPE: Record<DayType, number> = {
  supplier_day: 1,
  quiet_day: 2,
  market_day: 3,
  local_night: 4,
  payday: 5,
  brawl_night: 6,
  maintenance_day: 7,
}

function withDayType(state: TavernState, dayType: DayType): TavernState {
  return {
    ...state,
    calendar: {
      ...state.calendar,
      dayType,
      dayOfWeek: DAY_OF_WEEK_BY_TYPE[dayType],
    },
  }
}

const MODULES = [
  areasModule,
  stockModule,
  staffModule,
  customersModule,
  regularModule,
  serviceModule,
  memoriesModule,
  historyModule,
  causesModule,
]

function runDay(state: TavernState, staffPriorities?: Record<string, string>) {
  const input = staffPriorities ? { seed: SEED, staffPriorities } : { seed: SEED }
  return simulateDay(state, input, MODULES)
}

function plentyOfStock(state: TavernState): TavernState {
  return {
    ...state,
    stock: {
      ...state.stock,
      ale: { ...state.stock.ale!, quantity: 800, quality: 50 },
      stew: { ...state.stock.stew!, quantity: 400, quality: 50 },
      mushrooms: { ...state.stock.mushrooms!, quantity: 200 },
    },
  }
}

function plantRegular(
  state: TavernState,
  groupId: string,
  overrides: Partial<RegularWorldState> = {},
): TavernState {
  const group = state.customerGroups[groupId]
  if (!group) throw new Error(`plantRegular: unknown group '${groupId}'`)
  const id = `${groupId}_planted_regular`
  const regular: RegularWorldState = {
    id,
    name: {
      display: 'Planted Regular',
      profileId: group.namingProfileId,
      parts: { given: 'Planted', family: 'Regular' },
      patternId: 'given_family',
      generatedBy: 'test',
    },
    customerGroupId: groupId,
    ...(group.cultureId ? { cultureId: group.cultureId } : {}),
    loyalty: 85,
    irritation: 80,
    visits: 12,
    firstSeenDay: 1,
    lastSeenDay: 1,
    knownIncidentIds: [],
    tags: ['regular', `culture:${group.cultureId ?? 'unknown'}`],
    activeFlags: [],
    ...overrides,
  }
  return {
    ...state,
    world: {
      ...state.world,
      regulars: { ...state.world.regulars, [id]: regular },
    },
  }
}

describe('Phase 32 — Scene shape and quiet-day behaviour (§32.1 / §32.7.1)', () => {
  it('1. DailyServiceResult.scenes is present on quiet days', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(withDayType(base, 'quiet_day'))
    const slice = getServiceModuleState(result.state).result
    expect(Array.isArray(slice.scenes)).toBe(true)
  })

  it('scenes entries carry the structural fields the plan requires', () => {
    const base = plentyOfStock(createInitialTavernState())
    const rowdy = withCustomerGroup(base, 'ogres', {
      patronage: 95,
      damageRisk: 95,
    })
    const result = runDay(withDayType(rowdy, 'brawl_night'), {
      cleaner_bouncer: 'clean',
    })
    const scenes = getServiceModuleState(result.state).result.scenes
    for (const scene of scenes) {
      expect(typeof scene.id).toBe('string')
      expect(scene.id.length).toBeGreaterThan(0)
      expect(typeof scene.sceneType).toBe('string')
      expect(['minor', 'moderate', 'major']).toContain(scene.severity)
      expect(scene.numericSeverity).toBeGreaterThanOrEqual(0)
      expect(scene.numericSeverity).toBeLessThanOrEqual(100)
      expect(Array.isArray(scene.involvedEntityRefs)).toBe(true)
      expect(Array.isArray(scene.involvedGroupIds)).toBe(true)
      expect(Array.isArray(scene.staffIds)).toBe(true)
      expect(Array.isArray(scene.regularIds)).toBe(true)
      expect(Array.isArray(scene.supplierIds)).toBe(true)
      expect(Array.isArray(scene.tags)).toBe(true)
      expect(Array.isArray(scene.causes)).toBe(true)
      expect(typeof scene.textIngredients).toBe('object')
      expect(Array.isArray(scene.possibleIssueSeedIds)).toBe(true)
    }
  })
})

describe('Phase 32 — Determinism (§32.3 / §32.7.2)', () => {
  it('2. Same seed + same state produces identical scenes', () => {
    const base = plentyOfStock(createInitialTavernState())
    const rowdy = withCustomerGroup(base, 'ogres', {
      patronage: 95,
      damageRisk: 95,
    })
    const day = withDayType(rowdy, 'brawl_night')
    const a = runDay(day, { cleaner_bouncer: 'clean' })
    const b = runDay(day, { cleaner_bouncer: 'clean' })
    const scenesA = getServiceModuleState(a.state).result.scenes
    const scenesB = getServiceModuleState(b.state).result.scenes
    expect(scenesA).toEqual(scenesB)
  })
})

describe('Phase 32 — Condition-driven scenes (§32.3 / §32.7.3-6)', () => {
  it('3. Poor stock quality can create a stock_quality_complaint scene', () => {
    const base = createInitialTavernState()
    const lowQuality: TavernState = {
      ...base,
      stock: {
        ...base.stock,
        ale: { ...base.stock.ale!, quantity: 500, quality: 18 },
        stew: { ...base.stock.stew!, quantity: 300, quality: 18 },
        mushrooms: { ...base.stock.mushrooms!, quantity: 200, quality: 18 },
        ingredients: { ...base.stock.ingredients!, quality: 18 },
        firewood: { ...base.stock.firewood!, quality: 18 },
        mugs: { ...base.stock.mugs!, quality: 18 },
      },
    }
    const result = runDay(withDayType(lowQuality, 'payday'), {
      cook: 'stretch_ingredients',
      server: 'watch_tabs',
    })
    const scenes = getServiceModuleState(result.state).result.scenes
    expect(scenes.some((s) => s.sceneType === 'stock_quality_complaint')).toBe(true)
  })

  it('4. A brawl incident can create a brawl_aftermath scene', () => {
    const base = plentyOfStock(createInitialTavernState())
    const rowdy = withCustomerGroup(base, 'ogres', {
      patronage: 95,
      damageRisk: 95,
    })
    const result = runDay(withDayType(rowdy, 'brawl_night'), {
      cleaner_bouncer: 'clean',
    })
    const slice = getServiceModuleState(result.state).result
    const hasBrawl = slice.incidents.some((i) => i.id === 'minor_brawl')
    expect(hasBrawl).toBe(true)
    expect(slice.scenes.some((s) => s.sceneType === 'brawl_aftermath')).toBe(true)
  })

  it('5. A regular with high irritation can appear in a regular_complaint scene', () => {
    let state = plentyOfStock(createInitialTavernState())
    state = plantRegular(state, 'miners', { irritation: 88, loyalty: 80 })
    // Drain ale so miners experience shortages → satisfaction loss.
    state = withStock(state, 'ale', { quantity: 1, quality: 30 })
    const result = runDay(withDayType(state, 'payday'), {
      cook: 'stretch_ingredients',
      server: 'watch_tabs',
    })
    const slice = getServiceModuleState(result.state).result
    const regularScene = slice.scenes.find((s) => s.sceneType === 'regular_complaint')
    expect(regularScene).toBeDefined()
    expect(regularScene!.regularIds).toContain('miners_planted_regular')
  })

  it('6. A stressed staff member can appear in a staff_moment scene', () => {
    const base = plentyOfStock(createInitialTavernState())
    const stressed = withStaff(base, 'cook', { stress: 90, fatigue: 85 })
    const result = runDay(withDayType(stressed, 'payday'))
    const scenes = getServiceModuleState(result.state).result.scenes
    const staffScene = scenes.find((s) => s.sceneType === 'staff_moment')
    expect(staffScene).toBeDefined()
    expect(staffScene!.staffIds).toContain('cook')
  })
})

describe('Phase 32 — Entity refs and cap (§32.7.7-8)', () => {
  it('7. Scenes only reference entity ids that exist on state', () => {
    let state = plentyOfStock(createInitialTavernState())
    state = plantRegular(state, 'miners', { irritation: 90, loyalty: 90 })
    state = withStock(state, 'ale', { quantity: 1, quality: 25 })
    state = withStaff(state, 'cook', { stress: 95, fatigue: 90 })
    const result = runDay(withDayType(state, 'payday'))
    const scenes = getServiceModuleState(result.state).result.scenes
    expect(scenes.length).toBeGreaterThan(0)
    for (const scene of scenes) {
      for (const ref of scene.involvedEntityRefs) {
        switch (ref.kind) {
          case 'staff':
            expect(result.state.staff[ref.id]).toBeDefined()
            break
          case 'customer_group':
            expect(result.state.customerGroups[ref.id]).toBeDefined()
            break
          case 'area':
            expect(result.state.areas[ref.id]).toBeDefined()
            break
          case 'stock':
            expect(result.state.stock[ref.id]).toBeDefined()
            break
          case 'regular':
            expect(result.state.world.regulars[ref.id]).toBeDefined()
            break
          case 'supplier':
            expect(result.state.world.suppliers[ref.id]).toBeDefined()
            break
          default:
            // Other ref kinds (faction, culture, etc.) are not yet
            // emitted by Phase 32 scenes; if they appear, fail the test
            // so a future contributor wires the lookup in.
            throw new Error(`unexpected ref kind ${ref.kind}`)
        }
      }
      for (const groupId of scene.involvedGroupIds) {
        expect(result.state.customerGroups[groupId]).toBeDefined()
      }
      for (const staffId of scene.staffIds) {
        expect(result.state.staff[staffId]).toBeDefined()
      }
      for (const regularId of scene.regularIds) {
        expect(result.state.world.regulars[regularId]).toBeDefined()
      }
    }
  })

  it('8. Scene count is capped at MAX_SERVICE_SCENES_PER_DAY', () => {
    // Stack every Phase 32 trigger at once and confirm the cap holds.
    let state = plentyOfStock(createInitialTavernState())
    state = withCustomerGroup(state, 'ogres', {
      patronage: 95,
      damageRisk: 95,
    })
    state = withCustomerGroup(state, 'merchants', {
      patronage: 80,
      filthTolerance: 5,
    })
    state = plantRegular(state, 'miners', { irritation: 95, loyalty: 90 })
    state = withStaff(state, 'cook', { stress: 95, fatigue: 95 })
    state = withStaff(state, 'server', { stress: 90, fatigue: 90 })
    state = withStock(state, 'ale', { quantity: 1, quality: 12 })
    const result = runDay(withDayType(state, 'brawl_night'), {
      cleaner_bouncer: 'clean',
      server: 'maximize_sales',
      cook: 'stretch_ingredients',
    })
    const scenes = getServiceModuleState(result.state).result.scenes
    expect(scenes.length).toBeLessThanOrEqual(
      SERVICE_SCENE_LIMITS.MAX_SERVICE_SCENES_PER_DAY,
    )
  })
})

describe('Phase 32 — Reports and discipline (§32.6 / §32.7.9-10)', () => {
  it('9. Service report includes a scene subsection', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(withDayType(base, 'market_day'))
    const report = result.reports.find((r) => r.id === 'service')
    expect(report).toBeDefined()
    expect(report!.lines.join('\n')).toMatch(/Service Scenes:/)
  })

  it('10. Scenes do not create finished card text or card ids', () => {
    let state = plentyOfStock(createInitialTavernState())
    state = plantRegular(state, 'miners', { irritation: 90 })
    state = withStaff(state, 'cook', { stress: 95, fatigue: 95 })
    state = withStock(state, 'ale', { quantity: 1, quality: 12 })
    const result = runDay(withDayType(state, 'payday'))
    const scenes = getServiceModuleState(result.state).result.scenes
    for (const scene of scenes) {
      // Scene id namespaces by the sim, not by a card layer.
      expect(scene.id.startsWith('scene_')).toBe(true)
      // No keys hinting at finished prose / cards.
      const ingredientKeys = Object.keys(scene.textIngredients)
      for (const key of ingredientKeys) {
        expect(key.toLowerCase()).not.toContain('cardid')
        expect(key.toLowerCase()).not.toContain('cardtext')
        expect(key.toLowerCase()).not.toContain('prose')
      }
      // Tags carry sim-level taxonomy only, never `card:` namespacing.
      for (const tag of scene.tags) {
        expect(tag.startsWith('card:')).toBe(false)
      }
      // The possible issue seed ids point at *seed* identifiers, not
      // finished cards.
      for (const seedId of scene.possibleIssueSeedIds) {
        expect(seedId.startsWith('card:')).toBe(false)
      }
    }
  })
})

describe('Phase 32 — Memory and history wiring (§32.5)', () => {
  it('regular_complaint scenes emit a regular_complained_recently memory', () => {
    let state = plentyOfStock(createInitialTavernState())
    state = plantRegular(state, 'miners', { irritation: 90, loyalty: 80 })
    state = withStock(state, 'ale', { quantity: 1, quality: 20 })
    const result = runDay(withDayType(state, 'payday'), {
      cook: 'stretch_ingredients',
      server: 'watch_tabs',
    })
    const memoryIds = result.state.memories.map((m) => m.id)
    expect(
      memoryIds.some((id) => id.startsWith('regular_complained_recently')),
    ).toBe(true)
  })

  it('every scene appears in history with a structural pointer', () => {
    let state = plentyOfStock(createInitialTavernState())
    state = withCustomerGroup(state, 'ogres', {
      patronage: 95,
      damageRisk: 95,
    })
    const result = runDay(withDayType(state, 'brawl_night'), {
      cleaner_bouncer: 'clean',
    })
    const slice = getServiceModuleState(result.state).result
    expect(slice.scenes.length).toBeGreaterThan(0)
    for (const scene of slice.scenes) {
      const matching = result.state.history.find((h) =>
        (h.mechanicalRefs ?? []).includes(scene.id),
      )
      expect(matching).toBeDefined()
      expect(matching!.category).toBe('service')
      expect(matching!.tags).toContain('service')
      expect(matching!.tags).toContain('scene')
      expect(matching!.tags).toContain(scene.sceneType)
    }
  })
})

describe('Phase 32 — buildServiceScenes purity (§32.2)', () => {
  it('returns an array without mutating state', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(withDayType(base, 'market_day'))
    const slice = getServiceModuleState(result.state).result
    const beforeJson = JSON.stringify(slice)
    const synthesised: CustomerSatisfactionChange[] = []
    const ctxLike: Parameters<typeof buildServiceScenes>[0] = {
      // The function reads `ctx.state` / RNG streams; use the live
      // post-day context exposed via the engine's mutation surface by
      // running another simulateDay. Reuse the engine state for the
      // structural call here — the function should not mutate it.
      ctx: {
        // Build a fake-but-typed `SimContext` proxy. We only need
        // `state` and `getRngStream` for this guard; the other surface
        // is exercised elsewhere.
        state: result.state,
        getRngStream: () => ({
          state: { seed: SEED, calls: 0 },
          float: () => 0,
          int: () => 0,
          chance: () => false,
          pick: <T,>(items: T[]) => items[0] as T,
          weightedPick: <T,>(items: Array<{ item: T; weight: number }>) =>
            items[0]!.item,
        }),
      } as unknown as Parameters<typeof buildServiceScenes>[0]['ctx'],
      resultBeforeScenes: slice as DailyServiceResult,
      satisfactionChanges: synthesised,
    }
    const scenes: ServiceScene[] = buildServiceScenes(ctxLike)
    expect(Array.isArray(scenes)).toBe(true)
    expect(JSON.stringify(slice)).toBe(beforeJson)
  })
})
