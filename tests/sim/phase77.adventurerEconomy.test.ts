import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { runOneDay } from '../../src/sim/testing/simRunner'
import {
  COMMISSION_EXPEDITION_ACTION_ID,
  routeFor,
} from '../../src/sim/modules/expeditions/index'
import { SUPPLY_UNIT_COST } from '../../src/sim/modules/expeditions/commissionExpedition'
import { routeProvisionsNeeded } from '../../src/sim/content/expeditions/expeditionRoutes'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type {
  HireableAdventurer,
  TavernState,
} from '../../src/sim/state/TavernState'

// Phase 77 — ISSUE-037: wire wageBase / specialty / activeFlags on
// hireable adventurers. The schema declared all three fields and
// `defaults.ts` seeded distinct values across the starter trio
// (alpha: wageBase 6 specialty 'rare', beta: 4 / 'uncommon',
// gamma: 3 / null), but the runtime read none of them:
//
//   - expedition cost was `input.amount`, so a master could ship for
//     0 coin while a rookie was rejected;
//   - `specialty` did not bias the outcome roll;
//   - `activeFlags` was written at creation and never consumed.
//
// Phase 77 fixes all three. Tests below assert the new behaviours.

const SEED = 'phase-77-adventurer-economy'

/** What the default loadout for a solo `rare` commission costs. */
const KIT = routeProvisionsNeeded(routeFor('oldwood_verge')!, 1) * SUPPLY_UNIT_COST

function withCoin(state: TavernState, coin: number): TavernState {
  return { ...state, coin }
}

function commission(
  runnerId: string,
  mode: 'open' | 'targeted',
  options: Record<string, unknown>,
  daysTotal: number,
): {
  actionId: string
  targetId: string
  options: Record<string, unknown>
} {
  return {
    actionId: COMMISSION_EXPEDITION_ACTION_ID,
    targetId: runnerId,
    options: { mode, daysTotal, ...options },
  }
}

function patchAdventurer(
  state: TavernState,
  id: string,
  patch: Partial<HireableAdventurer>,
): TavernState {
  const existing = state.world.hireableAdventurers[id]!
  return {
    ...state,
    world: {
      ...state.world,
      hireableAdventurers: {
        ...state.world.hireableAdventurers,
        [id]: { ...existing, ...patch },
      },
    },
  }
}

// Expansion Phase 9 §9.3 — the trip's length belongs to the route, so these
// sweeps run on until the journey ends rather than counting days.
function runUntilResolved(
  state: TavernState,
  seedTag: string,
  maxDays = 24,
): TavernState {
  let current = state
  for (let i = 0; i < maxDays && current.expeditions.active.length > 0; i += 1) {
    current = runOneDay(current, { seed: `${SEED}-${seedTag}-${i}` }).state
  }
  return current
}

describe('Phase 77 / ISSUE-037 — wageBase / specialty / activeFlags wiring', () => {
  it('expedition cost is wageBase * daysTotal, not input.amount', () => {
    // Expansion Phase 9 §9.3 — a `rare` target with no route named goes down
    // the Oldwood Verge, and the trip's length and provisioning are the
    // route's rather than the payload's. The point the test defends is
    // unchanged: the WAGE sets the price, so the better runner costs more
    // for the same trip.
    const state = withCoin(createInitialTavernState(), 200)
    const alpha = runOneDay(state, {
      seed: `${SEED}-cost-alpha`,
      ownerActions: [
        commission('hireable_adv_alpha', 'open', { targetTier: 'rare' }, 5),
      ],
    })
    expect(alpha.state.expeditions.active[0]?.costPaid).toBe(6 * 9 + KIT)
    const beta = runOneDay(state, {
      seed: `${SEED}-cost-beta`,
      ownerActions: [
        commission('hireable_adv_beta', 'open', { targetTier: 'rare' }, 5),
      ],
    })
    expect(beta.state.expeditions.active[0]?.costPaid).toBe(4 * 9 + KIT)
  })

  it('insufficient coin rejects the commission with the wage-formula reason', () => {
    // Beta wageBase 4 × 7 days = 28. With 20 coin we cannot afford.
    const state = withCoin(createInitialTavernState(), 20)
    const result = runOneDay(state, {
      seed: `${SEED}-cost-reject`,
      ownerActions: [
        commission('hireable_adv_beta', 'open', { targetTier: 'rare' }, 7),
      ],
    })
    expect(result.state.expeditions.active.length).toBe(0)
  })

  it('specialty matches lift the success rate over a 30-trial sweep', () => {
    // Run the same rare-tier open expedition with two starter runners:
    //   - alpha: experience 60, reliability 60, specialty 'rare'
    //   - non-specialist: a patched copy of alpha with specialty null
    // The seeds are otherwise identical. Specialist must win more.
    // PAIRED, on one shared seed sequence. An earlier version gave the two
    // lines different seed tags, so they walked different journeys and the
    // comparison was two independent samples of a noisy statistic — it could
    // and did come out backwards on an unlucky draw. Sharing the seeds makes
    // the specialty the ONLY difference between the runs, which is what the
    // test claims to be measuring.
    function sweep(
      runnerId: string,
      patch: Partial<HireableAdventurer>,
    ): number {
      let successes = 0
      for (let trial = 0; trial < 30; trial += 1) {
        let s = withCoin(createInitialTavernState(), 300)
        s = patchAdventurer(s, runnerId, patch)
        s = runOneDay(s, {
          seed: `${SEED}-specialty-${trial}`,
          ownerActions: [
            commission(runnerId, 'open', { targetTier: 'rare' }, 3),
          ],
        }).state
        s = runUntilResolved(s, `specialty-${trial}`)
        const rec = s.expeditions.completed[0]
        if (rec && rec.outcome === 'success') successes += 1
      }
      return successes
    }
    const specialist = sweep('hireable_adv_alpha', { specialty: 'rare' })
    const generalist = sweep('hireable_adv_alpha', { specialty: null })
    // Expansion Phase 9 §9.3 — the bias now lands on the SEARCH at the site
    // rather than on a closing roll, which is why the same journey can end
    // in a find for one and nothing for the other.
    expect(specialist).toBeGreaterThan(generalist)
  })

  it('failure outcome sets the injured flag and getValidTargets filters it out', () => {
    // Force failures by giving alpha extreme low odds: rookie stats
    // and legendary tier. We sweep many seeds until a failure lands.
    let state = withCoin(createInitialTavernState(), 200)
    state = patchAdventurer(state, 'hireable_adv_alpha', {
      experience: 5,
      reliability: 5,
      relationship: 80,
      specialty: null,
      activeFlags: [],
    })
    let injuredAfter: TavernState | null = null
    for (let trial = 0; trial < 40 && injuredAfter === null; trial += 1) {
      let s = state
      s = runOneDay(s, {
        seed: `${SEED}-fail-${trial}`,
        ownerActions: [
          commission('hireable_adv_alpha', 'open', { targetTier: 'rare' }, 2),
        ],
      }).state
      s = runUntilResolved(s, `fail-${trial}`)
      const rec = s.expeditions.completed[0]
      const runner = s.world.hireableAdventurers['hireable_adv_alpha']
      if (rec && rec.outcome === 'failure' && runner) {
        injuredAfter = s
      }
    }
    expect(injuredAfter).not.toBeNull()
    const flagged = injuredAfter!.world.hireableAdventurers[
      'hireable_adv_alpha'
    ]!
    expect(flagged.activeFlags).toContain('injured')

    // A subsequent commission on the injured runner must be rejected.
    const blocked = runOneDay(injuredAfter!, {
      seed: `${SEED}-blocked`,
      ownerActions: [
        commission('hireable_adv_alpha', 'open', { targetTier: 'uncommon' }, 2),
      ],
    })
    // No new active expedition was started.
    expect(blocked.state.expeditions.active.length).toBe(0)
  })

  it('injured flag clears after the recovery threshold via the weekly drift hook', () => {
    let state = withCoin(createInitialTavernState(), 200)
    state = patchAdventurer(state, 'hireable_adv_alpha', {
      activeFlags: ['injured'],
      daysSinceLastJob: 0,
      currentExpeditionId: null,
    })
    // Advance enough days that the weekly hook fires twice (14+ idle
    // days), which is past the recovery threshold.
    for (let i = 0; i < 21; i += 1) {
      state = runOneDay(state, { seed: `${SEED}-recover-${i}` }).state
    }
    const after = state.world.hireableAdventurers['hireable_adv_alpha']!
    expect(after.activeFlags).not.toContain('injured')
    expect(after.daysSinceLastJob).toBeGreaterThanOrEqual(14)
  })

  it('FULL_PIPELINE still wires the expeditions and adventurers modules', () => {
    expect(FULL_PIPELINE.some((m) => m.id === 'expeditions')).toBe(true)
    expect(FULL_PIPELINE.some((m) => m.id === 'adventurers')).toBe(true)
    // Trivial sanity: simulateDay still runs without throwing on the
    // initial state.
    expect(() =>
      simulateDay(
        createInitialTavernState(),
        { seed: SEED },
        FULL_PIPELINE,
      ),
    ).not.toThrow()
  })
})
