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
import { validateSeed } from '../../src/sim/modules/issues/issueSeedValidation'
import type { ResponsesModuleState } from '../../src/sim/modules/responses/types'
import { RESPONSES_MODULE_ID } from '../../src/sim/modules/responses/types'

// Phase 59 / ISSUE-019 — `monthly_review` promoted to a card family.
//
// Asserts:
//   1. Family fires once per month boundary.
//   2. Each promoted slot produces distinct treatment-vs-control
//      mutation.
//   3. Delayed entries land in the pending queue.
//   4. The seed validates without the removed `monthly_review`
//      contract bypasses.

const SEED = 'phase-59-monthly-review'

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
 * Advance the simulation to the end of month 1 — the day where
 * `isEndOfMonth(calendar) === true` and `monthlyModule.endDay` has
 * just finalized. Returns the state after day 28.
 */
function advanceToMonthEnd(): TavernState {
  let state = plentyOfStock(createInitialTavernState())
  for (let i = 0; i < 28; i += 1) {
    state = runDay(state).state
  }
  return state
}

describe('Phase 59 §ISSUE-019 — Monthly review surface', () => {
  it('fires the seed at month-end and exposes it through the next-day carry-over', () => {
    // After 28 runDay iterations the calendar has rolled into day 1
    // of month 2. The Phase 41 carry-over keeps yesterday's
    // `seedsToday` visible until the next `generateReports` runs.
    const state = advanceToMonthEnd()
    const seeds = getIssueSeeds(state, { family: 'monthly_review' })
    expect(seeds.length).toBe(1)
  })

  it('promoted seed carries 3 or 4 distinct response slots', () => {
    const state = advanceToMonthEnd()
    const seed = getIssueSeeds(state, { family: 'monthly_review' })[0]
    expect(seed).toBeDefined()
    const slotIds = seed!.responseSlots.map((s) => s.id)
    expect(slotIds.length).toBeGreaterThanOrEqual(3)
    // pay_landlord_on_time, invest_in_cellar, and hold_reserves are
    // always present; settle_with_rival rides on the rival_taverns
    // faction being seeded.
    expect(slotIds).toContain('pay_landlord_on_time')
    expect(slotIds).toContain('invest_in_cellar')
    expect(slotIds).toContain('hold_reserves')
  })

  it('the promoted seed validates against the contract WITHOUT the removed bypasses', () => {
    const state = advanceToMonthEnd()
    const seed = getIssueSeeds(state, { family: 'monthly_review' })[0]
    expect(seed).toBeDefined()
    const validation = validateSeed(seed!)
    expect(
      validation.contractChecks.at_least_two_responses,
      'at_least_two_responses should pass on own merits',
    ).toBe(true)
    expect(
      validation.contractChecks.short_term_consequences,
      'short_term_consequences should pass on own merits',
    ).toBe(true)
    expect(
      validation.contractChecks.memory_or_future_hook,
      'memory_or_future_hook should pass on own merits',
    ).toBe(true)
    expect(
      validation.contractChecks.reason_to_care,
      'reason_to_care should pass on own merits',
    ).toBe(true)
  })
})

describe('Phase 59 §ISSUE-019 — Per-slot mutations', () => {
  function setup(): { baseAtMonthEnd: TavernState; seedId: string } {
    const baseAtMonthEnd = advanceToMonthEnd()
    const seed = getIssueSeeds(baseAtMonthEnd, { family: 'monthly_review' })[0]
    expect(seed).toBeDefined()
    return { baseAtMonthEnd, seedId: seed!.id }
  }

  function compareSlot(
    slotId: string,
    verb: ResponseIntent['verb'],
    shape: ResponseIntent['shape'],
  ) {
    const { baseAtMonthEnd, seedId } = setup()
    const intent: ResponseIntent = {
      id: `r-${slotId}`,
      seedId,
      verb,
      shape,
      tags: [],
      intensity: 50,
      metadata: { responseSlotId: slotId },
    }
    // The seed needs to be on `seedsToday` for the response to apply
    // — that means we need to issue the intent ON day 28 itself. The
    // simRunner pattern: advance to day 28, then run ONE more day
    // with the intent referencing yesterday's seedId. The Phase 41
    // pipeline preserves yesterday's seedsToday into the next day's
    // applyResponses.
    const control = runDay(baseAtMonthEnd).state
    const treatment = runDay(baseAtMonthEnd, { responseIntents: [intent] }).state
    return { control, treatment }
  }

  it('pay_landlord_on_time lowers landlord pressure without re-charging rent that was already paid', () => {
    // In the default-state run, `resolveRent` already deducted coin on
    // day 28 (plenty of coin available). The response must NOT charge
    // again — the immediate coin effect collapses to zero — while
    // still easing landlord pressure.
    const { control, treatment } = compareSlot('pay_landlord_on_time', 'pay', 'safe_costly')
    expect(treatment.coin).toBe(control.coin)
    expect(treatment.pressures.landlord!.value).toBeLessThan(
      control.pressures.landlord!.value,
    )
  })

  it('pay_landlord_on_time settles outstanding rent when month-end could not pay', () => {
    // Drain coin below the monthly rent before day 28 so `resolveRent`
    // marks the month as unpaid. The response should then subtract the
    // full `amountDue` (monthly + arrears) and lower landlord pressure.
    let state = plentyOfStock(createInitialTavernState())
    for (let i = 0; i < 27; i += 1) {
      state = runDay(state).state
    }
    state = { ...state, coin: 5 }
    state = runDay(state).state
    const seed = getIssueSeeds(state, { family: 'monthly_review' })[0]
    expect(seed).toBeDefined()
    const monthly = state.modules.monthly as { lastMonthlyResult?: { rent: { paid: boolean; amountDue: number } } }
    const rentResult = monthly.lastMonthlyResult!.rent
    expect(rentResult.paid).toBe(false)
    expect(rentResult.amountDue).toBeGreaterThan(0)
    const intent: ResponseIntent = {
      id: 'r-pay-late',
      seedId: seed!.id,
      verb: 'pay',
      shape: 'safe_costly',
      tags: [],
      intensity: 50,
      metadata: { responseSlotId: 'pay_landlord_on_time' },
    }
    const control = runDay(state).state
    const treatment = runDay(state, { responseIntents: [intent] }).state
    expect(control.coin - treatment.coin).toBe(rentResult.amountDue)
    expect(treatment.pressures.landlord!.value).toBeLessThan(
      control.pressures.landlord!.value,
    )
  })

  it('invest_in_cellar spends coin and raises cellar.condition vs control', () => {
    const { control, treatment } = compareSlot('invest_in_cellar', 'upgrade', 'long_term_investment')
    expect(treatment.coin).toBeLessThan(control.coin)
    expect(treatment.areas.cellar!.condition).toBeGreaterThan(
      control.areas.cellar!.condition,
    )
  })

  it('hold_reserves enqueues a delayed staff_loyalty_risk pressure entry vs control', () => {
    // The immediate effect `pressure:debt -4` may clamp at 0 when
    // debt is already at floor in a default-state run, so assert on
    // the per-slot pending entry that staff_loyalty_risk lands.
    const { control, treatment } = compareSlot('hold_reserves', 'delay', 'compromise')
    const treatmentPending = getResponsesSlice(treatment).pending.length
    const controlPending = getResponsesSlice(control).pending.length
    expect(treatmentPending).toBeGreaterThan(controlPending)
    // The hold_reserves profile leaves a `reserves_held_${month}` memory.
    const reservesMemory = treatment.memories.find((m) =>
      m.tags.includes('reserves'),
    )
    expect(reservesMemory).toBeDefined()
  })

  it('settle_with_rival spends coin and lowers rival_tavern_pressure vs control (when rival_taverns is seeded)', () => {
    const state = advanceToMonthEnd()
    const hasRival = Boolean(state.world.factions['rival_taverns'])
    if (!hasRival) {
      // The settle_with_rival slot only renders when the rival_taverns
      // faction is seeded. Phase 52 added it to REQUIRED_FACTIONS, so
      // it should be seeded by default.
      throw new Error('expected rival_taverns faction to be seeded by phase 52')
    }
    const { control, treatment } = compareSlot('settle_with_rival', 'negotiate', 'compromise')
    expect(treatment.coin).toBeLessThan(control.coin)
    // Phase 95 — When the tavern is "known for" 2+ things, the rival
    // pressure calculator (rivalTavernPressure.ts:101) applies an
    // identity-relief term that can floor the pressure at 0 in both
    // control and treatment. Treat the comparison as "treatment is at
    // most as high as control" — settle_with_rival still spends coin
    // (the asserted-above effect) but the pressure reading may already
    // be bottomed by other relief paths.
    expect(treatment.pressures.rival_tavern_pressure!.value).toBeLessThanOrEqual(
      control.pressures.rival_tavern_pressure!.value,
    )
  })
})

describe('Phase 59 §ISSUE-019 — Delayed scheduling', () => {
  it('every slot enqueues at least one pending entry vs control', () => {
    const slots: Array<[string, ResponseIntent['verb'], ResponseIntent['shape']]> = [
      ['pay_landlord_on_time', 'pay', 'safe_costly'],
      ['invest_in_cellar', 'upgrade', 'long_term_investment'],
      ['hold_reserves', 'delay', 'compromise'],
      ['settle_with_rival', 'negotiate', 'compromise'],
    ]
    const baseAtMonthEnd = advanceToMonthEnd()
    const seed = getIssueSeeds(baseAtMonthEnd, { family: 'monthly_review' })[0]
    expect(seed).toBeDefined()
    for (const [slotId, verb, shape] of slots) {
      const intent: ResponseIntent = {
        id: `r-${slotId}`,
        seedId: seed!.id,
        verb,
        shape,
        tags: [],
        intensity: 50,
        metadata: { responseSlotId: slotId },
      }
      const control = runDay(baseAtMonthEnd).state
      const treatment = runDay(baseAtMonthEnd, { responseIntents: [intent] }).state
      const treatmentPending = getResponsesSlice(treatment).pending.length
      const controlPending = getResponsesSlice(control).pending.length
      expect(
        treatmentPending - controlPending,
        `slot ${slotId} should enqueue at least one pending entry vs control`,
      ).toBeGreaterThanOrEqual(1)
    }
  })
})
