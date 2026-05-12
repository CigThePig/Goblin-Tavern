// Phase 22 §"Faction Types" / Phase 30 §30.4 — faction definition shape.
//
// Phase 30 extends the Phase 22 skeleton with `description`,
// `defaultInfluence`, `defaultTrust`, `defaultFear`, `interests`,
// `likedPolicies`, and `dislikedPolicies`. The Phase 22 `pressureTags`
// field is folded into `tags` per the Phase 30 spec — there is no
// behaviour that needs a separate `pressureTags` array; entries in
// `tags` can serve the same purpose. The Phase 22 `label` and `tags`
// field names stay stable — Phase 30 only adds, never renames.

export type FactionDefinition = {
  id: string
  label: string
  tags: string[]
  cultureId?: string
  defaultRelationship: number
  // Phase 30 §30.4 — added fields.
  description: string
  defaultInfluence: number
  defaultTrust: number
  defaultFear: number
  interests: string[]
  likedPolicies: string[]
  dislikedPolicies: string[]
}
