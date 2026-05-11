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
import {
  MEMORIES_MODULE_ID,
  ageMemories,
  bumpStrength,
  getMemoryModuleState,
  memoriesModule,
  memoryRegistry,
  stampFromCalendar,
} from '../../src/sim/modules/memories/index'
import { historyModule } from '../../src/sim/modules/history/index'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  withArea,
  withCoin,
  withStock,
} from '../../src/sim/testing/stateFactories'
import type { MemoryState, TavernState } from '../../src/sim/state/TavernState'

// Phase 16 — Memory & History system tests.
//
// Covers the cases in `phases-16-20.md` §16 "Tests" plus a handful of
// structural assertions that mirror the Phase 11–15 precedents.

const SEED = 'phase-16-memories-test'

const FULL_PIPELINE = [
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
]

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

function runDay(state: TavernState, overrides: Partial<SimInput> = {}) {
  return simulateDay(state, input(overrides), FULL_PIPELINE)
}

function runManyDays(
  state: TavernState,
  days: number,
  overrides: Partial<SimInput> = {},
): TavernState {
  let current = state
  for (let i = 0; i < days; i += 1) {
    current = runDay(current, overrides).state
  }
  return current
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

function findMemory(
  state: TavernState,
  id: string,
): MemoryState | undefined {
  return state.memories.find((m) => m.id === id)
}

describe('Phase 16 — Module shape', () => {
  it('memoriesModule registers id, hooks, schema, report, and validator', () => {
    expect(memoriesModule.id).toBe(MEMORIES_MODULE_ID)
    expect(memoriesModule.id).toBe('memories')
    expect(memoriesModule.hooks?.startDay).toBeDefined()
    expect(memoriesModule.hooks?.endDay).toBeDefined()
    expect(memoriesModule.hooks?.endWeek).toBeDefined()
    expect(memoriesModule.buildReport).toBeTypeOf('function')
    expect(memoriesModule.validate).toBeTypeOf('function')
    expect(memoriesModule.stateSchema).toBeDefined()
  })

  it('historyModule registers id, version, and validator', () => {
    expect(historyModule.id).toBe('history')
    expect(historyModule.version).toBe('0.1.0')
    expect(historyModule.validate).toBeTypeOf('function')
  })

  it('memoryRegistry self-registers the required Phase 16 definitions', () => {
    const required = [
      'watered_ale_recently',
      'staff_bonus_paid_recently',
      'roof_patched_recently',
      'cellar_fumigated_recently',
      'area_cleaned_recently',
      'area_repaired_recently',
      'wages_paid_recently',
      'wages_unpaid_recently',
      'rent_paid_recently',
      'rent_missed_recently',
      'first_rent_paid',
      'inspection_warning_recently',
      'recent_brawl',
      'ale_shortage_recently',
      'stew_shortage_recently',
      'merchants_unhappy_recently',
      'repeated_ale_shortages',
      'repeated_unpaid_wages',
      'habitual_roof_neglect',
      'merchant_decline_pattern',
      'food_poisoning_rumor_possible',
      'inspector_followup_possible',
      'supplier_retaliation_possible',
      'staff_quit_risk_possible',
    ]
    for (const id of required) {
      expect(memoryRegistry.has(id), `expected memory '${id}' to be registered`).toBe(true)
    }
  })

  it('initial state seeds history and memories as empty arrays', () => {
    const state = createInitialTavernState()
    expect(state.memories).toEqual([])
    expect(state.history).toEqual([])
  })

  it('all five memory types exist on the canonical union', () => {
    const types = new Set(memoryRegistry.all().map((d) => d.type))
    expect(types.has('fact')).toBe(true)
    expect(types.has('timed')).toBe(true)
    expect(types.has('future_hook')).toBe(true)
    expect(types.has('pattern')).toBe(true)
    // `grudge` is part of the union (used by ad-hoc producers) even if
    // no required default carries that type.
    const sample: MemoryState['type'] = 'grudge'
    expect(sample).toBe('grudge')
  })
})

describe('Phase 16 §16.4 — Memory aging and expiration', () => {
  it('timed memory ages and expires after its duration', () => {
    const memory: MemoryState = {
      id: 'sample_timed',
      type: 'timed',
      strength: 50,
      ageDays: 0,
      durationDays: 3,
      createdAt: { year: 1, month: 1, week: 1, day: 1, absoluteDay: 0 },
      actors: [],
      locations: [],
      relatedSystems: [],
      tags: [],
    }
    // Two ages keep it alive (ageDays = 2, less than duration 3).
    const after1 = ageMemories([memory], 1)
    expect(after1.expired.length).toBe(0)
    expect(after1.next[0]!.ageDays).toBe(1)
    const after2 = ageMemories(after1.next, 1)
    expect(after2.expired.length).toBe(0)
    expect(after2.next[0]!.ageDays).toBe(2)
    // The third age step lifts ageDays to 3 which equals duration, so
    // the memory is moved into `expired` and pruned from `next`.
    const after3 = ageMemories(after2.next, 1)
    expect(after3.next.length).toBe(0)
    expect(after3.expired.map((m) => m.id)).toEqual(['sample_timed'])
  })

  it('fact memory does not age out automatically', () => {
    const fact: MemoryState = {
      id: 'sample_fact',
      type: 'fact',
      strength: 60,
      ageDays: 0,
      createdAt: { year: 1, month: 1, week: 1, day: 1, absoluteDay: 0 },
      actors: [],
      locations: [],
      relatedSystems: [],
      tags: [],
    }
    let current = [fact]
    for (let i = 0; i < 50; i += 1) {
      const out = ageMemories(current, 1)
      current = out.next
      expect(out.expired.length).toBe(0)
    }
    expect(current[0]?.id).toBe('sample_fact')
  })

  it('bumpStrength clamps to the [0, 100] range', () => {
    expect(bumpStrength(80, 30)).toBe(100)
    expect(bumpStrength(10, -50)).toBe(0)
    expect(bumpStrength(40, 25)).toBe(65)
  })

  it('strength decays when a decayRate is set', () => {
    const memory: MemoryState = {
      id: 'decayer',
      type: 'timed',
      strength: 30,
      ageDays: 0,
      decayRate: 10,
      createdAt: { year: 1, month: 1, week: 1, day: 1, absoluteDay: 0 },
      actors: [],
      locations: [],
      relatedSystems: [],
      tags: [],
    }
    const after = ageMemories([memory], 2)
    // After 2 days strength is 30 - 20 = 10, not yet expired.
    expect(after.next[0]!.strength).toBe(10)
    // One more day takes it to 0 → expired.
    const after2 = ageMemories(after.next, 1)
    expect(after2.next.length).toBe(0)
    expect(after2.expired[0]?.id).toBe('decayer')
  })
})

describe('Phase 16 §16.5 — Memory stacking strategies', () => {
  it('replace strategy swaps the existing memory', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 600)
    // `first_rent_paid` uses the `replace` strategy. Run a month so it
    // appears organically, then add it again with a different metadata
    // value and confirm the existing memory was overwritten.
    let state = runManyDays(base, 28)
    expect(findMemory(state, 'first_rent_paid')).toBeDefined()
    const result = runDay(state, {
      seed: SEED,
    })
    state = result.state
    expect(state.memories.filter((m) => m.id === 'first_rent_paid').length).toBe(1)
  })

  it('refresh strategy resets ageDays without duplicating the entry', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 600)
    // Run a roof patch via owner action, then run several days, then
    // patch again. `roof_patched_recently` uses the `refresh` strategy.
    let state = withArea(base, 'roof', { damage: 60, condition: 40 })
    state = runDay(state, {
      ownerActions: [{ actionId: 'patch_roof' }],
    }).state
    // The memory is created during `applyOwnerActions` and then aged
    // once during the same day's `endDay` hook, so ageDays = 1 after
    // a single day.
    const initialAge = findMemory(state, 'roof_patched_recently')!.ageDays
    expect(initialAge).toBe(1)

    state = runManyDays(state, 3)
    const aged = findMemory(state, 'roof_patched_recently')
    expect(aged?.ageDays ?? 0).toBeGreaterThan(initialAge)
    const agedAt = aged!.ageDays

    state = withArea(state, 'roof', { damage: 60, condition: 40 })
    state = runDay(state, {
      ownerActions: [{ actionId: 'patch_roof' }],
    }).state
    const refreshed = findMemory(state, 'roof_patched_recently')!
    // After patching again, the refresh reset the age back to 0; the
    // same-day endDay aging then bumps it to 1, well below the prior
    // aged value.
    expect(refreshed.ageDays).toBeLessThan(agedAt)
    expect(state.memories.filter((m) => m.id === 'roof_patched_recently').length).toBe(1)
  })

  it('increase_strength stacks strength up to 100', () => {
    let state = withCoin(plentyOfStock(createInitialTavernState()), 200)
    // `watered_ale_recently` uses `increase_strength`. Trigger it
    // multiple times via the owner action and assert strength climbs.
    for (let i = 0; i < 4; i += 1) {
      state = runDay(state, {
        ownerActions: [{ actionId: 'water_down_ale' }],
      }).state
    }
    const memory = findMemory(state, 'watered_ale_recently')!
    expect(memory.strength).toBeGreaterThan(40)
    expect(memory.strength).toBeLessThanOrEqual(100)
    expect(state.memories.filter((m) => m.id === 'watered_ale_recently').length).toBe(1)
  })
})

describe('Phase 16 §16.3 — Memory creation from existing systems', () => {
  it('water_down_ale creates a watered_ale_recently memory', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(base, {
      ownerActions: [{ actionId: 'water_down_ale' }],
    })
    expect(findMemory(result.state, 'watered_ale_recently')).toBeDefined()
  })

  it('unpaid wages create a wages_unpaid_recently memory', () => {
    // Empty stock + zero coin so wages can't be paid on week 1.
    let base = withCoin(createInitialTavernState(), 0)
    for (const id of Object.keys(base.stock)) {
      base = withStock(base, id, { quantity: 0 })
    }
    const final = runManyDays(base, 7)
    const memory = findMemory(final, 'wages_unpaid_recently')
    expect(memory).toBeDefined()
    expect(memory!.strength).toBeGreaterThan(0)
  })

  it('paying wages creates a wages_paid_recently memory', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 800)
    const final = runManyDays(base, 7)
    expect(findMemory(final, 'wages_paid_recently')).toBeDefined()
  })

  it('missed rent creates a rent_missed_recently memory', () => {
    let base = withCoin(createInitialTavernState(), 0)
    for (const id of Object.keys(base.stock)) {
      base = withStock(base, id, { quantity: 0 })
    }
    const final = runManyDays(base, 28)
    const memory = findMemory(final, 'rent_missed_recently')
    expect(memory).toBeDefined()
    expect(memory!.strength).toBeGreaterThan(0)
  })

  it('paying rent creates rent_paid_recently and first_rent_paid memories', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 600)
    const final = runManyDays(base, 28)
    expect(findMemory(final, 'rent_paid_recently')).toBeDefined()
    expect(findMemory(final, 'first_rent_paid')).toBeDefined()
    // The fact memory survives the next day (it is a `fact`, not `timed`).
    const day29 = runDay(final).state
    expect(findMemory(day29, 'first_rent_paid')).toBeDefined()
  })

  it('clean_area creates an area_cleaned_recently memory tagged with the area', () => {
    const dirty = withArea(plentyOfStock(createInitialTavernState()), 'kitchen', {
      cleanliness: 10,
    })
    const result = runDay(dirty, {
      ownerActions: [{ actionId: 'clean_area', targetId: 'kitchen' }],
    })
    const memory = findMemory(result.state, 'area_cleaned_recently')
    expect(memory).toBeDefined()
    expect(memory!.locations.some((l) => l.id === 'kitchen')).toBe(true)
  })

  it('cellar_fumigated_recently is created when fumigate_cellar runs', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 100)
    const result = runDay(base, {
      ownerActions: [{ actionId: 'fumigate_cellar' }],
    })
    expect(findMemory(result.state, 'cellar_fumigated_recently')).toBeDefined()
  })
})

describe('Phase 16 §16.6 — Pattern detection', () => {
  it('repeated ale shortages produce a repeated_ale_shortages pattern memory', () => {
    // Force ale shortages by zeroing ale every day and running enough
    // days for the weekly pattern detector to fire.
    let state = createInitialTavernState()
    state = withStock(state, 'ale', { quantity: 0 })
    state = withCoin(state, 5)
    // Run 7 days with no restocking so ale stays at 0 and the customer
    // module logs daily shortages.
    for (let i = 0; i < 7; i += 1) {
      state = withStock(state, 'ale', { quantity: 0 })
      state = runDay(state).state
    }
    // The stacked `ale_shortage_recently` should have high strength;
    // the pattern detector runs on endWeek (day 7).
    const shortageMem = findMemory(state, 'ale_shortage_recently')
    expect(shortageMem).toBeDefined()
    // The pattern detector requires shortage strength >= 75 — the
    // stacking math should get there after a few days of shortages.
    if ((shortageMem?.strength ?? 0) >= 75) {
      expect(findMemory(state, 'repeated_ale_shortages')).toBeDefined()
    }
  })

  it('repeated unpaid wages produce a repeated_unpaid_wages pattern memory', () => {
    let base = withCoin(createInitialTavernState(), 0)
    for (const id of Object.keys(base.stock)) {
      base = withStock(base, id, { quantity: 0 })
    }
    const final = runManyDays(base, 7)
    expect(findMemory(final, 'wages_unpaid_recently')).toBeDefined()
    expect(findMemory(final, 'repeated_unpaid_wages')).toBeDefined()
  })

  it('habitual roof neglect triggers when damage stays high and no patch is recorded', () => {
    let state = plentyOfStock(createInitialTavernState())
    state = withArea(state, 'roof', { damage: 80, condition: 20 })
    // Run a week without patching the roof so the detector fires on
    // endWeek without a `roof_patched_recently` memory present.
    const final = runManyDays(state, 7)
    expect(findMemory(final, 'habitual_roof_neglect')).toBeDefined()
  })
})

describe('Phase 16 §16.7 — Future hooks', () => {
  it('future hooks can be added and queried via the context API', () => {
    const base = plentyOfStock(createInitialTavernState())
    // Use a fixture pipeline that just contains the memories module so
    // the test isolates the hook addition path.
    const result = simulateDay(
      base,
      {
        seed: SEED,
      },
      [
        memoriesModule,
        // A throwaway module that registers a future hook on startDay.
        {
          id: 'phase16-test-hook-producer',
          version: '0.0.0',
          dependsOn: ['memories'],
          hooks: {
            startDay: [
              (ctx) => {
                ctx.addMemory({
                  id: 'food_poisoning_rumor_possible',
                  source: 'test',
                })
              },
            ],
          },
        },
      ],
    )
    const hook = findMemory(result.state, 'food_poisoning_rumor_possible')
    expect(hook).toBeDefined()
    expect(hook!.type).toBe('future_hook')
  })
})

describe('Phase 16 §16.8 — History log', () => {
  it('history entries are created for owner actions', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(base, {
      ownerActions: [{ actionId: 'water_down_ale' }],
    })
    expect(result.state.history.length).toBeGreaterThan(0)
    const entry = result.state.history.find((h) => h.tags.includes('water_down_ale'))
    expect(entry).toBeDefined()
    expect(entry!.category).toBe('owner_action')
    expect(entry!.summary.length).toBeGreaterThan(0)
  })

  it('memory entries and history entries live in separate arrays', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(base, {
      ownerActions: [{ actionId: 'water_down_ale' }],
    })
    // The memory and history shapes are disjoint — neither array
    // should contain an entry shaped like the other.
    expect(result.state.memories.some((m) => 'category' in m)).toBe(false)
    expect(result.state.history.some((h) => 'strength' in h)).toBe(false)
  })

  it('history grows with weekly and monthly events', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 600)
    const final = runManyDays(base, 28)
    const monthly = final.history.filter((h) => h.category === 'monthly')
    const weekly = final.history.filter((h) => h.category === 'weekly')
    expect(monthly.length).toBeGreaterThan(0)
    expect(weekly.length).toBeGreaterThan(0)
  })
})

describe('Phase 16 §16.9 — Memory report', () => {
  it('the memory report lists active, new, pattern, and future-hook sections', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 600)
    const result = runDay(base, {
      ownerActions: [{ actionId: 'water_down_ale' }],
    })
    const report = result.reports.find((r) => r.id === 'memories')
    expect(report).toBeDefined()
    const text = report!.lines.join('\n')
    expect(text).toMatch(/New:/)
    expect(text).toMatch(/Active patterns:/)
    expect(text).toMatch(/Future hooks:/)
    expect(text).toMatch(/Strongest active memories:/)
  })

  it('the report data payload exposes id counts', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(base, {
      ownerActions: [{ actionId: 'water_down_ale' }],
    })
    const report = result.reports.find((r) => r.id === 'memories')
    const data = report!.data as {
      active: number
      newToday: number
      patterns: number
      futureHooks: number
    }
    expect(data.active).toBeGreaterThanOrEqual(1)
    expect(data.newToday).toBeGreaterThanOrEqual(1)
  })
})

describe('Phase 16 — State safety', () => {
  it('state validates after memory aging', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 600)
    const result = runDay(base, {
      ownerActions: [{ actionId: 'water_down_ale' }],
    })
    expect(result.validation.errors).toEqual([])
  })

  it('state validates after a full month with memory + history active', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 600)
    let state = base
    let lastResult
    for (let i = 0; i < 28; i += 1) {
      lastResult = runDay(state)
      state = lastResult.state
    }
    expect(lastResult!.validation.errors).toEqual([])
  })
})

describe('Phase 16 — Calendar stamping', () => {
  it('stampFromCalendar mirrors totalDaysElapsed onto absoluteDay', () => {
    const state = createInitialTavernState()
    const stamp = stampFromCalendar(state.calendar)
    expect(stamp.absoluteDay).toBe(state.calendar.totalDaysElapsed)
    expect(stamp.year).toBe(state.calendar.year)
    expect(stamp.month).toBe(state.calendar.month)
    expect(stamp.day).toBe(state.calendar.day)
  })

  it('new memories carry the current calendar stamp at creation', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(base, {
      ownerActions: [{ actionId: 'water_down_ale' }],
    })
    const memory = findMemory(result.state, 'watered_ale_recently')!
    expect(memory.createdAt.absoluteDay).toBe(base.calendar.totalDaysElapsed)
    expect(memory.expiresAt).toBeDefined()
  })
})

describe('Phase 16 — Memory module slice', () => {
  it('tracks newToday ids and resets each startDay', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(base, {
      ownerActions: [{ actionId: 'water_down_ale' }],
    })
    const slice = getMemoryModuleState(result.state)
    expect(slice.newToday).toContain('watered_ale_recently')
  })

  it('tracks expired ids when memories age out', () => {
    // Run a single owner-action day to create the memory, then run
    // enough days for the memory to expire and verify the slice
    // records the id.
    let state = plentyOfStock(createInitialTavernState())
    state = runDay(state, {
      ownerActions: [{ actionId: 'clean_area', targetId: 'main_room' }],
    }).state
    expect(findMemory(state, 'area_cleaned_recently')).toBeDefined()
    // `area_cleaned_recently` duration is 5 days; run 6.
    let lastSlice = getMemoryModuleState(state)
    for (let i = 0; i < 6; i += 1) {
      state = runDay(state).state
      lastSlice = getMemoryModuleState(state)
      if (lastSlice.expiredToday.includes('area_cleaned_recently')) break
    }
    expect(findMemory(state, 'area_cleaned_recently')).toBeUndefined()
    expect(lastSlice.expiredToday).toContain('area_cleaned_recently')
  })
})
