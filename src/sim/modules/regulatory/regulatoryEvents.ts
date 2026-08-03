import { z } from 'zod'

import type { SimContext } from '../../core/context'
import { registerScheduledEvent } from '../../contracts/scheduledEvents/registry'
import { scheduleEvent } from '../../contracts/scheduledEvents/state'
import type {
  ScheduledEventDefinition,
  ScheduledEventResolution,
} from '../../contracts/scheduledEvents/index'

import { observeEvidence } from './evidence'
import {
  caseIsSettled,
  closeCase,
  openCase,
  performFollowUp,
  performVisit,
  shouldOpenCase,
} from './inspection'
import {
  clearEvidence,
  getCase,
  getRegulatoryModuleState,
  upsertCase,
  watchRef,
  writeRecords,
  writeWatchStanding,
} from './state'
import {
  REGULATORY_MODULE_ID,
  WATCH_LABEL,
  openCases,
  type TavernRegulatoryCase,
} from './types'

// Expansion Phase 7 §7.3 applied to the calendar.
//
// THE OBLIGATION THIS CLOSES. `OBL-03`: "inspection suspicion accumulates and
// issues warnings, but no inspector visit is ever scheduled or resolved."
// `regulatory_visit` IS that visit — a dated beat, owned by a module, that
// reads the tavern's actual state and produces findings, fines, orders or a
// closure. Everything else here is the rest of the lifecycle the visit needs
// in order to be more than a one-off punishment: the follow-up that checks
// whether the orders were met, the exposure that makes bribery a gamble
// rather than a purchase, and the two relationship events that let the watch
// be something other than an enemy.
//
// Eight `HOOK-*` families in the implementation ledger name an inspection
// consequence no domain could deliver before this phase. All eight now
// resolve into real regulatory state, and each declines (staying a narrative
// expectation) when the thing it is about does not exist.

export const REGULATORY_VISIT_EVENT = 'regulatory_visit'
export const REGULATORY_FOLLOWUP_EVENT = 'regulatory_followup'
export const BRIBE_EXPOSED_EVENT = 'inspection_bribe_exposed'
export const WATCH_RELATIONSHIP_EVENT = 'watch_relationship'
export const CLEANING_STREAK_EVENT = 'cleaning_routine_review'

const CasePayloadSchema = z.object({ caseId: z.string() })
const EmptyPayloadSchema = z.object({}).passthrough()

function noOp(reason: string, readable: string): ScheduledEventResolution {
  return { status: 'no_op', reason, readable }
}

/** The live case a hook should attach to, or `undefined` when there is none. */
function liveCaseId(state: Parameters<typeof getRegulatoryModuleState>[0]): string | undefined {
  return openCases(getRegulatoryModuleState(state))[0]?.id
}

// ---------- regulatory_visit ----------

const visitDefinition: ScheduledEventDefinition = {
  type: REGULATORY_VISIT_EVENT,
  kind: 'mechanical',
  ownerModuleId: REGULATORY_MODULE_ID,
  label: 'An inspector visits the tavern',
  payloadSchema: CasePayloadSchema,
  // `morning`: the inspector walks in and grades the tavern as it stands
  // when the doors open. That is what makes the preparation window worth
  // spending — everything the player does on the preceding days counts, and
  // nothing they do after the inspector arrives does.
  beat: 'morning',
  defaultOffsetDays: 3,
  // The warning IS the preparation window. `openCase` sets the visit day
  // from the evidence weight, so a tavern the watch has heard a great deal
  // about gets a same-day visit and no warning at all.
  warningWindowDays: 3,
  expiryDays: 4,
  missingTarget: 'resolve_anyway',
  // One visit per case per scheduled day.
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = CasePayloadSchema.safeParse(payload)
    return `${type}|${parsed.success ? parsed.data.caseId : 'unknown'}|${scheduledForDay}`
  },
  futureHookPrefixes: ['inspection_discovery_possible'],
  fromFutureHook: ({ state }) => {
    // A discovery hook is only mechanical when the watch has, or could
    // have, a case. Otherwise it stays narrative.
    if (!state) return undefined
    const existing = liveCaseId(state)
    if (existing) return { payload: { caseId: existing }, target: watchRef() }
    if (!shouldOpenCase(state).open) return undefined
    return { payload: { caseId: 'pending' }, target: watchRef() }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = CasePayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload did not name a case', record.origin.readable)
    }

    // `pending` means the hook asked for a visit without a case behind it
    // yet; the watch opens one now if the evidence still justifies it.
    let subject: TavernRegulatoryCase | undefined =
      parsed.data.caseId === 'pending'
        ? undefined
        : getCase(ctx.state, parsed.data.caseId)
    if (!subject) {
      const trigger = shouldOpenCase(ctx.state)
      if (!trigger.open) {
        return noOp(
          trigger.reason,
          `${WATCH_LABEL} looked into it and found nothing worth a visit.`,
        )
      }
      const opened = openCase(ctx, trigger)
      subject = opened.record
      // Opened today with a preparation window: the visit is that day, not
      // this one. Re-arming keeps the promise without collapsing the window.
      if (opened.visitDay > ctx.state.calendar.totalDaysElapsed) {
        scheduleVisit(ctx, subject.id, opened.visitDay)
        return {
          status: 'resolved',
          readable: `${WATCH_LABEL} gave notice: ${subject.inspectorName} will inspect on day ${opened.visitDay}.`,
          mutations: [
            {
              targetKind: 'regulatory_case',
              targetId: subject.id,
              field: 'nextVisitDay',
              readable: `Inspection set for day ${opened.visitDay}.`,
            },
          ],
          history: {
            category: 'system',
            summary: `${WATCH_LABEL} set an inspection for day ${opened.visitDay}.`,
            tags: ['regulatory', 'inspection', 'scheduled'],
            relatedActors: [watchRef()],
            relatedSystems: [REGULATORY_MODULE_ID],
          },
        }
      }
    }

    if (subject.caseStatus === 'closed') {
      return noOp(
        `case ${subject.id} is closed`,
        `${WATCH_LABEL} has nothing outstanding with you.`,
      )
    }

    const result = performVisit(ctx, subject)
    if (result.followUpDay !== undefined) {
      scheduleFollowUp(ctx, subject.id, result.followUpDay)
    }
    // An accepted bribe is a debt of a different kind: it can come out.
    if (subject.bribe?.accepted) {
      scheduleBribeExposure(ctx, subject.id, ctx.state.calendar.totalDaysElapsed + 9)
    }

    return {
      status: 'resolved',
      readable: result.readable,
      mutations: [
        {
          targetKind: 'regulatory_case',
          targetId: subject.id,
          field: 'outcomes',
          readable: `Outcome: ${result.outcome.replace('_', ' ')}.`,
        },
        ...result.findings.map((finding) => ({
          targetKind: 'inspection_finding',
          targetId: finding.id,
          field: 'status',
          readable: finding.requirement,
        })),
        ...(result.fine > 0
          ? [
              {
                targetKind: 'obligation',
                targetId: result.fineObligationId ?? 'fine',
                field: 'principal',
                readable: `A ${result.fine} coin fine, due in seven days.`,
              },
            ]
          : []),
        ...(result.closed
          ? [
              {
                targetKind: 'economy',
                targetId: 'financial',
                field: 'status',
                readable: 'The watch shut the tavern.',
              },
            ]
          : []),
      ],
      cause: {
        source: `${REGULATORY_MODULE_ID}.visit`,
        sourceType: 'system',
        target: 'pressure:inspection',
        targetType: 'pressure',
        amount: result.findings.length * 5,
        direction: result.findings.length > 0 ? 'increase' : 'decrease',
        weight: Math.max(1, result.findings.length * 10),
        readable: result.readable,
        tags: ['regulatory', 'inspection', result.outcome],
        relatedActors: [watchRef()],
        expiresAfterDays: 21,
      },
      memory: {
        id: result.findings.length > 0 ? 'inspection_failed_recently' : 'inspection_passed_recently',
        source: `${REGULATORY_MODULE_ID}.visit`,
        metadata: { caseId: subject.id, outcome: result.outcome, fine: result.fine },
      },
      history: {
        category: 'system',
        summary: result.readable,
        tags: ['regulatory', 'inspection', result.outcome],
        relatedActors: [watchRef()],
        relatedSystems: [REGULATORY_MODULE_ID],
      },
      pressures: [
        {
          id: 'inspection',
          // A passed inspection genuinely lowers the forecast: the watch has
          // looked and gone away. This is the meter following the event, not
          // standing in for it.
          change: result.findings.length > 0 ? Math.min(25, result.findings.length * 6) : -20,
          cause: {
            source: `${REGULATORY_MODULE_ID}.visit`,
            sourceType: 'system',
            readable: result.readable,
            tags: ['regulatory', 'inspection'],
          },
        },
      ],
    }
  },
}

// ---------- regulatory_followup ----------

const followUpDefinition: ScheduledEventDefinition = {
  type: REGULATORY_FOLLOWUP_EVENT,
  kind: 'mechanical',
  ownerModuleId: REGULATORY_MODULE_ID,
  label: 'The inspector returns to check the orders',
  payloadSchema: CasePayloadSchema,
  beat: 'morning',
  defaultOffsetDays: 7,
  warningWindowDays: 3,
  expiryDays: 5,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = CasePayloadSchema.safeParse(payload)
    return `${type}|${parsed.success ? parsed.data.caseId : 'unknown'}|${scheduledForDay}`
  },
  // Four `HOOK-*` families all mean the same thing — the inspector comes
  // back — and all four now land on this one owner.
  futureHookPrefixes: [
    'inspection_followup_possible',
    'inspector_followup_possible',
    'kitchen_inspection_followup',
    'repair_inspection_followup',
  ],
  fromFutureHook: ({ state }) => {
    if (!state) return undefined
    const caseId = liveCaseId(state)
    // No open case means there is nothing to follow up on. Declining keeps
    // the promise honest instead of inventing a visit about nothing.
    if (!caseId) return undefined
    return { payload: { caseId }, target: watchRef() }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = CasePayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload did not name a case', record.origin.readable)
    }
    const subject = getCase(ctx.state, parsed.data.caseId)
    if (!subject) {
      return noOp(
        `case ${parsed.data.caseId} is closed`,
        `${WATCH_LABEL} had nothing left to check.`,
      )
    }

    const result = performFollowUp(ctx, subject)
    if (result.escalated) {
      scheduleFollowUp(ctx, subject.id, ctx.state.calendar.totalDaysElapsed + 7)
    } else if (caseIsSettled(ctx.state, result.record)) {
      closeCase(ctx, result.record, 'every order met and every fine settled')
    }

    return {
      status: 'resolved',
      readable: result.readable,
      mutations: [
        {
          targetKind: 'regulatory_case',
          targetId: subject.id,
          field: 'caseStatus',
          readable: result.escalated
            ? `${result.outstanding.length} order(s) still unmet.`
            : `${result.verified} order(s) verified.`,
        },
        ...result.outstanding.map((finding) => ({
          targetKind: 'inspection_finding',
          targetId: finding.id,
          field: 'status',
          readable: `Still outstanding: ${finding.requirement}`,
        })),
      ],
      cause: {
        source: `${REGULATORY_MODULE_ID}.follow_up`,
        sourceType: 'system',
        target: 'pressure:inspection',
        targetType: 'pressure',
        amount: result.escalated ? 15 : -15,
        direction: result.escalated ? 'increase' : 'decrease',
        weight: 30,
        readable: result.readable,
        tags: ['regulatory', 'follow_up'],
        relatedActors: [watchRef()],
        expiresAfterDays: 21,
      },
      history: {
        category: 'system',
        summary: result.readable,
        tags: ['regulatory', 'follow_up', result.escalated ? 'escalated' : 'cleared'],
        relatedActors: [watchRef()],
        relatedSystems: [REGULATORY_MODULE_ID],
      },
      pressures: [
        {
          id: 'inspection',
          change: result.escalated ? 15 : -18,
          cause: {
            source: `${REGULATORY_MODULE_ID}.follow_up`,
            sourceType: 'system',
            readable: result.readable,
            tags: ['regulatory', 'follow_up'],
          },
        },
      ],
    }
  },
}

// ---------- inspection_bribe_exposed ----------

const exposureDefinition: ScheduledEventDefinition = {
  type: BRIBE_EXPOSED_EVENT,
  kind: 'mechanical',
  ownerModuleId: REGULATORY_MODULE_ID,
  label: 'A bribe comes out',
  payloadSchema: CasePayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 9,
  warningWindowDays: 0,
  expiryDays: 6,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, payload }) => {
    const parsed = CasePayloadSchema.safeParse(payload)
    return `${type}|${parsed.success ? parsed.data.caseId : 'unknown'}`
  },
  futureHookPrefixes: ['inspection_bribe_exposed_'],
  fromFutureHook: ({ state }) => {
    // Only a tavern that actually bribed somebody can have a bribe come out.
    if (!state) return undefined
    const slice = getRegulatoryModuleState(state)
    const bribed = openCases(slice).find((entry) => entry.bribe?.accepted)
    if (!bribed) return undefined
    return { payload: { caseId: bribed.id }, target: watchRef() }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const today = ctx.state.calendar.totalDaysElapsed
    const parsed = CasePayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload did not name a case', record.origin.readable)
    }
    const subject = getCase(ctx.state, parsed.data.caseId)
    if (!subject?.bribe?.accepted) {
      return noOp(
        'there is no accepted bribe to come out',
        `${WATCH_LABEL} heard nothing worth acting on.`,
      )
    }
    if (subject.bribe.exposed) {
      return noOp('the bribe is already public', record.origin.readable)
    }

    const rng = ctx.getRngStream('regulatory')
    // A bribe is a gamble that keeps running. A quarter of the time it comes
    // out — and when it does, the arrangement is worthless and the watch is
    // worse than it started.
    if (rng.float() >= 0.25) {
      return noOp(
        'nobody talked, this time',
        `The arrangement with ${subject.inspectorName} held.`,
      )
    }

    upsertCase(
      ctx,
      {
        ...subject,
        bribe: { ...subject.bribe, exposed: true },
        escalation: subject.escalation + 1,
        caseStatus: 'awaiting_remediation',
        lastTransitionOnDay: today,
      },
      'bribe_exposed',
    )
    writeWatchStanding(
      ctx,
      (watch) => ({
        ...watch,
        bribesExposed: watch.bribesExposed + 1,
        standing: Math.max(0, watch.standing - 30),
        corruptInspectorId: undefined,
        corruptUntilDay: undefined,
      }),
      'bribe_exposed',
    )
    // The tavern is now under a much harder eye: a fresh visit, unannounced.
    scheduleVisit(ctx, subject.id, today + 2)

    const readable = `Word got out that ${subject.inspectorName} was paid. ${WATCH_LABEL} is sending somebody else, and soon.`
    return {
      status: 'resolved',
      readable,
      mutations: [
        {
          targetKind: 'regulatory_case',
          targetId: subject.id,
          field: 'bribe',
          readable: 'The bribe is public.',
        },
        {
          targetKind: 'watch',
          targetId: 'standing',
          field: 'standing',
          readable: 'The watch no longer gives the tavern any benefit of the doubt.',
        },
      ],
      cause: {
        source: `${REGULATORY_MODULE_ID}.bribe_exposed`,
        sourceType: 'system',
        target: 'pressure:inspection',
        targetType: 'pressure',
        amount: 30,
        direction: 'increase',
        weight: 60,
        readable,
        tags: ['regulatory', 'bribe', 'exposed'],
        relatedActors: [watchRef()],
        expiresAfterDays: 28,
      },
      memory: {
        id: 'bribe_exposed_recently',
        source: `${REGULATORY_MODULE_ID}.bribe_exposed`,
        metadata: { caseId: subject.id },
      },
      history: {
        category: 'system',
        summary: readable,
        tags: ['regulatory', 'bribe', 'exposed'],
        relatedActors: [watchRef()],
        relatedSystems: [REGULATORY_MODULE_ID],
      },
      pressures: [
        {
          id: 'inspection',
          change: 30,
          cause: {
            source: `${REGULATORY_MODULE_ID}.bribe_exposed`,
            sourceType: 'system',
            readable,
            tags: ['regulatory', 'bribe'],
          },
        },
      ],
    }
  },
}

// ---------- watch_relationship ----------

const relationshipDefinition: ScheduledEventDefinition = {
  type: WATCH_RELATIONSHIP_EVENT,
  kind: 'mechanical',
  ownerModuleId: REGULATORY_MODULE_ID,
  label: 'The watch takes a view of the tavern',
  payloadSchema: EmptyPayloadSchema.extend({ favourable: z.boolean().optional() }),
  beat: 'wrap_up',
  defaultOffsetDays: 5,
  warningWindowDays: 0,
  expiryDays: 6,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, scheduledForDay }) => `${type}|${scheduledForDay}`,
  // Four hook families about the watch being on the tavern's side: goodwill,
  // an advisor who tells you what they would write up, and a friendly (or
  // corrupt) relationship with one inspector.
  futureHookPrefixes: [
    'town_watch_goodwill',
    'town_watch_advisor',
    'inspector_advisor_',
    'corrupt_inspector_relationship',
  ],
  fromFutureHook: ({ hookName }) => ({
    payload: {
      favourable: !hookName.startsWith('corrupt_inspector_relationship'),
    },
    target: watchRef(),
  }),
  resolve: (ctx, record): ScheduledEventResolution => {
    const today = ctx.state.calendar.totalDaysElapsed
    const payload = record.payload as { favourable?: boolean } | null
    const favourable = payload?.favourable !== false
    const slice = getRegulatoryModuleState(ctx.state)

    if (favourable) {
      // An advisor walks the place and helps with the paperwork, and the
      // watch stops counting the incidents they have now heard explained.
      const before = slice.records.readiness
      writeRecords(
        ctx,
        (current) => ({
          ...current,
          readiness: Math.min(100, current.readiness + 20),
          lastUpdatedOnDay: today,
        }),
        'watch_advisor',
      )
      const cleared = clearEvidence(
        ctx,
        (entry) => entry.dimension === 'recent_evidence',
      )
      writeWatchStanding(
        ctx,
        (watch) => ({ ...watch, standing: Math.min(100, watch.standing + 8) }),
        'watch_goodwill',
      )
      const after = getRegulatoryModuleState(ctx.state).records.readiness
      const readable =
        `Somebody from ${WATCH_LABEL} walked the tavern off the record: records readiness ${before} → ${after}` +
        (cleared > 0 ? `, and ${cleared} reported incident(s) written off.` : '.')
      return {
        status: 'resolved',
        readable,
        mutations: [
          {
            targetKind: 'records',
            targetId: 'readiness',
            field: 'readiness',
            readable: `Records readiness ${before} → ${after}.`,
          },
          {
            targetKind: 'watch',
            targetId: 'standing',
            field: 'standing',
            readable: 'The watch is better disposed toward the tavern.',
          },
        ],
        history: {
          category: 'system',
          summary: readable,
          tags: ['regulatory', 'goodwill'],
          relatedActors: [watchRef()],
          relatedSystems: [REGULATORY_MODULE_ID],
        },
      }
    }

    // A corrupt arrangement. Worth having, and worth being afraid of: it
    // schedules its own exposure risk against whatever case it covers.
    const subject = openCases(slice)[0]
    if (!subject) {
      return noOp(
        'there is no case for an arrangement to cover',
        `${WATCH_LABEL} has nothing open on you to be bought off.`,
      )
    }
    writeWatchStanding(
      ctx,
      (watch) => ({
        ...watch,
        corruptInspectorId: subject.inspectorId,
        corruptUntilDay: today + 21,
      }),
      'corrupt_relationship',
    )
    upsertCase(
      ctx,
      {
        ...subject,
        bribe: subject.bribe ?? { onDay: today, amount: 0, accepted: true, exposed: false },
        lastTransitionOnDay: today,
      },
      'corrupt_relationship',
    )
    scheduleBribeExposure(ctx, subject.id, today + 9)
    const readable = `${subject.inspectorName} has come to an understanding with the tavern. It will hold for about three weeks.`
    return {
      status: 'resolved',
      readable,
      mutations: [
        {
          targetKind: 'watch',
          targetId: 'corruptInspectorId',
          field: 'corruptInspectorId',
          readable: `${subject.inspectorName} will look the other way until day ${today + 21}.`,
        },
      ],
      history: {
        category: 'system',
        summary: readable,
        tags: ['regulatory', 'corruption'],
        relatedActors: [watchRef()],
        relatedSystems: [REGULATORY_MODULE_ID],
      },
    }
  },
}

// ---------- cleaning_routine_review ----------

const cleaningStreakDefinition: ScheduledEventDefinition = {
  type: CLEANING_STREAK_EVENT,
  kind: 'mechanical',
  ownerModuleId: REGULATORY_MODULE_ID,
  label: 'A cleaning routine is judged on its results',
  payloadSchema: EmptyPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 5,
  warningWindowDays: 0,
  expiryDays: 5,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, scheduledForDay }) => `${type}|${scheduledForDay}`,
  futureHookPrefixes: ['cleaning_routine_streak'],
  fromFutureHook: () => ({ payload: {}, target: watchRef() }),
  resolve: (ctx): ScheduledEventResolution => {
    // The promise was a routine, so it is judged on the rooms — not on
    // whether the player said they would keep it. `observeEvidence` is the
    // same read the daily pass and the inspector use.
    const dirty = observeEvidence(ctx.state).filter(
      (entry) => entry.dimension === 'cleanliness' || entry.dimension === 'food_safety',
    )
    if (dirty.length > 0) {
      return noOp(
        `the routine did not hold — ${dirty.length} room(s) still fail`,
        `The cleaning routine slipped: ${dirty[0]!.readable}`,
      )
    }
    const cleared = clearEvidence(
      ctx,
      (entry) => entry.dimension === 'cleanliness' || entry.dimension === 'food_safety',
    )
    writeWatchStanding(
      ctx,
      (watch) => ({ ...watch, standing: Math.min(100, watch.standing + 6) }),
      'cleaning_streak',
    )
    const readable = `The cleaning routine held. ${cleared} standing complaint(s) written off and ${WATCH_LABEL} noticed.`
    return {
      status: 'resolved',
      readable,
      mutations: [
        {
          targetKind: 'watch',
          targetId: 'standing',
          field: 'standing',
          readable: 'The watch has less to be curious about.',
        },
      ],
      history: {
        category: 'system',
        summary: readable,
        tags: ['regulatory', 'cleaning', 'streak'],
        relatedActors: [watchRef()],
        relatedSystems: [REGULATORY_MODULE_ID],
      },
      pressures: [
        {
          id: 'inspection',
          change: -10,
          cause: {
            source: `${REGULATORY_MODULE_ID}.cleaning_streak`,
            sourceType: 'system',
            readable,
            tags: ['regulatory', 'cleaning'],
          },
        },
      ],
    }
  },
}

let registered = false

export function ensureRegulatoryEventsRegistered(): void {
  if (registered) return
  registerScheduledEvent(visitDefinition)
  registerScheduledEvent(followUpDefinition)
  registerScheduledEvent(exposureDefinition)
  registerScheduledEvent(relationshipDefinition)
  registerScheduledEvent(cleaningStreakDefinition)
  registered = true
}

export function scheduleVisit(ctx: SimContext, caseId: string, onDay: number): void {
  scheduleEvent(ctx, {
    type: REGULATORY_VISIT_EVENT,
    target: watchRef(),
    scheduledForDay: onDay,
    payload: { caseId },
    origin: {
      source: `${REGULATORY_MODULE_ID}.visit`,
      readable: `${WATCH_LABEL} will inspect the tavern on day ${onDay}.`,
    },
  })
}

export function scheduleFollowUp(ctx: SimContext, caseId: string, onDay: number): void {
  scheduleEvent(ctx, {
    type: REGULATORY_FOLLOWUP_EVENT,
    target: watchRef(),
    scheduledForDay: onDay,
    payload: { caseId },
    origin: {
      source: `${REGULATORY_MODULE_ID}.follow_up`,
      readable: `${WATCH_LABEL} will come back on day ${onDay} to check the orders.`,
    },
  })
}

export function scheduleBribeExposure(
  ctx: SimContext,
  caseId: string,
  onDay: number,
): void {
  scheduleEvent(ctx, {
    type: BRIBE_EXPOSED_EVENT,
    target: watchRef(),
    scheduledForDay: onDay,
    payload: { caseId },
    origin: {
      source: `${REGULATORY_MODULE_ID}.bribe`,
      readable: 'A quiet arrangement that could still come out.',
    },
  })
}

/**
 * The watch's own daily decision: is there enough here to come out about?
 *
 * Called from the module's hook. Deterministic on evidence, so a tavern that
 * keeps its rooms clean is never visited by accident and one that does not
 * always is. `openCase` owns the roll for WHO comes and WHEN, on the named
 * `regulatory` stream.
 */
export function reviewWatchInterest(ctx: SimContext): void {
  const trigger = shouldOpenCase(ctx.state)
  if (!trigger.open) return
  const opened = openCase(ctx, trigger)
  scheduleVisit(ctx, opened.record.id, opened.visitDay)
}

/**
 * Wind up cases whose findings are all resolved and whose fines are settled.
 *
 * The last step of §7.3's lifecycle, and the one that stops a tavern
 * accumulating open cases forever (§5.11 applied to the case map).
 */
export function closeSettledCases(ctx: SimContext): void {
  for (const record of openCases(getRegulatoryModuleState(ctx.state))) {
    if (record.caseStatus === 'open') continue
    if (record.nextVisitDay !== undefined) continue
    if (!caseIsSettled(ctx.state, record)) continue
    closeCase(ctx, record, 'nothing outstanding')
  }
}
