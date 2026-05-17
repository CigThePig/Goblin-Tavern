// Phase 88 — Card selection algorithm.
//
// Picks one CardDefinition per (seed, state). When multiple cards match
// the same seed, the order is:
//   1. priority desc (higher first; undefined treated as 0)
//   2. specificity desc (more constrained appliesTo wins)
//   3. id asc (stable tie-break)
//
// Specificity = count of defined constraints in `appliesTo`, with array
// constraints scoring 1 per entry (so a card listing two timings is more
// specific than one listing five). The `custom` predicate scores 2 since
// it can encode state-dependent matching that the simpler fields can't.
//
// Seeds with `validation.valid === false` are filtered out by the UI
// before reaching the card layer (cards-contract §1, rule 7), but the
// selection algorithm tolerates them — it just won't have a use for them.

import type { CardDefinition, CardAppliesTo } from './types'
import type { IssueSeed } from '../sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../sim/state/TavernState'

export function appliesToMatches(
  appliesTo: CardAppliesTo,
  seed: IssueSeed,
  state: TavernState,
): boolean {
  if (
    appliesTo.seedTypes &&
    appliesTo.seedTypes.length > 0 &&
    !appliesTo.seedTypes.includes(seed.type)
  ) {
    return false
  }
  if (
    appliesTo.seedFamilies &&
    appliesTo.seedFamilies.length > 0 &&
    !appliesTo.seedFamilies.includes(seed.family as never)
  ) {
    return false
  }
  if (
    appliesTo.timings &&
    appliesTo.timings.length > 0 &&
    !appliesTo.timings.includes(seed.timing)
  ) {
    return false
  }
  if (appliesTo.requiredTags && appliesTo.requiredTags.length > 0) {
    const haystack = new Set<string>([
      ...seed.domain,
      ...seed.toneHints,
      ...seed.stakes.flatMap((s) => s.tags),
    ])
    for (const tag of appliesTo.requiredTags) {
      if (!haystack.has(tag)) return false
    }
  }
  if (
    appliesTo.minSeverity !== undefined &&
    seed.severity < appliesTo.minSeverity
  ) {
    return false
  }
  if (
    appliesTo.minCardWorthiness !== undefined &&
    seed.cardWorthiness < appliesTo.minCardWorthiness
  ) {
    return false
  }
  if (appliesTo.custom && !appliesTo.custom(seed, state)) {
    return false
  }
  return true
}

export function specificity(appliesTo: CardAppliesTo): number {
  let n = 0
  if (appliesTo.seedTypes) n += appliesTo.seedTypes.length
  if (appliesTo.seedFamilies) n += appliesTo.seedFamilies.length
  if (appliesTo.timings) n += appliesTo.timings.length
  if (appliesTo.requiredTags) n += appliesTo.requiredTags.length
  if (appliesTo.minSeverity !== undefined) n += 1
  if (appliesTo.minCardWorthiness !== undefined) n += 1
  if (appliesTo.custom) n += 2
  return n
}

export function compareCards(a: CardDefinition, b: CardDefinition): number {
  const pa = a.priority ?? 0
  const pb = b.priority ?? 0
  if (pa !== pb) return pb - pa
  const sa = specificity(a.appliesTo)
  const sb = specificity(b.appliesTo)
  if (sa !== sb) return sb - sa
  return a.id.localeCompare(b.id)
}

/**
 * Pick the single best card for the given seed from the candidate list.
 * Returns `undefined` if no card matches; callers should fall back to a
 * registered catch-all card so every valid seed renders.
 */
export function pickCardForSeed(
  seed: IssueSeed,
  state: TavernState,
  candidates: readonly CardDefinition[],
): CardDefinition | undefined {
  const matches = candidates.filter((c) => appliesToMatches(c.appliesTo, seed, state))
  if (matches.length === 0) return undefined
  matches.sort(compareCards)
  return matches[0]
}
