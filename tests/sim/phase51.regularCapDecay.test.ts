import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'

import {
  MAX_REGULARS_PER_GROUP,
  getRegularModuleState,
  regularModule,
} from '../../src/sim/modules/regulars'
import { FULL_PIPELINE } from '../../src/sim/testing/simRunner'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { validateState } from '../../src/sim/state/validation'
import { createRngStreams } from '../../src/sim/core/rng'
import { generateName } from '../../src/sim/content/naming/nameGenerator'
import {
  ensureStarterNamingProfilesRegistered,
  namingProfileRegistry,
} from '../../src/sim/content/naming/namingProfiles'
import type {
  RegularWorldState,
  TavernState,
} from '../../src/sim/state/TavernState'

// Phase 51 — ISSUE-011. Lift regular cap + soft decay.
//
// The hard cap MAX_REGULARS_PER_GROUP rises from 3 to 7. Inactive,
// irritated regulars decay out of state through a new `closing` hook
// (45 days absent AND irritation >= 75). The starter roster grows
// from 6 to 11 with two faction-bound entries.

const SEED = 'phase-51-regular-cap-decay-test'

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

function makeStarterRegular(
  state: TavernState,
  id: string,
  groupId: string,
  overrides: Partial<RegularWorldState> = {},
): RegularWorldState {
  ensureStarterNamingProfilesRegistered()
  const group = state.customerGroups[groupId]!
  const rng = createRngStreams(`${SEED}-${id}`).get('regular_identity')
  const profile = namingProfileRegistry.get(group.namingProfileId)
  const name = generateName(profile, rng, 'regular_customer')
  return {
    id,
    name,
    customerGroupId: groupId,
    ...(group.cultureId ? { cultureId: group.cultureId } : {}),
    loyalty: 60,
    irritation: 0,
    visits: 0,
    firstSeenDay: 0,
    lastSeenDay: 0,
    knownIncidentIds: [],
    tags: ['regular', 'test'],
    activeFlags: [],
    ...overrides,
  }
}

function withRegular(
  state: TavernState,
  regular: RegularWorldState,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      regulars: {
        ...state.world.regulars,
        [regular.id]: regular,
      },
    },
  }
}

function withCalendarDay(state: TavernState, day: number): TavernState {
  return {
    ...state,
    calendar: { ...state.calendar, totalDaysElapsed: day },
  }
}

describe('Phase 51 §ISSUE-011 — Cap and starter roster', () => {
  it('1. MAX_REGULARS_PER_GROUP is at least 7', () => {
    expect(MAX_REGULARS_PER_GROUP).toBeGreaterThanOrEqual(7)
  })

  it('2. Starter roster has 11 entries', () => {
    const state = createInitialTavernState()
    expect(Object.keys(state.world.regulars).length).toBe(11)
  })

  it('3. At least one starter is bound to miners_union', () => {
    const state = createInitialTavernState()
    const minersUnion = Object.values(state.world.regulars).filter(
      (r) => r.factionId === 'miners_union',
    )
    expect(minersUnion.length).toBeGreaterThan(0)
  })

  it('3b. At least one starter is bound to market_caravan_circle', () => {
    const state = createInitialTavernState()
    const caravan = Object.values(state.world.regulars).filter(
      (r) => r.factionId === 'market_caravan_circle',
    )
    expect(caravan.length).toBeGreaterThan(0)
  })

  it('4. validateState passes for the default starting state', () => {
    const state = createInitialTavernState()
    expect(() => validateState(state, { modules: FULL_PIPELINE })).not.toThrow()
  })
})

describe('Phase 51 §ISSUE-011 — Soft decay hook', () => {
  it('5. A regular with daysInactive >= 45 and irritation >= 75 decays out', () => {
    let state = createInitialTavernState()
    const lonely = makeStarterRegular(state, 'decay_target', 'local_goblins', {
      lastSeenDay: 0,
      irritation: 80,
    })
    state = withRegular(state, lonely)
    state = withCalendarDay(state, 50)

    const result = simulateDay(state, input(), [regularModule])
    expect(result.state.world.regulars['decay_target']).toBeUndefined()
    const slice = getRegularModuleState(result.state)
    expect(slice.decayedToday).toContain('decay_target')
  })

  it('6. Irritation below threshold (70) keeps a long-absent regular in state', () => {
    let state = createInitialTavernState()
    const calm = makeStarterRegular(state, 'calm_target', 'local_goblins', {
      lastSeenDay: 0,
      irritation: 70,
    })
    state = withRegular(state, calm)
    state = withCalendarDay(state, 50)

    const result = simulateDay(state, input(), [regularModule])
    expect(result.state.world.regulars['calm_target']).toBeDefined()
    const slice = getRegularModuleState(result.state)
    expect(slice.decayedToday).not.toContain('calm_target')
  })

  it('7. Recent visit (daysInactive < 45) keeps an irritated regular in state', () => {
    let state = createInitialTavernState()
    const recent = makeStarterRegular(state, 'recent_target', 'local_goblins', {
      lastSeenDay: 40,
      irritation: 95,
    })
    state = withRegular(state, recent)
    state = withCalendarDay(state, 45)

    const result = simulateDay(state, input(), [regularModule])
    expect(result.state.world.regulars['recent_target']).toBeDefined()
  })

  it('8. Decay event emits a cause with source regulars.decay', () => {
    let state = createInitialTavernState()
    const lonely = makeStarterRegular(state, 'cause_target', 'local_goblins', {
      lastSeenDay: 0,
      irritation: 90,
    })
    state = withRegular(state, lonely)
    state = withCalendarDay(state, 50)

    const result = simulateDay(state, input(), [regularModule])
    const decayCauses = result.state.causes.filter(
      (c) => c.source === 'regulars.decay' && c.target === 'cause_target',
    )
    expect(decayCauses.length).toBeGreaterThan(0)
  })

  it('9. Long-absent + irritated decay clears the slot so emergence can fill it again', () => {
    // Pin a group at the new cap with regulars that all qualify for
    // decay; after the closing hook runs, the group has zero regulars
    // and emergence is unblocked for the next day.
    let state = createInitialTavernState()
    const groupId = 'local_goblins'
    const decayables: RegularWorldState[] = []
    for (let i = 0; i < MAX_REGULARS_PER_GROUP; i += 1) {
      const r = makeStarterRegular(state, `cap_test_${i}`, groupId, {
        lastSeenDay: 0,
        irritation: 90,
      })
      state = withRegular(state, r)
      decayables.push(r)
    }
    state = withCalendarDay(state, 60)
    const result = simulateDay(state, input(), [regularModule])
    for (const r of decayables) {
      expect(result.state.world.regulars[r.id]).toBeUndefined()
    }
    const slice = getRegularModuleState(result.state)
    expect(slice.decayedToday.length).toBe(decayables.length)
  })
})
