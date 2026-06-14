import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import type { TavernState } from '../../src/sim/state/TavernState'
import {
  OPENINGS_MODULE_ID,
  readOpeningMeters,
  type OpeningsModuleState,
} from '../../src/sim/modules/openings'

const SEED = 'teleology-phase-2-heavy'

function run(state: TavernState, extra = {}) {
  return simulateDay(state, { seed: SEED, ...extra }, FULL_PIPELINE)
}

function openings(state: TavernState): OpeningsModuleState {
  return state.modules[OPENINGS_MODULE_ID] as OpeningsModuleState
}

function teleologyCauses(state: TavernState) {
  return state.causes.filter((c) => c.tags.includes('teleology') && c.tags.includes('opening'))
}

describe('teleology phase 2 — opening lifecycle over many days (heavy)', () => {
  it('an ignored opening parks and then dies with a causal death when nothing moves', () => {
    const day1 = run(createInitialTavernState())
    const record = Object.values(openings(day1.state).openings).find((r) => r.status === 'active')!

    // Park it artificially with a snapshot equal to the meters as they stand,
    // and a return window that has already elapsed. At the next startDay the
    // delta is read BEFORE the day mutates anything, so it is exactly zero —
    // no qualifying movement — and the opening dies deterministically.
    const state = structuredClone(day1.state)
    const slice = openings(state)
    slice.openings[record.id] = {
      ...record,
      status: 'parked',
      parkedAtDay: state.calendar.totalDaysElapsed,
      meterSnapshot: readOpeningMeters(state),
      returnByDay: state.calendar.totalDaysElapsed,
    }

    const next = run(state)
    expect(openings(next.state).openings[record.id]?.status).toBe('dead')
    expect(teleologyCauses(next.state).some((c) => c.tags.includes('death'))).toBe(true)
    // A dead opening stops being offered.
    const seeds = (next.state.modules.issueSeeds as { seedsToday: Array<{ family: string }> }).seedsToday
    expect(seeds.some((s) => s.family === 'opening')).toBe(false)
  })

  it('a parked opening returns — causally mutated — when its keyed meters move', () => {
    const day1 = run(createInitialTavernState())
    const record = Object.values(openings(day1.state).openings).find((r) => r.status === 'active')!

    // Park it with a snapshot well below current meters so the delta is
    // large and positive; keep the return window open so it cannot die first.
    let state = structuredClone(day1.state)
    const current = readOpeningMeters(state)
    // Snapshot well below every keyed meter so the net positive delta is
    // large and survives ordinary day-to-day drift across the window.
    const lowSnapshot: Record<string, number> = {}
    for (const [k, v] of Object.entries(current)) lowSnapshot[k] = v - 25
    openings(state).openings[record.id] = {
      ...record,
      status: 'parked',
      parkedAtDay: state.calendar.totalDaysElapsed,
      meterSnapshot: lowSnapshot,
      returnByDay: state.calendar.totalDaysElapsed + 60,
    }

    let returned = false
    for (let i = 0; i < 25 && !returned; i += 1) {
      const next = run(state)
      state = next.state
      const rec = openings(state).openings[record.id]
      if (rec?.status === 'active' && rec.origin === 'return') {
        returned = true
        expect(rec.valence).toBe('positive')
        expect(
          teleologyCauses(state).some((c) => c.tags.includes('return') && c.tags.includes('valence:positive')),
        ).toBe(true)
      }
    }
    expect(returned).toBe(true)
  })

  it('the ignore→commit path: pursuing a returned opening still spawns the venture', () => {
    const day1 = run(createInitialTavernState())
    const record = Object.values(openings(day1.state).openings).find((r) => r.status === 'active')!
    const seed = (day1.state.modules.issueSeeds as { seedsToday: Array<{ id: string; family: string }> }).seedsToday.find((s) => s.family === 'opening')!

    const day2 = run(day1.state, {
      responseIntents: [
        {
          id: 'commit',
          seedId: seed.id,
          verb: 'upgrade',
          shape: 'long_term_investment',
          target: { kind: 'system', id: `opening:${record.id}` },
          tags: ['teleology', 'opening'],
          intensity: 1,
          metadata: { responseSlotId: 'pursue' },
        },
      ],
    })
    expect(day2.state.ventures[record.blueprintId]?.status).toBe('active')
  })

  it('the opening lifecycle replays deterministically', () => {
    const runDays = (n: number): TavernState => {
      let state = createInitialTavernState()
      for (let i = 0; i < n; i += 1) state = run(state).state
      return state
    }
    const a = runDays(12)
    const b = runDays(12)
    expect(openings(a)).toEqual(openings(b))
    expect(teleologyCauses(a).map((c) => c.readable)).toEqual(
      teleologyCauses(b).map((c) => c.readable),
    )
  })
})
