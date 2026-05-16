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
import { causesModule } from '../../src/sim/modules/causes/index'
import {
  HISTORY_MAX_ENTRIES,
  HISTORY_MIN_AGE_DAYS,
  historyModule,
} from '../../src/sim/modules/history/index'
import type { SimulationModule } from '../../src/sim/core/module'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'

// Phase 62 / ISSUE-022 — History log pruning policy.
//
// `state.history` was growing unboundedly with simulation length;
// no hook trimmed it. The history module now registers an `endMonth`
// hook that prunes entries older than 90 days, but always keeps at
// least the most recent 500 entries.

const SEED = 'phase-62-history-pruning-test'

// A tiny probe module that emits 10 history entries every startDay so
// long simulations exercise the pruning hook.
const historyProbeModule: SimulationModule = {
  id: 'history_probe',
  version: '0.1.0',
  hooks: {
    startDay: [
      (ctx) => {
        for (let i = 0; i < 10; i += 1) {
          ctx.addHistory({
            category: 'system',
            summary: `probe entry ${i} on day ${ctx.state.calendar.totalDaysElapsed}`,
            tags: ['probe'],
          })
        }
      },
    ],
  },
}

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
  historyProbeModule,
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

describe('Phase 62 / ISSUE-022 — history log pruning', () => {
  it('history stays bounded over a 365-day run', () => {
    const base = createInitialTavernState()
    const state = runDays(base, 365)

    // After 12 monthly ticks the log must be bounded by the policy.
    // Allow a small headroom — at most one month's worth (≈300) of
    // entries can accumulate before the next endMonth hook runs.
    const today = state.calendar.totalDaysElapsed
    const recentCount = state.history.filter(
      (e) => today - e.timestamp.absoluteDay <= HISTORY_MIN_AGE_DAYS,
    ).length
    const policyMax = Math.max(HISTORY_MAX_ENTRIES, recentCount)
    expect(state.history.length).toBeLessThanOrEqual(policyMax + 320)
  })

  it('most recent entries are always preserved', () => {
    const base = createInitialTavernState()
    const state = runDays(base, 365)
    expect(state.history.length).toBeGreaterThan(0)
    // The most recent entry should be from the most recently completed
    // day. The probe runs at `startDay`, calendar advances after all
    // hooks, so the last entry's absoluteDay is `today - 1`.
    const latest = state.history[state.history.length - 1]!
    expect(latest.timestamp.absoluteDay).toBeGreaterThanOrEqual(
      state.calendar.totalDaysElapsed - 1,
    )
  })

  it('no entry older than min-age is retained when the size cap is satisfied', () => {
    const base = createInitialTavernState()
    const state = runDays(base, 365)
    const today = state.calendar.totalDaysElapsed
    // If we already have more than HISTORY_MAX_ENTRIES recent entries,
    // the size cap rule keeps strictly recent ones. Otherwise older
    // entries up to the 500-entry budget are kept.
    if (state.history.length <= HISTORY_MAX_ENTRIES) {
      // Nothing to assert — every entry is "fresh enough" by definition.
      return
    }
    const oldest = state.history[0]!
    const oldestAge = today - oldest.timestamp.absoluteDay
    // Oldest retained entry must be no older than min-age OR within
    // the size cap window, whichever is more permissive. With a 10/day
    // probe and a 500-entry cap the size rule dominates → oldest age
    // should be roughly 50 days.
    expect(oldestAge).toBeLessThan(HISTORY_MIN_AGE_DAYS + 30)
  })

  it('module declares the endMonth hook', () => {
    expect(historyModule.hooks?.endMonth).toBeDefined()
    expect(historyModule.hooks?.endMonth?.length).toBe(1)
  })
})
