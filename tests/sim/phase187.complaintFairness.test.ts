// Phase 187 / ISSUE-154 — Early-game complaint fairness.
//
// A complaint is a reaction to an *unaddressed* problem: the
// customer_complaint family may only fire once a group's dissatisfaction
// has survived at least one decision point (the customer module's
// `lowSatisfactionStreak` reaching >= 2). These tests pin:
//   1. a default Day-1 run produces no customer_complaint seed;
//   2. a two-service held-low run opens the complaint on the second day
//      (the streak gate opens at >= 2, not on Day 1);
//   3. the `lowSatisfactionStreak` field round-trips serialization.

import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { validateState } from '../../src/sim/state/validation'
import { getIssueSeeds } from '../../src/sim/modules/issues/index'
import {
  COMPLAINT_THRESHOLD,
  getCustomerModuleState,
} from '../../src/sim/modules/customers/index'
import {
  withArea,
  withCustomerGroup,
  withStock,
} from '../../src/sim/testing/stateFactories'
import type { TavernState } from '../../src/sim/state/TavernState'

const SEED = 'phase-187-complaint-fairness'

function plentyOfStock(state: TavernState): TavernState {
  let next = state
  next = withStock(next, 'ale', { quantity: 800, quality: 60 })
  next = withStock(next, 'stew', { quantity: 400, quality: 60 })
  next = withStock(next, 'mushrooms', { quantity: 200 })
  return next
}

function runDay(state: TavernState) {
  return simulateDay(state, { seed: SEED }, FULL_PIPELINE)
}

describe('Phase 187 / ISSUE-154 — complaint fires on persistence, not Day 1', () => {
  it('produces no customer_complaint seed on a default Day-1 run', () => {
    for (const seed of ['alpha', 'beta', 'gamma']) {
      const result = simulateDay(createInitialTavernState(), { seed }, FULL_PIPELINE)
      const complaints = getIssueSeeds(result.state, {
        family: 'customer_complaint',
        includeInvalid: true,
      })
      expect(complaints).toEqual([])
    }
  })

  it('the streak gate opens at >= 2 — complaint appears on the second held-low day, not the first', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withCustomerGroup(base, 'merchants', {
      satisfaction: 20,
      patronage: 30,
    })
    base = withArea(base, 'main_room', { cleanliness: 20 })

    const day1 = runDay(base)
    // After one held-low service the streak is exactly 1 — below the gate.
    expect(getCustomerModuleState(day1.state).lowSatisfactionStreak['merchants']).toBe(1)
    expect(
      getIssueSeeds(day1.state, { family: 'customer_complaint' }),
    ).toEqual([])

    const day2 = runDay(day1.state)
    expect(
      getCustomerModuleState(day2.state).lowSatisfactionStreak['merchants'],
    ).toBeGreaterThanOrEqual(2)
    expect(
      getIssueSeeds(day2.state, { family: 'customer_complaint' }).length,
    ).toBeGreaterThan(0)
  })

  it('resets the streak when a group recovers above the threshold', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withCustomerGroup(base, 'merchants', {
      satisfaction: 20,
      patronage: 30,
    })
    base = withArea(base, 'main_room', { cleanliness: 20 })
    const low = runDay(base)
    expect(getCustomerModuleState(low.state).lowSatisfactionStreak['merchants']).toBe(1)

    // Lift the group well above the threshold and a clean room; the next
    // evaluated service must reset the counter to 0.
    let recovered = withCustomerGroup(low.state, 'merchants', {
      satisfaction: COMPLAINT_THRESHOLD + 30,
    })
    recovered = withArea(recovered, 'main_room', { cleanliness: 95 })
    const after = runDay(recovered)
    expect(getCustomerModuleState(after.state).lowSatisfactionStreak['merchants']).toBe(0)
  })
})

describe('Phase 187 / ISSUE-154 — lowSatisfactionStreak serialization', () => {
  it('round-trips through JSON serialization and state validation', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withCustomerGroup(base, 'merchants', { satisfaction: 20, patronage: 30 })
    base = withArea(base, 'main_room', { cleanliness: 20 })
    const result = runDay(base)

    const roundTripped = JSON.parse(JSON.stringify(result.state))
    const validated = validateState(roundTripped, { modules: FULL_PIPELINE })
    expect(getCustomerModuleState(validated).lowSatisfactionStreak).toEqual(
      getCustomerModuleState(result.state).lowSatisfactionStreak,
    )
  })
})
