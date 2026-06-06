import { describe, expect, it } from 'vitest'

import { buildDayNarrative } from '../../src/surface/dayNarrativeProjection'
import { buildDailyReport } from '../../src/reports/dailyReportProjection'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { runOneDay } from '../../src/sim/testing/simRunner'
import type { SimResult } from '../../src/sim/core/result'
import type { TavernState } from '../../src/sim/state/TavernState'

function quietResult(state: TavernState): SimResult {
  return {
    state,
    reports: [],
    logs: [],
    validation: { errors: [], warnings: [] },
    diffs: [{ boundary: 'day', changes: [], significantChanges: [] }],
  }
}

describe('buildDayNarrative', () => {
  it('keeps quiet days factual and gentle', () => {
    const state = createInitialTavernState()
    const narrative = buildDayNarrative({
      result: quietResult(state),
      state,
      closedDay: 0,
    })

    expect(narrative.movements).toHaveLength(4)
    expect(narrative.movements.every((movement) => movement.facts.length === 0)).toBe(true)
    expect(narrative.movements.every((movement) => movement.summary)).toBe(true)
  })

  it('projects a service-heavy day into service surface facts with evidence', () => {
    const initial = createInitialTavernState()
    const result = runOneDay(initial, { seed: 'tests/surface/dayNarrative.service' })
    const narrative = buildDayNarrative({
      result,
      state: result.state,
      closedDay: result.state.calendar.totalDaysElapsed - 1,
    })
    const service = narrative.movements.find((movement) => movement.id === 'service')

    expect(service).toBeDefined()
    expect(service!.facts.length).toBeGreaterThan(0)
    expect(service!.facts.every((fact) => fact.evidence.length > 0)).toBe(true)
  })

  it('projects decision-heavy days into reckoning and aftermath facts', () => {
    const base = createInitialTavernState()
    const state: TavernState = {
      ...base,
      calendar: { ...base.calendar, totalDaysElapsed: 2 },
      modules: {
        ...base.modules,
        responses: {
          resolvedToday: [
            {
              intentId: 'intent-1',
              seedId: 'seed-1',
              responseSlotId: 'slot-1',
              profileId: 'profile-1',
              verb: 'clean',
              resolvedOn: 1,
            },
          ],
        },
      },
      memories: [
        {
          id: 'memory-1',
          type: 'fact',
          label: 'regulars remember the clean-up',
          strength: 40,
          ageDays: 0,
          createdAt: { ...base.calendar, absoluteDay: 1 },
          actors: [],
          locations: [],
          relatedSystems: [],
          tags: ['test'],
        },
      ],
    }
    const result: SimResult = {
      state,
      reports: [],
      logs: [],
      validation: { errors: [], warnings: [] },
      diffs: [
        {
          boundary: 'day',
          changes: [],
          significantChanges: [
            {
              path: 'reputation.reliable',
              before: 50,
              after: 40,
              delta: -10,
              readable: 'reputation.reliable 50 → 40 (-10)',
              tags: ['reputation'],
            },
          ],
        },
      ],
    }

    const narrative = buildDayNarrative({ result, state, closedDay: 1 })
    const reckoning = narrative.movements.find((movement) => movement.id === 'reckoning')
    const aftermath = narrative.movements.find((movement) => movement.id === 'aftermath')

    expect(reckoning!.facts.some((fact) => fact.evidence[0]?.source === 'resolved_intent')).toBe(true)
    expect(reckoning!.facts.some((fact) => fact.evidence[0]?.source === 'state_diff')).toBe(true)
    expect(aftermath!.facts.some((fact) => fact.evidence[0]?.source === 'memory')).toBe(true)
  })

  it('is wired into the daily report as sim-backed experimental data', () => {
    const initial = createInitialTavernState()
    const result = runOneDay(initial, { seed: 'tests/surface/dayNarrative.report' })
    const report = buildDailyReport(result, result.state)

    expect(report.surfaceNarrative).toBeDefined()
    expect(report.surfaceNarrative!.movements).toHaveLength(4)
    for (const movement of report.surfaceNarrative!.movements) {
      for (const fact of movement.facts) {
        expect(fact.evidence.length).toBeGreaterThan(0)
      }
    }
  })
})
