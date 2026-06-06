import { describe, it, expect } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  MAX_WEEKLY_HISTORY,
  WEEKLY_MODULE_ID,
  getWeeklyModuleState,
} from '../../src/sim/modules/weekly/index'
import { ensureWeeklyHistoryField } from '../../src/sim/state/migrations'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import type { TavernState } from '../../src/sim/state/TavernState'
import type { WeeklyModuleState, WeeklyResult } from '../../src/sim/modules/weekly/types'

// Phase 90 — Weekly persistence and history.
//
// Phase 14 (one-week-of-life) created a `lastWeeklyResult` field that was
// wiped on the next week's startDay. Phase 90 makes it durable and adds a
// bounded `weeklyHistory[]` buffer so the Reports → Weekly screen can
// read the closed week beyond its close day, and so future analytics
// have multi-week data to read.

const SEED = 'phase-90-weekly-persistence'

function startingState(): TavernState {
  // Give the test tavern enough coin and stock to actually serve and
  // produce non-degenerate weekly results across multiple weeks.
  const withAle = withStock(
    withCoin(createInitialTavernState(), 5000),
    'ale',
    { quantity: 800, quality: 60 },
  )
  const withStew = withStock(withAle, 'stew', { quantity: 400, quality: 60 })
  return withStock(withStew, 'mushrooms', { quantity: 200 })
}

function runDay(state: TavernState, dayIndex: number): TavernState {
  const input: SimInput = { seed: `${SEED}-d${dayIndex}` }
  return simulateDay(state, input, FULL_PIPELINE).state
}

function runDays(state: TavernState, count: number, fromDay = 1): TavernState {
  let current = state
  for (let i = 0; i < count; i += 1) current = runDay(current, fromDay + i)
  return current
}

describe('Phase 90 — Weekly result persistence', () => {
  it('fresh state has empty history and no last result', () => {
    const state = startingState()
    const slice = getWeeklyModuleState(state)
    expect(slice.weeklyHistory).toEqual([])
    expect(slice.lastWeeklyResult).toBeUndefined()
  })

  it('endWeek populates both lastWeeklyResult and history', () => {
    const state = runDays(startingState(), 7)
    const slice = getWeeklyModuleState(state)
    expect(slice.lastWeeklyResult).toBeDefined()
    expect(slice.lastWeeklyResult!.endDay).toBe(7)
    expect(slice.weeklyHistory.length).toBe(1)
    expect(slice.weeklyHistory[0]!.weekKey).toBe(slice.lastWeeklyResult!.weekKey)
  })

  it('lastWeeklyResult persists into day 8 of the next week', () => {
    const week1End = runDays(startingState(), 7)
    const week1Slice = getWeeklyModuleState(week1End)
    const day8 = runDay(week1End, 8)
    const day8Slice = getWeeklyModuleState(day8)

    expect(day8Slice.weekFinalized).toBe(false)
    expect(day8Slice.lastWeeklyResult).toBeDefined()
    expect(day8Slice.lastWeeklyResult!.weekKey).toBe(week1Slice.lastWeeklyResult!.weekKey)
    expect(day8Slice.weeklyHistory.length).toBe(1)
    // Phase 188 leaves enough stock for day 8 service to earn sales after
    // reset; assert the accumulator is a fresh day-sized window rather than
    // the closed week total.
    expect(day8Slice.economy.sales).toBeLessThan(week1Slice.economy.sales)
    expect(day8Slice.startedOnDay).toBe(8)
  })

  it('lastWeeklyResult survives all of days 8–13 (the entire next week before its own close)', () => {
    let current = runDays(startingState(), 7)
    const week1Slice = getWeeklyModuleState(current)
    const week1Key = week1Slice.lastWeeklyResult!.weekKey
    for (let dayIndex = 8; dayIndex <= 13; dayIndex += 1) {
      current = runDay(current, dayIndex)
      const slice = getWeeklyModuleState(current)
      expect(slice.lastWeeklyResult).toBeDefined()
      expect(slice.lastWeeklyResult!.weekKey).toBe(week1Key)
      expect(slice.weeklyHistory.length).toBe(1)
    }
  })

  it('week 2 close replaces lastWeeklyResult and appends to history', () => {
    const state = runDays(startingState(), 14)
    const slice = getWeeklyModuleState(state)
    expect(slice.lastWeeklyResult).toBeDefined()
    expect(slice.lastWeeklyResult!.weekNumber).toBe(2)
    expect(slice.weeklyHistory.length).toBe(2)
    expect(slice.weeklyHistory[0]!.weekNumber).toBe(1)
    expect(slice.weeklyHistory[1]!.weekNumber).toBe(2)
    // Oldest-first ordering.
    expect(slice.weeklyHistory[1]!.weekKey).toBe(slice.lastWeeklyResult!.weekKey)
  })

  it('weeklyHistory is bounded at MAX_WEEKLY_HISTORY (12 weeks)', () => {
    // Run 14 weeks (98 days) — should keep weeks 3..14, drop weeks 1 and 2.
    const state = runDays(startingState(), 7 * 14)
    const slice = getWeeklyModuleState(state)
    expect(MAX_WEEKLY_HISTORY).toBe(12)
    expect(slice.weeklyHistory.length).toBe(MAX_WEEKLY_HISTORY)
    // Newest at the end of the buffer.
    expect(slice.weeklyHistory[slice.weeklyHistory.length - 1]!.weekKey).toBe(
      slice.lastWeeklyResult!.weekKey,
    )
    // Oldest is week 3 (weeks 1 and 2 fell off the front).
    expect(slice.weeklyHistory[0]!.weekNumber).toBe(3)
  })

  it('buildWeeklyReport stays one-shot: weekly section emits on close day only', () => {
    // Day 7 close — section present.
    let current = startingState()
    let result = null
    for (let dayIndex = 1; dayIndex <= 7; dayIndex += 1) {
      result = simulateDay(current, { seed: `${SEED}-d${dayIndex}` }, FULL_PIPELINE)
      current = result.state
    }
    const day7Section = result!.reports.find((r) => r.id === 'weekly')
    expect(day7Section).toBeDefined()

    // Day 8 — section absent (lastWeeklyResult persists but isn't re-emitted).
    const day8Result = simulateDay(current, { seed: `${SEED}-d8` }, FULL_PIPELINE)
    const day8Section = day8Result.reports.find((r) => r.id === 'weekly')
    expect(day8Section).toBeUndefined()

    // Day 14 close — section returns.
    current = day8Result.state
    for (let dayIndex = 9; dayIndex <= 14; dayIndex += 1) {
      const r = simulateDay(current, { seed: `${SEED}-d${dayIndex}` }, FULL_PIPELINE)
      current = r.state
      if (dayIndex === 14) {
        const section = r.reports.find((r2) => r2.id === 'weekly')
        expect(section).toBeDefined()
      }
    }
  })

  it('weekly module state schema accepts the new weeklyHistory field', () => {
    // The schema is wired via SimulationModule.stateSchema and exercised by
    // engine validation. Running a full week and asserting no validation
    // errors covers the schema path.
    let current = startingState()
    let validatedClean = true
    for (let dayIndex = 1; dayIndex <= 14; dayIndex += 1) {
      const r = simulateDay(current, { seed: `${SEED}-d${dayIndex}` }, FULL_PIPELINE)
      if (r.validation.errors.length > 0) validatedClean = false
      current = r.state
    }
    expect(validatedClean).toBe(true)
  })
})

describe('Phase 90 — ensureWeeklyHistoryField migration', () => {
  function stripHistory(state: TavernState): TavernState {
    const slice = state.modules[WEEKLY_MODULE_ID] as WeeklyModuleState
    const { weeklyHistory: _omit, ...rest } = slice
    return {
      ...state,
      modules: {
        ...state.modules,
        [WEEKLY_MODULE_ID]: rest as unknown as WeeklyModuleState,
      },
    }
  }

  it('adds an empty weeklyHistory array when missing', () => {
    const fresh = startingState()
    const stripped = stripHistory(fresh)
    expect(
      (stripped.modules[WEEKLY_MODULE_ID] as { weeklyHistory?: unknown }).weeklyHistory,
    ).toBeUndefined()
    const repaired = ensureWeeklyHistoryField(stripped)
    const slice = getWeeklyModuleState(repaired)
    expect(slice.weeklyHistory).toEqual([])
  })

  it('preserves existing lastWeeklyResult exactly', () => {
    const closed = runDays(startingState(), 7)
    const closedSlice = getWeeklyModuleState(closed)
    expect(closedSlice.lastWeeklyResult).toBeDefined()

    const stripped = stripHistory(closed)
    const repaired = ensureWeeklyHistoryField(stripped)
    const slice = getWeeklyModuleState(repaired)
    expect(slice.lastWeeklyResult).toBeDefined()
    expect(slice.lastWeeklyResult!.weekKey).toBe(closedSlice.lastWeeklyResult!.weekKey)
    expect(slice.weeklyHistory).toEqual([])
  })

  it('is idempotent — second call is a no-op', () => {
    const stripped = stripHistory(startingState())
    const first = ensureWeeklyHistoryField(stripped)
    const second = ensureWeeklyHistoryField(first)
    expect(second).toBe(first)
  })

  it('does not invent history entries — populated history passes through unchanged', () => {
    const populated = runDays(startingState(), 14)
    const populatedSlice = getWeeklyModuleState(populated)
    expect(populatedSlice.weeklyHistory.length).toBe(2)

    const passthrough = ensureWeeklyHistoryField(populated)
    expect(passthrough).toBe(populated)
    const slice = getWeeklyModuleState(passthrough)
    expect(slice.weeklyHistory.length).toBe(2)
  })

  it('handles states with no weekly module slice at all (defensive)', () => {
    const noModule: TavernState = {
      ...startingState(),
      modules: {},
    }
    const result = ensureWeeklyHistoryField(noModule)
    expect(result).toBe(noModule)
  })
})

describe('Phase 90 — Comparison data is structurally available', () => {
  it('after two weeks, history contains both finalized results with distinct week keys', () => {
    const state = runDays(startingState(), 14)
    const slice = getWeeklyModuleState(state)
    expect(slice.weeklyHistory.length).toBeGreaterThanOrEqual(2)
    const previous: WeeklyResult = slice.weeklyHistory[slice.weeklyHistory.length - 2]!
    const current: WeeklyResult = slice.weeklyHistory[slice.weeklyHistory.length - 1]!
    expect(previous.weekKey).not.toBe(current.weekKey)
    expect(current).toBe(slice.lastWeeklyResult)
  })
})
