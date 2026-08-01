import type { SimContext } from '../../core/context'
import type { StaffState, TavernState } from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import { spendCoin } from '../stock/ledger'
import { getRule } from '../../contracts/ruleset/index'
import {
  listObligations,
  openObligation,
  outstandingAmount,
  payObligation,
  recordObligationPayment,
  upsertObligation,
  type ObligationRecord,
} from '../../contracts/obligations/index'
import { scheduleObligationDueDate } from '../../contracts/obligations/index'

import {
  bumpStaffTotal,
  writeStaffSlice,
  STAFF_MODULE_ID,
} from './workforceState'
import type { StaffWageSettlement } from './workforceTypes'

// Expansion Phase 3 §3.1 — wages, and what happens when they are not paid.
//
// WHAT CHANGED. The Phase 14 rule was a switch: if the till covered the whole
// bill everybody was paid, otherwise nobody was and each staff member took the
// same morale hit. Non-payment was therefore a mood, not a debt — nothing was
// owed to anybody afterwards, so no rule could read it, and "wage payment and
// nonpayment across multiple weeks" had nothing to accumulate.
//
// Now the settlement is partial-first and the shortfall becomes a REAL PAYABLE
// per person, opened through the Phase 1 obligation ledger. That gives the rest
// of the phase something to work with: the quit-risk resolver reads a specific
// person's arrears (§3.4 item 2, "identify preventable contributors"), the
// player can clear them with `pay_staff_wages` (item 3, counterplay), and the
// ledger's own due→grace→default machinery escalates them without this file
// reimplementing a calendar.
//
// THE REFERENCE ROUTE IS UNTOUCHED. When the till covers the bill, no obligation
// is opened at all — the coin moves and the morale effects are exactly the Phase
// 14 ones. A payable exists only when there is a genuine debt, which keeps the
// obligation ledger a record of real arrears instead of a receipt printer.
//
// WHO GETS PAID FIRST. Longest-serving first, id as the tie-break. It is a
// judgement, and it is deliberate: an arbitrary or coin-order rule would make a
// shortfall feel like a dice roll, and paying the newest first would punish
// loyalty. Deterministic ordering also matters mechanically — a reload must
// settle the same week the same way.

const SOURCE = 'staff.wages'

/** How long an unpaid wage sits before the ledger calls it due. */
const ARREARS_DUE_DAYS = 3

/** Morale/stress/loyalty movement for a wage paid in full. */
const PAID_MORALE = 2
const PAID_LOYALTY = 1
const PAID_STRESS = -1

/**
 * The full Phase 14 hit, for somebody paid nothing.
 *
 * A partial payment scales these by the fraction still owed, so paying most of
 * somebody's wage is most of the way to keeping them — which is the whole point
 * of allowing partial payment.
 */
const UNPAID_MORALE = -8
const UNPAID_STRESS = 6
const UNPAID_LOYALTY = -4

export function wageArrearsTag(staffId: string): string {
  return `wage_arrears:${staffId}`
}

/** Live wage arrears for one staff member, soonest due first. */
export function listWageArrears(
  state: TavernState,
  staffId?: string,
): ObligationRecord[] {
  return listObligations(state, {
    direction: 'payable',
    ownerModuleId: STAFF_MODULE_ID,
  }).filter(
    (record) =>
      record.tags.includes('wages') &&
      (staffId === undefined || record.tags.includes(wageArrearsTag(staffId))),
  )
}

export function totalWageArrears(state: TavernState, staffId?: string): number {
  return listWageArrears(state, staffId).reduce(
    (sum, record) => sum + outstandingAmount(record),
    0,
  )
}

function paymentOrder(staff: ReadonlyArray<StaffState>): StaffState[] {
  return [...staff].sort(
    (a, b) =>
      (b.daysEmployed ?? 0) - (a.daysEmployed ?? 0) || a.id.localeCompare(b.id),
  )
}

// ---------------------------------------------------------------------------
// The weekly settlement
// ---------------------------------------------------------------------------

/**
 * Settle the week's wages, opening arrears for whatever the till could not cover.
 *
 * Returns the same `WeeklyWageResolution` shape the weekly module already
 * reports, so nothing downstream had to change — the depth is in the settlement
 * record written to the staff slice and the payables left in the ledger.
 */
export function settleWeeklyWages(ctx: SimContext): {
  totalDue: number
  paid: boolean
  paidAmount: number
  unpaidStaffIds: string[]
  settlement: StaffWageSettlement
} {
  const today = ctx.state.calendar.totalDaysElapsed
  const staff = paymentOrder(Object.values(ctx.state.staff))
  const totalDue = staff.reduce((sum, member) => sum + member.wage, 0)

  if (totalDue <= 0) {
    const settlement: StaffWageSettlement = {
      onDay: today,
      totalDue: 0,
      paid: 0,
      shortfall: 0,
      perStaff: [],
      arrearsObligationIds: listWageArrears(ctx.state).map((r) => r.id),
      readable: 'No wages due.',
    }
    writeSettlement(ctx, settlement)
    return {
      totalDue: 0,
      paid: true,
      paidAmount: 0,
      unpaidStaffIds: [],
      settlement,
    }
  }

  // Pay down existing arrears before this week's wages. Somebody the player
  // already owes for is owed for longer, and clearing the oldest debt first is
  // what stops arrears becoming permanent background noise.
  //
  // `spend: true` is load-bearing. Without it the arrears were marked settled and
  // the staff member was told they had been paid, but the coin never left the
  // till — the only `spendCoin` below charges this week's wages alone — so the
  // same funds cleared back pay again every settlement. Arrears get their own
  // ledger line rather than being folded into the wage line, because "we finally
  // paid what we owed" and "we paid this week" are different entries in a P/L.
  let purse = ctx.state.coin
  const arrearsPaid = payDownArrears(ctx, purse, 'weekly settlement', {
    spend: true,
  })
  purse -= arrearsPaid

  const perStaff: StaffWageSettlement['perStaff'] = []
  let paidTotal = 0

  for (const member of staff) {
    const due = member.wage
    const paid = Math.max(0, Math.min(due, purse))
    purse -= paid
    paidTotal += paid
    const shortfall = due - paid

    let obligationId: string | undefined
    if (shortfall > 0) {
      obligationId = openWageArrears(ctx, member, shortfall, today)
    }
    perStaff.push({
      staffId: member.id,
      due,
      paid,
      ...(obligationId !== undefined ? { obligationId } : {}),
    })
  }

  if (paidTotal > 0) {
    spendCoin(ctx, paidTotal, {
      source: SOURCE,
      category: 'wage',
      tags: ['wages', 'weekly'],
    })
  }

  // The morale consequences, scaled per person by what they actually got.
  for (const row of perStaff) {
    const member = ctx.state.staff[row.staffId]
    if (!member) continue
    const fraction = row.due > 0 ? row.paid / row.due : 1
    if (fraction >= 1) applyPaidEffects(ctx, member)
    else applyUnpaidEffects(ctx, member, fraction)
  }

  const shortfall = totalDue - paidTotal
  bumpStaffTotal(ctx, 'wagesPaid', paidTotal)
  if (shortfall > 0) bumpStaffTotal(ctx, 'wageShortfall', shortfall)

  const unpaidStaffIds = perStaff
    .filter((row) => row.paid < row.due)
    .map((row) => row.staffId)

  const settlement: StaffWageSettlement = {
    onDay: today,
    totalDue,
    paid: paidTotal,
    shortfall,
    perStaff,
    arrearsObligationIds: listWageArrears(ctx.state).map((r) => r.id),
    readable:
      shortfall <= 0
        ? `Wages paid in full (${paidTotal} coin).`
        : `Wages part-paid: ${paidTotal} of ${totalDue} coin. ${shortfall} coin owed to ${unpaidStaffIds.length} hand(s).`,
  }
  writeSettlement(ctx, settlement)

  ctx.addMemory({
    id: shortfall <= 0 ? 'wages_paid_recently' : 'wages_unpaid_recently',
    source: SOURCE,
    relatedSystems: ['staff'],
    actors: staff.map((s) => ({ kind: 'staff' as const, id: s.id })),
    metadata: { totalDue, paid: paidTotal, shortfall },
  })
  ctx.addHistory({
    category: 'weekly',
    summary: settlement.readable,
    tags: [
      'weekly',
      'wages',
      shortfall <= 0 ? 'paid' : 'unpaid',
      ...(shortfall > 0 ? ['risk'] : []),
    ],
    relatedActors: staff.map((s) => ({ kind: 'staff' as const, id: s.id })),
    relatedSystems: ['staff'],
    mechanicalRefs: ['settleWeeklyWages'],
  })

  return {
    totalDue,
    // `paid` stays a whole-bill boolean because that is what the weekly report
    // and the weekly trend already mean by it. The per-person truth is in
    // `perStaff`.
    paid: shortfall <= 0,
    paidAmount: paidTotal,
    unpaidStaffIds,
    settlement,
  }
}

function writeSettlement(ctx: SimContext, settlement: StaffWageSettlement): void {
  writeStaffSlice(
    ctx,
    (current) => ({ ...current, lastWageSettlement: settlement }),
    'wage_settlement',
  )
}

/**
 * Open an arrears payable for one person's shortfall.
 *
 * Through the shared ledger, so the due→grace→default progression is the one
 * every other obligation uses (§1.2) and the terms are captured from the ruleset
 * at open time rather than re-read later.
 */
export function openWageArrears(
  ctx: SimContext,
  member: StaffState,
  amount: number,
  today: number,
): string {
  const graceDays = getRule(ctx.state, 'obligationGraceDays')
  const lateChargeRate = getRule(ctx.state, 'obligationLateChargeRate')
  const id = `obl-${STAFF_MODULE_ID}-wages-${member.id}-${today}`
  const record = openObligation({
    id,
    ownerModuleId: STAFF_MODULE_ID,
    counterparty: { kind: 'staff', id: member.id },
    direction: 'payable',
    principal: Math.round(amount),
    openedOnDay: today,
    dueOnDay: today + ARREARS_DUE_DAYS,
    graceDays,
    lateChargeRate,
    readable: `${Math.round(amount)} coin of ${member.name.display}'s wages went unpaid.`,
    tags: ['staff', 'wages', 'arrears', wageArrearsTag(member.id), member.role],
  })
  upsertObligation(ctx, record, 'wage_arrears_opened')
  scheduleObligationDueDate(ctx, record)
  return id
}

/**
 * Spend up to `budget` clearing the oldest arrears.
 *
 * Returns what was actually spent. `spend: true` moves the coin here, on its own
 * ledger line; both callers pass it. (They did not always: the weekly settlement
 * used to leave the movement to its own batched `spendCoin`, which charged this
 * week's wages only — so back pay was written off and cleared again for free the
 * following week.)
 */
export function payDownArrears(
  ctx: SimContext,
  budget: number,
  reason: string,
  options: { spend?: boolean; staffId?: string } = {},
): number {
  if (budget <= 0) return 0
  const today = ctx.state.calendar.totalDaysElapsed
  const records = listWageArrears(ctx.state, options.staffId)
  // `coin` is an integer state invariant. Old saves can still contain a
  // fractional late charge from the pre-Phase-5 obligation rule, so treat the
  // budget as whole coins and round a final settlement up at the payment
  // boundary. The tiny overage belongs to the creditor; it never enters the
  // obligation's applied-payment total or makes the till fractional.
  let remaining = Math.min(Math.floor(budget), ctx.state.coin)
  let spent = 0

  for (const record of records) {
    if (remaining <= 0) break
    const owed = outstandingAmount(record)
    if (owed <= 0) continue
    const offeredCoin = Math.min(Math.ceil(owed), remaining)
    const result = payObligation(record, offeredCoin, today, reason)
    if (result.applied <= 0) continue
    const coinSpent = Math.ceil(result.applied)
    upsertObligation(ctx, result.record, 'wage_arrears_paid')
    recordObligationPayment(ctx, result.applied, 'wage_arrears_paid')
    remaining -= coinSpent
    spent += coinSpent

    const staffId = staffIdFromArrears(record)
    const member = staffId ? ctx.state.staff[staffId] : undefined
    if (member) {
      // Being paid what you were owed repairs some of the damage, and settling
      // in full repairs more. This is the counterplay half of the quit-risk
      // contributors list: the player can actually undo this one.
      const repaired = result.settled ? 6 : 3
      ctx.modifyStaff(
        member.id,
        {
          morale: clampPercent(member.morale + repaired),
          loyalty: clampPercent(member.loyalty + Math.round(repaired / 2)),
          ...(result.settled ? { paidThisWeek: true } : {}),
        },
        {
          source: `${SOURCE}.arrears_paid`,
          sourceType: 'staff',
          target: `staff:${member.id}.morale`,
          targetType: 'staff',
          amount: repaired,
          readable: result.settled
            ? `${member.name.display} was finally paid what they were owed.`
            : `${member.name.display} got ${result.applied} coin of their back pay.`,
          tags: ['staff', 'wages', 'arrears', 'paid', member.id],
          relatedActors: [{ kind: 'staff', id: member.id }],
          relatedSystems: ['staff'],
        },
      )
    }
  }

  if (spent > 0 && options.spend) {
    spendCoin(ctx, spent, {
      source: `${SOURCE}.arrears`,
      category: 'wage',
      tags: ['wages', 'arrears'],
    })
  }
  return spent
}

export function staffIdFromArrears(record: ObligationRecord): string | undefined {
  const tag = record.tags.find((t) => t.startsWith('wage_arrears:'))
  return tag ? tag.slice('wage_arrears:'.length) : undefined
}

function applyPaidEffects(ctx: SimContext, member: StaffState): void {
  const nextMorale = clampPercent(member.morale + PAID_MORALE)
  const nextLoyalty = clampPercent(member.loyalty + PAID_LOYALTY)
  const nextStress = clampPercent(member.stress + PAID_STRESS)
  ctx.modifyStaff(
    member.id,
    {
      paidThisWeek: true,
      morale: nextMorale,
      loyalty: nextLoyalty,
      stress: nextStress,
    },
    { source: SOURCE, reason: 'wages_paid' },
  )
  ctx.addCause({
    source: SOURCE,
    sourceType: 'weekly',
    target: `staff:${member.id}.morale`,
    targetType: 'staff',
    amount: nextMorale - member.morale,
    readable: `Paid wages stabilized ${member.name.display}'s morale.`,
    tags: ['weekly', 'wages', 'paid', member.id, 'morale'],
    relatedActors: [{ kind: 'staff', id: member.id }],
    relatedSystems: ['staff'],
    expiresAfterDays: 7,
  })
}

/**
 * `fraction` is how much of their wage they actually received, 0..1. The Phase 14
 * numbers are the `fraction === 0` case exactly, so a total non-payment behaves
 * as it always did and a partial one is proportionally softer.
 */
function applyUnpaidEffects(
  ctx: SimContext,
  member: StaffState,
  fraction: number,
): void {
  const severity = Math.max(0, Math.min(1, 1 - fraction))
  const nextMorale = clampPercent(member.morale + Math.round(UNPAID_MORALE * severity))
  const nextStress = clampPercent(member.stress + Math.round(UNPAID_STRESS * severity))
  const nextLoyalty = clampPercent(
    member.loyalty + Math.round(UNPAID_LOYALTY * severity),
  )
  ctx.modifyStaff(
    member.id,
    {
      paidThisWeek: false,
      morale: nextMorale,
      stress: nextStress,
      loyalty: nextLoyalty,
    },
    { source: SOURCE, reason: 'wages_unpaid' },
  )
  ctx.addCause({
    source: SOURCE,
    sourceType: 'weekly',
    target: `staff:${member.id}.morale`,
    targetType: 'staff',
    amount: nextMorale - member.morale,
    weight: 30,
    readable:
      fraction <= 0
        ? `Wages went unpaid — ${member.name.display} morale dropped.`
        : `${member.name.display} was only part-paid — morale dropped.`,
    tags: ['weekly', 'wages', 'unpaid', member.id, 'morale', 'risk'],
    relatedActors: [{ kind: 'staff', id: member.id }],
    relatedSystems: ['staff'],
    expiresAfterDays: 14,
  })
}
