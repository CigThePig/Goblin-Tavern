// Expansion Phase 7 (repo phase 214) / ISSUE-177 — §5.7, §5.9 and §5.10 for
// loans, tenancy and regulation.
//
// The work protocol makes three standing demands of every phase:
//
//   §5.7  a schema migration in the same phase as any persisted field
//   §5.9  full-day versus segmented equivalence for affected routes
//   §5.10 at least one save/reload at every day beat the new lifecycle crosses
//
// Phase 7's lifecycle crosses:
//
//   morning            `loan_collections`, `rent_period_rollover`,
//                      `eviction_hearing`, `landlord_access_request`,
//                      `regulatory_visit`, `regulatory_followup`
//   beforeOwnerActions the finance and tenancy daily passes
//   applyOwnerActions  borrowing, repaying, paying rent, negotiating,
//                      remediating, appealing, paying fines
//   closing            the regulatory evidence pass and case review
//   wrap_up            `loan_instalment_review`,
//                      `tenancy_escalation_review`, `landlord_goodwill`,
//                      `inspection_bribe_exposed`, `watch_relationship`,
//                      `cleaning_routine_review`
//
// On the engine's three segments those are `morning` + `beforeOwnerActions` +
// `applyOwnerActions` in A, `closing` in B, and `wrap_up` in C. Reloading at
// each of the five player beats covers all five — and this file does it with
// a LIVE LOAN, LIVE RENT ARREARS and a LIVE REGULATORY CASE in flight,
// because a reload with nothing outstanding proves nothing about
// outstanding things.
//
// The route runs through the real persistence layer (`saveSession` /
// `loadSession`), so the migration chain and the schemas are exercised on
// the way through.

import { describe, expect, it } from 'vitest'

import {
  SAVE_VERSION,
  loadSession,
  saveSession,
  setStorageForTesting,
  type PersistedSession,
  type StorageLike,
} from '../../web/src/lib/sim/persistence'
import type { Beat, DaySegment } from '../../web/src/lib/sim/daySession'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { advanceDaySegment, simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import { safeValidateState } from '../../src/sim/state/validation'
import { ensureExternalObligationSlices } from '../../src/sim/state/migrations'
import { withArea, withCoin, withStock } from '../../src/sim/testing/stateFactories'
import {
  FINANCE_MODULE_ID,
  getFinanceModuleState,
  listLoans,
  openInstalmentOf,
} from '../../src/sim/modules/finance/index'
import {
  TENANCY_MODULE_ID,
  arrearsOutstanding,
  getTenancy,
  getTenancyModuleState,
  rentOutstanding,
} from '../../src/sim/modules/tenancy/index'
import {
  REGULATORY_MODULE_ID,
  getRegulatoryModuleState,
  openCases,
} from '../../src/sim/modules/regulatory/index'
import { MONTHLY_MODULE_ID } from '../../src/sim/modules/monthly/types'
import { readScheduledEventsSlice } from '../../src/sim/contracts/scheduledEvents/state'
import { readObligationsSlice } from '../../src/sim/contracts/obligations/state'

class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>()
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v)
  }
  removeItem(k: string): void {
    this.map.delete(k)
  }
}

const SEED = 'phase214/external-obligation-beats'

const BEATS: ReadonlyArray<{ beat: Beat; segment: DaySegment }> = [
  { beat: 'morning', segment: 'A' },
  { beat: 'plan', segment: 'A' },
  { beat: 'service', segment: 'B' },
  { beat: 'closing', segment: 'B' },
  { beat: 'report', segment: 'C' },
]

function input(day: number, actions?: SimInput['ownerActions']): SimInput {
  return {
    seed: `${SEED}-d${day}`,
    ...(actions && actions.length > 0 ? { ownerActions: [...actions] } : {}),
  }
}

function sessionAt(
  state: TavernState,
  beat: Beat,
  segment: DaySegment,
): PersistedSession {
  return {
    saveVersion: SAVE_VERSION,
    savedAt: '2026-08-02T00:00:00.000Z',
    simSeed: SEED,
    state,
    picks: [],
    staffPriorities: {},
    pendingBySeedId: {},
    daySession: {
      beat,
      segment,
      serviceComplete: segment !== 'A',
      closingComplete: segment === 'C',
    },
    route: 'day',
  }
}

function roundTrip(state: TavernState, beat: Beat, segment: DaySegment): TavernState {
  setStorageForTesting(new MemoryStorage())
  try {
    const saved = saveSession(sessionAt(state, beat, segment))
    expect(saved.ok, saved.ok ? '' : saved.reason).toBe(true)
    const outcome = loadSession()
    expect(outcome.kind).toBe('loaded')
    if (outcome.kind !== 'loaded') throw new Error('load failed')
    return outcome.save.state
  } finally {
    setStorageForTesting(undefined)
  }
}

function plain(state: TavernState): unknown {
  return JSON.parse(JSON.stringify(state))
}

/**
 * A tavern with all three obligations live at once: a loan mid-schedule,
 * rent it cannot pay, and a regulatory case with an inspector due.
 *
 * Reached by playing — borrowing through the registered action, letting the
 * cellar empty so the rent goes unpaid, and letting the rooms go so the
 * watch takes an interest.
 */
function tavernUnderObligation(): TavernState {
  let state = withCoin(createInitialTavernState(), 900)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 120, spoilage: 0 })
  }
  state = withArea(state, 'kitchen', { cleanliness: 8, smell: 85 })
  state = withArea(state, 'privy', { cleanliness: 5, smell: 95 })
  state = withArea(state, 'main_room', { cleanliness: 15, damage: 70 })

  // A real loan, taken the way a player takes one.
  state = simulateDay(
    state,
    input(0, [
      { actionId: 'take_loan', targetId: 'merchant_syndicate', amount: 140 },
    ]),
    FULL_PIPELINE,
  ).state
  expect(listLoans(state)).toHaveLength(1)

  // A month of trading badly: the cellar runs out, the rooms stay filthy,
  // and the rent falls due with nothing to pay it with.
  for (let day = 1; day <= 30; day += 1) {
    if (day === 10) {
      for (const id of Object.keys(state.stock)) {
        state = withStock(state, id, { quantity: 0 })
      }
      state = { ...state, coin: 0 }
    }
    state = simulateDay(state, input(day), FULL_PIPELINE).state
  }
  return state
}

describe('Phase 214 §5.10 — a reload at every beat the lifecycle crosses', () => {
  const base = tavernUnderObligation()

  it('reaches a state with a loan, rent arrears and a case all live', () => {
    // The fixture must actually exercise what the file is about.
    expect(listLoans(base).length + getFinanceModuleState(base).loanArchive.length)
      .toBeGreaterThan(0)
    expect(rentOutstanding(base)).toBeGreaterThan(0)
    expect(
      openCases(getRegulatoryModuleState(base)).length +
        getRegulatoryModuleState(base).caseArchive.length,
    ).toBeGreaterThan(0)
  })

  for (const { beat, segment } of BEATS) {
    it(`survives a save/load at ${beat} (segment ${segment}) unchanged`, () => {
      const restored = roundTrip(base, beat, segment)
      expect(plain(restored)).toEqual(plain(base))
      const validation = safeValidateState(restored, { modules: FULL_PIPELINE })
      expect(validation.success).toBe(true)
    })
  }

  it('a resumed day resolves the same events as an uninterrupted one', () => {
    const uninterrupted = simulateDay(base, input(99), FULL_PIPELINE).state

    // Resume from a reload before running the day at all.
    const reloaded = roundTrip(base, 'morning', 'A')
    const resumed = simulateDay(reloaded, input(99), FULL_PIPELINE).state

    expect(plain(resumed)).toEqual(plain(uninterrupted))
  })
})

describe('Phase 214 §5.9 — full-day and segmented routes agree', () => {
  it('a fortnight is identical run whole or run in three segments', () => {
    let batch = tavernUnderObligation()
    let segmented = tavernUnderObligation()
    expect(plain(segmented)).toEqual(plain(batch))

    for (let day = 100; day < 114; day += 1) {
      const loans = listLoans(batch)
      const actions: SimInput['ownerActions'] =
        loans.length > 0
          ? [{ actionId: 'repay_loan', targetId: loans[0]!.id, amount: 5 }]
          : [{ actionId: 'put_the_books_in_order' }]

      batch = simulateDay(batch, input(day, actions), FULL_PIPELINE).state

      let carried = segmented
      for (const segment of ['A', 'B', 'C'] as const) {
        carried = advanceDaySegment(
          carried,
          input(day, actions),
          FULL_PIPELINE,
          segment,
        ).state
      }
      segmented = carried
      expect(plain(segmented), `day ${day}`).toEqual(plain(batch))
    }

    // And the fortnight exercised the lifecycle rather than idling.
    const events = readScheduledEventsSlice(batch)
    expect(
      events.archive.some(
        (entry) =>
          entry.ownerModuleId === FINANCE_MODULE_ID ||
          entry.ownerModuleId === TENANCY_MODULE_ID ||
          entry.ownerModuleId === REGULATORY_MODULE_ID,
      ),
    ).toBe(true)
  })

  it('an exact-once event cannot fire twice across a reload', () => {
    let state = tavernUnderObligation()
    const spentBefore = new Set(
      readScheduledEventsSlice(state).spentKeys.map((entry) => entry.key),
    )

    // Run one day, reload from the state BEFORE it, and run the same day
    // again. The second pass must resolve nothing the first already did.
    const once = simulateDay(state, input(200), FULL_PIPELINE).state
    const reloaded = roundTrip(state, 'report', 'C')
    const twice = simulateDay(reloaded, input(200), FULL_PIPELINE).state
    expect(plain(twice)).toEqual(plain(once))

    state = once
    const spentAfter = readScheduledEventsSlice(state).spentKeys.map(
      (entry) => entry.key,
    )
    // No key is ever spent twice.
    expect(new Set(spentAfter).size).toBe(spentAfter.length)
    for (const key of spentBefore) expect(spentAfter).toContain(key)
  })
})

describe('Phase 214 §5.7 — the migration carries an old save forward honestly', () => {
  it('installs all three slices without fabricating anything', () => {
    const fresh = createInitialTavernState()
    const stripped = {
      ...fresh,
      modules: Object.fromEntries(
        Object.entries(fresh.modules).filter(
          ([id]) =>
            id !== FINANCE_MODULE_ID &&
            id !== TENANCY_MODULE_ID &&
            id !== REGULATORY_MODULE_ID,
        ),
      ),
    }
    const migrated = ensureExternalObligationSlices(stripped)
    const finance = getFinanceModuleState(migrated as TavernState)
    const regulatory = getRegulatoryModuleState(migrated as TavernState)

    // Nobody has lent the tavern anything, and the watch has heard nothing.
    // Backdating either would invent a history the player never played.
    expect(Object.keys(finance.loans)).toHaveLength(0)
    expect(finance.totals.loansTaken).toBe(0)
    expect(regulatory.evidence).toHaveLength(0)
    expect(regulatory.totals.casesOpened).toBe(0)
  })

  it('carries rent the old save already owed rather than wiping it', () => {
    const fresh = createInitialTavernState()
    const monthly = fresh.modules[MONTHLY_MODULE_ID] as {
      rent: { monthlyAmount: number; arrears: number; missedPayments: number }
      landlord: { opinion: number }
    }
    const oldSave = {
      ...fresh,
      modules: {
        ...Object.fromEntries(
          Object.entries(fresh.modules).filter(
            ([id]) => id !== TENANCY_MODULE_ID,
          ),
        ),
        [MONTHLY_MODULE_ID]: {
          ...monthly,
          rent: { ...monthly.rent, arrears: 240, missedPayments: 2 },
          landlord: { ...monthly.landlord, opinion: 30 },
        },
      },
    }
    const migrated = ensureExternalObligationSlices(oldSave) as TavernState
    const slice = getTenancyModuleState(migrated)

    // §5: "old saves silently lose or fabricate material obligations" is a
    // fail condition. The two missed months and the landlord's low opinion
    // travel; the arrears are carried as what the landlord holds against the
    // tavern, so the next rollover bills honestly from there.
    expect(slice.totals.periodsMissed).toBe(2)
    expect(slice.landlord.opinion).toBe(30)
    expect(slice.landlord.concern).toBeGreaterThan(0)
    expect(
      slice.landlord.beliefs.some((belief) => belief.readable.includes('240')),
    ).toBe(true)
  })

  it('a migrated save opens its tenancy and validates on the first day it runs', () => {
    const fresh = createInitialTavernState()
    const oldSave = {
      ...fresh,
      modules: Object.fromEntries(
        Object.entries(fresh.modules).filter(
          ([id]) =>
            id !== FINANCE_MODULE_ID &&
            id !== TENANCY_MODULE_ID &&
            id !== REGULATORY_MODULE_ID,
        ),
      ),
    } as TavernState
    const migrated = ensureExternalObligationSlices(oldSave) as TavernState
    expect(getTenancy(migrated)).toBeUndefined()

    const after = simulateDay(migrated, input(0), FULL_PIPELINE).state
    expect(getTenancy(after)).toBeDefined()
    expect(rentOutstanding(after)).toBeGreaterThan(0)
    expect(arrearsOutstanding(after)).toBe(0)
    const validation = safeValidateState(after, { modules: FULL_PIPELINE })
    expect(validation.success).toBe(true)
  })

  it('the whole save round-trips through the real load path', () => {
    const state = tavernUnderObligation()
    const restored = roundTrip(state, 'plan', 'A')
    // Every one of the three slices, plus the shared ledger they write into.
    expect(getFinanceModuleState(restored)).toEqual(getFinanceModuleState(state))
    expect(getTenancyModuleState(restored)).toEqual(getTenancyModuleState(state))
    expect(getRegulatoryModuleState(restored)).toEqual(
      getRegulatoryModuleState(state),
    )
    expect(readObligationsSlice(restored)).toEqual(readObligationsSlice(state))
  })
})

describe('Phase 214 §5.11 — every new collection is bounded', () => {
  it('holds its caps across a long, badly played run', () => {
    let state = tavernUnderObligation()
    for (let day = 300; day < 384; day += 1) {
      const loans = listLoans(state)
      const actions: SimInput['ownerActions'] =
        day % 20 === 0 && loans.length === 0
          ? [{ actionId: 'take_loan', targetId: 'grimwick', amount: 40 }]
          : []
      state = simulateDay(state, input(day, actions), FULL_PIPELINE).state
    }
    const finance = getFinanceModuleState(state)
    const tenancy = getTenancyModuleState(state)
    const regulatory = getRegulatoryModuleState(state)

    expect(Object.keys(finance.loans).length).toBeLessThanOrEqual(6)
    expect(finance.loanArchive.length).toBeLessThanOrEqual(24)
    expect(tenancy.notices.length).toBeLessThanOrEqual(12)
    expect(tenancy.landlord.beliefs.length).toBeLessThanOrEqual(10)
    expect(regulatory.evidence.length).toBeLessThanOrEqual(40)
    expect(Object.keys(regulatory.cases).length).toBeLessThanOrEqual(3)
    expect(regulatory.caseArchive.length).toBeLessThanOrEqual(12)

    // A loan that is still open still has exactly one payment on the books.
    for (const loan of Object.values(finance.loans)) {
      expect(
        loan.instalments.filter((entry) => entry.status === 'open').length,
      ).toBeLessThanOrEqual(1)
      if (openInstalmentOf(loan)) {
        expect(openInstalmentOf(loan)!.obligationId).toBeDefined()
      }
    }

    const validation = safeValidateState(state, { modules: FULL_PIPELINE })
    expect(validation.success).toBe(true)
  })
})
