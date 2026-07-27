import { z } from 'zod'

import type { EffectPreview } from '../../core/effect'
import type { MemoryDraft } from '../memories/memoryTypes'

// Phase 41 / ISSUE-001 — Responses module state.
//
// The responses module owns two things:
//   - the unified pending queue: time-shifted effects and future-hook
//     memories that were enqueued by a consequence profile and have not
//     yet fired (or already expired);
//   - per-day bookkeeping for the report (today's resolved intents, the
//     ids of pending entries that fired/expired today) and lifetime
//     counters for sanity checks.
//
// A `PendingResponseEntry` is the canonical shape of a queued effect or
// queued future-hook memory. Both halves of the queue (delayed effects
// and future hooks) share the same envelope so the drain hook only has
// one shape to walk.

export const RESPONSES_MODULE_ID = 'responses'

/** The kind tag carried inside a `PendingPayload`. Mirrors `EffectKind`
 *  plus a distinguishing tag for memory-shaped future hooks so the drain
 *  can dispatch without re-inspecting the payload shape. */
export type PendingPayloadKind =
  | 'state_change'
  | 'pressure'
  | 'cause'
  | 'future_hook'
  | 'memory'
  | 'memory_future_hook'

/** Payload variants. `state_change`, `pressure`, `cause`, and
 *  `future_hook` carry an `EffectPreview`. `memory` and
 *  `memory_future_hook` carry a `MemoryDraft`. */
export type PendingPayload =
  | {
      kind: 'state_change' | 'pressure' | 'cause' | 'future_hook'
      effect: EffectPreview
    }
  | { kind: 'memory'; draft: MemoryDraft }
  | { kind: 'memory_future_hook'; draft: MemoryDraft }

/** Provenance for a pending entry. Drained-applies and report rows both
 *  read this to attribute the effect back to the player choice that
 *  enqueued it. */
export type PendingOrigin = {
  seedId: string
  intentId: string
  profileId: string
  responseSlotId: string
  verb: string
  /** Absolute day the entry was enqueued. */
  enqueuedDay: number
  /**
   * Phase 202 / audit Wave 3 (`P6-COMP-002`) — the choice that promised
   * this, in the player's own wording, captured at enqueue time.
   *
   * It has to live HERE rather than be looked up later: `resolvedToday`
   * is cleared every morning, and a delayed effect fires days after the
   * decision that created it. Without it, "link the later result to its
   * original choice" degrades to "an earlier decision" — which is exactly
   * the unexplained-number problem the finding is about.
   */
  selectionLabel?: string
}

export type PendingResponseEntry = {
  id: string
  origin: PendingOrigin
  /** Absolute day on which the entry should fire. */
  scheduledFor: number
  /** Absolute day after which the entry drops without firing. */
  expiresAt: number
  payload: PendingPayload
  /** Free-form precondition descriptors. The drain hook does not
   *  evaluate these yet — they are reserved for future producers that
   *  want "only fire if X" gating without changing the queue shape. */
  preconditions?: Array<{ kind: string; readable: string }>
}

/**
 * Phase 200 / audit Wave 1 (`P7-EXP-001`) — what became of an intent.
 * `skipped_unaffordable` means the day's earlier responses had already
 * spent the coin this one needed; nothing of its profile was applied.
 * Optional so records written before the wave still parse.
 */
export type ResolvedIntentOutcome = 'applied' | 'skipped_unaffordable'

/** Phase 202 / audit Wave 3 — one drained pending entry, as the report reads it. */
export type DrainedConsequenceRecord = {
  entryId: string
  status: 'applied' | 'expired'
  /** The choice that promised it, in the player's own wording. */
  originLabel: string
  /** What it did (or would have done), from the effect's own preview. */
  readable: string
}

export type ResolvedIntentRecord = {
  intentId: string
  seedId: string
  responseSlotId: string
  profileId: string
  verb: string
  /** Absolute day the intent was resolved. */
  resolvedOn: number
  outcome?: ResolvedIntentOutcome
  /** Player-readable explanation when the outcome is not `applied`. */
  note?: string
  /**
   * Phase 202 / audit Wave 3 (`P6-COMP-001`) — the choice AS THE PLAYER
   * SAW IT. Every confirmation surface used to render `verb`, so "Back
   * Mira against the Ogres" was reported back as `blame`, and four
   * unrelated commitments all as `upgrade`. The label rides on the intent
   * and is stored here, so the sim owns the player-facing summary and the
   * report archive cannot re-derive it wrongly. Optional: intents built
   * outside the card layer (tests, bots) carry no label.
   */
  selectionLabel?: string
  /**
   * The choice's target. Stored as a ref, not a label, so the report
   * resolves the current display name through `resolveEntityLabel`
   * rather than freezing a name that may since have changed.
   */
  targetRef?: { kind: string; id: string }
}

export type ResponsesModuleState = {
  /** Time-shifted effects awaiting their `scheduledFor` day. */
  pending: PendingResponseEntry[]
  /** Intents resolved this day (cleared on startDay). */
  resolvedToday: ResolvedIntentRecord[]
  /** Pending entry ids that fired today (cleared on startDay). */
  appliedFromPendingToday: string[]
  /** Pending entry ids that expired today (cleared on startDay). */
  expiredFromPendingToday: string[]
  /**
   * Phase 202 / audit Wave 3 (`P6-COMP-002`) — what drained today, with
   * enough of each entry to name it. The id arrays above cannot be
   * attributed after the fact: the entry is removed from the queue during
   * the drain, and its id (`pending-<day>-<n>`) carries no origin.
   * Optional so saves written before the wave still load.
   */
  drainedToday?: DrainedConsequenceRecord[]
  /** Lifetime: number of response intents resolved. */
  totalResolved: number
  /** Lifetime: number of pending entries applied. */
  totalApplied: number
  /** Lifetime: number of pending entries that expired without firing. */
  totalExpired: number
  /** Monotonic suffix used when minting pending entry ids. */
  nextPendingSuffix: number
}

export function createInitialResponsesModuleState(): ResponsesModuleState {
  return {
    pending: [],
    resolvedToday: [],
    appliedFromPendingToday: [],
    expiredFromPendingToday: [],
    drainedToday: [],
    totalResolved: 0,
    totalApplied: 0,
    totalExpired: 0,
    nextPendingSuffix: 0,
  }
}

// ---------- Schemas ----------
//
// EffectPreview and MemoryDraft do not have published zod schemas
// elsewhere in the codebase, so the responses module mirrors them
// locally. The mirrors are intentionally narrow (use z.any() for
// metadata bags) — they are validators, not contracts.

const EffectPreviewSchema = z.object({
  kind: z.enum(['state_change', 'memory', 'future_hook', 'cause', 'pressure']),
  target: z.string(),
  amount: z.number().optional(),
  readable: z.string(),
  tags: z.array(z.string()),
})

const MemoryDraftSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  label: z.string().optional(),
  strength: z.number().optional(),
  durationDays: z.number().optional(),
  decayRate: z.number().optional(),
  actors: z.array(z.any()).optional(),
  locations: z.array(z.any()).optional(),
  relatedSystems: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

const PendingPayloadSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('state_change'),
    effect: EffectPreviewSchema,
  }),
  z.object({
    kind: z.literal('pressure'),
    effect: EffectPreviewSchema,
  }),
  z.object({
    kind: z.literal('cause'),
    effect: EffectPreviewSchema,
  }),
  z.object({
    kind: z.literal('future_hook'),
    effect: EffectPreviewSchema,
  }),
  z.object({
    kind: z.literal('memory'),
    draft: MemoryDraftSchema,
  }),
  z.object({
    kind: z.literal('memory_future_hook'),
    draft: MemoryDraftSchema,
  }),
])

const PendingOriginSchema = z.object({
  seedId: z.string(),
  intentId: z.string(),
  profileId: z.string(),
  responseSlotId: z.string(),
  verb: z.string(),
  enqueuedDay: z.number().int(),
  selectionLabel: z.string().optional(),
})

const PendingResponseEntrySchema = z.object({
  id: z.string(),
  origin: PendingOriginSchema,
  scheduledFor: z.number().int(),
  expiresAt: z.number().int(),
  payload: PendingPayloadSchema,
  preconditions: z
    .array(z.object({ kind: z.string(), readable: z.string() }))
    .optional(),
})

const ResolvedIntentRecordSchema = z.object({
  intentId: z.string(),
  seedId: z.string(),
  responseSlotId: z.string(),
  profileId: z.string(),
  verb: z.string(),
  resolvedOn: z.number().int(),
  // Wave 1 outcome + Wave 3 player-facing wording. Listed so a zod parse
  // does not strip them out of a loaded save.
  outcome: z.enum(['applied', 'skipped_unaffordable']).optional(),
  note: z.string().optional(),
  selectionLabel: z.string().optional(),
  targetRef: z.object({ kind: z.string(), id: z.string() }).optional(),
})

export const ResponsesModuleStateSchema = z.object({
  pending: z.array(PendingResponseEntrySchema),
  resolvedToday: z.array(ResolvedIntentRecordSchema),
  appliedFromPendingToday: z.array(z.string()),
  expiredFromPendingToday: z.array(z.string()),
  drainedToday: z
    .array(
      z.object({
        entryId: z.string(),
        status: z.enum(['applied', 'expired']),
        originLabel: z.string(),
        readable: z.string(),
      }),
    )
    .optional(),
  totalResolved: z.number().int().min(0),
  totalApplied: z.number().int().min(0),
  totalExpired: z.number().int().min(0),
  nextPendingSuffix: z.number().int().min(0),
})
