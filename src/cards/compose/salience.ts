// Phase 146 / ISSUE-114 — Legible Surface arc, Phase 1.
//
// Signal salience read. The framework's specificity gradient
// (`assemble.ts:specificityOf`) answers "which snippet is most
// SPECIFIC" — it does not answer "which fact is most DECISION-
// RELEVANT". A supplier card is *about* reliability × relationship,
// so when both bands resolve the establishing line should state the
// pair, not whichever single condition happens to out-specify the
// other.
//
// This file adds the data and pure helpers that let the assembler
// (a) tie-break top-specificity matches by salience, and (b) pick a
// second snippet for the multi-fact establishing slot. Layered OVER
// the gradient — slots that don't opt in (`saliencePolicy === undefined`)
// behave exactly as before.
//
// Two structural rules carried over from the framework (§2.3):
//   1. SalienceReads are DATA, not closures. Inspectable by future
//      gates (Phase 16's legibility gate), enumerable, sampleable.
//   2. The reads stay flat — one entry per (signal | pressure |
//      memory | repeat) — so the same `resolveActorRef` resolution
//      already used by `signalEquals` carries this surface too. No
//      new resolver path.

import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../sim/state/TavernState'
import {
  pressureIsRising,
  querySignal,
  repeatCountByTag,
  type BandId,
  type SignalId,
} from '../../sim/signals'
import { __internal as conditionInternal } from './conditions'
import type { Snippet, SnippetCondition } from './types'

const { resolveActorRef, collectSeedTags } = conditionInternal

/**
 * One read a situation can make against the sim. Mirrors the shape of
 * the existing state-lookup snippet conditions (`signalEquals`,
 * `pressureRising`, `memoryPresent`, `repeatCount`, `hasTag`,
 * `severityAtLeast`) so a snippet's conditions map 1-to-1 onto reads by
 * structural equality.
 *
 * Phase 149 / ISSUE-117 — Legible Surface arc, Phase 4. Added `hasTag`
 * and `severity` so narrator-voiced cluster members (stock_shortage,
 * debt_rent) can declare their top-salient facts as data. The legacy
 * four kinds covered every Movement-V (Phase 1) test case, but the first
 * Movement-VI cluster surfaced two facts that *are* the salient ones —
 * the `rent_due_soon` calendar tag, and the `severityAtLeast 70`
 * crisis-threshold — yet had no salience-table representation.
 */
export type SalienceRead =
  | { kind: 'signal'; role: string; signal: SignalId }
  | { kind: 'pressure'; pressureId: string }
  | { kind: 'memory'; tag: string }
  | { kind: 'repeat'; subjectTag: string; atLeast: number }
  | { kind: 'hasTag'; tag: string }
  | { kind: 'severity'; atLeast: number }

export type SeedFamilySalience = {
  /** Ordered most-salient first. Earlier index = more decision-relevant. */
  reads: readonly SalienceRead[]
}

/**
 * Phase 1 seeds only `supplier_relationship` as scaffolding so the
 * headline test has a real table to bite. The remaining eight cluster
 * tables land in Movement VI's per-cluster phases (4–11), each adding
 * its family's salience here without changing the runtime.
 *
 * Families without an entry resolve to an empty salience read; slots
 * opting in still pick deterministically — they just fall back to the
 * pure specificity + FNV ordering, which is identical to today.
 */
export const SALIENCE_TABLES: Partial<
  Record<IssueSeedFamilyId, SeedFamilySalience>
> = {
  supplier_relationship: {
    reads: [
      { kind: 'signal', role: 'primaryActor', signal: 'supplier.reliability' },
      { kind: 'signal', role: 'primaryActor', signal: 'supplier.relationship' },
      { kind: 'pressure', pressureId: 'supplier_distrust' },
      { kind: 'pressure', pressureId: 'market_instability' },
      { kind: 'repeat', subjectTag: 'supplier', atLeast: 3 },
      { kind: 'memory', tag: 'supplier' },
    ],
  },

  // Phase 149 / ISSUE-117 — Legible Surface arc, Phase 4 (Suppliers,
  // Stock & Debt cluster). Narrator-voiced — neither family carries a
  // primaryActor with castAttributes (stock subject is a stock item;
  // landlord is a `systemRef` per audit pass 1 §5.3), so reads here are
  // pressure / memory / hasTag / severity / repeat only. Order: highest-
  // extremity facts first (the crisis-threshold severity flag or the
  // calendar window dominate decision-relevance), then family pressures,
  // then choice-affecting memories, then the multi-period repeat as the
  // deepest rung.
  stock_shortage: {
    reads: [
      { kind: 'severity', atLeast: 70 },
      { kind: 'pressure', pressureId: 'stock_shortage' },
      { kind: 'hasTag', tag: 'high_demand' },
      { kind: 'pressure', pressureId: 'reputation_drift' },
      { kind: 'memory', tag: 'deception' },
      { kind: 'memory', tag: 'price' },
      { kind: 'memory', tag: 'ignored' },
      { kind: 'memory', tag: 'stock' },
      { kind: 'repeat', subjectTag: 'stock', atLeast: 3 },
    ],
  },
  debt_rent: {
    reads: [
      { kind: 'severity', atLeast: 70 },
      { kind: 'hasTag', tag: 'rent_due_soon' },
      { kind: 'pressure', pressureId: 'debt' },
      { kind: 'pressure', pressureId: 'landlord' },
      { kind: 'memory', tag: 'risk' },
      { kind: 'memory', tag: 'rent' },
      { kind: 'memory', tag: 'landlord' },
      { kind: 'memory', tag: 'debt' },
      { kind: 'repeat', subjectTag: 'debt', atLeast: 3 },
    ],
  },

  // Phase 150 / ISSUE-118 — Legible Surface arc, Phase 5 (Staff &
  // Personnel cluster). Both staff families are actor-voiced — the
  // template `custom` predicate insists primaryActor is a staff member
  // with populated castAttributes — so reads lead with the two banded
  // staff signals (stress, fatigue: extremity 2 at low/high). The
  // family-primary pressure comes next, then the secondary pressure,
  // then choice-affecting memories ordered to mirror each family's
  // generator (`staff_burnout` reads bonus/workload/risk memories;
  // `staff_identity` reads identity/warning memories), then the staff
  // repeat-count as the deepest rung. No new SalienceRead kinds — every
  // read uses the six already shipped (Phase 1 + Phase 4).
  staff_identity: {
    reads: [
      { kind: 'signal', role: 'primaryActor', signal: 'staff.stress' },
      { kind: 'signal', role: 'primaryActor', signal: 'staff.fatigue' },
      { kind: 'pressure', pressureId: 'staff_loyalty_risk' },
      { kind: 'pressure', pressureId: 'staff_burnout' },
      { kind: 'memory', tag: 'identity' },
      { kind: 'memory', tag: 'warning' },
      { kind: 'repeat', subjectTag: 'staff', atLeast: 3 },
    ],
  },
  staff_burnout: {
    reads: [
      { kind: 'signal', role: 'primaryActor', signal: 'staff.stress' },
      { kind: 'signal', role: 'primaryActor', signal: 'staff.fatigue' },
      { kind: 'pressure', pressureId: 'staff_burnout' },
      { kind: 'pressure', pressureId: 'staff_loyalty_risk' },
      { kind: 'memory', tag: 'bonus' },
      { kind: 'memory', tag: 'workload' },
      { kind: 'memory', tag: 'risk' },
      { kind: 'repeat', subjectTag: 'staff', atLeast: 3 },
    ],
  },

  // Phase 151 / ISSUE-119 — Legible Surface arc, Phase 6 (Regulars &
  // Complaints cluster). Both families are actor-voiced (the templates'
  // `custom` predicate insists primaryActor carries castAttributes).
  // Reads lead with the two band signals each family turns on
  // (irritation × loyalty for the named regular; satisfaction × loyalty
  // for the cohort), then the family-primary pressure, then secondary
  // pressures, then choice-affecting memories, then the per-family
  // multi-period repeat-count as the deepest rung. No new SalienceRead
  // kinds — every read uses the six already shipped (Phase 1 + Phase 4).
  //
  // `regular_customer` serves both drinkOrderCard (relationship_test)
  // and regularComplaintCard (complaint) — salience is per-family, not
  // per-template; drinkOrder has no establishing slot opted into the
  // multi-fact policy, so its scoring is effectively a no-op for that
  // template. customer_complaint's generator references five pressures
  // across response profiles; the table lists the top three
  // (reputation_drift, regular_customer_loss, staff_loyalty_risk).
  // rumour_pressure and cultural_tension stay reachable as snippet
  // conditions but aren't broadly salient to a cohort complaint's
  // headline.
  regular_customer: {
    reads: [
      { kind: 'signal', role: 'primaryActor', signal: 'regular.irritation' },
      { kind: 'signal', role: 'primaryActor', signal: 'regular.loyalty' },
      { kind: 'pressure', pressureId: 'regular_customer_loss' },
      { kind: 'memory', tag: 'grudge' },
      { kind: 'memory', tag: 'ignored_complaint' },
      { kind: 'memory', tag: 'warning' },
      { kind: 'memory', tag: 'customer' },
      { kind: 'repeat', subjectTag: 'regular', atLeast: 3 },
    ],
  },
  customer_complaint: {
    reads: [
      { kind: 'signal', role: 'primaryActor', signal: 'customer_group.satisfaction' },
      { kind: 'signal', role: 'primaryActor', signal: 'customer_group.loyalty' },
      { kind: 'pressure', pressureId: 'reputation_drift' },
      { kind: 'pressure', pressureId: 'regular_customer_loss' },
      { kind: 'pressure', pressureId: 'staff_loyalty_risk' },
      { kind: 'memory', tag: 'complaint' },
      { kind: 'memory', tag: 'customer' },
      { kind: 'repeat', subjectTag: 'customer', atLeast: 3 },
    ],
  },

  // Phase 152 / ISSUE-120 — Legible Surface arc, Phase 7 (Factions &
  // Culture cluster). Two new entries. factionRequest is actor-voiced
  // (faction has castAttributes via Phase 128); cultureConflict is
  // narrator-voiced (cultures are population concepts, no individual
  // cast). The two band signals for each family lead the read order
  // (extremity 2 at low/high). For `faction_request` the generator
  // embeds only `faction_anger` and `cultural_tension` as pressures
  // (Phase 136 record) — both listed, primary first. For
  // `culture_conflict` the generator embeds only `cultural_tension`;
  // the four memory tags listed match the generator's emission ranking
  // (mediate / honour / ignore / neglected paths). The `hasTag` reads
  // for festival / ritual stay secondary to memories because the
  // cultural calendar context modulates flavor rather than driving the
  // headline. Both families' banded meters were added in Phase 136 /
  // ISSUE-105 (no Movement-V loopback required).
  //
  // `culture_conflict` is the arc's first 3-meter situation; the
  // establishing pool authors spec-3 cube corners for tension=high ×
  // comfort × familiarity to express the readable cube alongside the
  // 2-meter spec-2 supports. The salience read resolves all three
  // meters independently — slot selection layers over the gradient.
  faction_request: {
    reads: [
      { kind: 'signal', role: 'primaryActor', signal: 'faction.relationship' },
      { kind: 'signal', role: 'primaryActor', signal: 'faction.influence' },
      { kind: 'pressure', pressureId: 'faction_anger' },
      { kind: 'pressure', pressureId: 'cultural_tension' },
      { kind: 'memory', tag: 'grudge' },
      { kind: 'memory', tag: 'refusal' },
      { kind: 'memory', tag: 'gratitude' },
      { kind: 'memory', tag: 'faction' },
      { kind: 'repeat', subjectTag: 'faction', atLeast: 3 },
    ],
  },
  culture_conflict: {
    reads: [
      { kind: 'signal', role: 'primaryActor', signal: 'culture.tension' },
      { kind: 'signal', role: 'primaryActor', signal: 'culture.comfort' },
      { kind: 'signal', role: 'primaryActor', signal: 'culture.familiarity' },
      { kind: 'pressure', pressureId: 'cultural_tension' },
      { kind: 'memory', tag: 'ignored' },
      { kind: 'memory', tag: 'neglected' },
      { kind: 'memory', tag: 'honour' },
      { kind: 'memory', tag: 'mediation' },
      { kind: 'memory', tag: 'culture' },
      { kind: 'hasTag', tag: 'festival' },
      { kind: 'hasTag', tag: 'ritual' },
      { kind: 'repeat', subjectTag: 'culture', atLeast: 3 },
    ],
  },

  // Phase 153 / ISSUE-121 — Legible Surface arc, Phase 8 (Premises &
  // Atmosphere cluster). Both families are NARRATOR-voiced — areas
  // have no `castAttributes` (rooms are not characters) — so pool
  // snippets carry no `voiceAxis` / `verbalTic` conditions. The Phase-
  // 137 `resolveActorRef` extension lets snippets read the area
  // through the `'location'` role for signal lookups. Each template
  // authors a 3-meter cube on its own picker projection:
  //
  //   - `maintenance` picker scores `damage + (60 − condition)`. Lead
  //     read is `area.damage` (strictly dominant: higher = higher
  //     score, no inversion), then `area.condition` (second picker
  //     meter, inverted), then `area.cleanliness` as the cube-face
  //     third meter.
  //   - `area_atmosphere` picker scores `(100 − cleanliness) + damage`
  //     (must score ≥ 60). Lead read is `area.cleanliness` (strictly
  //     dominant), then `area.damage`, then `area.condition` as the
  //     cube-face third.
  //
  // Both families share one pressure (`maintenance`) which follows the
  // three signals. Memory ordering mirrors each generator's prior-
  // choice tag emissions. Two `hasTag` reads on maintenance
  // (`inspection_relevant`, `fire_risk`) and three on area_atmosphere
  // (`reputation`, `inspection_negative`, `merchant_sensitive`) gate
  // top-rung escalation snippets in the existing pools — included so
  // the salience read stays enumerable for the Phase-16 legibility
  // gate. `severity` is NOT a salience read for these families: the
  // pickers don't threshold on severity (severity is downstream of the
  // meters), matching Phase 152's choice for faction / culture. The
  // repeat read is the deepest rung for each (multi-period pattern).
  maintenance: {
    reads: [
      { kind: 'signal', role: 'location', signal: 'area.damage' },
      { kind: 'signal', role: 'location', signal: 'area.condition' },
      { kind: 'signal', role: 'location', signal: 'area.cleanliness' },
      { kind: 'pressure', pressureId: 'maintenance' },
      { kind: 'memory', tag: 'warning' },
      { kind: 'memory', tag: 'ignored' },
      { kind: 'memory', tag: 'patch' },
      { kind: 'memory', tag: 'maintenance' },
      { kind: 'hasTag', tag: 'inspection_relevant' },
      { kind: 'hasTag', tag: 'fire_risk' },
      { kind: 'repeat', subjectTag: 'maintenance', atLeast: 3 },
    ],
  },
  area_atmosphere: {
    reads: [
      { kind: 'signal', role: 'location', signal: 'area.cleanliness' },
      { kind: 'signal', role: 'location', signal: 'area.damage' },
      { kind: 'signal', role: 'location', signal: 'area.condition' },
      { kind: 'pressure', pressureId: 'maintenance' },
      { kind: 'memory', tag: 'atmosphere' },
      { kind: 'memory', tag: 'neglected' },
      { kind: 'memory', tag: 'cleaning' },
      { kind: 'memory', tag: 'repair' },
      { kind: 'hasTag', tag: 'reputation' },
      { kind: 'hasTag', tag: 'inspection_negative' },
      { kind: 'hasTag', tag: 'merchant_sensitive' },
      { kind: 'repeat', subjectTag: 'atmosphere', atLeast: 3 },
    ],
  },
}

/**
 * A read from the table after evaluation against `(seed, state)`. Reads
 * that don't resolve (signal missing, pressure not rising, memory
 * absent, repeat below threshold) are filtered out at resolution; the
 * returned array preserves salience-table order.
 *
 * `extremity` is the secondary tie-break used inside the assembler: a
 * `low` / `high` band fact is "more extreme" (2) than a `mid` band fact
 * (1); pressures / memories / repeats are binary (1).
 */
export type ResolvedRead = {
  read: SalienceRead
  /** For signal reads only. Other kinds carry only fact-of-presence. */
  band?: BandId
  extremity: number
}

/** Read a single salience entry against state. Returns null when the
 *  read doesn't resolve — the resolver filters these out. */
function evaluateRead(
  read: SalienceRead,
  seed: IssueSeed,
  state: TavernState,
): ResolvedRead | null {
  switch (read.kind) {
    case 'signal': {
      const ref = resolveActorRef(read.role, seed)
      if (!ref) return null
      const result = querySignal(state, read.signal, ref)
      if ('missing' in result) return null
      const extremity = result.band === 'mid' ? 1 : 2
      return { read, band: result.band, extremity }
    }
    case 'pressure': {
      if (!pressureIsRising(state, read.pressureId)) return null
      return { read, extremity: 1 }
    }
    case 'memory': {
      const present = state.memories.some((m) => m.tags.includes(read.tag))
      if (!present) return null
      return { read, extremity: 1 }
    }
    case 'repeat': {
      const count = repeatCountByTag(state, read.subjectTag)
      if (count < read.atLeast) return null
      return { read, extremity: 1 }
    }
    case 'hasTag': {
      // Phase 149 / ISSUE-117 — same source as the `hasTag` snippet
      // condition (domain ∪ toneHints ∪ stake tags). Calendar tags that
      // are flowed onto the seed via `toneHints` resolve here.
      if (!collectSeedTags(seed).has(read.tag)) return null
      return { read, extremity: 1 }
    }
    case 'severity': {
      // Phase 149 / ISSUE-117 — extremity 2 at-or-above the crisis-
      // threshold convention (`>= 70`, matching the `severityAtLeast 70`
      // cells across all twenty Movement-II templates), 1 below it. The
      // `read.atLeast` defines what counts as "severity worth opening
      // on" for this family; the extremity ladder mirrors the band
      // extremity used by `signal` reads.
      if (seed.severity < read.atLeast) return null
      const extremity = seed.severity >= 70 ? 2 : 1
      return { read, extremity }
    }
  }
}

/** Resolve a seed's family salience table against state. Returns an
 *  ordered (most-salient-first) array of facts that actually hold; empty
 *  when the family has no table or none of its reads resolve. Pure. */
export function resolveSalientReads(
  seed: IssueSeed,
  state: TavernState,
): ResolvedRead[] {
  const family = seed.family as IssueSeedFamilyId
  const table = SALIENCE_TABLES[family]
  if (!table) return []
  const out: ResolvedRead[] = []
  for (const read of table.reads) {
    const resolved = evaluateRead(read, seed, state)
    if (resolved) out.push(resolved)
  }
  return out
}

/** Does this snippet condition correspond to this read? Structural
 *  equality on the discriminating fields of the matched kinds. */
function conditionMatchesRead(
  condition: SnippetCondition,
  read: ResolvedRead,
): boolean {
  switch (read.read.kind) {
    case 'signal':
      return (
        condition.kind === 'signalEquals' &&
        condition.role === read.read.role &&
        condition.signal === read.read.signal
      )
    case 'pressure':
      return (
        condition.kind === 'pressureRising' &&
        condition.pressureId === read.read.pressureId
      )
    case 'memory':
      return condition.kind === 'memoryPresent' && condition.tag === read.read.tag
    case 'repeat':
      return (
        condition.kind === 'repeatCount' &&
        condition.subjectTag === read.read.subjectTag
      )
    case 'hasTag':
      // Phase 149 / ISSUE-117 — exact tag match.
      return condition.kind === 'hasTag' && condition.tag === read.read.tag
    case 'severity':
      // Phase 149 / ISSUE-117 — a snippet covers the read when its own
      // threshold is at least as tight as the read's. A snippet gated on
      // `severityAtLeast 70` covers the `severity >= 70` read; a snippet
      // gated on `severityAtLeast 85` covers it more sharply (still
      // matches); a snippet gated on `severityAtLeast 50` is looser than
      // the read and does NOT cover it (the snippet would fire for cases
      // the read considers below the salient threshold).
      return (
        condition.kind === 'severityAtLeast' &&
        condition.value >= read.read.atLeast
      )
  }
}

export type SalienceScore = {
  /** Lowest salience-table index this snippet covers (0 = most salient).
   *  `Infinity` when no condition matches any resolved read. */
  index: number
  /** Highest extremity among matching reads. 0 when no match. */
  extremity: number
  /** Which resolved-read indices this snippet covers. Used by the
   *  multi-fact slot to find an "orthogonal" secondary. */
  coveredReadIndices: readonly number[]
}

/**
 * Score one candidate snippet against the resolved salience reads.
 * Lower `index` wins; higher `extremity` breaks index ties.
 *
 * Exported through `__internal` for Phase-16 gate use and tests.
 */
export function scoreCandidateSalience(
  snippet: Snippet,
  resolved: readonly ResolvedRead[],
): SalienceScore {
  let bestIndex = Infinity
  let bestExtremity = 0
  const covered: number[] = []
  for (let i = 0; i < resolved.length; i++) {
    const r = resolved[i]!
    const hit = snippet.conditions.some((c) => conditionMatchesRead(c, r))
    if (!hit) continue
    covered.push(i)
    if (i < bestIndex) {
      bestIndex = i
      bestExtremity = r.extremity
    } else if (i === bestIndex && r.extremity > bestExtremity) {
      bestExtremity = r.extremity
    }
  }
  return { index: bestIndex, extremity: bestExtremity, coveredReadIndices: covered }
}

export const __internal = {
  evaluateRead,
  conditionMatchesRead,
}
