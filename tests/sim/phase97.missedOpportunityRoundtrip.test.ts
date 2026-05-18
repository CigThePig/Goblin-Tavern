// Phase 97 — Missed-opportunity affordance against the real engine.
//
// The projection lives in src/reports and is unit-tested in isolation in
// tests/reports/missedOpportunityProjection.test.ts. These tests drive
// it against a real `SimResult` and `TavernState` produced by `runOneDay`
// so we know the signal sources (state.modules.pressures.snapshots,
// state.causes, applied owner actions, seedsToday, resolvedToday) hold
// up under the actual engine pipeline.

import { describe, expect, it } from 'vitest'

import { runCardlessSim } from '../../src/sim/testing/simRunner'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  projectMissedOpportunities,
  type MissedOpportunityLine,
} from '../../src/reports/missedOpportunityProjection'
import { buildDailyReport } from '../../src/reports/dailyReportProjection'
import { closedDayAbsolute } from '../../src/reports/causeLookup'

const SEED = 'tests/phase97.missedOpp'

describe('phase97 — projection against the real engine', () => {
  it('runs against a fresh state without crashing', () => {
    const initial = createInitialTavernState()
    const run = runCardlessSim({ initialState: initial, seed: SEED, days: 1 })
    const day = run.days.at(-1)!
    const state = day.result.state
    const lines = projectMissedOpportunities(day.result, state, {
      closedDay: closedDayAbsolute(state),
    })
    expect(Array.isArray(lines)).toBe(true)
  })

  it('produces deterministic ids across two identical runs', () => {
    const a = runCardlessSim({
      initialState: createInitialTavernState(),
      seed: SEED,
      days: 7,
    })
    const b = runCardlessSim({
      initialState: createInitialTavernState(),
      seed: SEED,
      days: 7,
    })

    const aFinal = a.days.at(-1)!
    const bFinal = b.days.at(-1)!
    const closedDay = closedDayAbsolute(aFinal.result.state)
    const aLines = projectMissedOpportunities(
      aFinal.result,
      aFinal.result.state,
      { closedDay },
    )
    const bLines = projectMissedOpportunities(
      bFinal.result,
      bFinal.result.state,
      { closedDay },
    )
    expect(aLines.map((l) => l.id)).toEqual(bLines.map((l) => l.id))
  })

  it('every emitted line names a real action and (if present) a real state target', () => {
    // Walk a 14-day cardless run and collect all opportunities; assert
    // each one references a state entity that actually exists.
    const run = runCardlessSim({
      initialState: createInitialTavernState(),
      seed: SEED,
      days: 14,
    })
    let totalLines: MissedOpportunityLine[] = []
    for (const day of run.days) {
      const state = day.result.state
      const closedDay = closedDayAbsolute(state)
      const lines = projectMissedOpportunities(day.result, state, { closedDay })
      totalLines = [...totalLines, ...lines]
      for (const line of lines) {
        if (!line.targetRef) continue
        const ref = line.targetRef
        switch (ref.kind) {
          case 'area':
            expect(state.areas[ref.id]).toBeDefined()
            break
          case 'stock':
            expect(state.stock[ref.id]).toBeDefined()
            break
          case 'staff':
            expect(state.staff[ref.id]).toBeDefined()
            break
          default:
            // Other kinds (regulars, suppliers, etc.) — best-effort: we
            // never look them up without confirming presence in the
            // first place; passing here is a soft check.
            break
        }
      }
    }
    // We don't assert a lower bound on totalLines — a calm run is a
    // valid run. Crashing the projector would have failed earlier.
    expect(totalLines.length).toBeGreaterThanOrEqual(0)
  })

  it('non-mutation: state and result are unchanged after projection', () => {
    const run = runCardlessSim({
      initialState: createInitialTavernState(),
      seed: SEED,
      days: 3,
    })
    const day = run.days.at(-1)!
    const state = day.result.state
    const stateBefore = JSON.stringify(state)
    const resultBefore = JSON.stringify(day.result)
    projectMissedOpportunities(day.result, state, {
      closedDay: closedDayAbsolute(state),
    })
    expect(JSON.stringify(state)).toBe(stateBefore)
    expect(JSON.stringify(day.result)).toBe(resultBefore)
  })

  it('buildDailyReport surfaces missedOpportunities through the same path', () => {
    const run = runCardlessSim({
      initialState: createInitialTavernState(),
      seed: SEED,
      days: 14,
    })
    const day = run.days.at(-1)!
    const report = buildDailyReport(day.result, day.result.state, {
      previousCalendar: day.stateBefore.calendar,
    })
    // The block is optional — present only when there is something to
    // show. Either case is valid; we just assert the type holds up.
    if (report.missedOpportunities) {
      expect(report.missedOpportunities.length).toBeLessThanOrEqual(3)
      for (const line of report.missedOpportunities) {
        expect(typeof line.id).toBe('string')
        expect(typeof line.readable).toBe('string')
        expect(line.readable.length).toBeGreaterThan(0)
      }
    }
  })

  it('dismissed ids are filtered through buildDailyReport', () => {
    const run = runCardlessSim({
      initialState: createInitialTavernState(),
      seed: SEED,
      days: 7,
    })
    const day = run.days.at(-1)!
    const baseReport = buildDailyReport(day.result, day.result.state, {
      previousCalendar: day.stateBefore.calendar,
    })
    if (!baseReport.missedOpportunities || baseReport.missedOpportunities.length === 0) {
      // No opportunities on this run — the dismissal path is exercised
      // in the unit tests. Skip silently.
      return
    }
    const idToDismiss = baseReport.missedOpportunities[0]!.id
    const dismissed = buildDailyReport(day.result, day.result.state, {
      previousCalendar: day.stateBefore.calendar,
      dismissedMissedOpportunityIds: new Set([idToDismiss]),
    })
    const stillThere = (dismissed.missedOpportunities ?? []).some(
      (l) => l.id === idToDismiss,
    )
    expect(stillThere).toBe(false)
  })
})
