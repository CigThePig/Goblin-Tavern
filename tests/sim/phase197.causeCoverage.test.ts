import { describe, expect, it } from 'vitest'

import { advanceDaySegment, simulateDay } from '../../src/sim/core/engine'
import type { SimContext, SimInput } from '../../src/sim/core/context'
import type { SimulationModule } from '../../src/sim/core/module'
import type { ReportSection } from '../../src/sim/core/reports'

import { causesModule, getCausesForTarget } from '../../src/sim/modules/causes/index'
import { CAUSE_REPORT_ID } from '../../src/sim/modules/causes/causeReport'
import { canonicalCauseTarget } from '../../src/sim/modules/causes/causeTargets'
import { stockModule } from '../../src/sim/modules/stock/index'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import { withModuleState } from '../../src/sim/testing/stateFactories'
import { pathToCauseTarget } from '../../src/reports/causeLookup'
import type { LocalEventWorldState, TavernState } from '../../src/sim/state/TavernState'
import type { SimulationPhase } from '../../src/sim/core/phases'

// Phase 197 / ISSUE-164 — Cluster 4. The regression net the cause-coverage
// instrument never had: a deliberately uncaused significant mutation must
// surface as `unexplainedCount > 0` in the *live* engine report (both entry
// paths), a properly-caused mutation must surface as `0`, and caller meta
// must not clobber per-field cause targets.

const SEED = 'phase-197-cause-coverage'

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

// A throwaway module that runs an arbitrary mutation in a chosen phase. It
// lets each test plant exactly one mutation (caused or uncaused) without
// recruiting a real domain module.
function probeModule(
  phase: SimulationPhase,
  mutate: (ctx: SimContext) => void,
): SimulationModule {
  return {
    id: 'probe',
    version: '0.0.0',
    hooks: {
      [phase]: [(ctx: SimContext) => mutate(ctx)],
    },
  }
}

function causeReportFrom(reports: ReportSection[]): ReportSection {
  const section = reports.find((r) => r.id === CAUSE_REPORT_ID)
  if (!section) throw new Error('cause report section missing from result')
  return section
}

describe('Phase 197 / ISSUE-164 — cause-coverage instrument (Cluster 4)', () => {
  it('flags a deliberately uncaused significant change (simulateDay path)', () => {
    // `modifyModuleState` writes a walked slice without emitting any cause.
    // `modules.*` has no canonical cause target, so the change must land in
    // the report's unexplained list — the exact case Defect 1 silently hid.
    const probe = probeModule('endDay', (ctx) => {
      ctx.modifyModuleState<{ counter: number }>(
        'probe',
        (s) => ({ counter: (s?.counter ?? 0) + 50 }),
        // meta is required by the signature, but modifyModuleState emits no
        // cause — that is precisely the uncaused write this probe plants.
        { source: 'probe', reason: 'uncaused probe write' },
      )
    })
    const start = withModuleState(createInitialTavernState(), 'probe', {
      counter: 0,
    })

    const result = simulateDay(start, input(), [causesModule, probe])
    const report = causeReportFrom(result.reports)

    expect(report.data?.unexplainedCount as number).toBeGreaterThan(0)
    expect(report.data?.unexplainedPaths as string[]).toContain(
      'modules.probe.counter',
    )
  })

  it('reports zero unexplained for a properly-caused modifyStock change', () => {
    // The colon-convention auto-cause emitted by `modifyStock` must match
    // the colon target the matcher derives — proving emitter↔matcher
    // alignment end-to-end (Defect 2).
    const probe = probeModule('beforeService', (ctx) => {
      const ale = ctx.state.stock.ale!
      ctx.modifyStock(
        'ale',
        { quantity: ale.quantity + 40 },
        { source: 'probe', reason: 'planted restock', weight: 10 },
      )
    })

    const result = simulateDay(createInitialTavernState(), input(), [
      causesModule,
      stockModule,
      probe,
    ])
    const report = causeReportFrom(result.reports)

    expect(report.data?.unexplainedPaths as string[]).not.toContain(
      'stock.ale.quantity',
    )
    expect(report.data?.unexplainedCount as number).toBe(0)
  })

  it('emits a colon-style stock auto-cause that shares the drilldown canonical mapping', () => {
    // Secondary proof the player-facing blind spot is closed: the engine now
    // emits a colon-style target (`stock:ale.quantity`), and the drilldown's
    // `pathToCauseTarget` shares the same canonicalizer the audit uses — both
    // sides of the former dot/colon split now meet on `stock:ale`.
    const probe = probeModule('beforeService', (ctx) => {
      const ale = ctx.state.stock.ale!
      ctx.modifyStock(
        'ale',
        { quantity: ale.quantity + 40 },
        { source: 'probe', reason: 'planted restock', weight: 10 },
      )
    })

    const result = simulateDay(createInitialTavernState(), input(), [
      causesModule,
      stockModule,
      probe,
    ])

    // Acceptance criterion: one canonical mapping shared by audit + drilldown.
    expect(pathToCauseTarget('stock.ale.quantity')).toBe('stock:ale')
    expect(canonicalCauseTarget('stock.ale.quantity')).toBe('stock:ale')

    // The engine's auto-cause is colon-style and locatable by that target.
    const found = getCausesForTarget(result.state, 'stock:ale.quantity')
    expect(found.length).toBeGreaterThan(0)
    expect(found.some((c) => c.source === 'probe')).toBe(true)
    // Its field-level target sits under the drilldown's id-level target —
    // the dot/colon split that hid it from both consumers is gone.
    const idTarget = pathToCauseTarget('stock.ale.quantity')
    expect(found.every((c) => c.target.startsWith(`${idTarget}.`))).toBe(true)
  })

  it('flags the uncaused change on the segmented advanceDaySegment path', () => {
    // The full-day diff is bracketed start-of-day → end-of-segment-C via
    // `dayBaseline`, so segment C's report sees the same window simulateDay
    // does. The planted gap must surface there too.
    const probe = probeModule('endDay', (ctx) => {
      ctx.modifyModuleState<{ counter: number }>(
        'probe',
        (s) => ({ counter: (s?.counter ?? 0) + 50 }),
        { source: 'probe', reason: 'uncaused probe write' },
      )
    })
    const start = withModuleState(createInitialTavernState(), 'probe', {
      counter: 0,
    })
    const modules = [causesModule, probe]

    const a = advanceDaySegment(start, input(), modules, 'A')
    const b = advanceDaySegment(a.state, input(), modules, 'B', {
      dayBaseline: start,
    })
    const c = advanceDaySegment(b.state, input(), modules, 'C', {
      dayBaseline: start,
    })

    const report = causeReportFrom(c.reports)
    expect(report.data?.unexplainedCount as number).toBeGreaterThan(0)
    expect(report.data?.unexplainedPaths as string[]).toContain(
      'modules.probe.counter',
    )
  })

  it('keeps per-field local-event causes immune to caller meta target/amount', () => {
    // Defect 3 regression: a meta carrying `target`/`amount` must NOT
    // override the per-field diff-path target or the real delta. The cause
    // must land under `local_event:<id>.intensity` with the true +2 delta,
    // not the clobbered caller target with amount 0.
    const event: LocalEventWorldState = {
      id: 'probe_arc',
      definitionId: 'probe_def',
      label: 'Probe Arc',
      startedDay: 0,
      intensity: 3,
      relatedFactionIds: [],
      relatedCultureIds: [],
      tags: [],
      activeFlags: [],
    }
    const base = createInitialTavernState()
    const start: TavernState = {
      ...base,
      world: {
        ...base.world,
        localEvents: { ...base.world.localEvents, probe_arc: event },
      },
    }

    const probe = probeModule('localEventUpdate', (ctx) => {
      ctx.modifyLocalEvent(
        'probe_arc',
        { intensity: 5 },
        {
          source: 'probe',
          reason: 'arc progress',
          // These two are the clobber bait — they must be ignored for the
          // per-field cause.
          target: 'arc:probe_arc:day0',
          amount: 0,
        },
      )
    })

    const result = simulateDay(start, input(), [causesModule, probe])

    const perField = getCausesForTarget(result.state, 'local_event:probe_arc.intensity')
    expect(perField.length).toBe(1)
    expect(perField[0]!.amount).toBe(2)
    // The clobbered target must never have been emitted for the per-field cause.
    expect(getCausesForTarget(result.state, 'arc:probe_arc:day0')).toHaveLength(0)
  })
})
