import type { EffectPreview, EffectResult } from '../../core/effect'
import type { MemoryDraft } from '../memories/memoryTypes'
import type { ConsequenceProfile } from '../issues/issueSeedTypes'

import type {
  PendingOrigin,
  PendingResponseEntry,
} from './types'
import {
  DEFAULT_DELAYED_EFFECT_OFFSET,
  DEFAULT_FUTURE_HOOK_OFFSET,
  buildPendingFromDelayedEffect,
  buildPendingFromFutureHook,
  buildPendingFromImmediateFutureHook,
  deriveSchedulingFromEffect,
  deriveSchedulingFromMemoryDraft,
  makePendingId,
} from './pendingHelpers'

// Phase 41 / ISSUE-001 — shared profile-iteration logic.
//
// Both the pure resolver and the engine-side `responsesModule` walk a
// consequence profile in the same order and apply the same effect-kind
// dispatch. The differences (mutate-a-clone vs. mutate-via-ctx-helpers)
// are captured in two `EffectApplier` implementations that this module
// drives.
//
// Iteration order, fixed:
//   1. profile.immediateEffects (each effect, in array order)
//      - state_change/pressure/cause/memory → apply now
//      - future_hook                         → enqueue (marker, never "now")
//   2. profile.delayedEffects (each effect, in array order)
//      - any kind                            → enqueue
//   3. profile.memories                      → apply now
//   4. profile.futureHooks                   → enqueue
//
// Each enqueue mints a fresh id using `mintNextPendingId`. The applier
// owns the suffix counter; this module does not assume how it is
// persisted (the engine path stores it on the responses module slice;
// the clone path keeps it in a local closure).

export type ApplyOrigin = PendingOrigin

export type ApplierLog = {
  level: 'info' | 'warn'
  message: string
  data?: Record<string, unknown>
}

export type EffectApplier = {
  /** Absolute day at apply-time. */
  readonly today: number

  /** Mint the next pending id. Implementations bump their suffix. */
  mintNextPendingId(today: number): string

  /** Apply an immediate state-mutating effect. The `state_change` and
   *  `pressure` kinds mutate the relevant slice; `cause` and `memory`
   *  kinds emit / append; `future_hook` is never delivered to this
   *  method (the iterator enqueues it instead). Return the
   *  EffectResult for the report. */
  applyImmediateEffect(effect: EffectPreview, origin: ApplyOrigin): EffectResult

  /** Apply an immediate memory draft (from `profile.memories`). */
  applyMemoryDraft(draft: MemoryDraft, origin: ApplyOrigin): void

  /** Push an entry onto the pending queue. */
  enqueuePending(entry: PendingResponseEntry): void

  /** Record a synthesized cause for the resolver's return shape (and
   *  for cause-coverage). Implementations may also have already
   *  emitted the cause via `applyImmediateEffect` — this is for the
   *  resolver-side `causesAdded` array, not a duplicate emission. */
  recordSynthesizedCause(record: {
    source: string
    target: string
    readable: string
    amount: number
  }): void

  /**
   * Expansion Phase 1 §1.1 — hand a declared future hook to the typed
   * scheduled-event registry.
   *
   * Returns `'mechanical'` when the hook's name resolves to a registered
   * mechanical event type, in which case the OWNING MODULE will resolve it
   * authoritatively and the hook must NOT also go on the responses pending
   * queue — otherwise the same promise would be kept twice. Returns
   * `'narrative'` when no domain owns the name yet: the hook stays on the
   * pending queue exactly as before, and a typed narrative-expectation
   * record is filed alongside it so the promise is at least tracked,
   * acknowledged, expired and countable.
   *
   * Optional because the clone-path applier (used for previews) has no
   * context to write to and must not have side effects.
   */
  routeFutureHook?(input: {
    /** The hook's declared name — a `MemoryDraft.id` or an effect target. */
    hookName: string
    readable: string
    origin: ApplyOrigin
    scheduledForDay: number
    expiresAfterDay: number
    /** Structured context from a declared MemoryDraft future hook. */
    metadata?: Record<string, unknown>
  }): 'mechanical' | 'narrative'

  log(entry: ApplierLog): void
}

export type ApplyResponseProfileResult = {
  appliedEffects: EffectResult[]
  enqueuedPending: PendingResponseEntry[]
}

export function applyResponseProfile(
  profile: ConsequenceProfile,
  origin: ApplyOrigin,
  applier: EffectApplier,
): ApplyResponseProfileResult {
  const appliedEffects: EffectResult[] = []
  const enqueuedPending: PendingResponseEntry[] = []

  // 1. immediateEffects
  for (const preview of profile.immediateEffects) {
    if (preview.kind === 'future_hook') {
      // A future_hook in immediateEffects is a marker — enqueue it.
      //
      // Expansion Phase 1 §1.1 — but first offer the hook name to the typed
      // registry. A registered mechanical owner takes it over entirely; an
      // unowned name is filed as a narrative expectation and still queued
      // here, which is the behaviour every hook had before this phase.
      const schedule = deriveSchedulingFromEffect(
        preview,
        applier.today,
        DEFAULT_DELAYED_EFFECT_OFFSET,
      )
      const routed = applier.routeFutureHook?.({
        hookName: preview.target,
        readable: preview.readable,
        origin,
        scheduledForDay: schedule.scheduledFor,
        expiresAfterDay: schedule.expiresAt,
      })
      if (routed === 'mechanical') {
        appliedEffects.push({
          ...preview,
          applied: false,
          notes: ['scheduled as a mechanical event'],
        })
        continue
      }
      const id = applier.mintNextPendingId(applier.today)
      const entry = buildPendingFromImmediateFutureHook(
        preview,
        origin,
        applier.today,
        id,
      )
      applier.enqueuePending(entry)
      enqueuedPending.push(entry)
      appliedEffects.push({
        ...preview,
        applied: false,
        notes: ['enqueued as future_hook'],
      })
      continue
    }
    const result = applier.applyImmediateEffect(preview, origin)
    appliedEffects.push(result)
    if (result.applied) {
      const causeReadable = result.readable
      const causeTarget = targetForCause(preview)
      const causeAmount = preview.amount ?? 0
      if (preview.kind === 'state_change') {
        applier.recordSynthesizedCause({
          source: `response.${origin.verb}`,
          target: causeTarget,
          readable: causeReadable,
          amount: causeAmount,
        })
      }
    }
  }

  // 2. delayedEffects
  for (const preview of profile.delayedEffects) {
    const id = applier.mintNextPendingId(applier.today)
    const entry = buildPendingFromDelayedEffect(
      preview,
      origin,
      applier.today,
      id,
    )
    applier.enqueuePending(entry)
    enqueuedPending.push(entry)
    appliedEffects.push({
      ...preview,
      applied: false,
      notes: ['delayed', `scheduledFor:${entry.scheduledFor}`],
    })
  }

  // 3. profile.memories
  for (const draft of profile.memories) {
    applier.applyMemoryDraft(draft, origin)
  }

  // 4. profile.futureHooks
  for (const draft of profile.futureHooks) {
    // Expansion Phase 1 §1.1 — route before minting an id, so a hook a
    // mechanical owner takes over does not consume a pending suffix and
    // shift the ids of the hooks that follow it.
    const schedule = deriveSchedulingFromMemoryDraft(
      draft,
      applier.today,
      DEFAULT_FUTURE_HOOK_OFFSET,
    )
    // Actors are structured producer context too. Supplier events in
    // particular need the exact second counterparty selected by the response;
    // reducing the hook to its name would force the resolver to guess later.
    const hookMetadata: Record<string, unknown> = {
      ...(draft.metadata ?? {}),
      ...(draft.actors ? { actors: draft.actors } : {}),
    }
    const routed = applier.routeFutureHook?.({
      hookName: draft.id,
      readable: draft.label ?? draft.id,
      origin,
      scheduledForDay: schedule.scheduledFor,
      expiresAfterDay: schedule.expiresAt,
      ...(Object.keys(hookMetadata).length > 0
        ? { metadata: hookMetadata }
        : {}),
    })
    if (routed === 'mechanical') continue
    const id = applier.mintNextPendingId(applier.today)
    const entry = buildPendingFromFutureHook(draft, origin, applier.today, id)
    applier.enqueuePending(entry)
    enqueuedPending.push(entry)
  }

  return { appliedEffects, enqueuedPending }
}

function targetForCause(preview: EffectPreview): string {
  return preview.target
}

// Re-exported here so callers don't have to import from pendingHelpers
// just to mint a one-off id.
export { makePendingId }
