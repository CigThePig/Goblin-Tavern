import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'
import { registerScheduledEvent } from '../../contracts/scheduledEvents/registry'
import { scheduleEvent } from '../../contracts/scheduledEvents/state'
import type {
  ScheduledEventDefinition,
  ScheduledEventResolution,
} from '../../contracts/scheduledEvents/index'
import {
  getObligation,
  outstandingAmount,
} from '../../contracts/obligations/index'

import {
  lenderRef,
  loanForObligation,
  openInstalmentOf,
  recordMissedInstalment,
  runCollections,
  setInstalmentReviewScheduler,
} from './loans'
import { getLoan, listLoans } from './state'
import {
  FINANCE_MODULE_ID,
  loanOutstanding,
  type LoanRecord,
} from './types'

// Expansion Phase 7 §7.1 applied to the calendar.
//
// THE HOOK THIS CLOSES. `loan_due_soon` was the archetype of `OBL-02`: a
// response profile handed the player 40 coin, queued the string, and the
// responses module drained it days later into a memory. §7.1 requires it to
// "resolve against a real loan" and to be unschedulable "when no loan
// exists". Both halves are enforced here — `fromFutureHook` returns
// `undefined` when the tavern owes nobody, so the bridge keeps the hook as a
// narrative expectation rather than queueing a promise against nothing.
//
// Two events, and between them they are the whole delinquency ladder:
//
//   loan_instalment_review  the payment's grace window has closed. Either it
//                           was paid (an explained no-op) or the agreement
//                           takes a rung of damage and the schedule moves on.
//   loan_collections        a defaulted loan, and the lender acting on it —
//                           coin out of the till for a lender that seizes,
//                           a closed door for one that does not.
//
// Both mutate the agreement, the lender's standing, or the till. Neither
// resolves into a pressure nudge, which §5 lists as a fail condition.

export const LOAN_INSTALMENT_REVIEW_EVENT = 'loan_instalment_review'
export const LOAN_COLLECTIONS_EVENT = 'loan_collections'

const InstalmentReviewPayloadSchema = z.object({
  loanId: z.string(),
  instalmentIndex: z.number().int().min(0),
})

const CollectionsPayloadSchema = z.object({
  loanId: z.string(),
})

function noOp(reason: string, readable: string): ScheduledEventResolution {
  return { status: 'no_op', reason, readable }
}

/**
 * The soonest live loan payment, for the future-hook bridge.
 *
 * Returns `undefined` when nothing is owed — which is the whole point:
 * `loan_due_soon` on a debt-free tavern must not become a mechanical
 * promise, and declining is how a definition says so.
 */
function soonestOpenInstalment(
  state: TavernState,
): { loan: LoanRecord; instalmentIndex: number } | undefined {
  let best: { loan: LoanRecord; instalmentIndex: number; dueOnDay: number } | undefined
  for (const loan of listLoans(state)) {
    const instalment = openInstalmentOf(loan)
    if (!instalment) continue
    if (!best || instalment.dueOnDay < best.dueOnDay) {
      best = {
        loan,
        instalmentIndex: instalment.index,
        dueOnDay: instalment.dueOnDay,
      }
    }
  }
  return best ? { loan: best.loan, instalmentIndex: best.instalmentIndex } : undefined
}

const instalmentReviewDefinition: ScheduledEventDefinition = {
  type: LOAN_INSTALMENT_REVIEW_EVENT,
  kind: 'mechanical',
  ownerModuleId: FINANCE_MODULE_ID,
  label: 'A loan payment’s grace window closes',
  payloadSchema: InstalmentReviewPayloadSchema,
  // `wrap_up`: it must see today's payments before deciding the player
  // missed one. Firing in the morning would mark a payment missed that the
  // player then makes the same day, which is precisely the "target state
  // changed between warning and due event" case §7 asks to be tested.
  beat: 'wrap_up',
  defaultOffsetDays: 7,
  // Two days of visible warning. The player learns the payment is about to
  // bite while they still have a day's actions to find the coin.
  warningWindowDays: 2,
  expiryDays: 10,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, payload }) => {
    const parsed = InstalmentReviewPayloadSchema.safeParse(payload)
    return parsed.success
      ? `${type}|${parsed.data.loanId}|${parsed.data.instalmentIndex}`
      : `${type}|unknown`
  },
  // `loan_due_soon` is the ledger's `HOOK-loan_due_soon` family. The prefix
  // claim covers any parameterised variant a later generator might mint.
  futureHookPrefixes: ['loan_due_soon'],
  // The §7.1 requirement, enforced at the only place it can be: the hook
  // becomes a mechanical promise ONLY when a live loan payment exists for it
  // to be about. A tavern that owes nobody gets `undefined`, and the bridge
  // keeps the hook as a narrative expectation rather than queueing a
  // mechanical promise against nothing.
  fromFutureHook: ({ state }) => {
    if (!state) return undefined
    const found = soonestOpenInstalment(state)
    if (!found) return undefined
    return {
      payload: { loanId: found.loan.id, instalmentIndex: found.instalmentIndex },
      target: lenderRef(found.loan.lenderId),
    }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = InstalmentReviewPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload did not name a loan instalment', record.origin.readable)
    }
    const loan = getLoan(ctx.state, parsed.data.loanId)
    if (!loan) {
      return noOp(
        `loan '${parsed.data.loanId}' is no longer live`,
        record.origin.readable,
      )
    }
    const instalment = loan.instalments.find(
      (entry) => entry.index === parsed.data.instalmentIndex,
    )
    if (!instalment) {
      return noOp(
        `loan '${loan.id}' has no instalment ${parsed.data.instalmentIndex}`,
        record.origin.readable,
      )
    }
    if (instalment.status === 'paid') {
      return noOp(
        'the payment was made in time',
        `${loan.readable}: payment ${instalment.index + 1} was made in time.`,
      )
    }
    if (instalment.status !== 'open') {
      return noOp(
        `instalment ${instalment.index + 1} is ${instalment.status}, not awaiting payment`,
        `${loan.readable}: nothing outstanding on payment ${instalment.index + 1}.`,
      )
    }
    const obligation = instalment.obligationId
      ? getObligation(ctx.state, instalment.obligationId)
      : undefined
    if (!obligation) {
      return noOp(
        'the payment obligation has already been closed',
        `${loan.readable}: payment ${instalment.index + 1} is settled.`,
      )
    }
    const outstanding = outstandingAmount(obligation)
    if (outstanding <= 0) {
      return noOp(
        'the payment was made in time',
        `${loan.readable}: payment ${instalment.index + 1} was made in time.`,
      )
    }

    const before = loan.loanStatus
    const next = recordMissedInstalment(
      ctx,
      loan,
      obligation.id,
      `payment ${instalment.index + 1} unpaid after ${loan.graceDays} days of grace (${outstanding} outstanding)`,
    )

    // A default hands the loan to the lender's own collections behaviour.
    // Scheduling it HERE is what stops a defaulted loan going quiet: the
    // consequence is on the calendar the moment the default happens.
    if (next.loanStatus === 'defaulted') {
      scheduleEvent(ctx, {
        type: LOAN_COLLECTIONS_EVENT,
        target: lenderRef(next.lenderId),
        scheduledForDay: ctx.state.calendar.totalDaysElapsed + 3,
        payload: { loanId: next.id },
        origin: {
          source: `${FINANCE_MODULE_ID}.default`,
          readable: `${next.lenderLabel} is coming about ${next.readable}.`,
        },
      })
    }

    return {
      status: 'resolved',
      readable:
        `${loan.readable}: payment ${instalment.index + 1} went unpaid (${outstanding} outstanding). ` +
        `The loan is now ${next.loanStatus}.`,
      mutations: [
        {
          targetKind: 'loan',
          targetId: loan.id,
          field: 'loanStatus',
          readable: `${before} → ${next.loanStatus} after ${next.missedInstalments} missed payment(s).`,
        },
        {
          targetKind: 'lender',
          targetId: loan.lenderId,
          field: 'standing',
          readable: `${loan.lenderLabel} thinks less of you.`,
        },
      ],
      cause: {
        source: `${FINANCE_MODULE_ID}.missed_payment`,
        sourceType: 'system',
        target: `pressure:debt`,
        targetType: 'pressure',
        amount: outstanding,
        direction: 'increase',
        weight: Math.max(1, outstanding),
        readable: `${loan.readable}: a payment of ${outstanding} went unpaid.`,
        tags: ['loan', 'finance', 'missed', 'debt'],
        relatedActors: [loan.counterparty],
        expiresAfterDays: 21,
      },
      memory: {
        id: 'loan_payment_missed',
        source: `${FINANCE_MODULE_ID}.missed_payment`,
        metadata: { loanId: loan.id, amount: outstanding },
      },
      history: {
        category: 'system',
        summary: `${loan.readable}: payment ${instalment.index + 1} missed; loan is ${next.loanStatus}.`,
        tags: ['loan', 'finance', 'missed'],
        relatedActors: [loan.counterparty],
        relatedSystems: [FINANCE_MODULE_ID],
      },
      pressures: [
        {
          id: 'debt',
          change: Math.min(12, Math.max(3, Math.round(outstanding / 8))),
          cause: {
            source: `${FINANCE_MODULE_ID}.missed_payment`,
            sourceType: 'system',
            readable: `${loan.readable} fell behind.`,
            tags: ['loan', 'finance', 'debt'],
          },
        },
      ],
    }
  },
}

const collectionsDefinition: ScheduledEventDefinition = {
  type: LOAN_COLLECTIONS_EVENT,
  kind: 'mechanical',
  ownerModuleId: FINANCE_MODULE_ID,
  label: 'A lender collects on a defaulted loan',
  payloadSchema: CollectionsPayloadSchema,
  // `morning`: a seizure that empties the till has to be visible before the
  // player plans their day around coin that is no longer there.
  beat: 'morning',
  defaultOffsetDays: 3,
  warningWindowDays: 2,
  expiryDays: 6,
  // Four visits is the whole ladder. Bounded, so a debt the player never
  // pays cannot queue events forever (§5.11).
  repeat: { everyDays: 5, maxOccurrences: 4 },
  missingTarget: 'resolve_anyway',
  // Repeating, so the day IS part of the key: the second visit must not be
  // suppressed as a duplicate of the first.
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = CollectionsPayloadSchema.safeParse(payload)
    return `${type}|${parsed.success ? parsed.data.loanId : 'unknown'}|${scheduledForDay}`
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = CollectionsPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload did not name a loan', record.origin.readable)
    }
    const loan = getLoan(ctx.state, parsed.data.loanId)
    if (!loan) {
      return noOp(
        `loan '${parsed.data.loanId}' has been closed`,
        record.origin.readable,
      )
    }
    if (loan.loanStatus !== 'defaulted' && loan.loanStatus !== 'in_collections') {
      return noOp(
        `the loan is ${loan.loanStatus} again — payment stopped the collection`,
        `${loan.lenderLabel} called off the collection on ${loan.readable}.`,
      )
    }
    if (loanOutstanding(loan) <= 0) {
      return noOp(
        'the balance was cleared before the lender arrived',
        `${loan.readable} was cleared.`,
      )
    }

    const outcome = runCollections(ctx, loan)
    const mutations = [
      {
        targetKind: 'loan',
        targetId: loan.id,
        field: 'loanStatus',
        readable: `Escalated to collections (rung ${outcome.loan.escalation}).`,
      },
      ...(outcome.seized > 0
        ? [
            {
              targetKind: 'global',
              targetId: 'coin',
              field: 'coin',
              readable: `${loan.lenderLabel} took ${outcome.seized} coin.`,
            },
          ]
        : [
            {
              targetKind: 'lender',
              targetId: loan.lenderId,
              field: 'refusingUntilDay',
              readable: `${loan.lenderLabel} will not deal with you.`,
            },
          ]),
    ]

    return {
      status: 'resolved',
      readable: outcome.readable,
      mutations,
      // Re-arm while a balance remains. `maxOccurrences` bounds the ladder.
      ...(loanOutstanding(outcome.loan) > 0 ? { repeatInDays: 5 } : {}),
      cause: {
        source: `${FINANCE_MODULE_ID}.collections`,
        sourceType: 'system',
        target: 'coin',
        targetType: 'global',
        amount: -outcome.seized,
        direction: outcome.seized > 0 ? 'decrease' : 'neutral',
        weight: Math.max(1, outcome.seized),
        readable: outcome.readable,
        tags: ['loan', 'finance', 'collections'],
        relatedActors: [loan.counterparty],
        expiresAfterDays: 21,
      },
      history: {
        category: 'system',
        summary: outcome.readable,
        tags: ['loan', 'finance', 'collections'],
        relatedActors: [loan.counterparty],
        relatedSystems: [FINANCE_MODULE_ID],
      },
    }
  },
}

let registered = false

export function ensureFinanceEventsRegistered(): void {
  if (registered) return
  registerScheduledEvent(instalmentReviewDefinition)
  registerScheduledEvent(collectionsDefinition)
  setInstalmentReviewScheduler(scheduleInstalmentReview)
  registered = true
}

/**
 * Put an instalment's delinquency check on the calendar.
 *
 * Called from `openNextInstalment` so it is impossible to open a payment
 * without also scheduling the day it stops being optional — the same pairing
 * `scheduleObligationDueDate` enforces one level down.
 */
export function scheduleInstalmentReview(
  ctx: SimContext,
  loan: LoanRecord,
  instalmentIndex: number,
  dueOnDay: number,
): void {
  scheduleEvent(ctx, {
    type: LOAN_INSTALMENT_REVIEW_EVENT,
    target: loan.counterparty,
    scheduledForDay: dueOnDay + loan.graceDays + 1,
    payload: { loanId: loan.id, instalmentIndex },
    origin: {
      source: `${FINANCE_MODULE_ID}.instalment`,
      readable: `${loan.readable}: payment ${instalmentIndex + 1} due day ${dueOnDay}.`,
    },
  })
}

/**
 * Safety net for a review event that expired without firing.
 *
 * The review event is the primary mechanism, and it has ten days of expiry
 * to work with, so this normally does nothing. It exists because a loan
 * whose delinquency check went missing would go quiet forever, and "the
 * promise silently stopped happening" is the exact failure this arc exists
 * to make impossible. Idempotent: recording a miss flips the instalment out
 * of `open`, so a second pass finds nothing.
 */
export function reconcileOverdueInstalments(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  for (const loan of listLoans(ctx.state)) {
    const instalment = openInstalmentOf(loan)
    if (!instalment?.obligationId) continue
    // Only act well past the point the review event should have run.
    if (today <= instalment.dueOnDay + loan.graceDays + 1) continue
    const obligation = getObligation(ctx.state, instalment.obligationId)
    if (!obligation) continue
    if (outstandingAmount(obligation) <= 0) continue
    if (obligation.status !== 'defaulted' && obligation.status !== 'in_collections') {
      continue
    }
    recordMissedInstalment(
      ctx,
      loan,
      obligation.id,
      `payment ${instalment.index + 1} still unpaid on day ${today}`,
    )
  }
}

export { loanForObligation }
