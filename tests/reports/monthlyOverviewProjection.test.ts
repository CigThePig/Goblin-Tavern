// Phase 91 — Tests for the monthly-overview projection.
//
// Drives the simulation end-to-end via `runCardlessSim` so the projection
// runs against real `TavernState` shapes — no hand-rolled fixtures. Per
// cards-contract §1, the simulation is the source of truth; tests prove
// the projection faithfully reads it, resolves entity ids to labels,
// and computes month-over-month deltas only when history allows.

import { describe, expect, it } from 'vitest'

import { runCardlessSim } from '../../src/sim/testing/simRunner'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import { buildMonthlyOverview } from '../../src/reports/monthlyOverviewProjection'
import {
  getMonthlyModuleState,
} from '../../src/sim/modules/monthly/monthlyModule'
import { REPUTATION_AXIS_IDS } from '../../src/sim/modules/monthly/types'
import type { TavernState } from '../../src/sim/state/TavernState'
import type { LocalEventWorldState } from '../../src/sim/state/TavernState'

const SEED_PREFIX = 'tests/reports/monthlyOverview'

function startingState(): TavernState {
  // Heavy reserves + stock so the month closes cleanly (and rent
  // doesn't tank coin to zero before we test downstream sections).
  const base = withCoin(createInitialTavernState(), 50_000)
  const withAle = withStock(base, 'ale', { quantity: 5000, quality: 60 })
  const withStew = withStock(withAle, 'stew', { quantity: 5000, quality: 60 })
  return withStock(withStew, 'mushrooms', { quantity: 5000 })
}

function runDays(count: number, seedSuffix = ''): TavernState {
  const run = runCardlessSim({
    initialState: startingState(),
    seed: `${SEED_PREFIX}.${seedSuffix}`,
    days: count,
  })
  return run.finalState
}

describe('buildMonthlyOverview — empty state', () => {
  it('reports no result on day 1 of month 1', () => {
    const state = startingState()
    const data = buildMonthlyOverview(state)
    expect(data.hasResult).toBe(false)
    expect(data.empty?.reason).toBe('no_month_yet')
    expect(data.empty?.message).toMatch(/first monthly summary/i)
    expect(data.header).toBeUndefined()
    expect(data.rent).toBeUndefined()
    expect(data.reputation).toBeUndefined()
    expect(data.comparison).toBeUndefined()
  })

  it('reports no result on days 2–27 (no month has closed yet)', () => {
    const state = runDays(14, 'midmonth1')
    const data = buildMonthlyOverview(state)
    expect(data.hasResult).toBe(false)
  })
})

describe('buildMonthlyOverview — single-month shape', () => {
  it('produces a well-formed view-model after 28 days', () => {
    const state = runDays(28, 'month1')
    const data = buildMonthlyOverview(state)

    expect(data.hasResult).toBe(true)
    expect(data.header?.monthNumber).toBe(1)
    expect(data.header?.yearNumber).toBe(1)
    expect(data.header?.endDay).toBe(28)
    expect(data.header?.daysSinceClose).toBe(0)
    expect(typeof data.header?.endingCoin).toBe('number')

    expect(data.rent).toBeDefined()
    expect(typeof data.rent?.amountDue).toBe('number')
    expect(typeof data.rent?.paid).toBe('boolean')

    expect(data.landlord).toBeDefined()
    expect(typeof data.landlord?.opinionAfter).toBe('number')
    expect(typeof data.landlord?.pressureAfter).toBe('number')

    expect(data.inspection).toBeDefined()
    expect(typeof data.inspection?.suspicionAfter).toBe('number')
    expect(typeof data.inspection?.warningIssuedThisMonth).toBe('boolean')

    expect(data.rival).toBeDefined()
    expect(typeof data.rival?.pressureAfter).toBe('number')

    expect(data.economy).toBeDefined()
    expect(typeof data.economy?.net).toBe('number')

    expect(Array.isArray(data.upgrades)).toBe(true)

    expect(data.activeModifier).toBeDefined()
    expect(typeof data.activeModifier?.label).toBe('string')
    expect(data.nextMonthModifier).toBeDefined()

    expect(data.comparison).toBeUndefined()
  })

  it('header.daysSinceClose grows as days advance after the close', () => {
    const day29 = runDays(29, 'day29')
    expect(buildMonthlyOverview(day29).header?.daysSinceClose).toBe(1)

    const day42 = runDays(42, 'day42')
    expect(buildMonthlyOverview(day42).header?.daysSinceClose).toBe(14)
  })

  it('all 9 reputation axes appear once and tiers match getReputationTier', () => {
    const state = runDays(28, 'rep')
    const data = buildMonthlyOverview(state)
    expect(data.reputation).toBeDefined()
    const rows = data.reputation!.rows
    expect(rows.length).toBe(9)
    const seen = new Set(rows.map((r) => r.axisId))
    for (const axisId of REPUTATION_AXIS_IDS) {
      expect(seen.has(axisId)).toBe(true)
    }
    for (const row of rows) {
      expect(row.before).toBeGreaterThanOrEqual(0)
      expect(row.before).toBeLessThanOrEqual(100)
      expect(row.after).toBeGreaterThanOrEqual(0)
      expect(row.after).toBeLessThanOrEqual(100)
      // tierChanged flag matches the before/after tier strings.
      expect(row.tierChanged).toBe(row.tierBefore !== row.tierAfter)
      // monthOverMonthDelta absent after a single month.
      expect(row.monthOverMonthDelta).toBeUndefined()
    }
    expect(data.reputation!.hasMonthOverMonth).toBe(false)
  })

  it('reputation labels are human-readable (not raw axis ids)', () => {
    const state = runDays(28, 'replabel')
    const data = buildMonthlyOverview(state)
    const goblin = data.reputation!.rows.find(
      (r) => r.axisId === 'goblinAuthentic',
    )
    expect(goblin?.label).toBe('Goblin-Authentic')
    const cheap = data.reputation!.rows.find((r) => r.axisId === 'cheap')
    expect(cheap?.label).toBe('Cheap')
  })

  it('pressures top is sorted by value desc and capped at 5', () => {
    const state = runDays(28, 'pressures')
    const data = buildMonthlyOverview(state)
    expect(data.pressures).toBeDefined()
    expect(data.pressures!.top.length).toBeLessThanOrEqual(5)
    const values = data.pressures!.top.map((p) => p.value)
    const sorted = [...values].sort((a, b) => b - a)
    expect(values).toEqual(sorted)
    expect(typeof data.pressures!.totalActive).toBe('number')
  })

  it('customers section resolves group labels', () => {
    const state = runDays(28, 'customers')
    const data = buildMonthlyOverview(state)
    if (!data.customers) {
      // Acceptable if no best/worst group resolved this month — guard
      // the assertion so the test reports the salient cause rather than
      // a misleading undefined-field error.
      return
    }
    if (data.customers.bestGroupId) {
      expect(data.customers.bestGroupLabel).toBeDefined()
      expect(data.customers.bestGroupLabel).toBe(
        state.customerGroups[data.customers.bestGroupId]?.label,
      )
    }
    if (data.customers.worstGroupId) {
      expect(data.customers.worstGroupLabel).toBeDefined()
    }
  })

  it('arcs section omitted when no local events are active', () => {
    // A fresh day-28 state typically has no active arcs seeded yet.
    const state = runDays(28, 'no_arcs')
    const data = buildMonthlyOverview(state)
    const active = Object.values(state.world.localEvents).filter(
      (e) =>
        e.stage !== undefined && e.stage !== 'resolved' && e.stage !== 'failed',
    )
    if (active.length === 0) {
      expect(data.arcs).toBeUndefined()
    } else {
      expect(data.arcs).toBeDefined()
      expect(data.arcs!.length).toBe(active.length)
    }
  })

  it('arcs surface label + stage + age + recent history when present (synthetic)', () => {
    const base = runDays(28, 'arcs_synth')
    const synthArc: LocalEventWorldState = {
      id: 'synthetic_arc',
      definitionId: 'synthetic_def',
      label: 'A Test Arc',
      startedDay: 5,
      intensity: 40,
      relatedFactionIds: [],
      relatedCultureIds: [],
      tags: ['test'],
      activeFlags: [],
      stage: 'rising',
      lastUpdatedDay: base.calendar.totalDaysElapsed - 2,
      ageDays: base.calendar.totalDaysElapsed - 5,
      activeEffects: [],
      arcHistory: [
        { day: 5, stage: 'seeded', note: 'Arc planted.' },
        { day: 10, stage: 'rising', note: 'Tension growing.' },
        { day: 14, stage: 'rising', note: 'Tension peaks.' },
      ],
    }
    const withArc: TavernState = {
      ...base,
      world: {
        ...base.world,
        localEvents: {
          ...base.world.localEvents,
          [synthArc.id]: synthArc,
        },
      },
    }
    const data = buildMonthlyOverview(withArc)
    expect(data.arcs).toBeDefined()
    const arc = data.arcs!.find((a) => a.id === 'synthetic_arc')
    expect(arc).toBeDefined()
    expect(arc!.label).toBe('A Test Arc')
    expect(arc!.stage).toBe('rising')
    expect(arc!.ageDays).toBe(withArc.calendar.totalDaysElapsed - 5)
    // recentHistory keeps the last 2 entries.
    expect(arc!.recentHistory.length).toBe(2)
    expect(arc!.recentHistory[0]!.day).toBe(10)
    expect(arc!.recentHistory[1]!.day).toBe(14)
  })

  it('resolved and failed arcs are filtered out', () => {
    const base = runDays(28, 'arcs_filter')
    const resolved: LocalEventWorldState = {
      id: 'resolved_arc',
      definitionId: 'def',
      label: 'Done',
      startedDay: 5,
      intensity: 20,
      relatedFactionIds: [],
      relatedCultureIds: [],
      tags: [],
      activeFlags: [],
      stage: 'resolved',
    }
    const failed: LocalEventWorldState = {
      id: 'failed_arc',
      definitionId: 'def',
      label: 'Lost',
      startedDay: 5,
      intensity: 20,
      relatedFactionIds: [],
      relatedCultureIds: [],
      tags: [],
      activeFlags: [],
      stage: 'failed',
    }
    const withArcs: TavernState = {
      ...base,
      world: {
        ...base.world,
        localEvents: {
          ...base.world.localEvents,
          [resolved.id]: resolved,
          [failed.id]: failed,
        },
      },
    }
    const data = buildMonthlyOverview(withArcs)
    if (data.arcs) {
      expect(data.arcs.find((a) => a.id === 'resolved_arc')).toBeUndefined()
      expect(data.arcs.find((a) => a.id === 'failed_arc')).toBeUndefined()
    } else {
      // No active arcs found at all — both filtered ones absent vacuously.
      expect(true).toBe(true)
    }
  })

  it('strategic summary populates when result includes notes', () => {
    const state = runDays(28, 'summary')
    const data = buildMonthlyOverview(state)
    const slice = getMonthlyModuleState(state)
    const expectedLen = slice.lastMonthlyResult!.strategicSummary.length
    if (expectedLen > 0) {
      expect(data.strategicSummary).toBeDefined()
      expect(data.strategicSummary!.length).toBe(expectedLen)
    } else {
      expect(data.strategicSummary).toBeUndefined()
    }
  })

  it('modifier tags are cloned, not shared with state', () => {
    const state = runDays(28, 'mod_clone')
    const data = buildMonthlyOverview(state)
    const slice = getMonthlyModuleState(state)
    expect(data.activeModifier!.tags).not.toBe(
      slice.lastMonthlyResult!.activeModifier.tags,
    )
    expect(data.nextMonthModifier!.tags).not.toBe(
      slice.lastMonthlyResult!.nextMonthModifier.tags,
    )
  })
})

describe('buildMonthlyOverview — comparison strip', () => {
  it('is absent after a single month', () => {
    const data = buildMonthlyOverview(runDays(28, 'cmp_one'))
    expect(data.comparison).toBeUndefined()
    expect(data.reputation!.hasMonthOverMonth).toBe(false)
  })

  it('appears after two months and reports correct deltas', () => {
    const state = runDays(56, 'cmp_two')
    const data = buildMonthlyOverview(state)
    const slice = getMonthlyModuleState(state)
    const current = slice.lastMonthlyResult!
    const previous = slice.monthlyHistory[slice.monthlyHistory.length - 2]!

    expect(data.comparison).toBeDefined()
    expect(data.comparison!.previousMonthKey).toBe(previous.monthKey)
    expect(data.comparison!.endingCoinDelta).toBe(
      current.endingCoin - previous.endingCoin,
    )
    expect(data.comparison!.netDelta).toBe(
      current.economy.net - previous.economy.net,
    )
    expect(data.comparison!.landlordPressureDelta).toBe(
      current.landlord.pressureAfter - previous.landlord.pressureAfter,
    )
    expect(data.comparison!.inspectionSuspicionDelta).toBe(
      current.inspection.suspicionAfter - previous.inspection.suspicionAfter,
    )
    expect(data.comparison!.rivalPressureDelta).toBe(
      current.rivalTavern.pressureAfter - previous.rivalTavern.pressureAfter,
    )
  })

  it('per-axis reputation MoM deltas equal current.after - previous.after', () => {
    const state = runDays(56, 'cmp_rep')
    const data = buildMonthlyOverview(state)
    const slice = getMonthlyModuleState(state)
    const previous = slice.monthlyHistory[slice.monthlyHistory.length - 2]!
    const previousByAxis = new Map(
      previous.reputationShifts.map((s) => [s.axisId, s] as const),
    )

    expect(data.reputation!.hasMonthOverMonth).toBe(true)
    for (const row of data.reputation!.rows) {
      const prev = previousByAxis.get(row.axisId)
      expect(prev).toBeDefined()
      expect(row.monthOverMonthDelta).toBe(row.after - prev!.after)
    }
  })

  it('year rollover is handled correctly across Y1-M12 → Y2-M1', () => {
    // 13 months crosses Y1-M12 → Y2-M1.
    const state = runDays(28 * 13, 'cmp_year')
    const data = buildMonthlyOverview(state)
    expect(data.header?.yearNumber).toBe(2)
    expect(data.header?.monthNumber).toBe(1)
    expect(data.comparison).toBeDefined()
    expect(data.comparison!.previousMonthKey).toBe('Y1-M12')
  })
})

describe('buildMonthlyOverview — non-mutation', () => {
  it('does not mutate the state it reads', () => {
    const state = runDays(56, 'non_mutation')
    const snapshot = JSON.stringify(state)
    buildMonthlyOverview(state)
    expect(JSON.stringify(state)).toBe(snapshot)
  })
})
