import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'

import {
  overdueSupplierInvoices,
  outstandingSupplierInvoices,
} from './invoices'
import { creditEligibility, creditLimitFor, netTermsFor } from './quote'
import {
  SUPPLIERS_MODULE_ID,
  getSupplierAccount,
  writeSupplierAccount,
} from './state'
import type { SupplierCreditStatus } from './types'

// Expansion Phase 6 §6.3 — credit as an operating decision.
//
// `debtTolerance` used to be a display number on the world screen with no
// invoice behind it. It is now the size of the rope a supplier will extend,
// and the four states below are what the player is actually managing:
//
//   none       cash or deposit only. The starting position for everyone.
//   approved   invoices allowed up to the limit, on the account's terms.
//   suspended  frozen by an overdue invoice. Paying it thaws the line.
//   revoked    withdrawn after a default. Costs relationship to win back.
//
// TRANSITIONS ARE RECOMPUTED, NOT REMEMBERED. `reviewSupplierCredit` reads
// the live obligation ledger every day and derives the status from it. That
// is deliberate: the alternative is a per-invoice "have I already reacted to
// this escalation?" bookkeeping map that would need its own exact-once key,
// its own pruning rule, and its own way of being wrong after a reload. A
// derivation cannot double-fire and cannot drift from the ledger it reads.
//
// The escalation itself still belongs to the shared obligation machinery:
// `obligation_due` and `obligation_grace_expiry` move an unpaid invoice into
// grace, default and collections. This file reads that verdict and decides
// what the SUPPLIER does about it.

/** Days a suspension holds before the supplier will discuss credit again. */
const SUSPENSION_REVIEW_DAYS = 5
/** Days a revoked line stays shut after a default. */
const REVOCATION_REVIEW_DAYS = 14
/** Days a supplier refuses new orders once a debt reaches collections. */
const COLLECTIONS_REFUSAL_DAYS = 7

export type CreditDecision = {
  supplierId: string
  before: SupplierCreditStatus
  after: SupplierCreditStatus
  limit: number
  netTermDays: number
  reason: string
  /** True when the supplier also stopped taking orders. */
  supplyStopped: boolean
}

export type CreditRequestResult =
  | { ok: true; decision: CreditDecision }
  | { ok: false; code: string; reason: string }

/**
 * Ask a supplier to open a line.
 *
 * A refusal is as informative as an approval — the reason names the exact
 * thing that would change the answer, which is what "a player can discover
 * what action is available and why" (§5) asks for.
 */
export function requestSupplierCredit(
  ctx: SimContext,
  supplierId: string,
): CreditRequestResult {
  const supplier = ctx.state.world.suppliers[supplierId]
  if (!supplier) {
    return { ok: false, code: 'unknown_supplier', reason: `No supplier '${supplierId}'` }
  }
  const eligibility = creditEligibility(ctx.state, supplierId)
  const account = getSupplierAccount(ctx.state, supplierId)
  const today = ctx.state.calendar.totalDaysElapsed

  if (!eligibility.eligible) {
    // A refused request is remembered: asking again the next morning is not
    // a way to reroll the answer.
    writeSupplierAccount(
      ctx,
      supplierId,
      (current) => ({
        ...current,
        reviewOnDay: Math.max(current.reviewOnDay ?? 0, today + 3),
        lastDecisionDay: today,
        lastDecisionReason: eligibility.reason,
      }),
      'credit_refused',
    )
    ctx.addCause({
      source: `${SUPPLIERS_MODULE_ID}.credit_refused`,
      sourceType: 'supplier',
      target: supplierId,
      targetType: 'supplier',
      amount: 0,
      direction: 'neutral',
      readable: `${supplier.label} refused a credit line: ${eligibility.reason}.`,
      tags: ['supplier', 'credit', 'refused', supplierId],
      relatedSystems: [SUPPLIERS_MODULE_ID],
    })
    return { ok: false, code: 'credit_refused', reason: eligibility.reason }
  }

  const decision: CreditDecision = {
    supplierId,
    before: account.creditStatus,
    after: 'approved',
    limit: eligibility.limit,
    netTermDays: eligibility.netTermDays,
    reason: eligibility.reason,
    supplyStopped: false,
  }
  writeSupplierAccount(
    ctx,
    supplierId,
    (current) => {
      const { reviewOnDay: _dropped, ...rest } = current
      return {
        ...rest,
        creditStatus: 'approved',
        creditLimit: eligibility.limit,
        netTermDays: eligibility.netTermDays,
        lastDecisionDay: today,
        lastDecisionReason: eligibility.reason,
      }
    },
    'credit_approved',
  )
  ctx.addCause({
    source: `${SUPPLIERS_MODULE_ID}.credit_approved`,
    sourceType: 'supplier',
    target: supplierId,
    targetType: 'supplier',
    amount: eligibility.limit,
    direction: 'increase',
    weight: eligibility.limit,
    readable: `${supplier.label} opened a ${eligibility.limit}-coin line on ${eligibility.netTermDays}-day terms.`,
    tags: ['supplier', 'credit', 'approved', supplierId],
    relatedSystems: [SUPPLIERS_MODULE_ID, 'economy'],
  })
  ctx.addHistory({
    category: 'state_change',
    summary: `${supplier.label} extended ${eligibility.limit} coin of credit on ${eligibility.netTermDays}-day terms.`,
    tags: ['supplier', 'credit'],
    relatedActors: [{ kind: 'supplier', id: supplierId }],
    relatedSystems: [SUPPLIERS_MODULE_ID],
  })
  return { ok: true, decision }
}

/**
 * Recompute one supplier's credit standing from the live ledger.
 *
 * Idempotent by construction: run it twice on the same state and the second
 * run finds nothing to change. It returns a decision only when the status
 * actually moved, so callers can report a change without inventing one.
 */
export function reviewSupplierCredit(
  ctx: SimContext,
  supplierId: string,
): CreditDecision | undefined {
  const supplier = ctx.state.world.suppliers[supplierId]
  if (!supplier) return undefined
  const account = getSupplierAccount(ctx.state, supplierId)
  const today = ctx.state.calendar.totalDaysElapsed
  const overdue = overdueSupplierInvoices(ctx.state, supplierId)
  const defaulted = overdue.filter(
    (invoice) => invoice.status === 'defaulted' || invoice.status === 'in_collections',
  )
  const inCollections = overdue.filter(
    (invoice) => invoice.status === 'in_collections',
  )

  let next: SupplierCreditStatus = account.creditStatus
  let reason = account.lastDecisionReason
  let reviewOnDay = account.reviewOnDay
  let refusingUntilDay = account.refusingUntilDay
  let refusingReason = account.refusingReason

  if (defaulted.length > 0) {
    next = 'revoked'
    reason = `${defaulted.length} defaulted invoice${defaulted.length === 1 ? '' : 's'}`
    reviewOnDay = Math.max(reviewOnDay ?? 0, today + REVOCATION_REVIEW_DAYS)
  } else if (overdue.length > 0) {
    if (account.creditStatus === 'approved' || account.creditStatus === 'suspended') {
      next = 'suspended'
      reason = `${overdue.length} invoice${overdue.length === 1 ? '' : 's'} past due`
      reviewOnDay = Math.max(reviewOnDay ?? 0, today + SUSPENSION_REVIEW_DAYS)
    }
  } else if (
    account.creditStatus === 'suspended' &&
    !(
      account.refusingReason === 'retaliation' &&
      account.refusingUntilDay !== undefined &&
      today < account.refusingUntilDay
    ) &&
    outstandingSupplierInvoices(ctx.state, supplierId).every(
      (invoice) => invoice.status === 'active' || invoice.status === 'pending',
    )
  ) {
    // Nothing overdue any more: the line thaws on its own, because the thing
    // that froze it was the arrears rather than a decision to punish.
    next = 'approved'
    reason =
      account.refusingReason === 'retaliation'
        ? 'the retaliation ended; the line is live again'
        : 'arrears cleared; the line is live again'
    reviewOnDay = undefined
  }

  if (inCollections.length > 0) {
    refusingUntilDay = Math.max(
      refusingUntilDay ?? 0,
      today + COLLECTIONS_REFUSAL_DAYS,
    )
    refusingReason = 'collections'
  } else if (
    overdue.length === 0 &&
    refusingReason === 'collections' &&
    refusingUntilDay !== undefined &&
    refusingUntilDay > today
  ) {
    // Paying up gets the tavern served again. A supply suspension is
    // leverage to collect a debt, not a punishment that outlives it — and
    // without this the refusal would sit out its full window after the
    // player had already done the one thing that ends it.
    refusingUntilDay = undefined
    refusingReason = undefined
    reason = 'arrears cleared; the supplier is trading again'
  }

  // Expired refusal metadata should not keep a retaliation suspension alive
  // forever or leave the report implying the supplier is still refusing.
  if (refusingUntilDay !== undefined && refusingUntilDay <= today) {
    refusingUntilDay = undefined
    refusingReason = undefined
  }

  const limit =
    next === 'approved'
      ? account.creditLimit > 0
        ? account.creditLimit
        : creditEligibility(ctx.state, supplierId).limit
      : 0
  const netTermDays = netTermsFor(supplier, account)

  const statusChanged = next !== account.creditStatus
  const refusalChanged =
    refusingUntilDay !== account.refusingUntilDay ||
    refusingReason !== account.refusingReason
  const limitChanged = limit !== account.creditLimit
  const reviewChanged = reviewOnDay !== account.reviewOnDay
  if (!statusChanged && !refusalChanged && !limitChanged && !reviewChanged) {
    return undefined
  }

  writeSupplierAccount(
    ctx,
    supplierId,
    (current) => {
      // Drop the keys explicitly rather than spreading `undefined` over
      // them: `exactOptionalPropertyTypes` aside, a persisted `undefined`
      // is not JSON-serializable state.
      const {
        reviewOnDay: _priorReview,
        refusingUntilDay: _priorRefusal,
        refusingReason: _priorRefusalReason,
        ...rest
      } = current
      return {
      ...rest,
      creditStatus: next,
      creditLimit: limit,
      netTermDays,
      ...(reviewOnDay !== undefined ? { reviewOnDay } : {}),
      ...(refusingUntilDay !== undefined ? { refusingUntilDay } : {}),
      ...(refusingReason !== undefined ? { refusingReason } : {}),
      history: {
        ...current.history,
        defaults:
          statusChanged && next === 'revoked'
            ? current.history.defaults + 1
            : current.history.defaults,
      },
      lastDecisionDay: today,
      lastDecisionReason: reason,
      }
    },
    'credit_review',
  )

  if (statusChanged) {
    ctx.addCause({
      source: `${SUPPLIERS_MODULE_ID}.credit_${next}`,
      sourceType: 'supplier',
      target: supplierId,
      targetType: 'supplier',
      amount: limit,
      direction: next === 'approved' ? 'increase' : 'decrease',
      weight: Math.max(1, account.creditLimit),
      readable: `${supplier.label} moved the tavern's credit to ${next}: ${reason}.`,
      tags: ['supplier', 'credit', next, supplierId],
      relatedSystems: [SUPPLIERS_MODULE_ID, 'economy'],
    })
  }
  if (statusChanged && next === 'revoked') {
    // A revoked line is a relationship event, not just a paperwork one.
    ctx.modifySupplier(
      supplierId,
      { relationship: Math.max(0, supplier.relationship - 4) },
      { source: SUPPLIERS_MODULE_ID, reason: 'credit_revoked' },
    )
    ctx.addHistory({
      category: 'state_change',
      summary: `${supplier.label} withdrew the tavern's credit after ${reason}.`,
      tags: ['supplier', 'credit', 'default'],
      relatedActors: [{ kind: 'supplier', id: supplierId }],
      relatedSystems: [SUPPLIERS_MODULE_ID],
    })
  }

  return {
    supplierId,
    before: account.creditStatus,
    after: next,
    limit,
    netTermDays,
    reason,
    supplyStopped: refusingUntilDay !== undefined && refusingUntilDay > today,
  }
}

/** Recompute every supplier's standing. Called once a day. */
export function reviewAllSupplierCredit(ctx: SimContext): CreditDecision[] {
  const decisions: CreditDecision[] = []
  for (const supplierId of Object.keys(ctx.state.world.suppliers).sort()) {
    const decision = reviewSupplierCredit(ctx, supplierId)
    if (decision) decisions.push(decision)
  }
  return decisions
}

export type NegotiationResult =
  | {
      ok: true
      /** Multiplicative price adjustment now in force. */
      termsAdjustment: number
      untilDay: number
      creditLimit: number
      readable: string
    }
  | { ok: false; code: string; reason: string }

/** Days a negotiated concession lasts before terms revert. */
export const NEGOTIATION_TERM_DAYS = 14

/**
 * Negotiate better terms.
 *
 * §6.4 "relationship negotiation". The lever is the relationship and the
 * trading record the player has actually built — a stranger cannot talk
 * their way to a discount, and a supplier the tavern has shorted twice
 * hears the request as cheek. A failed negotiation costs relationship,
 * which is what stops it being a free reroll every morning.
 */
export function negotiateSupplierTerms(
  ctx: SimContext,
  supplierId: string,
): NegotiationResult {
  const supplier = ctx.state.world.suppliers[supplierId]
  if (!supplier) {
    return { ok: false, code: 'unknown_supplier', reason: `No supplier '${supplierId}'` }
  }
  const account = getSupplierAccount(ctx.state, supplierId)
  const today = ctx.state.calendar.totalDaysElapsed

  if (
    account.termsAdjustmentUntilDay !== undefined &&
    today < account.termsAdjustmentUntilDay
  ) {
    return {
      ok: false,
      code: 'terms_already_set',
      reason: `Terms with ${supplier.label} are already settled until day ${account.termsAdjustmentUntilDay}.`,
    }
  }
  if (overdueSupplierInvoices(ctx.state, supplierId).length > 0) {
    return {
      ok: false,
      code: 'arrears_outstanding',
      reason: `${supplier.label} will not discuss terms while an invoice is past due.`,
    }
  }

  // Standing is earned, not rolled: relationship, completed deliveries and
  // on-time payments against the misses and the disputes.
  const standing =
    (supplier.relationship - 50) / 50 +
    Math.min(1, account.history.ordersDelivered * 0.2) +
    Math.min(1, account.history.onTimePayments * 0.25) -
    Math.min(1, account.history.latePayments * 0.3) -
    Math.min(1, account.history.disputes * 0.2)

  if (standing <= 0) {
    ctx.modifySupplier(
      supplierId,
      { relationship: Math.max(0, supplier.relationship - 2) },
      { source: SUPPLIERS_MODULE_ID, reason: 'negotiation_rebuffed' },
    )
    writeSupplierAccount(
      ctx,
      supplierId,
      (current) => ({
        ...current,
        lastDecisionDay: today,
        lastDecisionReason: 'a request for better terms was rebuffed',
      }),
      'negotiation_rebuffed',
    )
    return {
      ok: false,
      code: 'rebuffed',
      reason: `${supplier.label} has no reason to give the tavern anything yet.`,
    }
  }

  // Up to 12% off, and a credit limit that grows with the same standing.
  //
  // The floor matters: without it a thin-but-positive standing produced a
  // discount that rounded away to nothing while the action still reported
  // "agreed". An agreement that changes no number is the empty promise this
  // whole arc exists to remove — either the supplier moves or they rebuff
  // the request, and both are said plainly.
  const discount = Math.max(0.02, Math.min(0.12, standing * 0.06))
  const termsAdjustment = Math.round((1 - discount) * 100) / 100
  const untilDay = today + NEGOTIATION_TERM_DAYS
  const baseCreditLimit = creditLimitFor(ctx.state, supplier, account)
  const creditLimit =
    account.creditStatus === 'approved'
      ? Math.round(baseCreditLimit * (1 + Math.min(0.4, standing * 0.2)))
      : account.creditLimit

  writeSupplierAccount(
    ctx,
    supplierId,
    (current) => ({
      ...current,
      termsAdjustment,
      termsAdjustmentUntilDay: untilDay,
      creditLimit,
      lastDecisionDay: today,
      lastDecisionReason: `negotiated ${Math.round(discount * 100)}% off until day ${untilDay}`,
    }),
    'negotiated_terms',
  )
  ctx.modifySupplier(
    supplierId,
    { relationship: Math.min(100, supplier.relationship + 1) },
    { source: SUPPLIERS_MODULE_ID, reason: 'negotiation_settled' },
  )
  ctx.addCause({
    source: `${SUPPLIERS_MODULE_ID}.negotiated_terms`,
    sourceType: 'owner_action',
    target: supplierId,
    targetType: 'supplier',
    amount: Math.round(discount * 100),
    direction: 'decrease',
    weight: Math.max(1, Math.round(discount * 100)),
    readable: `${supplier.label} agreed to ${Math.round(discount * 100)}% off until day ${untilDay}.`,
    tags: ['supplier', 'negotiation', supplierId],
    relatedSystems: [SUPPLIERS_MODULE_ID],
  })

  return {
    ok: true,
    termsAdjustment,
    untilDay,
    creditLimit,
    readable: `${supplier.label}: ${Math.round(discount * 100)}% off through day ${untilDay}`,
  }
}

/** Has a negotiated concession run out? Called daily so terms actually revert. */
export function expireNegotiatedTerms(ctx: SimContext): string[] {
  const today = ctx.state.calendar.totalDaysElapsed
  const expired: string[] = []
  for (const supplierId of Object.keys(ctx.state.world.suppliers).sort()) {
    const account = getSupplierAccount(ctx.state, supplierId)
    if (
      account.termsAdjustmentUntilDay === undefined ||
      today < account.termsAdjustmentUntilDay
    ) {
      continue
    }
    writeSupplierAccount(
      ctx,
      supplierId,
      (current) => {
        const { termsAdjustmentUntilDay: _dropped, ...rest } = current
        return {
          ...rest,
          termsAdjustment: 1,
          lastDecisionDay: today,
          lastDecisionReason: 'negotiated terms lapsed',
        }
      },
      'terms_lapsed',
    )
    expired.push(supplierId)
  }
  return expired
}

/** Is this supplier taking new orders today? */
export function isRefusingOrders(state: TavernState, supplierId: string): boolean {
  const account = getSupplierAccount(state, supplierId)
  return (
    account.refusingUntilDay !== undefined &&
    state.calendar.totalDaysElapsed < account.refusingUntilDay
  )
}
