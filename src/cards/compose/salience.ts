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
