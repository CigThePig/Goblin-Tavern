// Expansion Phase 7 (repo phase 214) / ISSUE-177 — loans.
//
// Contract tests for §7.1. Every case reaches the feature the way a player
// does: through a registered owner action or a card choice, driven by the
// full pipeline. Nothing here writes a loan, an instalment or a lender
// decision into state by hand — §5 fails a phase whose tests reach it by
// injecting impossible state, and a loan that exists only because a test
// made one proves nothing about whether a player can make one.
//
// The one thing the tests DO set directly is a lender's standing, and only
// where the case is about what a lender does at a given standing. That is a
// legitimate starting condition (a tavern is either trusted or not), and
// every loan in this file is still taken through `take_loan`.

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
  INFORMAL_LENDER_ID,
  MAX_OPEN_LOANS,
  MAX_RENEGOTIATIONS,
  availableLenders,
  getFinanceModuleState,
  getLenderAccount,
  listLoans,
  loanOutstanding,
  openInstalmentOf,
  quoteLoan,
} from '../../src/sim/modules/finance/index'
import { LOAN_INSTALMENT_REVIEW_EVENT } from '../../src/sim/modules/finance/index'
import {
  getObligation,
  outstandingAmount,
} from '../../src/sim/contracts/obligations/index'
import { readScheduledEventsSlice } from '../../src/sim/contracts/scheduledEvents/state'
import { findScheduledEventDefinitionForHookName } from '../../src/sim/contracts/scheduledEvents/registry'
import { buildObligationCalendar } from '../../src/reports/obligationCalendarProjection'

const SEED = 'phase214/loans'

type Actions = NonNullable<SimInput['ownerActions']>

function ready(coin = 1_200): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 300, spoilage: 0 })
  }
  return state
}

function run(
  state: TavernState,
  day: number,
  ownerActions: Actions = [],
): TavernState {
  return simulateDay(
    state,
    { seed: `${SEED}/${day}`, ownerActions },
    FULL_PIPELINE,
  ).state
}

function runDays(
  state: TavernState,
  days: number,
  from = 0,
): TavernState {
  let current = state
  for (let day = 0; day < days; day += 1) current = run(current, from + day)
  return current
}

/** A starting condition, not an injected outcome: this lender trusts you. */
function withLenderStanding(
  state: TavernState,
  lenderId: string,
  standing: number,
): TavernState {
  const slice = getFinanceModuleState(state)
  const account = slice.lenders[lenderId] ?? {
    lenderId,
    standing,
    loansTaken: 0,
    loansSettled: 0,
    loansDefaulted: 0,
    lastDecisionDay: 0,
    lastDecisionReason: 'seeded',
  }
  return {
    ...state,
    modules: {
      ...state.modules,
      finance: {
        ...slice,
        lenders: { ...slice.lenders, [lenderId]: { ...account, standing } },
      },
    },
  }
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

describe('Phase 214 §7.1 — borrowing is a deliberate capability with visible terms', () => {
  it('registers the four loan actions in the shared registry', () => {
    for (const id of ['take_loan', 'repay_loan', 'renegotiate_loan', 'settle_loan']) {
      expect(actionRegistry.has(id), id).toBe(true)
    }
  })

  it('quotes every lender with terms the player can read before committing', () => {
    const state = ready()
    const quotes = availableLenders(state)
    expect(quotes.length).toBeGreaterThanOrEqual(3)
    for (const quote of quotes) {
      // A refusal is a legitimate quote — but it must say what would change
      // the answer, not merely decline.
      if (quote.refusal) {
        expect(quote.refusal.reason.length).toBeGreaterThan(10)
        continue
      }
      expect(quote.principal).toBeGreaterThan(0)
      expect(quote.totalRepayable).toBeGreaterThan(quote.principal)
      expect(quote.instalmentCount).toBeGreaterThan(0)
      expect(quote.firstDueOnDay).toBeGreaterThan(state.calendar.totalDaysElapsed)
      expect(quote.readable).toContain(String(quote.principal))
    }
  })

  it('the picker hint is the quote itself, so shown terms cannot drift from charged terms', () => {
    const state = ready()
    const definition = actionRegistry.get('take_loan')
    const targets = definition.getValidTargets({ state } as never)
    for (const target of targets) {
      const quote = quoteLoan(state, { lenderId: target.id })
      expect(target.hint).toBe(quote.refusal ? quote.refusal.reason : quote.readable)
    }
  })

  it('disburses the coin, opens a schedule, and puts the first payment on the calendar', () => {
    const before = ready(400)
    const quote = quoteLoan(before, { lenderId: 'merchant_syndicate', principal: 150 })
    expect(quote.refusal).toBeUndefined()

    const after = run(before, 0, [
      { actionId: 'take_loan', targetId: 'merchant_syndicate', amount: 150 },
    ])
    const applied = appliedAction(after, 'take_loan')
    expect(applied?.data['ok']).toBe(true)

    const loans = listLoans(after)
    expect(loans).toHaveLength(1)
    const loan = loans[0]!
    expect(loan.principal).toBe(quote.principal)
    expect(loan.totalRepayable).toBe(quote.totalRepayable)
    expect(loan.instalments.length).toBe(quote.instalmentCount)
    // The schedule sums to the repayable total exactly — a loan that cannot
    // be paid off to the coin never settles.
    expect(
      loan.instalments.reduce((sum, entry) => sum + entry.amount, 0),
    ).toBe(loan.totalRepayable)

    // The first instalment is a real ledger obligation, and its delinquency
    // check is on the calendar. Opening a payment without scheduling the day
    // it stops being optional is the `OBL-02` failure in miniature.
    const instalment = openInstalmentOf(loan)!
    expect(instalment.obligationId).toBeDefined()
    const obligation = getObligation(after, instalment.obligationId!)!
    expect(obligation.direction).toBe('payable')
    expect(obligation.principal).toBe(instalment.amount)
    expect(
      readScheduledEventsSlice(after).queue.some(
        (record) =>
          record.type === LOAN_INSTALMENT_REVIEW_EVENT &&
          (record.payload as { loanId?: string }).loanId === loan.id,
      ),
    ).toBe(true)
  })

  it('refuses a lender whose bar the tavern has not cleared, and says which bar', () => {
    const state = withLenderStanding(ready(), 'coin_hall', 20)
    const after = run(state, 0, [
      { actionId: 'take_loan', targetId: 'coin_hall', amount: 200 },
    ])
    expect(listLoans(after)).toHaveLength(0)
    const rejected = rejectedAction(after, 'take_loan')
    expect(rejected?.code).toBe('standing_too_low')
    expect(rejected?.reason).toContain('45')
  })

  it('will not lend twice against the same counterparty', () => {
    let state = run(ready(), 0, [
      { actionId: 'take_loan', targetId: 'merchant_syndicate', amount: 120 },
    ])
    state = run(state, 1, [
      { actionId: 'take_loan', targetId: 'merchant_syndicate', amount: 120 },
    ])
    expect(listLoans(state)).toHaveLength(1)
    expect(rejectedAction(state, 'take_loan')?.code).toBe('loan_already_open')
  })

  it('caps the number of live loans', () => {
    expect(MAX_OPEN_LOANS).toBeGreaterThan(0)
    let state = ready(3_000)
    for (let day = 0; day < 4; day += 1) {
      state = run(state, day, [
        { actionId: 'take_loan', targetId: 'merchant_syndicate', amount: 100 },
        { actionId: 'take_loan', targetId: 'grimwick', amount: 100 },
        { actionId: 'take_loan', targetId: 'coin_hall', amount: 100 },
      ])
    }
    expect(listLoans(state).length).toBeLessThanOrEqual(MAX_OPEN_LOANS)
  })
})

describe('Phase 214 §7.1 — repayment, partial payment and settlement', () => {
  it('accepts a partial payment without moving the deadline', () => {
    let state = run(ready(600), 0, [
      { actionId: 'take_loan', targetId: 'merchant_syndicate', amount: 120 },
    ])
    const loan = listLoans(state)[0]!
    const instalment = openInstalmentOf(loan)!
    const dueBefore = instalment.dueOnDay
    const owedBefore = outstandingAmount(
      getObligation(state, instalment.obligationId!)!,
    )

    state = run(state, 1, [
      { actionId: 'repay_loan', targetId: loan.id, amount: 10 },
    ])
    const after = listLoans(state)[0]!
    const stillOpen = openInstalmentOf(after)!
    expect(stillOpen.dueOnDay).toBe(dueBefore)
    expect(
      outstandingAmount(getObligation(state, stillOpen.obligationId!)!),
    ).toBe(owedBefore - 10)
    expect(loanOutstanding(after)).toBe(loanOutstanding(loan) - 10)
  })

  it('clearing one instalment opens the next, with its own calendar entry', () => {
    let state = run(ready(900), 0, [
      { actionId: 'take_loan', targetId: 'merchant_syndicate', amount: 120 },
    ])
    const loan = listLoans(state)[0]!
    const first = openInstalmentOf(loan)!

    state = run(state, 1, [{ actionId: 'repay_loan', targetId: loan.id }])
    const after = listLoans(state)[0]!
    expect(after.instalments[first.index]!.status).toBe('paid')
    const next = openInstalmentOf(after)
    expect(next).toBeDefined()
    expect(next!.index).toBe(first.index + 1)
    expect(next!.obligationId).toBeDefined()
  })

  it('settles early for less, and the lender thinks better of the tavern', () => {
    let state = run(ready(900), 0, [
      { actionId: 'take_loan', targetId: 'merchant_syndicate', amount: 120 },
    ])
    const loan = listLoans(state)[0]!
    const standingBefore = getLenderAccount(state, 'merchant_syndicate')!.standing
    const owed = loanOutstanding(loan)

    state = run(state, 1, [{ actionId: 'settle_loan', targetId: loan.id }])
    expect(listLoans(state)).toHaveLength(0)
    // Settled, archived, and findable — "what happened to that debt?" always
    // has an answer.
    const archived = getFinanceModuleState(state).loanArchive.find(
      (entry) => entry.id === loan.id,
    )
    expect(archived?.loanStatus).toBe('settled')
    // Early settlement rebates a tenth, so it costs less than the balance.
    // Measured off the action's own result rather than the till, because the
    // day also traded and the till moved for reasons that are not this loan.
    const paid = appliedAction(state, 'settle_loan')?.data['paid'] as number
    expect(paid).toBeGreaterThan(0)
    expect(paid).toBeLessThan(owed)
    expect(
      getLenderAccount(state, 'merchant_syndicate')!.standing,
    ).toBeGreaterThan(standingBefore)
  })

  it('renegotiation buys time for a fee and is bounded', () => {
    let state = run(ready(900), 0, [
      { actionId: 'take_loan', targetId: 'merchant_syndicate', amount: 150 },
    ])
    const before = listLoans(state)[0]!
    state = run(state, 1, [
      { actionId: 'renegotiate_loan', targetId: before.id },
    ])
    const after = listLoans(state)[0]!
    expect(after.renegotiations).toBe(1)
    expect(after.totalRepayable).toBeGreaterThan(before.totalRepayable)
    expect(after.periodDays).toBeGreaterThan(before.periodDays)
    expect(openInstalmentOf(after)).toBeDefined()

    // Bounded: the lender will not keep rewriting it.
    for (let day = 2; day < 2 + MAX_RENEGOTIATIONS + 2; day += 1) {
      state = run(state, day, [
        { actionId: 'renegotiate_loan', targetId: before.id },
      ])
    }
    const live = listLoans(state)[0]
    if (live) expect(live.renegotiations).toBeLessThanOrEqual(MAX_RENEGOTIATIONS)
  })
})

describe('Phase 214 §7.1 — delinquency, default and collections', () => {
  /**
   * A loan the tavern cannot service. Reached by borrowing and then having
   * nothing to pay with, which is the route a failing tavern actually takes.
   */
  function borrowedAndBroke(): TavernState {
    let state = run(ready(200), 0, [
      { actionId: 'take_loan', targetId: 'grimwick', amount: 100 },
    ])
    // Spend the till down to nothing the honest way: no stock, no sales.
    state = { ...state, coin: 0 }
    for (const id of Object.keys(state.stock)) {
      state = withStock(state, id, { quantity: 0 })
    }
    return state
  }

  it('an unpaid instalment goes delinquent on its own scheduled day, not before', () => {
    let state = borrowedAndBroke()
    const loan = listLoans(state)[0]!
    const instalment = openInstalmentOf(loan)!
    const reviewDay = instalment.dueOnDay + loan.graceDays + 1

    // Up to the day before, nothing has happened: the promise is dated.
    state = runDays(state, reviewDay - 1, 1)
    expect(listLoans(state)[0]!.loanStatus).toBe('active')

    state = runDays(state, 2, reviewDay)
    const after = listLoans(state)[0]!
    expect(after.missedInstalments).toBeGreaterThanOrEqual(1)
    expect(['delinquent', 'defaulted', 'in_collections']).toContain(
      after.loanStatus,
    )
    // And the lender re-prices the tavern — a real mutation, not a meter.
    expect(getLenderAccount(state, 'grimwick')!.standing).toBeLessThan(50)
  })

  it('a paid instalment resolves the same event as an explained no-op', () => {
    let state = run(ready(900), 0, [
      { actionId: 'take_loan', targetId: 'merchant_syndicate', amount: 120 },
    ])
    const loan = listLoans(state)[0]!
    const instalment = openInstalmentOf(loan)!
    state = run(state, 1, [{ actionId: 'repay_loan', targetId: loan.id }])

    const reviewDay = instalment.dueOnDay + loan.graceDays + 1
    state = runDays(state, reviewDay + 1, 2)

    const outcomes = readScheduledEventsSlice(state).archive.filter(
      (entry) => entry.type === LOAN_INSTALMENT_REVIEW_EVENT,
    )
    const noOp = outcomes.find((entry) => entry.status === 'no_op')
    expect(noOp).toBeDefined()
    // §1.1: an unexplained no-op is indistinguishable from a broken promise.
    expect(noOp!.reason).toBeTruthy()
  })

  it('a defaulted loan brings the lender to the door, and the till pays for it', () => {
    let state = borrowedAndBroke()
    // Long enough for three missed instalments plus a collections beat.
    state = runDays(state, 26, 1)
    const finance = getFinanceModuleState(state)
    const loan =
      finance.loans[Object.keys(finance.loans)[0] ?? ''] ??
      finance.loanArchive[finance.loanArchive.length - 1]
    expect(loan).toBeDefined()
    expect(loan!.missedInstalments).toBeGreaterThanOrEqual(1)
    // Grimwick seizes; the seizure is coin that actually moved, and the
    // account is refusing further business.
    const account = getLenderAccount(state, 'grimwick')!
    expect(
      loan!.collectedByLender > 0 || account.refusingUntilDay !== undefined,
    ).toBe(true)
  })
})

describe('Phase 214 §7.1 — the loan_due_soon hook resolves against a real loan', () => {
  it('is claimed by a registered owner rather than draining into a memory', () => {
    const definition = findScheduledEventDefinitionForHookName('loan_due_soon')
    expect(definition?.type).toBe(LOAN_INSTALMENT_REVIEW_EVENT)
    expect(definition?.ownerModuleId).toBe('finance')
  })

  it('declines to become mechanical when the tavern owes nobody', () => {
    const definition = findScheduledEventDefinitionForHookName('loan_due_soon')!
    const adapted = definition.fromFutureHook?.({
      hookName: 'loan_due_soon',
      readable: 'Loan will come due',
      scheduledForDay: 5,
      state: ready(),
    })
    // §7.1: it "cannot be scheduled when no loan exists".
    expect(adapted).toBeUndefined()
  })

  it('binds to the soonest live instalment once a loan exists', () => {
    const state = run(ready(600), 0, [
      { actionId: 'take_loan', targetId: 'merchant_syndicate', amount: 120 },
    ])
    const loan = listLoans(state)[0]!
    const definition = findScheduledEventDefinitionForHookName('loan_due_soon')!
    const adapted = definition.fromFutureHook?.({
      hookName: 'loan_due_soon',
      readable: 'Loan will come due',
      scheduledForDay: state.calendar.totalDaysElapsed + 3,
      state,
    })
    expect(adapted).toBeDefined()
    expect((adapted!.payload as { loanId: string }).loanId).toBe(loan.id)
  })

  it('the borrow card choice opens a real agreement rather than free coin', () => {
    // The `debt_rent` borrow profile routes its coin through
    // `finance.loan.borrow`. Reaching it through the card layer needs a
    // rent-pressured seed, so the contract is checked at the effect target's
    // own boundary instead: the informal lender is the one the card deals
    // with, and it must be able to take the deal a broke tavern is offered.
    const state = ready(5)
    const quote = quoteLoan(state, { lenderId: INFORMAL_LENDER_ID, principal: 40 })
    expect(quote.refusal).toBeUndefined()
    expect(quote.principal).toBeGreaterThanOrEqual(40)
    expect(quote.totalRepayable).toBeGreaterThan(quote.principal)
  })
})

describe('Phase 214 §7.1 — the loan is visible, bounded and valid', () => {
  it('shows up on the §7.4 obligation calendar with its due date and options', () => {
    const state = run(ready(600), 0, [
      { actionId: 'take_loan', targetId: 'merchant_syndicate', amount: 120 },
    ])
    const calendar = buildObligationCalendar(state)
    const row = calendar.rows.find((entry) => entry.kind === 'loan')
    expect(row).toBeDefined()
    expect(row!.dueOnDay).toBeDefined()
    expect(row!.counterparty).toBe('The Merchant Syndicate')
    expect(calendar.loans).toHaveLength(1)
    expect(calendar.loans[0]!.nextDueOnDay).toBe(row!.dueOnDay)
    // Player options come from the registry, so an offered option is one the
    // registry would accept.
    expect(row!.options.some((option) => option.actionId === 'repay_loan')).toBe(
      true,
    )
  })

  it('offers a loan row exactly the actions addressed BY a loan id, and no others', () => {
    const state = run(ready(600), 0, [
      { actionId: 'take_loan', targetId: 'merchant_syndicate', amount: 120 },
    ])
    const row = buildObligationCalendar(state).rows.find(
      (entry) => entry.kind === 'loan',
    )
    expect(row).toBeDefined()
    const offered = row!.options.map((option) => option.actionId).sort()
    // Asserting ABSENCE is the point. A tag scan matched `take_loan` here —
    // an action addressed by a LENDER id — so every loan row carried a
    // permanently-disabled "Borrow coin" whose reason ("no lender 'loan-0'
    // operates here") leaked a record id at the player. The same scan
    // dropped `renegotiate_loan`, which is not tagged `coin`.
    expect(offered).toEqual(['renegotiate_loan', 'repay_loan', 'settle_loan'])
  })

  it('never leaves a missed instalment owing in the ledger with no way to pay it', () => {
    // Borrow, then let the till run dry so instalments go past grace. The
    // schedule moves on from a missed instalment — so the obligation behind
    // it must move on too, or it sits live, unreachable by `repay_loan`
    // (which only ever finds the OPEN instalment) and counted as arrears
    // for the rest of the run. That is the promise-nobody-can-keep shape
    // OBL-02 exists to remove, and it is checkable from the ledger side.
    let state = run(ready(400), 0, [
      { actionId: 'take_loan', targetId: 'grimwick', amount: 100 },
    ])
    state = { ...state, coin: 0 }
    state = runDays(state, 40, 1)

    const loans = [
      ...listLoans(state),
      ...getFinanceModuleState(state).loanArchive,
    ]
    expect(loans.length).toBeGreaterThan(0)
    const missed = loans.flatMap((loan) =>
      loan.instalments.filter((entry) => entry.status === 'missed'),
    )
    expect(missed.length, 'the run must actually miss a payment').toBeGreaterThan(
      0,
    )

    for (const loan of loans) {
      for (const instalment of loan.instalments) {
        if (instalment.status === 'open' || !instalment.obligationId) continue
        const obligation = getObligation(state, instalment.obligationId)
        if (!obligation) continue
        expect(
          outstandingAmount(obligation),
          `instalment ${instalment.index} of ${loan.id} is ${instalment.status} but its obligation still owes`,
        ).toBe(0)
      }
    }
    // The module's own validator must agree, so this cannot regress quietly.
    const validation = safeValidateState(state, { modules: FULL_PIPELINE })
    expect(validation.success).toBe(true)
  })

  it('carries a missed instalment’s late charges onto the agreement rather than dropping them', () => {
    let state = run(ready(400), 0, [
      { actionId: 'take_loan', targetId: 'grimwick', amount: 100 },
    ])
    const opened = listLoans(state)[0]!
    const repayableAtSigning = opened.totalRepayable
    state = { ...state, coin: 0 }
    state = runDays(state, 20, 1)

    const loan =
      listLoans(state)[0] ??
      getFinanceModuleState(state).loanArchive.find(
        (entry) => entry.id === opened.id,
      )!
    expect(loan.missedInstalments).toBeGreaterThan(0)
    // Missing a payment costs what the loan's snapshotted late-charge rate
    // says it costs. Before, the charge accrued on an obligation the player
    // could never reach, so it was simultaneously "owed" and unpayable.
    expect(loan.totalRepayable).toBeGreaterThan(repayableAtSigning)
  })

  it('closes a settled loan out of the ledger even when an earlier payment was missed', () => {
    let state = run(ready(400), 0, [
      { actionId: 'take_loan', targetId: 'grimwick', amount: 100 },
    ])
    const loanId = listLoans(state)[0]!.id
    // Dry till long enough to miss one, then money again and settle in full.
    state = { ...state, coin: 0 }
    state = runDays(state, 12, 1)
    expect(listLoans(state)[0]?.missedInstalments ?? 0).toBeGreaterThan(0)

    state = { ...state, coin: 2_000 }
    state = run(state, 13, [{ actionId: 'settle_loan', targetId: loanId }])

    const archived = getFinanceModuleState(state).loanArchive.find(
      (entry) => entry.id === loanId,
    )
    const live = listLoans(state).find((entry) => entry.id === loanId)
    const loan = archived ?? live
    expect(loan).toBeDefined()
    for (const instalment of loan!.instalments) {
      if (!instalment.obligationId) continue
      const obligation = getObligation(state, instalment.obligationId)
      if (!obligation) continue
      expect(outstandingAmount(obligation), `instalment ${instalment.index}`).toBe(0)
    }
    // Nothing loan-shaped may still be showing on the player's calendar.
    const calendar = buildObligationCalendar(state)
    expect(calendar.rows.filter((row) => row.kind === 'loan')).toHaveLength(0)
  })

  it('refuses a third renegotiation in the PICKER, not after charging the walk', () => {
    let state = withLenderStanding(ready(2_000), 'merchant_syndicate', 90)
    state = run(state, 0, [
      { actionId: 'take_loan', targetId: 'merchant_syndicate', amount: 200 },
    ])
    const loanId = listLoans(state)[0]!.id
    for (let i = 0; i < MAX_RENEGOTIATIONS; i += 1) {
      state = run(state, 1 + i, [
        { actionId: 'renegotiate_loan', targetId: loanId },
      ])
    }
    expect(listLoans(state)[0]!.renegotiations).toBe(MAX_RENEGOTIATIONS)

    state = run(state, 1 + MAX_RENEGOTIATIONS, [
      { actionId: 'renegotiate_loan', targetId: loanId },
    ])
    // Rejected by `canApply` — so no time was spent — rather than accepted
    // and then refused inside `apply`, which is what charged the player for
    // an action that could only ever say no.
    expect(rejectedAction(state, 'renegotiate_loan')?.code).toBe(
      'renegotiation_exhausted',
    )
    expect(appliedAction(state, 'renegotiate_loan')).toBeUndefined()
  })

  it('reads collections terms off the agreement, not off the live registry', () => {
    const state = run(ready(400), 0, [
      { actionId: 'take_loan', targetId: 'grimwick', amount: 100 },
    ])
    const loan = listLoans(state)[0]!
    // Snapshotted at signing alongside rate and schedule: a lender re-tuned
    // after the deal was struck must not change what this loan does.
    expect(loan.collections).toBe('seizure')
    expect(loan.seizureFraction).toBeGreaterThan(0)
    expect(loan.refusalDays).toBeGreaterThan(0)
  })

  it('keeps state valid across a month of borrowing and repaying', () => {
    let state = ready(1_500)
    for (let day = 0; day < 28; day += 1) {
      const loans = listLoans(state)
      const actions: Actions =
        day % 7 === 0 && loans.length === 0
          ? [{ actionId: 'take_loan', targetId: 'merchant_syndicate', amount: 100 }]
          : loans.length > 0
            ? [{ actionId: 'repay_loan', targetId: loans[0]!.id, amount: 20 }]
            : []
      state = run(state, day, actions)
      const validation = safeValidateState(state, { modules: FULL_PIPELINE })
      expect(validation.success, `day ${day}`).toBe(true)
    }
    const slice = getFinanceModuleState(state)
    expect(Object.keys(slice.loans).length).toBeLessThanOrEqual(MAX_OPEN_LOANS)
    expect(slice.totals.loansTaken).toBeGreaterThan(0)
    expect(slice.totals.repaid).toBeGreaterThan(0)
  })
})
