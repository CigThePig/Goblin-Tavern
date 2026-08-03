import { z } from 'zod'

import type { SimContext } from '../../core/context'
import { registerScheduledEvent } from '../../contracts/scheduledEvents/registry'
import { scheduleEvent } from '../../contracts/scheduledEvents/state'
import type {
  ScheduledEventDefinition,
  ScheduledEventResolution,
} from '../../contracts/scheduledEvents/index'

import {
  advanceRentPeriod,
  answerAccessRequest,
  arrearsOutstanding,
  cureNotices,
  effectiveRent,
  ensureTenancy,
  evictTavern,
  issueOrEscalateNotice,
  negotiateTenancy,
  raiseAccessRequest,
  rentOutstanding,
  syncTenancyStatus,
} from './tenancy'
import {
  getLandlord,
  getTenancy,
  getTenancyModuleState,
  landlordRef,
  upsertNotice,
  writeLandlord,
  writeTenancy,
  bumpTenancyTotals,
} from './state'
import {
  LANDLORD_LABEL,
  TENANCY_MODULE_ID,
  liveNotice,
} from './types'

// Expansion Phase 7 §7.2 applied to the calendar.
//
// THE HOOKS THIS CLOSES. `eviction_threat_possible` and
// `landlord_goodwill_window` were both strings a response could queue that
// drained into a memory — the eviction half of `OBL-02`. Both now resolve
// through a domain that can actually deliver: a threat becomes a notice
// against real arrears with a real deadline and a real cure amount, and
// goodwill becomes a concession on the tenancy record.
//
// Five events, and between them the whole ladder is self-driving:
//
//   rent_period_rollover      the month closes. Paid, or carried over into
//                             an arrear that keeps its own history.
//   tenancy_escalation_review a notice's deadline. Re-evaluates the CURRENT
//                             position — a player who paid in between is not
//                             escalated for a debt they no longer owe.
//   eviction_hearing          the proceeding. Dismissed, adjourned, or
//                             granted, decided on the day against the day's
//                             facts.
//   landlord_goodwill         a concession the landlord actually grants.
//   landlord_access_request   the landlord asks to walk the building.

export const RENT_PERIOD_ROLLOVER_EVENT = 'rent_period_rollover'
export const TENANCY_ESCALATION_EVENT = 'tenancy_escalation_review'
export const EVICTION_HEARING_EVENT = 'eviction_hearing'
export const LANDLORD_GOODWILL_EVENT = 'landlord_goodwill'
export const LANDLORD_ACCESS_EVENT = 'landlord_access_request'

const PeriodPayloadSchema = z.object({ periodIndex: z.number().int().min(0) })
const NoticePayloadSchema = z.object({ noticeId: z.string() })
const EmptyPayloadSchema = z.object({}).passthrough()

function noOp(reason: string, readable: string): ScheduledEventResolution {
  return { status: 'no_op', reason, readable }
}

// ---------- rent_period_rollover ----------

const rolloverDefinition: ScheduledEventDefinition = {
  type: RENT_PERIOD_ROLLOVER_EVENT,
  kind: 'mechanical',
  ownerModuleId: TENANCY_MODULE_ID,
  label: 'A rent period closes',
  payloadSchema: PeriodPayloadSchema,
  // `morning`, and scheduled for the day AFTER the period ends: the month-end
  // sweep runs in `endMonth`, at the very end of the closing day, so a
  // rollover on the same day would judge the month unpaid before the sweep
  // had a chance to pay it.
  beat: 'morning',
  defaultOffsetDays: 28,
  warningWindowDays: 3,
  expiryDays: 5,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, payload }) => {
    const parsed = PeriodPayloadSchema.safeParse(payload)
    return `${type}|${parsed.success ? parsed.data.periodIndex : 'unknown'}`
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = PeriodPayloadSchema.safeParse(record.payload)
    const tenancy = getTenancy(ctx.state)
    if (!tenancy) {
      return noOp('there is no tenancy', record.origin.readable)
    }
    if (tenancy.tenancyStatus === 'evicted' || tenancy.tenancyStatus === 'terminated') {
      return noOp('the tenancy has ended', `${LANDLORD_LABEL} has the building.`)
    }
    if (parsed.success && parsed.data.periodIndex !== tenancy.periodIndex) {
      return noOp(
        `period ${parsed.data.periodIndex} has already rolled over`,
        record.origin.readable,
      )
    }

    const outcome = advanceRentPeriod(ctx)
    const next = getTenancy(ctx.state)
    if (next) scheduleRentRollover(ctx, next.periodIndex, next.periodEndsOnDay)
    // A notice issued by the rollover gets its own deadline on the calendar
    // in the same breath. Without this the first rung of the ladder would be
    // the only one that ever fired.
    if (outcome.notice && outcome.notice.kind !== 'eviction_granted') {
      scheduleNoticeDeadline(ctx, outcome.notice.id, outcome.notice.deadlineDay)
    }

    return {
      status: 'resolved',
      readable: outcome.readable,
      mutations: [
        {
          targetKind: 'tenancy',
          targetId: tenancy.id,
          field: 'periodIndex',
          readable: outcome.paid
            ? `Month ${tenancy.periodIndex + 1} closed paid.`
            : `Month ${tenancy.periodIndex + 1} closed with ${outcome.carriedOver} carried into arrears.`,
        },
        ...(outcome.notice
          ? [
              {
                targetKind: 'tenancy_notice',
                targetId: outcome.notice.id,
                field: 'kind',
                readable: outcome.notice.readable,
              },
            ]
          : []),
      ],
      history: {
        category: 'monthly',
        summary: outcome.readable,
        tags: ['tenancy', 'rent', outcome.paid ? 'paid' : 'unpaid'],
        relatedActors: [landlordRef()],
        relatedSystems: [TENANCY_MODULE_ID],
      },
      ...(outcome.paid
        ? {}
        : {
            pressures: [
              {
                id: 'landlord',
                change: Math.min(20, Math.max(5, Math.round(outcome.carriedOver / 8))),
                cause: {
                  source: `${TENANCY_MODULE_ID}.rollover`,
                  sourceType: 'system',
                  readable: `A month's rent (${outcome.carriedOver}) went unpaid.`,
                  tags: ['tenancy', 'rent', 'unpaid'],
                },
              },
            ],
          }),
    }
  },
}

// ---------- tenancy_escalation_review ----------

const escalationDefinition: ScheduledEventDefinition = {
  type: TENANCY_ESCALATION_EVENT,
  kind: 'mechanical',
  ownerModuleId: TENANCY_MODULE_ID,
  label: 'A landlord notice reaches its deadline',
  payloadSchema: NoticePayloadSchema,
  // `wrap_up`: the notice must see the day's payments before it escalates.
  // This is the §7 "target state changing between warning and due event"
  // requirement expressed as a beat rather than as a special case.
  beat: 'wrap_up',
  defaultOffsetDays: 7,
  warningWindowDays: 3,
  expiryDays: 7,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, payload }) => {
    const parsed = NoticePayloadSchema.safeParse(payload)
    return `${type}|${parsed.success ? parsed.data.noticeId : 'unknown'}`
  },
  // `eviction_threat_possible` is the ledger's `HOOK-eviction_threat_possible`
  // family. The threat is only mechanical when there is an actual debt to
  // threaten over — otherwise the adapter declines and it stays narrative.
  futureHookPrefixes: ['eviction_threat_possible'],
  fromFutureHook: ({ state }) => {
    if (!state) return undefined
    if (arrearsOutstanding(state) <= 0 && rentOutstanding(state) <= 0) {
      return undefined
    }
    const live = liveNotice(getTenancyModuleState(state))
    return {
      payload: { noticeId: live?.id ?? 'pending' },
      target: landlordRef(),
    }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = NoticePayloadSchema.safeParse(record.payload)
    const slice = getTenancyModuleState(ctx.state)
    const tenancy = getTenancy(ctx.state)
    if (!tenancy) return noOp('there is no tenancy', record.origin.readable)
    if (tenancy.tenancyStatus === 'evicted') {
      return noOp('the landlord already has the building', record.origin.readable)
    }

    const owed = rentOutstanding(ctx.state)
    const named = parsed.success
      ? slice.notices.find((notice) => notice.id === parsed.data.noticeId)
      : undefined

    // Re-evaluate against TODAY. The whole point of the wrap_up beat is that
    // a player who paid during the day is not escalated for a debt they no
    // longer owe.
    if (owed <= 0) {
      const cured = cureNotices(ctx, 'the rent was cleared before the deadline')
      if (cured === 0) {
        return noOp(
          'nothing is outstanding and no notice was live',
          `${LANDLORD_LABEL} has nothing to say — the rent is clear.`,
        )
      }
      return {
        status: 'resolved',
        readable: `The rent was cleared in time; ${LANDLORD_LABEL} withdrew ${cured} notice(s).`,
        mutations: [
          {
            targetKind: 'tenancy',
            targetId: tenancy.id,
            field: 'tenancyStatus',
            readable: `${cured} notice(s) withdrawn.`,
          },
        ],
        history: {
          category: 'monthly',
          summary: `${LANDLORD_LABEL} withdrew ${cured} notice(s) — the rent was cleared.`,
          tags: ['tenancy', 'notice', 'cured'],
          relatedActors: [landlordRef()],
          relatedSystems: [TENANCY_MODULE_ID],
        },
      }
    }

    if (named && named.status !== 'live') {
      return noOp(
        `notice ${named.id} is already ${named.status}`,
        record.origin.readable,
      )
    }
    if (named && named.deadlineDay > ctx.state.calendar.totalDaysElapsed) {
      // A payment plan pushed the deadline out. Follow it rather than
      // escalating early — that is what the plan bought.
      return {
        status: 'rescheduled',
        toDay: named.deadlineDay,
        reason: 'the deadline was extended',
        readable: `${LANDLORD_LABEL} is holding off until day ${named.deadlineDay}.`,
      }
    }

    const notice = issueOrEscalateNotice(ctx, 'the deadline passed with rent outstanding')
    if (!notice) {
      return noOp('nothing is outstanding', record.origin.readable)
    }

    // The ladder's own next step goes on the calendar here, so an escalation
    // never leaves the tavern in a state nothing will revisit.
    if (notice.kind === 'eviction_filed') {
      bumpTenancyTotals(ctx, { evictionsFiled: 1 }, 'eviction_filed')
      scheduleEvent(ctx, {
        type: EVICTION_HEARING_EVENT,
        target: landlordRef(),
        scheduledForDay: notice.deadlineDay,
        payload: { noticeId: notice.id },
        origin: {
          source: `${TENANCY_MODULE_ID}.eviction`,
          readable: notice.readable,
        },
      })
    } else if (notice.kind !== 'eviction_granted') {
      scheduleNoticeDeadline(ctx, notice.id, notice.deadlineDay)
    }

    return {
      status: 'resolved',
      readable: notice.readable,
      mutations: [
        {
          targetKind: 'tenancy_notice',
          targetId: notice.id,
          field: 'kind',
          readable: `${LANDLORD_LABEL} escalated to ${notice.kind.replace('_', ' ')}.`,
        },
        {
          targetKind: 'landlord',
          targetId: tenancy.landlordId,
          field: 'concern',
          readable: `${owed} coin still outstanding.`,
        },
      ],
      cause: {
        source: `${TENANCY_MODULE_ID}.escalation`,
        sourceType: 'system',
        target: 'pressure:landlord',
        targetType: 'pressure',
        amount: owed,
        direction: 'increase',
        weight: Math.max(1, owed),
        readable: notice.readable,
        tags: ['tenancy', 'notice', notice.kind],
        relatedActors: [landlordRef()],
        expiresAfterDays: 28,
      },
      history: {
        category: 'monthly',
        summary: notice.readable,
        tags: ['tenancy', 'notice', notice.kind],
        relatedActors: [landlordRef()],
        relatedSystems: [TENANCY_MODULE_ID],
      },
    }
  },
}

// ---------- eviction_hearing ----------

const hearingDefinition: ScheduledEventDefinition = {
  type: EVICTION_HEARING_EVENT,
  kind: 'mechanical',
  ownerModuleId: TENANCY_MODULE_ID,
  label: 'The eviction proceeding is heard',
  payloadSchema: NoticePayloadSchema,
  // `morning`: losing the building changes what the whole day can be, so the
  // player must learn it before they plan the day rather than after.
  beat: 'morning',
  defaultOffsetDays: 5,
  warningWindowDays: 3,
  expiryDays: 4,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, payload }) => {
    const parsed = NoticePayloadSchema.safeParse(payload)
    return `${type}|${parsed.success ? parsed.data.noticeId : 'unknown'}`
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const today = ctx.state.calendar.totalDaysElapsed
    const tenancy = getTenancy(ctx.state)
    if (!tenancy) return noOp('there is no tenancy', record.origin.readable)
    if (tenancy.tenancyStatus === 'evicted') {
      return noOp('the eviction has already been carried out', record.origin.readable)
    }
    const owed = rentOutstanding(ctx.state)

    // Dismissed. The debt was cleared before the hearing, which is exactly
    // the counterplay the notice promised.
    if (owed <= 0) {
      const cured = cureNotices(ctx, 'the arrears were cleared before the hearing')
      return {
        status: 'resolved',
        readable: `The arrears were cleared; ${LANDLORD_LABEL} dropped the proceedings.`,
        mutations: [
          {
            targetKind: 'tenancy',
            targetId: tenancy.id,
            field: 'tenancyStatus',
            readable: `Proceedings dismissed; ${cured} notice(s) withdrawn.`,
          },
        ],
        history: {
          category: 'monthly',
          summary: `${LANDLORD_LABEL} dropped the eviction — the arrears were cleared.`,
          tags: ['tenancy', 'eviction', 'dismissed'],
          relatedActors: [landlordRef()],
          relatedSystems: [TENANCY_MODULE_ID],
        },
      }
    }

    // Adjourned. A live payment plan, or a landlord who has come round, buys
    // one more period — the "delay it" half of what the notice named.
    const landlord = getLandlord(ctx.state)
    const plan =
      tenancy.concession?.kind === 'payment_plan' &&
      tenancy.concession.expiresOnDay > today
    if (plan || landlord.opinion >= 60) {
      const toDay = today + 7
      const live = liveNotice(getTenancyModuleState(ctx.state))
      if (live) {
        upsertNotice(
          ctx,
          {
            ...live,
            deadlineDay: toDay,
            readable: `${live.readable} Adjourned to day ${toDay}.`,
          },
          'hearing_adjourned',
        )
      }
      return {
        status: 'rescheduled',
        toDay,
        reason: plan
          ? 'a payment plan is being kept to'
          : `${LANDLORD_LABEL} is willing to wait a little longer`,
        readable: `The hearing was adjourned to day ${toDay}.`,
      }
    }

    const outcome = evictTavern(ctx, `${owed} coin of arrears unpaid at the hearing`)
    const live = liveNotice(getTenancyModuleState(ctx.state))
    if (live) {
      upsertNotice(
        ctx,
        {
          ...live,
          kind: 'eviction_granted',
          deadlineDay: today + 14,
          cureAmount: owed,
          readable: `${LANDLORD_LABEL} has been granted possession. Pay ${owed} plus costs by day ${today + 14} to be reinstated.`,
          remedies: [
            `Pay ${owed} coin of arrears plus the landlord's costs to be reinstated.`,
          ],
        },
        'eviction_granted',
      )
    }

    return {
      status: 'resolved',
      readable: outcome.readable,
      mutations: [
        {
          targetKind: 'tenancy',
          targetId: tenancy.id,
          field: 'tenancyStatus',
          readable: 'The landlord took possession of the building.',
        },
        {
          targetKind: 'economy',
          targetId: 'financial',
          field: 'status',
          readable: 'The tavern is closed.',
        },
      ],
      cause: {
        source: `${TENANCY_MODULE_ID}.eviction`,
        sourceType: 'system',
        target: 'pressure:landlord',
        targetType: 'pressure',
        amount: owed,
        direction: 'increase',
        weight: 100,
        readable: outcome.readable,
        tags: ['tenancy', 'eviction', 'closure'],
        relatedActors: [landlordRef()],
        expiresAfterDays: 28,
      },
      history: {
        category: 'monthly',
        summary: outcome.readable,
        tags: ['tenancy', 'eviction', 'granted'],
        relatedActors: [landlordRef()],
        relatedSystems: [TENANCY_MODULE_ID],
      },
    }
  },
}

// ---------- landlord_goodwill ----------

const goodwillDefinition: ScheduledEventDefinition = {
  type: LANDLORD_GOODWILL_EVENT,
  kind: 'mechanical',
  ownerModuleId: TENANCY_MODULE_ID,
  label: 'The landlord’s goodwill window',
  payloadSchema: EmptyPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 5,
  warningWindowDays: 2,
  expiryDays: 5,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, scheduledForDay }) => `${type}|${scheduledForDay}`,
  futureHookPrefixes: ['landlord_goodwill_window'],
  fromFutureHook: ({ state }) => {
    // Goodwill from a landlord who has nothing to be generous about is not a
    // consequence. Decline unless the tavern actually owes something.
    if (!state || rentOutstanding(state) <= 0) return undefined
    return { payload: {}, target: landlordRef() }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const tenancy = getTenancy(ctx.state)
    if (!tenancy) return noOp('there is no tenancy', record.origin.readable)
    const owed = rentOutstanding(ctx.state)
    if (owed <= 0) {
      return noOp(
        'the rent was cleared before the offer landed',
        `${LANDLORD_LABEL} had nothing to be generous about.`,
      )
    }
    const result = negotiateTenancy(ctx, 'deferral')
    if (!result.ok) {
      return noOp(
        result.reason,
        `${LANDLORD_LABEL} thought better of the offer.`,
      )
    }
    return {
      status: 'resolved',
      readable: result.readable,
      mutations: [
        {
          targetKind: 'tenancy',
          targetId: tenancy.id,
          field: 'concession',
          readable: result.readable,
        },
      ],
      history: {
        category: 'monthly',
        summary: result.readable,
        tags: ['tenancy', 'goodwill', 'concession'],
        relatedActors: [landlordRef()],
        relatedSystems: [TENANCY_MODULE_ID],
      },
    }
  },
}

// ---------- landlord_access_request ----------

const accessDefinition: ScheduledEventDefinition = {
  type: LANDLORD_ACCESS_EVENT,
  kind: 'mechanical',
  ownerModuleId: TENANCY_MODULE_ID,
  label: 'The landlord asks to inspect the building',
  payloadSchema: EmptyPayloadSchema,
  // `morning`, so the player has the whole day to answer before the window
  // closes.
  beat: 'morning',
  defaultOffsetDays: 6,
  warningWindowDays: 1,
  expiryDays: 4,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, scheduledForDay }) => `${type}|${scheduledForDay}`,
  resolve: (ctx, record): ScheduledEventResolution => {
    const today = ctx.state.calendar.totalDaysElapsed
    const tenancy = getTenancy(ctx.state)
    if (!tenancy) return noOp('there is no tenancy', record.origin.readable)
    if (tenancy.tenancyStatus === 'evicted') {
      return noOp('the landlord already has the building', record.origin.readable)
    }
    const landlord = getLandlord(ctx.state)

    // A request already answered by the deadline resolves it; an unanswered
    // one lapses and counts as a refusal, because ignoring the landlord IS
    // an answer and the player was told so.
    if (landlord.accessRequest && landlord.accessRequest.deadlineDay <= today) {
      const outcome = answerAccessRequest(ctx, false)
      return {
        status: 'resolved',
        readable: `${LANDLORD_LABEL}'s request went unanswered. ${outcome.readable}`,
        mutations: [
          {
            targetKind: 'landlord',
            targetId: tenancy.landlordId,
            field: 'accessRefusals',
            readable: 'An unanswered access request counted as a refusal.',
          },
        ],
        history: {
          category: 'monthly',
          summary: `${LANDLORD_LABEL}'s access request went unanswered.`,
          tags: ['tenancy', 'access', 'refused'],
          relatedActors: [landlordRef()],
          relatedSystems: [TENANCY_MODULE_ID],
        },
      }
    }

    const worst = Object.values(ctx.state.areas).reduce(
      (lowest, area) => (area.condition < lowest.condition ? area : lowest),
      { id: 'the building', condition: 100 } as { id: string; condition: number },
    )
    const reason =
      worst.condition < 50
        ? `${worst.id} is in poor condition`
        : 'a routine look at the property'
    if (!raiseAccessRequest(ctx, reason)) {
      return noOp(
        'a request is already outstanding',
        `${LANDLORD_LABEL} is still waiting on the last request.`,
      )
    }
    // Re-arm the deadline as the same event: it resolves the request when it
    // next fires, so an ignored request cannot sit forever.
    return {
      status: 'resolved',
      readable: `${LANDLORD_LABEL} asks to walk the building (${reason}).`,
      repeatInDays: 5,
      mutations: [
        {
          targetKind: 'landlord',
          targetId: tenancy.landlordId,
          field: 'accessRequest',
          readable: `Access requested by day ${today + 4}.`,
        },
      ],
      history: {
        category: 'monthly',
        summary: `${LANDLORD_LABEL} asks to walk the building (${reason}).`,
        tags: ['tenancy', 'access', 'requested'],
        relatedActors: [landlordRef()],
        relatedSystems: [TENANCY_MODULE_ID],
      },
    }
  },
}

let registered = false

export function ensureTenancyEventsRegistered(): void {
  if (registered) return
  registerScheduledEvent(rolloverDefinition)
  registerScheduledEvent(escalationDefinition)
  registerScheduledEvent(hearingDefinition)
  registerScheduledEvent(goodwillDefinition)
  registerScheduledEvent(accessDefinition)
  registered = true
}

/** Put the next period's rollover on the calendar. */
export function scheduleRentRollover(
  ctx: SimContext,
  periodIndex: number,
  periodEndsOnDay: number,
): void {
  scheduleEvent(ctx, {
    type: RENT_PERIOD_ROLLOVER_EVENT,
    target: landlordRef(),
    // The day AFTER the period ends — see the definition's beat comment.
    scheduledForDay: periodEndsOnDay + 1,
    payload: { periodIndex },
    origin: {
      source: `${TENANCY_MODULE_ID}.period`,
      readable: `Rent falls due on day ${periodEndsOnDay}.`,
    },
  })
}

export function scheduleNoticeDeadline(
  ctx: SimContext,
  noticeId: string,
  deadlineDay: number,
): void {
  scheduleEvent(ctx, {
    type: TENANCY_ESCALATION_EVENT,
    target: landlordRef(),
    scheduledForDay: deadlineDay,
    payload: { noticeId },
    origin: {
      source: `${TENANCY_MODULE_ID}.notice`,
      readable: `${LANDLORD_LABEL}'s notice is returnable on day ${deadlineDay}.`,
    },
  })
}

export function scheduleAccessRequest(ctx: SimContext, onDay: number): void {
  scheduleEvent(ctx, {
    type: LANDLORD_ACCESS_EVENT,
    target: landlordRef(),
    scheduledForDay: onDay,
    payload: {},
    origin: {
      source: `${TENANCY_MODULE_ID}.access`,
      readable: `${LANDLORD_LABEL} would like to look the place over.`,
    },
  })
}

/**
 * Keep the ladder wired up.
 *
 * Called from the module's daily hook. The scheduled events are the
 * mechanism; this is what makes sure the first one of each chain exists on a
 * fresh run, a migrated save, and a reload alike — none of which can rely on
 * a one-off call having happened.
 */
export function ensureTenancySchedule(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const tenancy = ensureTenancy(ctx)
  if (tenancy.tenancyStatus === 'evicted' || tenancy.tenancyStatus === 'terminated') {
    return
  }
  scheduleRentRollover(ctx, tenancy.periodIndex, tenancy.periodEndsOnDay)

  const live = liveNotice(getTenancyModuleState(ctx.state))
  if (live && live.kind !== 'eviction_granted') {
    if (live.kind === 'eviction_filed') {
      scheduleEvent(ctx, {
        type: EVICTION_HEARING_EVENT,
        target: landlordRef(),
        scheduledForDay: live.deadlineDay,
        payload: { noticeId: live.id },
        origin: {
          source: `${TENANCY_MODULE_ID}.eviction`,
          readable: live.readable,
        },
      })
    } else {
      scheduleNoticeDeadline(ctx, live.id, live.deadlineDay)
    }
  }

  // The landlord looks the place over about once a season. Deterministic —
  // derived from the period index, not rolled — so it survives a reload and
  // never shifts another system's RNG stream.
  if (tenancy.periodIndex > 0 && today === tenancy.periodEndsOnDay - 14) {
    scheduleAccessRequest(ctx, today + 1)
  }

  syncTenancyStatus(ctx)
}

export { effectiveRent, writeLandlord, writeTenancy }
