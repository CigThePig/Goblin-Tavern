import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'

import { FULL_PIPELINE } from '../../src/sim/testing/simRunner'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import type {
  ResponseIntent,
} from '../../src/sim/modules/issues/issueSeedTypes'
import { getIssueSeeds } from '../../src/sim/modules/issues/issueSeedQueries'
import type { ResponsesModuleState } from '../../src/sim/modules/responses/types'
import { RESPONSES_MODULE_ID } from '../../src/sim/modules/responses/types'

// Phase 53 / ISSUE-013 — `policy_backlash` family end-to-end.
//
// Pre-phase: 6 response slots collapsed through
// `responseSlots.map((slot) => makeProfile({...}))`. Each profile was a
// single `effect('cause', ...)` no-op. The `policyBacklashAttribution`
// rule also filtered for `direction === 'decrease'` which never matched
// because `policy_backlash` emits increase-direction causes.
//
// This test asserts:
//   1. 6 distinct response slot ids + 6 distinct consequence profile ids.
//   2. Per-slot mutations differ — pressure deltas in the expected
//      direction; slot-specific signals land in the state.
//   3. Slots with delayed effects / futureHooks park entries in
//      `state.modules.responses.pending`.
//   4. The widened attribution rule produces drafts from policy-tagged
//      causes regardless of cause direction.

const SEED = 'phase-53-policy-backlash'

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

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

function runDay(state: TavernState, overrides: Partial<SimInput> = {}) {
  return simulateDay(state, input(overrides), FULL_PIPELINE)
}

function getResponsesSlice(state: TavernState): ResponsesModuleState {
  return state.modules[RESPONSES_MODULE_ID] as ResponsesModuleState
}

function pressureValue(state: TavernState, id: string): number {
  // Read from `state.pressures[id]`, which is the runtime-mutable value
  // that response effects shift via `ctx.modifyPressure`. The snapshot
  // in `state.modules.pressures.snapshots` is captured before
  // `applyResponses` runs, so it doesn't reflect the response delta.
  return state.pressures[id]?.value ?? 0
}

/**
 * Set up a state that drives `pressure:policy_backlash` value >= 25 via
 * (a) the default-enabled `cheap_payday_specials` policy (tags include
 * `risky`, which the `merchants` group dislikes — contributes the
 * `active_policies` + `disliking_groups` causes), and (b) cranking every
 * starter regular's irritation past the 25 avg threshold to add the
 * `regular_irritation` cause. The combined value clears the 25 gate.
 */
function policyBacklashState(): TavernState {
  const base = plentyOfStock(createInitialTavernState())
  const irritatedRegulars = Object.fromEntries(
    Object.entries(base.world.regulars).map(([id, r]) => [
      id,
      { ...r, irritation: 80, loyalty: 30 },
    ]),
  )
  return {
    ...base,
    world: {
      ...base.world,
      regulars: irritatedRegulars,
    },
  }
}

// Phase 186 / Cluster 1 — `policy_backlash` is a morning seed reading the
// prior day's closing pressure snapshot, so warm one day to populate it.
// `warmState` is the day FROM which the response is issued: re-running it
// regenerates the identical seed at `startDay`, so the response resolves
// the same day.
function setupPolicyBacklashSeed(): {
  warmState: TavernState
  seedId: string
} {
  const base = policyBacklashState()
  const warm = runDay(base)
  const probe = runDay(warm.state)
  expect(pressureValue(probe.state, 'policy_backlash')).toBeGreaterThanOrEqual(25)
  const seeds = getIssueSeeds(probe.state, { family: 'policy_backlash' })
  expect(seeds.length).toBeGreaterThan(0)
  return { warmState: warm.state, seedId: seeds[0]!.id }
}

describe('Phase 53 §ISSUE-013 — Seed contract', () => {
  it('surfaces 6 distinct response slots and 6 distinct consequence profile ids', () => {
    const base = policyBacklashState()
    const warm = runDay(base)
    const day1 = runDay(warm.state)
    const seed = getIssueSeeds(day1.state, { family: 'policy_backlash' })[0]
    expect(seed).toBeDefined()
    const slotIds = seed!.responseSlots.map((s) => s.id).sort()
    expect(slotIds).toEqual(
      [
        'explain_policy',
        'keep_policy',
        'make_exception',
        'modify_policy',
        'punish_violation',
        'repeal_policy',
      ],
    )
    const profileIds = seed!.consequenceProfiles.map((p) => p.id).sort()
    expect(new Set(profileIds).size).toBe(6)

    // Each profile carries at least one delayedEffect or futureHook —
    // i.e. not a flat all-immediate no-op.
    for (const profile of seed!.consequenceProfiles) {
      const hasDelayedOrHook =
        profile.delayedEffects.length > 0 || profile.futureHooks.length > 0
      expect(
        hasDelayedOrHook,
        `profile ${profile.id} has no delayedEffect or futureHook`,
      ).toBe(true)
    }
  })
})

describe('Phase 53 §ISSUE-013 — Per-slot distinct mutations', () => {
  function compareSlot(
    slotId: string,
    verb: ResponseIntent['verb'],
    shape: ResponseIntent['shape'],
  ) {
    const { warmState, seedId } = setupPolicyBacklashSeed()
    const intent: ResponseIntent = {
      id: `r-${slotId}`,
      seedId,
      verb,
      shape,
      tags: [],
      intensity: 50,
      metadata: { responseSlotId: slotId },
    }
    // Control run — same state, no response intent. Treatment — same
    // state, with response intent. Comparing the two isolates the
    // response effect from the day's natural pressure recalculation.
    const control = runDay(warmState).state
    const treatment = runDay(warmState, { responseIntents: [intent] }).state
    return { control, treatment }
  }

  it('keep_policy raises policy_backlash and faction_anger vs control', () => {
    const { control, treatment } = compareSlot('keep_policy', 'ignore', 'escalation')
    expect(pressureValue(treatment, 'policy_backlash')).toBeGreaterThan(
      pressureValue(control, 'policy_backlash'),
    )
    expect(pressureValue(treatment, 'faction_anger')).toBeGreaterThan(
      pressureValue(control, 'faction_anger'),
    )
  })

  it('modify_policy lowers policy_backlash and spends coin vs control', () => {
    const { control, treatment } = compareSlot('modify_policy', 'negotiate', 'compromise')
    expect(pressureValue(treatment, 'policy_backlash')).toBeLessThan(
      pressureValue(control, 'policy_backlash'),
    )
    expect(treatment.coin).toBeLessThan(control.coin)
  })

  it('repeal_policy strongly lowers policy_backlash and dents respectability vs control', () => {
    const { control, treatment } = compareSlot('repeal_policy', 'rebrand', 'reputation_play')
    const backlashDelta =
      pressureValue(control, 'policy_backlash') -
      pressureValue(treatment, 'policy_backlash')
    expect(backlashDelta).toBeGreaterThanOrEqual(15)
    expect(treatment.reputation.respectable).toBeLessThan(
      control.reputation.respectable,
    )
    const repealMemory = treatment.memories.find((m) =>
      m.tags.includes('repeal'),
    )
    expect(repealMemory).toBeDefined()
  })

  it('make_exception lowers policy_backlash vs control', () => {
    // Default policy `cheap_payday_specials` has no targetId — its
    // make_exception slot falls back to the policy ref itself, so this
    // test verifies the slot still runs and lowers backlash without
    // throwing when no concrete target exists.
    const { control, treatment } = compareSlot('make_exception', 'negotiate', 'compromise')
    expect(pressureValue(treatment, 'policy_backlash')).toBeLessThan(
      pressureValue(control, 'policy_backlash'),
    )
  })

  it('explain_policy lowers policy_backlash and lifts respectability vs control', () => {
    const { control, treatment } = compareSlot('explain_policy', 'rebrand', 'compromise')
    expect(pressureValue(treatment, 'policy_backlash')).toBeLessThan(
      pressureValue(control, 'policy_backlash'),
    )
    expect(treatment.reputation.respectable).toBeGreaterThan(
      control.reputation.respectable,
    )
  })

  it('punish_violation raises violence and faction_anger vs control', () => {
    const { control, treatment } = compareSlot('punish_violation', 'threaten', 'escalation')
    expect(pressureValue(treatment, 'violence')).toBeGreaterThan(
      pressureValue(control, 'violence'),
    )
    expect(pressureValue(treatment, 'faction_anger')).toBeGreaterThan(
      pressureValue(control, 'faction_anger'),
    )
  })
})

describe('Phase 53 §ISSUE-013 — Delayed scheduling', () => {
  it('keep_policy parks delayed pressure + future hook entries', () => {
    const { warmState, seedId } = setupPolicyBacklashSeed()
    const intent: ResponseIntent = {
      id: 'r-keep',
      seedId,
      verb: 'ignore',
      shape: 'escalation',
      tags: [],
      intensity: 50,
      metadata: { responseSlotId: 'keep_policy' },
    }
    const day2 = runDay(warmState, { responseIntents: [intent] })
    const slice = getResponsesSlice(day2.state)
    expect(slice.pending.length).toBeGreaterThanOrEqual(1)
    const today = day2.state.calendar.totalDaysElapsed
    expect(slice.pending.every((p) => p.scheduledFor > today)).toBe(true)
  })

  it('repeal_policy parks at least one delayed entry and one future hook', () => {
    const { warmState, seedId } = setupPolicyBacklashSeed()
    const intent: ResponseIntent = {
      id: 'r-repeal',
      seedId,
      verb: 'rebrand',
      shape: 'reputation_play',
      tags: [],
      intensity: 50,
      metadata: { responseSlotId: 'repeal_policy' },
    }
    const day2 = runDay(warmState, { responseIntents: [intent] })
    const slice = getResponsesSlice(day2.state)
    expect(slice.pending.length).toBeGreaterThanOrEqual(2)
  })
})

describe('Phase 53 §ISSUE-013 — Attribution rule un-filtered', () => {
  it('produces at least one attribution from policy-tagged increase-direction causes', () => {
    // Run several days with the policy_backlash state to accumulate
    // policy-tagged causes from the pressure calculator (which emits
    // increase-direction causes).
    let state = policyBacklashState()
    for (let i = 0; i < 5; i += 1) {
      state = runDay(state).state
    }
    const policyCauses = state.causes.filter((c) => c.tags.includes('policy'))
    expect(policyCauses.length).toBeGreaterThan(0)

    const attributions = (
      state.modules.attribution as
        | {
            attributions: Array<{
              sourceCauseIds: string[]
              tags: string[]
            }>
          }
        | undefined
    )?.attributions ?? []
    const policyAttribution = attributions.find((a) => a.tags.includes('policy'))
    expect(policyAttribution).toBeDefined()
  })
})
