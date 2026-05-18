// Phase 94 — Tests for the Tavern Log projection.
//
// Uses `runCardlessSim` to produce realistic `state.history` content,
// then asserts the projection slices, filters, and groups the entries
// per `docs/plans/phase-94-tavern-log.md`.

import { describe, expect, it } from 'vitest'

import { runCardlessSim } from '../../src/sim/testing/simRunner'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { withCoin } from '../../src/sim/testing/stateFactories'
import {
  buildTavernLog,
  HISTORY_CATEGORY_LABELS,
  TAG_FACET_LIMIT,
} from '../../src/reports/tavernLogProjection'
import { cloneTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'

const SEED_PREFIX = 'tests/reports/tavernLog'

function startingState(): TavernState {
  return withCoin(createInitialTavernState(), 500)
}

function runDays(count: number, seedSuffix = ''): TavernState {
  return runCardlessSim({
    initialState: startingState(),
    seed: `${SEED_PREFIX}.${seedSuffix}`,
    days: count,
  }).finalState
}

describe('buildTavernLog — empty / day-zero', () => {
  it('reports no_history on a fresh state', () => {
    const data = buildTavernLog(startingState())
    expect(data.totalEntries).toBe(0)
    expect(data.filteredCount).toBe(0)
    expect(data.rows.length).toBe(0)
    expect(data.groups.length).toBe(0)
    expect(data.emptyReason).toBe('no_history')
  })

  it('defaults day range to "all" on day 0 and "last_7" once past day 7', () => {
    const fresh = buildTavernLog(startingState())
    expect(fresh.appliedFilters.dayRange).toBe('all')

    const afterWeek = buildTavernLog(runDays(7, 'default-range'))
    expect(afterWeek.appliedFilters.dayRange).toBe('last_7')
  })

  it('exposes all eight category facets even when counts are zero', () => {
    const data = buildTavernLog(startingState())
    expect(data.categoryFacets.length).toBe(8)
    const ids = data.categoryFacets.map((f) => f.id)
    expect(ids).toEqual([
      'owner_action',
      'service',
      'weekly',
      'monthly',
      'state_change',
      'memory',
      'pressure',
      'system',
    ])
    for (const facet of data.categoryFacets) {
      expect(facet.label).toBe(HISTORY_CATEGORY_LABELS[facet.id])
      expect(facet.totalCount).toBe(0)
    }
  })
})

describe('buildTavernLog — after a busy week', () => {
  it('populates rows, groups, and facets', () => {
    const state = runDays(7, 'busy-week')
    expect(state.history.length).toBeGreaterThan(0)

    const data = buildTavernLog(state)
    expect(data.totalEntries).toBe(state.history.length)
    expect(data.rows.length).toBeGreaterThan(0)
    expect(data.groups.length).toBeGreaterThan(0)
    expect(data.emptyReason).toBeUndefined()
  })

  it('sorts rows newest-first across days and within a day', () => {
    const data = buildTavernLog(runDays(14, 'sort-order'))
    if (data.groups.length < 2) return
    for (let i = 1; i < data.groups.length; i += 1) {
      expect(data.groups[i - 1]!.absoluteDay).toBeGreaterThanOrEqual(
        data.groups[i]!.absoluteDay,
      )
    }
    // Group slices line up with their rows.
    for (const group of data.groups) {
      const slice = data.rows.slice(group.rowStart, group.rowEnd)
      expect(slice.length).toBe(group.rowCount)
      for (const row of slice) {
        expect(row.absoluteDay).toBe(group.absoluteDay)
      }
    }
  })

  it('day-grouping invariants hold (rowEnd-rowStart === rowCount; sum === filteredCount)', () => {
    const data = buildTavernLog(runDays(14, 'group-invariants'))
    let sum = 0
    for (const g of data.groups) {
      expect(g.rowEnd - g.rowStart).toBe(g.rowCount)
      sum += g.rowCount
    }
    expect(sum).toBe(data.filteredCount)
  })

  it('shows non-zero counts on producing categories (owner_action / service / weekly)', () => {
    const data = buildTavernLog(runDays(7, 'producer-coverage'))
    // The starter state runs a full pipeline so service entries land daily;
    // weekly close at day 7 produces 'weekly' entries; owner_action entries
    // appear when actions are applied. Service + weekly are reliable.
    const counts = Object.fromEntries(
      data.categoryFacets.map((f) => [f.id, f.totalCount]),
    )
    expect(counts.service).toBeGreaterThan(0)
    expect(counts.weekly).toBeGreaterThan(0)
  })
})

describe('buildTavernLog — filters', () => {
  it('category filter restricts rows to matching categories', () => {
    const state = runDays(14, 'category-filter')
    const data = buildTavernLog(state, { categories: ['weekly'], dayRange: 'all' })
    for (const row of data.rows) {
      expect(row.category).toBe('weekly')
    }
    expect(data.rows.length).toBeGreaterThan(0)
    expect(data.rows.length).toBeLessThan(data.totalEntries)
  })

  it('tag filter is AND across multiple tags', () => {
    const state = runDays(14, 'tag-filter-and')
    const single = buildTavernLog(state, { tags: ['wages'], dayRange: 'all' })
    for (const row of single.rows) {
      expect(row.tags).toContain('wages')
    }
    // 'paid' is a wage-paid sub-tag; the AND-pair must shrink the set.
    const both = buildTavernLog(state, { tags: ['wages', 'paid'], dayRange: 'all' })
    for (const row of both.rows) {
      expect(row.tags).toContain('wages')
      expect(row.tags).toContain('paid')
    }
    expect(both.rows.length).toBeLessThanOrEqual(single.rows.length)
  })

  it('filtered_out empty reason fires when filters reject everything', () => {
    const state = runDays(7, 'filtered-out')
    const data = buildTavernLog(state, {
      tags: ['wages', 'definitely_not_a_real_tag'],
      dayRange: 'all',
    })
    expect(data.rows.length).toBe(0)
    expect(data.totalEntries).toBeGreaterThan(0)
    expect(data.emptyReason).toBe('filtered_out')
  })

  it('day range — today — restricts to today only', () => {
    const state = runDays(7, 'day-today')
    const today = state.calendar.totalDaysElapsed
    const data = buildTavernLog(state, { dayRange: 'today' })
    for (const row of data.rows) {
      expect(row.absoluteDay).toBe(today)
    }
  })

  it('day range — last_7 — restricts to the rolling 7-day window', () => {
    const state = runDays(14, 'day-7')
    const cutoff = state.calendar.totalDaysElapsed - 7
    const data = buildTavernLog(state, { dayRange: 'last_7' })
    for (const row of data.rows) {
      expect(row.absoluteDay).toBeGreaterThanOrEqual(cutoff)
    }
  })

  it('search is case-insensitive substring on summary', () => {
    const state = runDays(14, 'search')
    const data = buildTavernLog(state, { search: 'WAGES', dayRange: 'all' })
    for (const row of data.rows) {
      expect(row.summary.toLowerCase()).toContain('wages')
    }
    // Whitespace-only search behaves like no filter on summary.
    const blank = buildTavernLog(state, { search: '   ', dayRange: 'all' })
    expect(blank.appliedFilters.search).toBe('')
    expect(blank.rows.length).toBe(blank.totalEntries) // dayRange='all' = unfiltered
  })

  it('entity filter matches by relatedActors OR relatedLocations kind+id', () => {
    const state = runDays(14, 'entity-filter')
    // Pick a staff id that appears in the log via wage entries.
    const staffIds = Object.keys(state.staff)
    expect(staffIds.length).toBeGreaterThan(0)
    let matched = false
    for (const staffId of staffIds) {
      const data = buildTavernLog(state, {
        entity: { kind: 'staff', id: staffId },
        dayRange: 'all',
      })
      if (data.rows.length === 0) continue
      for (const row of data.rows) {
        const inActors = row.actorChips.some(
          (c) => c.kind === 'staff' && c.id === staffId,
        )
        const inLocs = row.locationChips.some(
          (c) => c.kind === 'staff' && c.id === staffId,
        )
        expect(inActors || inLocs).toBe(true)
      }
      matched = true
      break
    }
    expect(matched).toBe(true)
  })

  it('multiple filters compose with AND', () => {
    const state = runDays(14, 'compose')
    const data = buildTavernLog(state, {
      categories: ['weekly'],
      tags: ['wages'],
      dayRange: 'last_28',
    })
    for (const row of data.rows) {
      expect(row.category).toBe('weekly')
      expect(row.tags).toContain('wages')
      expect(row.absoluteDay).toBeGreaterThanOrEqual(
        state.calendar.totalDaysElapsed - 28,
      )
    }
  })
})

describe('buildTavernLog — facets', () => {
  it('category facet counts reflect the UNFILTERED history', () => {
    const state = runDays(14, 'category-facets-global')
    const filtered = buildTavernLog(state, { categories: ['weekly'] })
    const unfiltered = buildTavernLog(state)
    for (let i = 0; i < filtered.categoryFacets.length; i += 1) {
      expect(filtered.categoryFacets[i]!.totalCount).toBe(
        unfiltered.categoryFacets[i]!.totalCount,
      )
    }
  })

  it('tag facets are capped at TAG_FACET_LIMIT plus active extras', () => {
    const state = runDays(14, 'tag-facet-limit')
    const data = buildTavernLog(state)
    expect(data.tagFacets.length).toBeLessThanOrEqual(TAG_FACET_LIMIT)
    // With an active tag NOT in the top-N, it should be appended.
    const obscureTag = 'unlikely_synthetic_tag_xyz'
    const withObscure = buildTavernLog(state, { tags: [obscureTag] })
    expect(withObscure.tagFacets.some((f) => f.tag === obscureTag)).toBe(true)
  })

  it('tag facets are sorted by totalCount desc then alpha', () => {
    const data = buildTavernLog(runDays(14, 'tag-sort'))
    for (let i = 1; i < data.tagFacets.length; i += 1) {
      const prev = data.tagFacets[i - 1]!
      const curr = data.tagFacets[i]!
      if (prev.totalCount === curr.totalCount) {
        expect(prev.tag.localeCompare(curr.tag)).toBeLessThanOrEqual(0)
      } else {
        expect(prev.totalCount).toBeGreaterThan(curr.totalCount)
      }
    }
  })
})

describe('buildTavernLog — row shape', () => {
  it('resolves staff entity labels via the shared resolver', () => {
    const state = runDays(7, 'label-resolve')
    const data = buildTavernLog(state, { dayRange: 'all' })
    for (const row of data.rows) {
      for (const chip of row.actorChips) {
        if (chip.kind === 'staff') {
          expect(chip.label).toBe(state.staff[chip.id]?.name.display ?? chip.id)
        }
      }
    }
  })

  it('falls back to the raw id when the entity is unknown', () => {
    const state = runDays(7, 'label-fallback-base')
    const cloned = cloneTavernState(state)
    // Append a synthetic entry whose actor refers to a missing staff id.
    cloned.history.push({
      id: 'phase94-test-row-fallback',
      timestamp: {
        year: cloned.calendar.year,
        month: cloned.calendar.month,
        week: cloned.calendar.week,
        day: cloned.calendar.day,
        absoluteDay: cloned.calendar.totalDaysElapsed,
      },
      category: 'system',
      summary: 'phase94 synthetic fallback row',
      tags: ['phase94-fallback'],
      relatedActors: [{ kind: 'staff', id: 'phantom_staff_99' }],
      relatedLocations: [],
      relatedSystems: [],
    })
    const data = buildTavernLog(cloned, {
      tags: ['phase94-fallback'],
      dayRange: 'all',
    })
    expect(data.rows.length).toBe(1)
    expect(data.rows[0]!.actorChips[0]!.label).toBe('phantom_staff_99')
  })

  it('caps actorChips and locationChips at 8 per row', () => {
    const state = runDays(7, 'chip-cap-base')
    const cloned = cloneTavernState(state)
    cloned.history.push({
      id: 'phase94-test-row-cap',
      timestamp: {
        year: cloned.calendar.year,
        month: cloned.calendar.month,
        week: cloned.calendar.week,
        day: cloned.calendar.day,
        absoluteDay: cloned.calendar.totalDaysElapsed,
      },
      category: 'system',
      summary: 'phase94 chip cap probe',
      tags: ['phase94-cap'],
      relatedActors: Array.from({ length: 15 }, (_, i) => ({
        kind: 'staff' as const,
        id: `synth_staff_${i}`,
      })),
      relatedLocations: Array.from({ length: 12 }, (_, i) => ({
        kind: 'area' as const,
        id: `synth_area_${i}`,
      })),
      relatedSystems: [],
    })
    const data = buildTavernLog(cloned, { tags: ['phase94-cap'], dayRange: 'all' })
    expect(data.rows.length).toBe(1)
    expect(data.rows[0]!.actorChips.length).toBe(8)
    expect(data.rows[0]!.locationChips.length).toBe(8)
  })
})

describe('buildTavernLog — active filter count', () => {
  it('returns 0 when no filters are non-default', () => {
    const state = runDays(7, 'active-zero')
    const data = buildTavernLog(state)
    expect(data.activeFilterCount).toBe(0)
  })

  it('counts each non-default filter once', () => {
    const state = runDays(7, 'active-many')
    const data = buildTavernLog(state, {
      categories: ['weekly'],
      tags: ['wages'],
      dayRange: 'all', // non-default on day ≥ 7
      search: 'wages',
      entity: { kind: 'staff', id: Object.keys(state.staff)[0]! },
    })
    expect(data.activeFilterCount).toBe(5)
  })

  it('does not count dayRange when it equals the default for the day', () => {
    const state = runDays(7, 'active-default-range')
    const data = buildTavernLog(state, { dayRange: 'last_7' })
    expect(data.activeFilterCount).toBe(0)
  })
})

describe('buildTavernLog — purity', () => {
  it('does not mutate state.history', () => {
    const state = runDays(14, 'no-mutation')
    const before = JSON.stringify(state.history)
    buildTavernLog(state, {
      categories: ['weekly'],
      tags: ['wages'],
      dayRange: 'last_7',
      search: 'paid',
    })
    expect(JSON.stringify(state.history)).toBe(before)
  })
})
