import { describe, expect, it } from 'vitest'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import { validateState } from '../../src/sim/state/validation'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { runOneDay } from '../../src/sim/testing/simRunner'
import { adventurersModule } from '../../src/sim/modules/adventurers/index'
import type { TavernState } from '../../src/sim/state/TavernState'

// Phase 69 / ISSUE-029 — Hireable adventurer roster.
//
// Covers the per-issue test approach from `docs/ISSUE_TRACKER.md`:
//   - adventurers generate deterministically from seed
//   - names persist across reload (round-trip through schema)
//   - a 90-day playtest with rising culinary_renown lifts the soft cap
//   - long-inactive adventurers leave the roster on weekly drift

const SEED = 'phase-69-adv-test'

function withRenown(state: TavernState, value: number): TavernState {
  return {
    ...state,
    reputation: { ...state.reputation, culinary_renown: value },
  }
}

describe('Phase 69 — hireable adventurer roster', () => {
  it('initial state seeds 3 starter adventurers via the npc_identity stream', () => {
    const a = createInitialTavernState()
    expect(Object.keys(a.world.hireableAdventurers).length).toBe(3)
    expect(a.world.hireableAdventurers['hireable_adv_alpha']).toBeDefined()
    expect(a.world.hireableAdventurers['hireable_adv_beta']).toBeDefined()
    expect(a.world.hireableAdventurers['hireable_adv_gamma']).toBeDefined()
    // Names are GeneratedName objects with a display string.
    const alpha = a.world.hireableAdventurers['hireable_adv_alpha']!
    expect(alpha.name.display.length).toBeGreaterThan(0)
    expect(alpha.cultureId).toBe('adventuring_bands')
  })

  it('starter adventurer names are deterministic across rebuilds', () => {
    const a = createInitialTavernState()
    const b = createInitialTavernState()
    for (const id of Object.keys(a.world.hireableAdventurers)) {
      expect(a.world.hireableAdventurers[id]!.name.display).toBe(
        b.world.hireableAdventurers[id]!.name.display,
      )
    }
  })

  it('starter adventurer roster round-trips through Zod validation', () => {
    const state = createInitialTavernState()
    const validated = validateState(state)
    expect(Object.keys(validated.world.hireableAdventurers).length).toBe(3)
    for (const id of Object.keys(state.world.hireableAdventurers)) {
      expect(validated.world.hireableAdventurers[id]).toEqual(
        state.world.hireableAdventurers[id],
      )
    }
  })

  it('adventurers module endWeek hook is the only hook registered', () => {
    expect(adventurersModule.hooks?.endWeek?.length).toBe(1)
    expect(adventurersModule.hooks?.startDay).toBeUndefined()
    expect(adventurersModule.hooks?.endDay).toBeUndefined()
  })

  it('idle counter increments weekly for idle adventurers', () => {
    // The endWeek hook fires on a calendar week boundary. Run 7 days
    // and check that the daysSinceLastJob counter advanced for each
    // idle adventurer.
    let state = createInitialTavernState()
    const startCounters = Object.fromEntries(
      Object.entries(state.world.hireableAdventurers).map(([id, a]) => [
        id,
        a.daysSinceLastJob,
      ]),
    )
    for (let i = 0; i < 7; i += 1) {
      state = runOneDay(state, { seed: `${SEED}-${i}` }).state
    }
    // After 7 days, the endWeek hook should have bumped each counter
    // by 7 (none of them are on an expedition).
    for (const [id, before] of Object.entries(startCounters)) {
      const after = state.world.hireableAdventurers[id]?.daysSinceLastJob ?? 0
      expect(after - before).toBeGreaterThanOrEqual(7)
    }
  })

  it('long-inactive low-relationship adventurer can leave the roster', () => {
    // Push every idle counter past 60 and relationship below 40 so
    // the weekly drift considers everyone a leaver candidate.
    let state = createInitialTavernState()
    state = {
      ...state,
      world: {
        ...state.world,
        hireableAdventurers: Object.fromEntries(
          Object.entries(state.world.hireableAdventurers).map(([id, a]) => [
            id,
            { ...a, daysSinceLastJob: 90, relationship: 20 },
          ]),
        ),
      },
    }
    const startSize = Object.keys(state.world.hireableAdventurers).length
    // Run across multiple weeks so the 60%-chance leaver roll has
    // many opportunities to fire.
    for (let i = 0; i < 28; i += 1) {
      state = runOneDay(state, { seed: `${SEED}-leave-${i}` }).state
    }
    const endSize = Object.keys(state.world.hireableAdventurers).length
    // Either someone left (size dropped) or drift arrivals brought
    // new members. We only assert the *drift* fired by checking for
    // an `adventurer_left_roster` memory.
    const leftMemory = state.memories.find(
      (m) => m.id === 'adventurer_left_roster',
    )
    expect(leftMemory).toBeDefined()
    void endSize
    void startSize
  })

  it('high renown lifts the soft cap and a new adventurer may join', () => {
    // Force renown to 70 so the soft cap rises to 6.
    let state = withRenown(createInitialTavernState(), 75)
    for (let i = 0; i < 56; i += 1) {
      state = runOneDay(state, { seed: `${SEED}-grow-${i}` }).state
    }
    const size = Object.keys(state.world.hireableAdventurers).length
    expect(size).toBeGreaterThanOrEqual(3)
    expect(size).toBeLessThanOrEqual(6)
    const arrival = state.memories.find(
      (m) => m.id === 'adventurer_joined_roster',
    )
    // Over 8 weeks with renown 75 and a starter roster of 3, at least
    // one arrival should have fired.
    expect(arrival).toBeDefined()
  })

  it('FULL_PIPELINE includes the adventurers module', () => {
    expect(FULL_PIPELINE.some((m) => m.id === adventurersModule.id)).toBe(true)
  })
})
