// Phase 95 — Tavern Identity module tests.
//
// Validates the endDay recomputation rules (knownFor / houseRules /
// atmosphereTags), idempotency (stable input → no diff write), and
// reactivity to policy toggles and area drift.

import { describe, expect, it } from 'vitest'

import {
  computeKnownFor,
  computeHouseRules,
  computeAtmosphereTags,
  tavernIdentityModule,
  AXIS_KNOWN_FOR,
  POLICY_HOUSE_RULE,
  KNOWN_FOR_THRESHOLD,
} from '../../src/sim/modules/tavernIdentity/index'
import { simulateDay } from '../../src/sim/core/engine'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { FULL_PIPELINE } from '../../src/sim/testing/simRunner'
import { makeTavernState, withArea } from '../../src/sim/testing/stateFactories'
import {
  OWNER_ACTIONS_MODULE_ID,
  getOwnerActionsModuleState,
} from '../../src/sim/modules/ownerActions/stateHelpers'
import type { OwnerPolicyState } from '../../src/sim/modules/ownerActions/types'
import type { AreaState, ReputationState, CultureWorldState } from '../../src/sim/state/TavernState'

function makeArea(id: string, patch: Partial<AreaState> = {}): AreaState {
  return {
    id,
    label: id,
    condition: 100,
    cleanliness: 70,
    mess: 0,
    damage: 0,
    smell: 0,
    risk: 0,
    tags: [],
    activeProblems: [],
    traits: [],
    atmosphere: [],
    upgrades: {},
    ...patch,
  }
}

function makeReputation(patch: Partial<ReputationState> = {}): ReputationState {
  return {
    cheap: 0,
    tasty: 0,
    filthy: 0,
    dangerous: 0,
    cozy: 0,
    strange: 0,
    reliable: 0,
    goblinAuthentic: 0,
    respectable: 0,
    culinary_renown: 0,
    ...patch,
  }
}

function makePolicy(
  id: string,
  policyType: string,
  patch: Partial<OwnerPolicyState> = {},
): OwnerPolicyState {
  return {
    id,
    policyType,
    label: id,
    enabled: true,
    startedAtDay: 0,
    tags: [],
    effects: [],
    ...patch,
  }
}

// ---------- computeKnownFor ----------

describe('computeKnownFor', () => {
  it('returns empty for an all-zeros reputation', () => {
    expect(computeKnownFor(makeReputation())).toEqual([])
  })

  it('returns only axes at or above threshold', () => {
    const rep = makeReputation({
      cheap: KNOWN_FOR_THRESHOLD,
      tasty: KNOWN_FOR_THRESHOLD - 1,
      filthy: KNOWN_FOR_THRESHOLD + 5,
    })
    const result = computeKnownFor(rep)
    expect(result).toContain(AXIS_KNOWN_FOR.cheap)
    expect(result).toContain(AXIS_KNOWN_FOR.filthy)
    expect(result).not.toContain(AXIS_KNOWN_FOR.tasty)
  })

  it('sorts by value desc and caps at 3', () => {
    const rep = makeReputation({
      cheap: 60,
      tasty: 80,
      filthy: 70,
      dangerous: 65,
      cozy: 90,
    })
    const result = computeKnownFor(rep)
    expect(result).toHaveLength(3)
    expect(result[0]).toBe(AXIS_KNOWN_FOR.cozy)
    expect(result[1]).toBe(AXIS_KNOWN_FOR.tasty)
    expect(result[2]).toBe(AXIS_KNOWN_FOR.filthy)
  })

  it('is deterministic for equal values', () => {
    const rep = makeReputation({ cheap: 80, tasty: 80, filthy: 80 })
    const a = computeKnownFor(rep)
    const b = computeKnownFor(rep)
    expect(a).toEqual(b)
  })
})

// ---------- computeHouseRules ----------

describe('computeHouseRules', () => {
  it('returns empty for no policies', () => {
    expect(computeHouseRules({})).toEqual([])
  })

  it('only includes enabled policies', () => {
    const policies = {
      a: makePolicy('a', 'allow_tabs_for_regulars', { enabled: true }),
      b: makePolicy('b', 'ban_weapons_inside', { enabled: false }),
    }
    const out = computeHouseRules(policies)
    expect(out).toContain(POLICY_HOUSE_RULE.allow_tabs_for_regulars)
    expect(out).not.toContain(POLICY_HOUSE_RULE.ban_weapons_inside)
  })

  it('falls back to the policy label when no mapping exists', () => {
    const policies = {
      x: makePolicy('x', 'custom_policy_name', { label: 'My Custom Rule' }),
    }
    const out = computeHouseRules(policies)
    expect(out).toEqual(['my custom rule'])
  })

  it('orders by startedAtDay ascending', () => {
    const policies = {
      late: makePolicy('late', 'ban_weapons_inside', { startedAtDay: 10 }),
      early: makePolicy('early', 'allow_tabs_for_regulars', { startedAtDay: 2 }),
    }
    const out = computeHouseRules(policies)
    expect(out[0]).toBe(POLICY_HOUSE_RULE.allow_tabs_for_regulars)
    expect(out[1]).toBe(POLICY_HOUSE_RULE.ban_weapons_inside)
  })

  it('deduplicates', () => {
    const policies = {
      a: makePolicy('a', 'custom', { label: 'Same Rule' }),
      b: makePolicy('b', 'custom', { label: 'Same Rule' }),
    }
    const out = computeHouseRules(policies)
    expect(out).toEqual(['same rule'])
  })
})

// ---------- computeAtmosphereTags ----------

describe('computeAtmosphereTags', () => {
  it('returns empty when no areas or cultures', () => {
    expect(computeAtmosphereTags({}, {})).toEqual([])
  })

  it('emits a fragment when ≥ 50% of areas match a flag', () => {
    const areas = {
      a: makeArea('a', { cleanliness: 30 }), // grimy
      b: makeArea('b', { cleanliness: 30 }), // grimy
      c: makeArea('c', { cleanliness: 80 }),
    }
    const out = computeAtmosphereTags(areas, {})
    expect(out).toContain('grimy floors')
  })

  it('does not emit a fragment when below 50%', () => {
    const areas = {
      a: makeArea('a', { cleanliness: 30 }),
      b: makeArea('b', { cleanliness: 80 }),
      c: makeArea('c', { cleanliness: 80 }),
    }
    const out = computeAtmosphereTags(areas, {})
    expect(out).not.toContain('grimy floors')
  })

  it('emits a culture fragment when familiar + comfortable', () => {
    const cultures: Record<string, CultureWorldState> = {
      goblin: {
        id: 'goblin',
        label: 'Goblin',
        familiarity: 80,
        comfort: 80,
        tension: 0,
        namingProfileId: 'goblin',
        preferredStockTags: [],
        dislikedTags: [],
        importantCalendarTags: [],
        tags: [],
      },
    }
    const out = computeAtmosphereTags({}, cultures)
    expect(out).toContain('goblin-flavored')
  })

  it('caps at 5 fragments', () => {
    // 6 grimy + damaged + smelly + rowdy + 2 cultures = should clamp at 5
    const areas = {
      a: makeArea('a', { cleanliness: 20, damage: 80, smell: 80, risk: 80 }),
      b: makeArea('b', { cleanliness: 20, damage: 80, smell: 80, risk: 80 }),
    }
    const cultures: Record<string, CultureWorldState> = {
      a: {
        id: 'a',
        label: 'A',
        familiarity: 80,
        comfort: 80,
        tension: 0,
        namingProfileId: 'a',
        preferredStockTags: [],
        dislikedTags: [],
        importantCalendarTags: [],
        tags: [],
      },
      b: {
        id: 'b',
        label: 'B',
        familiarity: 80,
        comfort: 80,
        tension: 0,
        namingProfileId: 'b',
        preferredStockTags: [],
        dislikedTags: [],
        importantCalendarTags: [],
        tags: [],
      },
    }
    const out = computeAtmosphereTags(areas, cultures)
    expect(out.length).toBeLessThanOrEqual(5)
  })

  it('is deterministic for the same input', () => {
    const areas = { a: makeArea('a', { cleanliness: 30 }) }
    const a = computeAtmosphereTags(areas, {})
    const b = computeAtmosphereTags(areas, {})
    expect(a).toEqual(b)
  })
})

// ---------- End-to-end with the simulator ----------

describe('tavernIdentityModule integrated with FULL_PIPELINE', () => {
  it('populates knownFor and atmosphereTags after one day', () => {
    const before = createInitialTavernState()
    // Start with a meter set that should produce known-for entries.
    before.reputation.cheap = 75
    before.reputation.goblinAuthentic = 80
    before.reputation.filthy = 65

    const result = simulateDay(before, { seed: 'phase95-d1' }, FULL_PIPELINE)
    expect(result.state.world.tavernIdentity.knownFor.length).toBeGreaterThan(0)
    expect(result.state.world.tavernIdentity.knownFor).toContain(
      AXIS_KNOWN_FOR.goblinAuthentic,
    )
  })

  it('reacts to policy enablement on the next day', () => {
    let state = createInitialTavernState()
    // Inject an enabled policy directly into module state so we don't
    // need to drive the owner-action path.
    const slice = getOwnerActionsModuleState(state)
    slice.policies = {
      ...slice.policies,
      ban_weapons_inside: makePolicy('ban_weapons_inside', 'ban_weapons_inside', {
        enabled: true,
        startedAtDay: 0,
      }),
    }
    state = {
      ...state,
      modules: { ...state.modules, [OWNER_ACTIONS_MODULE_ID]: slice },
    }
    const result = simulateDay(state, { seed: 'phase95-policy' }, FULL_PIPELINE)
    expect(result.state.world.tavernIdentity.houseRules).toContain(
      POLICY_HOUSE_RULE.ban_weapons_inside,
    )
  })

  it('does not rewrite identity when the inputs are stable', () => {
    let state = createInitialTavernState()
    state.reputation.cheap = 75
    state.reputation.goblinAuthentic = 80
    const day1 = simulateDay(state, { seed: 'phase95-stable-d1' }, FULL_PIPELINE)
    const day2 = simulateDay(
      day1.state,
      { seed: 'phase95-stable-d2' },
      FULL_PIPELINE,
    )
    // After day1 the identity stabilises; day2's cause stream must
    // not contain a tavernIdentity.recompute write from a no-op.
    const causeFromDay2 = day2.state.causes.filter(
      (c) =>
        c.source === 'tavernIdentity.recompute' &&
        c.timestamp.absoluteDay === day2.state.calendar.totalDaysElapsed - 1,
    )
    // The recompute fires only when the array changes. On a stable day
    // we expect zero new tavernIdentity causes.
    expect(causeFromDay2.length).toBe(0)
  })

  it('emits a cause tagged tavern_identity when identity changes', () => {
    const state = createInitialTavernState()
    state.reputation.cheap = 80
    const result = simulateDay(state, { seed: 'phase95-emit' }, FULL_PIPELINE)
    const identityCauses = result.state.causes.filter((c) =>
      c.tags.includes('tavern_identity'),
    )
    expect(identityCauses.length).toBeGreaterThanOrEqual(1)
  })

  it('module is registered in FULL_PIPELINE', () => {
    expect(FULL_PIPELINE).toContain(tavernIdentityModule)
  })
})

describe('tavernIdentityModule multi-day stability', () => {
  it('settles on a deterministic identity vector after 14 days', () => {
    const stateA = createInitialTavernState()
    const stateB = createInitialTavernState()
    let currentA = stateA
    let currentB = stateB
    for (let i = 0; i < 14; i += 1) {
      currentA = simulateDay(currentA, { seed: `phase95-stable-${i}` }, FULL_PIPELINE).state
      currentB = simulateDay(currentB, { seed: `phase95-stable-${i}` }, FULL_PIPELINE).state
    }
    expect(currentA.world.tavernIdentity.knownFor).toEqual(
      currentB.world.tavernIdentity.knownFor,
    )
    expect(currentA.world.tavernIdentity.houseRules).toEqual(
      currentB.world.tavernIdentity.houseRules,
    )
    expect(currentA.world.tavernIdentity.atmosphereTags).toEqual(
      currentB.world.tavernIdentity.atmosphereTags,
    )
  })

  it('reflects area drift in atmosphereTags', () => {
    let state = createInitialTavernState()
    // Force all 5 areas to be grimy.
    for (const id of Object.keys(state.areas)) {
      state = withArea(state, id, { cleanliness: 20 })
    }
    const result = simulateDay(state, { seed: 'phase95-grime' }, FULL_PIPELINE)
    expect(result.state.world.tavernIdentity.atmosphereTags).toContain(
      'grimy floors',
    )
  })
})
