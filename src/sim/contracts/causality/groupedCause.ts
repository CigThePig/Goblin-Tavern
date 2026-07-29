import type { SimContext } from '../../core/context'
import type { CauseEntry, EntityRef } from '../../state/TavernState'
import type {
  CauseDirection,
  CauseDraft,
  CauseSourceType,
  CauseTargetType,
} from '../../modules/causes/causeTypes'

import { groupedTarget } from './groupedTargets'

// Expansion Phase 1 §1.4 — sanctioned helpers for the causal classes that
// currently have no cause at all.
//
// The Phase 0 baseline recorded four families of material change that move
// state without leaving attribution behind:
//
//   1. high-volume homogeneous drift (daily rumour/memory decay) — too many
//      to attribute one-by-one, so today they are attributed not at all;
//   2. arc and venture lifecycle (created, stage advanced, status changed);
//   3. permanent transformations, which by definition can never be undone
//      and so are the changes MOST in need of a recorded why;
//   4. scheduled events, which had no link from the event that fired to the
//      cause it produced.
//
// Each gets one helper below. They are thin — they build a `CauseDraft` and
// call `ctx.addCause` — but being named and shared is the point: it is what
// stops the next domain inventing a fifth convention.

export type GroupedCauseInput = {
  source: string
  sourceType: CauseSourceType
  /** The collection kind: `rumour`, `memory`, `stock`, `staff`… */
  targetKind: string
  targetType: CauseTargetType
  /** Every element the change touched. Named in the target when small enough. */
  targetIds: ReadonlyArray<string>
  /** Total magnitude across the whole group, not per element. */
  totalAmount: number
  direction: CauseDirection
  /**
   * One line covering the whole group. Must carry the COUNT, because the
   * target string degrades to a wildcard above
   * `MAX_NAMED_GROUP_MEMBERS` and the readable is then the only place the
   * scale of the change survives.
   */
  readable: string
  tags?: string[]
  relatedSystems?: string[]
  expiresAfterDays?: number
}

/**
 * One cause for a homogeneous change across many elements of one
 * collection.
 *
 * Weight is the TOTAL magnitude, so a day where fifteen rumours each faded
 * a little ranks against a day where one rumour collapsed — which is the
 * comparison a player reading "why is my reputation moving?" actually
 * needs.
 */
export function addGroupedCause(
  ctx: SimContext,
  input: GroupedCauseInput,
): CauseEntry | undefined {
  if (input.targetIds.length === 0) return undefined
  const draft: CauseDraft = {
    source: input.source,
    sourceType: input.sourceType,
    target: groupedTarget(input.targetKind, input.targetIds),
    targetType: input.targetType,
    amount: input.totalAmount,
    direction: input.direction,
    weight: Math.abs(input.totalAmount),
    readable: input.readable,
    tags: [
      'grouped',
      `group_size:${input.targetIds.length}`,
      ...(input.tags ?? []),
    ],
    ...(input.relatedSystems ? { relatedSystems: input.relatedSystems } : {}),
    ...(input.expiresAfterDays !== undefined
      ? { expiresAfterDays: input.expiresAfterDays }
      : {}),
  }
  return ctx.addCause(draft)
}

export type LifecycleKind =
  | 'venture'
  | 'arc'
  | 'transformation'
  | 'obligation'
  | 'scheduled_event'

export type LifecycleChange =
  | 'created'
  | 'stage_changed'
  | 'status_changed'
  | 'completed'
  | 'abandoned'
  /** Irreversible. The tavern is permanently different from here on. */
  | 'transformed'

/**
 * A cause for a lifecycle step on a long-lived entity.
 *
 * `weight` is deliberately NOT derived from a numeric amount: an arc
 * advancing a stage has no natural magnitude, but it matters more than a
 * one-point meter twitch. A permanent transformation weighs most of all,
 * because it is the one change the player can never walk back.
 */
export function addLifecycleCause(
  ctx: SimContext,
  input: {
    kind: LifecycleKind
    id: string
    change: LifecycleChange
    source: string
    sourceType?: CauseSourceType
    readable: string
    /** Old → new, when the step is a stage/status move. */
    from?: string
    to?: string
    tags?: string[]
    relatedActors?: EntityRef[]
    relatedLocations?: EntityRef[]
    relatedSystems?: string[]
  },
): CauseEntry {
  const weight =
    input.change === 'transformed'
      ? 100
      : input.change === 'created' || input.change === 'completed'
        ? 40
        : 20

  return ctx.addCause({
    source: input.source,
    sourceType: input.sourceType ?? 'system',
    target: `${input.kind}:${input.id}`,
    targetType: 'global',
    amount: 0,
    direction: 'neutral',
    weight,
    readable: input.readable,
    tags: [
      'lifecycle',
      input.kind,
      input.change,
      ...(input.from ? [`from:${input.from}`] : []),
      ...(input.to ? [`to:${input.to}`] : []),
      ...(input.change === 'transformed' ? ['permanent'] : []),
      ...(input.tags ?? []),
    ],
    ...(input.relatedActors ? { relatedActors: input.relatedActors } : {}),
    ...(input.relatedLocations
      ? { relatedLocations: input.relatedLocations }
      : {}),
    ...(input.relatedSystems ? { relatedSystems: input.relatedSystems } : {}),
  })
}

/**
 * The tag that links a cause back to the scheduled event that produced it.
 *
 * §1.4 asks for "event-to-cause links". Rather than adding a field to
 * `CauseEntry` (a state-schema change every save would have to migrate for
 * a debug affordance), the link rides in the tag list under a reserved
 * prefix. `causesForScheduledEvent` reads it back.
 */
export const EVENT_LINK_TAG_PREFIX = 'event:'

export function eventLinkTag(eventId: string): string {
  return `${EVENT_LINK_TAG_PREFIX}${eventId}`
}

export function causesForScheduledEvent(
  causes: ReadonlyArray<CauseEntry>,
  eventId: string,
): CauseEntry[] {
  const tag = eventLinkTag(eventId)
  return causes.filter((cause) => cause.tags.includes(tag))
}

/** The event id a cause was produced by, if any. */
export function scheduledEventIdForCause(cause: CauseEntry): string | undefined {
  const tag = cause.tags.find((t) => t.startsWith(EVENT_LINK_TAG_PREFIX))
  return tag?.slice(EVENT_LINK_TAG_PREFIX.length)
}
