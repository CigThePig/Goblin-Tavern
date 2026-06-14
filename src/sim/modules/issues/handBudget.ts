import type { IssueSeed } from './issueSeedTypes'

// Phase 2 (teleology) — hand-composition budget.
//
// The daily hand count was previously emergent: every ranked seed that
// survived validation/fairness landed on `seedsToday`. With teleology now
// feeding low-severity `opportunity` seeds (openings, venture stages) into
// the same ranked list, a busy reactive day could crowd them out entirely,
// because rank is severity/urgency-led. This step runs immediately after
// ranking and bounds the hand to a budget while *reserving* slots so a few
// teleology seeds and a few triage (reactive) seeds always survive a
// truncation. It is a pure, sim-side selection so replay stays
// deterministic; it only changes behaviour when the ranked set exceeds the
// total budget.

// Teleology seeds are identified by family. The `opportunity` type alone is
// not sufficient (other families also use it), so we key off the teleology
// families directly.
const TELEOLOGY_FAMILIES: ReadonlySet<string> = new Set(['venture', 'opening'])

export type HandBudgetOptions = {
  totalBudget: number
  teleologyReserve: number
  triageReserve: number
}

export const DEFAULT_HAND_BUDGET: HandBudgetOptions = {
  totalBudget: 6,
  teleologyReserve: 2,
  triageReserve: 3,
}

function isTeleology(seed: IssueSeed): boolean {
  return TELEOLOGY_FAMILIES.has(seed.family as string)
}

/** Bound a ranked seed list to the hand budget, preserving the input order
 *  (rank). Up to `teleologyReserve` teleology seeds and `triageReserve`
 *  triage seeds are guaranteed to survive even if lower-ranked than the
 *  seeds that would otherwise fill the budget; any remaining slots are
 *  filled by overall rank. Returns the kept seeds in their original ranked
 *  order. */
export function applyHandBudget(
  ranked: readonly IssueSeed[],
  opts: HandBudgetOptions = DEFAULT_HAND_BUDGET,
): IssueSeed[] {
  if (ranked.length <= opts.totalBudget) return [...ranked]

  const keep = new Set<IssueSeed>()

  // Reserve the top-ranked teleology seeds.
  let teleologyKept = 0
  for (const seed of ranked) {
    if (teleologyKept >= opts.teleologyReserve) break
    if (isTeleology(seed)) {
      keep.add(seed)
      teleologyKept += 1
    }
  }

  // Reserve the top-ranked triage (non-teleology) seeds.
  let triageKept = 0
  for (const seed of ranked) {
    if (triageKept >= opts.triageReserve) break
    if (!isTeleology(seed) && !keep.has(seed)) {
      keep.add(seed)
      triageKept += 1
    }
  }

  // Fill any remaining budget by overall rank.
  for (const seed of ranked) {
    if (keep.size >= opts.totalBudget) break
    keep.add(seed)
  }

  // Emit in original ranked order.
  return ranked.filter((seed) => keep.has(seed)).slice(0, opts.totalBudget)
}
