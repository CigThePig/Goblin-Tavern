import type { SimContext } from '../../core/context'
import type { EntityRef, TavernState } from '../../state/TavernState'

import { getScheduledEventDefinition } from './registry'
import {
  cancelScheduledEvents,
  capArchive,
  pruneSpentKeys,
  readScheduledEventsSlice,
  scheduleEvent,
  writeScheduledEventsSlice,
} from './state'
import {
  SCHEDULED_EVENTS_MODULE_ID,
  type ScheduledEventBeat,
  type ScheduledEventOutcomeRecord,
  type ScheduledEventRecord,
} from './types'

// Expansion Phase 1 §1.1 — the drain.
//
// One pass per beat. The pass is a pure function of (queue, today) plus
// whatever the owning resolvers do, so running it twice for the same day
// is a no-op: every terminal transition burns the event's exact-once key
// before anything else, and a burnt key can never fire again. That is what
// makes "exact-once across normal play, retry, save/load, import, and
// segment resume" a property of the machinery rather than of each caller.

/**
 * The reason recorded when a narrative expectation reaches its day.
 *
 * A narrative expectation is a story beat with no mechanical owner. It is
 * NOT a bug and it is NOT a broken promise — it is the honest
 * classification of a hook that no domain can yet deliver. Recording it
 * with this stable reason is what lets the audit count how many promises
 * are still narrative-only, which is the metric Phases 2-11 drive to zero.
 */
export const NARRATIVE_EXPECTATION_REASON = 'narrative_expectation_no_mechanical_owner'

export type BeatResolutionSummary = {
  beat: ScheduledEventBeat
  warned: number
  resolved: number
  noOps: number
  expired: number
  cancelled: number
  duplicatesSuppressed: number
}

/**
 * Does the event's target still exist?
 *
 * Only kinds this codebase can actually check are checked. An unknown kind
 * returns `true`: claiming a target is missing because the checker does not
 * recognise its kind would cancel real obligations, which is worse than
 * firing an event whose resolver then has to cope.
 */
export function scheduledEventTargetExists(
  state: TavernState,
  target: EntityRef | undefined,
): boolean {
  if (!target) return true
  switch (target.kind) {
    case 'area':
      return target.id in state.areas
    case 'stock':
      return target.id in state.stock
    case 'staff':
      return target.id in state.staff
    case 'customer_group':
      return target.id in state.customerGroups
    case 'recipe':
      return target.id in state.recipes
    case 'culture':
      return target.id in state.world.cultures
    case 'faction':
      return target.id in state.world.factions
    case 'supplier':
      return target.id in state.world.suppliers
    case 'regular':
      return target.id in state.world.regulars
    case 'notable_npc':
      return target.id in state.world.notableNpcs
    case 'local_event':
      return target.id in state.world.localEvents
    case 'rumour':
      return target.id in state.world.socialRumours
    default:
      // `EntityRef['kind']` also covers refs that are not keyed
      // collections (`role`, `system`, `other`, `tavern_identity`).
      // Those cannot go missing, so they are trivially present.
      return true
  }
}

export function resolveScheduledEventsForBeat(
  ctx: SimContext,
  beat: ScheduledEventBeat,
): BeatResolutionSummary {
  const today = ctx.state.calendar.totalDaysElapsed
  const summary: BeatResolutionSummary = {
    beat,
    warned: 0,
    resolved: 0,
    noOps: 0,
    expired: 0,
    cancelled: 0,
    duplicatesSuppressed: 0,
  }

  // Snapshot first: resolvers mutate state (including, legitimately,
  // scheduling follow-up events), and iterating a live queue would let a
  // freshly-scheduled event fire in the same pass that created it.
  const snapshot = readScheduledEventsSlice(ctx.state).queue.filter(
    (record) =>
      record.beat === beat &&
      (record.status === 'scheduled' || record.status === 'warned'),
  )
  if (snapshot.length === 0) return summary

  // 1) Warning window. Purely a status/visibility change — no mutation, no
  //    key burnt — so the player learns a consequence is coming before it
  //    arrives (§1.1 "optional warning window").
  const toWarn = snapshot.filter(
    (record) =>
      record.status === 'scheduled' &&
      record.warnFromDay !== undefined &&
      today >= record.warnFromDay &&
      today < record.scheduledForDay,
  )
  if (toWarn.length > 0) {
    const warnIds = new Set(toWarn.map((r) => r.id))
    writeScheduledEventsSlice(
      ctx,
      (current) => ({
        ...current,
        queue: current.queue.map((r) =>
          warnIds.has(r.id) ? { ...r, status: 'warned' as const } : r,
        ),
      }),
      'warn',
    )
    summary.warned = toWarn.length
    for (const record of toWarn) {
      ctx.addLog(
        {
          message: `Scheduled event ${record.type} is coming on day ${record.scheduledForDay}`,
          level: 'info',
          data: { eventId: record.id, type: record.type, beat },
        },
        SCHEDULED_EVENTS_MODULE_ID,
      )
    }
  }

  for (const record of snapshot) {
    // Re-read: an earlier resolver in this same pass may have cancelled or
    // superseded this record.
    const live = readScheduledEventsSlice(ctx.state).queue.find(
      (r) => r.id === record.id,
    )
    if (!live) continue
    if (live.status !== 'scheduled' && live.status !== 'warned') continue

    if (today > live.expiresAfterDay) {
      finishEvent(ctx, live, {
        status: 'expired',
        readable: live.origin.readable,
        reason: `passed its expiry on day ${live.expiresAfterDay} without resolving`,
        mutations: [],
      })
      summary.expired += 1
      continue
    }
    if (today < live.scheduledForDay) continue

    const outcome = fireEvent(ctx, live)
    if (outcome === 'resolved') summary.resolved += 1
    else if (outcome === 'no_op') summary.noOps += 1
    else if (outcome === 'cancelled') summary.cancelled += 1
    else if (outcome === 'duplicate_suppressed') summary.duplicatesSuppressed += 1
  }

  return summary
}

type FireOutcome =
  | 'resolved'
  | 'no_op'
  | 'cancelled'
  | 'duplicate_suppressed'
  | 'rescheduled'

function fireEvent(ctx: SimContext, record: ScheduledEventRecord): FireOutcome {
  const today = ctx.state.calendar.totalDaysElapsed

  // Exact-once, checked at the last possible moment. `scheduleEvent`
  // already refuses a duplicate at enqueue time; this second check is what
  // covers the paths that bypass enqueue — an imported save that carries a
  // record whose key was spent in the importing run, or a day replayed
  // after a crash.
  const spent = readScheduledEventsSlice(ctx.state).spentKeys
  if (spent.some((entry) => entry.key === record.exactOnceKey)) {
    finishEvent(ctx, record, {
      status: 'duplicate_suppressed',
      readable: record.origin.readable,
      reason: `exact-once key '${record.exactOnceKey}' was already honoured`,
      mutations: [],
    })
    return 'duplicate_suppressed'
  }

  if (record.kind === 'narrative_expectation') {
    finishEvent(ctx, record, {
      status: 'no_op',
      readable: record.origin.readable,
      reason: NARRATIVE_EXPECTATION_REASON,
      mutations: [],
    })
    return 'no_op'
  }

  const definition = getScheduledEventDefinition(record.type)
  if (!definition) {
    // The type was registered when the event was scheduled and is not now
    // — a pipeline built without the owning module, or a save from a build
    // that had it. Cancelling (rather than dropping) keeps the promise
    // visible in the archive instead of vanishing.
    finishEvent(ctx, record, {
      status: 'cancelled',
      readable: record.origin.readable,
      reason: `owner for '${record.type}' is not registered in this pipeline`,
      mutations: [],
    })
    return 'cancelled'
  }

  if (
    !scheduledEventTargetExists(ctx.state, record.target) &&
    definition.missingTarget === 'cancel'
  ) {
    finishEvent(ctx, record, {
      status: 'cancelled',
      readable: record.origin.readable,
      reason: `target ${record.target?.kind}:${record.target?.id} no longer exists`,
      mutations: [],
    })
    return 'cancelled'
  }

  let resolution
  try {
    resolution = definition.resolve(ctx, record)
  } catch (err) {
    ctx.addLog(
      {
        message: `Scheduled event ${record.id} (${record.type}) threw during resolution: ${(err as Error).message}`,
        level: 'warn',
        data: { eventId: record.id, type: record.type },
      },
      SCHEDULED_EVENTS_MODULE_ID,
    )
    finishEvent(ctx, record, {
      status: 'cancelled',
      readable: record.origin.readable,
      reason: `resolver threw: ${(err as Error).message}`,
      mutations: [],
    })
    return 'cancelled'
  }

  if (resolution.status === 'rescheduled') {
    const expiryWindow = record.expiresAfterDay - record.scheduledForDay
    writeScheduledEventsSlice(
      ctx,
      (current) => ({
        ...current,
        queue: current.queue.map((r) =>
          r.id === record.id
            ? {
                ...r,
                status: 'scheduled' as const,
                scheduledForDay: resolution.toDay,
                expiresAfterDay: resolution.toDay + expiryWindow,
                ...(r.warnFromDay !== undefined
                  ? {
                      warnFromDay:
                        resolution.toDay -
                        (record.scheduledForDay - r.warnFromDay),
                    }
                  : {}),
              }
            : r,
        ),
      }),
      'reschedule',
    )
    ctx.addLog(
      {
        message: `Scheduled event ${record.type} moved to day ${resolution.toDay}: ${resolution.reason}`,
        level: 'info',
        data: { eventId: record.id, toDay: resolution.toDay },
      },
      SCHEDULED_EVENTS_MODULE_ID,
    )
    return 'rescheduled'
  }

  if (resolution.status === 'cancelled') {
    finishEvent(ctx, record, {
      status: 'cancelled',
      readable: resolution.readable,
      reason: resolution.reason,
      mutations: [],
    })
    return 'cancelled'
  }

  if (resolution.status === 'no_op') {
    finishEvent(ctx, record, {
      status: 'no_op',
      readable: resolution.readable,
      reason: resolution.reason,
      mutations: [],
    })
    return 'no_op'
  }

  // status === 'resolved'. The resolver has already performed its own
  // authoritative mutations; everything below is the shared reporting and
  // bookkeeping that every event gets for free so no owner has to
  // reinvent it.
  if (resolution.cause) ctx.addCause(resolution.cause)
  if (resolution.memory) ctx.addMemory(resolution.memory)
  if (resolution.history) ctx.addHistory(resolution.history)
  for (const pressure of resolution.pressures ?? []) {
    ctx.modifyPressure(pressure.id, pressure.change, pressure.cause)
  }

  finishEvent(ctx, record, {
    status: 'resolved',
    readable: resolution.readable,
    mutations: resolution.mutations,
  })

  // `cancelledBy`: this type firing withdraws anything that declared
  // itself cancelled by it, for the same target.
  cancelScheduledEvents(
    ctx,
    (other) => {
      if (other.id === record.id) return false
      const otherDef = getScheduledEventDefinition(other.type)
      if (!otherDef?.cancelledBy?.includes(record.type)) return false
      return sameTarget(other, record)
    },
    `superseded by ${record.type} resolving`,
    'cancelled',
  )

  // Repeat. Bounded by `maxOccurrences`, which `scheduleEvent` enforces —
  // an over-run request is rejected there rather than silently clamped, so
  // a mis-declared repeat surfaces as a log instead of an endless queue.
  const repeatInDays = resolution.repeatInDays ?? definition.repeat?.everyDays
  if (repeatInDays !== undefined && definition.repeat) {
    const next = scheduleEvent(ctx, {
      type: record.type,
      ...(record.target ? { target: record.target } : {}),
      scheduledForDay: today + repeatInDays,
      payload: record.payload,
      origin: record.origin,
      occurrence: record.occurrence + 1,
    })
    if (next.status === 'rejected') {
      ctx.addLog(
        {
          message: `Scheduled event ${record.type} did not repeat: ${next.reason}`,
          level: 'info',
          data: { eventId: record.id, occurrence: record.occurrence + 1 },
        },
        SCHEDULED_EVENTS_MODULE_ID,
      )
    }
  }

  return 'resolved'
}

function sameTarget(a: ScheduledEventRecord, b: ScheduledEventRecord): boolean {
  if (!a.target && !b.target) return true
  if (!a.target || !b.target) return false
  return a.target.kind === b.target.kind && a.target.id === b.target.id
}

/**
 * Terminal transition: burn the exact-once key, drop the record from the
 * queue, and archive the outcome. Every path out of `fireEvent` that is
 * not a reschedule comes through here, so there is exactly one place where
 * a promise stops being live.
 */
function finishEvent(
  ctx: SimContext,
  record: ScheduledEventRecord,
  outcome: {
    status: Exclude<
      ScheduledEventOutcomeRecord['status'],
      'superseded'
    >
    readable: string
    reason?: string
    mutations: ScheduledEventOutcomeRecord['mutations']
  },
): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const archived: ScheduledEventOutcomeRecord = {
    eventId: record.id,
    type: record.type,
    kind: record.kind,
    ownerModuleId: record.ownerModuleId,
    status: outcome.status,
    resolvedOnDay: today,
    readable: outcome.readable,
    mutations: outcome.mutations,
    ...(outcome.reason ? { reason: outcome.reason } : {}),
    originLabel: record.origin.selectionLabel ?? record.origin.source,
  }

  // A cancelled event did not happen, so its key stays unspent and the
  // same promise may be made again. Everything else — resolved, no_op,
  // expired, duplicate_suppressed — has consumed its one chance.
  const burnsKey = outcome.status !== 'cancelled'

  writeScheduledEventsSlice(
    ctx,
    (current) => ({
      ...current,
      queue: current.queue.filter((r) => r.id !== record.id),
      resolvedToday: [...current.resolvedToday, archived],
      archive: capArchive([...current.archive, archived]),
      spentKeys: burnsKey
        ? pruneSpentKeys(
            [...current.spentKeys, { key: record.exactOnceKey, day: today }],
            today,
          )
        : pruneSpentKeys(current.spentKeys, today),
      totals: bumpTotal(current.totals, outcome.status),
    }),
    `finish_${outcome.status}`,
  )
}

function bumpTotal(
  totals: ReturnType<typeof readScheduledEventsSlice>['totals'],
  status: ScheduledEventOutcomeRecord['status'],
): ReturnType<typeof readScheduledEventsSlice>['totals'] {
  switch (status) {
    case 'resolved':
      return { ...totals, resolved: totals.resolved + 1 }
    case 'no_op':
      return { ...totals, noOps: totals.noOps + 1 }
    case 'expired':
      return { ...totals, expired: totals.expired + 1 }
    case 'cancelled':
      return { ...totals, cancelled: totals.cancelled + 1 }
    case 'superseded':
      return { ...totals, superseded: totals.superseded + 1 }
    case 'duplicate_suppressed':
      return {
        ...totals,
        duplicatesSuppressed: totals.duplicatesSuppressed + 1,
      }
  }
}
