// Phase 89 — Tests for `causeLookup`.

import { describe, expect, it } from 'vitest'

import {
  causesForPath,
  causesForPressure,
  closedDayAbsolute,
  pathToCauseTarget,
} from '../../src/reports/causeLookup'
import { runOneWeek } from '../../src/sim/testing/simRunner'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimContext } from '../../src/sim/core/context'
import type { SimulationModule } from '../../src/sim/core/module'
import type { SimulationPhase } from '../../src/sim/core/phases'
import { causesModule } from '../../src/sim/modules/causes/index'
import { stockModule } from '../../src/sim/modules/stock/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'

const SEED = 'tests/reports/causeLookup'

describe('pathToCauseTarget', () => {
  it('maps reputation.<axis> to reputation:<axis>', () => {
    expect(pathToCauseTarget('reputation.tasty')).toBe('reputation:tasty')
    expect(pathToCauseTarget('reputation.filthy')).toBe('reputation:filthy')
  })

  it('maps stock.<id>[.field] to stock:<id>', () => {
    expect(pathToCauseTarget('stock.ale')).toBe('stock:ale')
    expect(pathToCauseTarget('stock.ale.quantity')).toBe('stock:ale')
  })

  it('maps areas.<id>.<field> to area:<id>', () => {
    expect(pathToCauseTarget('areas.main_room.cleanliness')).toBe('area:main_room')
  })

  it('maps pressures.<id>.<field> to pressure:<id>', () => {
    expect(pathToCauseTarget('pressures.food_safety.value')).toBe('pressure:food_safety')
  })

  it('passes coin through unchanged', () => {
    expect(pathToCauseTarget('coin')).toBe('coin')
  })

  it('falls through for unknown paths', () => {
    expect(pathToCauseTarget('memories.deep_grudge')).toBe('memories.deep_grudge')
  })
})

describe('causesForPath / causesForPressure', () => {
  it('returns only today\'s causes for the target, sorted by weight desc', () => {
    const run = runOneWeek({ seed: SEED })
    const state = run.finalState
    const closedDay = closedDayAbsolute(state)

    // Pick a reputation path the diff actually mentions, otherwise the
    // cause set may legitimately be empty.
    const lastDay = run.days.at(-1)!
    const dayDiff = lastDay.result.diffs.find((d) => d.boundary === 'day')
    const repChange = dayDiff?.changes.find((c) => c.path.startsWith('reputation.'))

    if (repChange) {
      const causes = causesForPath(state, repChange.path)
      for (const c of causes) {
        expect(c.timestamp.absoluteDay).toBe(closedDay)
      }
      for (let i = 1; i < causes.length; i += 1) {
        const prev = causes[i - 1]!
        const cur = causes[i]!
        expect(prev.weight).toBeGreaterThanOrEqual(cur.weight)
      }
    }

    // Pressures: the sim seeds several pressures by default; pull
    // food_safety as a canonical example. The list may be empty if no
    // cause stamped it today — both shapes are valid here, we only
    // check that whatever returns is well-shaped.
    const pressureCauses = causesForPressure(state, 'food_safety')
    for (const c of pressureCauses) {
      expect(c.timestamp.absoluteDay).toBe(closedDay)
      expect(c.target).toBe('pressure:food_safety')
    }
  })

  it('respects the limit option', () => {
    const run = runOneWeek({ seed: SEED + '.limit' })
    const state = run.finalState
    const causes = causesForPath(state, 'reputation.tasty', { limit: 2 })
    expect(causes.length).toBeLessThanOrEqual(2)
  })
})

describe('closedDayAbsolute', () => {
  it('equals totalDaysElapsed - 1 once a day has run', () => {
    const run = runOneWeek({ seed: SEED + '.closed' })
    const state = run.finalState
    expect(closedDayAbsolute(state)).toBe(state.calendar.totalDaysElapsed - 1)
  })
})

// Issue A regression — causesForPath must use prefix-tolerant matching so that
// an id-level lookup (`stock:ale`) resolves field-level stored causes
// (`stock:ale.quantity`). Before this fix the drilldown always returned empty
// for stock/staff/area/customer rows even though the audit was green.
describe('Issue A regression — id-level drilldown resolves field-level stored causes', () => {
  function probeModule(
    phase: SimulationPhase,
    mutate: (ctx: SimContext) => void,
  ): SimulationModule {
    return { id: 'probe', version: '0.0.0', hooks: { [phase]: [(ctx: SimContext) => mutate(ctx)] } }
  }

  it('causesForPath returns ≥1 cause for a stock drilldown (stock.ale.quantity)', () => {
    // Plants a stock change with an explicit cause via modifyStock.
    // `causesForPath('stock.ale.quantity')` converts to the id-level target
    // `stock:ale`; the engine stores the cause at `stock:ale.quantity`.
    // Before the fix, the exact-match filter missed it; after the fix, the
    // prefix-tolerant filter finds it.
    const probe = probeModule('beforeService', (ctx) => {
      const ale = ctx.state.stock.ale!
      ctx.modifyStock(
        'ale',
        { quantity: ale.quantity - 10 },
        { source: 'probe', reason: 'test consumption', weight: 10 },
      )
    })
    const result = simulateDay(createInitialTavernState(), { seed: SEED + '.issueA' }, [
      causesModule,
      stockModule,
      probe,
    ])
    const causes = causesForPath(result.state, 'stock.ale.quantity')
    expect(causes.length, 'causesForPath returned no causes for stock drilldown').toBeGreaterThan(0)
    expect(causes.some((c) => c.source === 'probe')).toBe(true)
  })
})
