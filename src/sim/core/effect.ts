// Phase 17 §"Required Outputs" — Effect placeholder.
//
// Phase 19 introduces consequence profiles and response resolvers that
// emit `EffectPreview` and `EffectResult` records. Phase 17 only needs
// the type surface so other modules can import it; the actual effect
// machinery lands in Phase 19's `consequenceProfiles.ts` /
// `impactScoring.ts`.

export type EffectKind =
  | 'state_change'
  | 'memory'
  | 'future_hook'
  | 'cause'
  | 'pressure'

// Phase 145 / ISSUE-113 — Voiced Surface arc, Phase 18 (iteration 2).
//
// Structured per-effect metadata derived from `target` and `amount` by
// the `effect()` constructor in `generatorHelpers.ts`. Lets snippet
// conditions in the card layer gate on what kind of meter changed and
// which way it moved, without re-parsing the target string at condition
// time. All three fields are optional so older serialized seeds remain
// valid; `effect()` always populates them on new emissions.
export type EffectTargetKind =
  | 'coin'
  | 'stock'
  | 'area'
  | 'customer'
  | 'staff'
  | 'pressure'
  | 'memory'
  | 'reputation'
  | 'cohort'
  | 'supplier'
  | 'faction'
  | 'culture'
  | 'arc'
  | 'attribution'
  | 'global'
  | 'other'

export type EffectDirection = 'positive' | 'negative' | 'neutral'

export type EffectMagnitudeBand = 'tiny' | 'small' | 'medium' | 'large'

export type EffectPreview = {
  kind: EffectKind
  target: string
  amount?: number
  readable: string
  tags: string[]
  /** Structural classification of `target`. Populated by `effect()`. */
  targetKind?: EffectTargetKind
  /** Sign of `amount`. `undefined`/`0` resolve to `'neutral'`. */
  direction?: EffectDirection
  /** Banded magnitude (cutoffs vary by targetKind). `undefined` when
   *  amount is missing or 0. */
  magnitudeBand?: EffectMagnitudeBand
}

export type EffectResult = EffectPreview & {
  applied: boolean
  notes?: string[]
}
