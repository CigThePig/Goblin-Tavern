import { describe, it, expect } from 'vitest'

// Phase 186 (Cluster 2) — Segmented engine entry + full-day diff thread.
//
// The day-clock contract (§4.2) splits the pipeline into three segments
// bracketed by the two player-input phases, exposed via `advanceDaySegment`.
// `simulateDay` stays the run-all-segments path. The load-bearing invariant
// is that running the three segments in order produces *identical* final
// state to one `simulateDay` call (RNG sub-seeds + resumable cause/history
// numbering make this hold), and that the final segment carries the single
// full-day diff GATE B's report consumers read.

import {
  simulateDay,
  advanceDaySegment,
} from '../../src/sim/core/engine'
import {
  DAY_SEGMENTS,
  phasesForSegment,
  segmentForPhase,
  segmentSeed,
} from '../../src/sim/core/segments'
import { SIMULATION_PHASES } from '../../src/sim/core/phases'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { getIssueSeeds } from '../../src/sim/modules/issues/index'
import type { SimInput } from '../../src/sim/core/context'
import type { SimResult } from '../../src/sim/core/result'
import type { ResponseIntent } from '../../src/sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../src/sim/state/TavernState'

const SEED = 'segmented-engine'

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

/** Run the day one segment at a time, threading the start-of-day baseline
 *  so the full-day diff (GATE B) is bracketed start-of-day → end-of-day. */
function runSegmented(
  state: TavernState,
  inp: SimInput,
  modules = FULL_PIPELINE,
): { a: SimResult; b: SimResult; c: SimResult } {
  const a = advanceDaySegment(state, inp, modules, 'A')
  const b = advanceDaySegment(a.state, inp, modules, 'B', { dayBaseline: state })
  const c = advanceDaySegment(b.state, inp, modules, 'C', { dayBaseline: state })
  return { a, b, c }
}

function plentyOfStock(state: TavernState): TavernState {
  return {
    ...state,
    stock: {
      ...state.stock,
      ale: { ...state.stock.ale!, quantity: 800, quality: 60 },
      stew: { ...state.stock.stew!, quantity: 400, quality: 60 },
      mushrooms: { ...state.stock.mushrooms!, quantity: 200 },
    },
  }
}

/** Advance `days` whole days via the canonical run-all path. */
function advanceDays(state: TavernState, days: number, seed = SEED): TavernState {
  let current = state
  for (let i = 0; i < days; i += 1) {
    current = simulateDay(
      current,
      { seed: `${seed}-warm-${i}` },
      FULL_PIPELINE,
    ).state
  }
  return current
}

describe('Phase 186 (Cluster 2) — segment partition', () => {
  it('partitions every canonical phase into exactly one ordered segment', () => {
    const recombined = DAY_SEGMENTS.flatMap((s) => [...phasesForSegment(s)])
    expect(recombined).toEqual([...SIMULATION_PHASES])
  })

  it('opens segments on the two player-input seams', () => {
    expect(phasesForSegment('A')[0]).toBe('startDay')
    expect(phasesForSegment('B')[0]).toBe('beforeOwnerActions')
    expect(phasesForSegment('C')[0]).toBe('applyResponses')
    // The two pauses map onto the two input phases.
    expect(segmentForPhase('applyOwnerActions')).toBe('B')
    expect(segmentForPhase('applyResponses')).toBe('C')
    expect(segmentForPhase('service')).toBe('B')
    expect(segmentForPhase('forecastTraffic')).toBe('A')
  })

  it('derives per-segment sub-seeds, leaving Segment A on the per-day seed', () => {
    expect(segmentSeed('s', 'A')).toBe('s')
    expect(segmentSeed('s', 'B')).toBe('s:seg-B')
    expect(segmentSeed('s', 'C')).toBe('s:seg-C')
  })
})

describe('Phase 186 (Cluster 2) — segmented run equals simulateDay', () => {
  it('produces identical final state and full-day diff (quiet day)', () => {
    const base = plentyOfStock(createInitialTavernState())
    const all = simulateDay(base, input(), FULL_PIPELINE)
    const { c } = runSegmented(base, input())

    expect(c.state).toEqual(all.state)

    const segDayDiff = c.diffs.find((d) => d.boundary === 'day')
    const allDayDiff = all.diffs.find((d) => d.boundary === 'day')
    expect(segDayDiff).toBeDefined()
    expect(segDayDiff).toEqual(allDayDiff)
  })

  it('produces identical final state with owner actions + staff priorities', () => {
    const base = plentyOfStock(createInitialTavernState())
    const inp = input({
      ownerActions: [{ actionId: 'water_down_ale' }, { actionId: 'clean_area', targetId: 'kitchen' }],
      staffPriorities: {},
    })
    const all = simulateDay(base, inp, FULL_PIPELINE)
    const { c } = runSegmented(base, inp)
    expect(c.state).toEqual(all.state)
  })

  it('produces identical final state mid-run (after several days)', () => {
    const base = advanceDays(plentyOfStock(createInitialTavernState()), 3)
    const all = simulateDay(base, input(), FULL_PIPELINE)
    const { c } = runSegmented(base, input())
    expect(c.state).toEqual(all.state)
  })

  it('produces identical final state on a week-closing day', () => {
    // Day 7 is the first end-of-week; Segment C runs the endWeek pass.
    const base = advanceDays(plentyOfStock(createInitialTavernState()), 6)
    expect(base.calendar.totalDaysElapsed).toBe(6)
    const all = simulateDay(base, input(), FULL_PIPELINE)
    const { c } = runSegmented(base, input())
    expect(c.state).toEqual(all.state)
  })

  it('produces identical final state on a month-closing day', () => {
    // Day 28 is the first end-of-month; Segment C runs endWeek + endMonth.
    const base = advanceDays(plentyOfStock(createInitialTavernState()), 27)
    expect(base.calendar.totalDaysElapsed).toBe(27)
    const all = simulateDay(base, input(), FULL_PIPELINE)
    const { c } = runSegmented(base, input())
    expect(c.state).toEqual(all.state)
  })
})

describe('Phase 186 (Cluster 2) — GATE B: single full-day diff', () => {
  it('Segment C carries the full start-of-day → end-of-day diff', () => {
    const base = plentyOfStock(createInitialTavernState())
    const inp = input({ ownerActions: [{ actionId: 'water_down_ale' }] })
    const all = simulateDay(base, inp, FULL_PIPELINE)
    const { a, b, c } = runSegmented(base, inp)

    // Each segment tags its diff 'day' (no other boundary survives).
    for (const r of [a, b, c]) {
      expect(r.diffs.map((d) => d.boundary)).toEqual(['day'])
    }

    // The ale-quality drop is applied in Segment B (applyOwnerActions) and
    // must still be visible from the *start-of-day* baseline in Segment C's
    // full-day diff — not shattered into a Segment-B-only fragment.
    const cDay = c.diffs.find((d) => d.boundary === 'day')!
    const aleQuality = cDay.changes.find((ch) => ch.path === 'stock.ale.quality')
    expect(aleQuality).toBeDefined()
    expect(aleQuality!.delta).toBeLessThan(0)

    // And it matches what the run-all path reports.
    const allDay = all.diffs.find((d) => d.boundary === 'day')!
    expect(cDay).toEqual(allDay)
  })

  it('Segment A diff covers only the morning, not the whole day', () => {
    const base = plentyOfStock(createInitialTavernState())
    const inp = input({ ownerActions: [{ actionId: 'water_down_ale' }] })
    const { a } = runSegmented(base, inp)
    const aDay = a.diffs.find((d) => d.boundary === 'day')!
    // The owner action runs in Segment B, so the ale-quality move cannot
    // appear in Segment A's (partial, honestly-bracketed) diff.
    expect(aDay.changes.find((ch) => ch.path === 'stock.ale.quality')).toBeUndefined()
  })
})

describe('Phase 186 (Cluster 2) — same-day cross-segment response resolution', () => {
  // A morning (`food_safety`) seed is generated in Segment A; a response to
  // it is consumed in Segment C (applyResponses). The segmented run must
  // resolve it identically to one `simulateDay` call — the §4.1 "same-day
  // multi-pass" check, here spanning two separate segment runs.
  function setupFoodSafetyDay(): { warmState: TavernState; seed: ReturnType<typeof getIssueSeeds>[number] } {
    let base = plentyOfStock(createInitialTavernState())
    base = {
      ...base,
      areas: { ...base.areas, kitchen: { ...base.areas.kitchen!, cleanliness: 10, smell: 80 } },
      stock: {
        ...base.stock,
        mushrooms: { ...base.stock.mushrooms!, spoilage: 90 },
        stew: { ...base.stock.stew!, spoilage: 80, quantity: 400 },
      },
    }
    const warm = simulateDay(base, input(), FULL_PIPELINE)
    const probe = simulateDay(warm.state, input(), FULL_PIPELINE)
    const seed = getIssueSeeds(probe.state, { family: 'food_safety' })[0]
    if (!seed) throw new Error('test setup failed: no food_safety seed generated')
    return { warmState: warm.state, seed }
  }

  it('resolves a Segment-A seed via a Segment-C response, identically to simulateDay', () => {
    const { warmState, seed } = setupFoodSafetyDay()
    const intent: ResponseIntent = {
      id: 'r-clean',
      seedId: seed.id,
      verb: 'clean',
      shape: 'long_term_investment',
      tags: [],
      intensity: 50,
      metadata: { responseSlotId: 'clean_kitchen' },
    }
    const inp = input({ responseIntents: [intent] })

    const all = simulateDay(warmState, inp, FULL_PIPELINE)
    const { b, c } = runSegmented(warmState, inp)

    // The seed exists in state by the end of Segment A/B, before the
    // Segment-C response consumes it.
    expect(getIssueSeeds(b.state, { family: 'food_safety' }).some((s) => s.id === seed.id)).toBe(true)

    // Final state matches the run-all path — the response resolved the
    // same way across the two-pass segment run.
    expect(c.state).toEqual(all.state)

    // And the response actually fired (cleaning raised kitchen cleanliness
    // vs a no-response segmented run).
    const noResp = runSegmented(warmState, input())
    expect(c.state.areas.kitchen!.cleanliness).toBeGreaterThan(
      noResp.c.state.areas.kitchen!.cleanliness,
    )
  })
})

describe('Phase 186 (Cluster 2) — checkpoints are serializable & deterministic', () => {
  it('every segment checkpoint survives a JSON round-trip unchanged', () => {
    const base = plentyOfStock(createInitialTavernState())
    const { a, b, c } = runSegmented(base, input())
    for (const r of [a, b, c]) {
      expect(JSON.parse(JSON.stringify(r.state))).toEqual(r.state)
    }
  })

  it('re-running a segment from the same checkpoint is identical (no RNG serialization needed)', () => {
    const base = plentyOfStock(createInitialTavernState())
    const a1 = advanceDaySegment(base, input(), FULL_PIPELINE, 'A')
    const a2 = advanceDaySegment(base, input(), FULL_PIPELINE, 'A')
    expect(a2.state).toEqual(a1.state)

    const b1 = advanceDaySegment(a1.state, input(), FULL_PIPELINE, 'B', { dayBaseline: base })
    const b2 = advanceDaySegment(a1.state, input(), FULL_PIPELINE, 'B', { dayBaseline: base })
    expect(b2.state).toEqual(b1.state)
  })
})
