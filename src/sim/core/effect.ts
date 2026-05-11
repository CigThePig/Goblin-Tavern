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

export type EffectPreview = {
  kind: EffectKind
  target: string
  amount?: number
  readable: string
  tags: string[]
}

export type EffectResult = EffectPreview & {
  applied: boolean
  notes?: string[]
}
