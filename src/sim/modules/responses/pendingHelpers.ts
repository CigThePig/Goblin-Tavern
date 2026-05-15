import type { EffectPreview } from '../../core/effect'
import type { MemoryDraft } from '../memories/memoryTypes'

import type {
  PendingOrigin,
  PendingPayload,
  PendingResponseEntry,
} from './types'

// Phase 41 / ISSUE-001 — scheduling derivation for pending entries.
//
// Effects and memory drafts do not natively carry a `scheduledFor`.
// Producers may signal a custom schedule:
//   - EffectPreview: include a `delay:N` tag (parsed below).
//   - MemoryDraft: set `metadata.scheduledInDays` and/or
//     `metadata.expiresInDays` to numeric day offsets.
// Otherwise these defaults apply:
//   - `delayedEffects` entries  → +3 days
//   - `futureHooks` entries     → +7 days
//   - `expiresAt`               → `scheduledFor + 7`
// The defaults match the weekly cadence of the surrounding modules
// (weekly accumulators, regulars, faction drift), so a delayed effect
// fires before the week closes and a future hook fires roughly when the
// week resets.

export const DEFAULT_DELAYED_EFFECT_OFFSET = 3
export const DEFAULT_FUTURE_HOOK_OFFSET = 7
export const DEFAULT_EXPIRY_WINDOW = 7

function parseDelayTag(tags: ReadonlyArray<string>): number | undefined {
  for (const tag of tags) {
    if (!tag.startsWith('delay:')) continue
    const n = Number(tag.slice('delay:'.length))
    if (Number.isFinite(n) && n >= 0 && Number.isInteger(n)) return n
  }
  return undefined
}

function readMetadataNumber(
  metadata: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  if (!metadata) return undefined
  const v = metadata[key]
  if (typeof v !== 'number') return undefined
  if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) return undefined
  return v
}

export function deriveSchedulingFromEffect(
  effect: EffectPreview,
  today: number,
  defaultOffset: number,
): { scheduledFor: number; expiresAt: number } {
  const tagged = parseDelayTag(effect.tags)
  const offset = tagged ?? defaultOffset
  const scheduledFor = today + offset
  const expiresAt = scheduledFor + DEFAULT_EXPIRY_WINDOW
  return { scheduledFor, expiresAt }
}

export function deriveSchedulingFromMemoryDraft(
  draft: MemoryDraft,
  today: number,
  defaultOffset: number,
): { scheduledFor: number; expiresAt: number } {
  const metaOffset = readMetadataNumber(draft.metadata, 'scheduledInDays')
  const metaExpiry = readMetadataNumber(draft.metadata, 'expiresInDays')
  const offset = metaOffset ?? defaultOffset
  const scheduledFor = today + offset
  const expiresAt =
    metaExpiry !== undefined
      ? scheduledFor + metaExpiry
      : scheduledFor + DEFAULT_EXPIRY_WINDOW
  return { scheduledFor, expiresAt }
}

/** Build a pending entry id with a stable, deterministic suffix. The
 *  suffix is owned by the responses module slice and bumped on each
 *  enqueue. */
export function makePendingId(today: number, suffix: number): string {
  return `pending-${today}-${suffix}`
}

export function buildPendingFromDelayedEffect(
  effect: EffectPreview,
  origin: PendingOrigin,
  today: number,
  id: string,
): PendingResponseEntry {
  const { scheduledFor, expiresAt } = deriveSchedulingFromEffect(
    effect,
    today,
    DEFAULT_DELAYED_EFFECT_OFFSET,
  )
  const payload: PendingPayload =
    effect.kind === 'memory'
      ? // A delayedEffect built with kind:'memory' is unusual — producers
        // should put memory drafts in `profile.memories` or
        // `profile.futureHooks`. Coerce to a future_hook envelope so the
        // drain at least surfaces the effect; tag with `coerced` so a
        // future audit can flag the producer.
        {
          kind: 'future_hook',
          effect: { ...effect, tags: [...effect.tags, 'coerced_from_memory'] },
        }
      : { kind: effect.kind, effect }
  return {
    id,
    origin,
    scheduledFor,
    expiresAt,
    payload,
  }
}

export function buildPendingFromFutureHook(
  draft: MemoryDraft,
  origin: PendingOrigin,
  today: number,
  id: string,
): PendingResponseEntry {
  const { scheduledFor, expiresAt } = deriveSchedulingFromMemoryDraft(
    draft,
    today,
    DEFAULT_FUTURE_HOOK_OFFSET,
  )
  return {
    id,
    origin,
    scheduledFor,
    expiresAt,
    payload: { kind: 'memory_future_hook', draft },
  }
}

/** An immediate `effect('future_hook', …)` in `immediateEffects` has no
 *  "now" meaning — it is a marker that a hook should fire later. Enqueue
 *  it like a delayed effect. */
export function buildPendingFromImmediateFutureHook(
  effect: EffectPreview,
  origin: PendingOrigin,
  today: number,
  id: string,
): PendingResponseEntry {
  return buildPendingFromDelayedEffect(effect, origin, today, id)
}
