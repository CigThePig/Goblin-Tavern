import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { EntityRef } from '../../state/TavernState'
import type { CauseDraft } from '../../modules/causes/causeTypes'
import type { MemoryDraft } from '../../modules/memories/memoryTypes'
import type { HistoryEntryDraft } from '../../modules/history/types'

// Expansion Phase 1 §1.1 — typed scheduled events and future consequences.
//
// THE PROBLEM THIS REPLACES. A response profile could declare a
// "future hook" as an opaque string (`staff_quit_risk_mira`,
// `loan_due_soon`, `eviction_threat_possible`). The responses module
// queued it, drained it on its scheduled day, and — because no domain
// owned the string — resolved it by writing a zero-weight cause or a
// memory draft and nothing else. Ninety-odd hook families promised the
// player a concrete future event; none of them happened. That is
// obligation `OBL-02`, and every `HOOK-*` row in
// `docs/plans/expansion/ledger.csv` is one instance of it.
//
// THE FIX IS TYPED OWNERSHIP, NOT MORE STRINGS. A *mechanical* scheduled
// event must be registered by exactly one owning module, carry a payload
// schema, and resolve through that module's own resolver into an
// authoritative mutation. Anything that is only a story beat is a
// `narrative_expectation`: a distinct kind that is still tracked,
// acknowledged and expired, but that makes no mechanical promise. Phase 1
// builds this machinery and reclassifies today's hooks honestly; Phases
// 2-11 move family after family from narrative to mechanical as the
// owning domain gains the power to deliver on them.

export type ScheduledEventKind = 'mechanical' | 'narrative_expectation'

/**
 * The day beat an event resolves on.
 *
 * `morning` runs inside `startDay`, before the player plans — so an event
 * that changes what the player can do today (a debt falling due, an
 * inspector arriving) is visible in the morning they must react to it.
 *
 * `wrap_up` runs in the `resolveScheduledEvents` phase, immediately after
 * `applyResponses` and before `endDay` — so an event that is a
 * consequence OF today (a promise coming due after the day's choices, a
 * grace period running out) sees the day's decisions before it fires.
 *
 * Both beats sit inside existing day segments (`morning` in segment A,
 * `wrap_up` in segment C), so adding them moved no segment boundary.
 */
export type ScheduledEventBeat = 'morning' | 'wrap_up'

/** What to do when the event's target entity no longer exists on the day it fires. */
export type MissingTargetBehavior =
  /** Drop the event with a recorded reason. A staff grudge against a departed cook. */
  | 'cancel'
  /** Fire anyway; the resolver copes with an absent target. A debt outlives the lender. */
  | 'resolve_anyway'

export type ScheduledEventStatus =
  | 'scheduled'
  /** Inside its warning window: the player has been told it is coming. */
  | 'warned'
  | 'resolved'
  /**
   * Fired, and correctly changed nothing — with a recorded reason. This is
   * a DISTINCT terminal status rather than a `resolved` record with an
   * empty mutation manifest, because the two must not be confusable: an
   * explained no-op is correct behaviour, an unexplained one is the
   * drained-without-firing bug (`OBL-02`).
   */
  | 'no_op'
  /** Passed its expiry without resolving. */
  | 'expired'
  /** Withdrawn before firing — by the owning domain, or by the player earning it away. */
  | 'cancelled'
  /** A later event of a superseding type replaced it. */
  | 'superseded'
  /** Its exact-once key had already been honoured. Never mutates anything. */
  | 'duplicate_suppressed'

/**
 * One thing the resolver authoritatively changed.
 *
 * The resolver performs its own `ctx.modify*` calls — it belongs to a
 * domain that knows how — and returns this manifest naming what moved.
 * It exists so "an event resolved without an authoritative mutation"
 * (§1.1) is a checkable condition rather than a hope: a `resolved`
 * outcome with an empty manifest is a validation failure, and a
 * zero-weight cause does NOT count as a mutation.
 */
export type ScheduledEventMutation = {
  targetKind: string
  targetId: string
  /** The state field that moved, when the change is field-level. */
  field?: string
  readable: string
}

export type ScheduledEventResolution =
  | {
      status: 'resolved'
      /** Must be non-empty. See `ScheduledEventMutation`. */
      mutations: ScheduledEventMutation[]
      readable: string
      cause?: CauseDraft
      memory?: MemoryDraft
      history?: HistoryEntryDraft
      pressures?: Array<{ id: string; change: number; cause: CauseDraft }>
      /** Re-arm this many days out. Bounded by the definition's `repeat`. */
      repeatInDays?: number
    }
  /**
   * The event fired and correctly did nothing — the debt was already
   * settled, the room was already repaired. `reason` is mandatory: an
   * unexplained no-op is indistinguishable from a broken promise, which
   * is the bug this whole section exists to prevent.
   */
  | { status: 'no_op'; reason: string; readable: string }
  | { status: 'cancelled'; reason: string; readable: string }
  | {
      status: 'rescheduled'
      toDay: number
      reason: string
      readable: string
    }

export type ScheduledEventResolver = (
  ctx: SimContext,
  record: ScheduledEventRecord,
) => ScheduledEventResolution

/**
 * A registered mechanical event type. Registration is the ONLY way an
 * event gets mechanical authority; the registry rejects a second module
 * claiming the same type.
 */
export type ScheduledEventDefinition = {
  /** Event type id. Also the registry key. */
  type: string
  kind: 'mechanical'
  /** The single module that owns this transition (§5.4). */
  ownerModuleId: string
  label: string
  /** Payload schema. Validated at schedule time so a bad payload fails at the producer, not days later. */
  payloadSchema: z.ZodType<unknown>
  beat: ScheduledEventBeat
  /** Days from scheduling to firing when the producer does not say. */
  defaultOffsetDays: number
  /** Days before firing that the event becomes visible as `warned`. 0 = no warning. */
  warningWindowDays: number
  /** Days after `scheduledForDay` before an unresolved event expires. */
  expiryDays: number
  /** Repeat policy. Omit for one-shot events. */
  repeat?: {
    everyDays: number
    /** Total firings including the first. Bounded growth (§5.11). */
    maxOccurrences: number
  }
  /** Event types this one replaces when both are live for the same target. */
  supersedes?: ReadonlyArray<string>
  /** Types whose resolution cancels a live event of this type. */
  cancelledBy?: ReadonlyArray<string>
  missingTarget: MissingTargetBehavior
  /**
   * Deterministic exact-once key. Same logical promise ⇒ same key, so a
   * retry, a reload, an import, or a resumed segment cannot fire it twice.
   * Must not include the current day unless the event is genuinely
   * per-day.
   */
  exactOnceKey: (input: {
    type: string
    target?: EntityRef
    scheduledForDay: number
    payload: unknown
  }) => string
  resolve: ScheduledEventResolver
  /**
   * Adapter for the response future-hook bridge (§1.1).
   *
   * A response profile declares a future hook by NAME and may attach opaque
   * producer metadata, but it does not build the event payload or target. If
   * that name is this event type, only the owning domain knows how to validate
   * the metadata and turn "the hook fired" into a valid payload, so the owner
   * supplies the adapter and the bridge never guesses. Return `undefined` to
   * decline (the hook then stays a narrative expectation).
   *
   * Omit it entirely when the event type is never named by a response
   * hook — the obligation events, for instance, are always scheduled by
   * the domain that opened the obligation.
   */
  fromFutureHook?: (input: {
    hookName: string
    readable: string
    scheduledForDay: number
    /** Structured producer context carried by a MemoryDraft future hook. */
    metadata?: Record<string, unknown>
  }) => { payload: unknown; target?: EntityRef } | undefined

  /**
   * Hook-name PREFIXES this type claims, for parameterised hook families.
   *
   * Expansion Phase 2 §2.2. Phase 1's bridge matched a hook name against the
   * event-type key exactly, which works for a fixed name
   * (`failed_patch_possible`) but not for the many families that carry their
   * subject in the name (`area_collapse_risk_main_room`,
   * `staff_quit_risk_mira`, `supplier_retaliation_*`). Those families are the
   * majority of the `HOOK-*` ledger rows, so every later phase would have hit
   * the same wall.
   *
   * The prefix is a CLAIM, not a parse: the owning domain still supplies
   * `fromFutureHook`, still turns the name into a validated payload, and still
   * declines by returning `undefined`. Longest prefix wins, so a general family
   * cannot shadow a more specific one, and exact type matches are tried first.
   */
  futureHookPrefixes?: ReadonlyArray<string>
}

/** A queued event on state. One shape for both kinds so the drain walks one list. */
export type ScheduledEventRecord = {
  id: string
  type: string
  kind: ScheduledEventKind
  /** `responses` for a narrative expectation; the registered owner for a mechanical event. */
  ownerModuleId: string
  exactOnceKey: string
  target?: EntityRef
  scheduledForDay: number
  beat: ScheduledEventBeat
  /** First day the event shows as `warned`. Absent when there is no warning window. */
  warnFromDay?: number
  /** Last day the event may resolve on. */
  expiresAfterDay: number
  payload: unknown
  status: ScheduledEventStatus
  /** 1-based firing counter for repeating events. */
  occurrence: number
  createdOnDay: number
  /** Set when the player has seen the warning. Drives "you were told" reporting. */
  acknowledgedOnDay?: number
  origin: {
    source: string
    readable: string
    /** The player's own wording for the choice that promised this, when it came from a response. */
    selectionLabel?: string
  }
}

/** An event that finished, kept for the day's report and the audit trail. */
export type ScheduledEventOutcomeRecord = {
  eventId: string
  type: string
  kind: ScheduledEventKind
  ownerModuleId: string
  status: Exclude<ScheduledEventStatus, 'scheduled' | 'warned'>
  resolvedOnDay: number
  readable: string
  /** Non-empty for `resolved`; empty for every other status. */
  mutations: ScheduledEventMutation[]
  /** Mandatory for every status except `resolved`. */
  reason?: string
  originLabel: string
}

export const SCHEDULED_EVENTS_MODULE_ID = 'scheduledEvents'

/**
 * §5.11 bounded growth for every persistent collection here.
 *
 * The queue cap is a real backstop: a repeating event whose owner forgets
 * `maxOccurrences`, or a response family that fires every day, would
 * otherwise grow the save without limit. Hitting a cap is a validation
 * issue, not a silent trim — see `scheduledEventsModule.validate`.
 */
export const MAX_QUEUED_EVENTS = 400
export const MAX_ARCHIVED_OUTCOMES = 200
export const MAX_EXACT_ONCE_KEYS = 512
/**
 * How long a spent exact-once key is remembered. Long enough that no
 * realistic reload/import/retry sequence can slip a duplicate past it,
 * short enough that a long campaign's save stays bounded.
 */
export const EXACT_ONCE_RETENTION_DAYS = 180

export type ScheduledEventsModuleState = {
  /** Live events, both kinds, ordered by insertion. */
  queue: ScheduledEventRecord[]
  /** Outcomes from today only (cleared each `startDay`). Feeds the report. */
  resolvedToday: ScheduledEventOutcomeRecord[]
  /** Bounded archive of outcomes across days. */
  archive: ScheduledEventOutcomeRecord[]
  /** Spent exact-once keys with the day they were spent. */
  spentKeys: Array<{ key: string; day: number }>
  /** Monotonic suffix for minting record ids. */
  nextEventSuffix: number
  /** Lifetime counters, for sanity checks and the obligation audit. */
  totals: {
    scheduled: number
    resolved: number
    expired: number
    cancelled: number
    superseded: number
    duplicatesSuppressed: number
    noOps: number
  }
}

// ---------- Schemas (§5.7: persisted field, schema in the same phase) ----------

const EntityRefSchema = z.object({
  kind: z.string(),
  id: z.string(),
})

const ScheduledEventMutationSchema = z.object({
  targetKind: z.string(),
  targetId: z.string(),
  field: z.string().optional(),
  readable: z.string(),
})

export const ScheduledEventRecordSchema = z.object({
  id: z.string(),
  type: z.string(),
  kind: z.enum(['mechanical', 'narrative_expectation']),
  ownerModuleId: z.string(),
  exactOnceKey: z.string(),
  target: EntityRefSchema.optional(),
  scheduledForDay: z.number().int(),
  beat: z.enum(['morning', 'wrap_up']),
  warnFromDay: z.number().int().optional(),
  expiresAfterDay: z.number().int(),
  payload: z.unknown(),
  status: z.enum([
    'scheduled',
    'warned',
    'resolved',
    'no_op',
    'expired',
    'cancelled',
    'superseded',
    'duplicate_suppressed',
  ]),
  occurrence: z.number().int().min(1),
  createdOnDay: z.number().int(),
  acknowledgedOnDay: z.number().int().optional(),
  origin: z.object({
    source: z.string(),
    readable: z.string(),
    selectionLabel: z.string().optional(),
  }),
})

export const ScheduledEventOutcomeRecordSchema = z.object({
  eventId: z.string(),
  type: z.string(),
  kind: z.enum(['mechanical', 'narrative_expectation']),
  ownerModuleId: z.string(),
  status: z.enum([
    'resolved',
    'no_op',
    'expired',
    'cancelled',
    'superseded',
    'duplicate_suppressed',
  ]),
  resolvedOnDay: z.number().int(),
  readable: z.string(),
  mutations: z.array(ScheduledEventMutationSchema),
  reason: z.string().optional(),
  originLabel: z.string(),
})

export const ScheduledEventsModuleStateSchema = z.object({
  queue: z.array(ScheduledEventRecordSchema),
  resolvedToday: z.array(ScheduledEventOutcomeRecordSchema),
  archive: z.array(ScheduledEventOutcomeRecordSchema),
  spentKeys: z.array(z.object({ key: z.string(), day: z.number().int() })),
  nextEventSuffix: z.number().int().min(0),
  totals: z.object({
    scheduled: z.number().int().min(0),
    resolved: z.number().int().min(0),
    expired: z.number().int().min(0),
    cancelled: z.number().int().min(0),
    superseded: z.number().int().min(0),
    duplicatesSuppressed: z.number().int().min(0),
    noOps: z.number().int().min(0),
  }),
})
