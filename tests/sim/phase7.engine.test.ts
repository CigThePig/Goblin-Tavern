import { describe, it, expect } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimulationModule, SimulationHook } from '../../src/sim/core/module'
import type { SimContext } from '../../src/sim/core/context'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { advanceCalendar } from '../../src/sim/modules/calendar/index'
import type { TavernState } from '../../src/sim/state/TavernState'

// Phase 7 — Simulation engine & phase pipeline.
//
// These tests exercise the pipeline contracts, dependency-sorted hook
// execution, calendar gating for end-of-week / end-of-month, validation
// integration, and report collection.

const SEED = 'phase-7-engine-test'

function defaultInput() {
  return { seed: SEED }
}

function advanceCalendarBy(state: TavernState, days: number): TavernState {
  let calendar = state.calendar
  for (let i = 0; i < days; i += 1) {
    calendar = advanceCalendar(calendar)
  }
  return { ...state, calendar }
}

function recorderModule(
  id: string,
  log: string[],
  options: Partial<SimulationModule> = {},
): SimulationModule {
  const phases = [
    'startDay',
    'applyDayTypeModifiers',
    'forecastTraffic',
    'beforeOwnerActions',
    'applyOwnerActions',
    'afterOwnerActions',
    'assignStaffPriorities',
    'beforeService',
    'service',
    'afterService',
    'closing',
    'endDay',
    'endWeek',
    'endMonth',
    'generateReports',
    'validate',
    'advanceCalendar',
  ] as const
  const hooks: SimulationModule['hooks'] = {}
  for (const phase of phases) {
    const hook: SimulationHook = () => log.push(`${id}:${phase}`)
    hooks[phase] = [hook]
  }
  return { id, version: '0.0.1', hooks, ...options }
}

describe('Phase 7 — Simulation engine', () => {
  it('1. simulateDay advances the calendar exactly once per call', () => {
    const before = createInitialTavernState()
    const result = simulateDay(before, defaultInput(), [])
    expect(result.state.calendar.totalDaysElapsed).toBe(
      before.calendar.totalDaysElapsed + 1,
    )
    expect(result.state.calendar.day).toBe(2)
    expect(result.state.calendar.dayOfWeek).toBe(2)
  })

  it('2. startDay hooks run before service hooks across all modules', () => {
    const log: string[] = []
    const a = recorderModule('a', log)
    const b = recorderModule('b', log)
    simulateDay(createInitialTavernState(), defaultInput(), [a, b])
    const startA = log.indexOf('a:startDay')
    const startB = log.indexOf('b:startDay')
    const serviceA = log.indexOf('a:service')
    const serviceB = log.indexOf('b:service')
    expect(startA).toBeGreaterThanOrEqual(0)
    expect(startB).toBeGreaterThanOrEqual(0)
    expect(serviceA).toBeGreaterThanOrEqual(0)
    expect(serviceB).toBeGreaterThanOrEqual(0)
    expect(Math.max(startA, startB)).toBeLessThan(Math.min(serviceA, serviceB))
  })

  it('3. service hooks run before closing hooks across all modules', () => {
    const log: string[] = []
    const a = recorderModule('a', log)
    const b = recorderModule('b', log)
    simulateDay(createInitialTavernState(), defaultInput(), [a, b])
    const serviceA = log.indexOf('a:service')
    const serviceB = log.indexOf('b:service')
    const closingA = log.indexOf('a:closing')
    const closingB = log.indexOf('b:closing')
    expect(Math.max(serviceA, serviceB)).toBeLessThan(
      Math.min(closingA, closingB),
    )
  })

  it('4. endWeek hooks run only on Maintenance Day (dayOfWeek === 7)', () => {
    const log: string[] = []
    const mod = recorderModule('w', log)

    // Day 1 (dayOfWeek 1) — endWeek should NOT fire.
    const day1 = createInitialTavernState()
    expect(day1.calendar.dayOfWeek).toBe(1)
    simulateDay(day1, defaultInput(), [mod])
    expect(log.filter((l) => l === 'w:endWeek')).toEqual([])

    // Day 7 (dayOfWeek 7, Maintenance Day) — endWeek SHOULD fire.
    log.length = 0
    const day7 = advanceCalendarBy(createInitialTavernState(), 6)
    expect(day7.calendar.dayOfWeek).toBe(7)
    simulateDay(day7, defaultInput(), [mod])
    expect(log.filter((l) => l === 'w:endWeek')).toEqual(['w:endWeek'])
  })

  it('5. endMonth hooks run only on Day 28', () => {
    const log: string[] = []
    const mod = recorderModule('m', log)

    // Day 1 — endMonth should NOT fire.
    const day1 = createInitialTavernState()
    simulateDay(day1, defaultInput(), [mod])
    expect(log.filter((l) => l === 'm:endMonth')).toEqual([])

    // Day 28 — endMonth SHOULD fire.
    log.length = 0
    const day28 = advanceCalendarBy(createInitialTavernState(), 27)
    expect(day28.calendar.day).toBe(28)
    simulateDay(day28, defaultInput(), [mod])
    expect(log.filter((l) => l === 'm:endMonth')).toEqual(['m:endMonth'])
  })

  it('6. modules with dependsOn run after their dependencies in every phase', () => {
    const log: string[] = []
    // Declare in deliberately scrambled order.
    const reports = recorderModule('reports', log, { dependsOn: ['stock'] })
    const stock = recorderModule('stock', log, { dependsOn: ['areas'] })
    const areas = recorderModule('areas', log)

    simulateDay(createInitialTavernState(), defaultInput(), [reports, stock, areas])

    for (const phase of [
      'startDay',
      'service',
      'afterService',
      'closing',
      'endDay',
      'generateReports',
    ] as const) {
      const aIdx = log.indexOf(`areas:${phase}`)
      const sIdx = log.indexOf(`stock:${phase}`)
      const rIdx = log.indexOf(`reports:${phase}`)
      expect(aIdx).toBeGreaterThanOrEqual(0)
      expect(sIdx).toBeGreaterThan(aIdx)
      expect(rIdx).toBeGreaterThan(sIdx)
    }
  })

  it('7. cyclic module dependencies throw a clear error naming the cycle', () => {
    const a: SimulationModule = { id: 'a', version: '0.0.0', dependsOn: ['b'] }
    const b: SimulationModule = { id: 'b', version: '0.0.0', dependsOn: ['c'] }
    const c: SimulationModule = { id: 'c', version: '0.0.0', dependsOn: ['a'] }
    expect(() => simulateDay(createInitialTavernState(), defaultInput(), [a, b, c])).toThrow(
      /cyclic module dependency/i,
    )
    // Error message includes the cycle path.
    try {
      simulateDay(createInitialTavernState(), defaultInput(), [a, b, c])
    } catch (err) {
      const msg = (err as Error).message
      expect(msg).toMatch(/a/)
      expect(msg).toMatch(/b/)
      expect(msg).toMatch(/c/)
    }
  })

  it('also throws for a missing declared dependency, naming the missing id', () => {
    const lonely: SimulationModule = {
      id: 'lonely',
      version: '0.0.0',
      dependsOn: ['ghost'],
    }
    expect(() => simulateDay(createInitialTavernState(), defaultInput(), [lonely])).toThrow(
      /lonely.*ghost/,
    )
  })

  it('8. state remains valid (per validateState) after simulateDay returns', () => {
    const result = simulateDay(createInitialTavernState(), defaultInput(), [])
    expect(result.validation.errors).toEqual([])
  })

  it('9. dummy report sections via buildReport are collected into result.reports', () => {
    const reportingModule: SimulationModule = {
      id: 'sample-report',
      version: '0.0.0',
      buildReport: (_ctx: SimContext) => ({
        id: 'sample',
        source: 'sample-report',
        title: 'Sample Section',
        lines: ['line 1', 'line 2'],
      }),
    }
    const arrayReporter: SimulationModule = {
      id: 'array-report',
      version: '0.0.0',
      buildReport: (_ctx: SimContext) => [
        {
          id: 'first',
          source: 'array-report',
          title: 'First',
          lines: ['a'],
        },
        {
          id: 'second',
          source: 'array-report',
          title: 'Second',
          lines: ['b'],
        },
      ],
    }
    const result = simulateDay(
      createInitialTavernState(),
      defaultInput(),
      [reportingModule, arrayReporter],
    )
    const ids = result.reports.map((r) => r.id)
    expect(ids).toContain('sample')
    expect(ids).toContain('first')
    expect(ids).toContain('second')
  })
})

describe('Phase 7 — SimContext', () => {
  it('exposes deterministic rng seeded from input.seed', () => {
    const captured: number[] = []
    const mod: SimulationModule = {
      id: 'rng-probe',
      version: '0.0.0',
      hooks: {
        startDay: [
          (ctx) => {
            captured.push(ctx.rng.float())
          },
        ],
      },
    }
    const a = simulateDay(createInitialTavernState(), defaultInput(), [mod])
    const b = simulateDay(createInitialTavernState(), defaultInput(), [mod])
    void a
    void b
    expect(captured.length).toBe(2)
    expect(captured[0]).toBe(captured[1])
  })

  it('addReportSection / addLog accumulate into the result', () => {
    const mod: SimulationModule = {
      id: 'logger',
      version: '0.0.0',
      hooks: {
        startDay: [
          (ctx) => {
            ctx.addLog('hello world')
            ctx.addReportSection({
              id: 'manual',
              source: 'logger',
              title: 'Manual',
              lines: ['ok'],
            })
          },
        ],
      },
    }
    const result = simulateDay(createInitialTavernState(), defaultInput(), [mod])
    expect(result.reports.find((r) => r.id === 'manual')).toBeDefined()
    expect(result.logs.find((l) => l.message === 'hello world')).toBeDefined()
    const log = result.logs.find((l) => l.message === 'hello world')
    expect(log?.source).toBe('logger')
    expect(log?.level).toBe('info')
  })

  it('cause-required modify helpers update state without bypassing the meta argument', () => {
    const mod: SimulationModule = {
      id: 'mutator',
      version: '0.0.0',
      hooks: {
        afterService: [
          (ctx) => {
            ctx.modifyArea(
              'kitchen',
              { cleanliness: ctx.state.areas.kitchen!.cleanliness - 1 },
              { source: 'mutator', reason: 'test' },
            )
            ctx.modifyStock(
              'ale',
              { quantity: ctx.state.stock.ale!.quantity - 1 },
              { source: 'mutator' },
            )
          },
        ],
      },
    }
    const before = createInitialTavernState()
    const result = simulateDay(before, defaultInput(), [mod])
    expect(result.state.areas.kitchen!.cleanliness).toBe(
      before.areas.kitchen!.cleanliness - 1,
    )
    expect(result.state.stock.ale!.quantity).toBe(
      before.stock.ale!.quantity - 1,
    )
  })

  it('modifyArea throws on unknown id', () => {
    const mod: SimulationModule = {
      id: 'bad',
      version: '0.0.0',
      hooks: {
        startDay: [
          (ctx) => {
            ctx.modifyArea(
              'no_such_area',
              { cleanliness: 50 },
              { source: 'bad' },
            )
          },
        ],
      },
    }
    expect(() => simulateDay(createInitialTavernState(), defaultInput(), [mod])).toThrow(
      /no_such_area/,
    )
  })

  it('module-level validate() issues are merged into result.validation.errors', () => {
    const mod: SimulationModule = {
      id: 'noisy-validator',
      version: '0.0.0',
      validate: () => [
        { path: 'fake.path', message: 'pretend issue', code: 'pretend' },
      ],
    }
    const result = simulateDay(createInitialTavernState(), defaultInput(), [mod])
    const found = result.validation.errors.find((e) => e.code === 'pretend')
    expect(found).toBeDefined()
    expect(found?.path).toBe('fake.path')
  })

  it('isEndOfWeek and isEndOfMonth reflect the current calendar', () => {
    const flags: { eow: boolean; eom: boolean } = { eow: false, eom: false }
    const mod: SimulationModule = {
      id: 'flagger',
      version: '0.0.0',
      hooks: {
        startDay: [
          (ctx) => {
            flags.eow = ctx.isEndOfWeek()
            flags.eom = ctx.isEndOfMonth()
          },
        ],
      },
    }
    const day7 = advanceCalendarBy(createInitialTavernState(), 6)
    simulateDay(day7, defaultInput(), [mod])
    expect(flags.eow).toBe(true)
    expect(flags.eom).toBe(false)

    const day28 = advanceCalendarBy(createInitialTavernState(), 27)
    simulateDay(day28, defaultInput(), [mod])
    expect(flags.eom).toBe(true)
  })
})
