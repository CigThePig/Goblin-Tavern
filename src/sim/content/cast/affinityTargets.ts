// Phase 121 / ISSUE-090 — Living Cast Phase A.
//
// Affinity targets are coarse entity-kind tags — "goblins", "miners",
// "merchants" — not `EntityRef`s. Tag-shaped on purpose: a character's
// affinity for "merchants" survives the churn of any particular
// merchant regular emerging or fading. The bounded set is drawn from
// the cultures and customer groups registered in
// `src/sim/content/cultures/cultureRegistry.ts` plus a small handful of
// broader social categories.
//
// Adding new entries here is a one-line edit; removing entries needs a
// migration helper because in-state attributes may carry the old tag.
// Phase A keeps the list tight on purpose.

export const AFFINITY_TARGETS: readonly string[] = [
  // Cultures / heritages
  'goblins',
  'ogres',
  'dwarves',
  'humans',
  // Customer-group flavours
  'miners',
  'merchants',
  'caravans',
  'adventurers',
  'clergy',
  'nobles',
  // House-shaped affinities (not bound to a specific entity)
  'house_regulars',
  'rowdies',
  'outsiders',
] as const

export const AFFINITY_TARGET_SET: ReadonlySet<string> = new Set(AFFINITY_TARGETS)

export function isKnownAffinityTarget(target: string): boolean {
  return AFFINITY_TARGET_SET.has(target)
}
