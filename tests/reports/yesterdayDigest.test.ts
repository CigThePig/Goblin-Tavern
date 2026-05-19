// Phase 96 — Tests for the yesterday-digest projection.
//
// The digest is a small Beat 1 surface that summarises the just-closed
// day in two lines. Tests pin:
//   - the "nothing to say" return path
//   - reputation vs. pressure picking on magnitude
//   - the tie-break (reputation wins)
//   - coin line direction routing
//   - word-budget compliance (≤ 12 words per readable)
//   - non-mutation of the input report

import { describe, expect, it } from 'vitest'

import { projectYesterdayDigest } from '../../src/reports/yesterdayDigest'
import type { DailyReportData } from '../../src/reports/types'

function baseReport(overrides: Partial<DailyReportData> = {}): DailyReportData {
  return {
    header: {
      closedDayOrdinal: 14,
      dayLabel: 'Day 14 · Week 2 · Month 1 · Market Day',
      isEndOfWeek: false,
      isEndOfMonth: false,
    },
    coinBefore: 100,
    coinAfter: 100,
    coinDelta: 0,
    reputationDeltas: [],
    topDiffs: [],
    groupedDiffs: {
      coinAndReputation: [],
      stock: [],
      pressures: [],
      areas: [],
      other: [],
    },
    ownerActionsApplied: [],
    resolvedIntents: [],
    serviceLines: [],
    risingPressures: [],
    futureHooks: [],
    isQuiet: false,
    ...overrides,
  }
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

describe('projectYesterdayDigest — empty paths', () => {
  it('returns undefined when the report is fully quiet and empty', () => {
    const report = baseReport({ isQuiet: true })
    expect(projectYesterdayDigest(report)).toBeUndefined()
  })

  it('still surfaces a digest when isQuiet but coin moved', () => {
    const report = baseReport({
      isQuiet: true,
      coinBefore: 100,
      coinAfter: 92,
      coinDelta: -8,
    })
    const digest = projectYesterdayDigest(report)
    expect(digest).toBeDefined()
    expect(digest!.coin.delta).toBe(-8)
  })
})

describe('projectYesterdayDigest — coin line', () => {
  it('routes a positive delta as gain', () => {
    const digest = projectYesterdayDigest(
      baseReport({ coinBefore: 100, coinAfter: 116, coinDelta: 16 }),
    )!
    expect(digest.coin.direction).toBe('gain')
    expect(digest.coin.readable).toContain('+16')
  })

  it('routes a negative delta as loss', () => {
    const digest = projectYesterdayDigest(
      baseReport({ coinBefore: 100, coinAfter: 88, coinDelta: -12 }),
    )!
    expect(digest.coin.direction).toBe('loss')
    expect(digest.coin.readable).toContain('-12')
  })

  it('routes a zero delta as neutral, when the report still has movers', () => {
    const digest = projectYesterdayDigest(
      baseReport({
        coinDelta: 0,
        reputationDeltas: [
          {
            axis: 'cheap',
            label: 'Cheap',
            before: 60,
            after: 62,
            delta: 2,
          },
        ],
      }),
    )!
    expect(digest.coin.direction).toBe('neutral')
  })
})

describe('projectYesterdayDigest — secondary pick', () => {
  it('picks the reputation line when only reputation moved', () => {
    const digest = projectYesterdayDigest(
      baseReport({
        coinDelta: 0,
        reputationDeltas: [
          {
            axis: 'tasty',
            label: 'Tasty',
            before: 35,
            after: 40,
            delta: 5,
          },
        ],
      }),
    )!
    expect(digest.secondary?.kind).toBe('reputation')
    if (digest.secondary?.kind === 'reputation') {
      expect(digest.secondary.label).toBe('Tasty')
      expect(digest.secondary.direction).toBe('gain')
    }
  })

  it('picks the pressure line when only pressure rose', () => {
    const digest = projectYesterdayDigest(
      baseReport({
        risingPressures: [
          {
            id: 'food_safety',
            label: 'Food Safety',
            value: 55,
            previousValue: 45,
            delta: 10,
            trend: 'rising',
            severity: 60,
            category: 'core',
            dominantCauseIds: [],
          },
        ],
      }),
    )!
    expect(digest.secondary?.kind).toBe('pressure')
    if (digest.secondary?.kind === 'pressure') {
      expect(digest.secondary.label).toBe('Food Safety')
      expect(digest.secondary.direction).toBe('loss')
    }
  })

  it('reputation wins on equal magnitude tie-break', () => {
    const digest = projectYesterdayDigest(
      baseReport({
        reputationDeltas: [
          {
            axis: 'cheap',
            label: 'Cheap',
            before: 60,
            after: 65,
            delta: 5,
          },
        ],
        risingPressures: [
          {
            id: 'pests',
            label: 'Pests',
            value: 25,
            previousValue: 20,
            delta: 5,
            trend: 'rising',
            severity: 30,
            category: 'core',
            dominantCauseIds: [],
          },
        ],
      }),
    )!
    expect(digest.secondary?.kind).toBe('reputation')
  })

  it('pressure wins when its delta strictly exceeds reputation magnitude', () => {
    const digest = projectYesterdayDigest(
      baseReport({
        reputationDeltas: [
          {
            axis: 'cheap',
            label: 'Cheap',
            before: 60,
            after: 63,
            delta: 3,
          },
        ],
        risingPressures: [
          {
            id: 'food_safety',
            label: 'Food Safety',
            value: 70,
            previousValue: 50,
            delta: 20,
            trend: 'rising',
            severity: 80,
            category: 'core',
            dominantCauseIds: [],
          },
        ],
      }),
    )!
    expect(digest.secondary?.kind).toBe('pressure')
  })

  it('absolute value of a falling reputation outranks a smaller pressure rise', () => {
    const digest = projectYesterdayDigest(
      baseReport({
        reputationDeltas: [
          {
            axis: 'filthy',
            label: 'Filthy',
            before: 60,
            after: 50,
            delta: -10,
          },
        ],
        risingPressures: [
          {
            id: 'pests',
            label: 'Pests',
            value: 40,
            previousValue: 38,
            delta: 2,
            trend: 'rising',
            severity: 40,
            category: 'core',
            dominantCauseIds: [],
          },
        ],
      }),
    )!
    expect(digest.secondary?.kind).toBe('reputation')
    if (digest.secondary?.kind === 'reputation') {
      expect(digest.secondary.direction).toBe('loss')
      expect(digest.secondary.delta).toBe(-10)
    }
  })
})

describe('projectYesterdayDigest — word budgets', () => {
  it('coin line stays under 12 words', () => {
    const digest = projectYesterdayDigest(
      baseReport({ coinBefore: 12345, coinAfter: 6789, coinDelta: -5556 }),
    )!
    expect(wordCount(digest.coin.readable)).toBeLessThanOrEqual(12)
  })

  it('reputation line stays under 12 words even with a long label', () => {
    const digest = projectYesterdayDigest(
      baseReport({
        reputationDeltas: [
          {
            axis: 'goblinAuthentic',
            label: 'Goblin-Authentic Tavern Atmosphere With Many Words',
            before: 50,
            after: 55,
            delta: 5,
          },
        ],
      }),
    )!
    expect(digest.secondary).toBeDefined()
    expect(wordCount(digest.secondary!.readable)).toBeLessThanOrEqual(12)
  })

  it('pressure line stays under 12 words', () => {
    const digest = projectYesterdayDigest(
      baseReport({
        risingPressures: [
          {
            id: 'rumour_pressure',
            label: 'Rumour Pressure From A Hostile Faction Spreading Fast',
            value: 60,
            previousValue: 30,
            delta: 30,
            trend: 'rising',
            severity: 70,
            category: 'social',
            dominantCauseIds: [],
          },
        ],
      }),
    )!
    expect(wordCount(digest.secondary!.readable)).toBeLessThanOrEqual(12)
  })
})

describe('projectYesterdayDigest — day label', () => {
  it('shortens the day label to day + day-type', () => {
    const digest = projectYesterdayDigest(baseReport())!
    expect(digest.dayLabel).toBe('Day 14 · Market Day')
  })

  it('handles a label with no separator gracefully', () => {
    const digest = projectYesterdayDigest(
      baseReport({
        header: {
          closedDayOrdinal: 1,
          dayLabel: 'Day 1',
          isEndOfWeek: false,
          isEndOfMonth: false,
        },
      }),
    )!
    expect(digest.dayLabel).toBe('Day 1')
  })
})

describe('projectYesterdayDigest — non-mutation', () => {
  it('does not mutate the input report', () => {
    const report = baseReport({
      reputationDeltas: [
        { axis: 'cheap', label: 'Cheap', before: 60, after: 64, delta: 4 },
      ],
      risingPressures: [
        {
          id: 'food_safety',
          label: 'Food Safety',
          value: 50,
          previousValue: 40,
          delta: 10,
          trend: 'rising',
          severity: 50,
          category: 'core',
          dominantCauseIds: [],
        },
      ],
    })
    const snapshot = JSON.stringify(report)
    projectYesterdayDigest(report)
    expect(JSON.stringify(report)).toBe(snapshot)
  })
})
