// Phase 121 / ISSUE-090 — Living Cast arc, Phase A.
//
// Bounded, serializable attributes that staff and regulars carry as
// SELECTION VOCABULARY for the future card composition layer. No prose
// lives here — these are ids and small scalars. See
// `docs/plans/living-cast-arc.md` Phase A for intent, and
// `docs/plans/card-composition-framework.md §2.3` for the forward seam
// (the `actorTrait` SnippetCondition that will eventually read these
// fields).
//
// Architectural notes:
// - Every field is JSON-serializable. No functions, no Maps, no class
//   instances. The shape is identical for staff and regulars so the
//   compose-layer assembler can treat both uniformly.
// - `VoiceAxisId` is a hard TypeScript union (the union IS the v1
//   registry). `verbalTic` is registry-validated so Phase B can add or
//   rename a tic with one line of data.
// - All scalar values are bounded (axes ∈ {0, 1, 2}, affinity strength
//   ∈ {1, 2}, polarity is a fixed enum). The arc's hard lesson is that
//   open-ended freeform tags are unselectable at scale.

export type VoiceAxisId = 'terseness' | 'warmth' | 'formality' | 'floridity'

export type VoiceAxisValue = 0 | 1 | 2

export type VerbalTicId = string

export type VoiceProfile = {
  axes: Record<VoiceAxisId, VoiceAxisValue>
  verbalTic?: VerbalTicId
}

export type AffinityPolarity = 'toward' | 'away'

export type AffinityStrength = 1 | 2

export type AffinityAxis = {
  target: string
  polarity: AffinityPolarity
  strength: AffinityStrength
}

export type CastAttributes = {
  specialty: string
  blindspot: string
  affinities: AffinityAxis[]
  voice: VoiceProfile
}
