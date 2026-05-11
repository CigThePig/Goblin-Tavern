import type { SimContext } from '../../core/context'
import type { StaffState } from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import { spendCoin } from '../stock/ledger'

import type { WeeklyWageResolution } from './types'

// Phase 14 §14.2 — Wages.
//
// Recommended behaviour from the phase doc:
//
//   If coin can cover all wages, pay all wages automatically.
//   If coin cannot cover all wages, pay none automatically and mark
//   wages unpaid.
//
// Partial payment is intentionally out of scope. Wages route through
// the Phase 9 ledger (`spendCoin`, category 'wage') so the weekly P/L
// picks them up via the same accumulator that catches sales, purchases,
// and repairs.

const SOURCE = 'weekly.wages'

function totalWageBill(staff: ReadonlyArray<StaffState>): number {
  let sum = 0
  for (const member of staff) sum += member.wage
  return sum
}

function applyPaidEffects(ctx: SimContext, staff: StaffState): void {
  // Paid wages stabilise: a modest morale bump, a sliver of loyalty,
  // and a tiny stress shed. Phase 14 §14.6 also runs the broader staff
  // weekly trend separately, so the numbers here stay conservative.
  const nextMorale = clampPercent(staff.morale + 2)
  const nextLoyalty = clampPercent(staff.loyalty + 1)
  const nextStress = clampPercent(staff.stress - 1)
  ctx.modifyStaff(
    staff.id,
    {
      paidThisWeek: true,
      morale: nextMorale,
      loyalty: nextLoyalty,
      stress: nextStress,
    },
    { source: SOURCE, reason: 'wages_paid' },
  )
}

function applyUnpaidEffects(ctx: SimContext, staff: StaffState): void {
  // Phase 14 §14.2 — unpaid wages bite: morale down, stress up, loyalty
  // slips. Held intentionally moderate; chronic non-payment compounds
  // over weeks rather than detonating in a single one.
  const nextMorale = clampPercent(staff.morale - 8)
  const nextStress = clampPercent(staff.stress + 6)
  const nextLoyalty = clampPercent(staff.loyalty - 4)
  ctx.modifyStaff(
    staff.id,
    {
      paidThisWeek: false,
      morale: nextMorale,
      stress: nextStress,
      loyalty: nextLoyalty,
    },
    { source: SOURCE, reason: 'wages_unpaid' },
  )
}

export function resolveWages(ctx: SimContext): WeeklyWageResolution {
  const staff = Object.values(ctx.state.staff)
  const totalDue = totalWageBill(staff)

  if (totalDue <= 0) {
    return {
      totalDue: 0,
      paid: true,
      paidAmount: 0,
      unpaidStaffIds: [],
    }
  }

  if (ctx.state.coin >= totalDue) {
    spendCoin(ctx, totalDue, {
      source: SOURCE,
      category: 'wage',
      tags: ['wages', 'weekly'],
    })
    for (const member of staff) applyPaidEffects(ctx, member)
    // Phase 16 §16.3 — wages paid memory + history record.
    ctx.addMemory({
      id: 'wages_paid_recently',
      source: SOURCE,
      relatedSystems: ['staff'],
      actors: staff.map((s) => ({ kind: 'staff' as const, id: s.id })),
      metadata: { totalDue },
    })
    ctx.addHistory({
      category: 'weekly',
      summary: `Wages paid in full (${totalDue} coin).`,
      tags: ['weekly', 'wages', 'paid'],
      relatedActors: staff.map((s) => ({ kind: 'staff' as const, id: s.id })),
      relatedSystems: ['staff'],
      mechanicalRefs: ['resolveWages'],
    })
    return {
      totalDue,
      paid: true,
      paidAmount: totalDue,
      unpaidStaffIds: [],
    }
  }

  // Insufficient coin — pay nobody. Recommended behaviour from §14.2.
  for (const member of staff) applyUnpaidEffects(ctx, member)
  // Phase 16 §16.3 — repeated unpaid weeks stack strength on this memory,
  // which feeds the `repeated_unpaid_wages` pattern detector.
  ctx.addMemory({
    id: 'wages_unpaid_recently',
    source: SOURCE,
    relatedSystems: ['staff'],
    actors: staff.map((s) => ({ kind: 'staff' as const, id: s.id })),
    metadata: { totalDue },
  })
  ctx.addHistory({
    category: 'weekly',
    summary: `Wages went unpaid (${totalDue} coin shortfall).`,
    tags: ['weekly', 'wages', 'unpaid', 'risk'],
    relatedActors: staff.map((s) => ({ kind: 'staff' as const, id: s.id })),
    relatedSystems: ['staff'],
    mechanicalRefs: ['resolveWages'],
  })
  return {
    totalDue,
    paid: false,
    paidAmount: 0,
    unpaidStaffIds: staff.map((s) => s.id),
  }
}
