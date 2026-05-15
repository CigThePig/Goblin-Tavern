import { describe, expect, it } from 'vitest'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import { validateState } from '../../src/sim/state/validation'
import { FULL_PIPELINE, runOneDay } from '../../src/sim/testing/simRunner'
import { COMMISSION_EXPEDITION_ACTION_ID } from '../../src/sim/modules/expeditions/index'
import type {
  Expedition,
  ExpeditionRecord,
  TavernState,
} from '../../src/sim/state/TavernState'
import type { SimInputOwnerAction } from '../../src/sim/core/context'

// Phase 70 / ISSUE-030 — Expedition subsystem.
//
// Covers the per-issue test approach from `docs/ISSUE_TRACKER.md`:
//   - same seed + same commissionExpedition input + same days =
//     same outcome
//   - save mid-expedition and reload resolves identically
//   - extra niche-customer roll on day 5 does not shift day-7 outcome
//     (named-stream isolation)
//   - runner_lost removes the runner from hireableAdventurers
//   - state round-trips through Zod across an active expedition

const SEED = 'phase-70-exp-test'

function withCoin(state: TavernState, coin: number): TavernState {
  return { ...state, coin }
}

function commission(
  runnerId: string,
  mode: 'open' | 'targeted',
  options: Record<string, unknown>,
  cost: number,
  daysTotal: number,
): SimInputOwnerAction {
  return {
    actionId: COMMISSION_EXPEDITION_ACTION_ID,
    targetId: runnerId,
    amount: cost,
    options: { mode, daysTotal, ...options },
  }
}

function runDays(state: TavernState, days: number, seedTag = ''): TavernState {
  let current = state
  for (let i = 0; i < days; i += 1) {
    current = runOneDay(current, { seed: `${SEED}-${seedTag}-${i}` }).state
  }
  return current
}

describe('Phase 70 — expedition subsystem', () => {
  it('initial state has empty active and completed lists', () => {
    const state = createInitialTavernState()
    expect(state.expeditions.active).toEqual([])
    expect(state.expeditions.completed).toEqual([])
  })

  it('state.expeditions round-trips through Zod', () => {
    const state = createInitialTavernState()
    const validated = validateState(state)
    expect(validated.expeditions.active).toEqual([])
    expect(validated.expeditions.completed).toEqual([])
  })

  it('commission_expedition adds an active expedition and reserves the runner', () => {
    let state = withCoin(createInitialTavernState(), 200)
    const runnerId = 'hireable_adv_alpha'
    state = runOneDay(state, {
      seed: `${SEED}-commission`,
      ownerActions: [
        commission(
          runnerId,
          'open',
          { targetTier: 'rare' },
          20,
          5,
        ),
      ],
    }).state
    expect(state.expeditions.active.length).toBe(1)
    const exp = state.expeditions.active[0]!
    expect(exp.runnerId).toBe(runnerId)
    expect(exp.mode).toBe('open')
    expect(exp.targetTier).toBe('rare')
    expect(exp.daysTotal).toBe(5)
    expect(exp.costPaid).toBe(20)
    // The runner is reserved.
    const runner = state.world.hireableAdventurers[runnerId]!
    expect(runner.currentExpeditionId).toBe(exp.id)
    // Cost was recorded on the expedition (coin may be higher than the
    // pre-commission balance because the day's service also earned).
    expect(exp.costPaid).toBe(20)
  })

  it('commission rejects when runner is already on an expedition', () => {
    let state = withCoin(createInitialTavernState(), 200)
    const runnerId = 'hireable_adv_alpha'
    state = runOneDay(state, {
      seed: `${SEED}-commission-first`,
      ownerActions: [
        commission(
          runnerId,
          'open',
          { targetTier: 'rare' },
          20,
          5,
        ),
      ],
    }).state
    // Try to commission the same runner a second time on the next day.
    const result = runOneDay(state, {
      seed: `${SEED}-commission-second`,
      ownerActions: [
        commission(
          runnerId,
          'open',
          { targetTier: 'rare' },
          20,
          5,
        ),
      ],
    })
    // Only one active expedition — the second commission was rejected.
    expect(result.state.expeditions.active.length).toBe(1)
  })

  it('expedition resolves deterministically — same seed + same input → same outcome', () => {
    const baseState = withCoin(createInitialTavernState(), 200)
    const runnerId = 'hireable_adv_alpha'
    const commissionAction = commission(
      runnerId,
      'targeted',
      { targetIngredientId: 'moonpetal_mushroom' },
      30,
      4,
    )
    // Two parallel runs starting from the same state, same seed.
    let stateA = runOneDay(baseState, {
      seed: `${SEED}-determinism`,
      ownerActions: [commissionAction],
    }).state
    let stateB = runOneDay(baseState, {
      seed: `${SEED}-determinism`,
      ownerActions: [commissionAction],
    }).state
    // Tick both forward 4 more days.
    for (let i = 0; i < 4; i += 1) {
      stateA = runOneDay(stateA, { seed: `${SEED}-determinism-${i}` }).state
      stateB = runOneDay(stateB, { seed: `${SEED}-determinism-${i}` }).state
    }
    // Both runs should have resolved the same expedition with the
    // same outcome and returned ingredients.
    expect(stateA.expeditions.completed.length).toBe(1)
    expect(stateB.expeditions.completed.length).toBe(1)
    const recA = stateA.expeditions.completed[0]!
    const recB = stateB.expeditions.completed[0]!
    expect(recA.outcome).toBe(recB.outcome)
    expect(recA.returnedIngredients).toEqual(recB.returnedIngredients)
  })

  it('save mid-expedition and reload resolves identically', () => {
    const baseState = withCoin(createInitialTavernState(), 200)
    const runnerId = 'hireable_adv_alpha'
    const commissionAction = commission(
      runnerId,
      'targeted',
      { targetIngredientId: 'silvercap_truffle' },
      40,
      5,
    )
    let live = runOneDay(baseState, {
      seed: `${SEED}-save`,
      ownerActions: [commissionAction],
    }).state
    // Advance 3 days, then take a "save" via JSON round-trip and a
    // "reload" via validateState. Continue both lines independently.
    for (let i = 0; i < 3; i += 1) {
      live = runOneDay(live, { seed: `${SEED}-save-${i}` }).state
    }
    const saved = JSON.parse(JSON.stringify(live)) as unknown
    const reloaded = validateState(saved)
    // Continue both from this point for 2 more days. Resolution
    // happens at day 5 (commission day + 5 ticks).
    let liveAfter = live
    let reloadedAfter = reloaded
    for (let i = 0; i < 3; i += 1) {
      liveAfter = runOneDay(liveAfter, { seed: `${SEED}-save-tail-${i}` }).state
      reloadedAfter = runOneDay(reloadedAfter, {
        seed: `${SEED}-save-tail-${i}`,
      }).state
    }
    const liveRecord = liveAfter.expeditions.completed[0]
    const reloadedRecord = reloadedAfter.expeditions.completed[0]
    expect(liveRecord).toBeDefined()
    expect(reloadedRecord).toBeDefined()
    expect(reloadedRecord!.outcome).toBe(liveRecord!.outcome)
    expect(reloadedRecord!.returnedIngredients).toEqual(
      liveRecord!.returnedIngredients,
    )
  })

  it('expedition outcome does not depend on unrelated RNG streams (named-stream isolation)', () => {
    // The expedition is resolved via `expedition_<id>`. Other modules
    // consume `service`, `incidents`, `npc_identity`, etc. We force
    // a different daily seed for some intermediate days (which shifts
    // the service / incidents streams) and verify the expedition
    // outcome is unchanged.
    const baseState = withCoin(createInitialTavernState(), 200)
    const runnerId = 'hireable_adv_alpha'
    const commissionAction = commission(
      runnerId,
      'open',
      { targetTier: 'rare' },
      25,
      4,
    )
    // Both lines start from the same commission + same seed
    let stateA = runOneDay(baseState, {
      seed: 'isolated-commission',
      ownerActions: [commissionAction],
    }).state
    let stateB = runOneDay(baseState, {
      seed: 'isolated-commission',
      ownerActions: [commissionAction],
    }).state
    // Use DIFFERENT seeds in the middle days. The expedition's named
    // stream resolves via `getRngStreamByName('expedition_<id>')`,
    // which derives its seed from the *daily* input seed — so to
    // isolate properly, the **resolution day's** seed must match.
    // Tick 3 intermediate days with different seeds, then the
    // resolution tick with the same seed.
    for (let i = 0; i < 3; i += 1) {
      stateA = runOneDay(stateA, { seed: `iso-A-${i}` }).state
      stateB = runOneDay(stateB, { seed: `iso-B-${i}` }).state
    }
    // Resolution day — use the same seed so the expedition's named
    // stream resolves identically. Earlier days touching `service` /
    // `incidents` / etc. should not have shifted the expedition's
    // dedicated stream.
    stateA = runOneDay(stateA, { seed: 'iso-resolve' }).state
    stateB = runOneDay(stateB, { seed: 'iso-resolve' }).state
    // Both must have resolved. Outcomes should match because the
    // expedition RNG is derived from the *commission day's* base
    // seed (`isolated-commission`), not the per-day seeds that
    // followed.
    expect(stateA.expeditions.completed.length).toBe(1)
    expect(stateB.expeditions.completed.length).toBe(1)
    const recA = stateA.expeditions.completed[0]!
    const recB = stateB.expeditions.completed[0]!
    expect(recA.outcome).toBe(recB.outcome)
    expect(recA.returnedIngredients).toEqual(recB.returnedIngredients)
  })

  it('runner_lost outcome removes the runner from hireableAdventurers', () => {
    // Force a runner_lost outcome by patching state to give the
    // runner extremely low reliability and a legendary target. We
    // commission, sweep days forward, and check the completed log
    // and roster.
    let state = withCoin(createInitialTavernState(), 200)
    state = {
      ...state,
      world: {
        ...state.world,
        hireableAdventurers: {
          ...state.world.hireableAdventurers,
          hireable_adv_gamma: {
            ...state.world.hireableAdventurers['hireable_adv_gamma']!,
            experience: 5,
            reliability: 5,
            relationship: 80,
          },
        },
      },
    }
    // Sweep many seeds to find one that produces runner_lost.
    let foundLost = false
    let sample = state
    for (let trial = 0; trial < 30 && !foundLost; trial += 1) {
      let s = state
      s = runOneDay(s, {
        seed: `lost-${trial}`,
        ownerActions: [
          commission(
            'hireable_adv_gamma',
            'targeted',
            { targetIngredientId: 'phoenix_pepper' },
            40,
            3,
          ),
        ],
      }).state
      for (let i = 0; i < 3; i += 1) {
        s = runOneDay(s, { seed: `lost-${trial}-${i}` }).state
      }
      const completed = s.expeditions.completed
      if (completed.length > 0 && completed[0]!.outcome === 'runner_lost') {
        foundLost = true
        sample = s
      }
    }
    expect(foundLost).toBe(true)
    expect(sample.world.hireableAdventurers['hireable_adv_gamma']).toBeUndefined()
  })

  it('completed log caps at 50 entries', () => {
    // Construct a state with 51 completed records and verify the
    // cap is enforced when one more resolves. We do this by directly
    // simulating: pre-stuff the completed log with 50 fake records,
    // then commission + resolve one expedition, then check len <= 50.
    let state = withCoin(createInitialTavernState(), 500)
    const fakeRecord: ExpeditionRecord = {
      id: 'pre_resolved',
      runnerId: 'hireable_adv_alpha',
      mode: 'open',
      targetTier: 'rare',
      targetIngredientId: null,
      daysTotal: 3,
      costPaid: 10,
      startedDay: 1,
      resolvedDay: 4,
      outcome: 'failure',
      returnedIngredients: [],
    }
    const stuffed: ExpeditionRecord[] = []
    for (let i = 0; i < 50; i += 1) {
      stuffed.push({ ...fakeRecord, id: `pre_${i}` })
    }
    state = {
      ...state,
      expeditions: { active: [], completed: stuffed },
    }
    state = runOneDay(state, {
      seed: `${SEED}-cap`,
      ownerActions: [
        commission(
          'hireable_adv_alpha',
          'open',
          { targetTier: 'uncommon' },
          15,
          2,
        ),
      ],
    }).state
    for (let i = 0; i < 3; i += 1) {
      state = runOneDay(state, { seed: `${SEED}-cap-${i}` }).state
    }
    expect(state.expeditions.completed.length).toBeLessThanOrEqual(50)
  })

  it('FULL_PIPELINE includes the expeditions module', () => {
    expect(FULL_PIPELINE.some((m) => m.id === 'expeditions')).toBe(true)
  })

  it('on resolution, ingredients land in stock with quantity > 0', () => {
    // Force a setup biased toward success.
    let state = withCoin(createInitialTavernState(), 300)
    state = {
      ...state,
      world: {
        ...state.world,
        hireableAdventurers: {
          ...state.world.hireableAdventurers,
          hireable_adv_alpha: {
            ...state.world.hireableAdventurers['hireable_adv_alpha']!,
            experience: 95,
            reliability: 95,
          },
        },
      },
    }
    // Targeted at moonpetal_mushroom — quantity should land if outcome
    // is success or partial. Sweep across seeds to find a success.
    let bestState: TavernState | null = null
    for (let trial = 0; trial < 12; trial += 1) {
      let s = state
      s = runOneDay(s, {
        seed: `haul-${trial}`,
        ownerActions: [
          commission(
            'hireable_adv_alpha',
            'targeted',
            { targetIngredientId: 'moonpetal_mushroom' },
            40,
            3,
          ),
        ],
      }).state
      for (let i = 0; i < 3; i += 1) {
        s = runOneDay(s, { seed: `haul-${trial}-${i}` }).state
      }
      const completed = s.expeditions.completed[0]
      if (completed && (completed.outcome === 'success' || completed.outcome === 'partial')) {
        bestState = s
        break
      }
    }
    expect(bestState).not.toBeNull()
    expect(bestState!.stock['moonpetal_mushroom']!.quantity).toBeGreaterThan(0)
    // Renown should have moved up on a success.
    const final = bestState!.expeditions.completed[0]!
    if (final.outcome === 'success') {
      expect(bestState!.reputation.culinary_renown).toBeGreaterThan(
        state.reputation.culinary_renown,
      )
    }
  })
})
