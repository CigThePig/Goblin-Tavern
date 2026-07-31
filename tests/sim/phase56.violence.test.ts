import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import type { ResponseIntent } from '../../src/sim/modules/issues/issueSeedTypes'
import { getIssueSeeds } from '../../src/sim/modules/issues/issueSeedQueries'
import type { ResponsesModuleState } from '../../src/sim/modules/responses/types'
import { RESPONSES_MODULE_ID } from '../../src/sim/modules/responses/types'
import { withArea, withCustomerGroup } from '../../src/sim/testing/stateFactories'

// Phase 56 / ISSUE-016 — `violence` family rewrite + rotation.

const SEED = 'phase-56-violence'

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

/** Find a day where the budget admits the violence card and return the state
 * immediately before it. Other legitimate cards can win the finite hand on
 * earlier days, so pinning this behavior test to exactly day two is brittle. */
function findViolenceSetup(): {
  stateBeforeSeed: TavernState
  seed: NonNullable<ReturnType<typeof getIssueSeeds>[number]>
} {
  let stateBeforeSeed = violenceState()
  for (let day = 0; day < 14; day += 1) {
    const probe = runDay(stateBeforeSeed)
    const seed = getIssueSeeds(probe.state, { family: 'violence' })[0]
    if (seed) return { stateBeforeSeed, seed }
    stateBeforeSeed = probe.state
  }
  throw new Error('violence seed did not surface within 14 days')
}

/**
 * Set up a state where violence pressure is elevated AND multiple
 * customer groups carrying violence tags (`rowdy`, `dangerous`,
 * `incident_prone`) are present with elevated patronage + rowdiness.
 */
function violenceState(): TavernState {
  let base = plentyOfStock(createInitialTavernState())
  base = withCustomerGroup(base, 'ogres', { patronage: 85, rowdiness: 90 })
  base = withCustomerGroup(base, 'adventurers', { patronage: 70, rowdiness: 80 })
  base = withCustomerGroup(base, 'miners', { patronage: 65, rowdiness: 75 })
  base = withArea(base, 'main_room', { damage: 60 })
  // Bump dangerous reputation past 60 so the violence calculator
  // clears its 35 gate (ogres heavy+rowdy + adventurers present + dangerous
  // rep = 14 + 10 + 6 + 8 = 38).
  return {
    ...base,
    reputation: {
      ...base.reputation,
      dangerous: 70,
    },
  }
}

describe('Phase 56 §ISSUE-016 — Group rotation', () => {
  it('rotates the picked group across multiple days when several groups carry violence tags', () => {
    let state = violenceState()
    const picked = new Set<string>()
    for (let i = 0; i < 14; i += 1) {
      const result = runDay(state)
      state = result.state
      const seeds = getIssueSeeds(state, { family: 'violence' })
      const seed = seeds[0]
      if (seed?.primaryActor) {
        picked.add(seed.primaryActor.id)
      }
    }
    expect(picked.size).toBeGreaterThanOrEqual(2)
  })
})

describe('Phase 56 §ISSUE-016 — Per-slot mutations', () => {
  // Phase 186 / Cluster 1 — `violence` is a during-service seed gated on
  // the prior day's closing pressure snapshot. `stateBeforeSeed` is the day
  // FROM which the response is issued.
  function setup() {
    const { stateBeforeSeed, seed } = findViolenceSetup()
    return { stateBeforeSeed, seed, targetId: seed.primaryActor!.id }
  }

  function compareSlot(
    slotId: string,
    verb: ResponseIntent['verb'],
    shape: ResponseIntent['shape'],
  ) {
    const { stateBeforeSeed, seed, targetId } = setup()
    const intent: ResponseIntent = {
      id: `r-${slotId}`,
      seedId: seed.id,
      verb,
      shape,
      tags: [],
      intensity: 50,
      metadata: { responseSlotId: slotId },
    }
    const control = runDay(stateBeforeSeed).state
    const treatment = runDay(stateBeforeSeed, { responseIntents: [intent] }).state
    return { control, treatment, targetId }
  }

  it('hire_security spends coin and lowers violence vs control', () => {
    const { control, treatment } = compareSlot('hire_security', 'pay', 'safe_costly')
    expect(treatment.coin).toBeLessThan(control.coin)
    expect(treatment.pressures.violence!.value).toBeLessThan(
      control.pressures.violence!.value,
    )
  })

  it('ban_group drops the targeted group patronage vs control', () => {
    const { control, treatment, targetId } = compareSlot(
      'ban_group',
      'ban',
      'relationship_sacrifice',
    )
    expect(treatment.customerGroups[targetId]!.patronage).toBeLessThan(
      control.customerGroups[targetId]!.patronage,
    )
  })

  it('embrace_rowdy raises dangerous and lowers respectable vs control', () => {
    const { control, treatment } = compareSlot('embrace_rowdy', 'rebrand', 'reputation_play')
    expect(treatment.reputation.dangerous).toBeGreaterThan(control.reputation.dangerous)
    expect(treatment.reputation.respectable).toBeLessThan(
      control.reputation.respectable,
    )
  })

  it('repair_damage lowers main_room damage and spends coin vs control', () => {
    const { control, treatment } = compareSlot('repair_damage', 'repair', 'short_term_patch')
    expect(treatment.areas.main_room!.damage).toBeLessThan(
      control.areas.main_room!.damage,
    )
    expect(treatment.coin).toBeLessThan(control.coin)
  })
})

describe('Phase 56 §ISSUE-016 — Delayed scheduling', () => {
  it('every slot enqueues at least one pending entry', () => {
    const slots: Array<[string, ResponseIntent['verb'], ResponseIntent['shape']]> = [
      ['hire_security', 'pay', 'safe_costly'],
      ['ban_group', 'ban', 'relationship_sacrifice'],
      ['embrace_rowdy', 'rebrand', 'reputation_play'],
      ['repair_damage', 'repair', 'short_term_patch'],
    ]
    for (const [slotId, verb, shape] of slots) {
      const { stateBeforeSeed, seed } = findViolenceSetup()
      const intent: ResponseIntent = {
        id: `r-${slotId}`,
        seedId: seed.id,
        verb,
        shape,
        tags: [],
        intensity: 50,
        metadata: { responseSlotId: slotId },
      }
      const day2 = runDay(stateBeforeSeed, { responseIntents: [intent] })
      const slice = getResponsesSlice(day2.state)
      expect(
        slice.pending.length,
        `slot ${slotId} should enqueue at least one pending entry`,
      ).toBeGreaterThanOrEqual(1)
    }
  })
})
