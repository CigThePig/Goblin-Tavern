import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'

import { FULL_PIPELINE } from '../../src/sim/testing/simRunner'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import type { ResponseIntent } from '../../src/sim/modules/issues/issueSeedTypes'
import { getIssueSeeds } from '../../src/sim/modules/issues/issueSeedQueries'
import type { ResponsesModuleState } from '../../src/sim/modules/responses/types'
import { RESPONSES_MODULE_ID } from '../../src/sim/modules/responses/types'
import { withStaff } from '../../src/sim/testing/stateFactories'

// Phase 57 / ISSUE-017 — `staff_burnout` family rewrite + rotation.

const SEED = 'phase-57-staff-burnout'

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

/**
 * Push every starter staff member past the burnout threshold so the
 * picker has multiple candidates to rotate across.
 */
function burnoutState(): TavernState {
  let base = plentyOfStock(createInitialTavernState())
  base = withStaff(base, 'cook', { stress: 80, fatigue: 75 })
  base = withStaff(base, 'server', { stress: 75, fatigue: 70 })
  base = withStaff(base, 'cleaner_bouncer', { stress: 70, fatigue: 65 })
  return base
}

describe('Phase 57 §ISSUE-017 — Staff rotation', () => {
  it('rotates the picked staff across multiple days when several are above threshold', () => {
    let state = burnoutState()
    const picked = new Set<string>()
    for (let i = 0; i < 14; i += 1) {
      const result = runDay(state)
      state = result.state
      const seeds = getIssueSeeds(state, { family: 'staff_burnout' })
      const seed = seeds[0]
      if (seed?.primaryActor) {
        picked.add(seed.primaryActor.id)
      }
    }
    expect(picked.size).toBeGreaterThanOrEqual(2)
  })
})

describe('Phase 57 §ISSUE-017 — Per-slot mutations', () => {
  function setup() {
    const base = burnoutState()
    const day1 = runDay(base)
    const seed = getIssueSeeds(day1.state, { family: 'staff_burnout' })[0]
    expect(seed).toBeDefined()
    return {
      baseAfterDay1: day1.state,
      seed: seed!,
      targetId: seed!.primaryActor!.id,
    }
  }

  function compareSlot(
    slotId: string,
    verb: ResponseIntent['verb'],
    shape: ResponseIntent['shape'],
  ) {
    const { baseAfterDay1, seed, targetId } = setup()
    const intent: ResponseIntent = {
      id: `r-${slotId}`,
      seedId: seed.id,
      verb,
      shape,
      tags: [],
      intensity: 50,
      metadata: { responseSlotId: slotId },
    }
    const control = runDay(baseAfterDay1).state
    const treatment = runDay(baseAfterDay1, { responseIntents: [intent] }).state
    return { control, treatment, targetId }
  }

  it('pay_bonus raises target morale and spends coin vs control', () => {
    const { control, treatment, targetId } = compareSlot('pay_bonus', 'pay', 'safe_costly')
    expect(treatment.staff[targetId]!.morale).toBeGreaterThan(
      control.staff[targetId]!.morale,
    )
    expect(treatment.coin).toBeLessThan(control.coin)
  })

  it('reduce_workload lowers target fatigue and raises another staff fatigue (via delayed) vs control', () => {
    const { control, treatment, targetId } = compareSlot(
      'reduce_workload',
      'delegate',
      'compromise',
    )
    expect(treatment.staff[targetId]!.fatigue).toBeLessThan(
      control.staff[targetId]!.fatigue,
    )
    // The cross-staff fatigue effect is delayed — it lands in the
    // pending queue. The treatment should have at least one pending
    // entry beyond what the control accrues.
    const treatmentPending = getResponsesSlice(treatment).pending.length
    const controlPending = getResponsesSlice(control).pending.length
    expect(treatmentPending).toBeGreaterThan(controlPending)
  })

  it('push_through enqueues a delayed burnout pressure and a per-staff quit risk hook', () => {
    const { control, treatment, targetId } = compareSlot('push_through', 'ignore', 'risky_profitable')
    const slice = getResponsesSlice(treatment)
    expect(slice.pending.length).toBeGreaterThan(
      getResponsesSlice(control).pending.length,
    )
    const quitHook = slice.pending.find((p) =>
      'effect' in p.payload && typeof p.payload.effect === 'object'
        ? (p.payload.effect as { target?: string }).target ===
          `staff_quit_risk_${targetId}`
        : false,
    )
    // Alt path: futureHook entries are stored under a memory_future_hook
    // kind, with the id on the memory payload.
    const memHook = slice.pending.find((p) =>
      p.payload.kind === 'memory_future_hook'
        ? (p.payload as { memory?: { id?: string } }).memory?.id ===
          `staff_quit_risk_${targetId}`
        : false,
    )
    expect(quitHook ?? memHook).toBeDefined()
  })

  it('reassign lowers target stress AND raises another staff fatigue vs control', () => {
    const { control, treatment, targetId } = compareSlot('reassign', 'delegate', 'compromise')
    expect(treatment.staff[targetId]!.stress).toBeLessThan(
      control.staff[targetId]!.stress,
    )
    // Cross-staff side effect: at least one OTHER staff member's
    // fatigue should differ from control by enough to be observable.
    const allStaffIds = Object.keys(treatment.staff)
    const otherIds = allStaffIds.filter((id) => id !== targetId)
    const crossStaffShifted = otherIds.some(
      (id) => treatment.staff[id]!.fatigue !== control.staff[id]!.fatigue,
    )
    expect(crossStaffShifted).toBe(true)
  })
})

describe('Choice-Preview Legibility Phase 5 — label composition', () => {
  // Regression: `staff.name` is a GeneratedName object; the labelHints
  // (and effect/stake readables) must interpolate `name.display`, not the
  // object itself — otherwise the rendered choice reads "Pay [object
  // Object] a bonus".
  it('pay_bonus and reduce_workload labels name the staff member, not [object Object]', () => {
    const base = burnoutState()
    const day1 = runDay(base)
    const seed = getIssueSeeds(day1.state, { family: 'staff_burnout' })[0]
    expect(seed).toBeDefined()
    const targetId = seed!.primaryActor!.id
    const display = day1.state.staff[targetId]!.name.display
    expect(display).toBeTruthy()

    const labelFor = (slotId: string) =>
      seed!.responseSlots.find((s) => s.id === slotId)?.labelHint ?? ''

    for (const slotId of ['pay_bonus', 'reduce_workload']) {
      const label = labelFor(slotId)
      expect(label).not.toContain('[object Object]')
      expect(label).toContain(display)
    }
  })
})

describe('Phase 57 §ISSUE-017 — Delayed scheduling', () => {
  it('every slot enqueues at least one pending entry', () => {
    const slots: Array<[string, ResponseIntent['verb'], ResponseIntent['shape']]> = [
      ['pay_bonus', 'pay', 'safe_costly'],
      ['reduce_workload', 'delegate', 'compromise'],
      ['push_through', 'ignore', 'risky_profitable'],
      ['reassign', 'delegate', 'compromise'],
    ]
    for (const [slotId, verb, shape] of slots) {
      const base = burnoutState()
      const day1 = runDay(base)
      const seed = getIssueSeeds(day1.state, { family: 'staff_burnout' })[0]
      expect(seed).toBeDefined()
      const intent: ResponseIntent = {
        id: `r-${slotId}`,
        seedId: seed!.id,
        verb,
        shape,
        tags: [],
        intensity: 50,
        metadata: { responseSlotId: slotId },
      }
      const control = runDay(day1.state).state
      const treatment = runDay(day1.state, { responseIntents: [intent] }).state
      const treatmentPending = getResponsesSlice(treatment).pending.length
      const controlPending = getResponsesSlice(control).pending.length
      expect(
        treatmentPending - controlPending,
        `slot ${slotId} should enqueue at least one pending entry vs control`,
      ).toBeGreaterThanOrEqual(1)
    }
  })
})
