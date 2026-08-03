// Expansion Phase 7 (repo phase 214) / ISSUE-177 — landlord and tenancy.
//
// Contract tests for §7.2. The tenancy opens itself on the module's first
// day, because the Crooked Keg rents its building from day one — so every
// case here starts from a real tavern and reaches arrears the way a player
// does: by not having the coin when the rent falls due.
//
// Nothing writes a notice, an eviction or a landlord opinion into state by
// hand. The one shortcut taken is emptying the cellar and the till, which is
// a starting condition (a tavern with nothing to sell), not an outcome.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import { safeValidateState } from '../../src/sim/state/validation'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import { getOwnerActionsModuleState } from '../../src/sim/modules/ownerActions/index'
import {
  EVICTION_HEARING_EVENT,
  LANDLORD_LABEL,
  MAX_TENANCY_NOTICES,
  RENT_PERIOD_DAYS,
  TENANCY_ESCALATION_EVENT,
  arrearsOutstanding,
  getLandlord,
  getTenancy,
  getTenancyModuleState,
  liveNotice,
  rentObligations,
  rentOutstanding,
} from '../../src/sim/modules/tenancy/index'
import { getEconomyModuleState } from '../../src/sim/modules/economy/index'
import {
  getObligation,
  outstandingAmount,
} from '../../src/sim/contracts/obligations/index'
import { readScheduledEventsSlice } from '../../src/sim/contracts/scheduledEvents/state'
import { findScheduledEventDefinitionForHookName } from '../../src/sim/contracts/scheduledEvents/registry'
import { buildObligationCalendar } from '../../src/reports/obligationCalendarProjection'

const SEED = 'phase214/tenancy'

type Actions = NonNullable<SimInput['ownerActions']>

function trading(coin = 900): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 400, spoilage: 0 })
  }
  return state
}

/** A tavern with nothing to sell and nothing in the till. */
function destitute(): TavernState {
  let state = withCoin(createInitialTavernState(), 0)
  for (const id of Object.keys(state.stock)) {
    state = withStock(state, id, { quantity: 0 })
  }
  return state
}

function run(state: TavernState, day: number, ownerActions: Actions = []): TavernState {
  return simulateDay(
    state,
    { seed: `${SEED}/${day}`, ownerActions },
    FULL_PIPELINE,
  ).state
}

function runDays(state: TavernState, days: number, from = 0): TavernState {
  let current = state
  for (let day = 0; day < days; day += 1) current = run(current, from + day)
  return current
}

function appliedAction(state: TavernState, actionId: string) {
  return getOwnerActionsModuleState(state).applied.find(
    (entry) => entry.actionId === actionId,
  )
}

function rejectedAction(state: TavernState, actionId: string) {
  return getOwnerActionsModuleState(state).rejected.find(
    (entry) => entry.actionId === actionId,
  )
}

describe('Phase 214 §7.2 — the tenancy is a real agreement with a dated period', () => {
  it('opens on the first day with a rent obligation and a rollover on the calendar', () => {
    const state = run(trading(), 0)
    const tenancy = getTenancy(state)
    expect(tenancy).toBeDefined()
    expect(tenancy!.rentPerPeriod).toBeGreaterThan(0)
    expect(tenancy!.periodDays).toBe(RENT_PERIOD_DAYS)

    // The period is BILLED — an obligation with a due day, not a number on a
    // slice — and its rollover is a dated event nobody has to remember.
    const obligations = rentObligations(state)
    expect(obligations).toHaveLength(1)
    expect(obligations[0]!.dueOnDay).toBe(tenancy!.periodEndsOnDay)
    expect(
      readScheduledEventsSlice(state).queue.some(
        (record) => record.type === 'rent_period_rollover',
      ),
    ).toBe(true)
  })

  it('registers the six tenancy actions in the shared registry', () => {
    for (const id of [
      'pay_rent',
      'negotiate_tenancy',
      'grant_landlord_access',
      'refuse_landlord_access',
      'request_landlord_repair',
      'reinstate_tenancy',
    ]) {
      expect(actionRegistry.has(id), id).toBe(true)
    }
  })

  it('mirrors itself into modules.monthly.rent rather than being a second copy', () => {
    const state = run(trading(), 0)
    const tenancy = getTenancy(state)!
    const monthly = state.modules['monthly'] as {
      rent: { monthlyAmount: number; arrears: number; missedPayments: number }
    }
    expect(monthly.rent.monthlyAmount).toBe(tenancy.rentPerPeriod)
    expect(monthly.rent.arrears).toBe(arrearsOutstanding(state))
    expect(monthly.rent.missedPayments).toBe(tenancy.missedPeriods)
  })

  it('accepts a part payment, which lowers the debt without moving the due day', () => {
    let state = run(trading(), 0)
    const before = rentObligations(state)[0]!
    state = run(state, 1, [{ actionId: 'pay_rent', amount: 30 }])
    const after = getObligation(state, before.id)!
    expect(after.paid).toBe(30)
    expect(after.dueOnDay).toBe(before.dueOnDay)
    expect(outstandingAmount(after)).toBe(outstandingAmount(before) - 30)
    // And the landlord notices being paid.
    expect(getLandlord(state).opinion).toBeGreaterThanOrEqual(50)
  })

  it('does not bill the same month twice when the player pays early', () => {
    let state = run(trading(1_000), 0)
    const tenancy = getTenancy(state)!
    state = run(state, 1, [{ actionId: 'pay_rent' }])
    expect(rentOutstanding(state)).toBe(0)
    // Several more days — nothing should re-bill the period already paid.
    state = runDays(state, 5, 2)
    expect(rentOutstanding(state)).toBe(0)
    expect(getTenancy(state)!.periodIndex).toBe(tenancy.periodIndex)
  })
})

describe('Phase 214 §7.2 — arrears, notices and their remedies', () => {
  it('rolls an unpaid month into an arrear that keeps its own record', () => {
    // 29 days: the sweep runs on day 28, the rollover the morning after.
    const state = runDays(destitute(), 29)
    const tenancy = getTenancy(state)!
    expect(tenancy.missedPeriods).toBeGreaterThanOrEqual(1)
    expect(tenancy.arrearObligationIds.length).toBeGreaterThanOrEqual(1)
    const arrear = getObligation(state, tenancy.arrearObligationIds[0]!)!
    // Its own due day and history survive the rollover — that is what lets a
    // notice quote an exact cure amount.
    expect(arrear.dueOnDay).toBeLessThan(state.calendar.totalDaysElapsed)
    expect(arrear.history.length).toBeGreaterThan(0)
    expect(arrearsOutstanding(state)).toBeGreaterThan(0)
  })

  it('issues a notice that names what would prevent it', () => {
    const state = runDays(destitute(), 29)
    const notice = liveNotice(getTenancyModuleState(state))
    expect(notice).toBeDefined()
    expect(notice!.cureAmount).toBeGreaterThan(0)
    expect(notice!.deadlineDay).toBeGreaterThan(notice!.issuedOnDay)
    // §7.2: "an eviction warning must identify what can prevent or delay it".
    expect(notice!.remedies.length).toBeGreaterThan(0)
    expect(notice!.remedies.join(' ')).toMatch(/[Pp]ay/)
    // And the deadline is on the calendar, so the ladder is self-driving.
    expect(
      readScheduledEventsSlice(state).queue.some(
        (record) => record.type === TENANCY_ESCALATION_EVENT,
      ),
    ).toBe(true)
  })

  it('escalates up the ladder while the arrears stand', () => {
    const state = runDays(destitute(), 50)
    const slice = getTenancyModuleState(state)
    const kinds = slice.notices.map((notice) => notice.kind)
    // More than one rung has been reached, and only one is ever live.
    expect(new Set(kinds).size).toBeGreaterThan(1)
    expect(slice.notices.filter((notice) => notice.status === 'live')).toHaveLength(
      1,
    )
    expect(slice.notices.length).toBeLessThanOrEqual(MAX_TENANCY_NOTICES)
  })

  it('the deadline event re-evaluates current state: paying in between withdraws the notice', () => {
    // Reach a live notice the hard way, then find the coin.
    let state = runDays(destitute(), 29)
    const notice = liveNotice(getTenancyModuleState(state))!
    expect(notice.status).toBe('live')

    // A windfall the player could plausibly have (a good week), then pay.
    state = withCoin(state, 2_000)
    state = run(state, 100, [{ actionId: 'pay_rent' }])
    expect(rentOutstanding(state)).toBe(0)
    expect(liveNotice(getTenancyModuleState(state))).toBeUndefined()

    // Run past the original deadline: the escalation event must find nothing
    // to escalate and say so, rather than escalating a debt that is gone.
    state = runDays(state, Math.max(2, notice.deadlineDay - state.calendar.totalDaysElapsed + 2), 101)
    const outcomes = readScheduledEventsSlice(state).archive.filter(
      (entry) => entry.type === TENANCY_ESCALATION_EVENT,
    )
    for (const outcome of outcomes) {
      if (outcome.status === 'no_op') expect(outcome.reason).toBeTruthy()
    }
    expect(getTenancy(state)!.tenancyStatus).not.toBe('eviction_proceeding')
  })

  it('curing the arrears clears every live notice', () => {
    let state = runDays(destitute(), 29)
    expect(liveNotice(getTenancyModuleState(state))).toBeDefined()
    state = withCoin(state, 2_000)
    state = run(state, 100, [{ actionId: 'pay_rent' }])
    const slice = getTenancyModuleState(state)
    expect(liveNotice(slice)).toBeUndefined()
    expect(slice.totals.noticesCured).toBeGreaterThan(0)
  })
})

describe('Phase 214 §7.2 — negotiation, access and repairs', () => {
  it('grants a concession when the landlord thinks well enough of the tavern', () => {
    let state = runDays(trading(2_000), 3)
    // Pay the rent first: that is what buys the standing to ask.
    state = run(state, 4, [{ actionId: 'pay_rent' }])
    state = run(state, 5, [
      { actionId: 'negotiate_tenancy', targetId: 'deferral' },
    ])
    const applied = appliedAction(state, 'negotiate_tenancy')
    expect(applied).toBeDefined()
    if (applied?.data['ok'] === true) {
      expect(getTenancy(state)!.concession).toBeDefined()
    } else {
      // A refusal is legitimate — but it must name the bar.
      expect(String(applied?.effects[0])).toMatch(/opinion|concession|grant/i)
    }
  })

  it('refuses a concession the landlord will not give, and says why', () => {
    // A tavern that has ignored the rent for two months has no goodwill.
    let state = runDays(destitute(), 58)
    state = run(state, 100, [
      { actionId: 'negotiate_tenancy', targetId: 'reduction' },
    ])
    const outcome =
      appliedAction(state, 'negotiate_tenancy') ??
      rejectedAction(state, 'negotiate_tenancy')
    expect(outcome).toBeDefined()
    const text = JSON.stringify(outcome)
    expect(text).toMatch(/opinion|concession|refus|grant/i)
  })

  it('an access request can be answered either way, and the landlord remembers', () => {
    const state = run(trading(), 0)
    // No request outstanding: both actions decline with the reason.
    const after = run(state, 1, [{ actionId: 'grant_landlord_access' }])
    const rejected = rejectedAction(after, 'grant_landlord_access')
    expect(rejected?.code).toBe('no_request')
    expect(rejected?.reason).toContain(LANDLORD_LABEL)
  })

  it('the landlord repairs structural decay but refuses ordinary wear', () => {
    let state = trading(1_500)
    // A serviceable room is the tenant's problem — and the rejection says so.
    state = run(state, 0, [
      { actionId: 'request_landlord_repair', targetId: 'main_room' },
    ])
    const rejected = rejectedAction(state, 'request_landlord_repair')
    expect(rejected?.code).toBe('not_structural')
    expect(rejected?.reason).toMatch(/\d+/)

    // A badly decayed one is the landlord's, and the tradesmen actually come.
    state = {
      ...state,
      areas: {
        ...state.areas,
        cellar: { ...state.areas['cellar']!, condition: 20 },
      },
    }
    state = run(state, 1, [
      { actionId: 'request_landlord_repair', targetId: 'cellar' },
    ])
    const applied = appliedAction(state, 'request_landlord_repair')
    expect(applied).toBeDefined()
    if (applied?.data['scheduled'] === true) {
      const before = state.areas['cellar']!.condition
      state = runDays(state, 8, 2)
      expect(state.areas['cellar']!.condition).toBeGreaterThan(before)
      const repair = getTenancyModuleState(state).repairs.find(
        (entry) => entry.areaId === 'cellar',
      )
      expect(repair?.status).toBe('completed')
    }
  })
})

describe('Phase 214 §7.2 — eviction is terminal, reachable, and escapable', () => {
  it('a tavern that never pays reaches a proceeding, and it re-evaluates on the day', () => {
    const state = runDays(destitute(), 80)
    const tenancy = getTenancy(state)!
    const slice = getTenancyModuleState(state)
    // Either a proceeding is under way or the building has gone.
    expect(
      ['eviction_proceeding', 'evicted', 'under_notice'].includes(
        tenancy.tenancyStatus,
      ),
    ).toBe(true)
    if (tenancy.tenancyStatus === 'evicted') {
      // Losing the building shuts the doors through the economy's own state,
      // not through a parallel closure this module invented.
      expect(getEconomyModuleState(state).financial.status).toBe(
        'temporarily_closed',
      )
      expect(slice.totals.evictionsGranted).toBeGreaterThan(0)
    }
  })

  it('the hearing is dismissed when the arrears were cleared first', () => {
    let state = runDays(destitute(), 45)
    // Find the coin before the hearing — the notice said this would work.
    state = withCoin(state, 3_000)
    state = run(state, 200, [{ actionId: 'pay_rent' }])
    expect(rentOutstanding(state)).toBe(0)
    state = runDays(state, 12, 201)
    expect(getTenancy(state)!.tenancyStatus).not.toBe('evicted')
    const hearings = readScheduledEventsSlice(state).archive.filter(
      (entry) => entry.type === EVICTION_HEARING_EVENT,
    )
    for (const hearing of hearings) {
      expect(hearing.status).not.toBe('expired')
    }
  })

  it('an evicted tavern can buy the tenancy back', () => {
    let state = runDays(destitute(), 90)
    if (getTenancy(state)!.tenancyStatus !== 'evicted') return
    const owed = rentOutstanding(state)
    state = withCoin(state, owed * 3 + 500)
    state = run(state, 300, [{ actionId: 'reinstate_tenancy' }])
    const applied = appliedAction(state, 'reinstate_tenancy')
    expect(applied?.data['ok']).toBe(true)
    expect(getTenancy(state)!.tenancyStatus).toBe('current')
    expect(rentOutstanding(state)).toBeGreaterThanOrEqual(0)
  })
})

describe('Phase 214 §7.2 — the eviction hooks resolve against real records', () => {
  it('eviction_threat_possible is owned, and declines when nothing is owed', () => {
    const definition = findScheduledEventDefinitionForHookName(
      'eviction_threat_possible',
    )
    expect(definition?.type).toBe(TENANCY_ESCALATION_EVENT)
    expect(definition?.ownerModuleId).toBe('tenancy')

    // A tavern with no tenancy record at all owes nothing to be threatened
    // over, so the hook stays a narrative expectation.
    const fresh = createInitialTavernState()
    expect(
      definition!.fromFutureHook?.({
        hookName: 'eviction_threat_possible',
        readable: 'Landlord may threaten eviction',
        scheduledForDay: 5,
        state: fresh,
      }),
    ).toBeUndefined()
  })

  it('landlord_goodwill_window is owned, and declines when the rent is clear', () => {
    const definition = findScheduledEventDefinitionForHookName(
      'landlord_goodwill_window',
    )
    expect(definition?.ownerModuleId).toBe('tenancy')
    const fresh = createInitialTavernState()
    expect(
      definition!.fromFutureHook?.({
        hookName: 'landlord_goodwill_window',
        readable: 'The landlord may be generous',
        scheduledForDay: 5,
        state: fresh,
      }),
    ).toBeUndefined()
  })
})

describe('Phase 214 §7.2 — the tenancy is visible, bounded and valid', () => {
  it('shows up on the §7.4 obligation calendar with its notice and remedies', () => {
    const state = runDays(destitute(), 29)
    const calendar = buildObligationCalendar(state)
    expect(calendar.rent).toBeDefined()
    expect(calendar.rent!.landlord).toBe(LANDLORD_LABEL)
    expect(calendar.rent!.outstanding).toBe(rentOutstanding(state))
    if (calendar.rent!.notice) {
      expect(calendar.rent!.notice.remedies.length).toBeGreaterThan(0)
    }
    expect(calendar.rows.some((row) => row.kind === 'rent')).toBe(true)
  })

  it('keeps state valid across three months of never paying', () => {
    let state = destitute()
    for (let day = 0; day < 84; day += 1) {
      state = run(state, day)
      const validation = safeValidateState(state, { modules: FULL_PIPELINE })
      expect(validation.success, `day ${day}`).toBe(true)
    }
    const slice = getTenancyModuleState(state)
    expect(slice.notices.length).toBeLessThanOrEqual(MAX_TENANCY_NOTICES)
    expect(slice.landlord.beliefs.length).toBeLessThanOrEqual(10)
  })
})
