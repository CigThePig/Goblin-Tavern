import type { SimContext } from '../../core/context'

import {
  payRent,
  rentOutstanding,
  settleRentAtMonthEnd,
} from '../tenancy/tenancy'
import { getTenancy } from '../tenancy/state'

import type { RentResolution, RentState } from './types'
import { RENT_PAYMENT_EFFECT_TARGET } from './types'

export { RENT_PAYMENT_EFFECT_TARGET }

// Phase 15 §15.2 — Rent.
//
// Expansion Phase 7 §7.2 — RENT MOVED. The four numbers this file used to
// own (`monthlyAmount`, `paidThisMonth`, `missedPayments`, `arrears`) are
// now a PROJECTION of a real tenancy: the rent for each period is an
// `ObligationRecord` in the shared ledger with its own due day, grace
// window, late charges and payment history, and the tenancy module owns
// every transition (`src/sim/modules/tenancy/`). `modules.monthly.rent`
// survives untouched in shape, because the pressure calculators, the
// `debt_rent` card and the monthly report all read it — but it is written
// only by `syncTenancyStatus`, so it can no longer disagree with the
// obligation it describes.
//
// This file is therefore a thin adapter with three jobs, kept because three
// callers depend on its signatures: the month-end sweep, the card's payment
// route (`monthly.rent.payment`), and the monthly report's `RentResolution`.
// The Phase 200 rule that made all three the same transition still holds —
// it is simply now enforced one level down, in the tenancy module.

/** What paying the rent costs right now: this month's amount plus arrears. */
export function rentAmountDue(rent: RentState): number {
  return rent.monthlyAmount + rent.arrears
}

/**
 * Pay everything owed, or nothing.
 *
 * Kept for callers that want the all-or-nothing semantics the month-end
 * sweep has always had. Returns the updated projection on success, or
 * `undefined` when the coin is not there — in which case nothing has been
 * mutated. Partial payment goes through `payRent` in the tenancy module.
 */
export function payRentInFull(
  ctx: SimContext,
  rent: RentState,
  options: { origin: string },
): RentState | undefined {
  const owed = rentOutstanding(ctx.state)
  if (owed <= 0) return { ...rent, paidThisMonth: true, arrears: 0 }
  if (ctx.state.coin < owed) return undefined
  payRent(ctx, owed, options.origin)
  const tenancy = getTenancy(ctx.state)
  return {
    monthlyAmount: rent.monthlyAmount,
    paidThisMonth: true,
    missedPayments: tenancy?.missedPeriods ?? rent.missedPayments,
    arrears: 0,
  }
}

/**
 * Pay the rent from a response. Returns the amount that left the till — 0
 * when the payment could not be made, in which case nothing was mutated.
 *
 * The card's `monthly.rent.payment` effect routes here. It now allows a
 * PARTIAL payment, because the tenancy's notice ladder explicitly names
 * "a part payment delays the next step" as a remedy, and a route that
 * refused anything short of the full amount would make that promise
 * unkeepable.
 */
export function payRentFromResponse(ctx: SimContext, source: string): number {
  const owed = rentOutstanding(ctx.state)
  if (owed <= 0) return 0
  const result = payRent(ctx, Math.min(owed, ctx.state.coin), source)
  return result.paid
}

/**
 * The month-end settlement, as the monthly module has always called it.
 *
 * `rent` is the projection the caller read (possibly with a tax-month bump
 * folded in); the delta above `monthlyAmount` is passed through as a
 * surcharge on this period's obligation so the extra is a real debt to the
 * same landlord rather than a second row nobody can pay.
 */
export function resolveRent(
  ctx: SimContext,
  rent: RentState,
): { next: RentState; resolution: RentResolution } {
  const tenancyBefore = getTenancy(ctx.state)
  const baseRent = tenancyBefore?.rentPerPeriod ?? rent.monthlyAmount
  const surcharge = Math.max(0, rent.monthlyAmount - baseRent)

  const outcome = settleRentAtMonthEnd(ctx, { surcharge })
  const tenancy = getTenancy(ctx.state)

  const next: RentState = {
    monthlyAmount: baseRent,
    paidThisMonth: outcome.paid,
    missedPayments: outcome.missedPeriods,
    arrears: outcome.arrears,
  }
  return {
    next,
    resolution: {
      amountDue: outcome.amountDue,
      paid: outcome.paid,
      paidAmount: outcome.paidAmount,
      arrears: outcome.arrears,
      missedPayments: outcome.missedPeriods,
    },
  }
}
