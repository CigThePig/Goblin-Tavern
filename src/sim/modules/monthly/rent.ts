import type { SimContext } from '../../core/context'

import { spendCoin } from '../stock/ledger'

import type { MonthlyModuleState, RentResolution, RentState } from './types'
import { MONTHLY_MODULE_ID, RENT_PAYMENT_EFFECT_TARGET } from './types'

export { RENT_PAYMENT_EFFECT_TARGET }
import { getMonthlyModuleState } from './monthlyModule'

// Phase 15 §15.2 — Rent.
//
// At end of month, attempt to pay rent through the Phase 9 ledger. The
// resolution captures whether the payment went through, the amount that
// hit the ledger, and the updated arrears/missed-payment counters.

const SOURCE = 'monthly.rent'

/** What paying the rent costs right now: this month's amount plus arrears. */
export function rentAmountDue(rent: RentState): number {
  return rent.monthlyAmount + rent.arrears
}

/**
 * Phase 200 / audit Wave 1 (`P7-EXP-001`) — the one rent-payment
 * transition.
 *
 * The debt/rent card's `pay` response used to spend `monthlyAmount`
 * straight out of the till and stop there: it never set `paidThisMonth`,
 * never cleared arrears, never checked whether the coin existed, and so
 * was offered again the next day and the next. The audit's route paid 120
 * five times from a 98-coin till, finished at −473, and failed the state
 * schema on `coin` — while the rent stayed unpaid the whole time.
 *
 * Both the month-end resolver and the card now go through this function,
 * so the affordability check and the whole paid/arrears/memory/history/
 * cause transition cannot drift apart. Returns the updated `RentState` on
 * success, or `undefined` when the coin is not there — in which case
 * nothing at all has been mutated.
 */
export function payRentInFull(
  ctx: SimContext,
  rent: RentState,
  options: { origin: string },
): RentState | undefined {
  const amountDue = rentAmountDue(rent)
  if (amountDue <= 0) return { ...rent, paidThisMonth: true }
  if (ctx.state.coin < amountDue) return undefined

  spendCoin(ctx, amountDue, {
    source: SOURCE,
    category: 'rent',
    tags: ['rent', 'monthly'],
  })
  const next: RentState = {
    monthlyAmount: rent.monthlyAmount,
    paidThisMonth: true,
    missedPayments: rent.missedPayments,
    arrears: 0,
  }
  // Phase 16 §16.3 — memory + history records for rent paid. The
  // first paid rent also drops a permanent `first_rent_paid` fact.
  ctx.addMemory({
    id: 'rent_paid_recently',
    source: SOURCE,
    metadata: { amount: amountDue },
  })
  if (!ctx.hasMemory('first_rent_paid')) {
    ctx.addMemory({
      id: 'first_rent_paid',
      source: SOURCE,
      metadata: { amount: amountDue },
    })
  }
  ctx.addHistory({
    category: 'monthly',
    summary: `Rent paid in full (${amountDue} coin).`,
    tags: ['monthly', 'rent', 'paid'],
    relatedSystems: ['monthly'],
    mechanicalRefs: [options.origin],
  })
  // Phase 17 §17.5 — paid rent is a positive landlord-opinion cause.
  ctx.addCause({
    source: 'monthly.rent',
    sourceType: 'monthly',
    target: 'pressure:landlord',
    targetType: 'pressure',
    amount: -10,
    readable: `Rent paid in full (${amountDue} coin).`,
    tags: ['monthly', 'rent', 'paid', 'landlord'],
    relatedSystems: ['monthly', 'landlord'],
    expiresAfterDays: 14,
  })
  return next
}

/**
 * Pay the rent from a response, writing the result back to the monthly
 * slice. Returns the amount that left the till — 0 when the payment could
 * not be made, in which case nothing was mutated.
 */
export function payRentFromResponse(ctx: SimContext, source: string): number {
  const slice = getMonthlyModuleState(ctx.state)
  const rent = slice.rent
  if (rent.paidThisMonth && rent.arrears <= 0) return 0
  const amountDue = rentAmountDue(rent)
  const next = payRentInFull(ctx, rent, { origin: source })
  if (!next) return 0
  ctx.modifyModuleState<MonthlyModuleState>(
    MONTHLY_MODULE_ID,
    (current) => ({ ...(current ?? slice), rent: next }),
    { source: SOURCE, reason: 'rent_paid_by_response' },
  )
  return amountDue
}

export function resolveRent(
  ctx: SimContext,
  rent: RentState,
): { next: RentState; resolution: RentResolution } {
  if (rent.paidThisMonth && rent.arrears <= 0) {
    return {
      next: rent,
      resolution: {
        amountDue: 0,
        paid: true,
        paidAmount: 0,
        arrears: 0,
        missedPayments: rent.missedPayments,
      },
    }
  }

  // Rent is due, plus any rolled-over arrears.
  const amountDue = rent.monthlyAmount + rent.arrears

  if (amountDue <= 0) {
    return {
      next: { ...rent, paidThisMonth: true },
      resolution: {
        amountDue: 0,
        paid: true,
        paidAmount: 0,
        arrears: 0,
        missedPayments: rent.missedPayments,
      },
    }
  }

  const paid = payRentInFull(ctx, rent, { origin: 'resolveRent' })
  if (paid) {
    return {
      next: paid,
      resolution: {
        amountDue,
        paid: true,
        paidAmount: amountDue,
        arrears: 0,
        missedPayments: rent.missedPayments,
      },
    }
  }

  // Insufficient coin — rent rolls over.
  const next: RentState = {
    monthlyAmount: rent.monthlyAmount,
    paidThisMonth: false,
    missedPayments: rent.missedPayments + 1,
    arrears: amountDue,
  }
  // Phase 16 §16.3 — missed rent stacks `rent_missed_recently` strength;
  // repeated misses keep the memory live for the full 28-day window.
  ctx.addMemory({
    id: 'rent_missed_recently',
    source: SOURCE,
    metadata: { amount: amountDue, missedPayments: next.missedPayments },
  })
  ctx.addHistory({
    category: 'monthly',
    summary: `Rent went unpaid (${amountDue} coin owed; ${next.missedPayments} miss total).`,
    tags: ['monthly', 'rent', 'unpaid', 'risk'],
    relatedSystems: ['monthly'],
    mechanicalRefs: ['resolveRent'],
  })
  // Phase 17 §17.5 — missed rent drives landlord pressure up. Weight
  // reflects the seriousness; tags carry the rent/landlord pair so the
  // cause report groups them naturally.
  ctx.addCause({
    source: 'monthly.rent',
    sourceType: 'monthly',
    target: 'pressure:landlord',
    targetType: 'pressure',
    amount: 25,
    weight: 50,
    direction: 'increase',
    readable: `Rent went unpaid (${amountDue} coin owed) — landlord pressure rising.`,
    tags: ['monthly', 'rent', 'unpaid', 'landlord', 'pressure', 'risk'],
    relatedSystems: ['monthly', 'landlord'],
    expiresAfterDays: 28,
  })
  return {
    next,
    resolution: {
      amountDue,
      paid: false,
      paidAmount: 0,
      arrears: amountDue,
      missedPayments: next.missedPayments,
    },
  }
}
