// Phase 22 §"Faction Types" — faction definition shape.
//
// Phase 30 extends this skeleton with `description`, `defaultInfluence`,
// `defaultTrust`, `defaultFear`, `interests`, `likedPolicies`, and
// `dislikedPolicies`, and folds `pressureTags` into `tags`. The `label`
// field name stays stable — Phase 30 only adds, never renames.

export type FactionDefinition = {
  id: string
  label: string
  tags: string[]
  cultureId?: string
  defaultRelationship: number
  pressureTags: string[]
}
