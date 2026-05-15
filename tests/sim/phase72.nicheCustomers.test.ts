import { describe, expect, it } from 'vitest'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import { runOneDay } from '../../src/sim/testing/simRunner'
import { customerRegistry } from '../../src/sim/registries/customerRegistry'
import { validateState } from '../../src/sim/state/validation'
import type { TavernState } from '../../src/sim/state/TavernState'

// Phase 72 / ISSUE-032 — Demand-side niche customer groups.
//
// Covers the per-issue test approach from `docs/ISSUE_TRACKER.md`:
//   - renown<30 → no niche groups active
//   - raising renown across thresholds activates groups in order
//   - serve-only-common playtest after activation decays inactive
//   - arrival memory carries non-empty relatedActors

const SEED = 'phase-72-niche-test'

function withRenown(state: TavernState, value: number): TavernState {
  return {
    ...state,
    reputation: { ...state.reputation, culinary_renown: value },
  }
}

describe('Phase 72 — niche customer groups', () => {
  it('registers four niche groups with renown thresholds', () => {
    expect(customerRegistry.has('gourmand')).toBe(true)
    expect(customerRegistry.has('food_critic')).toBe(true)
    expect(customerRegistry.has('foreign_envoy')).toBe(true)
    expect(customerRegistry.has('eccentric_noble')).toBe(true)
    expect(customerRegistry.get('gourmand').defaultState.minRenownThreshold).toBe(30)
    expect(customerRegistry.get('food_critic').defaultState.minRenownThreshold).toBe(50)
    expect(customerRegistry.get('foreign_envoy').defaultState.minRenownThreshold).toBe(55)
    expect(customerRegistry.get('eccentric_noble').defaultState.minRenownThreshold).toBe(70)
  })

  it('initial state has all niche groups present with patronage 0', () => {
    const state = createInitialTavernState()
    for (const id of ['gourmand', 'food_critic', 'foreign_envoy', 'eccentric_noble']) {
      const group = state.customerGroups[id]
      expect(group).toBeDefined()
      expect(group!.patronage).toBe(0)
      expect(group!.minRenownThreshold).toBeGreaterThan(0)
    }
  })

  it('state with niche groups round-trips through Zod validation', () => {
    const state = createInitialTavernState()
    const validated = validateState(state)
    expect(validated.customerGroups['gourmand']!.minRenownThreshold).toBe(30)
  })

  it('low renown keeps niche groups inactive', () => {
    let state = withRenown(createInitialTavernState(), 10)
    for (let i = 0; i < 7; i += 1) {
      state = runOneDay(state, { seed: `${SEED}-low-${i}` }).state
    }
    expect(state.customerGroups['gourmand']!.patronage).toBe(0)
    expect(state.customerGroups['food_critic']!.patronage).toBe(0)
    expect(state.customerGroups['eccentric_noble']!.patronage).toBe(0)
  })

  it('crossing the gourmand threshold (30) activates the group + writes arrival memory', () => {
    let state = withRenown(createInitialTavernState(), 35)
    state = runOneDay(state, { seed: `${SEED}-activate` }).state
    expect(state.customerGroups['gourmand']!.patronage).toBeGreaterThan(0)
    const arrival = state.memories.find(
      (m) => m.id === 'niche_visitor_arrived' && m.metadata?.['groupId'] === 'gourmand',
    )
    expect(arrival).toBeDefined()
    expect(arrival!.actors.length).toBeGreaterThan(0)
    expect(arrival!.actors[0]!.id).toBe('gourmand')
    // The food_critic threshold (50) is not yet reached.
    expect(state.customerGroups['food_critic']!.patronage).toBe(0)
  })

  it('raising renown across thresholds activates groups in order', () => {
    let state = withRenown(createInitialTavernState(), 75)
    state = runOneDay(state, { seed: `${SEED}-allactive` }).state
    expect(state.customerGroups['gourmand']!.patronage).toBeGreaterThan(0)
    expect(state.customerGroups['food_critic']!.patronage).toBeGreaterThan(0)
    expect(state.customerGroups['foreign_envoy']!.patronage).toBeGreaterThan(0)
    expect(state.customerGroups['eccentric_noble']!.patronage).toBeGreaterThan(0)
  })

  it('renown falling well below threshold decays an active niche group', () => {
    // Activate first.
    let state = withRenown(createInitialTavernState(), 55)
    state = runOneDay(state, { seed: `${SEED}-active-decay-init` }).state
    expect(state.customerGroups['gourmand']!.patronage).toBeGreaterThan(0)
    // Drop renown below threshold-hysteresis (gourmand 30, hysteresis 5
    // → cutoff 24). With renown 10, decay should fire daily.
    state = withRenown(state, 10)
    const before = state.customerGroups['gourmand']!.patronage
    for (let i = 0; i < 12; i += 1) {
      state = runOneDay(state, { seed: `${SEED}-decay-${i}` }).state
    }
    expect(state.customerGroups['gourmand']!.patronage).toBeLessThan(before)
  })

  it('inactive niche groups do not produce visitors in the forecast', () => {
    const state = withRenown(createInitialTavernState(), 5)
    const after = runOneDay(state, { seed: `${SEED}-no-visit` }).state
    const turnouts =
      (after.modules['customers'] as
        | { turnouts: Array<{ groupId: string; visitors: number }> }
        | undefined)?.turnouts ?? []
    for (const t of turnouts) {
      if (
        t.groupId === 'gourmand' ||
        t.groupId === 'food_critic' ||
        t.groupId === 'foreign_envoy' ||
        t.groupId === 'eccentric_noble'
      ) {
        expect(t.visitors).toBe(0)
      }
    }
  })
})
