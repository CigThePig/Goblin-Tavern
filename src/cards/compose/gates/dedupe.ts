// Phase 130 / ISSUE-099 — Voiced Surface arc, Phase 4.
//
// Dedupe gate. Every committed pool — hand-authored, agent-authored, or
// migrated — is checked for near-duplicate snippets within a slot and
// canonical-text duplicates across slots. Lifted and trimmed from the
// retired `scripts/generate-pool/dedupe.ts` (Phase 125 / ISSUE-094): the
// 0.85 threshold, canonical-form normalisation, and within/cross-slot
// split carry over. The retry-loop machinery (keeper resolution,
// rejection feedback) does not — a gate only reports pass/fail.

import type { CompositionalCardTemplate } from '../types'
import { failReport, type GateReport, type GateViolation } from './types'
import { normalisedSimilarity } from './levenshtein'

export const DEFAULT_DEDUPE_THRESHOLD = 0.85

export type DedupeConfig = {
  threshold?: number
}

export function canonicaliseText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?—–\-:;"'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function checkDedupe(
  template: CompositionalCardTemplate,
  config?: DedupeConfig,
): GateReport {
  const threshold = config?.threshold ?? DEFAULT_DEDUPE_THRESHOLD
  const violations: GateViolation[] = []

  for (const slot of template.slots) {
    const canonicals = slot.pool.snippets.map((s) => ({
      id: s.id,
      canonical: canonicaliseText(s.text),
    }))
    for (let i = 0; i < canonicals.length; i++) {
      for (let j = i + 1; j < canonicals.length; j++) {
        const sim = normalisedSimilarity(
          canonicals[i]!.canonical,
          canonicals[j]!.canonical,
        )
        if (sim >= threshold) {
          violations.push({
            slotId: slot.id,
            snippetId: canonicals[j]!.id,
            reason: sim === 1 ? 'canonical_equality' : 'near_duplicate',
            detail: `${canonicals[i]!.id} ~= ${canonicals[j]!.id} (sim ${sim.toFixed(3)})`,
          })
        }
      }
    }
  }

  const seen = new Map<string, { slotId: string; id: string }>()
  for (const slot of template.slots) {
    for (const snippet of slot.pool.snippets) {
      const key = canonicaliseText(snippet.text)
      const prior = seen.get(key)
      if (prior && prior.slotId !== slot.id) {
        violations.push({
          slotId: slot.id,
          snippetId: snippet.id,
          reason: 'cross_slot_canonical_equality',
          detail: `${prior.slotId}:${prior.id} == ${slot.id}:${snippet.id}`,
        })
      } else if (!prior) {
        seen.set(key, { slotId: slot.id, id: snippet.id })
      }
    }
  }

  return failReport(violations)
}
