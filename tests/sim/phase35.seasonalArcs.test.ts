import { describe, it, expect } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { areasModule } from '../../src/sim/modules/areas/index'
import { causesModule } from '../../src/sim/modules/causes/index'
import { cultureModule } from '../../src/sim/modules/cultures/index'
import { customersModule } from '../../src/sim/modules/customers/index'
import { factionModule } from '../../src/sim/modules/factions/index'
import { historyModule } from '../../src/sim/modules/history/index'
import { memoriesModule } from '../../src/sim/modules/memories/index'
import { monthlyModule } from '../../src/sim/modules/monthly/index'
import { ownerActionsModule } from '../../src/sim/modules/ownerActions/index'
import { pressuresModule } from '../../src/sim/modules/pressures/index'
import { regularModule } from '../../src/sim/modules/regulars/index'
import { serviceModule } from '../../src/sim/modules/service/index'
import { staffModule } from '../../src/sim/modules/staff/index'
import { stockModule } from '../../src/sim/modules/stock/index'
import { supplierModule } from '../../src/sim/modules/suppliers/index'
import { weeklyModule } from '../../src/sim/modules/weekly/index'
import { worldModule } from '../../src/sim/modules/world/index'
import {
  LOCAL_ARCS_MODULE_ID,
  getLocalArcsModuleState,
  listActiveArcs,
  listAllArcs,
  localArcsModule,
} from '../../src/sim/modules/localArcs/index'
import {
  MAX_ACTIVE_LOCAL_ARCS,
  type LocalArcStage,
} from '../../src/sim/content/events/localArcTypes'
import { localArcRegistry } from '../../src/sim/content/events/localArcRegistry'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  withCoin,
  withStock,
} from '../../src/sim/testing/stateFactories'
import type {
  LocalEventWorldState,
  TavernState,
} from '../../src/sim/state/TavernState'

// Phase 35 — Seasonal Arcs, Festivals, and Local Event Cycles.
//
// The plan §35.11 lists ten required tests. The suite below maps each:
//   1. Active arcs branch is empty-but-valid on default state.
//   2. A qualifying monthly state starts a local arc.
//   3. Same seed + same state starts the same arc.
//   4. Active arcs progress stages over time.
//   5. Arc effects modify pressures or relevant state.
//   6. Arc start/progress creates history and causes.
//   7. Monthly report exposure (localArcs report section).
//   8. Existing monthly rent/landlord/inspection/rival outputs still exist.
//   9. Arc cap prevents more than the configured maximum active arcs.
//  10. Duplicate active arcs are not created.

const SEED = 'phase-35-seasonal-arcs-test'

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
  weeklyModule,
  monthlyModule,
  localArcsModule,
  memoriesModule,
  historyModule,
  causesModule,
  pressuresModule,
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

function runMonths(
  state: TavernState,
  months: number,
  overrides: Partial<SimInput> = {},
): TavernState {
  let current = state
  for (let i = 0; i < months * 28; i += 1) {
    current = runDay(current, overrides).state
  }
  return current
}

function seedArcRecord(
  state: TavernState,
  arc: LocalEventWorldState,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      localEvents: { ...state.world.localEvents, [arc.id]: arc },
    },
  }
}

function makeArcRecord(overrides: Partial<LocalEventWorldState>): LocalEventWorldState {
  return {
    id: 'arc:fixture',
    definitionId: 'mushroom_blight',
    label: 'Mushroom Blight',
    startedDay: 1,
    intensity: 20,
    relatedFactionIds: [],
    relatedCultureIds: [],
    tags: ['arc', 'mushroom_blight'],
    activeFlags: [],
    type: 'mushroom_blight',
    stage: 'seeded' as LocalArcStage,
    lastUpdatedDay: 1,
    ageDays: 0,
    relatedRefs: [],
    activeEffects: [],
    arcHistory: [],
    ...overrides,
  }
}

describe('Phase 35 §35.1 — Module shape and defaults', () => {
  it('registers localArcs module with required hooks and metadata', () => {
    expect(localArcsModule.id).toBe(LOCAL_ARCS_MODULE_ID)
    expect(localArcsModule.id).toBe('localArcs')
    expect(localArcsModule.hooks?.endMonth).toBeDefined()
    expect(localArcsModule.hooks?.localEventUpdate).toBeDefined()
    expect(localArcsModule.buildReport).toBeTypeOf('function')
    expect(localArcsModule.validate).toBeTypeOf('function')
    expect(localArcsModule.stateSchema).toBeDefined()
    expect(localArcsModule.dependsOn).toContain('monthly')
  })

  it('localArcRegistry seeds the starter definitions', () => {
    const ids = localArcRegistry.all().map((d) => d.id)
    expect(ids).toContain('mushroom_blight')
    expect(ids).toContain('miner_payday_boom')
    expect(ids).toContain('inspection_campaign')
    expect(ids).toContain('rival_tavern_expansion')
    expect(ids).toContain('festival_approaching')
  })

  it('default state has an empty arcs branch and a seeded module slice', () => {
    const state = createInitialTavernState()
    expect(state.world.localEvents).toEqual({})
    const slice = getLocalArcsModuleState(state)
    expect(slice.lastMonthlyTickDay).toBe(0)
    expect(slice.activeArcIds).toEqual([])
    expect(slice.activeArcTags).toEqual([])
    expect(slice.activeIssueSeedTags).toEqual([])
    expect(slice.activeMarketConditionIds).toEqual([])
    expect(slice.cooldowns).toEqual({})
  })
})

describe('Phase 35 §35.5 — Starting and progressing arcs', () => {
  it('runs one month with no errors and may seed an arc', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    const after = runMonths(base, 1)
    // The arc registry has weighted candidates; with default seeded
    // state we expect at least one arc seeded by the end of month 1
    // because mushroom_blight has no hard start conditions.
    const arcs = listAllArcs(after)
    expect(arcs.length).toBeGreaterThan(0)
    for (const arc of arcs) {
      expect(arc.stage).toBeDefined()
      expect(arc.lastUpdatedDay).toBeDefined()
      expect(arc.ageDays).toBeDefined()
    }
    const slice = getLocalArcsModuleState(after)
    expect(slice.lastMonthlyTickDay).toBeGreaterThan(0)
  })

  it('same seed + same state produces identical arc starts', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    const afterA = runMonths(base, 1)
    const afterB = runMonths(base, 1)
    const arcsA = listAllArcs(afterA).map((a) => ({
      id: a.id,
      definitionId: a.definitionId,
      stage: a.stage,
    }))
    const arcsB = listAllArcs(afterB).map((a) => ({
      id: a.id,
      definitionId: a.definitionId,
      stage: a.stage,
    }))
    expect(arcsA).toEqual(arcsB)
  })

  it('arc seeded by hand progresses stage across months', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    // Seed a mushroom_blight in the `seeded` stage on day 1; after
    // running two months (~56 days) it should have progressed past
    // `seeded` per the registry's progress rules.
    const fixture = makeArcRecord({
      id: 'arc:mb:fixture',
      stage: 'seeded',
      lastUpdatedDay: 0,
      ageDays: 0,
      startedDay: 0,
    })
    const seeded = seedArcRecord(base, fixture)
    const after = runMonths(seeded, 2)
    const updated = after.world.localEvents['arc:mb:fixture']
    expect(updated).toBeDefined()
    expect(updated!.stage).not.toBe('seeded')
    expect(updated!.ageDays).toBeGreaterThan(0)
  })

  it('arc reaching maxDurationDays resolves', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    const fixture = makeArcRecord({
      id: 'arc:mb:long',
      stage: 'climax',
      lastUpdatedDay: 0,
      ageDays: 80,
      startedDay: 0,
    })
    const seeded = seedArcRecord(base, fixture)
    const after = runMonths(seeded, 1)
    const updated = after.world.localEvents['arc:mb:long']
    expect(updated!.stage).toBe('resolved')
  })
})

describe('Phase 35 §35.7 — Arc effects', () => {
  it('an active arc records activeEffects on the world record', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    const fixture = makeArcRecord({
      id: 'arc:mb:active',
      stage: 'rising',
      lastUpdatedDay: 0,
      ageDays: 14,
      startedDay: 0,
    })
    const seeded = seedArcRecord(base, fixture)
    const after = runMonths(seeded, 1)
    const updated = after.world.localEvents['arc:mb:active']
    expect(updated).toBeDefined()
    expect(updated!.activeEffects).toBeDefined()
    expect(updated!.activeEffects!.length).toBeGreaterThan(0)
    // mushroom_blight has a pressure_delta on stock_shortage; the key
    // string should reflect that effect.
    expect(
      updated!.activeEffects!.some((k) => k.includes('stock_shortage')),
    ).toBe(true)
  })

  it('active arc tags propagate to the localArcs module slice', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    const fixture = makeArcRecord({
      id: 'arc:mb:rising',
      stage: 'rising',
      lastUpdatedDay: 0,
      ageDays: 14,
      startedDay: 0,
    })
    const seeded = seedArcRecord(base, fixture)
    const after = runMonths(seeded, 1)
    const slice = getLocalArcsModuleState(after)
    expect(slice.activeArcIds).toContain('arc:mb:rising')
    expect(slice.activeArcTags).toContain('mushroom_blight')
    expect(slice.activeIssueSeedTags.length).toBeGreaterThan(0)
    expect(slice.activeIssueSeedTags).toContain('supplier_suspicious_goods')
  })

  it('arc pressure_delta effect nudges state.pressures on tick day', () => {
    // Compare a day-28 run with and without the arc; the arc's
    // `pressure_delta` should leave the on-state pressure higher than
    // the baseline run. (The Phase 18 pressure calculator runs at
    // `closing`; localArcs runs at `endMonth` *after* that, so any
    // nudge it applies is observable on the final state for the same
    // day.)
    let baseline = plentyOfStock(withCoin(createInitialTavernState(), 500))
    for (let i = 0; i < 27; i += 1) {
      baseline = runDay(baseline).state
    }
    const withoutArc = runDay(baseline).state
    const fixture = makeArcRecord({
      id: 'arc:mb:nudge',
      stage: 'rising',
      lastUpdatedDay: baseline.calendar.totalDaysElapsed,
      ageDays: 14,
      startedDay: baseline.calendar.totalDaysElapsed,
    })
    const seeded = seedArcRecord(baseline, fixture)
    const withArc = runDay(seeded).state
    const without = withoutArc.pressures['stock_shortage']?.value ?? 0
    const withArcValue = withArc.pressures['stock_shortage']?.value ?? 0
    expect(withArcValue).toBeGreaterThan(without)
  })
})

describe('Phase 35 §35.9 — Arc causes, memories, and history', () => {
  it('arc start records history with the local_arc tag', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    const after = runMonths(base, 1)
    const arcs = listAllArcs(after)
    expect(arcs.length).toBeGreaterThan(0)
    const startHistory = after.history.filter(
      (h) => h.category === 'monthly' && h.tags.includes('local_arc'),
    )
    expect(startHistory.length).toBeGreaterThan(0)
  })

  it('arc start emits an addCause entry attributed to localArcs', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    const after = runMonths(base, 1)
    const causes = after.causes.filter(
      (c) =>
        c.source.startsWith('localArcs.') && c.targetType === 'local_event',
    )
    expect(causes.length).toBeGreaterThan(0)
  })

  it('arc resolution emits a resolved memory and history entry', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    const fixture = makeArcRecord({
      id: 'arc:mb:resolve',
      stage: 'climax',
      lastUpdatedDay: 0,
      ageDays: 80,
      startedDay: 0,
    })
    const seeded = seedArcRecord(base, fixture)
    const after = runMonths(seeded, 1)
    const resolvedHistory = after.history.filter(
      (h) => h.tags.includes('resolved') && h.tags.includes('mushroom_blight'),
    )
    expect(resolvedHistory.length).toBeGreaterThan(0)
    const resolvedMemory = after.memories.find(
      (m) => m.id === 'local_arc_resolved:mushroom_blight',
    )
    expect(resolvedMemory).toBeDefined()
  })
})

describe('Phase 35 §35.8 — Reports', () => {
  it('localArcs report section fires on monthly tick days', () => {
    let base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    let lastReports
    for (let i = 0; i < 28; i += 1) {
      const out = runDay(base)
      base = out.state
      lastReports = out.reports
    }
    const arcsReport = lastReports!.find((r) => r.id === 'localArcs')
    expect(arcsReport).toBeDefined()
    expect(arcsReport!.title).toBe('LOCAL ARCS')
    expect(arcsReport!.lines.join('\n')).toMatch(/Active Local Arcs/)
  })

  it('monthly report still includes rent / landlord / inspection / rival', () => {
    let base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    let lastReports
    for (let i = 0; i < 28; i += 1) {
      const out = runDay(base)
      base = out.state
      lastReports = out.reports
    }
    const monthly = lastReports!.find((r) => r.id === 'monthly')
    expect(monthly).toBeDefined()
    const text = monthly!.lines.join('\n')
    expect(text).toMatch(/Rent:/)
    expect(text).toMatch(/Landlord:/)
    expect(text).toMatch(/Inspection:/)
    expect(text).toMatch(/Rival Tavern:/)
  })
})

describe('Phase 35 §35.10 — Caps and cooldowns', () => {
  it('does not create more than MAX_ACTIVE_LOCAL_ARCS active arcs', () => {
    // Seed three active arcs and let the engine run; the cap should
    // prevent a fourth from being seeded.
    let base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    base = seedArcRecord(
      base,
      makeArcRecord({
        id: 'arc:a',
        definitionId: 'miner_payday_boom',
        stage: 'rising',
        ageDays: 7,
        startedDay: 0,
        lastUpdatedDay: 0,
      }),
    )
    base = seedArcRecord(
      base,
      makeArcRecord({
        id: 'arc:b',
        definitionId: 'inspection_campaign',
        stage: 'rising',
        ageDays: 7,
        startedDay: 0,
        lastUpdatedDay: 0,
      }),
    )
    base = seedArcRecord(
      base,
      makeArcRecord({
        id: 'arc:c',
        definitionId: 'rival_tavern_expansion',
        stage: 'rising',
        ageDays: 7,
        startedDay: 0,
        lastUpdatedDay: 0,
      }),
    )
    const after = runMonths(base, 1)
    const active = listActiveArcs(after)
    expect(active.length).toBeLessThanOrEqual(MAX_ACTIVE_LOCAL_ARCS)
  })

  it('does not start a duplicate arc for an already-active definition', () => {
    let base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    base = seedArcRecord(
      base,
      makeArcRecord({
        id: 'arc:mb:already',
        definitionId: 'mushroom_blight',
        stage: 'rising',
        ageDays: 14,
        startedDay: 0,
        lastUpdatedDay: 0,
      }),
    )
    const after = runMonths(base, 1)
    const mushroomArcs = listAllArcs(after).filter(
      (a) => a.definitionId === 'mushroom_blight',
    )
    // The starter retains its identity (still present), but no second
    // mushroom_blight arc instance was added in the same lifecycle.
    const activeMushroomArcs = mushroomArcs.filter(
      (a) => a.stage !== 'resolved' && a.stage !== 'failed',
    )
    expect(activeMushroomArcs.length).toBe(1)
  })

  it('resolved arcs respect a cooldown before re-starting', () => {
    let base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    // Seed an arc near resolution so it resolves on the first tick.
    base = seedArcRecord(
      base,
      makeArcRecord({
        id: 'arc:mb:cooling',
        stage: 'climax',
        ageDays: 80,
        startedDay: 0,
        lastUpdatedDay: 0,
      }),
    )
    const afterOne = runMonths(base, 1)
    const resolvedArc = afterOne.world.localEvents['arc:mb:cooling']
    expect(resolvedArc!.stage).toBe('resolved')
    const slice = getLocalArcsModuleState(afterOne)
    expect(slice.cooldowns['mushroom_blight']).toBeGreaterThan(
      afterOne.calendar.totalDaysElapsed - 1,
    )
  })
})

describe('Phase 35 — Validation', () => {
  it('valid arc instance passes full state validation', () => {
    let base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    base = seedArcRecord(
      base,
      makeArcRecord({
        id: 'arc:mb:valid',
        stage: 'rising',
        ageDays: 7,
        startedDay: 0,
        lastUpdatedDay: 0,
      }),
    )
    const result = runDay(base)
    expect(result.validation.errors).toEqual([])
  })

  it('arc referencing an unknown definition fails module validation', () => {
    let base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    base = seedArcRecord(
      base,
      makeArcRecord({
        id: 'arc:invalid',
        definitionId: 'definitely_not_a_real_arc',
        stage: 'rising',
        ageDays: 7,
        startedDay: 0,
        lastUpdatedDay: 0,
      }),
    )
    const result = runDay(base)
    // Module-level validation reports the unknown definition; the
    // engine surfaces it through the validation summary.
    const issues = result.validation.errors.concat(result.validation.warnings)
    expect(
      issues.some((i) => i.code === 'unknown_local_arc_definition'),
    ).toBe(true)
  })
})

describe('Phase 35 — Card-readiness contract', () => {
  it('arc records carry text ingredients but no card text', () => {
    const base = plentyOfStock(withCoin(createInitialTavernState(), 500))
    const after = runMonths(base, 1)
    const arcs = listAllArcs(after)
    for (const arc of arcs) {
      // Each record exposes structured fields, not prose.
      expect(typeof arc.id).toBe('string')
      expect(typeof arc.definitionId).toBe('string')
      expect(typeof arc.stage).toBe('string')
      // No `cardText` / `cardId` fields snuck in.
      expect((arc as Record<string, unknown>).cardText).toBeUndefined()
      expect((arc as Record<string, unknown>).cardId).toBeUndefined()
    }
  })

  it('content folder exposes localArc registry and types via index', async () => {
    // Import indirection to ensure the index barrel is wired.
    const mod = await import('../../src/sim/content/events/index')
    expect(mod.localArcRegistry).toBeDefined()
    expect(mod.STARTER_LOCAL_ARC_DEFINITIONS).toBeDefined()
    expect(mod.MAX_ACTIVE_LOCAL_ARCS).toBe(MAX_ACTIVE_LOCAL_ARCS)
  })
})
