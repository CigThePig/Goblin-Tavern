import type { SimContext } from '../../core/context'

import { spendCoin } from '../stock/ledger'

import type { RentResolution, RentState } from './types'

// Phase 15 §15.2 — Rent.
//
// At end of month, attempt to pay rent through the Phase 9 ledger. The
// resolution captures whether the payment went through, the amount that
// hit the ledger, and the updated arrears/missed-payment counters.

const SOURCE = 'monthly.rent'

export function resolveRent(
  ctx: SimContext,
  rent: RentState,
): { next: RentState; resolution: RentResolution } {
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

  if (ctx.state.coin >= amountDue) {
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
    return {
      next,
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
