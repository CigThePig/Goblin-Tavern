// Phase 89 — Tests for the daily-report projection.
//
// Drives the simulation end-to-end via `runOneDay` / `runOneWeek` so
// the projection runs against real `SimResult` and real `TavernState`
// shapes — no hand-rolled `SimResult` fixtures. Per cards-contract §1,
// the simulation is the source of truth; tests prove the projection
// faithfully reads it.

import { describe, expect, it } from 'vitest'

import { runOneDay, runOneWeek, runCardlessSim } from '../../src/sim/testing/simRunner'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { buildDailyReport } from '../../src/reports/dailyReportProjection'
import type { CardlessRunResult } from '../../src/sim/testing/simRunner'

const SEED_PREFIX = 'tests/reports/dailyReport'

function lastDay(run: CardlessRunResult) {
  const last = run.days.at(-1)
  if (!last) throw new Error('expected at least one day')
  return {
    result: last.result,
    state: last.result.state,
    previousCalendar: last.stateBefore.calendar,
  }
}

describe('buildDailyReport — shape and basics', () => {
  it('produces a well-formed view-model from a single simulated day', () => {
    const initial = createInitialTavernState()
    const result = runOneDay(initial, { seed: `${SEED_PREFIX}.shape` })
    const report = buildDailyReport(result, result.state)

    expect(report.header.closedDayOrdinal).toBe(1)
    expect(typeof report.header.dayLabel).toBe('string')
    expect(typeof report.header.isEndOfWeek).toBe('boolean')
    expect(typeof report.header.isEndOfMonth).toBe('boolean')
    expect(report.topDiffs).toBeInstanceOf(Array)
    expect(report.ownerActionsApplied).toBeInstanceOf(Array)
    expect(report.resolvedIntents).toBeInstanceOf(Array)
    expect(report.serviceLines).toBeInstanceOf(Array)
    expect(report.risingPressures).toBeInstanceOf(Array)
    expect(report.futureHooks).toBeInstanceOf(Array)
    expect(typeof report.isQuiet).toBe('boolean')
  })

  it('header reports the day-number from BEFORE advanceCalendar ran', () => {
    const initial = createInitialTavernState()
    const previousCalendar = initial.calendar
    const result = runOneDay(initial, { seed: `${SEED_PREFIX}.header` })
    const report = buildDailyReport(result, result.state, { previousCalendar })

    // Day 1 closed; state.calendar.day is now 2 (next day) but the
    // report remembers the closed day was 1.
    expect(result.state.calendar.day).toBe(2)
    expect(report.header.dayLabel).toMatch(/Day 1\b/)
    expect(report.header.isEndOfWeek).toBe(false)
    expect(report.header.isEndOfMonth).toBe(false)
  })
})

describe('buildDailyReport — coin', () => {
  it('coinDelta matches the day-boundary diff change for path === coin', () => {
    const initial = createInitialTavernState()
    const result = runOneDay(initial, { seed: `${SEED_PREFIX}.coin` })
    const report = buildDailyReport(result, result.state)
    const dayDiff = result.diffs.find((d) => d.boundary === 'day')
    const coinChange = dayDiff?.changes.find((c) => c.path === 'coin')
    if (coinChange) {
      expect(report.coinDelta).toBe(coinChange.delta ?? 0)
      expect(report.coinBefore).toBe(Number(coinChange.before))
      expect(report.coinAfter).toBe(Number(coinChange.after))
    } else {
      // No coin change crossed a threshold; projection still produces
      // a stable shape with zero delta.
      expect(report.coinDelta).toBe(0)
    }
  })
})

describe('buildDailyReport — reputation deltas', () => {
  it('extracts reputation deltas from significant changes, sorted by magnitude', () => {
    const run = runOneWeek({ seed: `${SEED_PREFIX}.rep` })
    const { state, result } = lastDay(run)
    const report = buildDailyReport(result, state)

    for (const delta of report.reputationDeltas) {
      expect(typeof delta.axis).toBe('string')
      expect(typeof delta.label).toBe('string')
      expect(Number.isFinite(delta.before)).toBe(true)
      expect(Number.isFinite(delta.after)).toBe(true)
      expect(delta.delta).toBe(delta.after - delta.before)
    }

    for (let i = 1; i < report.reputationDeltas.length; i += 1) {
      const prev = report.reputationDeltas[i - 1]!
      const cur = report.reputationDeltas[i]!
      expect(Math.abs(prev.delta)).toBeGreaterThanOrEqual(Math.abs(cur.delta))
    }
  })
})

describe('buildDailyReport — top diffs', () => {
  it('top diffs are sorted by absolute delta and capped at 8', () => {
    const run = runOneWeek({ seed: `${SEED_PREFIX}.topdiffs` })
    const { state, result } = lastDay(run)
    const report = buildDailyReport(result, state)

    expect(report.topDiffs.length).toBeLessThanOrEqual(8)
    for (let i = 1; i < report.topDiffs.length; i += 1) {
      const prev = report.topDiffs[i - 1]!
      const cur = report.topDiffs[i]!
      expect(Math.abs(prev.delta)).toBeGreaterThanOrEqual(Math.abs(cur.delta))
    }
  })
})

describe('buildDailyReport — rising pressures', () => {
  it('filters rising pressures to delta > 0 and value >= 25, sorted by severity*delta', () => {
    const run = runOneWeek({ seed: `${SEED_PREFIX}.pressures` })
    const { state, result } = lastDay(run)
    const report = buildDailyReport(result, state)

    for (const p of report.risingPressures) {
      expect(p.delta).toBeGreaterThan(0)
      expect(p.value).toBeGreaterThanOrEqual(25)
    }
    for (let i = 1; i < report.risingPressures.length; i += 1) {
      const prev = report.risingPressures[i - 1]!
      const cur = report.risingPressures[i]!
      expect(prev.severity * prev.delta).toBeGreaterThanOrEqual(cur.severity * cur.delta)
    }
    expect(report.risingPressures.length).toBeLessThanOrEqual(5)
  })
})

describe('buildDailyReport — future hooks', () => {
  it('returns only memories of type future_hook stamped on the just-closed day', () => {
    const run = runOneWeek({ seed: `${SEED_PREFIX}.hooks` })
    const { state, result } = lastDay(run)
    const report = buildDailyReport(result, state)

    const closedDay = state.calendar.totalDaysElapsed - 1
    for (const hook of report.futureHooks) {
      const memory = state.memories.find((m) => m.id === hook.memoryId)
      expect(memory).toBeDefined()
      expect(memory!.type).toBe('future_hook')
      expect(memory!.createdAt.absoluteDay).toBe(closedDay)
    }
  })
})

describe('buildDailyReport — digests', () => {
  it('weeklyDigest is undefined on day 1', () => {
    const initial = createInitialTavernState()
    const result = runOneDay(initial, { seed: `${SEED_PREFIX}.weekly-day1` })
    const report = buildDailyReport(result, result.state)
    expect(report.weeklyDigest).toBeUndefined()
    expect(report.header.isEndOfWeek).toBe(false)
  })

  it('weeklyDigest is present on day 7 (last day of week)', () => {
    const run = runOneWeek({ seed: `${SEED_PREFIX}.weekly` })
    const { state, result, previousCalendar } = lastDay(run)
    const report = buildDailyReport(result, state, { previousCalendar })

    expect(report.header.isEndOfWeek).toBe(true)
    expect(report.weeklyDigest).toBeDefined()
    expect(report.weeklyDigest!.id).toBe('weekly')
    expect(report.weeklyDigest!.lines).toBeInstanceOf(Array)
    expect(report.weeklyDigest!.lines.length).toBeGreaterThan(0)
  })

  it('monthlyDigest is present on the last day of the month', () => {
    // Day 28 closes the month. Run 28 days and inspect the final report.
    const run = runCardlessSim({ seed: `${SEED_PREFIX}.monthly`, days: 28 })
    const { state, result, previousCalendar } = lastDay(run)
    const report = buildDailyReport(result, state, { previousCalendar })

    expect(report.header.isEndOfMonth).toBe(true)
    expect(report.monthlyDigest).toBeDefined()
    expect(report.monthlyDigest!.id).toBe('monthly')
  })
})

describe('buildDailyReport — owner actions', () => {
  it('reflects an applied owner action when one is fed in', () => {
    const state = createInitialTavernState()
    const result = runOneDay(state, {
      seed: `${SEED_PREFIX}.owner-actions`,
      ownerActions: [{ actionId: 'clean_area', targetId: 'main_room' }],
    })
    const report = buildDailyReport(result, result.state)
    expect(report.ownerActionsApplied.some((a) => a.actionId === 'clean_area')).toBe(
      true,
    )
  })
})

describe('buildDailyReport — purity', () => {
  it('does not mutate the inputs', () => {
    const run = runOneWeek({ seed: `${SEED_PREFIX}.purity` })
    const { state, result } = lastDay(run)
    const stateBefore = JSON.stringify(state)
    const resultBefore = JSON.stringify(result)
    buildDailyReport(result, state)
    expect(JSON.stringify(state)).toBe(stateBefore)
    expect(JSON.stringify(result)).toBe(resultBefore)
  })
})
