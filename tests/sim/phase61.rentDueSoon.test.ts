import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'

import { areasModule } from '../../src/sim/modules/areas/index'
import { customersModule } from '../../src/sim/modules/customers/index'
import { ownerActionsModule } from '../../src/sim/modules/ownerActions/index'
import { serviceModule } from '../../src/sim/modules/service/index'
import { staffModule } from '../../src/sim/modules/staff/index'
import { stockModule } from '../../src/sim/modules/stock/index'
import { weeklyModule } from '../../src/sim/modules/weekly/index'
import { monthlyModule } from '../../src/sim/modules/monthly/index'
import { memoriesModule } from '../../src/sim/modules/memories/index'
import { historyModule } from '../../src/sim/modules/history/index'
import { causesModule } from '../../src/sim/modules/causes/index'
import { pressuresModule } from '../../src/sim/modules/pressures/index'
import { issueSeedsModule } from '../../src/sim/modules/issues/index'
import {
  getPressureSnapshot,
} from '../../src/sim/modules/pressures/index'
import { getIssueSeeds } from '../../src/sim/modules/issues/index'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import type {
  MonthlyModuleState,
  RentState,
} from '../../src/sim/modules/monthly/types'

// Phase 61 / ISSUE-021 — `rent_due_soon` calendar tag consumers.
//
// The calendar emits `rent_due_soon` on days 22–28 of each month. Two
// consumers wire it in this phase: the landlord pressure calculator
// (adds a cause + amount) and `generateDebtRent` (bumps severity and
// urgency, adds a recent-context line).

const SEED = 'phase-61-rent-due-soon-test'

const PIPELINE = [
  areasModule,
  stockModule,
  staffModule,
  customersModule,
  ownerActionsModule,
  serviceModule,
  weeklyModule,
  monthlyModule,
  memoriesModule,
  historyModule,
  causesModule,
  pressuresModule,
  issueSeedsModule,
]

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

function runDay(state: TavernState) {
  return simulateDay(state, input(), PIPELINE)
}

function withCalendarTags(
  state: TavernState,
  tags: TavernState['calendar']['tags'],
): TavernState {
  return {
    ...state,
    calendar: { ...state.calendar, tags },
  }
}

function withLandlordPressure(
  state: TavernState,
  pressure: number,
  missedCount: number,
): TavernState {
  const monthly = (state.modules['monthly'] ?? null) as MonthlyModuleState | null
  if (!monthly) return state
  return {
    ...state,
    modules: {
      ...state.modules,
      monthly: {
        ...monthly,
        landlord: {
          ...monthly.landlord,
          pressure,
          missedRentCount: missedCount,
        },
      },
    },
  }
}

function withRentArrears(
  state: TavernState,
  arrears: number,
  paid: boolean,
): TavernState {
  const monthly = (state.modules['monthly'] ?? null) as MonthlyModuleState | null
  if (!monthly) return state
  const rent: RentState = {
    ...monthly.rent,
    arrears,
    paidThisMonth: paid,
    missedPayments: paid
      ? monthly.rent.missedPayments
      : monthly.rent.missedPayments + 1,
  }
  return {
    ...state,
    modules: {
      ...state.modules,
      monthly: { ...monthly, rent },
    },
  }
}

describe('Phase 61 / ISSUE-021 — rent_due_soon landlord pressure', () => {
  it('rent_due_soon tag adds a cause and raises landlord pressure', () => {
    let base = createInitialTavernState()
    base = withLandlordPressure(base, 40, 1)
    base = withRentArrears(base, 30, false)

    const without = withCalendarTags(base, ['quiet_day'])
    const withTag = withCalendarTags(base, ['quiet_day', 'rent_due_soon'])

    const resultWithout = runDay(without)
    const resultWithTag = runDay(withTag)

    const snapWithout = getPressureSnapshot(resultWithout.state, 'landlord')!
    const snapWithTag = getPressureSnapshot(resultWithTag.state, 'landlord')!

    expect(snapWithTag.value).toBeGreaterThan(snapWithout.value)
    expect(snapWithTag.causes.some((c) => c.id === 'rent_due_soon')).toBe(true)
    expect(snapWithout.causes.some((c) => c.id === 'rent_due_soon')).toBe(false)
  })
})

describe('Phase 61 / ISSUE-021 — debt_rent seed amplification', () => {
  it('rent_due_soon raises debt_rent seed severity and urgency', () => {
    let base = createInitialTavernState()
    base = withLandlordPressure(base, 50, 2)
    base = withRentArrears(base, 50, false)

    // Phase 186 / Cluster 4 — `debt_rent` is now produced in the morning
    // (`startDay`) pass and reads the PRIOR day's closing pressure
    // snapshot — the standing debt condition known at sunrise (contract
    // §3.1). Warm one day so the debt/landlord snapshot + causes exist;
    // the comparison day then generates the seed at its morning. Both
    // branches share that identical warmed snapshot, so the only
    // differentiator is the live `rent_due_soon` calendar tag read at
    // generation (its +10 severity/urgency bonus). The tag is overridden
    // on the warmed state *after* the warm-up, so `advanceCalendar` (which
    // already ran) does not recompute it before the comparison morning.
    const warm = runDay(base).state

    const without = withCalendarTags(warm, ['quiet_day'])
    const withTag = withCalendarTags(warm, ['quiet_day', 'rent_due_soon'])

    const resultWithout = runDay(without)
    const resultWithTag = runDay(withTag)

    const seedsWithout = getIssueSeeds(resultWithout.state, { family: 'debt_rent' })
    const seedsWithTag = getIssueSeeds(resultWithTag.state, { family: 'debt_rent' })

    expect(seedsWithout.length).toBeGreaterThan(0)
    expect(seedsWithTag.length).toBeGreaterThan(0)

    const seedWithout = seedsWithout[0]!
    const seedWithTag = seedsWithTag[0]!

    expect(seedWithTag.severity).toBeGreaterThan(seedWithout.severity)
    expect(seedWithTag.urgency).toBeGreaterThan(seedWithout.urgency)
  })

  // Regression — `severity`/`urgency` are 0–100 bands enforced by
  // `validateIssueSeeds`. `debt_rent` derived them as
  // `max(40, debt, landlord) + 10` and `max(45, landlord + 10) + 10`, so
  // once landlord pressure climbed near its 100 ceiling every generated
  // seed overflowed and the run validated dirty from then on.
  it('keeps debt_rent bands within 0–100 at maximum landlord pressure', () => {
    let base = createInitialTavernState()
    base = withLandlordPressure(base, 100, 6)
    base = withRentArrears(base, 500, false)
    base = { ...base, coin: 0 }

    const warm = runDay(base).state
    const maxed = withCalendarTags(
      withLandlordPressure(warm, 100, 6),
      ['quiet_day', 'rent_due_soon'],
    )
    const result = runDay(maxed)

    const seeds = getIssueSeeds(result.state, { family: 'debt_rent' })
    expect(seeds.length).toBeGreaterThan(0)
    for (const seed of seeds) {
      expect(seed.severity).toBeGreaterThanOrEqual(0)
      expect(seed.severity).toBeLessThanOrEqual(100)
      expect(seed.urgency).toBeGreaterThanOrEqual(0)
      expect(seed.urgency).toBeLessThanOrEqual(100)
    }
    expect(
      result.validation.errors.filter((e) =>
        e.path.startsWith('modules.issueSeeds'),
      ),
    ).toEqual([])
  })
})
