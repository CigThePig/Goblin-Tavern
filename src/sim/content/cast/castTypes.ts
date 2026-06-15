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
  // Phase 4a (teleology) — optional link from a cast member to a staged
  // arc entry in `state.arcs`. An arc is a trajectory tracked *alongside*
  // the existing 0–100 loyalty meter, never a replacement for it; absence
  // means the character carries no arc yet. The reverse lookup (arc →
  // subject) lives on the arc entry's `subject:<castId>` tag.
  arcId?: string
}

// Phase 128 / ISSUE-097 — Voiced Surface Phase 2 (Universal Cast).
//
// Per-actor cast attribute aliases. Suppliers, factions, and notable NPCs
// each carry the full shape so their cards can voice through the same
// specialty/blindspot/affinity/voice surface staff and regulars already
// have. Aliases (not a single shared type) keep room for per-kind
// divergence later — e.g. a supplier-only field derived from
// `supplierType` — without touching the staff/regular call sites.
export type SupplierCastAttributes = CastAttributes
export type FactionCastAttributes = CastAttributes
export type NotableNpcCastAttributes = CastAttributes

// Customer groups are cohorts, not individuals: collective likes/dislikes
// already live mechanically on `preferredStockTags` / `dislikedTags` /
// `relationshipToOtherGroups`. Specialty/blindspot don't fit a crowd, so
// the group surface is voice-only. The compose-layer resolver returns an
// adapter shape (empty `specialty`/`blindspot`/`affinities`) so the four
// `CastAttribute` snippet condition primitives evaluate uniformly across
// kinds.
export type CustomerGroupCastAttributes = {
  voice: VoiceProfile
}
