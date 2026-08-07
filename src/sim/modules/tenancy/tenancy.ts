import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'
import { getRule } from '../../contracts/ruleset/index'
import {
  forgiveObligation,
  getObligation,
  nextObligationId,
  openObligation,
  outstandingAmount,
  payObligation,
  recordObligationPayment,
  scheduleObligationDueDate,
  settleObligation,
  upsertObligation,
  type ObligationRecord,
} from '../../contracts/obligations/index'
import { spendCoin } from '../stock/ledger'
import { ECONOMY_MODULE_ID } from '../economy/state'
import type { EconomyModuleState } from '../economy/types'
import { MONTHLY_MODULE_ID } from '../monthly/types'
import type { MonthlyModuleState, RentState } from '../monthly/types'

import {
  bumpTenancyTotals,
  getLandlord,
  getTenancy,
  getTenancyModuleState,
  landlordRef,
  nextNoticeId,
  recordLandlordBelief,
  upsertNotice,
  writeLandlord,
  writeTenancy,
  writeTenancyState,
} from './state'
import {
  LANDLORD_ID,
  LANDLORD_LABEL,
  MAX_NEGOTIATIONS,
  NOTICE_LADDER,
  TENANCY_MODULE_ID,
  liveNotice,
  noticeRung,
  type TavernTenancyRecord,
  type TenancyConcession,
  type TenancyNotice,
  type TenancyNoticeKind,
} from './types'
import {
  beliefEffect,
  publicBeliefAgainstHouse,
} from '../attribution/beliefInputs'

/** The most the town's talk may raise the landlord's bar. */
export const MAX_LANDLORD_BELIEF_BUMP = 8

// Expansion Phase 7 §7.2 — every tenancy transition, in one place (§5.4).
//
// The events in `tenancyEvents.ts` and the actions in `actions.ts` decide
// WHEN and WHETHER; this file decides WHAT. That is what keeps rent paid
// from the debt/rent card, rent paid from the action picker, and rent swept
// at month end the same transition — the audit's `P7-EXP-001` was exactly
// what happens when they are three.

const SOURCE = TENANCY_MODULE_ID

/** Days in a rent period. One calendar month, so rent still lands at month end. */
export const RENT_PERIOD_DAYS = 28

/** The shipped rent. Matches the Phase 15 monthly default it replaces. */
export const DEFAULT_RENT_PER_PERIOD = 120

// ---------- Opening ----------

/**
 * Open the tenancy if it is not already open, and make sure the current
 * period has a real obligation behind it.
 *
 * Idempotent, and called from the module's daily hook, so a fresh run, a
 * migrated save, and a reload all converge on the same record without
 * anything having to remember to call it once.
 */
export function ensureTenancy(ctx: SimContext): TavernTenancyRecord {
  const existing = getTenancy(ctx.state)
  if (existing) return ensurePeriodObligation(ctx, existing)

  const today = ctx.state.calendar.totalDaysElapsed
  // Carry the rent the save is already playing with rather than imposing
  // this module's default on a run in progress.
  const monthly = ctx.state.modules[MONTHLY_MODULE_ID] as
    | { rent?: Partial<RentState> }
    | undefined
  const rentPerPeriod = monthly?.rent?.monthlyAmount ?? DEFAULT_RENT_PER_PERIOD
  // The first period ends on the first month end the calendar will reach.
  const periodEndsOnDay = today + (RENT_PERIOD_DAYS - ctx.state.calendar.day)

  const tenancy: TavernTenancyRecord = {
    id: 'tenancy-main',
    family: 'tenancy',
    ownerModuleId: TENANCY_MODULE_ID,
    counterparty: landlordRef(),
    status: 'active',
    openedOnDay: today,
    dueOnDay: periodEndsOnDay,
    graceDays: getRule(ctx.state, 'obligationGraceDays'),
    lastTransitionOnDay: today,
    history: [
      {
        onDay: today,
        from: 'pending',
        to: 'active',
        reason: `tenancy at ${rentPerPeriod} coin a month`,
        amount: rentPerPeriod,
      },
    ],
    escalation: 0,
    readable: `Tenancy with ${LANDLORD_LABEL} at ${rentPerPeriod} a month`,
    tags: ['tenancy', 'rent'],
    rentPerPeriod,
    periodDays: RENT_PERIOD_DAYS,
    missedPeriods: monthly?.rent?.missedPayments ?? 0,
    landlordId: LANDLORD_ID,
    tenancyStatus: 'current',
    periodEndsOnDay,
    periodIndex: 0,
    lastBilledPeriodIndex: -1,
    arrearObligationIds: [],
    totalPaid: 0,
    periodsPaidOnTime: 0,
    everPaid: false,
  }
  writeTenancy(ctx, tenancy, 'tenancy_opened')
  return ensurePeriodObligation(ctx, tenancy)
}

/** Raise the current period's rent obligation if it has none. */
export function ensurePeriodObligation(
  ctx: SimContext,
  tenancy: TavernTenancyRecord,
): TavernTenancyRecord {
  if (tenancy.tenancyStatus === 'evicted' || tenancy.tenancyStatus === 'terminated') {
    return tenancy
  }
  if (tenancy.currentObligationId) {
    const live = getObligation(ctx.state, tenancy.currentObligationId)
    if (live) return tenancy
  }
  // Already billed, and the obligation is gone because it was PAID. Billing
  // again would charge a player twice for clearing their rent early.
  if (tenancy.lastBilledPeriodIndex >= tenancy.periodIndex) return tenancy
  const today = ctx.state.calendar.totalDaysElapsed
  const rent = effectiveRent(tenancy)
  if (rent <= 0) return tenancy

  const id = nextObligationId(ctx.state, TENANCY_MODULE_ID)
  const obligation = openObligation({
    id,
    ownerModuleId: TENANCY_MODULE_ID,
    counterparty: tenancy.counterparty,
    direction: 'payable',
    principal: rent,
    openedOnDay: today,
    dueOnDay: tenancy.periodEndsOnDay,
    graceDays: tenancy.graceDays,
    lateChargeRate: getRule(ctx.state, 'obligationLateChargeRate'),
    readable: `Rent, month ${tenancy.periodIndex + 1}`,
    tags: ['rent', 'tenancy'],
  })
  upsertObligation(ctx, obligation, 'rent_period_opened')
  scheduleObligationDueDate(ctx, obligation)

  const next: TavernTenancyRecord = {
    ...tenancy,
    currentObligationId: id,
    lastBilledPeriodIndex: tenancy.periodIndex,
  }
  writeTenancy(ctx, next, 'rent_period_opened')
  bumpTenancyTotals(ctx, { periodsBilled: 1 }, 'rent_period_opened')
  return next
}

/** Rent for the current period after any concession the landlord granted. */
export function effectiveRent(tenancy: TavernTenancyRecord): number {
  const factor = tenancy.concession?.rentFactor ?? 1
  return Math.max(0, Math.round(tenancy.rentPerPeriod * factor))
}

// ---------- Reads ----------

/** Every live rent obligation, arrears first (oldest debt is paid first). */
export function rentObligations(state: TavernState): ObligationRecord[] {
  const tenancy = getTenancy(state)
  if (!tenancy) return []
  const out: ObligationRecord[] = []
  for (const id of tenancy.arrearObligationIds) {
    const record = getObligation(state, id)
    if (record) out.push(record)
  }
  if (tenancy.currentObligationId) {
    const record = getObligation(state, tenancy.currentObligationId)
    if (record) out.push(record)
  }
  return out
}

/** What clearing the tavern's rent position would cost today. */
export function rentOutstanding(state: TavernState): number {
  return rentObligations(state).reduce(
    (sum, record) => sum + outstandingAmount(record),
    0,
  )
}

/**
 * Rent the tavern is BEHIND on.
 *
 * Anything whose due day has arrived and has not been settled, whether or
 * not the period has formally rolled over yet — the rollover happens the
 * morning after the period ends, and a month that went unpaid on the day it
 * was due is behind from that moment, not from the next sunrise. That is
 * also the meaning `modules.monthly.rent.arrears` has always carried, which
 * is what keeps the daily/weekly/monthly accounting rows agreeing.
 */
export function arrearsOutstanding(state: TavernState): number {
  const today = state.calendar.totalDaysElapsed
  return rentObligations(state).reduce((sum, record) => {
    const due = record.dueOnDay ?? record.openedOnDay
    return due <= today ? sum + outstandingAmount(record) : sum
  }, 0)
}

/**
 * Rent that has run out of grace as well as out of time.
 *
 * The landlord's own threshold, and deliberately later than
 * `arrearsOutstanding`: a tavern that settles on the day the rent falls due
 * has not wronged anybody, and the landlord should not be quietly counting
 * it against them once a month for ever.
 */
export function rentPastGrace(state: TavernState): number {
  const today = state.calendar.totalDaysElapsed
  return rentObligations(state).reduce((sum, record) => {
    const due = record.dueOnDay ?? record.openedOnDay
    return due + record.graceDays < today ? sum + outstandingAmount(record) : sum
  }, 0)
}

// ---------- Payment ----------

export type RentPaymentResult = {
  paid: number
  /** True when nothing is left owing across current period and arrears. */
  clear: boolean
  settledObligations: number
  readable: string
}

/**
 * Pay rent, oldest debt first, as far as the offer and the till stretch.
 *
 * Partial payment is the normal case and does NOT move a deadline: half of
 * a late month buys goodwill with the landlord, not another month.
 */
export function payRent(
  ctx: SimContext,
  amountOffered: number,
  reason: string,
): RentPaymentResult {
  const tenancy = getTenancy(ctx.state)
  if (!tenancy) {
    return { paid: 0, clear: true, settledObligations: 0, readable: 'No tenancy.' }
  }
  const today = ctx.state.calendar.totalDaysElapsed
  let budget = Math.min(
    Math.max(0, Math.floor(amountOffered)),
    ctx.state.coin,
  )
  if (budget <= 0) {
    return {
      paid: 0,
      clear: rentOutstanding(ctx.state) <= 0,
      settledObligations: 0,
      readable:
        ctx.state.coin <= 0 ? 'The till is empty.' : 'Nothing offered against the rent.',
    }
  }

  let paid = 0
  let settledCount = 0
  const settledIds: string[] = []
  for (const record of rentObligations(ctx.state)) {
    if (budget <= 0) break
    const outstanding = outstandingAmount(record)
    if (outstanding <= 0) continue
    const applied = Math.min(outstanding, budget)
    spendCoin(ctx, applied, {
      source: `${SOURCE}.rent`,
      category: 'rent',
      readable: `Paid ${applied} of ${record.readable}.`,
      tags: ['rent', 'tenancy', 'monthly'],
    })
    const result = payObligation(record, applied, today, reason)
    upsertObligation(ctx, result.record, 'rent_payment')
    recordObligationPayment(ctx, applied, 'rent_payment')
    paid += applied
    budget -= applied
    if (result.settled) {
      settledCount += 1
      settledIds.push(record.id)
    }
  }

  if (paid <= 0) {
    return {
      paid: 0,
      clear: rentOutstanding(ctx.state) <= 0,
      settledObligations: 0,
      readable: 'Nothing was owed.',
    }
  }

  // Fold the payment back into the agreement and clear settled arrears off
  // the record, so `arrearObligationIds` never points at a closed row.
  const current = getTenancy(ctx.state) ?? tenancy
  const remainingArrears = current.arrearObligationIds.filter(
    (id) => !settledIds.includes(id),
  )
  const currentSettled =
    current.currentObligationId !== undefined &&
    settledIds.includes(current.currentObligationId)
  const nextTenancy: TavernTenancyRecord = {
    ...current,
    arrearObligationIds: remainingArrears,
    ...(currentSettled ? { currentObligationId: undefined } : {}),
    totalPaid: current.totalPaid + paid,
    everPaid: true,
    lastTransitionOnDay: today,
  }
  writeTenancy(ctx, nextTenancy, 'rent_payment')
  bumpTenancyTotals(ctx, { rentPaid: paid }, 'rent_payment')

  // The landlord notices being paid. This is the mechanism that makes
  // paying down arrears a real route out of a notice rather than a hope.
  writeLandlord(
    ctx,
    (landlord) => ({
      ...landlord,
      opinion: Math.min(100, landlord.opinion + Math.min(10, Math.ceil(paid / 20))),
      concern: Math.max(0, landlord.concern - Math.min(25, Math.ceil(paid / 8))),
      lastContactDay: today,
    }),
    'rent_paid',
  )
  recordLandlordBelief(ctx, {
    id: 'rent_being_paid',
    readable: `Paid ${paid} coin toward the rent.`,
    weight: Math.min(30, paid),
  })

  ctx.addMemory({
    id: 'rent_paid_recently',
    source: `${SOURCE}.rent`,
    metadata: { amount: paid },
  })
  if (!ctx.hasMemory('first_rent_paid')) {
    ctx.addMemory({
      id: 'first_rent_paid',
      source: `${SOURCE}.rent`,
      metadata: { amount: paid },
    })
  }
  ctx.addHistory({
    category: 'monthly',
    summary: `Rent payment of ${paid} coin (${reason}).`,
    tags: ['tenancy', 'rent', 'paid'],
    relatedActors: [landlordRef()],
    relatedSystems: [TENANCY_MODULE_ID],
  })
  ctx.addCause({
    source: `${SOURCE}.rent`,
    sourceType: 'system',
    target: 'pressure:landlord',
    targetType: 'pressure',
    amount: -Math.min(20, Math.ceil(paid / 10)),
    direction: 'decrease',
    weight: paid,
    readable: `Rent payment of ${paid} coin.`,
    tags: ['tenancy', 'rent', 'paid', 'landlord'],
    relatedActors: [landlordRef()],
    expiresAfterDays: 14,
  })

  const clear = rentOutstanding(ctx.state) <= 0
  // Paying everything owed cures every live notice, which is exactly the
  // "cure" §7.2 asks for and the remedy every notice already names.
  if (clear) cureNotices(ctx, `rent cleared with a payment of ${paid}`)
  syncTenancyStatus(ctx)

  return {
    paid,
    clear,
    settledObligations: settledCount,
    readable: clear
      ? `Paid ${paid} coin; the rent is clear.`
      : `Paid ${paid} coin; ${rentOutstanding(ctx.state)} still owed.`,
  }
}

/**
 * The month-end sweep the monthly module has always run.
 *
 * Kept as the automatic payment it was — a player who does nothing still
 * pays their rent when the coin is there — but it now goes through the same
 * obligations the card and the action go through, so "paid" is a fact about
 * the ledger rather than a boolean somebody has to remember to set.
 */
export function settleRentAtMonthEnd(
  ctx: SimContext,
  options: { surcharge?: number } = {},
): {
  amountDue: number
  paid: boolean
  paidAmount: number
  arrears: number
  missedPeriods: number
} {
  let tenancy = ensureTenancy(ctx)
  const surcharge = Math.max(0, Math.round(options.surcharge ?? 0))
  if (surcharge > 0 && tenancy.currentObligationId) {
    // A tax month raises what is owed for THIS period. It goes onto the live
    // obligation rather than becoming a second row, because it is the same
    // debt to the same landlord on the same day.
    const record = getObligation(ctx.state, tenancy.currentObligationId)
    if (record) {
      upsertObligation(
        ctx,
        {
          ...record,
          principal: record.principal + surcharge,
          readable: `${record.readable} (+${surcharge} tax)`,
        },
        'rent_tax_surcharge',
      )
    }
  }

  const amountDue = rentOutstanding(ctx.state)
  if (amountDue <= 0) {
    return {
      amountDue: 0,
      paid: true,
      paidAmount: 0,
      arrears: 0,
      missedPeriods: tenancy.missedPeriods,
    }
  }
  // Fail closed: the sweep pays in full or not at all, so a month-end never
  // half-drains a till the player was holding for wages.
  if (ctx.state.coin < amountDue) {
    tenancy = getTenancy(ctx.state) ?? tenancy
    return {
      amountDue,
      paid: false,
      paidAmount: 0,
      arrears: arrearsOutstanding(ctx.state),
      missedPeriods: tenancy.missedPeriods,
    }
  }

  const result = payRent(ctx, amountDue, 'month-end settlement')
  tenancy = getTenancy(ctx.state) ?? tenancy
  return {
    amountDue,
    paid: result.clear,
    paidAmount: result.paid,
    arrears: arrearsOutstanding(ctx.state),
    missedPeriods: tenancy.missedPeriods,
  }
}

// ---------- Period rollover ----------

export type RolloverOutcome = {
  paid: boolean
  carriedOver: number
  notice?: TenancyNotice
  readable: string
}

/**
 * Close the period that just ended and open the next one.
 *
 * An unpaid period does not vanish and does not merge into a running
 * `arrears` number: its obligation moves to `arrearObligationIds`, keeping
 * its own due day, grace history and late charges. That is what lets a
 * notice quote an exact cure amount and lets the §7.4 calendar show which
 * month is actually outstanding.
 */
export function advanceRentPeriod(ctx: SimContext): RolloverOutcome {
  const today = ctx.state.calendar.totalDaysElapsed
  // Read, do NOT `ensureTenancy`: that would re-bill the period this
  // function is about to close, and a month the player paid on the last day
  // would be resurrected as an arrear one line later.
  let tenancy = getTenancy(ctx.state)
  if (!tenancy) {
    return { paid: false, carriedOver: 0, readable: 'There is no tenancy.' }
  }
  if (tenancy.tenancyStatus === 'evicted' || tenancy.tenancyStatus === 'terminated') {
    return { paid: false, carriedOver: 0, readable: 'The tenancy has ended.' }
  }

  const current = tenancy.currentObligationId
    ? getObligation(ctx.state, tenancy.currentObligationId)
    : undefined
  const carriedOver = current ? outstandingAmount(current) : 0
  const paid = carriedOver <= 0

  const arrearIds = current && carriedOver > 0
    ? [...tenancy.arrearObligationIds, current.id]
    : tenancy.arrearObligationIds

  tenancy = {
    ...tenancy,
    periodIndex: tenancy.periodIndex + 1,
    periodEndsOnDay: tenancy.periodEndsOnDay + tenancy.periodDays,
    currentObligationId: undefined,
    arrearObligationIds: arrearIds,
    missedPeriods: paid ? tenancy.missedPeriods : tenancy.missedPeriods + 1,
    periodsPaidOnTime: paid
      ? tenancy.periodsPaidOnTime + 1
      : tenancy.periodsPaidOnTime,
    lastTransitionOnDay: today,
    history: [
      ...tenancy.history,
      {
        onDay: today,
        from: tenancy.status,
        to: tenancy.status,
        reason: paid
          ? `month ${tenancy.periodIndex + 1} paid in full`
          : `month ${tenancy.periodIndex + 1} unpaid, ${carriedOver} carried over`,
        amount: carriedOver,
      },
    ].slice(-24),
  }
  tenancy = { ...tenancy, dueOnDay: tenancy.periodEndsOnDay }
  writeTenancy(ctx, tenancy, 'rent_period_rollover')
  bumpTenancyTotals(
    ctx,
    paid ? { periodsPaid: 1 } : { periodsMissed: 1 },
    'rent_period_rollover',
  )

  // A concession that has run its course lapses on the rollover rather than
  // quietly becoming permanent.
  if (tenancy.concession && tenancy.concession.expiresOnDay <= today) {
    tenancy = { ...tenancy, concession: undefined }
    writeTenancy(ctx, tenancy, 'concession_expired')
  }

  tenancy = ensurePeriodObligation(ctx, tenancy)

  let notice: TenancyNotice | undefined
  if (!paid) {
    writeLandlord(
      ctx,
      (landlord) => ({
        ...landlord,
        opinion: Math.max(0, landlord.opinion - 12),
        concern: Math.min(100, landlord.concern + 25),
        lastContactDay: today,
      }),
      'rent_missed',
    )
    recordLandlordBelief(ctx, {
      id: 'rent_unpaid',
      readable: `Month ${tenancy.periodIndex} went unpaid (${carriedOver} coin).`,
      weight: -Math.min(60, carriedOver),
    })
    ctx.addMemory({
      id: 'rent_missed_recently',
      source: `${SOURCE}.rollover`,
      metadata: { amount: carriedOver, missedPayments: tenancy.missedPeriods },
    })
    // The attributed cause for the landlord's mood. Phase 17 §17.5 has always
    // required a missed month to explain itself against `pressure:landlord`,
    // and it still does — the record it is derived from just moved.
    ctx.addCause({
      source: `${SOURCE}.rollover`,
      sourceType: 'system',
      target: 'pressure:landlord',
      targetType: 'pressure',
      amount: 25,
      weight: 50,
      direction: 'increase',
      readable: `Rent went unpaid (${carriedOver} coin owed) — landlord pressure rising.`,
      tags: ['tenancy', 'rent', 'unpaid', 'landlord', 'pressure', 'risk'],
      relatedActors: [landlordRef()],
      relatedSystems: [TENANCY_MODULE_ID],
      expiresAfterDays: 28,
    })
    notice = issueOrEscalateNotice(
      ctx,
      `month ${tenancy.periodIndex} went unpaid`,
    )
  } else if (tenancy.arrearObligationIds.length === 0) {
    // A clean month with nothing behind it withdraws whatever the landlord
    // had hanging over the tavern.
    cureNotices(ctx, 'the rent is up to date')
    writeLandlord(
      ctx,
      (landlord) => ({
        ...landlord,
        opinion: Math.min(100, landlord.opinion + 6),
        concern: Math.max(0, landlord.concern - 20),
      }),
      'rent_current',
    )
  }

  syncTenancyStatus(ctx)
  return {
    paid,
    carriedOver,
    ...(notice ? { notice } : {}),
    readable: paid
      ? `Month ${tenancy.periodIndex} closed paid; next rent of ${effectiveRent(tenancy)} due day ${tenancy.periodEndsOnDay}.`
      : `Month ${tenancy.periodIndex} closed with ${carriedOver} unpaid; next rent of ${effectiveRent(tenancy)} due day ${tenancy.periodEndsOnDay}.`,
  }
}

// ---------- Notices ----------

/** Days a notice gives the tavern before it bites, by rung. */
const NOTICE_DEADLINE_DAYS: Record<TenancyNoticeKind, number> = {
  reminder: 7,
  formal_notice: 7,
  final_notice: 5,
  eviction_filed: 5,
  eviction_granted: 0,
}

function noticeCopy(
  kind: TenancyNoticeKind,
  cureAmount: number,
  deadlineDay: number,
): { readable: string; remedies: string[] } {
  // Every rung names its own way out. §7.2: "an eviction warning must
  // identify what can prevent or delay it" — so the routes live on the
  // record, in the domain that can actually honour them.
  const payIt = `Pay ${cureAmount} coin toward the rent before day ${deadlineDay}.`
  const talk = 'Negotiate with the landlord: a deferral, a reduction, or a payment plan.'
  const partial = 'A part payment delays the next step even if it does not clear the arrears.'
  switch (kind) {
    case 'reminder':
      return {
        readable: `${LANDLORD_LABEL} reminds you that ${cureAmount} coin of rent is outstanding.`,
        remedies: [payIt, talk],
      }
    case 'formal_notice':
      return {
        readable: `${LANDLORD_LABEL} has served a formal notice for ${cureAmount} coin of arrears, returnable day ${deadlineDay}.`,
        remedies: [payIt, talk, partial],
      }
    case 'final_notice':
      return {
        readable: `${LANDLORD_LABEL} has served a FINAL notice: ${cureAmount} coin by day ${deadlineDay} or proceedings begin.`,
        remedies: [payIt, talk, partial],
      }
    case 'eviction_filed':
      return {
        readable: `${LANDLORD_LABEL} has begun eviction proceedings. The hearing is day ${deadlineDay}.`,
        remedies: [
          `Clear the ${cureAmount} coin of arrears before the hearing and it is dismissed.`,
          'Agree a payment plan before the hearing and it is adjourned.',
          'Grant the landlord access and make the repairs they have asked for.',
        ],
      }
    case 'eviction_granted':
      return {
        readable: `${LANDLORD_LABEL} has been granted possession of the building.`,
        remedies: [
          `Pay ${cureAmount} coin in full to be reinstated before the landlord relets.`,
        ],
      }
  }
}

/**
 * Issue the next notice up the ladder, or the first one.
 *
 * One live notice at a time: escalating supersedes rather than stacking, so
 * "what is hanging over the tavern" always has one answer.
 */
export function issueOrEscalateNotice(
  ctx: SimContext,
  reason: string,
): TenancyNotice | undefined {
  const today = ctx.state.calendar.totalDaysElapsed
  const slice = getTenancyModuleState(ctx.state)
  const cureAmount = rentOutstanding(ctx.state)
  if (cureAmount <= 0) return undefined

  const live = liveNotice(slice)
  const nextKind: TenancyNoticeKind = live
    ? (NOTICE_LADDER[Math.min(noticeRung(live.kind) + 1, NOTICE_LADDER.length - 1)] ??
      'final_notice')
    : 'reminder'
  if (live && live.kind === nextKind) return live

  if (live) {
    upsertNotice(
      ctx,
      { ...live, status: 'escalated', resolvedOnDay: today },
      'notice_escalated',
    )
  }

  const deadlineDay = today + NOTICE_DEADLINE_DAYS[nextKind]
  const copy = noticeCopy(nextKind, cureAmount, deadlineDay)
  const notice: TenancyNotice = {
    id: nextNoticeId(ctx.state),
    kind: nextKind,
    issuedOnDay: today,
    deadlineDay,
    cureAmount,
    status: 'live',
    readable: copy.readable,
    remedies: copy.remedies,
    tags: ['tenancy', 'notice', nextKind],
  }
  upsertNotice(ctx, notice, 'notice_issued')

  ctx.addHistory({
    category: 'monthly',
    summary: `${copy.readable} (${reason})`,
    tags: ['tenancy', 'notice', nextKind],
    relatedActors: [landlordRef()],
    relatedSystems: [TENANCY_MODULE_ID],
  })
  ctx.addCause({
    source: `${SOURCE}.notice`,
    sourceType: 'system',
    target: 'pressure:landlord',
    targetType: 'pressure',
    amount: 10 + noticeRung(nextKind) * 8,
    direction: 'increase',
    weight: 40 + noticeRung(nextKind) * 10,
    readable: copy.readable,
    tags: ['tenancy', 'notice', nextKind, 'landlord'],
    relatedActors: [landlordRef()],
    expiresAfterDays: 28,
  })
  ctx.addMemory({
    id: 'landlord_notice_recently',
    source: `${SOURCE}.notice`,
    metadata: { kind: nextKind, cureAmount, deadlineDay },
  })
  syncTenancyStatus(ctx)
  return notice
}

/** Withdraw every live notice. Called when the rent position is cleared. */
export function cureNotices(ctx: SimContext, reason: string): number {
  const today = ctx.state.calendar.totalDaysElapsed
  const slice = getTenancyModuleState(ctx.state)
  const live = slice.notices.filter((notice) => notice.status === 'live')
  if (live.length === 0) return 0
  for (const notice of live) {
    upsertNotice(
      ctx,
      { ...notice, status: 'cured', resolvedOnDay: today },
      'notice_cured',
    )
  }
  bumpTenancyTotals(ctx, { noticesCured: live.length }, 'notice_cured')
  ctx.addHistory({
    category: 'monthly',
    summary: `${live.length} landlord notice(s) cured — ${reason}.`,
    tags: ['tenancy', 'notice', 'cured'],
    relatedActors: [landlordRef()],
    relatedSystems: [TENANCY_MODULE_ID],
  })
  syncTenancyStatus(ctx)
  return live.length
}

// ---------- Negotiation ----------

export type NegotiationKind = 'deferral' | 'reduction' | 'payment_plan'

export type NegotiationResult =
  | { ok: true; concession: TenancyConcession; readable: string }
  | { ok: false; code: string; reason: string }

/**
 * Ask the landlord for terms.
 *
 * Whether they agree depends on what they think of the tavern and what they
 * already hold against it — a landlord with a final notice out and a low
 * opinion says no, and says why. Bounded by `MAX_NEGOTIATIONS` so a
 * concession is a resource rather than an infinite escape hatch.
 */
export function negotiateTenancy(
  ctx: SimContext,
  kind: NegotiationKind,
): NegotiationResult {
  const today = ctx.state.calendar.totalDaysElapsed
  const tenancy = getTenancy(ctx.state)
  if (!tenancy) {
    return { ok: false, code: 'no_tenancy', reason: 'There is no tenancy to negotiate.' }
  }
  const landlord = getLandlord(ctx.state)
  if (landlord.negotiationsUsed >= MAX_NEGOTIATIONS) {
    return {
      ok: false,
      code: 'exhausted',
      reason: `${LANDLORD_LABEL} has already granted ${landlord.negotiationsUsed} concessions and will grant no more.`,
    }
  }
  if (tenancy.concession && tenancy.concession.expiresOnDay > today) {
    return {
      ok: false,
      code: 'already_conceded',
      reason: `${LANDLORD_LABEL} has already agreed to ${tenancy.concession.kind.replace('_', ' ')} until day ${tenancy.concession.expiresOnDay}.`,
    }
  }
  // The bar rises with the ask, and falls with the landlord's opinion of the
  // tavern. Paying rent is how a player lowers it.
  // Expansion Phase 8 §8.5 — "landlord interpretation where legitimate". The
  // landlord does not read the tavern's staff grudges or a supplier's private
  // opinion; what reaches them is what is being said ALOUD about their
  // tenant, and it makes them want more before they bend. Capped at 8 points
  // of the bar — the rent record is still what decides this, which is why the
  // refusal keeps naming it.
  const talk = publicBeliefAgainstHouse(ctx.state)
  const talkBump = Math.round(beliefEffect(talk, MAX_LANDLORD_BELIEF_BUMP))
  const baseBar = kind === 'deferral' ? 35 : kind === 'payment_plan' ? 45 : 60
  const bar = baseBar + talkBump
  if (landlord.opinion < bar) {
    return {
      ok: false,
      code: 'refused',
      reason:
        talkBump > 0
          ? `${LANDLORD_LABEL} thinks too little of you for that (opinion ${landlord.opinion}, needs ${bar} — ${talk!.readable}). Pay something toward the rent first.`
          : `${LANDLORD_LABEL} thinks too little of you for that (opinion ${landlord.opinion}, needs ${bar}). Pay something toward the rent first.`,
    }
  }

  const concession: TenancyConcession =
    kind === 'deferral'
      ? {
          kind,
          grantedOnDay: today,
          expiresOnDay: today + tenancy.periodDays,
          rentFactor: 1,
          deferralDays: 10,
          readable: `${LANDLORD_LABEL} will wait 10 extra days for the rent.`,
        }
      : kind === 'reduction'
        ? {
            kind,
            grantedOnDay: today,
            expiresOnDay: today + tenancy.periodDays * 2,
            rentFactor: 0.75,
            deferralDays: 0,
            readable: `${LANDLORD_LABEL} has cut the rent by a quarter for two months.`,
          }
        : {
            kind,
            grantedOnDay: today,
            expiresOnDay: today + tenancy.periodDays * 2,
            rentFactor: 1,
            deferralDays: 0,
            readable: `${LANDLORD_LABEL} has agreed a plan: pay the arrears down steadily and the proceedings hold.`,
          }

  let next: TavernTenancyRecord = { ...tenancy, concession, lastTransitionOnDay: today }
  if (concession.deferralDays > 0 && next.currentObligationId) {
    const record = getObligation(ctx.state, next.currentObligationId)
    if (record) {
      upsertObligation(
        ctx,
        {
          ...record,
          dueOnDay: (record.dueOnDay ?? today) + concession.deferralDays,
          readable: `${record.readable} (deferred)`,
        },
        'rent_deferred',
      )
    }
    next = {
      ...next,
      periodEndsOnDay: next.periodEndsOnDay + concession.deferralDays,
      dueOnDay: next.periodEndsOnDay + concession.deferralDays,
    }
  }
  writeTenancy(ctx, next, 'tenancy_negotiated')
  writeLandlord(
    ctx,
    (current) => ({
      ...current,
      negotiationsUsed: current.negotiationsUsed + 1,
      lastContactDay: today,
      // Asking costs a little goodwill even when granted. A concession is a
      // favour, and the landlord counts favours.
      opinion: Math.max(0, current.opinion - 4),
      concern: Math.max(0, current.concern - 15),
    }),
    'tenancy_negotiated',
  )
  bumpTenancyTotals(ctx, { concessionsGranted: 1 }, 'tenancy_negotiated')

  // A payment plan holds the proceedings: the live notice stops climbing
  // while the plan runs. That is the "cure, settlement" half of §7.2.
  if (kind === 'payment_plan') {
    const live = liveNotice(getTenancyModuleState(ctx.state))
    if (live && live.kind !== 'eviction_granted') {
      upsertNotice(
        ctx,
        {
          ...live,
          deadlineDay: today + tenancy.periodDays,
          readable: `${live.readable} Held by a payment plan until day ${today + tenancy.periodDays}.`,
        },
        'notice_held_by_plan',
      )
    }
  }

  ctx.addHistory({
    category: 'monthly',
    summary: concession.readable,
    tags: ['tenancy', 'negotiation', kind],
    relatedActors: [landlordRef()],
    relatedSystems: [TENANCY_MODULE_ID],
  })
  syncTenancyStatus(ctx)
  return { ok: true, concession, readable: concession.readable }
}

// ---------- Access and repairs ----------

export type AccessResult = { granted: boolean; readable: string }

/**
 * Answer the landlord's request to come and look at the building.
 *
 * Granting costs nothing and is remembered kindly; refusing keeps the
 * landlord out of a tavern that has something to hide, and is remembered
 * the other way. Both are real: the landlord's opinion is what the notice
 * ladder and every negotiation read.
 */
export function answerAccessRequest(
  ctx: SimContext,
  grant: boolean,
): AccessResult {
  const today = ctx.state.calendar.totalDaysElapsed
  writeLandlord(
    ctx,
    (landlord) => ({
      ...landlord,
      accessRequest: undefined,
      accessGrants: grant ? landlord.accessGrants + 1 : landlord.accessGrants,
      accessRefusals: grant ? landlord.accessRefusals : landlord.accessRefusals + 1,
      opinion: Math.max(0, Math.min(100, landlord.opinion + (grant ? 8 : -12))),
      concern: Math.max(0, Math.min(100, landlord.concern + (grant ? -8 : 12))),
      lastContactDay: today,
    }),
    grant ? 'access_granted' : 'access_refused',
  )
  recordLandlordBelief(ctx, {
    id: grant ? 'tenant_cooperative' : 'tenant_obstructive',
    readable: grant
      ? 'Let the landlord walk the building.'
      : 'Refused the landlord entry.',
    weight: grant ? 20 : -25,
  })
  const readable = grant
    ? `${LANDLORD_LABEL} walked the building and left satisfied enough.`
    : `${LANDLORD_LABEL} was turned away at the door.`
  ctx.addHistory({
    category: 'monthly',
    summary: readable,
    tags: ['tenancy', 'access', grant ? 'granted' : 'refused'],
    relatedActors: [landlordRef()],
    relatedSystems: [TENANCY_MODULE_ID],
  })
  syncTenancyStatus(ctx)
  return { granted: grant, readable }
}

/** The landlord asks to come and look. At most one request is live at a time. */
export function raiseAccessRequest(
  ctx: SimContext,
  reason: string,
  windowDays = 4,
): boolean {
  const today = ctx.state.calendar.totalDaysElapsed
  const landlord = getLandlord(ctx.state)
  if (landlord.accessRequest && landlord.accessRequest.deadlineDay >= today) {
    return false
  }
  writeLandlord(
    ctx,
    (current) => ({
      ...current,
      accessRequest: {
        raisedOnDay: today,
        deadlineDay: today + windowDays,
        reason,
      },
      lastContactDay: today,
    }),
    'access_requested',
  )
  ctx.addHistory({
    category: 'monthly',
    summary: `${LANDLORD_LABEL} asks to walk the building by day ${today + windowDays} (${reason}).`,
    tags: ['tenancy', 'access', 'requested'],
    relatedActors: [landlordRef()],
    relatedSystems: [TENANCY_MODULE_ID],
  })
  return true
}

// ---------- Eviction ----------

export type EvictionOutcome = {
  evicted: boolean
  readable: string
  reason: string
}

/**
 * Carry out the eviction the proceeding was about.
 *
 * Terminal, and deliberately so: the building is the tavern. It closes the
 * doors through the economy module's own `temporarily_closed` state rather
 * than inventing a parallel closure, so every consequence Phase 5 already
 * attached to being closed applies. Reinstatement stays reachable while the
 * landlord has not relet — that is the "cure, settlement, relocation, or
 * closure" §7.2 asks for, with the cure priced in coin.
 */
export function evictTavern(ctx: SimContext, reason: string): EvictionOutcome {
  const today = ctx.state.calendar.totalDaysElapsed
  const tenancy = getTenancy(ctx.state)
  if (!tenancy) {
    return { evicted: false, readable: 'There is no tenancy.', reason: 'no tenancy' }
  }
  const owed = rentOutstanding(ctx.state)

  const next: TavernTenancyRecord = {
    ...tenancy,
    tenancyStatus: 'evicted',
    status: 'defaulted',
    escalation: tenancy.escalation + 1,
    lastTransitionOnDay: today,
    history: [
      ...tenancy.history,
      {
        onDay: today,
        from: tenancy.status,
        to: 'defaulted' as const,
        reason,
        amount: owed,
      },
    ].slice(-24),
  }
  writeTenancy(ctx, next, 'evicted')
  bumpTenancyTotals(ctx, { evictionsGranted: 1 }, 'evicted')

  ctx.modifyModuleState<EconomyModuleState>(
    ECONOMY_MODULE_ID,
    (current) => {
      if (!current) return current as unknown as EconomyModuleState
      return {
        ...current,
        financial: {
          ...current.financial,
          status: 'temporarily_closed',
          statusSinceDay: today,
          lastTransitionReason: 'the landlord took possession of the building',
        },
      }
    },
    { source: `${SOURCE}.eviction`, reason: 'evicted' },
  )

  const readable = `${LANDLORD_LABEL} took possession of the building. The doors are shut.`
  ctx.addHistory({
    category: 'monthly',
    summary: `${readable} (${reason}; ${owed} coin outstanding)`,
    tags: ['tenancy', 'eviction', 'closure'],
    relatedActors: [landlordRef()],
    relatedSystems: [TENANCY_MODULE_ID, ECONOMY_MODULE_ID],
  })
  ctx.addMemory({
    id: 'evicted_recently',
    source: `${SOURCE}.eviction`,
    metadata: { owed },
  })
  return { evicted: true, readable, reason }
}

export type ReinstatementResult =
  | { ok: true; paid: number; readable: string }
  | { ok: false; code: string; reason: string }

/**
 * Buy the building back.
 *
 * Everything owed, plus a quarter again as the landlord's costs. The
 * tenancy resumes on its existing terms and the tavern can reopen through
 * the economy module's own reopening action — this does not reopen it for
 * the player, because that decision is theirs.
 */
export function reinstateTenancy(ctx: SimContext): ReinstatementResult {
  const tenancy = getTenancy(ctx.state)
  if (!tenancy) {
    return { ok: false, code: 'no_tenancy', reason: 'There is no tenancy.' }
  }
  if (tenancy.tenancyStatus !== 'evicted') {
    return {
      ok: false,
      code: 'not_evicted',
      reason: 'The tenancy has not been terminated.',
    }
  }
  const today = ctx.state.calendar.totalDaysElapsed
  const owed = rentOutstanding(ctx.state)
  const costs = Math.max(1, Math.round(owed * 0.25))
  const due = owed + costs
  if (ctx.state.coin < due) {
    return {
      ok: false,
      code: 'cannot_afford',
      reason: `Reinstatement costs ${due} coin (${owed} arrears plus ${costs} costs); the till holds ${ctx.state.coin}.`,
    }
  }

  const result = payRent(ctx, owed, 'reinstatement')
  spendCoin(ctx, costs, {
    source: `${SOURCE}.reinstatement`,
    category: 'rent',
    readable: `${LANDLORD_LABEL}'s costs on the eviction.`,
    tags: ['rent', 'tenancy', 'reinstatement'],
  })

  let next = getTenancy(ctx.state) ?? tenancy
  next = {
    ...next,
    tenancyStatus: 'current',
    status: 'active',
    lastTransitionOnDay: today,
    history: [
      ...next.history,
      {
        onDay: today,
        from: 'defaulted' as const,
        to: 'active' as const,
        reason: `reinstated for ${due}`,
        amount: due,
      },
    ].slice(-24),
  }
  writeTenancy(ctx, next, 'reinstated')
  ensurePeriodObligation(ctx, next)
  cureNotices(ctx, 'the tenancy was reinstated')
  writeLandlord(
    ctx,
    (landlord) => ({
      ...landlord,
      opinion: Math.min(100, landlord.opinion + 15),
      concern: 0,
      lastContactDay: today,
    }),
    'reinstated',
  )

  const readable = `Paid ${due} coin and got the keys back. ${result.readable}`
  ctx.addHistory({
    category: 'monthly',
    summary: readable,
    tags: ['tenancy', 'reinstatement'],
    relatedActors: [landlordRef()],
    relatedSystems: [TENANCY_MODULE_ID],
  })
  syncTenancyStatus(ctx)
  return { ok: true, paid: due, readable }
}

/** Write the balance off. Used by a restructuring, never by the tavern. */
export function forgiveRentArrears(ctx: SimContext, reason: string): number {
  const today = ctx.state.calendar.totalDaysElapsed
  const tenancy = getTenancy(ctx.state)
  if (!tenancy) return 0
  let forgiven = 0
  for (const id of tenancy.arrearObligationIds) {
    const record = getObligation(ctx.state, id)
    if (!record) continue
    forgiven += outstandingAmount(record)
    upsertObligation(ctx, forgiveObligation(record, today, reason), 'rent_forgiven')
  }
  if (forgiven <= 0) return 0
  writeTenancy(ctx, { ...tenancy, arrearObligationIds: [] }, 'rent_forgiven')
  cureNotices(ctx, reason)
  return forgiven
}

/** Discharge the current period without payment. Used by the reinstatement path. */
export function settleCurrentPeriod(ctx: SimContext, reason: string): void {
  const tenancy = getTenancy(ctx.state)
  if (!tenancy?.currentObligationId) return
  const record = getObligation(ctx.state, tenancy.currentObligationId)
  if (!record) return
  upsertObligation(
    ctx,
    settleObligation(record, ctx.state.calendar.totalDaysElapsed, reason),
    'rent_settled',
  )
}

// ---------- Status + projection ----------

/**
 * Recompute the tenancy's own status from the facts, and mirror the result
 * into `modules.monthly.rent`.
 *
 * The mirror is what keeps the pressure calculators, the `debt_rent` card
 * and the monthly report reading the field they always read without any of
 * them becoming a second source of truth: nothing writes `monthly.rent`
 * except this function, and this function only ever copies.
 */
export function syncTenancyStatus(ctx: SimContext): void {
  const tenancy = getTenancy(ctx.state)
  if (!tenancy) return
  const slice = getTenancyModuleState(ctx.state)
  const live = liveNotice(slice)
  const arrears = arrearsOutstanding(ctx.state)

  const status: TavernTenancyRecord['tenancyStatus'] =
    tenancy.tenancyStatus === 'evicted' || tenancy.tenancyStatus === 'terminated'
      ? tenancy.tenancyStatus
      : live?.kind === 'eviction_filed' || live?.kind === 'eviction_granted'
        ? 'eviction_proceeding'
        : live
          ? 'under_notice'
          : arrears > 0
            ? 'in_arrears'
            : 'current'

  if (status !== tenancy.tenancyStatus) {
    writeTenancy(ctx, { ...tenancy, tenancyStatus: status }, 'tenancy_status')
  }

  const currentOutstanding = tenancy.currentObligationId
    ? outstandingAmount(
        getObligation(ctx.state, tenancy.currentObligationId) ??
          ({ principal: 0, paid: 0, accruedCharges: 0, forgiven: 0 } as ObligationRecord),
      )
    : 0

  const projection: RentState = {
    monthlyAmount: tenancy.rentPerPeriod,
    paidThisMonth: currentOutstanding <= 0,
    missedPayments: tenancy.missedPeriods,
    arrears,
  }
  ctx.modifyModuleState<MonthlyModuleState>(
    MONTHLY_MODULE_ID,
    (current) => {
      if (!current) return current as unknown as MonthlyModuleState
      const same =
        current.rent.monthlyAmount === projection.monthlyAmount &&
        current.rent.paidThisMonth === projection.paidThisMonth &&
        current.rent.missedPayments === projection.missedPayments &&
        current.rent.arrears === projection.arrears
      return same ? current : { ...current, rent: projection }
    },
    { source: `${SOURCE}.projection`, reason: 'rent_projection' },
  )
}

/** The landlord's daily read of the building and the books. */
export function updateLandlordConcern(ctx: SimContext): void {
  const tenancy = getTenancy(ctx.state)
  if (!tenancy) return
  const today = ctx.state.calendar.totalDaysElapsed
  const arrears = rentPastGrace(ctx.state)

  // The landlord cares about two things: being paid, and the building not
  // falling down. Both are read off real state, not off a pressure meter.
  const areas = Object.values(ctx.state.areas)
  const worstCondition = areas.reduce(
    (worst, area) => Math.min(worst, area.condition),
    100,
  )
  if (worstCondition < 30) {
    recordLandlordBelief(ctx, {
      id: 'building_neglected',
      readable: `Part of the building is in a bad state (condition ${worstCondition}).`,
      weight: -Math.round((30 - worstCondition) * 1.5),
    })
  }
  if (arrears > 0) {
    recordLandlordBelief(ctx, {
      id: 'arrears_outstanding',
      readable: `${arrears} coin of rent outstanding.`,
      weight: -Math.min(80, arrears),
    })
  }

  const landlord = getLandlord(ctx.state)
  const beliefPull = landlord.beliefs.reduce(
    (sum, belief) => sum + belief.weight,
    0,
  )
  // Concern drifts toward what the beliefs justify rather than jumping, so a
  // single bad day never files an eviction and a single payment never
  // dissolves one.
  const target = Math.max(0, Math.min(100, 50 - beliefPull / 2))
  const drift = target > landlord.concern ? 2 : -3
  const nextConcern = Math.max(
    0,
    Math.min(100, landlord.concern + (Math.abs(target - landlord.concern) < 2 ? 0 : drift)),
  )
  if (nextConcern !== landlord.concern || landlord.lastContactDay === 0) {
    writeLandlord(
      ctx,
      (current) => ({
        ...current,
        concern: nextConcern,
        lastContactDay: current.lastContactDay || today,
      }),
      'landlord_concern',
    )
  }
}
