import type { SimContext } from '../../core/context'
import { settleWeeklyWages } from '../staff/staffWages'

import type { WeeklyWageResolution } from './types'

// Phase 14 §14.2 — Wages.
//
// The rule this file used to implement, from the Phase 14 doc:
//
//   If coin can cover all wages, pay all wages automatically.
//   If coin cannot cover all wages, pay none automatically and mark
//   wages unpaid.
//
// Expansion Phase 3 §3.1 REPLACES the second half of that rule and moves the
// whole settlement into the staff domain, which is the module that owns
// employment (§5.4). Two reasons, both structural rather than stylistic:
//
//   * Partial payment is now the normal case. "Pay none" made non-payment a
//     mood rather than a debt: nothing was owed to anybody afterwards, so no
//     rule could read it and the plan's "wage payment and nonpayment across
//     multiple weeks" had nothing to accumulate. The shortfall now becomes a
//     real per-person payable in the shared obligation ledger, which the
//     quit-risk resolver reads and the `pay_staff_wages` action can clear.
//
//   * The morale effects belong next to the terms they are about. `staffWages.ts`
//     holds the wage rules; this file is the weekly module asking for them.
//
// The paid-in-full path is unchanged, deliberately: the same coin leaves the
// till through the same ledger category and the same modest morale/loyalty/stress
// movement lands, so the reference route's numbers did not move.

export function resolveWages(ctx: SimContext): WeeklyWageResolution {
  const result = settleWeeklyWages(ctx)
  return {
    totalDue: result.totalDue,
    paid: result.paid,
    paidAmount: result.paidAmount,
    unpaidStaffIds: result.unpaidStaffIds,
  }
}
