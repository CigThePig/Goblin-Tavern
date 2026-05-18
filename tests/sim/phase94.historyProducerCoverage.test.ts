// Phase 94 — Regression net for the producers the Tavern Log screen
// depends on. Not testing Phase 94 code directly — this pins behaviour
// in the sim that the screen builds against. If a future change quiets
// a producer, this test catches it before the screen empties out.

import { describe, expect, it } from 'vitest'

import { runCardlessSim } from '../../src/sim/testing/simRunner'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { withCoin } from '../../src/sim/testing/stateFactories'
import type { HistoryCategory } from '../../src/sim/state/TavernState'

describe('phase 94 / history producer coverage', () => {
  it('a 30-day run emits enough history to fuel a meaningful log', () => {
    const run = runCardlessSim({
      initialState: withCoin(createInitialTavernState(), 500),
      seed: 'tests/sim/phase94.coverage',
      days: 30,
    })
    expect(run.finalState.history.length).toBeGreaterThan(50)
  })

  it('a 30-day run hits the key categories', () => {
    const run = runCardlessSim({
      initialState: withCoin(createInitialTavernState(), 500),
      seed: 'tests/sim/phase94.coverage',
      days: 30,
    })
    const categories = new Set<HistoryCategory>(
      run.finalState.history.map((e) => e.category),
    )
    // Service and weekly fire on every full week run; monthly fires on day 28.
    expect(categories.has('service')).toBe(true)
    expect(categories.has('weekly')).toBe(true)
    expect(categories.has('monthly')).toBe(true)
  })

  it('every history entry has a non-empty summary and a populated timestamp', () => {
    const run = runCardlessSim({
      initialState: withCoin(createInitialTavernState(), 500),
      seed: 'tests/sim/phase94.coverage',
      days: 14,
    })
    for (const entry of run.finalState.history) {
      expect(entry.summary.length).toBeGreaterThan(0)
      expect(entry.timestamp.absoluteDay).toBeGreaterThanOrEqual(0)
      expect(entry.id.length).toBeGreaterThan(0)
    }
  })
})
