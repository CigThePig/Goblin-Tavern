import { describe, it, expect } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  MAX_MONTHLY_HISTORY,
  MONTHLY_MODULE_ID,
  getMonthlyModuleState,
} from '../../src/sim/modules/monthly/index'
import { ensureMonthlyHistoryField } from '../../src/sim/state/migrations'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import type { TavernState } from '../../src/sim/state/TavernState'
import type {
  MonthlyModuleState,
  MonthlyResult,
} from '../../src/sim/modules/monthly/types'

// Phase 91 — Monthly persistence and history.
//
// Phase 15 (the monthly module) created a `lastMonthlyResult` field that
// was wiped by `startDayHook`'s `isNewMonth` reset on day 1 of every new
// month. Phase 91 makes it durable and adds a bounded `monthlyHistory[]`
// buffer so the Reports → Monthly screen can read the closed month
// beyond its close day, and so future month-over-month analytics have
// multi-month data to read.

const SEED = 'phase-91-monthly-persistence'

function startingState(): TavernState {
  // Heavy coin reserves + plenty of stock so the test tavern never goes
  // broke across multi-month arcs (we need 14 months / 392 days for the
  // bounded-history test).
  const base = withCoin(createInitialTavernState(), 50_000)
  const withAle = withStock(base, 'ale', { quantity: 5000, quality: 60 })
  const withStew = withStock(withAle, 'stew', { quantity: 5000, quality: 60 })
  return withStock(withStew, 'mushrooms', { quantity: 5000 })
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

describe('Phase 91 — Monthly result persistence', () => {
  it('fresh state has empty history and no last result', () => {
    const state = startingState()
    const slice = getMonthlyModuleState(state)
    expect(slice.monthlyHistory).toEqual([])
    expect(slice.lastMonthlyResult).toBeUndefined()
  })

  it('endMonth populates both lastMonthlyResult and history', () => {
    const state = runDays(startingState(), 28)
    const slice = getMonthlyModuleState(state)
    expect(slice.lastMonthlyResult).toBeDefined()
    expect(slice.lastMonthlyResult!.endDay).toBe(28)
    expect(slice.lastMonthlyResult!.monthNumber).toBe(1)
    expect(slice.monthlyHistory.length).toBe(1)
    expect(slice.monthlyHistory[0]!.monthKey).toBe(slice.lastMonthlyResult!.monthKey)
    expect(slice.monthFinalized).toBe(true)
  })

  it('lastMonthlyResult persists into day 1 of the next month', () => {
    const month1End = runDays(startingState(), 28)
    const month1Slice = getMonthlyModuleState(month1End)
    const day29 = runDay(month1End, 29)
    const day29Slice = getMonthlyModuleState(day29)

    expect(day29Slice.monthFinalized).toBe(false)
    expect(day29Slice.lastMonthlyResult).toBeDefined()
    expect(day29Slice.lastMonthlyResult!.monthKey).toBe(
      month1Slice.lastMonthlyResult!.monthKey,
    )
    expect(day29Slice.monthlyHistory.length).toBe(1)
    // The accumulator was reset for the new month.
    expect(day29Slice.accumulator.weekKeys).toEqual([])
    expect(day29Slice.monthNumber).toBe(2)
  })

  it('lastMonthlyResult survives all of days 29–55 (the whole next month pre-close)', () => {
    let current = runDays(startingState(), 28)
    const month1Slice = getMonthlyModuleState(current)
    const month1Key = month1Slice.lastMonthlyResult!.monthKey
    for (let dayIndex = 29; dayIndex <= 55; dayIndex += 1) {
      current = runDay(current, dayIndex)
      const slice = getMonthlyModuleState(current)
      expect(slice.lastMonthlyResult).toBeDefined()
      expect(slice.lastMonthlyResult!.monthKey).toBe(month1Key)
      expect(slice.monthlyHistory.length).toBe(1)
      expect(slice.monthFinalized).toBe(false)
    }
  })

  it('month 2 close replaces lastMonthlyResult and appends to history', () => {
    const state = runDays(startingState(), 56)
    const slice = getMonthlyModuleState(state)
    expect(slice.lastMonthlyResult).toBeDefined()
    expect(slice.lastMonthlyResult!.monthNumber).toBe(2)
    expect(slice.monthlyHistory.length).toBe(2)
    expect(slice.monthlyHistory[0]!.monthNumber).toBe(1)
    expect(slice.monthlyHistory[1]!.monthNumber).toBe(2)
    // Oldest-first ordering with the current month at the tail.
    expect(slice.monthlyHistory[1]!.monthKey).toBe(slice.lastMonthlyResult!.monthKey)
  })

  it('monthlyHistory is bounded at MAX_MONTHLY_HISTORY (12 months)', () => {
    // Run 14 months (392 days) — should keep months 3..14, drop months 1 and 2.
    const state = runDays(startingState(), 28 * 14)
    const slice = getMonthlyModuleState(state)
    expect(MAX_MONTHLY_HISTORY).toBe(12)
    expect(slice.monthlyHistory.length).toBe(MAX_MONTHLY_HISTORY)
    expect(slice.monthlyHistory[slice.monthlyHistory.length - 1]!.monthKey).toBe(
      slice.lastMonthlyResult!.monthKey,
    )
    // Oldest entry is month 3 (months 1 and 2 fell off the front).
    expect(slice.monthlyHistory[0]!.monthNumber).toBe(3)
  })

  it('buildMonthlyReport stays one-shot: monthly section emits on close day only', () => {
    // Day 28 close — section present.
    let current = startingState()
    let day28Result = null
    for (let dayIndex = 1; dayIndex <= 28; dayIndex += 1) {
      day28Result = simulateDay(
        current,
        { seed: `${SEED}-d${dayIndex}` },
        FULL_PIPELINE,
      )
      current = day28Result.state
    }
    const day28Section = day28Result!.reports.find((r) => r.id === 'monthly')
    expect(day28Section).toBeDefined()

    // Day 29 — section absent (lastMonthlyResult persists but isn't re-emitted).
    const day29Result = simulateDay(current, { seed: `${SEED}-d29` }, FULL_PIPELINE)
    const day29Section = day29Result.reports.find((r) => r.id === 'monthly')
    expect(day29Section).toBeUndefined()
    current = day29Result.state

    // Drive through to day 56 (next close) and confirm the gap is silent.
    for (let dayIndex = 30; dayIndex <= 55; dayIndex += 1) {
      const r = simulateDay(current, { seed: `${SEED}-d${dayIndex}` }, FULL_PIPELINE)
      const section = r.reports.find((r2) => r2.id === 'monthly')
      expect(section).toBeUndefined()
      current = r.state
    }

    // Day 56 close — section returns with the month-2 result.
    const day56Result = simulateDay(current, { seed: `${SEED}-d56` }, FULL_PIPELINE)
    const day56Section = day56Result.reports.find((r) => r.id === 'monthly')
    expect(day56Section).toBeDefined()
    expect(day56Section!.data?.monthNumber).toBe(2)
  })

  it('monthly module state schema accepts the new monthlyHistory field', () => {
    let current = startingState()
    let validatedClean = true
    for (let dayIndex = 1; dayIndex <= 56; dayIndex += 1) {
      const r = simulateDay(current, { seed: `${SEED}-d${dayIndex}` }, FULL_PIPELINE)
      if (r.validation.errors.length > 0) validatedClean = false
      current = r.state
    }
    expect(validatedClean).toBe(true)
  })

  it('year rollover: month 12 → month 1 of year 2 lands in history correctly', () => {
    // 14 months crosses Y1-M12 → Y2-M1. After bounded trim (12 months
    // kept), the history should contain months 3..14, where month 13 is
    // Y2-M1 and month 14 is Y2-M2.
    const state = runDays(startingState(), 28 * 14)
    const slice = getMonthlyModuleState(state)
    expect(slice.monthlyHistory.length).toBe(MAX_MONTHLY_HISTORY)

    // The 12 retained entries span Y1-M3 through Y2-M2.
    const oldest = slice.monthlyHistory[0]!
    const newest = slice.monthlyHistory[slice.monthlyHistory.length - 1]!
    expect(oldest.yearNumber).toBe(1)
    expect(oldest.monthNumber).toBe(3)
    expect(newest.yearNumber).toBe(2)
    expect(newest.monthNumber).toBe(2)
    expect(newest.monthKey).toBe(slice.lastMonthlyResult!.monthKey)

    // Walk the buffer and confirm the year flips exactly once.
    const yearFlipIndex = slice.monthlyHistory.findIndex(
      (r, i, arr) => i > 0 && (arr[i - 1]?.yearNumber ?? 0) !== r.yearNumber,
    )
    expect(yearFlipIndex).toBeGreaterThan(0)
    expect(slice.monthlyHistory[yearFlipIndex]!.monthNumber).toBe(1)
    expect(slice.monthlyHistory[yearFlipIndex]!.yearNumber).toBe(2)
  })

  it('a problem-free tavern surfaces no monthly_review on day 1 of the next month', () => {
    // Phase 186 / Cluster 4 — `monthly_review` was re-homed to the first
    // morning of the new month (contract §3.5): it is produced in the
    // `startDay` morning pass, gated on `lastMonthlyResult` +
    // `calendar.day === 1`. But the generator still only fires when the
    // just-closed month left something worth reviewing — it needs recent
    // monthly/rent/reputation causes. This `startingState()` tavern hoards
    // 50,000 coin and 5,000 of every stock, so it pays rent on time and
    // accrues no debt/reputation causes; day 29 (the first morning of
    // month 2) therefore has nothing to review and produces zero
    // monthly_review seeds. (The fired-on-day-1 path is covered by
    // phase59.monthlyReview.) `lastMonthlyResult` persistence — this file's
    // actual subject — is asserted by the surrounding tests.
    const month1End = runDays(startingState(), 28)
    const day29 = simulateDay(month1End, { seed: `${SEED}-d29` }, FULL_PIPELINE)
    const seedsReport = day29.reports.find((r) => r.id === 'issue_seeds')
    const seeds =
      (seedsReport?.data?.seeds as Array<{ family?: string }> | undefined) ?? []
    const monthlyReviewSeeds = seeds.filter((s) => s.family === 'monthly_review')
    expect(monthlyReviewSeeds).toEqual([])
  })
})

describe('Phase 91 — ensureMonthlyHistoryField migration', () => {
  function stripHistory(state: TavernState): TavernState {
    const slice = state.modules[MONTHLY_MODULE_ID] as MonthlyModuleState
    const { monthlyHistory: _omit, ...rest } = slice
    return {
      ...state,
      modules: {
        ...state.modules,
        [MONTHLY_MODULE_ID]: rest as unknown as MonthlyModuleState,
      },
    }
  }

  it('adds an empty monthlyHistory array when missing', () => {
    const fresh = startingState()
    const stripped = stripHistory(fresh)
    expect(
      (stripped.modules[MONTHLY_MODULE_ID] as { monthlyHistory?: unknown })
        .monthlyHistory,
    ).toBeUndefined()
    const repaired = ensureMonthlyHistoryField(stripped)
    const slice = getMonthlyModuleState(repaired)
    expect(slice.monthlyHistory).toEqual([])
  })

  it('preserves existing lastMonthlyResult exactly', () => {
    const closed = runDays(startingState(), 28)
    const closedSlice = getMonthlyModuleState(closed)
    expect(closedSlice.lastMonthlyResult).toBeDefined()

    const stripped = stripHistory(closed)
    const repaired = ensureMonthlyHistoryField(stripped)
    const slice = getMonthlyModuleState(repaired)
    expect(slice.lastMonthlyResult).toBeDefined()
    expect(slice.lastMonthlyResult!.monthKey).toBe(
      closedSlice.lastMonthlyResult!.monthKey,
    )
    expect(slice.monthlyHistory).toEqual([])
  })

  it('is idempotent — second call is a no-op', () => {
    const stripped = stripHistory(startingState())
    const first = ensureMonthlyHistoryField(stripped)
    const second = ensureMonthlyHistoryField(first)
    expect(second).toBe(first)
  })

  it('does not invent history entries — populated history passes through unchanged', () => {
    const populated = runDays(startingState(), 56)
    const populatedSlice = getMonthlyModuleState(populated)
    expect(populatedSlice.monthlyHistory.length).toBe(2)

    const passthrough = ensureMonthlyHistoryField(populated)
    expect(passthrough).toBe(populated)
    const slice = getMonthlyModuleState(passthrough)
    expect(slice.monthlyHistory.length).toBe(2)
  })

  it('handles states with no monthly module slice at all (defensive)', () => {
    const noModule: TavernState = {
      ...startingState(),
      modules: {},
    }
    const result = ensureMonthlyHistoryField(noModule)
    expect(result).toBe(noModule)
  })
})

describe('Phase 91 — Comparison data is structurally available', () => {
  it('after two months, history contains both finalized results with distinct month keys', () => {
    const state = runDays(startingState(), 56)
    const slice = getMonthlyModuleState(state)
    expect(slice.monthlyHistory.length).toBeGreaterThanOrEqual(2)
    const previous: MonthlyResult =
      slice.monthlyHistory[slice.monthlyHistory.length - 2]!
    const current: MonthlyResult =
      slice.monthlyHistory[slice.monthlyHistory.length - 1]!
    expect(previous.monthKey).not.toBe(current.monthKey)
    expect(current).toBe(slice.lastMonthlyResult)
  })
})
