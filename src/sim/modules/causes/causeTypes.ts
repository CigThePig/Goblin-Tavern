import type { CalendarStamp, EntityRef } from '../../state/TavernState'

// Phase 17 §"Cause Shape" — supporting types for the cause-tracking
// pipeline.
//
// `CauseDraft` is the input shape modules pass to `ctx.addCause` and to
// the upgraded mutation helpers (`ctx.modifyArea`, `ctx.modifyStock`,
// etc.). The engine fills in defaults (calendar stamp, age, weight,
// sourceType when omitted) when it stores the cause on state.
//
// `CauseEntry` is the canonical on-state shape; it lives in
// `state/TavernState.ts` so the Zod schema can validate it, and is
// re-exported here for module-author convenience.

// Phase 27 §27.2 — Cause type expansion (canonical home in
// `state/TavernState.ts`). Mirror the same unions here so module
// authors can import either path interchangeably without a circular
// dependency.
export type CauseSourceType =
  | 'owner_action'
  | 'service'
  | 'area'
  | 'stock'
  | 'staff'
  | 'customer'
  | 'weekly'
  | 'monthly'
  | 'memory'
  | 'pressure'
  | 'system'
  | 'culture'
  | 'faction'
  | 'supplier'
  | 'regular'
  | 'local_event'
  | 'rumour'

export type CauseTargetType =
  | 'coin'
  | 'area'
  | 'stock'
  | 'staff'
  | 'customer'
  | 'reputation'
  | 'pressure'
  | 'memory'
  | 'global'
  | 'culture'
  | 'faction'
  | 'supplier'
  | 'regular'
  | 'notable_npc'
  | 'local_event'
  | 'rumour'
  | 'tavern_identity'

export type CauseDirection = 'increase' | 'decrease' | 'neutral'

/**
 * Phase 17 §17.2 / §17.2.1 — input shape for `ctx.addCause` and for the
 * upgraded `ctx.modify*` helpers.
 *
 * `source` is the only field every caller must provide. `readable` is the
 * canonical human-readable label; the legacy `reason` field is accepted
 * for backwards compatibility with the Phase 7 §7.3.1 `MutationMeta`
 * placeholder and is treated as the readable string when no explicit
 * `readable` is set.
 *
 * The remaining fields are optional and are filled in by the engine
 * when omitted: missing `targetType`/`target` are inferred from the
 * mutation helper, missing `sourceType` is inferred from the source
 * prefix, missing `weight` defaults to the absolute amount, missing
 * `direction` derives from `amount`, and missing `expiresAfterDays`
 * uses the engine default.
 */
export type CauseDraft = {
  source: string
  /** Backwards-compatible alias for `readable` (Phase 7 placeholder). */
  reason?: string
  readable?: string
  sourceType?: CauseSourceType
  target?: string
  targetType?: CauseTargetType
  amount?: number
  direction?: CauseDirection
  weight?: number
  tags?: string[]
  relatedActors?: EntityRef[]
  relatedLocations?: EntityRef[]
  relatedSystems?: string[]
  expiresAfterDays?: number
}

export type { CalendarStamp, EntityRef }
