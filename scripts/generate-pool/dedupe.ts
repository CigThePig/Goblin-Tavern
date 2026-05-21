// Phase 125 / ISSUE-094 — Living Cast arc, Phase E.
//
// Within-pool near-duplicate detection. Two passes:
//   1. WITHIN a slot — Levenshtein-on-canonical-form similarity ≥ 0.85
//      collapses near-duplicates. Higher specificity wins; tie → lex-
//      smaller id.
//   2. ACROSS slots — only canonical-equality (1.0). Different slots
//      may legitimately share themes; we only collapse exact repeats.
//
// Both passes are deterministic given a stable input order: we sort
// candidates by (specificity desc, id asc) before pairing so the
// "keeper" is reproducible across runs.

import type { Snippet } from '../../src/cards/compose/types'
import type { DedupeRejection } from './types'
import { normalisedSimilarity } from './levenshtein'

export const DEFAULT_DEDUPE_THRESHOLD = 0.85

export function canonicaliseText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?—–\-:;"'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function specificityOf(s: Snippet): number {
  return s.specificity ?? s.conditions.length
}

function rankFor(snippet: Snippet): { spec: number; id: string } {
  return { spec: specificityOf(snippet), id: snippet.id }
}

function preferKeeperOrder(a: Snippet, b: Snippet): number {
  const ra = rankFor(a)
  const rb = rankFor(b)
  if (ra.spec !== rb.spec) return rb.spec - ra.spec
  return ra.id.localeCompare(rb.id)
}

export type SlotDedupeResult = {
  slotId: string
  kept: Snippet[]
  rejections: DedupeRejection[]
}

/** Remove near-duplicate snippets within one slot's pool. */
export function dedupeSlot(
  slotId: string,
  snippets: Snippet[],
  threshold: number = DEFAULT_DEDUPE_THRESHOLD,
): SlotDedupeResult {
  const ordered = [...snippets].sort(preferKeeperOrder)
  const kept: Snippet[] = []
  const keptCanonical: string[] = []
  const rejections: DedupeRejection[] = []
  for (const candidate of ordered) {
    const candCanonical = canonicaliseText(candidate.text)
    let rejected = false
    for (let i = 0; i < kept.length; i++) {
      const sim = normalisedSimilarity(candCanonical, keptCanonical[i]!)
      if (sim >= threshold) {
        rejections.push({
          keptId: kept[i]!.id,
          rejectedId: candidate.id,
          similarity: sim,
          reason: sim === 1 ? 'canonical_equality' : 'near_duplicate',
        })
        rejected = true
        break
      }
    }
    if (!rejected) {
      kept.push(candidate)
      keptCanonical.push(candCanonical)
    }
  }
  return { slotId, kept, rejections }
}

export type CrossSlotDedupeResult = {
  perSlot: SlotDedupeResult[]
  crossSlotRejections: DedupeRejection[]
}

/** Dedupe within each slot, then collapse cross-slot canonical-equality
 *  cases. Within-slot uses the configurable threshold; cross-slot uses
 *  a strict 1.0 (canonical-text equality). */
export function dedupePools(
  bySlot: ReadonlyArray<{ slotId: string; snippets: Snippet[] }>,
  threshold: number = DEFAULT_DEDUPE_THRESHOLD,
): CrossSlotDedupeResult {
  const perSlot = bySlot.map((b) => dedupeSlot(b.slotId, b.snippets, threshold))
  const seen = new Map<string, { slotId: string; id: string }>()
  const crossSlotRejections: DedupeRejection[] = []
  const filtered: SlotDedupeResult[] = perSlot.map((s) => ({
    slotId: s.slotId,
    kept: [] as Snippet[],
    rejections: [...s.rejections],
  }))
  for (let i = 0; i < perSlot.length; i++) {
    const slot = perSlot[i]!
    for (const snippet of slot.kept) {
      const key = canonicaliseText(snippet.text)
      const prior = seen.get(key)
      if (prior && prior.slotId !== slot.slotId) {
        crossSlotRejections.push({
          keptId: `${prior.slotId}:${prior.id}`,
          rejectedId: `${slot.slotId}:${snippet.id}`,
          similarity: 1,
          reason: 'canonical_equality',
        })
        continue
      }
      seen.set(key, { slotId: slot.slotId, id: snippet.id })
      filtered[i]!.kept.push(snippet)
    }
  }
  return { perSlot: filtered, crossSlotRejections }
}
