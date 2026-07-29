import type { SimContext } from '../../core/context'
import type { EntityRef, TavernState } from '../../state/TavernState'

import { getScheduledEventDefinition } from './registry'
import {
  EXACT_ONCE_RETENTION_DAYS,
  MAX_ARCHIVED_OUTCOMES,
  MAX_EXACT_ONCE_KEYS,
  SCHEDULED_EVENTS_MODULE_ID,
  type ScheduledEventBeat,
  type ScheduledEventKind,
  type ScheduledEventOutcomeRecord,
  type ScheduledEventRecord,
  type ScheduledEventsModuleState,
} from './types'

// Expansion Phase 1 §1.1 — slice access and the scheduling API.
//
// Every write to the queue goes through `scheduleEvent` /
// `cancelScheduledEvents` / `recordOutcome` here. Nothing reaches into
// `state.modules.scheduledEvents` directly, which is what makes the
// exact-once guarantee enforceable in one place instead of at each of the
// dozens of future producers.

export function createInitialScheduledEventsModuleState(): ScheduledEventsModuleState {
  return {
    queue: [],
    resolvedToday: [],
    archive: [],
    spentKeys: [],
    nextEventSuffix: 0,
    totals: {
      scheduled: 0,
      resolved: 0,
      expired: 0,
      cancelled: 0,
      superseded: 0,
      duplicatesSuppressed: 0,
      noOps: 0,
    },
  }
}

export function readScheduledEventsSlice(
  state: TavernState,
): ScheduledEventsModuleState {
  const raw = (state.modules as Record<string, unknown> | undefined)?.[
    SCHEDULED_EVENTS_MODULE_ID
  ] as Partial<ScheduledEventsModuleState> | undefined
  const defaults = createInitialScheduledEventsModuleState()
  if (!raw) return defaults
  return {
    ...defaults,
    ...raw,
    totals: { ...defaults.totals, ...(raw.totals ?? {}) },
  }
}

export function writeScheduledEventsSlice(
  ctx: SimContext,
  patch: (current: ScheduledEventsModuleState) => ScheduledEventsModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<ScheduledEventsModuleState>(
    SCHEDULED_EVENTS_MODULE_ID,
    (current) => {
      const defaults = createInitialScheduledEventsModuleState()
      const base: ScheduledEventsModuleState = current
        ? {
            ...defaults,
            ...current,
            totals: { ...defaults.totals, ...(current.totals ?? {}) },
          }
        : defaults
      return patch(base)
    },
    {
      source: `${SCHEDULED_EVENTS_MODULE_ID}.${reason}`,
      reason,
    },
  )
}

/**
 * Has this exact-once key already been honoured?
 *
 * "Honoured" means either spent (an event with this key resolved, no-op'd
 * or expired) or LIVE (an event with this key is sitting in the queue).
 * Both matter: the first stops a resolved promise firing twice after a
 * reload, the second stops the same promise being queued twice when a
 * player retries a day or a save is imported over a run that already had
 * it pending.
 */
export function isExactOnceKeyHonoured(
  slice: ScheduledEventsModuleState,
  key: string,
): boolean {
  if (slice.spentKeys.some((entry) => entry.key === key)) return true
  return slice.queue.some(
    (record) =>
      record.exactOnceKey === key &&
      (record.status === 'scheduled' || record.status === 'warned'),
  )
}

export type ScheduleEventRequest = {
  type: string
  kind?: ScheduledEventKind
  /** Required for a narrative expectation; ignored for a mechanical event (the registry owns it). */
  ownerModuleId?: string
  target?: EntityRef
  /** Absolute day. Defaults to today + the definition's `defaultOffsetDays`. */
  scheduledForDay?: number
  beat?: ScheduledEventBeat
  payload?: unknown
  /** Overrides the definition's expiry window. */
  expiryDays?: number
  /** Overrides the definition's warning window. */
  warningWindowDays?: number
  origin: {
    source: string
    readable: string
    selectionLabel?: string
  }
  occurrence?: number
  /** Pre-computed key. Mechanical events normally let the definition derive it. */
  exactOnceKey?: string
}

export type ScheduleEventResult =
  | { status: 'scheduled'; record: ScheduledEventRecord }
  | { status: 'duplicate'; existingKey: string }
  | { status: 'rejected'; reason: string }

/**
 * The one sanctioned way to put a future consequence on the calendar.
 *
 * Rejects rather than guesses:
 *   - a `mechanical` request whose type is not registered (an unowned
 *     mechanical promise is precisely `OBL-02`);
 *   - a payload that fails the definition's schema;
 *   - a repeat past the definition's `maxOccurrences`.
 *
 * Returns `duplicate` — without touching state — when the exact-once key
 * has already been honoured.
 */
export function scheduleEvent(
  ctx: SimContext,
  request: ScheduleEventRequest,
): ScheduleEventResult {
  const today = ctx.state.calendar.totalDaysElapsed
  const definition = getScheduledEventDefinition(request.type)
  const kind: ScheduledEventKind =
    request.kind ?? (definition ? 'mechanical' : 'narrative_expectation')

  if (kind === 'mechanical' && !definition) {
    return {
      status: 'rejected',
      reason:
        `mechanical event type '${request.type}' has no registered owner; ` +
        `register it with the owning module or schedule it as a narrative_expectation`,
    }
  }

  if (definition) {
    const parsed = definition.payloadSchema.safeParse(request.payload)
    if (!parsed.success) {
      return {
        status: 'rejected',
        reason: `payload for '${request.type}' failed its schema: ${parsed.error.message}`,
      }
    }
  }

  const occurrence = request.occurrence ?? 1
  if (definition?.repeat && occurrence > definition.repeat.maxOccurrences) {
    return {
      status: 'rejected',
      reason:
        `'${request.type}' occurrence ${occurrence} exceeds maxOccurrences ` +
        `${definition.repeat.maxOccurrences}`,
    }
  }

  const scheduledForDay =
    request.scheduledForDay ?? today + (definition?.defaultOffsetDays ?? 7)
  const expiryDays = request.expiryDays ?? definition?.expiryDays ?? 7
  const warningWindowDays =
    request.warningWindowDays ?? definition?.warningWindowDays ?? 0
  const beat: ScheduledEventBeat =
    request.beat ?? definition?.beat ?? 'wrap_up'

  const exactOnceKey =
    request.exactOnceKey ??
    definition?.exactOnceKey({
      type: request.type,
      ...(request.target ? { target: request.target } : {}),
      scheduledForDay,
      payload: request.payload,
    }) ??
    // Narrative expectations have no definition to derive a key, so the
    // fallback keys on what makes one expectation the same promise as
    // another: its type, its target, and the day it is due.
    defaultExactOnceKey(request.type, request.target, scheduledForDay)

  const slice = readScheduledEventsSlice(ctx.state)
  if (isExactOnceKeyHonoured(slice, exactOnceKey)) {
    return { status: 'duplicate', existingKey: exactOnceKey }
  }

  const record: ScheduledEventRecord = {
    id: `sched-${today}-${slice.nextEventSuffix}`,
    type: request.type,
    kind,
    ownerModuleId:
      definition?.ownerModuleId ?? request.ownerModuleId ?? 'unowned',
    exactOnceKey,
    ...(request.target ? { target: request.target } : {}),
    scheduledForDay,
    beat,
    ...(warningWindowDays > 0
      ? { warnFromDay: scheduledForDay - warningWindowDays }
      : {}),
    expiresAfterDay: scheduledForDay + expiryDays,
    payload: request.payload ?? null,
    status: 'scheduled',
    occurrence,
    createdOnDay: today,
    origin: request.origin,
  }

  writeScheduledEventsSlice(
    ctx,
    (current) => ({
      ...current,
      queue: [...current.queue, record],
      nextEventSuffix: current.nextEventSuffix + 1,
      totals: { ...current.totals, scheduled: current.totals.scheduled + 1 },
    }),
    'schedule',
  )

  // Supersession (§1.1). A newly-scheduled event withdraws the live events
  // it declares itself to replace, for the same target — so "the eviction
  // notice" replaces "the eviction warning" instead of both firing and
  // double-charging the player for one situation.
  if (definition?.supersedes && definition.supersedes.length > 0) {
    const supersedes = new Set(definition.supersedes)
    cancelScheduledEvents(
      ctx,
      (other) =>
        other.id !== record.id &&
        supersedes.has(other.type) &&
        sameTargetRef(other.target, record.target),
      `superseded by ${record.type}`,
      'superseded',
    )
  }

  return { status: 'scheduled', record }
}

function sameTargetRef(
  a: EntityRef | undefined,
  b: EntityRef | undefined,
): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.kind === b.kind && a.id === b.id
}

export function defaultExactOnceKey(
  type: string,
  target: EntityRef | undefined,
  scheduledForDay: number,
): string {
  const targetPart = target ? `${target.kind}:${target.id}` : 'none'
  return `${type}|${targetPart}|${scheduledForDay}`
}

/**
 * Withdraw live events. Used by supersession, by `cancelledBy`, and by any
 * domain that lets the player earn a promised consequence away — which is
 * the player capability half of §1.1 that later phases hang actions on.
 */
export function cancelScheduledEvents(
  ctx: SimContext,
  match: (record: ScheduledEventRecord) => boolean,
  reason: string,
  status: 'cancelled' | 'superseded' = 'cancelled',
): ScheduledEventRecord[] {
  const slice = readScheduledEventsSlice(ctx.state)
  const today = ctx.state.calendar.totalDaysElapsed
  const hits = slice.queue.filter(
    (record) =>
      (record.status === 'scheduled' || record.status === 'warned') &&
      match(record),
  )
  if (hits.length === 0) return []

  const hitIds = new Set(hits.map((r) => r.id))
  const outcomes: ScheduledEventOutcomeRecord[] = hits.map((record) => ({
    eventId: record.id,
    type: record.type,
    kind: record.kind,
    ownerModuleId: record.ownerModuleId,
    status,
    resolvedOnDay: today,
    readable: record.origin.readable,
    mutations: [],
    reason,
    originLabel: record.origin.selectionLabel ?? record.origin.source,
  }))

  writeScheduledEventsSlice(
    ctx,
    (current) => ({
      ...current,
      queue: current.queue.filter((record) => !hitIds.has(record.id)),
      resolvedToday: [...current.resolvedToday, ...outcomes],
      archive: capArchive([...current.archive, ...outcomes]),
      // A cancelled promise did NOT happen, so its key is deliberately
      // left unspent: the same obligation may legitimately be scheduled
      // again later. Only a fired (or expired) event burns its key.
      totals:
        status === 'cancelled'
          ? {
              ...current.totals,
              cancelled: current.totals.cancelled + hits.length,
            }
          : {
              ...current.totals,
              superseded: current.totals.superseded + hits.length,
            },
    }),
    `cancel_${status}`,
  )

  return hits
}

/** Mark a warned event as seen by the player. Drives "you were told" reporting. */
export function acknowledgeScheduledEvent(
  ctx: SimContext,
  eventId: string,
): boolean {
  const slice = readScheduledEventsSlice(ctx.state)
  const record = slice.queue.find((r) => r.id === eventId)
  if (!record || record.acknowledgedOnDay !== undefined) return false
  const today = ctx.state.calendar.totalDaysElapsed
  writeScheduledEventsSlice(
    ctx,
    (current) => ({
      ...current,
      queue: current.queue.map((r) =>
        r.id === eventId ? { ...r, acknowledgedOnDay: today } : r,
      ),
    }),
    'acknowledge',
  )
  return true
}

/** Live events, optionally filtered to one beat. */
export function getLiveScheduledEvents(
  state: TavernState,
  beat?: ScheduledEventBeat,
): ScheduledEventRecord[] {
  return readScheduledEventsSlice(state).queue.filter(
    (record) =>
      (record.status === 'scheduled' || record.status === 'warned') &&
      (beat === undefined || record.beat === beat),
  )
}

/**
 * Events the player has been warned about but that have not fired.
 * This is the discoverability half of §1.1 — the reason a promised
 * consequence is knowable before it lands.
 */
export function getWarnedScheduledEvents(
  state: TavernState,
): ScheduledEventRecord[] {
  return readScheduledEventsSlice(state).queue.filter(
    (record) => record.status === 'warned',
  )
}

export function capArchive(
  archive: ScheduledEventOutcomeRecord[],
): ScheduledEventOutcomeRecord[] {
  if (archive.length <= MAX_ARCHIVED_OUTCOMES) return archive
  return archive.slice(archive.length - MAX_ARCHIVED_OUTCOMES)
}

/**
 * §5.11 bounded growth for the exact-once ledger.
 *
 * Keys are dropped once they are older than `EXACT_ONCE_RETENTION_DAYS`
 * (with a hard cap behind it). This is a deliberate trade: a key that has
 * been spent for half a year can in principle be re-scheduled, but no
 * reload, retry, import or segment-resume sequence spans that gap, and an
 * unbounded ledger would grow the save forever. The window is a named
 * constant so a later phase can lengthen it with evidence.
 */
export function pruneSpentKeys(
  spentKeys: Array<{ key: string; day: number }>,
  today: number,
): Array<{ key: string; day: number }> {
  const cutoff = today - EXACT_ONCE_RETENTION_DAYS
  const fresh = spentKeys.filter((entry) => entry.day >= cutoff)
  if (fresh.length <= MAX_EXACT_ONCE_KEYS) return fresh
  return fresh.slice(fresh.length - MAX_EXACT_ONCE_KEYS)
}
