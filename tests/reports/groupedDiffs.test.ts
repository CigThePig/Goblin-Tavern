// Phase 118 / ISSUE-079 — Tests for the grouped-diffs projection.
//
// `projectGroupedDiffs` is not exported directly; we drive it through
// `buildDailyReport()` with hand-crafted SimResult/TavernState
// fixtures so we can exercise classifier branches and caps without
// running a full sim day. The classifier itself reads path-prefixes
// only, so a minimal SimResult shape is sufficient.

import { describe, expect, it } from 'vitest'

import { buildDailyReport } from '../../src/reports/dailyReportProjection'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { SimResult } from '../../src/sim/core/result'
import type { TavernState } from '../../src/sim/state/TavernState'
import type { StateChange } from '../../src/sim/core/diff'

function makeChange(
  path: string,
  before: number,
  after: number,
  tags: string[] = [],
): StateChange {
  return {
    path,
    before,
    after,
    delta: after - before,
    readable: `${path} ${before} → ${after} (${after - before >= 0 ? '+' : ''}${after - before})`,
    tags,
  }
}

function makeResultWithDayChanges(changes: StateChange[], state: TavernState): SimResult {
  return {
    state,
    diffs: [
      {
        boundary: 'day',
        changes,
        significantChanges: changes,
      },
    ],
    reports: [],
    issueSeeds: [],
    debug: undefined,
  } as unknown as SimResult
}

describe('projectGroupedDiffs — Phase 118', () => {
  const baseState = createInitialTavernState()

  it('classifies coin into coinAndReputation', () => {
    const result = makeResultWithDayChanges([makeChange('coin', 100, 150)], baseState)
    const report = buildDailyReport(result, baseState)
    expect(report.groupedDiffs.coinAndReputation.map((d) => d.path)).toEqual(['coin'])
  })

  it('classifies reputation.<axis> into coinAndReputation', () => {
    const result = makeResultWithDayChanges(
      [makeChange('reputation.tasty', 0, 5)],
      baseState,
    )
    const report = buildDailyReport(result, baseState)
    expect(report.groupedDiffs.coinAndReputation.map((d) => d.path)).toEqual([
      'reputation.tasty',
    ])
  })

  it('classifies stock.<id>.quantity into stock', () => {
    const result = makeResultWithDayChanges(
      [makeChange('stock.ale.quantity', 80, 0)],
      baseState,
    )
    const report = buildDailyReport(result, baseState)
    expect(report.groupedDiffs.stock.map((d) => d.path)).toEqual([
      'stock.ale.quantity',
    ])
  })

  it('classifies pressures.<id>.value into pressures', () => {
    const result = makeResultWithDayChanges(
      [makeChange('pressures.staff_loyalty_risk.value', 0, 75)],
      baseState,
    )
    const report = buildDailyReport(result, baseState)
    expect(report.groupedDiffs.pressures.map((d) => d.path)).toEqual([
      'pressures.staff_loyalty_risk.value',
    ])
  })

  it('classifies areas.<id>.<field> into areas', () => {
    const result = makeResultWithDayChanges(
      [makeChange('areas.main_room.cleanliness', 100, 70)],
      baseState,
    )
    const report = buildDailyReport(result, baseState)
    expect(report.groupedDiffs.areas.map((d) => d.path)).toEqual([
      'areas.main_room.cleanliness',
    ])
  })

  it('sorts each group by |delta| desc', () => {
    const result = makeResultWithDayChanges(
      [
        makeChange('stock.ale.quantity', 50, 45), // -5
        makeChange('stock.bread.quantity', 100, 20), // -80
        makeChange('stock.firewood.quantity', 30, 25), // -5
        makeChange('stock.mushrooms.quantity', 0, 40), // +40
      ],
      baseState,
    )
    const report = buildDailyReport(result, baseState)
    expect(report.groupedDiffs.stock.map((d) => d.path)).toEqual([
      'stock.bread.quantity',
      'stock.mushrooms.quantity',
      'stock.ale.quantity',
      'stock.firewood.quantity',
    ])
  })

  it('respects per-group cap of 4', () => {
    const changes: StateChange[] = []
    for (let i = 0; i < 8; i++) {
      changes.push(makeChange(`stock.item${i}.quantity`, 100, 100 - (i + 1) * 10))
    }
    const result = makeResultWithDayChanges(changes, baseState)
    const report = buildDailyReport(result, baseState)
    expect(report.groupedDiffs.stock.length).toBe(4)
  })

  it('enforces overall cap of 12 by trimming smallest-delta tails', () => {
    // 4 of each group × 4 groups = 16 → trim down to 12.
    // The weakest deltas (smallest abs) should be removed first.
    const changes: StateChange[] = []
    // coin & rep: deltas 100, 80, 60, 40
    changes.push(makeChange('coin', 0, 100))
    changes.push(makeChange('reputation.tasty', 0, 80))
    changes.push(makeChange('reputation.cozy', 0, 60))
    changes.push(makeChange('reputation.cheap', 0, 40))
    // stock: deltas 90, 70, 50, 30
    changes.push(makeChange('stock.a.quantity', 0, 90))
    changes.push(makeChange('stock.b.quantity', 0, 70))
    changes.push(makeChange('stock.c.quantity', 0, 50))
    changes.push(makeChange('stock.d.quantity', 0, 30))
    // pressures: deltas 85, 65, 45, 25
    changes.push(makeChange('pressures.a.value', 0, 85))
    changes.push(makeChange('pressures.b.value', 0, 65))
    changes.push(makeChange('pressures.c.value', 0, 45))
    changes.push(makeChange('pressures.d.value', 0, 25))
    // areas: deltas 75, 55, 35, 15
    changes.push(makeChange('areas.a.cleanliness', 100, 25))
    changes.push(makeChange('areas.b.cleanliness', 100, 45))
    changes.push(makeChange('areas.c.cleanliness', 100, 65))
    changes.push(makeChange('areas.d.cleanliness', 100, 85))

    const result = makeResultWithDayChanges(changes, baseState)
    const report = buildDailyReport(result, baseState)

    const total =
      report.groupedDiffs.coinAndReputation.length +
      report.groupedDiffs.stock.length +
      report.groupedDiffs.pressures.length +
      report.groupedDiffs.areas.length
    expect(total).toBe(12)
    // The weakest 4 across all groups should be the trimmed ones —
    // those with smallest absolute deltas.
    const allDeltas = [
      ...report.groupedDiffs.coinAndReputation,
      ...report.groupedDiffs.stock,
      ...report.groupedDiffs.pressures,
      ...report.groupedDiffs.areas,
    ].map((d) => Math.abs(d.delta))
    // All retained deltas should be ≥ the smallest retained one,
    // and the smallest dropped (15) should not appear.
    expect(allDeltas).not.toContain(15)
  })

  it('groups are present even when empty', () => {
    const result = makeResultWithDayChanges([makeChange('coin', 0, 10)], baseState)
    const report = buildDailyReport(result, baseState)
    expect(Array.isArray(report.groupedDiffs.coinAndReputation)).toBe(true)
    expect(Array.isArray(report.groupedDiffs.stock)).toBe(true)
    expect(Array.isArray(report.groupedDiffs.pressures)).toBe(true)
    expect(Array.isArray(report.groupedDiffs.areas)).toBe(true)
    expect(Array.isArray(report.groupedDiffs.other)).toBe(true)
    expect(report.groupedDiffs.stock).toEqual([])
    expect(report.groupedDiffs.pressures).toEqual([])
    expect(report.groupedDiffs.areas).toEqual([])
    expect(report.groupedDiffs.other).toEqual([])
  })

  it('each grouped line carries a populated humanReadable', () => {
    const result = makeResultWithDayChanges(
      [
        makeChange('coin', 100, 200),
        makeChange('stock.ale.quantity', 80, 0),
        makeChange('pressures.staff_loyalty_risk.value', 0, 75),
        makeChange('areas.main_room.cleanliness', 100, 70),
      ],
      baseState,
    )
    const report = buildDailyReport(result, baseState)
    const all = [
      ...report.groupedDiffs.coinAndReputation,
      ...report.groupedDiffs.stock,
      ...report.groupedDiffs.pressures,
      ...report.groupedDiffs.areas,
    ]
    expect(all.length).toBe(4)
    for (const line of all) {
      expect(line.humanReadable.length).toBeGreaterThan(0)
      // The humanReadable string should never leak the raw path.
      expect(line.humanReadable).not.toContain(line.path)
    }
  })

  it('routes unrecognised paths into the `other` bucket', () => {
    const result = makeResultWithDayChanges(
      [
        makeChange('coin', 0, 50),
        makeChange('staff.s1.morale', 80, 60),
      ],
      baseState,
    )
    const report = buildDailyReport(result, baseState)
    // coin lands in coinAndReputation; the unmapped staff path now
    // surfaces in `other` instead of being silently dropped.
    expect(report.groupedDiffs.coinAndReputation.map((d) => d.path)).toEqual(['coin'])
    expect(report.groupedDiffs.stock.length).toBe(0)
    expect(report.groupedDiffs.pressures.length).toBe(0)
    expect(report.groupedDiffs.areas.length).toBe(0)
    expect(report.groupedDiffs.other.map((d) => d.path)).toEqual(['staff.s1.morale'])
    // Flat topDiffs still surfaces both
    expect(report.topDiffs.length).toBe(2)
  })

  it('collects staff / customers / recipes / world paths into `other` with humanized labels', () => {
    const result = makeResultWithDayChanges(
      [
        makeChange('staff.s1.morale', 80, 50),
        makeChange('customers.locals.sentiment', 60, 80),
        makeChange('recipes.stew.onMenu', 0, 1),
        makeChange('factions.tinkers_guild.standing', 0, -20),
      ],
      baseState,
    )
    const report = buildDailyReport(result, baseState)
    const paths = report.groupedDiffs.other.map((d) => d.path).sort()
    expect(paths).toEqual(
      [
        'customers.locals.sentiment',
        'factions.tinkers_guild.standing',
        'recipes.stew.onMenu',
        'staff.s1.morale',
      ].sort(),
    )
    for (const line of report.groupedDiffs.other) {
      expect(line.humanReadable.length).toBeGreaterThan(0)
    }
  })
})
