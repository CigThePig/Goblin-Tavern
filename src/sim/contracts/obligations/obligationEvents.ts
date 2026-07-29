import { z } from 'zod'

import type { SimContext } from '../../core/context'

import { registerScheduledEvent } from '../scheduledEvents/registry'
import { scheduleEvent } from '../scheduledEvents/state'
import type {
  ScheduledEventDefinition,
  ScheduledEventRecord,
  ScheduledEventResolution,
} from '../scheduledEvents/types'

import {
  accrueLateCharge,
  defaultObligation,
  enterGrace,
  escalateToCollections,
  graceEndsOnDay,
  outstandingAmount,
} from './lifecycle'
import {
  OBLIGATIONS_MODULE_ID,
  getObligation,
  recordObligationCharges,
  upsertObligation,
} from './state'
import type { ObligationRecord } from './types'

// Expansion Phase 1 §1.1 + §1.2 — the two shared mechanical events every
// money obligation inherits.
//
// These are the FIRST registered mechanical event types, and they exist to
// prove the machinery end to end: each one is owned by a named module,
// validates its payload, resolves deterministically, and performs an
// authoritative mutation on a real record — not a zero-weight cause.
//
// `obligation_due`         the day the sum comes due. Either it is already
//                          settled (an explained no-op) or it enters grace
//                          and the grace deadline goes on the calendar.
// `obligation_grace_expiry` grace ran out. Late charges accrue, the record
//                          defaults, and repeats escalate it toward
//                          collections — bounded by `maxOccurrences`.
//
// Both mutate the obligation record itself. Neither touches a pressure or a
// reputation axis as its *only* consequence, which is one of §5's explicit
// fail conditions.

export const OBLIGATION_DUE_EVENT = 'obligation_due'
export const OBLIGATION_GRACE_EXPIRY_EVENT = 'obligation_grace_expiry'

const ObligationEventPayloadSchema = z.object({
  obligationId: z.string(),
})

type ObligationEventPayload = z.infer<typeof ObligationEventPayloadSchema>

function readPayload(record: ScheduledEventRecord): ObligationEventPayload | undefined {
  const parsed = ObligationEventPayloadSchema.safeParse(record.payload)
  return parsed.success ? parsed.data : undefined
}

/**
 * Resolve the record this event is about, or explain why we cannot.
 *
 * A missing obligation is a legitimate no-op, not an error: the owning
 * domain may have settled and archived it between scheduling and firing.
 * Both events declare `missingTarget: 'resolve_anyway'` so this path is
 * reached deliberately rather than by the queue silently cancelling.
 */
function loadObligation(
  ctx: SimContext,
  record: ScheduledEventRecord,
): { obligation: ObligationRecord } | { miss: ScheduledEventResolution } {
  const payload = readPayload(record)
  if (!payload) {
    return {
      miss: {
        status: 'no_op',
        reason: 'event payload did not name an obligation',
        readable: record.origin.readable,
      },
    }
  }
  const obligation = getObligation(ctx.state, payload.obligationId)
  if (!obligation) {
    return {
      miss: {
        status: 'no_op',
        reason: `obligation '${payload.obligationId}' is no longer open`,
        readable: record.origin.readable,
      },
    }
  }
  return { obligation }
}

const dueDefinition: ScheduledEventDefinition = {
  type: OBLIGATION_DUE_EVENT,
  kind: 'mechanical',
  ownerModuleId: OBLIGATIONS_MODULE_ID,
  label: 'An obligation comes due',
  payloadSchema: ObligationEventPayloadSchema,
  // `morning`: the player must learn a debt is due in the morning they
  // still have a day's worth of choices left to do something about it.
  beat: 'morning',
  defaultOffsetDays: 7,
  warningWindowDays: 2,
  expiryDays: 3,
  missingTarget: 'resolve_anyway',
  // One-shot per obligation, so the day is deliberately NOT part of the
  // key: re-scheduling the same obligation's due date must be recognised
  // as the same promise.
  exactOnceKey: ({ type, payload }) =>
    `${type}|${(payload as ObligationEventPayload | null)?.obligationId ?? 'unknown'}`,
  resolve: (ctx, record): ScheduledEventResolution => {
    const loaded = loadObligation(ctx, record)
    if ('miss' in loaded) return loaded.miss
    const obligation = loaded.obligation
    const today = ctx.state.calendar.totalDaysElapsed
    const outstanding = outstandingAmount(obligation)

    if (outstanding <= 0) {
      return {
        status: 'no_op',
        reason: 'already settled in full before it came due',
        readable: `${obligation.readable} was already settled.`,
      }
    }

    const graced = enterGrace(
      obligation,
      today,
      `came due with ${outstanding} outstanding`,
    )
    upsertObligation(ctx, graced, 'obligation_due')

    // Put the grace deadline on the calendar. This is the chain that makes
    // the obligation lifecycle self-driving: nothing has to remember to
    // check debts every day.
    const graceEnd = graceEndsOnDay(graced)
    scheduleEvent(ctx, {
      type: OBLIGATION_GRACE_EXPIRY_EVENT,
      target: obligation.counterparty,
      scheduledForDay: Math.max(today + 1, graceEnd),
      payload: { obligationId: obligation.id },
      origin: {
        source: `${OBLIGATIONS_MODULE_ID}.grace`,
        readable: `${obligation.readable} — ${graced.graceDays} days of grace.`,
      },
    })

    return {
      status: 'resolved',
      readable: `${obligation.readable} came due: ${outstanding} outstanding, ${graced.graceDays} days of grace.`,
      mutations: [
        {
          targetKind: 'obligation',
          targetId: obligation.id,
          field: 'status',
          readable: `Moved to grace with ${outstanding} outstanding.`,
        },
      ],
      cause: {
        source: `${OBLIGATIONS_MODULE_ID}.due`,
        sourceType: 'system',
        target: obligation.id,
        targetType: 'global',
        amount: outstanding,
        direction: 'neutral',
        weight: outstanding,
        readable: `${obligation.readable} came due.`,
        tags: ['obligation', 'due', obligation.direction, ...obligation.tags],
        relatedActors: [obligation.counterparty],
      },
      history: {
        category: 'system',
        summary: `${obligation.readable} came due with ${outstanding} outstanding.`,
        tags: ['obligation', 'due'],
        relatedActors: [obligation.counterparty],
        relatedSystems: [OBLIGATIONS_MODULE_ID],
      },
    }
  },
}

const graceExpiryDefinition: ScheduledEventDefinition = {
  type: OBLIGATION_GRACE_EXPIRY_EVENT,
  kind: 'mechanical',
  ownerModuleId: OBLIGATIONS_MODULE_ID,
  label: 'An obligation runs out of grace',
  payloadSchema: ObligationEventPayloadSchema,
  // `wrap_up`: it must see today's payments before deciding the player
  // defaulted. Firing this in the morning would default a debt the player
  // then settles the same day.
  beat: 'wrap_up',
  defaultOffsetDays: 3,
  warningWindowDays: 1,
  expiryDays: 3,
  // Each repeat is another overdue period: more charges, another rung up
  // the escalation ladder. Four firings is the whole ladder — bounded, so
  // an unpaid debt cannot queue events forever (§5.11).
  repeat: { everyDays: 3, maxOccurrences: 4 },
  missingTarget: 'resolve_anyway',
  // Repeating, so the day IS part of the key — otherwise the second
  // occurrence would be suppressed as a duplicate of the first.
  exactOnceKey: ({ type, payload, scheduledForDay }) =>
    `${type}|${(payload as ObligationEventPayload | null)?.obligationId ?? 'unknown'}|${scheduledForDay}`,
  resolve: (ctx, record): ScheduledEventResolution => {
    const loaded = loadObligation(ctx, record)
    if ('miss' in loaded) return loaded.miss
    const obligation = loaded.obligation
    const today = ctx.state.calendar.totalDaysElapsed
    const outstanding = outstandingAmount(obligation)

    if (outstanding <= 0) {
      return {
        status: 'no_op',
        reason: 'settled during the grace window',
        readable: `${obligation.readable} was settled in time.`,
      }
    }

    const charged = accrueLateCharge(obligation, today)
    const chargeAdded = charged.accruedCharges - obligation.accruedCharges

    // Escalation ladder. First expiry defaults the debt; later ones push it
    // into collections and keep the rung climbing, which is what gives
    // Phase 7's landlord and lenders something real to react to.
    const escalated =
      obligation.status === 'defaulted' || obligation.status === 'in_collections'
        ? escalateToCollections(
            charged,
            today,
            `still ${outstanding} outstanding after grace`,
          )
        : defaultObligation(
            charged,
            today,
            `grace expired with ${outstanding} outstanding`,
          )

    upsertObligation(ctx, escalated, 'obligation_grace_expiry')
    if (chargeAdded > 0) {
      recordObligationCharges(ctx, chargeAdded, 'late_charge')
    }

    return {
      status: 'resolved',
      readable:
        `${obligation.readable} is overdue: ${outstandingAmount(escalated)} outstanding` +
        (chargeAdded > 0 ? `, +${chargeAdded} in charges` : '') +
        ` (escalation ${escalated.escalation}).`,
      mutations: [
        {
          targetKind: 'obligation',
          targetId: obligation.id,
          field: 'status',
          readable: `Now ${escalated.status} at escalation ${escalated.escalation}.`,
        },
        ...(chargeAdded > 0
          ? [
              {
                targetKind: 'obligation',
                targetId: obligation.id,
                field: 'accruedCharges',
                readable: `Late charges rose by ${chargeAdded}.`,
              },
            ]
          : []),
      ],
      cause: {
        source: `${OBLIGATIONS_MODULE_ID}.overdue`,
        sourceType: 'system',
        target: obligation.id,
        targetType: 'global',
        amount: chargeAdded,
        direction: 'increase',
        weight: Math.max(1, chargeAdded),
        readable: `${obligation.readable} went unpaid past its grace period.`,
        tags: [
          'obligation',
          'overdue',
          escalated.status,
          obligation.direction,
          ...obligation.tags,
        ],
        relatedActors: [obligation.counterparty],
      },
      history: {
        category: 'system',
        summary: `${obligation.readable} is ${escalated.status} (escalation ${escalated.escalation}).`,
        tags: ['obligation', 'overdue'],
        relatedActors: [obligation.counterparty],
        relatedSystems: [OBLIGATIONS_MODULE_ID],
      },
    }
  },
}

let registered = false

/**
 * Register the shared obligation events. Idempotent, and called from the
 * obligations module's import so any pipeline that includes the module has
 * the event types available before the first day runs.
 */
export function ensureObligationEventsRegistered(): void {
  if (registered) return
  registerScheduledEvent(dueDefinition)
  registerScheduledEvent(graceExpiryDefinition)
  registered = true
}

/**
 * Open a money obligation AND put its due date on the calendar.
 *
 * This pairing is the point of §1.2: a domain cannot create an obligation
 * that nothing will ever come to collect, because creating one schedules
 * the event that collects it. Returns the scheduled-event result so the
 * caller can see whether the due date was already on the calendar.
 */
export function scheduleObligationDueDate(
  ctx: SimContext,
  obligation: ObligationRecord,
): ReturnType<typeof scheduleEvent> {
  return scheduleEvent(ctx, {
    type: OBLIGATION_DUE_EVENT,
    target: obligation.counterparty,
    scheduledForDay: obligation.dueOnDay ?? obligation.openedOnDay,
    payload: { obligationId: obligation.id },
    origin: {
      source: `${obligation.ownerModuleId}.obligation`,
      readable: obligation.readable,
    },
  })
}
