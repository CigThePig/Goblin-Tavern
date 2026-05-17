import { describe, it, expect } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { areasModule } from '../../src/sim/modules/areas/index'
import { customersModule } from '../../src/sim/modules/customers/index'
import { ownerActionsModule } from '../../src/sim/modules/ownerActions/index'
import { serviceModule } from '../../src/sim/modules/service/index'
import { staffModule } from '../../src/sim/modules/staff/index'
import { stockModule } from '../../src/sim/modules/stock/index'
import { weeklyModule } from '../../src/sim/modules/weekly/index'
import {
  MONTHLY_MODULE_ID,
  MONTH_MODIFIERS,
  computeReputationShifts,
  computeUpgradeReadiness,
  emptyAccumulator,
  getMonthlyModuleState,
  getReputationTier,
  monthlyModule,
  pickMonthModifier,
  resolveLandlord,
  resolveInspection,
  resolveRivalTavern,
} from '../../src/sim/modules/monthly/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  withArea,
  withCoin,
  withCustomerGroup,
  withStock,
} from '../../src/sim/testing/stateFactories'
import {
  REQUIRED_POLICY_BOTS,
  autoAlwaysCleanBot,
  autoAlwaysRestockBot,
  autoNoOwnerActionsBot,
  policyBotInput,
} from '../../src/sim/testing/policyBots'
import type { TavernState } from '../../src/sim/state/TavernState'

// Phase 15 — Monthly pressure system tests.
//
// Covers the cases in `phases-11-15.md` §15 "Tests" plus the Phase 15.11
// three-bot sanity check.

const SEED = 'phase-15-monthly-test'

const FULL_PIPELINE = [
  areasModule,
  stockModule,
  staffModule,
  customersModule,
  ownerActionsModule,
  serviceModule,
  weeklyModule,
  monthlyModule,
]

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

function runDay(state: TavernState, overrides: Partial<SimInput> = {}) {
  return simulateDay(state, input(overrides), FULL_PIPELINE)
}

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

function runMonth(state: TavernState, overrides: Partial<SimInput> = {}): TavernState {
  let current = state
  for (let i = 0; i < 28; i += 1) {
    current = runDay(current, overrides).state
  }
  return current
}

describe('Phase 15 — Module shape', () => {
  it('monthlyModule registers id, hooks, schema, report, and validator', () => {
    expect(monthlyModule.id).toBe(MONTHLY_MODULE_ID)
    expect(monthlyModule.id).toBe('monthly')
    expect(monthlyModule.hooks?.startDay).toBeDefined()
    expect(monthlyModule.hooks?.endWeek).toBeDefined()
    expect(monthlyModule.hooks?.endMonth).toBeDefined()
    expect(monthlyModule.buildReport).toBeTypeOf('function')
    expect(monthlyModule.validate).toBeTypeOf('function')
    expect(monthlyModule.stateSchema).toBeDefined()
    expect(monthlyModule.dependsOn).toContain('weekly')
    expect(monthlyModule.dependsOn).toContain('stock')
  })

  it('createInitialTavernState seeds a monthly slice with reasonable defaults', () => {
    const state = createInitialTavernState()
    const slice = getMonthlyModuleState(state)
    expect(slice.rent.monthlyAmount).toBeGreaterThan(0)
    expect(slice.rent.paidThisMonth).toBe(false)
    expect(slice.landlord.opinion).toBeGreaterThanOrEqual(0)
    expect(slice.landlord.opinion).toBeLessThanOrEqual(100)
    expect(slice.inspection.suspicion).toBeGreaterThanOrEqual(0)
    expect(slice.rivalTavern.strategy).toBe('unknown')
    expect(slice.monthFinalized).toBe(false)
    expect(MONTH_MODIFIERS[slice.currentModifier.id]).toBeDefined()
  })

  it('the respectable reputation axis is part of the canonical set', () => {
    const state = createInitialTavernState()
    expect(typeof state.reputation.respectable).toBe('number')
    expect(state.reputation.respectable).toBeGreaterThanOrEqual(0)
    expect(state.reputation.respectable).toBeLessThanOrEqual(100)
  })
})

describe('Phase 15 §15.1 — endMonth gating', () => {
  it('endMonth runs only on the final day of the month', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 600)
    let current = base
    for (let i = 0; i < 27; i += 1) {
      current = runDay(current).state
      const slice = getMonthlyModuleState(current)
      expect(slice.monthFinalized).toBe(false)
      expect(slice.lastMonthlyResult).toBeUndefined()
    }
    current = runDay(current).state
    const finalSlice = getMonthlyModuleState(current)
    expect(finalSlice.monthFinalized).toBe(true)
    expect(finalSlice.lastMonthlyResult).toBeDefined()
    expect(finalSlice.lastMonthlyResult!.endDay).toBe(28)
  })

  it('the monthly accumulator resets at the start of the next month', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 600)
    const afterMonth1 = runMonth(base)
    const month1Slice = getMonthlyModuleState(afterMonth1)
    expect(month1Slice.monthFinalized).toBe(true)
    const month1Key = month1Slice.lastMonthlyResult!.monthKey

    const day29 = runDay(afterMonth1).state
    const slice = getMonthlyModuleState(day29)
    expect(slice.monthFinalized).toBe(false)
    // Phase 91 — `lastMonthlyResult` now persists across the next
    // month so the Reports → Monthly screen can read it beyond day 28
    // (the wipe used to leave the screen empty for 27/28 days). The
    // accumulator still resets cleanly for the new month.
    expect(slice.lastMonthlyResult).toBeDefined()
    expect(slice.lastMonthlyResult!.monthKey).toBe(month1Key)
    expect(slice.monthNumber).toBe(2)
    expect(slice.accumulator.weekKeys.length).toBe(0)
  })
})

describe('Phase 15 §15.2 — Rent', () => {
  it('rent is paid when coin is sufficient and reduces coin via the ledger', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 600)
    const result = runMonth(base)
    const slice = getMonthlyModuleState(result)
    expect(slice.rent.paidThisMonth).toBe(true)
    expect(slice.rent.arrears).toBe(0)
    expect(slice.lastMonthlyResult!.rent.paid).toBe(true)
    expect(slice.lastMonthlyResult!.rent.paidAmount).toBe(slice.rent.monthlyAmount)
  })

  it('rent paid through the Phase 9 ledger as category "rent"', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 600)
    let current = base
    let lastReports
    for (let i = 0; i < 28; i += 1) {
      const out = runDay(current)
      current = out.state
      lastReports = out.reports
    }
    // The economy slot in the monthly report should reflect a rent line.
    const monthly = lastReports!.find((r) => r.id === 'monthly')!
    const data = monthly.data as {
      economy: { rent: number }
    }
    expect(data.economy.rent).toBeGreaterThan(0)
  })

  it('missed rent increases missed payment count and arrears', () => {
    // Empty stock so no sales happen; start with 0 coin so rent cannot be paid.
    let base = withCoin(createInitialTavernState(), 0)
    for (const id of Object.keys(base.stock)) {
      base = withStock(base, id, { quantity: 0 })
    }
    const result = runMonth(base)
    const slice = getMonthlyModuleState(result)
    expect(slice.rent.paidThisMonth).toBe(false)
    expect(slice.rent.missedPayments).toBeGreaterThanOrEqual(1)
    expect(slice.rent.arrears).toBeGreaterThan(0)
    expect(slice.lastMonthlyResult!.rent.paid).toBe(false)
  })
})

describe('Phase 15 §15.3 — Landlord pressure', () => {
  it('missed rent increases landlord pressure', () => {
    let base = withCoin(createInitialTavernState(), 0)
    for (const id of Object.keys(base.stock)) {
      base = withStock(base, id, { quantity: 0 })
    }
    const before = getMonthlyModuleState(base).landlord.pressure
    const result = runMonth(base)
    expect(getMonthlyModuleState(result).landlord.pressure).toBeGreaterThan(before)
  })

  it('paying rent gives a pressure relief vs. missing rent under matched conditions', () => {
    const state = createInitialTavernState()
    const accum = emptyAccumulator()
    const paid = resolveLandlord(
      state,
      { opinion: 50, pressure: 30, missedRentCount: 0 },
      {
        amountDue: 120,
        paid: true,
        paidAmount: 120,
        arrears: 0,
        missedPayments: 0,
      },
      accum,
      30,
    )
    const missed = resolveLandlord(
      state,
      { opinion: 50, pressure: 30, missedRentCount: 0 },
      { amountDue: 120, paid: false, paidAmount: 0, arrears: 120, missedPayments: 1 },
      accum,
      30,
    )
    expect(paid.next.pressure).toBeLessThan(missed.next.pressure)
    expect(paid.next.opinion).toBeGreaterThan(missed.next.opinion)
  })

  it('resolveLandlord penalises high damage and unfiltered danger', () => {
    const state = createInitialTavernState()
    const accum = emptyAccumulator()
    const baseline = resolveLandlord(
      state,
      { opinion: 50, pressure: 20, missedRentCount: 0 },
      {
        amountDue: 120,
        paid: true,
        paidAmount: 120,
        arrears: 0,
        missedPayments: 0,
      },
      accum,
      30,
    )
    const damaged = withArea(state, 'main_room', { damage: 80 })
    const stressed = resolveLandlord(
      damaged,
      { opinion: 50, pressure: 20, missedRentCount: 0 },
      {
        amountDue: 120,
        paid: true,
        paidAmount: 120,
        arrears: 0,
        missedPayments: 0,
      },
      accum,
      30,
    )
    expect(stressed.next.pressure).toBeGreaterThan(baseline.next.pressure)
  })
})

describe('Phase 15 §15.4 — Inspection suspicion', () => {
  it('a filthy kitchen raises inspection suspicion', () => {
    const dirtyKitchen = withArea(
      plentyOfStock(createInitialTavernState()),
      'kitchen',
      { cleanliness: 5, smell: 80 },
    )
    const accum = emptyAccumulator()
    const result = resolveInspection(
      dirtyKitchen,
      { suspicion: 25, warningCount: 0 },
      accum,
      1,
    )
    expect(result.next.suspicion).toBeGreaterThan(25)
  })

  it('a clean tavern lowers inspection suspicion', () => {
    const cleanState = withArea(
      withArea(plentyOfStock(createInitialTavernState()), 'kitchen', {
        cleanliness: 80,
        smell: 10,
      }),
      'privy',
      { cleanliness: 70, smell: 20 },
    )
    const accum = emptyAccumulator()
    const result = resolveInspection(
      cleanState,
      { suspicion: 50, warningCount: 0 },
      accum,
      1,
    )
    expect(result.next.suspicion).toBeLessThan(50)
  })

  it('warning count increments when suspicion crosses the threshold', () => {
    const filthy = withArea(
      withArea(
        withCustomerGroup(plentyOfStock(createInitialTavernState()), 'merchants', {
          satisfaction: 10,
        }),
        'kitchen',
        { cleanliness: 5, smell: 90 },
      ),
      'privy',
      { smell: 95, cleanliness: 5 },
    )
    const accum = emptyAccumulator()
    const result = resolveInspection(
      filthy,
      { suspicion: 60, warningCount: 0 },
      accum,
      1,
    )
    expect(result.next.suspicion).toBeGreaterThanOrEqual(70)
    expect(result.next.warningCount).toBe(1)
    expect(result.resolution.warningIssuedThisMonth).toBe(true)
  })
})

describe('Phase 15 §15.5 — Reputation shifts', () => {
  it('cheap signals raise the cheap reputation axis', () => {
    const state = createInitialTavernState()
    const accum = emptyAccumulator()
    accum.signals.cheap = 12
    const shifts = computeReputationShifts(state, accum)
    const cheap = shifts.find((s) => s.axisId === 'cheap')!
    expect(cheap.delta).toBeGreaterThan(0)
  })

  it('filthy signals raise the filthy reputation axis', () => {
    const state = createInitialTavernState()
    const accum = emptyAccumulator()
    accum.signals.filthy = 14
    const shifts = computeReputationShifts(state, accum)
    const filthy = shifts.find((s) => s.axisId === 'filthy')!
    expect(filthy.delta).toBeGreaterThan(0)
  })

  it('rowdy / dangerous signals raise the dangerous reputation axis', () => {
    const state = createInitialTavernState()
    const accum = emptyAccumulator()
    accum.signals.dangerous = 16
    const shifts = computeReputationShifts(state, accum)
    const dangerous = shifts.find((s) => s.axisId === 'dangerous')!
    expect(dangerous.delta).toBeGreaterThan(0)
  })

  it('shortages (negative reliable signal) lower the reliable reputation axis', () => {
    const state = createInitialTavernState()
    const accum = emptyAccumulator()
    accum.signals.reliable = -16
    const shifts = computeReputationShifts(state, accum)
    const reliable = shifts.find((s) => s.axisId === 'reliable')!
    expect(reliable.delta).toBeLessThan(0)
  })

  it('reputation shifts clamp to [-12, +12] per axis per month', () => {
    const state = createInitialTavernState()
    const accum = emptyAccumulator()
    accum.signals.cheap = 100
    accum.signals.filthy = 100
    accum.signals.dangerous = 100
    const shifts = computeReputationShifts(state, accum)
    for (const shift of shifts) {
      expect(Math.abs(shift.delta)).toBeLessThanOrEqual(12)
    }
  })

  it('end-of-month run applies reputation shifts to state.reputation', () => {
    const base = withArea(
      withArea(plentyOfStock(withCoin(createInitialTavernState(), 600)), 'kitchen', {
        cleanliness: 5,
      }),
      'main_room',
      { cleanliness: 5 },
    )
    const result = runMonth(base)
    // Filthy should rise (dirty kitchen + main_room compound across the month).
    expect(result.reputation.filthy).toBeGreaterThanOrEqual(base.reputation.filthy)
  })
})

describe('Phase 15 §15.6 — Reputation tier bands', () => {
  it('classifies values correctly across the five bands', () => {
    expect(getReputationTier(0)).toBe('absent')
    expect(getReputationTier(19)).toBe('absent')
    expect(getReputationTier(20)).toBe('faint')
    expect(getReputationTier(39)).toBe('faint')
    expect(getReputationTier(40)).toBe('known')
    expect(getReputationTier(59)).toBe('known')
    expect(getReputationTier(60)).toBe('strong')
    expect(getReputationTier(79)).toBe('strong')
    expect(getReputationTier(80)).toBe('defining')
    expect(getReputationTier(100)).toBe('defining')
  })
})

describe('Phase 15 §15.7 — Upgrade readiness', () => {
  it('reinforced furniture surfaces when main room damage is heavy', () => {
    const damaged = withArea(
      plentyOfStock(createInitialTavernState()),
      'main_room',
      { damage: 80 },
    )
    const accum = emptyAccumulator()
    accum.damageSamples = [60, 70, 80, 85]
    const entries = computeUpgradeReadiness(damaged, accum)
    const ids = entries.map((e) => e.id)
    expect(ids).toContain('reinforced_furniture')
  })

  it('extra cellar shelving surfaces when shortages compound', () => {
    const state = plentyOfStock(createInitialTavernState())
    const accum = emptyAccumulator()
    accum.shortageCount = 12
    const entries = computeUpgradeReadiness(state, accum)
    expect(entries.map((e) => e.id)).toContain('extra_cellar_shelving')
  })

  it('upgrade readiness is sorted most-relevant first', () => {
    const damaged = withArea(
      plentyOfStock(createInitialTavernState()),
      'main_room',
      { damage: 90 },
    )
    const accum = emptyAccumulator()
    accum.damageSamples = [80]
    accum.shortageCount = 12
    const entries = computeUpgradeReadiness(damaged, accum)
    expect(entries.length).toBeGreaterThan(1)
    for (let i = 1; i < entries.length; i += 1) {
      expect(entries[i - 1]!.relevance).toBeGreaterThanOrEqual(entries[i]!.relevance)
    }
  })
})

describe('Phase 15 §15.8 — Rival tavern pressure', () => {
  it('unhappy merchants raise rival pressure relative to a matched control', () => {
    // Strip the default cheap/goblinAuthentic offsets so the merchant
    // pressure isn't cancelled out by the Crooked Keg's other reputation
    // signals. The test compares an unhappy-merchants state against a
    // happy-merchants control with identical reputation.
    const base = plentyOfStock(createInitialTavernState())
    const neutralReputation = {
      ...base,
      reputation: {
        ...base.reputation,
        cheap: 30,
        goblinAuthentic: 30,
        respectable: 40,
        reliable: 40,
      },
    }
    const happy = withCustomerGroup(neutralReputation, 'merchants', {
      satisfaction: 70,
    })
    const unhappy = withCustomerGroup(neutralReputation, 'merchants', {
      satisfaction: 15,
    })
    const baselineSlice = {
      pressure: 20,
      appeal: 30,
      strategy: 'unknown' as const,
    }
    const happyOut = resolveRivalTavern(happy, baselineSlice)
    const unhappyOut = resolveRivalTavern(unhappy, baselineSlice)
    expect(unhappyOut.next.pressure).toBeGreaterThan(happyOut.next.pressure)
  })

  it('loyal local goblins lower rival pressure', () => {
    const loyalLocals = withCustomerGroup(
      plentyOfStock(createInitialTavernState()),
      'local_goblins',
      { loyalty: 80, satisfaction: 80 },
    )
    const out = resolveRivalTavern(loyalLocals, {
      pressure: 40,
      appeal: 50,
      strategy: 'unknown',
    })
    expect(out.next.pressure).toBeLessThan(40)
  })
})

describe('Phase 15 §15.9 — Month modifiers', () => {
  it('pickMonthModifier is deterministic for the same (seed, year, month)', () => {
    const a = pickMonthModifier(SEED, 1, 1)
    const b = pickMonthModifier(SEED, 1, 1)
    expect(a.id).toBe(b.id)
  })

  it('different month coordinates can pick different modifiers', () => {
    const a = pickMonthModifier(SEED, 1, 1)
    let foundDifferent = false
    for (let m = 2; m <= 12 && !foundDifferent; m += 1) {
      const other = pickMonthModifier(SEED, 1, m)
      if (other.id !== a.id) foundDifferent = true
    }
    expect(foundDifferent).toBe(true)
  })

  it('the active modifier is set on the slice for the in-progress month', () => {
    const base = plentyOfStock(createInitialTavernState())
    const day1 = runDay(base).state
    const slice = getMonthlyModuleState(day1)
    expect(MONTH_MODIFIERS[slice.currentModifier.id]).toBeDefined()
    expect(slice.currentModifier.id).toBe(pickMonthModifier(SEED, 1, 1).id)
  })

  it('tax_month adds a rent bump for the affected month only', () => {
    // Force tax_month by finding a seed that picks it for month 1.
    // We don't depend on a random seed search — we directly seed the
    // monthly slice with the tax modifier and verify the rent
    // resolution swells by the bump.
    let base = withCoin(plentyOfStock(createInitialTavernState()), 1000)
    const slice = getMonthlyModuleState(base)
    base = {
      ...base,
      modules: {
        ...base.modules,
        [MONTHLY_MODULE_ID]: {
          ...slice,
          monthKey: 'Y1-M1',
          monthNumber: 1,
          yearNumber: 1,
          currentModifier: MONTH_MODIFIERS.tax_month,
        },
      },
    }
    const result = runMonth(base)
    const finalSlice = getMonthlyModuleState(result)
    // The economy.rent total should reflect the bumped amount.
    expect(finalSlice.lastMonthlyResult!.rent.paidAmount).toBeGreaterThanOrEqual(
      slice.rent.monthlyAmount + 1,
    )
  })

  it('next_month modifier is selected deterministically and surfaces in the result', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 600)
    const result = runMonth(base)
    const slice = getMonthlyModuleState(result)
    const nextExpected = pickMonthModifier(SEED, 1, 2)
    expect(slice.lastMonthlyResult!.nextMonthModifier.id).toBe(nextExpected.id)
  })
})

describe('Phase 15 §15.10 — Monthly report', () => {
  it('monthly report includes rent, landlord, inspection, reputation, upgrades, rival, and modifier', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 600)
    let state = base
    let lastReports
    for (let i = 0; i < 28; i += 1) {
      const out = runDay(state)
      state = out.state
      lastReports = out.reports
    }
    const monthly = lastReports!.find((r) => r.id === 'monthly')!
    expect(monthly.title).toMatch(/MONTHLY REPORT/)
    const text = monthly.lines.join('\n')
    expect(text).toMatch(/Rent:/)
    expect(text).toMatch(/Landlord:/)
    expect(text).toMatch(/Inspection:/)
    expect(text).toMatch(/Reputation:/)
    expect(text).toMatch(/Upgrade Readiness:/)
    expect(text).toMatch(/Rival Tavern:/)
    expect(text).toMatch(/Next Month Modifier:/)
  })

  it('non-end-of-month days do not emit a monthly report', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(base)
    expect(result.reports.find((r) => r.id === 'monthly')).toBeUndefined()
  })
})

describe('Phase 15 — State safety', () => {
  it('state validates after endMonth', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 600)
    let state = base
    let lastResult
    for (let i = 0; i < 28; i += 1) {
      lastResult = runDay(state)
      state = lastResult.state
    }
    expect(lastResult!.validation.errors).toEqual([])
  })

  it('multi-month run keeps state validating', () => {
    const base = withCoin(plentyOfStock(createInitialTavernState()), 1200)
    let state = base
    let lastResult
    for (let i = 0; i < 56; i += 1) {
      lastResult = runDay(state)
      state = lastResult.state
    }
    expect(lastResult!.validation.errors).toEqual([])
  })
})

describe('Phase 15 §15.11 — Three-bot sanity check', () => {
  function runBotMonth(bot: typeof autoNoOwnerActionsBot): {
    state: TavernState
    errors: number
  } {
    let state = withCoin(plentyOfStock(createInitialTavernState()), 200)
    let errors = 0
    for (let i = 0; i < 28; i += 1) {
      const out = simulateDay(state, policyBotInput(SEED, bot, state), FULL_PIPELINE)
      state = out.state
      errors += out.validation.errors.length
    }
    return { state, errors }
  }

  it('auto_no_owner_actions completes one month without invalid state', () => {
    const { errors } = runBotMonth(autoNoOwnerActionsBot)
    expect(errors).toBe(0)
  })

  it('auto_always_clean completes one month without invalid state', () => {
    const { errors } = runBotMonth(autoAlwaysCleanBot)
    expect(errors).toBe(0)
  })

  it('auto_always_restock completes one month without invalid state', () => {
    const { errors } = runBotMonth(autoAlwaysRestockBot)
    expect(errors).toBe(0)
  })

  it('the three bots produce visibly different ending states', () => {
    const results = REQUIRED_POLICY_BOTS.map((bot) => {
      let state = withCoin(plentyOfStock(createInitialTavernState()), 200)
      for (let i = 0; i < 28; i += 1) {
        state = simulateDay(
          state,
          policyBotInput(SEED, bot, state),
          FULL_PIPELINE,
        ).state
      }
      return {
        id: bot.id,
        coin: state.coin,
        rentPaid: getMonthlyModuleState(state).rent.paidThisMonth,
        kitchenCleanliness: state.areas.kitchen!.cleanliness,
        aleStock: state.stock.ale!.quantity,
        filthyReputation: state.reputation.filthy,
      }
    })

    // Each pair of bots should differ in at least one observable
    // outcome. The simulation should react to different inputs; if
    // every pair is identical the strategies aren't moving the needle.
    for (let i = 0; i < results.length; i += 1) {
      for (let j = i + 1; j < results.length; j += 1) {
        const a = results[i]!
        const b = results[j]!
        const distinct =
          a.coin !== b.coin ||
          a.rentPaid !== b.rentPaid ||
          a.kitchenCleanliness !== b.kitchenCleanliness ||
          a.aleStock !== b.aleStock ||
          a.filthyReputation !== b.filthyReputation
        if (!distinct) {
          throw new Error(
            `Bots '${a.id}' and '${b.id}' produced indistinguishable ending states`,
          )
        }
      }
    }
  })
})
